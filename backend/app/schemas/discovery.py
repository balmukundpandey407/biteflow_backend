from pydantic import BaseModel
from typing import Optional

from backend.app.schemas.food_item import food_out

class feed_data_out(BaseModel):
    id : str
    title: str
    description: Optional[str]
    video_url:str
    thumbnail_url: Optional[str]
    total_views: int
    total_likes: int
    total_comments: int
    food_item: food_out

    class Config:
        from_attributes = True