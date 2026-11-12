from pydantic import BaseModel
from typing import Optional

class food_out(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: int
    image_url: str
    is_veg: bool

class food_in(BaseModel):
    name: str
    description: Optional[str]
    price: int
    image_url: str
    is_veg: bool 

    
    class Config:
        from_attributes = True