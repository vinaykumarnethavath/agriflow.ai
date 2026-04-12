import asyncio
import sys
import os

sys.path.append(os.getcwd())
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.routers.orders import read_shop_orders_detailed
from app.models import User, ShopOrder

engine = create_async_engine('postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain')

async def main():
    async with AsyncSession(engine) as session:
        q = select(ShopOrder.shop_id).limit(1)
        shop_id = (await session.exec(q)).first()
        print("Using shop_id:", shop_id)
        
        user = User(id=shop_id, role='shop')
        try:
            print("fetching...")
            res = await read_shop_orders_detailed(current_user=user, session=session)
            print("success, length:", len(res))
            if res:
                print("First order profit:", res[0].get("profit"))
        except Exception as e:
            print("ERROR:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
