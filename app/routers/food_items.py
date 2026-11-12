from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import datetime
from uuid import uuid4

from app.database.db import get_db
from app.models import food_item
from app.schemas.food_item import food_out,food_in

food_items_routes = APIRouter()

@food_items_routes.get("/items")
async def get_food_items(db : AsyncSession = Depends(get_db)):
    # Logic to retrieve food items from the database
    food_list = [food_out(
        id=food_item.id,
        name=food_item.name,
        description=food_item.description,
        price=food_item.price,
        image_url=food_item.image_url,
        is_veg=food_item.is_veg
    ) for food_item in await db.execute(food_item.select())]
    return {"message": "List of food items", "status_code": 200, "data": food_list}


@food_items_routes.get("/items/{item_id}")
async def get_food_item(item_id: str, db: AsyncSession = Depends(get_db)):
    # Logic to retrieve a specific food item from the database based on item_id
    food_item_data = await db.execute(food_item.select().where(food_item.id == item_id))
    food_item_record = food_item_data.first()

    if not food_item_record:
        return {"message": "Food item not found", "status_code": 404}

    food_item_out = food_out(
        id=food_item_record.id,
        name=food_item_record.name,
        description=food_item_record.description,
        price=food_item_record.price,
        image_url=food_item_record.image_url,
        is_veg=food_item_record.is_veg
    )

    return {"message": "Food item details", "status_code": 200, "data": food_item_out}


@food_items_routes.post("/items")
async def create_food_item(food_item_data: food_in, db: AsyncSession = Depends(get_db)):
    # Logic to create a new food item in the database
    new_food_item = food_item(
        id=str(uuid4()),
        name=food_item_data.name,
        description=food_item_data.description,
        price=food_item_data.price,
        image_url=food_item_data.image_url,
        is_veg=food_item_data.is_veg,
        restaurant_id=db.restaurant_id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    db.add(new_food_item)
    await db.commit()
    await db.refresh(new_food_item)

    return {"message": "Food item created successfully", "status_code": 201, "data": food_out(
        id=new_food_item.id,
        name=new_food_item.name,
        description=new_food_item.description,
        price=new_food_item.price,
        image_url=new_food_item.image_url,
        is_veg=new_food_item.is_veg,
        restaurant_id=new_food_item.restaurant_id,
        created_at=new_food_item.created_at,
        updated_at=new_food_item.updated_at
    )}