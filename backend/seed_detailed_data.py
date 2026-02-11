import asyncio
from sqlmodel import select
from app.database import engine
from app.models import User, Crop, CropExpense, CropHarvest
from app.routers.auth import get_password_hash
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from datetime import datetime, timedelta

async def seed_detailed_data():
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # 1. Get Farmer User
        statement = select(User).where(User.email == "farmer@agri.com")
        result = await session.exec(statement)
        farmer = result.first()
        
        if not farmer:
            print("Farmer user not found. Please run initial seed_data.py first.")
            return

        print(f"Seeding data for farmer: {farmer.full_name}")

        # 2. Create a Detailed Demo Crop
        demo_crop = Crop(
            user_id=farmer.id,
            name="Tomato 'Red Gold' (Demo)",
            area=2.5,
            sowing_date=datetime.now() - timedelta(days=90),
            expected_harvest_date=datetime.now() + timedelta(days=10),
            status="Harvesting",
            notes="High yield variety, showing good resistance to blight.",
            total_cost=0,
            total_revenue=0,
            net_profit=0
        )
        session.add(demo_crop)
        await session.commit()
        await session.refresh(demo_crop)
        
        crop_id = demo_crop.id
        print(f"Created crop: {demo_crop.name} (ID: {crop_id})")

        # 3. Add Expenses
        expenses = [
            CropExpense(
                crop_id=crop_id,
                category="Input",
                type="Hybrid Seeds",
                quantity=10,
                unit="packets",
                unit_cost=450,
                total_cost=4500,
                date=datetime.now() - timedelta(days=90),
                payment_mode="Cash",
                notes="Certified seeds from agri-store"
            ),
            CropExpense(
                crop_id=crop_id,
                category="Input",
                type="DAP Fertilizer",
                quantity=5,
                unit="bags",
                unit_cost=1350,
                total_cost=6750,
                date=datetime.now() - timedelta(days=85),
                payment_mode="Credit",
                notes="Basal application"
            ),
            CropExpense(
                crop_id=crop_id,
                category="Labor",
                type="Sowing Labor",
                quantity=4,
                unit="workers",
                unit_cost=500,
                duration=2,
                total_cost=4000,
                date=datetime.now() - timedelta(days=89),
                payment_mode="Cash",
                notes="2 days of sowing work"
            ),
            CropExpense(
                crop_id=crop_id,
                category="Irrigation",
                type="Drip Maintenance",
                quantity=1,
                unit="unit",
                unit_cost=2000,
                total_cost=2000,
                date=datetime.now() - timedelta(days=60),
                payment_mode="Digital",
                notes="Filter cleaning and pipe repair"
            ),
            CropExpense(
                crop_id=crop_id,
                category="Labor",
                type="Weeding",
                quantity=3,
                unit="workers",
                unit_cost=500,
                duration=1,
                total_cost=1500,
                date=datetime.now() - timedelta(days=45),
                payment_mode="Cash"
            )
        ]
        
        total_expense_cost = 0
        for exp in expenses:
            session.add(exp)
            total_expense_cost += exp.total_cost
            
        print(f"Added {len(expenses)} expenses. Total Cost: {total_expense_cost}")

        # 4. Add Harvests
        harvests = [
            CropHarvest(
                crop_id=crop_id,
                date=datetime.now() - timedelta(days=5),
                stage="First Picking",
                quantity=15,
                unit="Quintals",
                quality="Grade A",
                selling_price_per_unit=2500,
                total_revenue=37500,
                buyer_type="Market",
                notes="Early harvest, good price"
            ),
             CropHarvest(
                crop_id=crop_id,
                date=datetime.now() - timedelta(days=1),
                stage="Second Picking",
                quantity=25,
                unit="Quintals",
                quality="Grade A",
                selling_price_per_unit=2400,
                total_revenue=60000,
                buyer_type="Mandi",
                notes="Bulk sale"
            )
        ]
        
        total_revenue = 0
        total_yield = 0
        for h in harvests:
            session.add(h)
            total_revenue += h.total_revenue
            total_yield += h.quantity
            
        print(f"Added {len(harvests)} harvests. Total Revenue: {total_revenue}")
        
        # 5. Update Crop Totals
        demo_crop.total_cost = total_expense_cost
        demo_crop.total_revenue = total_revenue
        demo_crop.net_profit = total_revenue - total_expense_cost
        demo_crop.actual_yield = total_yield
        
        session.add(demo_crop)
        await session.commit()
        
        print("\n--- Summary ---")
        print(f"Crop: {demo_crop.name}")
        print(f"Total Cost: Rs. {demo_crop.total_cost}")
        print(f"Total Revenue: Rs. {demo_crop.total_revenue}")
        print(f"Net Profit: Rs. {demo_crop.net_profit}")
        print("Detailed seed data created successfully!")

if __name__ == "__main__":
    asyncio.run(seed_detailed_data())
