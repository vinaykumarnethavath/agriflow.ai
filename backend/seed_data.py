import asyncio
from sqlmodel import select, text
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from app.database import engine
from app.models import Product, User, Crop, FarmerProfile, UserRole
from app.routers.auth import get_password_hash

async def migrate_db(session):
    print("Checking for schema updates...")
    try:
        # Add missing columns to product table
        await session.exec(text("ALTER TABLE product ADD COLUMN IF NOT EXISTS brand VARCHAR"))
        await session.exec(text("ALTER TABLE product ADD COLUMN IF NOT EXISTS cost_price FLOAT"))
        await session.exec(text("ALTER TABLE product ADD COLUMN IF NOT EXISTS unit VARCHAR DEFAULT 'kg'"))
        await session.exec(text("ALTER TABLE product ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP"))
        await session.exec(text("ALTER TABLE product ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10"))
        await session.exec(text("ALTER TABLE product ADD COLUMN IF NOT EXISTS traceability_json VARCHAR DEFAULT '{}'"))
        
        # Add missing columns to crop table
        await session.exec(text("ALTER TABLE crop ADD COLUMN IF NOT EXISTS actual_harvest_date TIMESTAMP"))
        
        await session.commit()
        print("Schema updated successfully.")
    except Exception as e:
        print(f"Schema update skipped/failed: {e}")
        await session.rollback()

async def seed_data():
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        await migrate_db(session)
        print("Starting seed process...")

        # 1. Create Dummy Shop Owner
        statement = select(User).where(User.email == "shop@agri.com")
        result = await session.exec(statement)
        shop_user = result.first()
        
        if not shop_user:
            print("Creating dummy shop owner...")
            shop_user = User(
                email="shop@agri.com",
                full_name="Agri Shop",
                hashed_password=get_password_hash("shop123"),
                role="shop"
            )
            session.add(shop_user)
            session.commit()
            session.refresh(shop_user)
        
        # 2. Create Dummy Farmer
        statement = select(User).where(User.email == "farmer@agri.com")
        result = await session.exec(statement)
        farmer_user = result.first()
        
        farmer_user_id = None
        
        if not farmer_user:
            print("Creating dummy farmer...")
            farmer_user = User(
                email="farmer@agri.com",
                full_name="Ramesh Farmer",
                hashed_password=get_password_hash("farmer123"),
                role="farmer"
            )
            session.add(farmer_user)
            await session.commit()
            await session.refresh(farmer_user)
            farmer_user_id = farmer_user.id
            
            try:
                # Create Profile
                profile = FarmerProfile(
                    user_id=farmer_user.id,
                    farmer_id="F-1001",
                    contact_number="9876543210",
                    address="Village Green, District Crop"
                )
                session.add(profile)
                await session.commit()
            except Exception as e:
                print(f"Profile creation skipped/failed: {e}")
                await session.rollback()
        else:
            farmer_user_id = farmer_user.id

        # 3. Seed Products (if empty)
        statement = select(Product)
        result = await session.exec(statement)
        existing_products = result.all()
        
        if not existing_products:
            print("Seeding dummy products...")
            products = [
                Product(name="DAP (Di-Ammonium Phosphate)", short_name="DAP", category="fertilizer", price=1350.0, quantity=100, batch_number="B-101", description="High phosphorus fertilizer.", user_id=shop_user.id),
                Product(name="MOP (Muriate of Potash)", short_name="MOP", category="fertilizer", price=1700.0, quantity=50, batch_number="B-102", description="Potassium source.", user_id=shop_user.id),
                Product(name="Urea (Neem Coated)", short_name="Urea", category="fertilizer", price=266.50, quantity=200, batch_number="B-103", description="Nitrogen fertilizer.", user_id=shop_user.id),
                Product(name="Cotton Seeds (Bt)", short_name="Cotton", category="seeds", price=850.0, quantity=60, batch_number="S-301", description="High yielding seeds.", user_id=shop_user.id),
                Product(name="Knapsack Sprayer", short_name="Sprayer", category="equipment", price=2500.0, quantity=10, batch_number="E-401", description="Manual sprayer 16L.", user_id=shop_user.id),
            ]
            for p in products:
                session.add(p)
            await session.commit()
            
        # 4. Seed Crops (if empty for farmer)
        statement = select(Crop).where(Crop.user_id == farmer_user_id)
        result = await session.exec(statement)
        existing_crops = result.all()
        
        if not existing_crops:
            print("Seeding dummy crops for farmer...")
            crops = [
                Crop(
                    name="Wheat (Rabi)",
                    area=5.0,
                    sowing_date=datetime(2023, 11, 15),
                    expected_harvest_date=datetime(2024, 4, 15),
                    status="Growing",
                    notes="Sonalika variety. First irrigation done.",
                    user_id=farmer_user_id
                ),
                Crop(
                    name="Rice (Kharif)",
                    area=4.5,
                    sowing_date=datetime(2023, 6, 20),
                    expected_harvest_date=datetime(2023, 10, 25),
                    status="Harvested",
                    actual_harvest_date=datetime(2023, 10, 28),
                    actual_yield=180.5, # Quintals
                    selling_price_per_unit=2200.0,
                    total_revenue=397100.0,
                    total_cost=150000.0,
                    net_profit=247100.0,
                    notes="Good yield this season.",
                    user_id=farmer_user_id
                ),
                Crop(
                    name="Mustard",
                    area=2.0,
                    sowing_date=datetime(2023, 10, 5),
                    expected_harvest_date=datetime(2024, 2, 20),
                    status="Growing",
                    notes="Watching for pests.",
                    user_id=farmer_user_id
                )
            ]
            for c in crops:
                session.add(c)
            await session.commit()

        print("Seed process completed successfully!")
        print(f"Farmer Login: farmer@agri.com / farmer123")
        print(f"Shop Login: shop@agri.com / shop123")

if __name__ == "__main__":
    asyncio.run(seed_data())
