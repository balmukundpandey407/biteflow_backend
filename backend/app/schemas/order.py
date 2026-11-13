from typing import Optional
from pydantic import BaseModel, Field


class order_in(BaseModel):
    food_item_id: str
    video_id: Optional[str] = None
    quantity: int = Field(ge=1, le=10)
    delivery_note: Optional[str] = None
