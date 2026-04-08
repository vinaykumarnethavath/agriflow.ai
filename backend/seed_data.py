"""
Seed script to populate the AgriChain database with dummy data.
Creates 4 user accounts (farmer, shop, manufacturer, customer) for:
  jonsnowjonny15@gmail.com  |  password: Test@1234

Run:  python seed_data.py
"""

import asyncio
import os, sys

# Ensure imports resolve from repo root
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta, date
import json

# ── App imports ──────────────────────────────────────────────────────
from app.utils import get_password_hash
from app.models.user import User, UserRole
from app.models.farmer import FarmerProfile, LandRecord
from app.models.shop import ShopProfile
from app.models.manufacturer import MillProfile, ManufacturerPurchase, ProductionBatch, ManufacturerSale
from app.models.customer import CustomerProfile, Cart, CustomerOrder, CustomerOrderItem
from app.models.crop import Crop, CropExpense, CropHarvest
from app.models.trade import Product, ShopOrder, ShopOrderItem, TraceabilityEvent
from app.models.expense import ShopExpense
from app.models.shop_accounting import ShopAccountingExpense
from app.models.manufacturer_expense import ManufacturerExpense

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./agrichain.db")
engine = create_async_engine(DATABASE_URL, echo=False, future=True)

EMAIL = "jonsnowjonny15@gmail.com"
PASSWORD = "Test@1234"
PHONE = "9999900000"

now = datetime.utcnow()
today = date.today()


