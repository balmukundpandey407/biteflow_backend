from fastapi import APIRouter,Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import uuid4
from datetime import datetime

from backend.app.models.user import User
from backend.app.database.db import get_db
from backend.app.schemas.user import user_register, user_login, user_out
from backend.app.authorization.security import hash_pw, verify_pw, sign_jwt, decode_jwt

auth_routes = APIRouter()   


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer)
):

    token = credentials.credentials
    decoded_token = decode_jwt(token)

    if not decoded_token:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    result = await db.execute(
        select(User).where(User.id == decoded_token["user_id"])
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return user_out(
        id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email
    )
    
@auth_routes.post("/auth/register")
async def register_user (user_data: user_register, db: AsyncSession = Depends(get_db)):
     existing_user = await db.execute(
        select(User).where((User.email == user_data.email) | (User.phone == user_data.phone))
    )
     if existing_user.scalars().first():
        return {"error": "User with this email or phone already exists.try logging in instead."}

     hashed_password = hash_pw(user_data.password)

     new_user = User(
         id = str(uuid4()),
         first_name = user_data.first_name,
         last_name = user_data.last_name,
         email = user_data.email,
         phone = user_data.phone,
         password = hashed_password,
         created_at = datetime.now(),
         updated_at = datetime.now()
     )
     db.add(new_user)
     await db.commit()
     await db.refresh(new_user)

     token = sign_jwt(str(new_user.id))
     return {"message": "User registered successfully", "token": token}


@auth_routes.post("/auth/login")
async def login_user (user_data: user_login, db: AsyncSession = Depends(get_db)):
    existing_user = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    user = existing_user.scalars().first()
    if not user:
        return {"error": "Invalid email or password."}

    if not verify_pw(user_data.password, user.password):
        return {"error": "Invalid password."}

    token = sign_jwt(str(user.id))
    return {"message": "Login successful", "token": token}

# @auth_routes.post("/auth/refresh")
# async def refresh_token ():
    
# @auth_routes.post("/auth/logout")
# async def logout_user ( user_id: str, db: AsyncSession = Depends(get_db)):
#     existing_user = await db.execute(
#         select(User).where(User.id == user_id)
#     )
#     user = existing_user.scalars().first()
#     if not user:
#         return {"error": "User not found."}

#     return {"message": "Logout successful."}