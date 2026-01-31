import json
import uuid
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
from geopy.distance import geodesic
from Mongo_interaction import EventSearcher
from Agency_event_allocation_db_2 import EventProcessor
from Agency_event_allocation_db_2 import ConfigLoader
from Agency_event_allocation_db_2 import AgencyFinder
from Agency_event_allocation_db_2 import JurisdictionFinder
from Agency_event_allocation_db_2 import MongoDBClient
import secrets
import os
import config  # Using your config file

# MongoDB Connection
db_client = MongoDBClient(config.MONGO_URI)  # Use the wrapper with config
client = db_client.client  # Extract the raw client if needed
db = client[config.MONGO_DB]
events = db["events"]
incidents = db[config.MONGO_COLLECTION]  # Use configured collection name
searcher = EventSearcher(db)

# initialize Agency_event_allocation_db_2 requirements 
config_loader = ConfigLoader(config_path="Incident_criticalness.json")
agency_finder = AgencyFinder(db_client)
jurisdiction_finder = JurisdictionFinder(db_client)
processor = EventProcessor(config_loader, agency_finder, jurisdiction_finder)

with open("incident_codes.json", "r") as f:
    INCIDENT_CODES = json.load(f)

SEQUENCE_TRACKER_FILE = "event_sequence_tracker.json"

class EventHandler:
    """
    Handles event-related operations, such as finding similar events and creating new events.
    """

    def __init__(self, events_collection, searcher):
        self.events_collection = events_collection
        self.searcher = searcher

    def handle_event(self, incident,incident_type):
        """
        Handles an incident by either adding it to an existing event or creating a new event.
        :param incident: The incident data to handle.
        :return: A dictionary containing the event ID and status.
        """
        #print("Received incident:", incident)
        detected_incident=incident_type
        # Find a similar event
        print(incident)
        matching_event_id = self.searcher.find_similar_event(incident_type,incident)
        #print("Matching event ID:", matching_event_id)

        if matching_event_id:
            # Add the incident to the existing event
            self._add_incident_to_event(matching_event_id, incident)
            return {
                "_id": matching_event_id,
                "status": "updated",
                "description": f"Incident added to existing event {matching_event_id}"
            }
        else:
            # Create a new event
            new_event_id = self._create_new_event(incident,detected_incident)
            return {
                "_id": new_event_id,
                "status": "new",
                "description": f"New {detected_incident} incident"
            }
    
    @staticmethod
    def load_sequence_tracker():
        """Loads the sequence tracker from a file."""
        if os.path.exists(SEQUENCE_TRACKER_FILE):
            with open(SEQUENCE_TRACKER_FILE, "r") as file:
                return json.load(file)
        return {}
    
    @staticmethod
    def save_sequence_tracker(tracker):
        """Saves the sequence tracker to a file."""
        with open(SEQUENCE_TRACKER_FILE, "w") as file:
            json.dump(tracker, file)

    def _add_incident_to_event(self, event_id, incident):
        """
        Adds an incident to an existing event.
        :param event_id: The ID of the event to update.
        :param incident: The incident data to add.
        """
        self.events_collection.update_one(
            {"_id": event_id},
            {"$push": {"incidents": incident}}  # Append incident to incidents array
        )
        print(f"Incident added to event {event_id}")

    def _generate_event_id(self, incident_type):
        """Generates a unique event ID based on date, incident type, and a random hex string."""
        today = datetime.utcnow().strftime("%Y%m%d")  # Format: YYYYMMDD
        incident_code = INCIDENT_CODES.get(incident_type, "UNK")  # Get code or default to "UNK"
        # random_hex = secrets.token_hex(3).upper()  # Generate a 6-character random hex
        sequence_tracker = EventHandler.load_sequence_tracker()

        # Increment sequence or reset if a new day
        if today not in sequence_tracker:
            sequence_tracker[today] = 1
        else:
            sequence_tracker[today] += 1
        
        seq_number = sequence_tracker[today]
        EventHandler.save_sequence_tracker(sequence_tracker)  # Save the updated sequence
        

        return f"E-{today}-{incident_code}-{seq_number:03d}"

    def _create_new_event(self, incident, detected_incident):
        """
        Creates a new event with the given incident.
        :param incident: The incident data to include in the new event.
        :return: The ID of the newly created event.
        """
        detected_object = incident["detected_objects"]

        if not isinstance(detected_object, str):
            detected_object = " ".join(map(str, detected_object))  # Convert list to space-separated string

        Extract_event_data = {
            "detected_object": detected_incident,
            "latitude": incident["location"]["coordinates"][1],
            "longitude": incident["location"]["coordinates"][0]
        }
        print("Extract_event_data:", Extract_event_data)
        assigned_agency = processor.process_event(Extract_event_data)
        print("Allocated Agency:", assigned_agency)

        new_event_id = self._generate_event_id(detected_incident)  # Generate event ID

        new_event = {
            "event_id": new_event_id,  # Use generated event ID
            "description": f"{detected_incident} event",
            "status": "open",
            "assigned_agency": assigned_agency,
            "assignment_time": None,
            "ground_staff": None,
            "incidents": [incident]
        }
        self.events_collection.insert_one(new_event)
        print(f"New event created with ID: {new_event_id}")
        return new_event_id

# Example usage
if __name__ == "__main__":
    # Initialize EventHandler
    event_handler = EventHandler(events, searcher)

    # Example incident
    incident = {
        "_id": "incident_855",
        "userId": "user_69",
        "imageLink": "http://example.com/pothole.jpg",
        "location": {
            "type": "Point",
            "coordinates": [86.205, 20.705]  # [longitude, latitude]
        },
        "timestamp": {
            "$date": "2025-03-07T08:19:27.895Z"
        },
        "detected_objects": "car accident",
        "boundingBox": [50, 75, 100, 125]
    }

    # Handle the incident
    result = event_handler.handle_event(incident)
    print("Result:", result)