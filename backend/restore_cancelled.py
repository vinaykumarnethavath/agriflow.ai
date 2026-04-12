import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from app.models import ShopOrder, ShopOrderItem, Product

# Ensure we're in the right directory or have access to models.
# The app module is importable since we run from backend dir.

DATABASE_URL = "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain"
engine = create_async_engine(DATABASE_URL)

async def restore_cancelled():
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Find all cancelled orders
        stmt = select(ShopOrder).where(ShopOrder.status == "cancelled")
        result = await session.exec(stmt)
        cancelled_orders = result.all()
        
        print(f"Found {len(cancelled_orders)} cancelled orders to restore.")
        
        for order in cancelled_orders:
            # Change status back to completed
            order.status = "completed"
            session.add(order)
            
            # Find items for this order
            item_stmt = select(ShopOrderItem).where(ShopOrderItem.order_id == order.id)
            item_res = await session.exec(item_stmt)
            items = item_res.all()
            
            for item in items:
                # Find product
                product = await session.get(Product, item.product_id)
                if product:
                    # When cancelled, quantity was added back. To un-cancel, we subtract the quantity.
                    product.quantity -= item.quantity
                    session.add(product)
                    print(f"Subtracted {item.quantity} from product {product.id} ({product.name}). New q: {product.quantity}")
                    
        await session.commit()
        print("Restoration complete.")

if __name__ == "__main__":
    asyncio.run(restore_cancelled())
