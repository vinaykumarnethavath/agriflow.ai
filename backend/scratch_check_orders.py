
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models import ShopOrder

DATABASE_URL = "sqlite+aiosqlite:///c:/Users/vinay/OneDrive/Desktop/agri/backend/app/agrichain.db"
engine = create_async_engine(DATABASE_URL)

async def check_orders():
    async with AsyncSession(engine) as session:
        # Total counts by status
        q = select(ShopOrder.status, func.count(ShopOrder.id)).group_by(ShopOrder.status)
        results = await session.exec(q)
        print("Order Counts by Status:")
        for status, count in results.all():
            print(f"  {status}: {count}")
        
        # Total order count
        total_q = select(func.count(ShopOrder.id))
        total = (await session.exec(total_q)).first()
        print(f"Total Orders: {total}")

if __name__ == "__main__":
    asyncio.run(check_orders())
