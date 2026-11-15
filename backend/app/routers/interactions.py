from datetime import datetime

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.db import get_db
from app.models.user_interactions import UserInteractions
from app.models.user import User
from app.models.video import Video
from app.routers.auth import get_current_user

interactions_routes = APIRouter()


class CommentCreate(BaseModel):
    comment_text: str = Field(min_length=1, max_length=1000)


def serialize_comment(interaction, user):
    user_name = " ".join(
        name for name in (user.first_name, user.last_name) if name
    )
    return {
        "id": interaction.id,
        "user_name": user_name,
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
        },
        "comment_text": interaction.if_comment,
        "content": interaction.if_comment,
        "created_at": interaction.created_at,
    }


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


async def remove_interaction(video_id, interaction_type, current_user, db):
    video_result = await db.execute(select(Video).where(Video.id == video_id))
    video = video_result.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=404, detail="Bite not found")

    result = await db.execute(
        delete(UserInteractions).where(
            UserInteractions.user_id == current_user.id,
            UserInteractions.video_id == video_id,
            UserInteractions.interaction_type == interaction_type,
        )
    )
    deleted_count = result.rowcount or 0
    if interaction_type == "like" and deleted_count:
        await db.execute(
            update(Video)
            .where(Video.id == video_id)
            .values(total_likes=case(
                (
                    Video.total_likes >= deleted_count,
                    Video.total_likes - deleted_count,
                ),
                else_=0,
            ))
        )
    await db.commit()
    return {"message": f"{interaction_type.capitalize()} removed from Bite {video_id}."}


@interactions_routes.get("/video/{video_id}/like")
async def like_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await record_interaction(video_id, "like", current_user, db)


@interactions_routes.delete("/videos/{video_id}/like")
async def unlike_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await remove_interaction(video_id, "like", current_user, db)


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


@interactions_routes.get("/videos/{video_id}/comments")
async def get_video_comments(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    video_result = await db.execute(select(Video.id).where(Video.id == video_id))
    if video_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Bite not found")

    result = await db.execute(
        select(UserInteractions, User)
        .join(User, User.id == UserInteractions.user_id)
        .where(
            UserInteractions.video_id == video_id,
            UserInteractions.interaction_type == "comment",
        )
        .order_by(UserInteractions.created_at.desc(), UserInteractions.id.desc())
    )
    return {
        "items": [
            serialize_comment(interaction, user)
            for interaction, user in result.all()
        ]
    }


@interactions_routes.post("/videos/{video_id}/comments")
async def create_video_comment(
    video_id: str,
    comment_data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    comment = comment_data.comment_text.strip()
    if not comment:
        raise HTTPException(status_code=422, detail="Comment cannot be empty")
    await record_interaction(video_id, "comment", current_user, db, comment=comment)
    interaction_result = await db.execute(
        select(UserInteractions)
        .where(
            UserInteractions.user_id == current_user.id,
            UserInteractions.video_id == video_id,
            UserInteractions.interaction_type == "comment",
            UserInteractions.if_comment == comment,
        )
        .order_by(UserInteractions.created_at.desc(), UserInteractions.id.desc())
        .limit(1)
    )
    interaction = interaction_result.scalar_one()
    user_result = await db.execute(select(User).where(User.id == current_user.id))
    user = user_result.scalar_one()
    return {"comment": serialize_comment(interaction, user)}


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


@interactions_routes.delete("/videos/{video_id}/save")
async def unsave_video(
    video_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await remove_interaction(video_id, "save", current_user, db)
