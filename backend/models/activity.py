from sqlalchemy import Column, Integer, String, Float, Text, Boolean, ForeignKey
from db.base_class import Base

class Activity(Base):
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, index=True) # e.g. "Hiking", "Running", "Cycling"
    
    # Geolocation bounds (simple latitude/longitude center for geofencing)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    # Advanced Map Data
    route_polyline = Column(Text, nullable=True) # Encoded polyline string
    map_boundaries = Column(String, nullable=True) # Bounding box or viewpoint info
    
    # Activity characteristics
    difficulty = Column(Integer, default=1) # 1 to 5 scale
    estimated_duration_minutes = Column(Integer, default=60)
    xp_reward = Column(Integer, default=50)

    is_verified_route = Column(Boolean, default=False)
