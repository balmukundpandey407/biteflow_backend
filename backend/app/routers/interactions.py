from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime

from backend.app.database.db import get_db
from backend.app.models.video import Video
from backend.app.models.user_interactions import UserInteractions
from backend.app.routers.auth import get_current_user

interactions_routes = APIRouter()

@interactions_routes.get("/video/{video_id}/like")
async def like_video(video_id: str ,
                     db: AsyncSession = Depends(get_db),
                     current_user=Depends(get_current_user)):
    
    # Logic to like a video
    db.query(Video).filter(Video.id == video_id).update({"total_likes": Video.total_likes + 1})
    db.commit()
    db.refresh(Video)

    # Adding data to user_interactions table
    like_interaction = UserInteractions(
        user_id=current_user.id,
        video_id=video_id,
        interaction_type="like",
        created_at=datetime.now()
    )
    db.add(like_interaction)    
    db.commit()
    db.refresh(like_interaction)

    return {"message": f"Video {video_id} liked."}

@interactions_routes.get("/video/{video_id}/comment")
async def comment_video(video_id: str, comment: str,
                        db: AsyncSession = Depends(get_db),
                        current_user=Depends(get_current_user)):
    # Logic to comment on a video
    db.query(Video).filter(Video.id == video_id).update({"total_comments": Video.total_comments + 1})
    db.commit()
    db.refresh(Video)

    # Adding data to user_interactions table
    comment_interaction = UserInteractions(
        user_id=current_user.id,
        video_id=video_id,
        interaction_type="comment",
        if_comment=comment,
        created_at=datetime.now()
    )
    db.add(comment_interaction) 
    db.commit()
    db.refresh(comment_interaction)

    return {"message": f"Comment added to video {video_id}."}

@interactions_routes.get("/video/{video_id}/share")
async def share_video(video_id: str,
                      db: AsyncSession = Depends(get_db),
                      current_user=Depends(get_current_user)):
    # Logic to update share count on a video
    db.query(Video).filter(Video.id == video_id).update({"total_shares": Video.total_shares + 1})
    db.commit()
    db.refresh(Video)

    # Adding data to user_interactions table
    share_interaction = UserInteractions(
        user_id=current_user.id,        
        video_id=video_id,
        interaction_type="share",
        created_at=datetime.now()
    )
    db.add(share_interaction)
    db.commit()
    db.refresh(share_interaction)   

    return {"message": f"Video {video_id} shared."}


@interactions_routes.get("/video/{video_id}/save")
async def save_video(video_id: str,
                     db: AsyncSession = Depends(get_db),
                     current_user=Depends(get_current_user)):
   
    # Logic to save count on the video
    db.query(Video).filter(Video.id == video_id).update({"total_saves": Video.total_saves + 1})
    db.commit()     
    db.refresh(Video)

    # Adding data to user_interactions table
    save_interaction = UserInteractions(
        user_id=current_user.id,        
        video_id=video_id,
        interaction_type="save",
        created_at=datetime.now()
    )
    db.add(save_interaction)
    db.commit() 
    db.refresh(save_interaction)

    return {"message": f"Video {video_id} saved."}