import asyncio
from sqlmodel import select, Session
from sqlalchemy import text
from app.database import engine
from app.models.trade import ShopOrder, Product
from app.models.expense import ShopExpense

async def check_db():
    async with engine.connect() as conn:
        print("Checking ShopOrder table...")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'shoporder'"))
        cols = [r[0] for r in res]
        print(f"ShopOrder columns: {cols}")
        
        print("\nChecking ShopExpense table...")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'shopexpense'"))
        cols = [r[0] for r in res]
        print(f"ShopExpense columns: {cols}")
        
        print("\nRecent Orders with Expenses:")
        res = await conn.execute(text("SELECT id, total_amount, total_expenses, profit FROM shoporder ORDER BY created_at DESC LIMIT 5"))
        for r in res:
            print(f"Order ID: {r[0]}, Amount: {r[1]}, Expenses: {r[2]}, Profit: {r[3]}")

if __name__ == "__main__":
    asyncio.run(check_db())
