from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from db.base_class import Base

class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Physical/Personal specs (used for AI match engine)
    age = Column(Integer, nullable=True)
    sex = Column(String, nullable=True)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    fitness_level = Column(String, nullable=True)  # beginner | intermediate | advanced | athlete

    # Onboarding & interests
    onboarding_complete = Column(Boolean, default=False, nullable=False, server_default="false")
    favorite_categories = Column(JSON, default=list)

    # Profile customization
    display_name = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String, nullable=True)
    
    # Gamification
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    badges = Column(JSON, default=list)
    completed_activities_count = Column(Integer, default=0)
    total_distance_km = Column(Float, default=0)
    total_calories_burned = Column(Float, default=0, server_default="0")

    # Creator metrics (Phase 12)
    creator_completions_count = Column(Integer, default=0, server_default="0")

    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    
    activities = relationship("Activity", back_populates="creator")
    reviews = relationship("Review", back_populates="user")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
