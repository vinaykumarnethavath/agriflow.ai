import asyncio
from app.models import ProductCreate, User
from app.routers.products import create_product
from app.database import engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker

async def simulate():
    print("Simulating create_product...")
    # Mock user
    current_user = User(id=1, role="shop")  # Assuming id=1 exists, or just mock it
    
    # Mock product create schema payload matching screenshot
    payload = {
        "name": "NPK Fertilizer",
        "category": "fertilizer",
        "price": 300.0,
        "quantity": 135,
        "unit": "bag",
        "batch_number": "Batch-45645",
        "cost_price": 250.0,
        "main_composition": "NPK",
        "low_stock_threshold": 10,
        "traceability_json": "{}"
    }
    
    try:
        product_create = ProductCreate(**payload)
        
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as session:
            try:
                res = await create_product(product_create, current_user, session)
                print("Created successfully:", res)
                await session.commit()
            except Exception as e:
                import traceback
                print("\n[BACKEND ERROR] raising exception:")
                traceback.print_exc()
    except Exception as e:
         print(f"Pydantic validation failed: {e}")

if __name__ == "__main__":
    asyncio.run(simulate())
