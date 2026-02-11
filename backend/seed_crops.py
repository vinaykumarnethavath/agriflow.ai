"""
Seed script to add dummy crop data that fits within farmer's actual land holding.
- Growing crops: Rice, Wheat, Groundnuts
- Harvested crops: Cotton, past season Rice
Run this script after logging in as a farmer user.
"""

import asyncio
from datetime import datetime, timedelta
from sqlmodel import select, delete
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import engine
from app.models import User, Crop, CropExpense, UserRole, FarmerProfile

# Dummy crop data - designed to fit within ~6.78 acres total land
# Active crops: ~5.5 acres (leaves some land available)
# Harvested crops: historical data from previous seasons

DUMMY_CROPS = [
    # === CURRENTLY GROWING CROPS ===
    {
        "name": "Rice (Paddy) - Kharif 2025",
        "area": 2.5,  # 2.5 acres
        "sowing_date": datetime(2025, 6, 15),
        "expected_harvest_date": datetime(2025, 10, 20),
        "status": "Growing",
        "notes": "Basmati variety - irrigated field on plot 856/1/A",
        "total_cost": 32000,
        "total_revenue": 0,
        "expenses": [
            {"category": "Input", "type": "Seeds (Basmati)", "quantity": 35, "unit": "kg", "unit_cost": 80, "total_cost": 2800, "payment_mode": "Cash"},
            {"category": "Input", "type": "DAP Fertilizer", "quantity": 75, "unit": "kg", "unit_cost": 27, "total_cost": 2025, "payment_mode": "Digital"},
            {"category": "Input", "type": "Urea", "quantity": 100, "unit": "kg", "unit_cost": 6, "total_cost": 600, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Transplanting", "quantity": 4, "unit": "days", "unit_cost": 500, "total_cost": 2000, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Weeding", "quantity": 6, "unit": "days", "unit_cost": 400, "total_cost": 2400, "payment_mode": "Cash"},
            {"category": "Machinery", "type": "Tractor Plowing", "quantity": 2, "unit": "hours", "unit_cost": 1200, "total_cost": 2400, "payment_mode": "Digital"},
            {"category": "Irrigation", "type": "Canal Water Charges", "quantity": 1, "unit": "season", "unit_cost": 2500, "total_cost": 2500, "payment_mode": "Bank"},
            {"category": "Input", "type": "Pesticides", "quantity": 3, "unit": "liters", "unit_cost": 600, "total_cost": 1800, "payment_mode": "Cash"},
        ]
    },
    {
        "name": "Wheat - Rabi 2025",
        "area": 1.5,  # 1.5 acres
        "sowing_date": datetime(2025, 11, 10),
        "expected_harvest_date": datetime(2026, 3, 25),
        "status": "Growing",
        "notes": "HD-2967 variety - on plot 885/2/B",
        "total_cost": 18000,
        "total_revenue": 0,
        "expenses": [
            {"category": "Input", "type": "Wheat Seeds (HD-2967)", "quantity": 45, "unit": "kg", "unit_cost": 45, "total_cost": 2025, "payment_mode": "Cash"},
            {"category": "Input", "type": "DAP Fertilizer", "quantity": 50, "unit": "kg", "unit_cost": 27, "total_cost": 1350, "payment_mode": "Digital"},
            {"category": "Input", "type": "Urea", "quantity": 75, "unit": "kg", "unit_cost": 6, "total_cost": 450, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Sowing", "quantity": 2, "unit": "days", "unit_cost": 450, "total_cost": 900, "payment_mode": "Cash"},
            {"category": "Machinery", "type": "Seed Drill", "quantity": 1.5, "unit": "hours", "unit_cost": 1000, "total_cost": 1500, "payment_mode": "Digital"},
            {"category": "Irrigation", "type": "Tubewell Charges", "quantity": 4, "unit": "irrigations", "unit_cost": 800, "total_cost": 3200, "payment_mode": "Cash"},
        ]
    },
    {
        "name": "Groundnuts - Kharif 2025",
        "area": 1.5,  # 1.5 acres
        "sowing_date": datetime(2025, 7, 1),
        "expected_harvest_date": datetime(2025, 10, 30),
        "status": "Growing",
        "notes": "TMV-2 variety - rain-fed on plot 855/A/1",
        "total_cost": 21000,
        "total_revenue": 0,
        "expenses": [
            {"category": "Input", "type": "Groundnut Seeds", "quantity": 60, "unit": "kg", "unit_cost": 120, "total_cost": 7200, "payment_mode": "Cash"},
            {"category": "Input", "type": "Gypsum", "quantity": 150, "unit": "kg", "unit_cost": 8, "total_cost": 1200, "payment_mode": "Cash"},
            {"category": "Input", "type": "Single Super Phosphate", "quantity": 75, "unit": "kg", "unit_cost": 10, "total_cost": 750, "payment_mode": "Digital"},
            {"category": "Labor", "type": "Land Preparation", "quantity": 2, "unit": "days", "unit_cost": 500, "total_cost": 1000, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Sowing", "quantity": 2, "unit": "days", "unit_cost": 450, "total_cost": 900, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Weeding", "quantity": 4, "unit": "days", "unit_cost": 400, "total_cost": 1600, "payment_mode": "Cash"},
            {"category": "Machinery", "type": "Rotavator", "quantity": 1.5, "unit": "hours", "unit_cost": 1500, "total_cost": 2250, "payment_mode": "Digital"},
        ]
    },
    
    # === HARVESTED / SOLD CROPS (Previous seasons) ===
    {
        "name": "Cotton - Kharif 2024",
        "area": 3.0,  # Was grown on 3 acres last season
        "sowing_date": datetime(2024, 5, 15),
        "expected_harvest_date": datetime(2024, 11, 20),
        "status": "Harvested",
        "notes": "BT Cotton - sold to local trader. Good yield due to timely rains.",
        "actual_yield": 15,  # quintals
        "selling_price_per_unit": 6800,  # per quintal
        "total_cost": 54000,
        "total_revenue": 102000,  # 15 * 6800
        "expenses": [
            {"category": "Input", "type": "BT Cotton Seeds", "quantity": 1.5, "unit": "kg", "unit_cost": 1200, "total_cost": 1800, "payment_mode": "Cash"},
            {"category": "Input", "type": "DAP Fertilizer", "quantity": 150, "unit": "kg", "unit_cost": 27, "total_cost": 4050, "payment_mode": "Digital"},
            {"category": "Input", "type": "Urea", "quantity": 100, "unit": "kg", "unit_cost": 6, "total_cost": 600, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Sowing", "quantity": 3, "unit": "days", "unit_cost": 450, "total_cost": 1350, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Picking (3 rounds)", "quantity": 18, "unit": "days", "unit_cost": 500, "total_cost": 9000, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Weeding & Spraying", "quantity": 12, "unit": "days", "unit_cost": 400, "total_cost": 4800, "payment_mode": "Cash"},
            {"category": "Machinery", "type": "Tractor Plowing", "quantity": 3, "unit": "hours", "unit_cost": 1200, "total_cost": 3600, "payment_mode": "Digital"},
            {"category": "Input", "type": "Pesticides (Bollworm)", "quantity": 8, "unit": "liters", "unit_cost": 800, "total_cost": 6400, "payment_mode": "Cash"},
            {"category": "Irrigation", "type": "Drip Irrigation", "quantity": 1, "unit": "season", "unit_cost": 4000, "total_cost": 4000, "payment_mode": "Bank"},
            {"category": "Logistics", "type": "Transport to Trader", "quantity": 1, "unit": "trip", "unit_cost": 1500, "total_cost": 1500, "payment_mode": "Cash"},
        ]
    },
    {
        "name": "Rice (Paddy) - Kharif 2024",
        "area": 2.0,  # Was grown on 2 acres last year
        "sowing_date": datetime(2024, 6, 20),
        "expected_harvest_date": datetime(2024, 10, 25),
        "status": "Harvested",
        "notes": "Sona Masuri variety - sold at mandi. Average yield due to pest attack.",
        "actual_yield": 32,  # quintals
        "selling_price_per_unit": 2400,  # per quintal MSP
        "total_cost": 28000,
        "total_revenue": 76800,  # 32 * 2400
        "expenses": [
            {"category": "Input", "type": "Seeds (Sona Masuri)", "quantity": 30, "unit": "kg", "unit_cost": 65, "total_cost": 1950, "payment_mode": "Cash"},
            {"category": "Input", "type": "DAP Fertilizer", "quantity": 60, "unit": "kg", "unit_cost": 27, "total_cost": 1620, "payment_mode": "Digital"},
            {"category": "Input", "type": "Urea", "quantity": 80, "unit": "kg", "unit_cost": 6, "total_cost": 480, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Transplanting", "quantity": 3, "unit": "days", "unit_cost": 500, "total_cost": 1500, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Harvesting", "quantity": 4, "unit": "days", "unit_cost": 600, "total_cost": 2400, "payment_mode": "Cash"},
            {"category": "Labor", "type": "Weeding", "quantity": 5, "unit": "days", "unit_cost": 400, "total_cost": 2000, "payment_mode": "Cash"},
            {"category": "Machinery", "type": "Harvester", "quantity": 2, "unit": "hours", "unit_cost": 2000, "total_cost": 4000, "payment_mode": "Digital"},
            {"category": "Input", "type": "Pesticides", "quantity": 4, "unit": "liters", "unit_cost": 550, "total_cost": 2200, "payment_mode": "Cash"},
            {"category": "Irrigation", "type": "Canal Water Charges", "quantity": 1, "unit": "season", "unit_cost": 2000, "total_cost": 2000, "payment_mode": "Bank"},
            {"category": "Logistics", "type": "Transport to Mandi", "quantity": 1, "unit": "trip", "unit_cost": 1800, "total_cost": 1800, "payment_mode": "Cash"},
        ]
    },
]


async def seed_crops(reset_existing=True):
    async with AsyncSession(engine) as session:
        # Find the first farmer user
        statement = select(User).where(User.role == UserRole.FARMER)
        result = await session.exec(statement)
        farmer = result.first()
        
        if not farmer:
            print("ERROR: No farmer user found. Please register a farmer first.")
            return
        
        farmer_id = farmer.id
        print(f"Found farmer: {farmer.email} (ID: {farmer_id})")
        
        # Get farmer's total land area
        profile_stmt = select(FarmerProfile).where(FarmerProfile.user_id == farmer_id)
        profile_result = await session.exec(profile_stmt)
        profile = profile_result.first()
        
        if profile:
            print(f"Farmer's total land: {profile.total_area} acres")
        
        if reset_existing:
            # Delete existing crops and their expenses for this farmer
            existing_crops = await session.exec(select(Crop).where(Crop.user_id == farmer_id))
            crop_list = existing_crops.all()
            
            for crop in crop_list:
                # Delete expenses first
                await session.exec(delete(CropExpense).where(CropExpense.crop_id == crop.id))
            
            # Delete crops
            await session.exec(delete(Crop).where(Crop.user_id == farmer_id))
            await session.commit()
            print(f"Deleted {len(crop_list)} existing crops and their expenses.")
        
        # Calculate total area for new crops
        growing_area = sum(c["area"] for c in DUMMY_CROPS if c["status"] == "Growing")
        harvested_area = sum(c["area"] for c in DUMMY_CROPS if c["status"] == "Harvested")
        print(f"\nNew crops summary:")
        print(f"  - Growing crops: {growing_area} acres")
        print(f"  - Harvested crops (historical): {harvested_area} acres")
        
        # Create crops
        import copy
        for crop_template in DUMMY_CROPS:
            crop_data = copy.deepcopy(crop_template)
            expenses_data = crop_data.pop("expenses", [])
            
            # Calculate net profit
            total_cost = crop_data.get("total_cost", 0)
            total_revenue = crop_data.get("total_revenue", 0)
            net_profit = total_revenue - total_cost
            
            crop = Crop(
                **crop_data,
                user_id=farmer_id,
                net_profit=net_profit
            )
            session.add(crop)
            await session.commit()
            await session.refresh(crop)
            
            status_emoji = "Growing" if crop.status == "Growing" else "Harvested"
            profit_emoji = "profit" if net_profit >= 0 else "loss"
            print(f"\nCreated: {crop.name}")
            print(f"  - Area: {crop.area} acres | Status: {status_emoji}")
            print(f"  - Cost: Rs.{total_cost:,} | Revenue: Rs.{total_revenue:,} | Net: Rs.{net_profit:,} ({profit_emoji})")
            
            # Add expenses
            for exp_data in expenses_data:
                expense = CropExpense(
                    crop_id=crop.id,
                    date=crop_data.get("sowing_date", datetime.now()) + timedelta(days=len(expenses_data)),
                    **exp_data
                )
                session.add(expense)
            
            await session.commit()
            print(f"  - Added {len(expenses_data)} expense records")
        
        print("\n" + "="*50)
        print("SEED DATA CREATED SUCCESSFULLY!")
        print("="*50)
        print(f"\nCrops breakdown:")
        print(f"  GROWING: Rice (2.5ac) + Wheat (1.5ac) + Groundnuts (1.5ac) = 5.5 acres")
        print(f"  HARVESTED: Cotton 2024 (3.0ac) + Rice 2024 (2.0ac) = 5.0 acres")
        print(f"\n  Land utilized: 5.5 acres (leaves buffer for available land)")
        print(f"\nView crops at: http://localhost:3000/dashboard/farmer/crops")


if __name__ == "__main__":
    asyncio.run(seed_crops(reset_existing=True))
