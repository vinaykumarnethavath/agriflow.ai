import asyncio
from sqlmodel import Session, select
from app.database import engine
from app.models import Product, User
from app.routers.auth import get_password_hash

async def seed_products():
    async with Session(engine) as session:
        # Create a dummy shop owner if not exists
        statement = select(User).where(User.email == "shop@agri.com")
        result = session.exec(statement)
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
            
        # Check for existing products
        statement = select(Product)
        results = session.exec(statement)
        existing_products = results.all()
        
        if existing_products:
            print(f"Found {len(existing_products)} existing products. Skipping seed.")
            return

        print("Seeding dummy products...")
        products = [
            Product(
                name="DAP (Di-Ammonium Phosphate)",
                short_name="DAP",
                category="fertilizer",
                price=1350.0,
                quantity=100,
                batch_number="B-101",
                description="High phosphorus fertilizer for root development.",
                user_id=shop_user.id
            ),
            Product(
                name="MOP (Muriate of Potash)",
                short_name="MOP",
                category="fertilizer",
                price=1700.0,
                quantity=50,
                batch_number="B-102",
                description="Potassium source for crop quality and disease resistance.",
                user_id=shop_user.id
            ),
            Product(
                name="Urea (Neem Coated)",
                short_name="Urea",
                category="fertilizer",
                price=266.50,
                quantity=200,
                batch_number="B-103",
                description="Nitrogen fertilizer for vegetative growth.",
                user_id=shop_user.id
            ),
            Product(
                name="NPK 19:19:19",
                short_name="NPK",
                category="fertilizer",
                price=1200.0,
                quantity=80,
                batch_number="B-104",
                description="Balanced water soluble fertilizer.",
                user_id=shop_user.id
            ),
            Product(
                name="Zinc Sulphate",
                short_name="ZnSO4",
                category="fertilizer",
                price=80.0,
                quantity=150,
                batch_number="B-105",
                description="Essential micronutrient for zinc deficiency.",
                user_id=shop_user.id
            ),
             Product(
                name="Roundup (Glyphosate)",
                short_name="Roundup",
                category="pesticide",
                price=450.0,
                quantity=40,
                batch_number="P-201",
                description="Systemic herbicide for weed control.",
                user_id=shop_user.id
            ),
            Product(
                name="Cotton Seeds (Bt)",
                short_name="Cotton",
                category="seeds",
                price=850.0,
                quantity=60,
                batch_number="S-301",
                description="High yielding Bt Cotton seeds.",
                user_id=shop_user.id
            )
        ]
        
        for p in products:
            session.add(p)
        
        session.commit()
        print("Seeded products successfully!")

if __name__ == "__main__":
    asyncio.run(seed_products())
