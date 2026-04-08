import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain")
engine = create_async_engine(DATABASE_URL, echo=True)

async def alter_db():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE cropharvest ADD COLUMN status VARCHAR DEFAULT 'Available' NOT NULL"))
            print("Successfully added status column.")
        except Exception as e:
            print(f"Error adding column (maybe it already exists?): {e}")

if __name__ == "__main__":
    asyncio.run(alter_db())
