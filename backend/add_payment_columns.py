import asyncio
from sqlalchemy import text
from app.database import engine

async def run_migration():
    print("Starting migration to add payment_status and payment_id to shop_orders...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE shop_orders ADD COLUMN payment_status VARCHAR DEFAULT 'pending';"))
            print("Successfully added payment_status column.")
        except Exception as e:
            if "already exists" in str(e):
                print("payment_status column already exists, ignoring.")
            else:
                print(f"Error adding payment_status: {e}")
                
        try:
            await conn.execute(text("ALTER TABLE shop_orders ADD COLUMN payment_id VARCHAR;"))
            print("Successfully added payment_id column.")
        except Exception as e:
            if "already exists" in str(e):
                print("payment_id column already exists, ignoring.")
            else:
                print(f"Error adding payment_id: {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
