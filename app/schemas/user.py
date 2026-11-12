from pydantic import  BaseModel,EmailStr,Field
from typing import Optional

class user_register(BaseModel):
    first_name : str = Field(..., min_length=1, max_length=50)
    last_name : Optional[str] = Field(None,min_length=1, max_length=50)
    email: EmailStr = Field(..., unique=True)
    phone : str = Field(..., pattern=r"^\d{10}$", unique=True)
    password : str = Field(..., min_length=6, max_length=100)

class user_login(BaseModel):
    email: EmailStr = Field(..., unique=True)
    password : str = Field(..., min_length=6, max_length=100)

class user_out(BaseModel):
    id : str
    first_name : str
    last_name : Optional[str]
    email: EmailStr

    class Config:
        from_attributes = True