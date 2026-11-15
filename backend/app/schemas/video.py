from pydantic import BaseModel, Field
from typing import Optional


class video_in(BaseModel):
    title: Optional[str] = Field(None, max_length=25)
    description: Optional[str] = Field(None, max_length=50)
    video_url: str
    thumbnail_url: Optional[str] = None
    restaurant_id: Optional[str] = None
    food_item_id: Optional[str] = None
    dish_name: Optional[str] = None
    price: Optional[int] = None
    is_veg: Optional[bool] = None


class video_update(BaseModel):
    title: Optional[str] = Field(None, max_length=25)
    description: Optional[str] = Field(None, max_length=50)
    food_item_id: Optional[str] = None
    is_veg: Optional[bool] = None