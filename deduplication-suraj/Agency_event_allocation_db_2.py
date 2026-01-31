from pymongo import MongoClient, GEO2D, GEOSPHERE
from geopy.distance import geodesic
from shapely.geometry import Point, Polygon
import json
import logging
import config

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class MongoDBClient:
    """Handles MongoDB connections and data retrieval."""
    def __init__(self, uri=config.MONGO_URI, db_name=config.MONGO_DB):
        self.client = MongoClient(uri)
        self.db = self.client[db_name]
        logging.info("Connected to MongoDB.")
    
    def get_collection(self, collection_name):
        return self.db[collection_name]

class ConfigLoader:
    """Handles loading and providing configuration data."""
    def __init__(self, config_path="critical.json"):
        self.config = self._load_config(config_path)
    
    def _load_config(self, config_path):
        try:
            with open(config_path, "r") as file:
                return json.load(file)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logging.error(f"Error loading config file: {e}")
            return {}
    
    def is_critical(self, detected_object):
        return self.config.get(detected_object, False)
    

class AgencyFinder:
    """Handles finding the nearest agencies for an event."""
    def __init__(self, db_client):
        self.db_client = db_client
    
    def find_nearest_agencies(self, event, top_n=3):
        """Finds the nearest agencies for critical events, checking if they handle the detected object."""
        agencies_collection = self.db_client.get_collection("agencies")
        event_location = (event['latitude'], event['longitude'])
        print(f"[DEBUG] Types -> latitude: {type(event.get('latitude'))}, longitude: {type(event.get('longitude'))}")
        event_type = event["detected_object"].lower()
        
        agencies = agencies_collection.find({
            "eventResponsibleFor": {
                "$regex": f"^{event_type}$",
                "$options": "i"
            }
        })

        agencies_list = list(agencies)
        if not agencies_list:
            logging.warning(f"No agencies found for event type: {event['detected_object']}")
            return []

        sorted_agencies = sorted(
            [
                (agency["AgencyId"], geodesic(event_location, (agency["location"].get("latitude"), agency["location"].get("longitude"))).kilometers) 
                for agency in agencies_list if "location" in agency and "latitude" in agency["location"] and "longitude" in agency["location"]
            ],
            key=lambda x: x[1]
        )

        for agency_id, distance in sorted_agencies:
            logging.info(f"Agency: {agency_id}, Distance: {distance} km")

        return [agency[0] for agency in sorted_agencies[:top_n]]


class JurisdictionFinder:
    """Handles finding the jurisdiction for non-critical events."""
    
    def __init__(self, db_client):
        self.db_client = db_client
    
    def get_agencies_with_jurisdictions(self):
        """Fetches agencies with defined jurisdictions from the database."""
        agencies_collection = self.db_client.get_collection("agencies")
        return agencies_collection.find({"jurisdiction": {"$exists": True}})
    
    def get_event_location(self, event):
        """Extracts the event location as a tuple of (latitude, longitude)."""
        return (event['latitude'], event['longitude'])
    
    def get_event_type(self, event):
        """Extracts the event type (detected object) from the event data."""
        return event.get("detected_object")
    
    def create_polygon(self, coordinates):
        """Creates a Shapely Polygon from the list of coordinates."""
        return Polygon(coordinates)
    
    def is_point_inside_polygon(self, point, polygon):
        """Checks if a point is inside a given polygon using Shapely."""
        return polygon.contains(point)
    
    def is_nearby(self, event_location, coordinates, threshold=0.05):
        """Checks if event location is within a threshold distance from any jurisdiction point."""
        for coord in coordinates:
            distance = geodesic(event_location, coord).km
            if distance < threshold:
                return True
        return False
    
    def is_event_in_jurisdiction(self, event_location, coordinates):
        """Checks if the event is inside the jurisdiction or nearby its boundary."""
        polygon = self.create_polygon(coordinates)
        point = Point(event_location)
        
        # Check if point is inside the polygon
        if self.is_point_inside_polygon(point, polygon):
            return True
        
        # Check if point is nearby any of the jurisdiction points
        return self.is_nearby(event_location, coordinates)
    
    def is_responsible_for_event(self, event_type, responsibilities):
        """Checks if the agency is responsible for the event type."""
        return event_type in responsibilities
    
    def find_jurisdiction(self, event):
        """Finds the jurisdiction for non-critical events using point matching and event responsibility."""
        event_location = self.get_event_location(event)
        event_type = self.get_event_type(event)
        
        agencies = self.get_agencies_with_jurisdictions()
        
        for agency in agencies:
            jurisdiction = agency.get("jurisdiction", {})
            coordinates = jurisdiction.get("coordinates", [])
            responsibilities = agency.get("eventResponsibleFor", [])
            
            # Check if the event is within jurisdiction and the agency is responsible for it
            if self.is_event_in_jurisdiction(event_location, coordinates) and self.is_responsible_for_event(event_type, responsibilities):
                logging.info(f"Event is within jurisdiction of agency: {agency['AgencyId']} and they are responsible for it.")
                return agency["AgencyId"]
            else:
                logging.info(f"Agency: {agency['AgencyId']} does not match jurisdiction or responsibility.")
        
        logging.warning("No matching jurisdiction found for this event.")
        return None



class EventProcessor:
    """Handles event classification and agency allocation."""
    def __init__(self, config_loader, agency_finder, jurisdiction_finder):
        self.config_loader = config_loader
        self.agency_finder = agency_finder
        self.jurisdiction_finder = jurisdiction_finder
    
    def process_event(self, event):
        detected_object = event.get("detected_object", "Unknown")
        print( detected_object)
        if self.config_loader.is_critical(detected_object):
        # Handle critical events
            nearest_agencies = self.agency_finder.find_nearest_agencies(event)
            logging.info(f"Critical event detected: {detected_object}. Nearest agencies: {nearest_agencies}")
            return {"type": "critical", "agencies": nearest_agencies}
        else:
        # Handle non-critical events
            jurisdiction_id = self.jurisdiction_finder.find_jurisdiction(event)
        
            if jurisdiction_id is None:  # If jurisdiction is not found
                logging.info(f"Non-critical event detected: {detected_object}. Jurisdiction: Unassigned")
                return {"type": "non-critical", "agencies": "Unassigned"}
            else:
                logging.info(f"Non-critical event detected: {detected_object}. Jurisdiction: {jurisdiction_id}")
                return {"type": "non-critical", "agencies": [jurisdiction_id]}
                #return None
        
if __name__ == "__main__":
    db_client = MongoDBClient("mongodb://localhost:27017")
    config_loader = ConfigLoader(config_path="Incident_criticalness.json")
    agency_finder = AgencyFinder(db_client)
    jurisdiction_finder = JurisdictionFinder(db_client)
    processor = EventProcessor(config_loader, agency_finder, jurisdiction_finder)
    
    test_event = {
        
        "detected_object": "Road Damage",
        "latitude": 20.277362107423684,
        "longitude": 85.8347462886401
    }

    result = processor.process_event(test_event)
    print(result)