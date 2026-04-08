import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import create_async_engine
from app.models import *

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain")
engine = create_async_engine(DATABASE_URL, echo=True)

async def init_db():
    async with engine.begin() as conn:
        print("Creating tables...")
        await conn.run_sync(SQLModel.metadata.create_all)
        print("Done!")

if __name__ == "__main__":
    asyncio.run(init_db())
