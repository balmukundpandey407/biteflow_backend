from sqlalchemy import Column,String,DateTime
from app.database.db import Base
from sqlalchemy.orm import relationship

class User(Base):
    
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    phone = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
