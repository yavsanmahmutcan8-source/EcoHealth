from sqlalchemy import Column, String, JSON
from db.base_class import Base


class BadgeDefinition(Base):
    __tablename__ = "badge_definition"

    id = Column(String, primary_key=True)  # e.g. "weekend_warrior"
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    emoji = Column(String, nullable=False, default="🏆")
    color = Column(String, nullable=False, default="#FFB300")
    condition_type = Column(String, nullable=False)  # ACTIVITY_COUNT, TOTAL_XP, etc.
    condition_config = Column(JSON, nullable=False, default=dict)
