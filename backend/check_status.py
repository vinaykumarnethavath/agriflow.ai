import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain"
engine = create_async_engine(DATABASE_URL)

async def check():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT status, count(*) FROM shop_orders GROUP BY status"))
        print("Shop Orders by Status:")
        for row in res:
            print(f"Status: {row[0]}, Count: {row[1]}")
        
        res = await conn.execute(text("SELECT status, count(*) FROM shop_order_items JOIN shop_orders on shop_orders.id = shop_order_items.order_id GROUP BY status"))
        print("\nShop Order Items by Order Status:")
        for row in res:
            print(f"Status: {row[0]}, Count: {row[1]}")

asyncio.run(check())
