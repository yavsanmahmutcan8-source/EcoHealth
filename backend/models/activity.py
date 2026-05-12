from sqlalchemy import Column, Integer, String, Float, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geography
from db.base_class import Base

class Activity(Base):
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, index=True) # e.g. "Hiking", "Running", "Cycling"
    
    # Geolocation bounds (advanced spatial support)
    location = Column(Geography('POINT', srid=4326), nullable=True)
    
    creator_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    creator = relationship("User", back_populates="activities")

    # Reports and admin feedback (Phase 15)
    reports = relationship("ActivityReport", back_populates="activity", cascade="all, delete-orphan")
    feedback_entries = relationship("ActivityFeedback", back_populates="activity", cascade="all, delete-orphan", order_by="ActivityFeedback.created_at.desc()")
    
    # Advanced Map Data
    route_polyline = Column(Text, nullable=True) # Encoded polyline string
    map_boundaries = Column(String, nullable=True) # Bounding box or viewpoint info
    
    # Activity characteristics
    difficulty = Column(Integer, default=1) # 1 to 5 scale
    estimated_duration_minutes = Column(Integer, default=60)
    distance_km = Column(Float, nullable=True, default=0, server_default="0")
    # Loop routes (e.g. running 3 laps around a track) — distance multiplied by lap_count
    is_loop = Column(Boolean, nullable=False, default=False, server_default="false")
    lap_count = Column(Integer, nullable=False, default=1, server_default="1")
    xp_reward = Column(Integer, default=50)

    is_verified_route = Column(Boolean, default=False)
    visibility_state = Column(String, default="publish") # "draft", "publish"

    # Review pipeline state. NULL for legacy/admin-published items.
    # "pending_review"      → user submitted for review (still in draft visibility)
    # "changes_requested"   → admin sent feedback, awaiting creator edit
    submission_status = Column(String, nullable=True)

    @property
    def latitude(self):
        from geoalchemy2.shape import to_shape
        if self.location is not None:
            return to_shape(self.location).y
        return None

    @property
    def longitude(self):
        from geoalchemy2.shape import to_shape
        if self.location is not None:
            return to_shape(self.location).x
        return None

    @property
    def creator_username(self):
        return self.creator.username if self.creator else None

    @property
    def creator_avatar_url(self):
        return self.creator.avatar_url if self.creator else None

    @property
    def creator_is_admin(self):
        return bool(self.creator.is_admin) if self.creator else None
