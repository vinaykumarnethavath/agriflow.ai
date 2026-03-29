import asyncio
from sqlalchemy import text
from app.database import engine

async def check_db():
    print("--- Database Verification Script v3 ---")
    async with engine.connect() as conn:
        # ShopOrder
        print("\n[ShopOrder Table]")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'shoporder'"))
        cols = [r[0] for r in res]
        print(f"Columns: {cols}")
        for target in ['total_expenses', 'profit']:
            if target in cols:
                print(f"✅ {target} column exists.")
            else:
                print(f"❌ {target} column MISSING!")

        # ShopExpense
        print("\n[ShopExpense Table]")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'shopexpense'"))
        cols = [r[0] for r in res]
        print(f"Columns: {cols}")
        for target in ['transportation', 'labour', 'other']:
            if target in cols:
                print(f"✅ {target} column exists.")
            else:
                print(f"❌ {target} column MISSING!")

        # Recent Orders
        print("\n[Recent Orders (Top 3)]")
        res = await conn.execute(text("SELECT id, total_amount, total_expenses, profit FROM shoporder ORDER BY id DESC LIMIT 3"))
        rows = list(res)
        if rows:
            for r in rows:
                print(f"ID: {r[0]}, Amt: {r[1]}, Exp: {r[2]}, Profit: {r[3]}")
        else:
            print("No orders found.")

if __name__ == "__main__":
    # Disable SQLAlchemy echo for clean output
    engine.echo = False
    asyncio.run(check_db())
