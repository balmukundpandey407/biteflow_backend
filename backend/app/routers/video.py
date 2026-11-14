from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.food_item import FoodItem
from app.models.restaurant import Restaurant
from app.models.video import Video
from app.routers.auth import get_current_user
from app.schemas.video import video_in

video_routes = APIRouter()


@video_routes.post("/video")
async def upload_bite(
    video_data: video_in,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    food_item = None
    if video_data.food_item_id:
        result = await db.execute(
            select(FoodItem).where(FoodItem.id == video_data.food_item_id)
        )
        food_item = result.scalar_one_or_none()
        if food_item is None:
            raise HTTPException(status_code=404, detail="Food item not found")
        if (
            video_data.restaurant_id
            and food_item.restaurant_id != video_data.restaurant_id
        ):
            raise HTTPException(
                status_code=400,
                detail="Food item does not belong to the selected restaurant",
            )
    elif (
        video_data.restaurant_id
        and video_data.dish_name
        and video_data.price is not None
    ):
        restaurant_result = await db.execute(
            select(Restaurant).where(Restaurant.id == video_data.restaurant_id)
        )
        restaurant = restaurant_result.scalar_one_or_none()
        if restaurant is None:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        now = datetime.now()
        food_item = FoodItem(
            id=str(uuid4()),
            name=video_data.dish_name,
            description=None,
            price=video_data.price,
            image_url=video_data.thumbnail_url or video_data.video_url,
            is_veg="unknown",
            restaurant_id=restaurant.id,
            created_at=now,
            updated_at=now,
        )
        db.add(food_item)
        await db.flush()
    else:
        raise HTTPException(
            status_code=422,
            detail=(
                "Provide an existing food_item_id or restaurant_id, dish_name, and price"
            ),
        )

    restaurant_result = await db.execute(
        select(Restaurant).where(Restaurant.id == food_item.restaurant_id)
    )
    restaurant = restaurant_result.scalar_one_or_none()

    bite = Video(
        id=str(uuid4()),
        title=video_data.title or video_data.dish_name or food_item.name,
        description=video_data.description,
        video_url=video_data.video_url,
        thumbnail_url=video_data.thumbnail_url,
        feed_score=0,
        total_views=0,
        total_likes=0,
        total_comments=0,
        creator_id=current_user.id,
        food_item_id=food_item.id,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    db.add(bite)
    await db.commit()
    await db.refresh(bite)

    return {
        "id": bite.id,
        "message": "Bite created successfully",
        "status_code": 200,
        "food_item": {
            "id": food_item.id,
            "name": food_item.name,
            "price": food_item.price,
            "image_url": food_item.image_url,
            "restaurants": {
                "id": food_item.restaurant_id,
                "name": restaurant.name if restaurant else None,
                "phone": restaurant.phone if restaurant else None,
            },
        },
    }
