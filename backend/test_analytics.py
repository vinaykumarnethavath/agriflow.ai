import asyncio
import aiosqlite
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
import os
import sys

sys.path.append(os.getcwd())
try:
    from app.models import ShopOrder, Product, ShopOrderItem
except ModuleNotFoundError:
    print("Run from backend dir")
    sys.exit(1)

DATABASE_URL = "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain"
engine = create_async_engine(DATABASE_URL)

async def test_analytics():
    async with AsyncSession(engine) as session:
        shop_id = 9 # Need to find the correct shop_id.

        # Let's find a valid shop_id
        q = select(ShopOrder.shop_id).limit(1)
        res = (await session.exec(q)).first()
        if not res:
            print("No orders found!")
            return
        shop_id = res
        print(f"Testing for shop_id {shop_id}")

        SOLD_STATUSES = ["pending", "confirmed", "completed", "dispatched"]
        
        rev_query = select(func.coalesce(func.sum(ShopOrder.final_amount), 0.0)).where(
            ShopOrder.shop_id == shop_id,
            ShopOrder.status.in_(SOLD_STATUSES)
        )
        total_revenue = (await session.exec(rev_query)).first() or 0.0
        print(f"Total Revenue: {total_revenue}")
        
        total_orders_q = select(func.count(ShopOrder.id)).where(
            ShopOrder.shop_id == shop_id
        )
        total_orders = (await session.exec(total_orders_q)).first() or 0
        print(f"Total Orders: {total_orders}")

if __name__ == "__main__":
    asyncio.run(test_analytics())
