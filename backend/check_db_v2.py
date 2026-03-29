import asyncio
from sqlmodel import select, text
from app.database import engine

async def check_db():
    async with engine.connect() as conn:
        print("--- ShopOrder Schema ---")
        try:
            res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'shoporder'"))
            for r in res:
                print(r[0])
        except Exception as e:
            print(f"Error checking shoporder: {e}")

        print("\n--- ShopExpense Schema ---")
        try:
            res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'shopexpense'"))
            for r in res:
                print(r[0])
        except Exception as e:
            print(f"Error checking shopexpense: {e}")

        print("\n--- Recent Records ---")
        try:
            res = await conn.execute(text("SELECT id, total_amount, total_expenses, profit FROM shoporder ORDER BY id DESC LIMIT 5"))
            for r in res:
                print(f"ID: {r[0]}, Amt: {r[1]}, Exp: {r[2]}, Profit: {r[3]}")
        except Exception as e:
            print(f"Error fetching data: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
