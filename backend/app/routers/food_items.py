from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.food_item import FoodItem
from app.models.restaurant import Restaurant
from app.routers.auth import get_current_user
from app.schemas.food_item import food_in

food_items_routes = APIRouter()


def serialize_food_item(item):
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "price": item.price,
        "image_url": item.image_url,
        "is_veg": item.is_veg,
        "restaurant_id": item.restaurant_id,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


@food_items_routes.get("/items")
async def get_food_items(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FoodItem).order_by(FoodItem.name))
    return {
        "message": "List of food items",
        "status_code": 200,
        "data": [serialize_food_item(item) for item in result.scalars().all()],
    }


@food_items_routes.get("/items/{item_id}")
async def get_food_item(item_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FoodItem).where(FoodItem.id == item_id))
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Food item not found")
    return {
        "message": "Food item details",
        "status_code": 200,
        "data": serialize_food_item(item),
    }


@food_items_routes.post("/food-items", status_code=201)
@food_items_routes.post("/items", status_code=201)
async def create_food_item(
    food_item_data: food_in,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    restaurant_result = await db.execute(
        select(Restaurant).where(Restaurant.id == food_item_data.restaurant_id)
    )
    restaurant = restaurant_result.scalar_one_or_none()
    if restaurant is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    now = datetime.now()
    new_food_item = FoodItem(
        id=str(uuid4()),
        name=food_item_data.name,
        description=food_item_data.description,
        price=food_item_data.price,
        image_url=food_item_data.image_url,
        is_veg=str(food_item_data.is_veg).lower(),
        restaurant_id=restaurant.id,
        created_at=now,
        updated_at=now,
    )
    db.add(new_food_item)
    await db.commit()
    await db.refresh(new_food_item)

    return {
        "message": "Food item created successfully",
        "status_code": 201,
        "data": serialize_food_item(new_food_item),
    }
