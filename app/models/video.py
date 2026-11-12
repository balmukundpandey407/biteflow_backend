from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database.db import Base
from app.models.food_item import FoodItem
from app.models.restaurant import Restaurant
from app.models.user import User

class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    video_url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    feed_score = Column(Float, nullable=False)
    total_views = Column(Integer, nullable=False)
    total_likes = Column(Integer, nullable=False)
    total_comments = Column(Integer, nullable=False)
    creator_id = Column(String, ForeignKey("users.id"), nullable=False)
    food_item_id = Column(String, ForeignKey("food_items.id"), nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)       
    
    food_item = relationship("FoodItem", lazy="raise")

    creator = relationship("User", lazy="raise")