from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import datetime
from uuid import uuid4

from backend.app.database.db import get_db
from backend.app.models.order import Orders
from backend.app.models.user import User
from backend.app.models.restaurant import Restaurant
from backend.app.schemas.order import order_in

order_router = APIRouter()

@order_router.post("/orders")
def create_order(order: order_in, db: Session = Depends(get_db)):
    # Check if the user exists
    user = db.query(User).filter(User.id == order.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if the restaurant exists
    restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Create a new order
    new_order = Orders(
        id=str(uuid4()),
        user_id=order.user_id,
        food_item_id=order.food_item_id,
        restaurant_id=order.restaurant_id,
        quantity=order.quantity,
        total_price=order.total_price,
        delivery_note=order.delivery_note,
        status=order.status,
        order_time=datetime.datetime.now()
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    return {"message": "Order created successfully", "order": new_order}