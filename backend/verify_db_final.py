import asyncio
from sqlalchemy import text
from app.database import engine

async def verify_db():
    print("--- Database Schema Verification (Final) ---")
    async with engine.connect() as conn:
        for table in ['shop_orders', 'shop_expenses']:
            print(f"\n[{table} columns]")
            res = await conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'"))
            cols = [r[0] for r in res]
            print(f"Columns: {cols}")

        print("\n--- Recent Records from shop_orders ---")
        try:
            res = await conn.execute(text("SELECT id, total_amount, total_expenses, profit FROM shop_orders ORDER BY id DESC LIMIT 3"))
            for r in res:
                print(f"ID: {r[0]}, Amt: {r[1]}, Exp: {r[2]}, Profit: {r[3]}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    engine.echo = False
    asyncio.run(verify_db())
