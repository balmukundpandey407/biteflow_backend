from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database.db import Base

class UserInteractions(Base):
    __tablename__ = "user_interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    video_id = Column(String, ForeignKey("video_id"), nullable=False)
    interaction_type = Column(String, nullable=False)  # e.g., 'like', 'comment', 'view'
    created_at = Column(DateTime, nullable=False)