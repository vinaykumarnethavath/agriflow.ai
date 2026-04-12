import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain"
engine = create_async_engine(DATABASE_URL)

async def check():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id, status, total_amount FROM shop_orders WHERE status = 'cancelled'"))
        cancelled_orders = res.fetchall()
        print("Cancelled Orders:")
        for row in cancelled_orders:
            print(f"Order #{row[0]}, Status: {row[1]}, Total: {row[2]}")
            
        res2 = await conn.execute(text("SELECT product.name, product.quantity FROM product LIMIT 10"))
        print("\nSome Products Inventory:")
        for row in res2.fetchall():
            print(f"{row[0]} -> {row[1]}")

asyncio.run(check())
