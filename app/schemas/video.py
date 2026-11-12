from pydantic import BaseModel
from typing import Optional

class video_in (BaseModel):
    title:str
    description:Optional[str]
    video_url:str
    thumbnail_url:Optional[str]
    food_item_id:str