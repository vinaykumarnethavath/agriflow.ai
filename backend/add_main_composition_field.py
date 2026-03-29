import asyncio
from sqlalchemy import text
from app.database import engine

async def run_migration():
    print("Starting migration to add main_composition...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE product ADD COLUMN main_composition VARCHAR;"))
            print("Successfully added main_composition column.")
        except Exception as e:
            if "already exists" in str(e):
                print("Column already exists, ignoring.")
            else:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
