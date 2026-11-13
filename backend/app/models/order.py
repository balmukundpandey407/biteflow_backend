from sqlalchemy import Column, Integer, String, DateTime,Float
from app.database.db import Base

class Orders(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True)
    user_id = Column(String)
    food_item_id = Column(String)
    restaurant_id = Column(String)
    quantity = Column(Integer)
    total_price = Column(Float)
    delivery_note=Column(String)
    status=Column(String)
    order_time=Column(DateTime)