import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from datetime import datetime, timedelta

DATABASE_URL = "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain"
engine = create_async_engine(DATABASE_URL)

async def check():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id, status, created_at, shop_id FROM shop_orders ORDER BY created_at DESC"))
        print("Order Details:")
        for row in res:
            print(f"ID: {row[0]}, Status: {row[1]}, Date: {row[2]}, ShopID: {row[3]}")
        
        # Check current user (shop) id if possible, or just look at the distribution
        res_shops = await conn.execute(text("SELECT shop_id, count(*) FROM shop_orders GROUP BY shop_id"))
        print("\nOrders per Shop:")
        for row in res_shops:
            print(f"Shop ID: {row[0]}, Count: {row[1]}")

asyncio.run(check())
