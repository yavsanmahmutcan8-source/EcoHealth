from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db.base_class import Base
import enum


class ReportStatus(str, enum.Enum):
    PENDING = "PENDING"      # newly filed, unresolved
    WARNED = "WARNED"        # admin sent a warning, awaiting follow-up
    RESOLVED = "RESOLVED"    # admin closed the report (action taken)
    DISMISSED = "DISMISSED"  # admin judged the report invalid / no action


class ActivityReport(Base):
    """A user-filed report against an activity (dangerous route, doesn't
    exist anymore, etc.). Multiple reports against the same activity are
    expected — admins sort by report count to prioritise."""
    __tablename__ = "activity_report"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    activity_id = Column(Integer, ForeignKey("activity.id", ondelete="CASCADE"), index=True, nullable=False)
    reason = Column(String, nullable=False)          # short tag, e.g. "dangerous_route"
    details = Column(Text, nullable=True)            # free-text from user
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    resolution_note = Column(Text, nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id])
    resolver = relationship("User", foreign_keys=[resolved_by_id])
    activity = relationship("Activity", back_populates="reports")


class UserReport(Base):
    """A user-filed report against another user (toxic comments, creating
    dangerous activities, harassment, etc.). Admins act via warn/ban."""
    __tablename__ = "user_report"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    reported_user_id = Column(Integer, ForeignKey("user.id"), index=True, nullable=False)
    reason = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    resolution_note = Column(Text, nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id])
    reported_user = relationship("User", foreign_keys=[reported_user_id], back_populates="reports_received")
    resolver = relationship("User", foreign_keys=[resolved_by_id])
