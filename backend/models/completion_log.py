from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from db.base_class import Base


class CompletionLog(Base):
    __tablename__ = "completion_log"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activity.id", ondelete="CASCADE"), nullable=False)
    category = Column(String, nullable=False)  # Snapshot of category at completion time
    completed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
