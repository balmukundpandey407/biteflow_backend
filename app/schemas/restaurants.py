from pydantic import BaseModel
from typing import Optional

class restaurants_out (BaseModel):
    id : str
    name : str
    latitude : float
    longitude : float
    phone : str
    website : Optional[str]
    swiggy_url : Optional[str]
    zomato_url : Optional[str]

    class Config:
        from_attributes = True