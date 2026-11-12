from pydantic import BaseModel
from typing import Optional

class video_in (BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    video_url: str
    thumbnail_url: Optional[str] = None
    restaurant_id: Optional[str] = None
    food_item_id: Optional[str] = None
    dish_name: Optional[str] = None
    price: Optional[int] = None