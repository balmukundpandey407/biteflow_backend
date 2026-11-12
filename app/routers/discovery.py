from fastapi import APIRouter, Query, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database.db import get_db
from app.models.food_item import FoodItem
from app.models.video import Video
from app.models.restaurants import Restaurant

discovery_routes = APIRouter(tags=["Discovery"])

FEED_BATCH_SIZE = 5


@discovery_routes.get(
    "/feed",
    status_code=status.HTTP_200_OK,
    summary="Get personalized discovery feed",
    description="Fetches a batch of 5 ranked videos for the discovery feed using cursor-based pagination."
)
async def get_feed(
    lat: Optional[float] = Query(None, description="User current latitude"),
    lang: Optional[float] = Query(None, description="User current longitude"),
    cursor_score: Optional[float] = Query(None, description="Cursor score from the previous batch"),
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

    # 4. Apply cursor filter for subsequent page fetches
    if cursor_score is not None:
        query = query.where(score_expr < cursor_score)

    # 5. Order by score desc, with ID as a deterministic fallback tie-breaker
    query = query.order_by(desc(score_expr), desc(Video.id)).limit(FEED_BATCH_SIZE)

    # 6. Execute asynchronously
    result = await db.execute(query)
    rows = result.all()

    items = []
    for video, score in rows:
        video.id = str(video.id)
        if video.food_item:
            video.food_item.id = str(video.food_item.id)
        # Attach the transient score for pagination cursor calculation
        video._transient_score = float(score)
        items.append(video)

    # 7. Next cursor is the calculated score of the 5th item
    next_cursor = (
        round(float(rows[-1][1]), 4)
        if len(items) == FEED_BATCH_SIZE
        else None
    )

    return {
        "items": items,
        "next_cursor": next_cursor,
    }