from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.base_class import Base


class ActivityFeedback(Base):
    """Admin -> creator feedback message attached to an activity.

    Created when an admin reviews a draft / pending-review submission and
    asks the creator to change something before the activity can be
    published. The creator sees these on their dashboard / activity edit
    page and can resubmit after addressing the notes.
    """
    __tablename__ = "activity_feedback"

    id = Column(Integer, primary_key=True, index=True)
    activity_id = Column(Integer, ForeignKey("activity.id", ondelete="CASCADE"), index=True, nullable=False)
    admin_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    activity = relationship("Activity", back_populates="feedback_entries")
    admin = relationship("User", foreign_keys=[admin_id])
