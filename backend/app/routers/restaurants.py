from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.food_item import FoodItem
from app.models.restaurant import Restaurant

restaurants_routes = APIRouter()


@restaurants_routes.get("/restaurants")
async def get_restaurants(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Restaurant).order_by(Restaurant.name))
    restaurants = result.scalars().all()
    return {
        "data": [
            {
                "id": restaurant.id,
                "name": restaurant.name,
                "phone": restaurant.phone,
                "latitude":restaurant.latitude,
                "longitude":restaurant.longitude,
                "website": restaurant.website,
                "swiggy_url": restaurant.swiggy_url,
                "zomato_url": restaurant.zomato_url,
            }
            for restaurant in restaurants
        ]
    }


@restaurants_routes.get("/restaurants/{restaurant_id}/menu")
async def get_restaurant_menu(
    restaurant_id: str,
    db: AsyncSession = Depends(get_db),
):
    restaurant_result = await db.execute(
        select(Restaurant.id).where(Restaurant.id == restaurant_id)
    )
    if restaurant_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    result = await db.execute(
        select(FoodItem)
        .where(FoodItem.restaurant_id == restaurant_id)
        .order_by(FoodItem.name)
    )
    foods = result.scalars().all()
    return {
        "data": [
            {
                "id": food.id,
                "name": food.name,
                "price": food.price,
                "image_url": food.image_url,
                "description": food.description,
                "is_veg": food.is_veg,
            }
            for food in foods
        ]
    }
