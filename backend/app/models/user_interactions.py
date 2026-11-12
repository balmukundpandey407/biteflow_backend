from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from backend.app.database.db import Base

class UserInteractions(Base):
    __tablename__ = "user_interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    video_id = Column(String, ForeignKey("videos.id"), nullable=False)
    interaction_type = Column(String, nullable=False)  # e.g., 'like', 'comment'
    if_comment = Column(String, nullable=True)  # Store comment text if interaction is a comment
    created_at = Column(DateTime, nullable=False)