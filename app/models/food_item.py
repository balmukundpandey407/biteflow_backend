from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from app.database.db import Base

class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Integer, nullable=False)
    image_url = Column(String, nullable=True)
    restaurant_id = Column(String, ForeignKey("restaurants.id"), nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)