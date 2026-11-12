from sqlalchemy import Column, String, DateTime,Float
from app.database.db import Base

class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    swiggy_url = Column(String, nullable=True)
    zomato_url = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)