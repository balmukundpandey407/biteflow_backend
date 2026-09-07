from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing in environment variable" )

engine = create_async_engine(DATABASE_URL)

Base = declarative_base()

SessionLocal = async_sessionmaker(
    autoflush= False,
    bind= engine,
    expire_on_commit=False
)

async def get_db():
    async with SessionLocal() as db:
        yield db