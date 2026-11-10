from fastapi.security import HTTPBearer
from bcrypt import checkpw, hashpw, gensalt
from dotenv import load_dotenv
import time
import jwt 
import os 

load_dotenv()

security = HTTPBearer()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM")

token_expiry_time = int(os.getenv("TOKEN_EXPIRY_TIME"))

def verify_pw(plain_pw: str , hashed_pw: str ):
    if checkpw(plain_pw.encode('utf-8') , hashed_pw.encode('utf-8')):
        return True
    return False

def hash_pw(plain_pw : str):
    return hashpw(plain_pw.encode('utf-8'), gensalt()).decode('utf-8')

def sign_jwt(user_id: str):
    payload = {
        "user_id": user_id,
        "exp": int(time.time()) + token_expiry_time
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm= JWT_ALGORITHM)
    return token

def decode_jwt(token: str):
    try:
        decode_token = jwt.decode(token,JWT_SECRET_KEY, algorithms= [JWT_ALGORITHM])
        return decode_token
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
