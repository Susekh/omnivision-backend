import os

# RabbitMQ Configuration
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")  #host.docker.internal
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
INPUT_QUEUE = os.getenv("INPUT_QUEUE", "detected_objects_queue")
# OUTPUT_QUEUE = os.getenv("OUTPUT_QUEUE", "detected_objects_queue")

# MinIO Configuration
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://minio:9000").strip() #http://host.docker.internal:9000
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
BUCKET_NAME = os.getenv("BUCKET_NAME", "billion-eyes-images")

# MongoDB Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongodb:27017") #mongodb://host.docker.internal:27017
MONGO_DB = os.getenv("MONGO_DB", "BillionEyes_V1")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "Incident") 