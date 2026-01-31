import boto3
import base64
import io
import re
import datetime
import uuid
import json
import os
import datetime # Changed import
import config  # Import configuration file

# MinIO Configuration
MINIO_URL = config.MINIO_ENDPOINT  # Example: "http://192.168.1.116:9000"
ACCESS_KEY = config.MINIO_ACCESS_KEY  
SECRET_KEY = config.MINIO_SECRET_KEY
BUCKET_NAME = config.BUCKET_NAME

# Sequence tracker file for persistent storage
SEQUENCE_TRACKER_FILE = "incident_sequence_tracker.json"

class FilenameGenerator:
    """Handles structured file naming logic."""
    
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

    @staticmethod
    def generate_incident_id(self):
        """Generates a sequential incident ID in the format I-YYYYMMDD-SEQ."""
        date_part = datetime.datetime.now(datetime.UTC).strftime("%Y%m%d")  # YYYYMMDD
        sequence_tracker = FilenameGenerator.load_sequence_tracker()

        # Increment sequence or reset if a new day
        if date_part not in sequence_tracker:
            sequence_tracker[date_part] = 1
        else:
            sequence_tracker[date_part] += 1
        
        seq_number = sequence_tracker[date_part]
        FilenameGenerator.save_sequence_tracker(sequence_tracker)  # Save the updated sequence
        
        return f"I-{date_part}-{seq_number:03d}"
    
    @staticmethod
    def generate(incident_id, existing_files):
        """Generates a structured filename based on existing objects."""
        current_year = datetime.datetime.now(datetime.UTC).year
        prefix = f"{current_year}/{incident_id}"

        # existing_indexes = [
        #     int(match.group(1))
        #     for obj in existing_files if (match := re.search(rf"{prefix}-(\d+)\.jpg", obj))
        # ]

        # next_index = max(existing_indexes, default=0) + 1
        return f"{prefix}.jpg"

class MinIOStorage:
    """Handles MinIO operations: upload and retrieve URLs."""
    
    def __init__(self, endpoint_url, access_key, secret_key, bucket_name):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key
        )
        self.bucket_name = bucket_name
        self.endpoint_url = endpoint_url

    def get_existing_files(self, prefix):
        """Lists existing objects in a given prefix for filename generation."""
        try:
            objects = self.s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
            return [obj["Key"] for obj in objects.get("Contents", [])]
        except Exception as e:
            print(f"⚠️ [ERROR] Could not fetch existing files: {e}")
            return []
    
    def upload_image(self, base64_image):
        """Uploads a Base64 image to MinIO and returns the URL."""
        incident_id = FilenameGenerator.generate_incident_id(self)
        existing_files = self.get_existing_files(f"{datetime.datetime.now(datetime.UTC).year}/{incident_id}/")
        filename = FilenameGenerator.generate(incident_id, existing_files)
        
        try:
            image_bytes = base64.b64decode(base64_image.split(",")[1] if "," in base64_image else base64_image)
            image_buffer = io.BytesIO(image_bytes)
            
            self.s3_client.upload_fileobj(
                image_buffer,
                self.bucket_name,
                filename,
                ExtraArgs={'ContentType': 'image/jpeg'}
            )
            
            image_url = f"{self.endpoint_url}/{BUCKET_NAME}/{filename}"
            print(f"✅ Image uploaded successfully: {image_url}")
            return image_url
        except Exception as e:
            print(f"⚠️ [ERROR] Failed to upload image to MinIO: {e}")
            return None

# Initialize MinIO Client
minio_storage = MinIOStorage(MINIO_URL, ACCESS_KEY, SECRET_KEY, BUCKET_NAME)

def process_image(incident):
    """
    Handles image processing:
    - Uploads to MinIO
    - Returns the uploaded image URL
    """
    base64_img = incident.get("base64_img")
    
    if not base64_img:
        print("❌ [ERROR] Missing required fields in incident data.")
        return None
    
    result = minio_storage.upload_image(base64_img)
    if result:
        print("✅ Image processing completed successfully.")
    else:
        print("❌ Image processing failed.")
    return result


# === TESTING THE CODE ===
if __name__ == "__main__":
    print("🛠 Running test...")
    with open("test_image.jpg", "rb") as image_file:
        base64_str = base64.b64encode(image_file.read()).decode("utf-8")
    
    incident = {
        "base64_img": f"data:image/jpeg;base64,{base64_str}"
    }
    
    result = process_image(incident)
    if result:
        print(f"✅ [TEST PASSED] Image processed successfully: {result}")
    else:
        print(f"❌ [TEST FAILED] Image processing failed.")
