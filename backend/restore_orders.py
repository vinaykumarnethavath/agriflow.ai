import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession
import os
import sys

# Add the current directory to sys.path to allow imports from app
sys.path.append(os.getcwd())

try:
    from app.models import ShopOrder, Product, ShopOrderItem
except ModuleNotFoundError:
    print("Run this script from the backend directory.")
    sys.exit(1)

DATABASE_URL = "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain"
engine = create_async_engine(DATABASE_URL)

async def restore_orders():
    async with AsyncSession(engine) as session:
        # Check cancelled orders
        cancelled_q = select(ShopOrder).where(ShopOrder.status == "cancelled")
        cancelled_orders = (await session.exec(cancelled_q)).all()
        print(f"\nFound Cancelled Orders ({len(cancelled_orders)}):")
        
        for order in cancelled_orders:
            print(f"  Restoring Order ID: {order.id}")
            
            # Change status to completed
            order.status = "completed"
            session.add(order)
            
            # Deduct quantities from products
            items_q = select(ShopOrderItem).where(ShopOrderItem.order_id == order.id)
            items = (await session.exec(items_q)).all()
            for item in items:
                product = await session.get(Product, item.product_id)
                if product:
                    old_qty = product.quantity
                    product.quantity -= item.quantity
                    print(f"    - Product {product.id} ({product.name}) qty: {old_qty} -> {product.quantity}")
                    session.add(product)
                else:
                    print(f"    - Warning: Product {item.product_id} not found!")
                    
        await session.commit()
        print("\nRestoration completed successfully.")

if __name__ == "__main__":
    asyncio.run(restore_orders())
