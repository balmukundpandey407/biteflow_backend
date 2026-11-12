from pydantic import BaseModel
from typing import Optional

class order_out(BaseModel):
    id: str
    user_id: str
    food_item_id: str
    restaurant_id: str
    quantity: int
    total_price: int
    delivery_note: Optional[str]
    status: str
    order_time: Optional[str]

class order_in(BaseModel):
    user_id: str
    food_item_id: str
    restaurant_id: str
    quantity: int
    total_price: int
    delivery_note: Optional[str]
    status: str

    class Config:
        from_attributes = True