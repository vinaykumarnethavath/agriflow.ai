import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.database import engine

async def update_schema():
    print("Starting schema update for shop_profiles...")
    async with engine.begin() as conn:
        columns = [
            "perm_house_no", "perm_street", "perm_village", 
            "perm_mandal", "perm_district", "perm_state", "perm_pincode"
        ]
        for col in columns:
            try:
                await conn.execute(text(f"ALTER TABLE shop_profiles ADD COLUMN {col} VARCHAR"))
                print(f"Added column {col} to shop_profiles")
            except Exception as e:
                print(f"Column {col} might already exist or error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(update_schema())
