from sqlalchemy import Column, Integer, String, Float
from db.base_class import Base


class Category(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    emoji = Column(String, nullable=False, default="📍")
    color = Column(String, nullable=False, default="#4CAF50")
    # MET value (Metabolic Equivalent of Task) — admin-tunable scientific multiplier for calorie burn
    calorie_met = Column(Float, nullable=False, default=4.0, server_default="4.0")
