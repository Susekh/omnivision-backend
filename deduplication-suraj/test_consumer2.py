import pika
import json
from pymongo import MongoClient
from Mongo_interaction import EventSearcher
from test_dedup3 import EventHandler  # Import deduplication function
from incident_classifier import IncidentClassifier  # Import classifier
from incident_classifier import IncidentPrioritizer
from demo_objectstorage3 import process_image
from demo_objectstorage3 import FilenameGenerator
from datetime import datetime
import config  # Using your config file

# MongoDB Connection
mongo_client = MongoClient(config.MONGO_URI)
db = mongo_client[config.MONGO_DB]
incidents_collection = db[config.MONGO_COLLECTION]  # Collection to store raw incidents

# Initializing deduplication module
searcher = EventSearcher(db)
events = db["events"]
event_handler = EventHandler(events, searcher)

# Initializing the classifier
prioritizer = IncidentPrioritizer('priority.json')
classifier = IncidentClassifier(prioritizer)  # ✅ Create an instance


generator = FilenameGenerator()

# RabbitMQ connection
def connect_rabbitmq():
    connection = pika.BlockingConnection(pika.ConnectionParameters(
        host=config.RABBITMQ_HOST,
        port=config.RABBITMQ_PORT
    ))
    channel = connection.channel()
    channel.queue_declare(queue=config.INPUT_QUEUE)  # Ensure queue exists
    return channel

# Message processing
def callback(ch, method, properties, body):
    try:
        incident = json.loads(body)  # Deserialize message
        print("Received Event.")

        # Extract required fields
        detected_objects = incident.get("detected_objects", "")

        # Ensure detected_objects is a string before applying lower()
        if isinstance(detected_objects, list):
            detected_objects = " ".join(detected_objects)  # Convert list to space-separated string

        detected_object = detected_objects.lower()

        # Extract timestamp correctly
        timestamp = incident.get("timestamp", None)

        if isinstance(timestamp, dict):  # If timestamp is a dictionary, extract "$date"
            timestamp = timestamp.get("$date")
        elif isinstance(timestamp, str):  # Convert string timestamp to required format
            try:
                dt_obj = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                timestamp = {"$date": dt_obj.isoformat().replace("+00:00", "Z")}
            except ValueError:
                timestamp = None  # Handle invalid format

        # At this point, timestamp is either a dictionary with "$date" or None
        print("Parsed Timestamp:", timestamp)

        # Extract coordinates correctly
        coordinates = incident.get("location", {}).get("coordinates", [])
        longitude, latitude = coordinates if len(coordinates) == 2 else (None, None)

        location = {
            "type": "Point",
            "coordinates": [longitude, latitude]
        }

        # Extract base64 image
        base64_image = incident.get("base64String", "")
        print("[DEBUG] Base64 String Length:", len(base64_image))
       
        # Debugging output
        print(f"[DEBUG] Extracted Data -> Object: {detected_object}, Timestamp: {timestamp}, Location: {location}")

        # Check if required fields are missing
        if not (detected_object and location["coordinates"] != [None, None] and timestamp and base64_image):
            print("[ERROR] Missing required fields in incident data.")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            return
        print(timestamp)
        # Classify the incident using the classifier instance
        incident_type = classifier.process_incidents(detected_object, timestamp)  # ✅ Call method from instance

        # If it's a valid incident, store it in MongoDB
        if incident_type:
            incident["incident_type"] = incident_type
            incident["location"] = location  # ✅ Correctly using the location dictionary
            incident["timestamp"] = timestamp  # ✅ Ensure timestamp is stored in the right format

            # Upload to object storage and get incident ID
            image_url = process_image({
                "base64_img": f"data:image/jpeg;base64,{base64_image}",
                "detected_object": detected_object
            })

            if image_url:
                incident["image_url"] = image_url
                incident["incident_id"] = generator.generate_incident_id(detected_object)  # Generate incident ID
            else:
                print("[ERROR] Image processing failed, skipping MongoDB insert.")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                return

            # Insert into MongoDB
            incident.pop("base64String", None)  # Remove base64String if it exists
            incidents_collection.insert_one(incident)
            print("Incident pushed to MongoDB")

            print("Sending to handle_event.")

            # Pass event to deduplication function
            output = event_handler.handle_event(incident,incident_type)
            print("Deduplication Output:", output)

        else:
            print("[INFO] Event is not an incident, skipping MongoDB insert.")

        # Acknowledge message after processing
        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        print("[ERROR] Processing message:", str(e))
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)  # Don't requeue on failure

# Start consuming messages
channel = connect_rabbitmq()
channel.basic_consume(queue=config.INPUT_QUEUE, on_message_callback=callback)

print("Waiting for messages...")
channel.start_consuming()