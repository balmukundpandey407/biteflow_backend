from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship

from backend.app.database.db import Base

class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Integer, nullable=False)
    image_url = Column(String, nullable=False)
    is_veg = Column(String,nullable=False)
    restaurant_id = Column(String, ForeignKey("restaurants.id"), nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)

    restaurants = relationship("Restaurant", lazy="raise")         