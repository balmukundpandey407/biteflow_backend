from fastapi import APIRouter, Query, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database.db import get_db
from app.models.food_item import FoodItem
from app.models.video import Video
from app.models.restaurant import Restaurant
from app.models.user_interactions import UserInteractions
from app.authorization.security import decode_jwt

discovery_routes = APIRouter(tags=["Discovery"])
optional_bearer = HTTPBearer(auto_error=False)

@discovery_routes.get(
    "/feed",
    status_code=status.HTTP_200_OK,
    summary="Get personalized discovery feed",
    description="Fetches ranked videos for the discovery feed using offset pagination."
)
async def get_feed(
    lat: Optional[float] = Query(None, description="User current latitude"),
    lang: Optional[float] = Query(None, description="User current longitude"),
    cursor_score: Optional[float] = Query(None, description="Cursor score from the previous batch"),
    limit: int = Query(5, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer),
):
    # 1. Time decay calculation: hours since video creation
    hours_old = func.extract("epoch", func.now() - Video.created_at) / 3600.0

    # 2. Ranking formula: (Likes * 3 + Views * 1 + Comments * 2) / (Hours_Old + 2)^1.2
    score_expr = (
        (
            func.coalesce(Video.total_likes, 0) * 3.0
            + func.coalesce(Video.total_views, 0) * 1.0
            + func.coalesce(Video.total_comments, 0) * 2.0
        )
        / func.power(hours_old + 2.0, 1.2)
    )
    feed_score = score_expr.label("score")

    # 3. Base query with optimized joins
    query = select(Video, feed_score).options(
        selectinload(Video.food_item).selectinload(FoodItem.restaurants)
    )

    if lat is not None and lang is not None:
        query = (
            query.join(Video.food_item)
            .join(FoodItem.restaurants)
            .filter(Restaurant.latitude == lat, Restaurant.longitude == lang)
        )

    # Keep accepting the legacy score cursor for existing clients.
    if cursor_score is not None:
        query = query.where(score_expr < cursor_score)

    query = query.order_by(desc(score_expr), desc(Video.id))
    if cursor_score is None:
        query = query.offset(offset)
    query = query.limit(limit + 1)

    result = await db.execute(query)
    rows = result.all()
    has_more = len(rows) > limit
    rows = rows[:limit]

    user_id = None
    if credentials:
        decoded_token = decode_jwt(credentials.credentials)
        if decoded_token:
            user_id = decoded_token.get("user_id")

    interaction_states = set()
    if user_id and rows:
        interaction_result = await db.execute(
            select(UserInteractions.video_id, UserInteractions.interaction_type).where(
                UserInteractions.user_id == user_id,
                UserInteractions.video_id.in_([video.id for video, _ in rows]),
                UserInteractions.interaction_type.in_(("like", "save")),
            )
        )
        interaction_states = set(interaction_result.all())

    items = []
    for video, score in rows:
        food_item = video.food_item
        restaurant = food_item.restaurants if food_item else None
        items.append(
            {
                "id": str(video.id),
                "title": video.title,
                "description": video.description,
                "video_url": video.video_url,
                "thumbnail_url": video.thumbnail_url,
                "feed_score": float(score),
                "total_views": video.total_views,
                "total_likes": video.total_likes,
                "total_comments": video.total_comments,
                "creator_id": video.creator_id,
                "food_item_id": str(video.food_item_id),
                "created_at": video.created_at,
                "is_liked": (video.id, "like") in interaction_states,
                "is_saved": (video.id, "save") in interaction_states,
                "food_item": (
                    {
                        "id": str(food_item.id),
                        "name": food_item.name,
                        "price": food_item.price,
                        "image_url": food_item.image_url,
                        "is_veg": food_item.is_veg,
                        "restaurants": (
                            {
                                "id": str(restaurant.id),
                                "name": restaurant.name,
                                "phone": restaurant.phone,
                                "latitude": restaurant.latitude,
                                "longitude": restaurant.longitude,
                            }
                            if restaurant
                            else None
                        ),
                    }
                    if food_item
                    else None
                ),
            }
        )

    return {
        "items": items,
        "next_offset": offset + len(items) if has_more else None,
        "has_more": has_more,
    }