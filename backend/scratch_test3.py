import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from sqlmodel import SQLModel, select
from sqlalchemy.ext.asyncio import create_async_engine
from app.models.crop import CropSale, Crop
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:Vinay%4042@127.0.0.1:5432/agrichain")
engine = create_async_engine(DATABASE_URL, echo=True)

async def test_insert():
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        # get any crop
        res = await session.execute(select(Crop).limit(1))
        crop = res.scalars().first()
        if not crop:
            print("No crop found, cant test")
            return

        print(f"Testing insert for crop {crop.id}")
        sale = CropSale(
            crop_id=crop.id,
            date=datetime.utcnow(),
            buyer_type="Mill",
            buyer_name="Test Buyer",
            buyer_id="123",
            quantity_quintals=50.0,
            total_bags=100,
            bag_size=50,
            price_per_quintal=2000.0,
            total_revenue=100000.0,
            payment_mode="Cash",
            notes="Test sale",
            status="listed"
        )
        try:
            session.add(sale)
            await session.commit()
            print("Successfully saved sale!")
        except Exception as e:
            print(f"FAILED TO SAVE: {e}")

if __name__ == "__main__":
    asyncio.run(test_insert())
