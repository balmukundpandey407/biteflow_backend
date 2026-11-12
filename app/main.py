from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import auth_routes
from app.routers.discovery import discovery_routes
from app.routers.food_items import food_items_routes
from app.routers.interactions import interactions_routes
from app.routers.restaurants import restaurants_routes
from app.routers.user import user_routes
from app.routers.video import video_routes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/home")
async def home ():
  return {"message":"Backend Running"}
  
app.include_router(auth_routes,tags=["Authentication"] )
app.include_router(discovery_routes,tags=["Discovery"] )
app.include_router(food_items_routes,tags=["user data"] )
app.include_router(interactions_routes,tags=["user data"] )
app.include_router(restaurants_routes,tags=["user data"] )
app.include_router(user_routes,tags=["User data"] )
app.include_router(video_routes,tags=["Video"] )
