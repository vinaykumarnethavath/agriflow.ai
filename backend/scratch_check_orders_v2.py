
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
import os
import sys

# Add the current directory to sys.path to allow imports from app
sys.path.append(os.getcwd())

from app.models import ShopOrder, Product, ShopOrderItem

DATABASE_URL = "sqlite+aiosqlite:///app/agrichain.db"
engine = create_async_engine(DATABASE_URL)

async def check_orders():
    async with AsyncSession(engine) as session:
        # Total counts by status
        q = select(ShopOrder.status, func.count(ShopOrder.id)).group_by(ShopOrder.status)
        results = await session.exec(q)
        print("Order Counts by Status:")
        for status, count in results.all():
            print(f"  {status}: {count}")
        
        # Check cancelled orders items
        cancelled_q = select(ShopOrder).where(ShopOrder.status == "cancelled")
        cancelled_orders = (await session.exec(cancelled_q)).all()
        print(f"\nCancelled Orders ({len(cancelled_orders)}):")
        for order in cancelled_orders:
            print(f"  Order ID: {order.id}, Final Amount: {order.final_amount}")
            # Items
            items_q = select(ShopOrderItem).where(ShopOrderItem.order_id == order.id)
            items = (await session.exec(items_q)).all()
            for item in items:
                print(f"    - Item: {item.product_name}, Qty: {item.quantity}")

if __name__ == "__main__":
    asyncio.run(check_orders())
