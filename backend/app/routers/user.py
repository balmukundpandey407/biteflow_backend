from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.db import get_db
from app.models.food_item import FoodItem
from app.models.user_interactions import UserInteractions
from app.models.video import Video
from app.routers.auth import get_current_user

user_routes = APIRouter()


def serialize_video(video):
    food_item = video.food_item
    restaurant = food_item.restaurants if food_item else None
    return {
        "id": video.id,
        "title": video.title,
        "description": video.description,
        "video_url": video.video_url,
        "thumbnail_url": video.thumbnail_url,
        "total_views": video.total_views,
        "total_likes": video.total_likes,
        "total_comments": video.total_comments,
        "creator_id": video.creator_id,
        "food_item_id": video.food_item_id,
        "created_at": video.created_at,
        "food_item": (
            {
                "id": food_item.id,
                "name": food_item.name,
                "price": food_item.price,
                "image_url": food_item.image_url,
                "is_veg": food_item.is_veg,
                "restaurants": (
                    {
                        "id": restaurant.id,
                        "name": restaurant.name,
                        "phone": restaurant.phone,
                    }
                    if restaurant
                    else None
                ),
            }
            if food_item
            else None
        ),
    }


async def get_user_interaction_videos(
    interaction_type: str,
    current_user,
    db: AsyncSession,
):
    interaction_result = await db.execute(
        select(UserInteractions.video_id, UserInteractions.created_at)
        .where(
            UserInteractions.user_id == current_user.id,
            UserInteractions.interaction_type == interaction_type,
        )
        .order_by(desc(UserInteractions.created_at))
    )
    video_ids = []
    seen_video_ids = set()
    for video_id, _ in interaction_result.all():
        if video_id not in seen_video_ids:
            seen_video_ids.add(video_id)
            video_ids.append(video_id)
    if not video_ids:
        return []

    video_result = await db.execute(
        select(Video)
        .where(Video.id.in_(video_ids))
        .options(selectinload(Video.food_item).selectinload(FoodItem.restaurants))
    )
    videos_by_id = {video.id: video for video in video_result.scalars().all()}
    return [
        serialize_video(videos_by_id[video_id])
        for video_id in video_ids
        if video_id in videos_by_id
    ]


@user_routes.get("/user/me")
async def user_info(current_user=Depends(get_current_user)):
    return {
        "id": current_user.id,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "email": current_user.email,
    }


@user_routes.get("/user/me/videos")
async def get_my_videos(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Video)
        .where(Video.creator_id == current_user.id)
        .options(selectinload(Video.food_item).selectinload(FoodItem.restaurants))
        .order_by(desc(Video.created_at))
    )
    return {"items": [serialize_video(video) for video in result.scalars().all()]}


@user_routes.get("/user/me/liked")
async def get_liked_videos(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return {
        "items": await get_user_interaction_videos("like", current_user, db)
    }


@user_routes.get("/user/me/saved")
async def get_saved_videos(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return {
        "items": await get_user_interaction_videos("save", current_user, db)
    }