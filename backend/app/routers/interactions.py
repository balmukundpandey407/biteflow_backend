from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.user_interactions import UserInteractions
from app.models.video import Video
from app.routers.auth import get_current_user

interactions_routes = APIRouter()


async def record_interaction(
    video_id: str,
    interaction_type: str,
    current_user,
    db: AsyncSession,
    comment: str | None = None,
):
    video_result = await db.execute(select(Video).where(Video.id == video_id))
    video = video_result.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=404, detail="Bite not found")

    if interaction_type in {"like", "save"}:
        existing_result = await db.execute(
            select(UserInteractions.id).where(
                UserInteractions.user_id == current_user.id,
                UserInteractions.video_id == video_id,
                UserInteractions.interaction_type == interaction_type,
            )
        )
        if existing_result.scalars().first() is not None:
            return {"message": f"Bite {video_id} already {interaction_type}d."}

    if interaction_type == "like":
        await db.execute(
            update(Video)
            .where(Video.id == video_id)
            .values(total_likes=Video.total_likes + 1)
        )
    elif interaction_type == "comment":
        await db.execute(
            update(Video)
            .where(Video.id == video_id)
            .values(total_comments=Video.total_comments + 1)
        )

    db.add(
        UserInteractions(
            user_id=current_user.id,
            video_id=video_id,
            interaction_type=interaction_type,
            if_comment=comment,
            created_at=datetime.now(),
        )
    )
    await db.commit()
    return {"message": f"{interaction_type.capitalize()} recorded for Bite {video_id}."}


@interactions_routes.get("/video/{video_id}/like")
async def like_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await record_interaction(video_id, "like", current_user, db)


@interactions_routes.get("/video/{video_id}/comment")
async def comment_video(
    video_id: str,
    comment: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await record_interaction(
        video_id, "comment", current_user, db, comment=comment
    )


@interactions_routes.get("/video/{video_id}/share")
async def share_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await record_interaction(video_id, "share", current_user, db)


@interactions_routes.get("/video/{video_id}/save")
async def save_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await record_interaction(video_id, "save", current_user, db)
