from fastapi import APIRouter, Depends
from uuid import uuid4
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.schemas.video import video_in
from app.models.video import Video
from app.routers.auth import get_current_user

video_routes = APIRouter()

#here bite refer to video
@video_routes.post("/video")
async def upload_bite(
    video_data: video_in,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    bite = Video(
        id=str(uuid4()),
        title=video_data.title,
        description=video_data.description,
        video_url=video_data.video_url,
        thumbnail_url=video_data.thumbnail_url,
        feed_score=0,
        total_views=0,
        total_likes=0,
        total_comments=0,
        creator_id=current_user.id,
        food_item_id=video_data.food_item_id,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    db.add(bite)
    await db.commit()
    await db.refresh(bite)

    return {"message": "Bite created successfully", "status_code": 200}