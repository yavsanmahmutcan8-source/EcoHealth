from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.base_class import Base
import enum

class NotificationType(str, enum.Enum):
    BADGE_EARNED = "BADGE_EARNED"
    LEVEL_UP = "LEVEL_UP"
    NEW_ACTIVITY = "NEW_ACTIVITY"
    ACTIVITY_COMPLETED = "ACTIVITY_COMPLETED"
    ACTIVITY_FEEDBACK = "ACTIVITY_FEEDBACK"
    ADMIN_WARNING = "ADMIN_WARNING"
    SYSTEM = "SYSTEM"

class Notification(Base):
    __tablename__ = "notification"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), index=True)
    type = Column(Enum(NotificationType))
    title = Column(String)
    message = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")
