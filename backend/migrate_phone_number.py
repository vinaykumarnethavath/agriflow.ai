"""
Migration: Add phone_number column to user table and create phoneotp table.
Run this script once: python migrate_phone_number.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./agrichain.db")

async def migrate():
    engine = create_async_engine(DATABASE_URL, echo=True)

    # Step 1: Add phone_number column to "user" table
    try:
        async with engine.begin() as conn:
            await conn.execute(text('ALTER TABLE "user" ADD COLUMN phone_number VARCHAR'))
        print("OK: Added phone_number column to user table")
    except Exception as e:
        print(f"SKIP: phone_number column may already exist: {e}")

    # Step 2: Create phoneotp table
    try:
        async with engine.begin() as conn:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS phoneotp (
                    id SERIAL PRIMARY KEY,
                    phone_number VARCHAR NOT NULL,
                    otp_code VARCHAR NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    is_verified BOOLEAN NOT NULL DEFAULT FALSE
                )
            """))
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_phoneotp_phone_number ON phoneotp (phone_number)
            """))
        print("OK: Created phoneotp table")
    except Exception as e:
        print(f"SKIP: phoneotp table may already exist: {e}")

    await engine.dispose()
    print("\nMigration complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
