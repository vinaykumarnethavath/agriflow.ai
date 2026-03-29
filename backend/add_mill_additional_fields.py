import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.database import engine

async def update_schema():
    print("Starting schema update for mill_profiles with extra fields...")
    async with engine.begin() as conn:
        columns = [
            ("owner_name", "VARCHAR"),
            ("contact_number", "VARCHAR"),
            ("aadhaar_number", "VARCHAR"),
            ("pan_number", "VARCHAR"),
            ("hide_personal_details", "BOOLEAN DEFAULT FALSE"),
        ]
        for col_name, col_type in columns:
            try:
                await conn.execute(text(f"ALTER TABLE mill_profiles ADD COLUMN {col_name} {col_type}"))
                print(f"Added column {col_name} to mill_profiles")
            except Exception as e:
                print(f"Column {col_name} might already exist or error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(update_schema())
