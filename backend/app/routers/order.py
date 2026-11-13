from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.food_item import FoodItem
from app.models.order import Orders
from app.models.restaurant import Restaurant
from app.models.video import Video
from app.routers.auth import get_current_user
from app.schemas.order import order_in

order_router = APIRouter()


@order_router.get("/orders")
async def get_orders(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Orders, FoodItem, Restaurant)
        .join(FoodItem, Orders.food_item_id == FoodItem.id)
        .join(Restaurant, Orders.restaurant_id == Restaurant.id)
        .where(Orders.user_id == current_user.id)
        .order_by(desc(Orders.order_time))
    )
    items = []
    for order, food_item, restaurant in result.all():
        items.append(
            {
                "id": order.id,
                "food_item_id": order.food_item_id,
                "restaurant_id": order.restaurant_id,
                "quantity": order.quantity,
                "total_price": order.total_price,
                "delivery_note": order.delivery_note,
                "status": order.status,
                "order_time": order.order_time,
                "food_item": {
                    "id": food_item.id,
                    "name": food_item.name,
                    "price": food_item.price,
                    "image_url": food_item.image_url,
                    "restaurants": {
                        "id": restaurant.id,
                        "name": restaurant.name,
                    },
                },
                "restaurant": {
                    "id": restaurant.id,
                    "name": restaurant.name,
                },
            }
        )
    return {"items": items}


@order_router.post("/orders")
async def create_order(
    order: order_in,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    food_result = await db.execute(
        select(FoodItem).where(FoodItem.id == order.food_item_id)
    )
    food_item = food_result.scalar_one_or_none()
    if food_item is None:
        raise HTTPException(status_code=404, detail="Food item not found")

    if order.video_id:
        video_result = await db.execute(select(Video).where(Video.id == order.video_id))
        video = video_result.scalar_one_or_none()
        if video is None:
            raise HTTPException(status_code=404, detail="Video not found")
        if video.food_item_id != food_item.id:
            raise HTTPException(
                status_code=400,
                detail="The video does not feature the selected food item",
            )

    order_time = datetime.now()
    new_order = Orders(
        id=str(uuid4()),
        user_id=current_user.id,
        food_item_id=food_item.id,
        restaurant_id=food_item.restaurant_id,
        quantity=order.quantity,
        total_price=food_item.price * order.quantity,
        delivery_note=order.delivery_note,
        status="pending",
        order_time=order_time,
    )
    db.add(new_order)
    await db.commit()
    await db.refresh(new_order)

    return {
        "message": "Order created successfully",
        "order": {
            "id": new_order.id,
            "user_id": new_order.user_id,
            "food_item_id": new_order.food_item_id,
            "restaurant_id": new_order.restaurant_id,
            "quantity": new_order.quantity,
            "total_price": new_order.total_price,
            "delivery_note": new_order.delivery_note,
            "status": new_order.status,
            "order_time": new_order.order_time,
        },
    }
