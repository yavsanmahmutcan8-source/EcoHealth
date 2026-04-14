import math

# We define the threshold to be close to the activity center.
# 500 meters is a reasonable geofence radius for a park or trail entrance.
GEOFENCE_RADIUS_METERS = 500.0

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance in meters between two points 
    on the earth (specified in decimal degrees).
    """
    if None in [lat1, lon1, lat2, lon2]:
        return float('inf')

    # Convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371000 # Radius of earth in meters
    
    return c * r

def verify_user_presence(
    user_lat: float, 
    user_lon: float, 
    activity_lat: float, 
    activity_lon: float, 
    require_gps: bool = False
) -> dict:
    """
    Confirms if the user is actually at the activity location.
    If 'require_gps' is False, the system trusts the user completely.
    """
    if not require_gps:
        return {
            "verified": True,
            "verification_method": "trust_system",
            "distance_meters": None,
            "message": "Activity completed via Trust System."
        }

    # If GPS verification is required, calculate the distance.
    distance = haversine_distance(user_lat, user_lon, activity_lat, activity_lon)
    
    is_valid = distance <= GEOFENCE_RADIUS_METERS
    
    return {
        "verified": is_valid,
        "verification_method": "gps_geofence",
        "distance_meters": round(distance, 2) if distance != float('inf') else None,
        "message": "You are within the activity zone!" if is_valid else f"You are {round(distance, 2)} meters away. Get closer!"
    }
