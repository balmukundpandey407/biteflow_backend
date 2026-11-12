from fastapi import APIRouter

user_routes = APIRouter()

@user_routes.get("/user/me")
def user_info():
    return {"message":"user data"}