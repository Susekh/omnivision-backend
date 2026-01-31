import json
from fuzzywuzzy import process
import re
from typing import List, Optional, Union
from datetime import datetime

class IncidentPrioritizer:
    """
    Handles prioritization of detected objects based on a priority configuration.
    Now loads default terms directly from priority.json.
    """
    
    def __init__(self, priority_config_path: str = 'priority.json'):
        """
        Initialize with path to priority configuration file.
        Default terms are now loaded directly from the config file.
        """
        self.priority_config = self._load_priority_config(priority_config_path)
        self.known_terms = list(self.priority_config.keys())  # Get terms directly from config
    
    def _load_priority_config(self, config_path: str) -> dict:
        """
        Load priority configuration from JSON file.
        Returns empty dict if file not found or invalid.
        """
        try:
            with open(config_path) as f:
                config = json.load(f)
                # Validate the config has the expected structure
                if not all(isinstance(v, int) for v in config.values()):
                    print("Warning: Invalid priority values in config. Using empty priorities.")
                    return {}
                return config
        except FileNotFoundError:
            print(f"Warning: Priority config file {config_path} not found. Using empty priorities.")
            return {}
        except json.JSONDecodeError:
            print(f"Warning: Invalid JSON in {config_path}. Using empty priorities.")
            return {}
    
    def preprocess_detected_objects(self, input_str: str, threshold: int = 80) -> List[str]:
        """
        Clean and normalize detected objects string using terms from priority config.
        """
        normalized = re.sub(r'\s+', ' ', input_str.strip().lower())
        if not normalized:
            return []
        
        potential_terms = re.findall(r'\b\w+(?:\s+\w+)*\b', normalized)  # Updated regex to handle multiple words
        
        cleaned = []
        for term in potential_terms:
            if not term.strip():
                continue
            
            match, score = process.extractOne(
                term,
                self.known_terms,
                processor=lambda x: x
            )
            
            if score >= threshold:
                cleaned.append(match)
            else:
                print(f"[WARNING] No good match found for term '{term}' (best match: '{match}' with score {score})")
        
        # Remove consecutive duplicates while preserving order
        return [term for i, term in enumerate(cleaned) if i == 0 or term != cleaned[i-1]]
    
    def get_highest_priority_object(self, detected_objects: List[str]) -> Optional[str]:
        """
        Returns the highest priority object from the list based on config.
        """
        if not detected_objects:
            return None
        
        # Get objects that exist in our priority config
        prioritized_objects = [obj for obj in detected_objects if obj in self.priority_config]
        
        if not prioritized_objects:
            return None
        
        # Return object with highest priority (lowest number)
        return min(prioritized_objects, key=lambda x: self.priority_config[x])
    
    def process_detected_objects(self, input_str: str) -> Optional[str]:
        """
        Complete processing pipeline: preprocessing + prioritization.
        """
        cleaned_objects = self.preprocess_detected_objects(input_str)
        return self.get_highest_priority_object(cleaned_objects)


class IncidentClassifier:
    """
    Classifies incidents based on prioritized objects and timestamp.
    """

    def __init__(self, prioritizer: IncidentPrioritizer = None):
        # Incident classification rules now match priority.json terms exactly
        self.incident_rules = {
    "car accident": "Human healthcare services",
    "bus crash": "Human healthcare services",          
    "fallen_tree": "Obstruction on Roads",
    "animal debris": "Environmental Violation",          
    "pothole": "Road Damage",
    "street light": "Daytime Running Street Light",
    "litter": "Environmental Violation"
}

        self.prioritizer = prioritizer or IncidentPrioritizer()
        print("[INIT] IncidentClassifier initialized with rules matching priority.json")

    def is_daytime(self, timestamp):
        """Check if timestamp falls within daytime hours (6 AM - 6 PM)."""
    # Handle both dict format and direct timestamp
        if isinstance(timestamp, dict) and "$date" in timestamp:
            dt_str = timestamp["$date"].replace("Z", "+00:00")
            dt_obj = datetime.fromisoformat(dt_str)
        elif isinstance(timestamp, (int, float)):
            dt_obj = datetime.fromtimestamp(timestamp)
        else:
            dt_obj = timestamp  # assuming it's already a datetime object

        is_day = 6 <= dt_obj.hour < 18
        print(f"[TIME] {dt_obj.time()} -> {'Daytime' if is_day else 'Nighttime'}")
        return is_day

    def classify_incident(self, detected_object: str, timestamp: Union[int, float, dict]) -> Optional[str]:
        """Classify a single incident based on object and time."""
        print(f"[CLASSIFY] Object: '{detected_object}'")
        
        # Convert timestamp if it's in dictionary format
        if isinstance(timestamp, dict) and "$date" in timestamp:
            timestamp = int(datetime.fromisoformat(timestamp["$date"].replace("Z", "+00:00")).timestamp())
        
        # Check if object is recognized
        if detected_object not in self.incident_rules:
            print(f"[WARNING] Unrecognized object: '{detected_object}'")
            return "Unknown"
        
        # Special time-dependent handling for street lights
        if detected_object == "street light":
            if self.is_daytime(timestamp):
                print("[ALERT] Street light on during daytime")
                return self.incident_rules[detected_object]
            print("[INFO] Street light on at night - normal operation")
            return None
        
        # All other objects are always incidents
        print(f"[ALERT] {detected_object} detected")
        return self.incident_rules[detected_object]

    def process_incidents(self, detected_objects: Union[str, List[str]], timestamp: Union[int, float, dict]) -> Optional[str]:
        """
        Complete incident processing pipeline:
        1. Prioritize detected objects
        2. Classify the highest priority incident
        """
        # Get highest priority object
        if isinstance(detected_objects, str):
            priority_obj = self.prioritizer.process_detected_objects(detected_objects)
        else:
            priority_obj = self.prioritizer.get_highest_priority_object(detected_objects)
        
        if not priority_obj:
            print("[INFO] No priority object found in input")
            return None
        
        # Classify the incident
        return self.classify_incident(priority_obj, timestamp)


if __name__ == "__main__":
    # Initialize with the priority.json path
    prioritizer = IncidentPrioritizer('priority.json')
    classifier = IncidentClassifier(prioritizer)
    
    # Test timestamps
    noon = datetime(2023, 1, 1, 12, 0).timestamp()  # Daytime
    midnight = datetime(2023, 1, 1, 23, 0).timestamp()  # Nighttime
    
    # Test cases
    test_cases = [
        (["street light", "car accident"], noon),
        ("pothole litter", noon),
        ("potholes potholes", noon),
        ("fallen_tree, street light", midnight),
        (["unknown object"], noon),
        (["car accident", "car accident"], noon),
        ("", noon),  # Empty input
        ("car accident, street light", {"$date": "2023-01-01T05:00:00Z"})  # Dictionary timestamp
    ]
    
    print("\n=== Running Tests ===\n")
    for objects, ts in test_cases:
        print(f"\nInput: {objects}")
        result = classifier.process_incidents(objects, ts)
        print(f"Result: {result}")
        print("-" * 40)