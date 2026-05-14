from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db.base_class import Base


class Review(Base):
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    activity_id = Column(Integer, ForeignKey("activity.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)  # 1 to 5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Soft-hide: admin moderates a comment, the author still sees it (with a
    # "removed by admin" flag); everyone else sees it filtered out.
    is_hidden = Column(Boolean, default=False, nullable=False)
    hidden_at = Column(DateTime(timezone=True), nullable=True)
    hidden_by_admin_id = Column(Integer, ForeignKey("user.id"), nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="reviews")
    activity = relationship("Activity")

    __table_args__ = (
        UniqueConstraint("user_id", "activity_id", name="uq_user_activity_review"),
    )
