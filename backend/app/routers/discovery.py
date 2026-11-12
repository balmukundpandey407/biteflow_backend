from fastapi import APIRouter, Query, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional

from backend.app.database.db import get_db
from backend.app.models.food_item import FoodItem
from backend.app.models.video import Video
from backend.app.models.restaurant import Restaurant

discovery_routes = APIRouter(tags=["Discovery"])

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
    db: AsyncSession = Depends(get_db)
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

    items = []
    for video, score in rows:
        video.id = str(video.id)
        if video.food_item:
            video.food_item.id = str(video.food_item.id)
        # Attach the transient score for pagination cursor calculation
        video._transient_score = float(score)
        items.append(video)

    return {
        "items": items,
        "next_offset": offset + len(items) if has_more else None,
        "has_more": has_more,
    }