async def seed():
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # ──────────────────────────────────────────────────────────────
        # 0.  Check if seed data already exists
        # ──────────────────────────────────────────────────────────────
        existing = await session.exec(select(User).where(User.email == EMAIL))
        if existing.first():
            print("[WARN] Seed data already exists for this email. Skipping.")
            return

        hashed_pwd = get_password_hash(PASSWORD)

        # ──────────────────────────────────────────────────────────────
        # 1.  Create 4 user accounts (one per role)
        # ──────────────────────────────────────────────────────────────
        farmer = User(email=EMAIL, phone_number="9999900001", full_name="Jon Snow (Farmer)", role="farmer", hashed_password=hashed_pwd)
        shop   = User(email=EMAIL, phone_number="9999900002", full_name="Jon Snow (Shop)", role="shop", hashed_password=hashed_pwd)
        mfr    = User(email=EMAIL, phone_number="9999900003", full_name="Jon Snow (Manufacturer)", role="manufacturer", hashed_password=hashed_pwd)
        cust   = User(email=EMAIL, phone_number="9999900004", full_name="Jon Snow (Customer)", role="customer", hashed_password=hashed_pwd)

        session.add_all([farmer, shop, mfr, cust])
        await session.flush()  # IDs are now available

        print(f"[OK] Users created -- Farmer:{farmer.id}  Shop:{shop.id}  Mfr:{mfr.id}  Cust:{cust.id}")

        # ──────────────────────────────────────────────────────────────
        # 2.  Farmer Profile + Land Records
        # ──────────────────────────────────────────────────────────────
        farmer_profile = FarmerProfile(
            user_id=farmer.id,
            farmer_id="FRM-JS-001",
            father_husband_name="Ned Stark",
            gender="male",
            relation_type="son_of",
            house_no="12",
            street="Winter Lane",
            village="Winterfell",
            mandal="Karnal",
            district="Karnal",
            state="Haryana",
            pincode="132001",
            total_area=12.5,
            aadhaar_last_4="1234",
            bank_name="State Bank of India",
            account_number="12345678901234",
            ifsc_code="SBIN0001234",
        )
        session.add(farmer_profile)
        await session.flush()

        land1 = LandRecord(farmer_profile_id=farmer_profile.id, serial_number="KNL-101", area=7.5)
        land2 = LandRecord(farmer_profile_id=farmer_profile.id, serial_number="KNL-102", area=5.0)
        session.add_all([land1, land2])

        # ──────────────────────────────────────────────────────────────
        # 3.  Crops + Expenses + Harvests   (owned by farmer)
        # ──────────────────────────────────────────────────────────────
        crop1 = Crop(
            user_id=farmer.id, name="Wheat", area=5.0, season="Rabi", variety="PBW 343",
            sowing_date=now - timedelta(days=120), expected_harvest_date=now + timedelta(days=20),
            status="Growing", crop_type="Cereal",
            notes="Main winter crop", total_cost=22000, total_revenue=0, net_profit=0,
        )
        crop2 = Crop(
            user_id=farmer.id, name="Rice (Basmati)", area=4.0, season="Kharif", variety="Pusa 1121",
            sowing_date=now - timedelta(days=200), expected_harvest_date=now - timedelta(days=30),
            actual_harvest_date=now - timedelta(days=25),
            status="Harvested", crop_type="Cereal",
            actual_yield=32.0, selling_price_per_unit=3200, total_revenue=102400,
            total_cost=45000, net_profit=57400,
        )
        crop3 = Crop(
            user_id=farmer.id, name="Tomato", area=1.5, season="Kharif", variety="Hybrid",
            sowing_date=now - timedelta(days=90), expected_harvest_date=now + timedelta(days=10),
            status="Growing", crop_type="Vegetable",
            total_cost=8500, total_revenue=0, net_profit=0,
        )
        crop4 = Crop(
            user_id=farmer.id, name="Sugarcane", area=3.0, season="Year-round", variety="Co-0238",
            sowing_date=now - timedelta(days=300), expected_harvest_date=now - timedelta(days=60),
            actual_harvest_date=now - timedelta(days=55),
            status="Sold", crop_type="Commercial",
            actual_yield=150.0, selling_price_per_unit=350, total_revenue=52500,
            total_cost=30000, net_profit=22500,
        )
        session.add_all([crop1, crop2, crop3, crop4])
        await session.flush()

        # Expenses for crop1 (Wheat)
        expenses_wheat = [
            CropExpense(crop_id=crop1.id, category="Input", type="Seed", quantity=40, unit="kg",
                        unit_cost=60, total_cost=2400, date=now - timedelta(days=118),
                        payment_mode="cash", stage="Sowing"),
            CropExpense(crop_id=crop1.id, category="Input", type="DAP Fertilizer", quantity=100, unit="kg",
                        unit_cost=32, total_cost=3200, date=now - timedelta(days=100),
                        payment_mode="digital", stage="Sowing"),
            CropExpense(crop_id=crop1.id, category="Input", type="Urea", quantity=100, unit="kg",
                        unit_cost=26, total_cost=2600, date=now - timedelta(days=60),
                        payment_mode="cash", stage="Watering"),
            CropExpense(crop_id=crop1.id, category="Labor", type="Sowing Labor", quantity=3, unit="days",
                        unit_cost=500, total_cost=1500, date=now - timedelta(days=115),
                        payment_mode="cash", stage="Sowing", duration=3),
            CropExpense(crop_id=crop1.id, category="Irrigation", type="Motor + Canal", quantity=1, unit="hours",
                        unit_cost=4000, total_cost=4000, date=now - timedelta(days=80),
                        payment_mode="digital", stage="Watering"),
            CropExpense(crop_id=crop1.id, category="Input", type="Pesticide", quantity=2, unit="liter",
                        unit_cost=800, total_cost=1600, date=now - timedelta(days=40),
                        payment_mode="cash", stage="Flowering"),
        ]
        session.add_all(expenses_wheat)

        # Expenses for crop2 (Rice)
        expenses_rice = [
            CropExpense(crop_id=crop2.id, category="Input", type="Seed", quantity=30, unit="kg",
                        unit_cost=120, total_cost=3600, date=now - timedelta(days=198),
                        payment_mode="cash", stage="Sowing"),
            CropExpense(crop_id=crop2.id, category="Labor", type="Transplanting", quantity=8, unit="days",
                        unit_cost=600, total_cost=4800, date=now - timedelta(days=180),
                        payment_mode="cash", stage="Sowing", duration=8),
            CropExpense(crop_id=crop2.id, category="Input", type="NPK Fertilizer", quantity=150, unit="kg",
                        unit_cost=28, total_cost=4200, date=now - timedelta(days=150),
                        payment_mode="digital", stage="Watering"),
            CropExpense(crop_id=crop2.id, category="Machinery", type="Harvester", quantity=1, unit="hours",
                        unit_cost=5000, total_cost=5000, date=now - timedelta(days=28),
                        payment_mode="digital", stage="Harvesting"),
        ]
        session.add_all(expenses_rice)

        # Harvest records for crop2 (Rice)
        harvest1 = CropHarvest(
            crop_id=crop2.id, date=now - timedelta(days=28), stage="First Picking",
            quantity=20, unit="Quintals", quality="Grade A",
            selling_price_per_unit=3200, total_revenue=64000,
            buyer_type="Market", sold_to="Karnal Grain Market",
        )
        harvest2 = CropHarvest(
            crop_id=crop2.id, date=now - timedelta(days=25), stage="Final Harvest",
            quantity=12, unit="Quintals", quality="Grade A",
            selling_price_per_unit=3200, total_revenue=38400,
            buyer_type="Private", sold_to="Agarwal Traders",
        )
        session.add_all([harvest1, harvest2])

        # ──────────────────────────────────────────────────────────────
        # 4.  Shop Profile + Products (Inventory)
        # ──────────────────────────────────────────────────────────────
        shop_profile = ShopProfile(
            user_id=shop.id,
            shop_name="Snow Agri Mart",
            license_number="AGR-2024-8832",
            shop_id="SHOP-JS-001",
            father_name="Ned Stark",
            owner_name="Jon Snow",
            contact_number="9999900002",
            shop_address="Main Road, Karnal",
            district="Karnal",
            state="Haryana",
            pincode="132001",
            bank_name="Punjab National Bank",
            account_number="22334455667788",
            ifsc_code="PUNB0001234",
        )
        session.add(shop_profile)

        # Products in shop inventory
        prod1 = Product(
            user_id=shop.id, name="NPK 20-20-20 Fertilizer", short_name="NPK 20",
            category="fertilizer", brand="IFFCO", manufacturer="Indian Farmers Fertiliser Cooperative",
            price=680, cost_price=580, quantity=120, unit="bag", quantity_per_unit=50,
            measure_unit="kg", batch_number="SHP-B001",
            description="Balanced NPK fertilizer for all crops",
            low_stock_threshold=20, status="active",
        )
        prod2 = Product(
            user_id=shop.id, name="Urea 46-0-0", short_name="Urea",
            category="fertilizer", brand="NFCL", manufacturer="Nagarjuna Fertilizers",
            price=280, cost_price=240, quantity=200, unit="bag", quantity_per_unit=50,
            measure_unit="kg", batch_number="SHP-B002",
            description="High-nitrogen fertilizer", low_stock_threshold=30, status="active",
        )
        prod3 = Product(
            user_id=shop.id, name="Imidacloprid 17.8% SL", short_name="Imida",
            category="pesticide", brand="Bayer", manufacturer="Bayer CropScience",
            price=520, cost_price=420, quantity=80, unit="bottle", quantity_per_unit=1,
            measure_unit="L", batch_number="SHP-B003",
            description="Systemic insecticide for sucking pests",
            manufacture_date=now - timedelta(days=60),
            expiry_date=now + timedelta(days=700),
            low_stock_threshold=15, status="active",
        )
        prod4 = Product(
            user_id=shop.id, name="Hybrid Tomato Seeds", short_name="Tomato Seed",
            category="seeds", brand="Syngenta", manufacturer="Syngenta India",
            price=350, cost_price=280, quantity=50, unit="packet", quantity_per_unit=0.01,
            measure_unit="kg", batch_number="SHP-B004",
            description="High-yield hybrid tomato seeds (10g pack)",
            low_stock_threshold=10, status="active",
        )
        prod5 = Product(
            user_id=shop.id, name="DAP 18-46-0", short_name="DAP",
            category="fertilizer", brand="Coromandel", manufacturer="Coromandel International",
            price=1350, cost_price=1200, quantity=100, unit="bag", quantity_per_unit=50,
            measure_unit="kg", batch_number="SHP-B005",
            description="Di-ammonium phosphate",
            low_stock_threshold=15, status="active",
        )
        prod6 = Product(
            user_id=shop.id, name="Wheat Seeds PBW-343", short_name="PBW-343",
            category="seeds", brand="PAU",
            price=80, cost_price=60, quantity=0, unit="kg", quantity_per_unit=1,
            measure_unit="kg", batch_number="SHP-B006-DRAFT",
            description="High-yield wheat seed variety -- awaiting stock",
            low_stock_threshold=20, status="draft",
        )

        session.add_all([prod1, prod2, prod3, prod4, prod5, prod6])
        await session.flush()

        # Traceability events for active products
        for p in [prod1, prod2, prod3, prod4, prod5]:
            session.add(TraceabilityEvent(
                product_id=p.id, actor_id=shop.id,
                action="Product Listed",
                details=f"{p.name} added to inventory with batch {p.batch_number}",
                timestamp=now - timedelta(days=15),
            ))

        # ──────────────────────────────────────────────────────────────
        # 5.  Shop Orders (sales to farmers)
        # ──────────────────────────────────────────────────────────────
        order1 = ShopOrder(
            shop_id=shop.id, farmer_id=farmer.id, farmer_name="Jon Snow (Farmer)",
            total_amount=3210, discount=0, final_amount=3210,
            payment_mode="cash", payment_status="paid", status="completed",
            created_at=now - timedelta(days=10),
        )
        session.add(order1)
        await session.flush()

        oi1 = ShopOrderItem(order_id=order1.id, product_id=prod1.id, product_name=prod1.name, quantity=3, unit_price=680, subtotal=2040)
        oi2 = ShopOrderItem(order_id=order1.id, product_id=prod4.id, product_name=prod4.name, quantity=2, unit_price=350, subtotal=700)
        oi3 = ShopOrderItem(order_id=order1.id, product_id=prod3.id, product_name=prod3.name, quantity=1, unit_price=520, subtotal=520 - 50)
        session.add_all([oi1, oi2, oi3])

        exp1 = ShopExpense(order_id=order1.id, transportation=150, labour=200, other=0, notes="Local delivery")
        session.add(exp1)

        order2 = ShopOrder(
            shop_id=shop.id, farmer_id=None, farmer_name="Walk-in Customer",
            total_amount=1350, discount=50, final_amount=1300,
            payment_mode="upi", payment_status="paid", status="completed",
            created_at=now - timedelta(days=5),
        )
        session.add(order2)
        await session.flush()

        oi4 = ShopOrderItem(order_id=order2.id, product_id=prod5.id, product_name=prod5.name, quantity=1, unit_price=1350, subtotal=1350)
        session.add(oi4)

        order3 = ShopOrder(
            shop_id=shop.id, farmer_id=farmer.id, farmer_name="Jon Snow (Farmer)",
            total_amount=560, discount=0, final_amount=560,
            payment_mode="cash", payment_status="paid", status="completed",
            created_at=now - timedelta(days=2),
        )
        session.add(order3)
        await session.flush()

        oi5 = ShopOrderItem(order_id=order3.id, product_id=prod2.id, product_name=prod2.name, quantity=2, unit_price=280, subtotal=560)
        session.add(oi5)

        # ──────────────────────────────────────────────────────────────
        # 6.  Shop Accounting Expenses
        # ──────────────────────────────────────────────────────────────
        acct_expenses = [
            ShopAccountingExpense(shop_id=shop.id, category="rent", amount=8000,
                                  description="Monthly shop rent -- April", expense_date=today),
            ShopAccountingExpense(shop_id=shop.id, category="labour", amount=12000,
                                  description="2 helpers salary -- April", expense_date=today),
            ShopAccountingExpense(shop_id=shop.id, category="utilities", amount=2500,
                                  description="Electricity bill", expense_date=today - timedelta(days=5)),
            ShopAccountingExpense(shop_id=shop.id, category="transportation", amount=3500,
                                  description="Goods pickup truck hire", expense_date=today - timedelta(days=8)),
        ]
        session.add_all(acct_expenses)

        # ──────────────────────────────────────────────────────────────
        # 7.  Manufacturer (Mill) Profile + Purchases + Production
        # ──────────────────────────────────────────────────────────────
        mill_profile = MillProfile(
            user_id=mfr.id,
            mill_name="Snow Flour Mill",
            license_number="MILL-2024-5512",
            mill_id="MILL-JS-001",
            father_name="Ned Stark",
            owner_name="Jon Snow",
            contact_number="9999900003",
            village="Winterfell Industrial Area",
            district="Karnal",
            state="Haryana",
            pincode="132001",
            bank_name="HDFC Bank",
            account_number="55667788990011",
            ifsc_code="HDFC0001234",
        )
        session.add(mill_profile)

        # Raw Material Product for manufacturer inventory
        raw_wheat = Product(
            user_id=mfr.id, name="Raw Wheat (Purchased)", category="crop",
            price=2200, cost_price=2200, quantity=500, unit="kg",
            measure_unit="kg", batch_number="MFR-RAW-001",
            description="Wheat purchased from local farmers", status="active",
        )
        finished_flour = Product(
            user_id=mfr.id, name="Wheat Flour (Atta)", category="processed",
            brand="Snow Mills", price=45, cost_price=32, quantity=350, unit="kg",
            measure_unit="kg", batch_number="MFR-FIN-001",
            description="Stone-ground whole wheat flour", status="active",
        )
        session.add_all([raw_wheat, finished_flour])
        await session.flush()

        purchase1 = ManufacturerPurchase(
            manufacturer_id=mfr.id, farmer_id=farmer.id, farmer_name="Jon Snow (Farmer)",
            crop_name="Wheat", quantity=500, unit="kg", price_per_unit=22,
            total_cost=11000, transport_cost=800, quality_grade="A",
            batch_id="M-PUR-001", date=now - timedelta(days=20),
        )
        session.add(purchase1)

        prod_batch = ProductionBatch(
            manufacturer_id=mfr.id, input_product_id=raw_wheat.id, input_qty=400,
            output_product_name="Wheat Flour (Atta)", output_qty=350, output_unit="kg",
            processing_cost=2500, waste_qty=50, efficiency=87.5,
            batch_number="M-PROD-001", date=now - timedelta(days=15),
        )
        session.add(prod_batch)

        sale1 = ManufacturerSale(
            manufacturer_id=mfr.id, buyer_type="shop", buyer_id=shop.id,
            buyer_name="Snow Agri Mart", product_id=finished_flour.id,
            quantity=100, selling_price=45, discount=0, total_amount=4500,
            payment_mode="upi", invoice_id="M-INV-001",
            delivery_status="delivered", date=now - timedelta(days=10),
        )
        session.add(sale1)

        # Manufacturer expenses
        mfr_expenses = [
            ManufacturerExpense(manufacturer_id=mfr.id, category="electricity", amount=6000,
                                description="Monthly electricity for mill", expense_date=today - timedelta(days=2)),
            ManufacturerExpense(manufacturer_id=mfr.id, category="labour", amount=15000,
                                description="3 workers salary", expense_date=today),
            ManufacturerExpense(manufacturer_id=mfr.id, category="maintenance", amount=3500,
                                description="Grinding stone replacement", expense_date=today - timedelta(days=10)),
        ]
        session.add_all(mfr_expenses)

        # ──────────────────────────────────────────────────────────────
        # 8.  Customer Profile + Cart + Orders
        # ──────────────────────────────────────────────────────────────
        customer_profile = CustomerProfile(
            user_id=cust.id,
            father_name="Ned Stark",
            relation_type="S/O",
            id_number="ABCDE1234F",
            house_no="45",
            street="King's Road",
            village="Winterfell",
            district="Karnal",
            state="Haryana",
            pincode="132001",
            bank_name="ICICI Bank",
            account_number="99887766554433",
            ifsc_code="ICIC0001234",
        )
        session.add(customer_profile)

        # Cart items
        cart1 = Cart(customer_id=cust.id, product_id=prod1.id, quantity=2)
        cart2 = Cart(customer_id=cust.id, product_id=prod3.id, quantity=1)
        session.add_all([cart1, cart2])

        # Past customer order
        cust_order = CustomerOrder(
            customer_id=cust.id, total_amount=1880, status="delivered",
            created_at=now - timedelta(days=7),
        )
        session.add(cust_order)
        await session.flush()

        coi1 = CustomerOrderItem(
            order_id=cust_order.id, product_id=prod1.id, seller_id=shop.id,
            product_name=prod1.name, quantity=2, price=680,
        )
        coi2 = CustomerOrderItem(
            order_id=cust_order.id, product_id=prod3.id, seller_id=shop.id,
            product_name=prod3.name, quantity=1, price=520,
        )
        session.add_all([coi1, coi2])

        # ──────────────────────────────────────────────────────────────
        # 9.  Commit everything
        # ──────────────────────────────────────────────────────────────
        await session.commit()

        print()
        print("=" * 60)
        print("  SEED DATA INSERTED SUCCESSFULLY!")
        print("=" * 60)
        print(f"  Email   : {EMAIL}")
        print(f"  Password: {PASSWORD}")
        print()
        print("Accounts created:")
        print(f"   [FARMER]       (id={farmer.id})")
        print(f"   [SHOP]         (id={shop.id})")
        print(f"   [MANUFACTURER] (id={mfr.id})")
        print(f"   [CUSTOMER]     (id={cust.id})")
        print()
        print("Dummy data includes:")
        print("   - 4 crops (Wheat, Rice, Tomato, Sugarcane) with expenses & harvests")
        print("   - 6 shop products (fertilizers, pesticides, seeds) -- 5 active, 1 draft")
        print("   - 3 shop orders with items & expenses")
        print("   - 4 shop accounting entries (rent, labour, utilities, transport)")
        print("   - Manufacturer: 1 purchase, 1 production batch, 1 sale, 3 expenses")
        print("   - Customer: profile, 2 cart items, 1 past order (delivered)")
        print("   - Farmer & Shop & Mill & Customer profiles with addresses & bank details")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
