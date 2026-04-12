import asyncio
import aiosqlite
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
import os
import sys

sys.path.append(os.getcwd())
try:
    from app.models import ShopOrder
except ModuleNotFoundError:
    print("Run from backend dir")
    sys.exit(1)

DATABASE_URL = "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain"
engine = create_async_engine(DATABASE_URL)

async def view_recent_orders():
    async with AsyncSession(engine) as session:
        q = select(ShopOrder).order_by(ShopOrder.created_at.desc()).limit(5)
        orders = (await session.exec(q)).all()
        print("Recent 5 orders:")
        for o in orders:
            print(f"ID: {o.id}, Status: {o.status}, Created: {o.created_at}, Amount: {o.final_amount}")

if __name__ == "__main__":
    asyncio.run(view_recent_orders())
