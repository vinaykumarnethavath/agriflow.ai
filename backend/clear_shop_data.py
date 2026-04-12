import asyncio
import os
import sys

sys.path.append(os.getcwd())
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models import Product, ShopOrder, ShopOrderItem, ShopExpense, ShopAccountingExpense, CustomerOrder, CustomerOrderItem

from sqlalchemy import text

engine = create_async_engine('postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain')

async def main():
    async with AsyncSession(engine) as session:
        try:
            # Use TRUNCATE CASCADE to safely delete products, orders, cart, expenses, payments, and manufacturing data
            await session.exec(text("TRUNCATE TABLE product, shop_orders, customer_orders, shop_expenses, shop_accounting_expenses, cart, manufacturer_purchases, payments, manufacturer_sales, production_batches, manufacturerexpense, traceabilityevent RESTART IDENTITY CASCADE;"))
            
            await session.commit()
            print("Successfully deleted all orders, expenses, and inventory data.")
        except Exception as e:
            print(f"Error during deletion: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
