from sqlalchemy import Column, Integer, String
from db.base_class import Base


class Category(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    emoji = Column(String, nullable=False, default="📍")
    color = Column(String, nullable=False, default="#4CAF50")
