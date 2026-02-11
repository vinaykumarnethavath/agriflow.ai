
import asyncio
from sqlmodel import create_engine, text
from app.database import DATABASE_URL

# Sync engine for migration
engine = create_engine(DATABASE_URL.replace("postgresql+asyncpg", "postgresql"))

def migrate():
    with engine.connect() as conn:
        print("Migrating Crop Table...")
        try:
            conn.execute(text("ALTER TABLE crop ADD COLUMN actual_yield FLOAT DEFAULT 0.0"))
            print("Added actual_yield")
        except Exception as e:
            print(f"actual_yield might exist: {e}")

        try:
            conn.execute(text("ALTER TABLE crop ADD COLUMN selling_price_per_unit FLOAT DEFAULT 0.0"))
            print("Added selling_price_per_unit")
        except Exception as e:
            print(f"selling_price_per_unit might exist: {e}")

        try:
            conn.execute(text("ALTER TABLE crop ADD COLUMN total_revenue FLOAT DEFAULT 0.0"))
            print("Added total_revenue")
        except Exception as e:
            print(f"total_revenue might exist: {e}")

        try:
            conn.execute(text("ALTER TABLE crop ADD COLUMN total_cost FLOAT DEFAULT 0.0"))
            print("Added total_cost")
        except Exception as e:
            print(f"total_cost might exist: {e}")

        try:
            conn.execute(text("ALTER TABLE crop ADD COLUMN net_profit FLOAT DEFAULT 0.0"))
            print("Added net_profit")
        except Exception as e:
            print(f"net_profit might exist: {e}")
            
        print("Migrating CropExpense Table...")
        # Check CropExpense columns based on new requirements
        # category, type, quantity, unit, unit_cost, total_cost, date, payment_mode, bill_url
        
        try:
            conn.execute(text("ALTER TABLE cropexpense ADD COLUMN unit VARCHAR DEFAULT ''"))
            print("Added unit")
        except Exception as e:
            print(f"unit might exist: {e}")
            
        try:
            conn.execute(text("ALTER TABLE cropexpense ADD COLUMN payment_mode VARCHAR DEFAULT 'Cash'"))
            print("Added payment_mode")
        except Exception as e:
            print(f"payment_mode might exist: {e}")

        conn.commit()
        print("Migration complete.")

if __name__ == "__main__":
    migrate()
