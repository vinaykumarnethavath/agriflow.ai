import asyncio
from sqlalchemy import text
from app.database import engine

async def migrate():
    print("--- Manual Database Migration ---")
    async with engine.connect() as conn:
        # ShopOrder
        print("\n[shop_orders]")
        try:
            await conn.execute(text("ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS total_expenses DOUBLE PRECISION DEFAULT 0.0"))
            await conn.execute(text("ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS profit DOUBLE PRECISION DEFAULT 0.0"))
            await conn.commit()
            print("✅ Columns added to shop_orders.")
        except Exception as e:
            print(f"Error migrating shop_orders: {e}")

        # ShopExpense
        print("\n[shop_expenses]")
        try:
            await conn.execute(text("ALTER TABLE shop_expenses ADD COLUMN IF NOT EXISTS transportation DOUBLE PRECISION DEFAULT 0.0"))
            await conn.execute(text("ALTER TABLE shop_expenses ADD COLUMN IF NOT EXISTS labour DOUBLE PRECISION DEFAULT 0.0"))
            await conn.execute(text("ALTER TABLE shop_expenses ADD COLUMN IF NOT EXISTS other DOUBLE PRECISION DEFAULT 0.0"))
            await conn.execute(text("ALTER TABLE shop_expenses ADD COLUMN IF NOT EXISTS notes TEXT"))
            await conn.commit()
            print("✅ Columns added to shop_expenses.")
        except Exception as e:
            print(f"Error migrating shop_expenses: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
