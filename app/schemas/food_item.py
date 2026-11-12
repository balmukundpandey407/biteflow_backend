from pydantic import BaseModel
from typing import Optional

class food_out(BaseModel):
    id: str
    name: str
    description: Optional[str]
    price: int
    image_url: str

    class Config:
        from_attributes = True