import logging
from pymongo import MongoClient
from datetime import datetime, timedelta
from geopy.distance import geodesic
from typing import Optional, Dict
import traceback

# Configure logging
logging.basicConfig(
    filename="event_searcher.log",
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

class EventSearcher:
    """
    A class responsible for searching for similar events in the database
    based on timestamp, status, incident type, and geolocation.
    """

    def __init__(self, db):
        """
        Initialize the EventSearcher with a database connection.
        :param db: MongoDB database instance
        """
        self.events_collection = db["events"]
        logging.info("EventSearcher initialized with database connection.")
        from datetime import datetime

        ts1 = datetime.strptime("2025-03-05T17:07:40.246", "%Y-%m-%dT%H:%M:%S.%f")
        ts2 = datetime.strptime("2025-03-05T08:59:09.906", "%Y-%m-%dT%H:%M:%S.%f")

        time_diff = abs(ts1 - ts2)
        print(time_diff)  # Expected output: ?


    @staticmethod
    def parse_timestamp(ts: str) -> datetime:
        """
        Convert a timestamp string (or dict with '$date') into a datetime object.
        """
        try:
            if isinstance(ts, datetime):
                return ts  # Already a datetime object

            if isinstance(ts, dict) and "$date" in ts:
                ts = ts["$date"]

            if isinstance(ts, str):
                parsed_time = datetime.strptime(ts.replace("Z", ""), "%Y-%m-%dT%H:%M:%S.%f")
                logging.debug(f"Parsed timestamp: {parsed_time}")
                return parsed_time
        
            raise ValueError(f"Unexpected timestamp format: {ts}")
    
        except Exception as e:
            logging.error(f"Failed to parse timestamp: {ts} - Error: {e}")
            traceback.print_exc()
            return None  # Or handle accordingly

    @staticmethod
    def calculate_distance(coords1: list, coords2: list) -> float:
        """
        Calculate the geospatial distance in meters between two locations. 
        """

        latlon1 = (coords1[1], coords1[0])
        latlon2 = (coords2[1], coords2[0])

        distance = geodesic(latlon1, latlon2).meters
        logging.debug(f"Calculated distance: {distance} meters between {latlon1} and {latlon2}")
        return distance

    @staticmethod
    def extract_coordinates(location: Dict) -> tuple:
        """
        Extracts coordinates from location data regardless of format.
        """
        if "coordinates" in location:  # GeoJSON format
            return location["coordinates"][1], location["coordinates"][0]
        if "coordinates" in location:  # GeoJSON format
            return location["coordinates"][1], location["coordinates"][0]
        elif "latitude" in location and "longitude" in location:  # Direct lat/lon format
            return location["latitude"], location["longitude"]
        else:
            logging.error("Invalid location format: %s", location)
            raise ValueError("Invalid location format")

    def get_candidate_events(self, incident_type: str) -> list:
        """
        Retrieve candidate events that match the incident type and are not closed.
        """
        logging.info(f"Fetching candidate events for incident type: {incident_type}")
        candidate_events = list(self.events_collection.find({
            "status": { "$ne": "closed" },
            "incidents": { "$elemMatch": { "incident_type": incident_type } }
            }))
        logging.info(f"Found {len(candidate_events)} candidate events.")
        return candidate_events

    def get_most_recent_incident(self, incidents: list) -> Optional[Dict]:
        """
        Find the most recent incident in an event based on timestamp.
        """
        if not incidents:
            logging.warning("No incidents found in event.")
            return None
        recent_incident = max(incidents, key=lambda inc: self.parse_timestamp(inc["timestamp"]))
        logging.debug(f"Most recent incident: {recent_incident}")
        return recent_incident

    def extract_coordinates(self,location):
        """
        Extracts coordinates from location data regardless of format.
        """
        if "coordinates" in location:  # GeoJSON format
            return location["coordinates"][1], location["coordinates"][0]
        elif "latitude" in location and "longitude" in location:  # Direct lat/lon format
            return location["latitude"], location["longitude"]
        else:
            raise ValueError("Invalid location format")


    def is_event_similar(self, new_incident: Dict, recent_incident: Dict) -> bool:
        """
        Check if the new incident is similar to the most recent incident under an event.
        """
        new_time = self.parse_timestamp(new_incident["timestamp"])
        recent_time = self.parse_timestamp(recent_incident["timestamp"])
        time_diff = abs(new_time - recent_time)
        
        print(f"🔍 Comparing timestamps: {new_time} vs {recent_time}")
        print(f"⏳ Time difference: {time_diff} (Max allowed: 2 hours)")

        if time_diff > timedelta(hours=2):
            print("❌ Time condition failed")
            return False
        new_coords = self.extract_coordinates(new_incident["location"])
        recent_coords = self.extract_coordinates(recent_incident["location"])
        print(f"New Incident Coords: {new_coords}, Recent Incident Coords: {recent_coords}")

        distance = self.calculate_distance(new_coords, recent_coords)

        print(f"📍 Distance: {distance} meters (Max allowed: 200m)")

        if distance > 200:
            print("❌ Distance condition failed")
            return False

        print("✅ Event matched (Time & Location)")
        return True


    def find_similar_event(self, incident_type: str, new_incident: Dict) -> Optional[str]:
        """
        Find the first matching event ID based on the incident details.
        :param incident_type: The type of incident to match
        :param new_incident: Dictionary containing incident details.
        :return: Event ID if a match is found, otherwise None.
        """
        logging.info(f"Searching for events matching incident type: {incident_type}")
        if not incident_type:
            logging.error("No incident_type provided.")
            return None

        logging.info(f"Searching for events matching incident type: {incident_type}")

        candidate_events = self.get_candidate_events(incident_type)
       

        logging.debug(f"Candidate events found: {len(candidate_events)}")
        for event in candidate_events:
            logging.debug(f"Checking event ID: {event['_id']}")
            recent_incident = self.get_most_recent_incident(event.get("incidents", []))

            if recent_incident and self.is_event_similar(new_incident, recent_incident):
                logging.info(f"Found matching event: {event['_id']}")
                print(f"Matching event found: {event['_id']}")
                print(event["_id"])
                return event["_id"]

        return None


