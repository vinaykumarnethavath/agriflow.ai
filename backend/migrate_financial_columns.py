"""
Migration script to add missing financial columns to the crop table.
"""

import asyncio
from sqlalchemy import text
from app.database import engine

MIGRATIONS = [
    "ALTER TABLE crop ADD COLUMN IF NOT EXISTS actual_yield FLOAT DEFAULT 0.0",
    "ALTER TABLE crop ADD COLUMN IF NOT EXISTS selling_price_per_unit FLOAT DEFAULT 0.0",
    "ALTER TABLE crop ADD COLUMN IF NOT EXISTS total_revenue FLOAT DEFAULT 0.0",
    "ALTER TABLE crop ADD COLUMN IF NOT EXISTS total_cost FLOAT DEFAULT 0.0",
    "ALTER TABLE crop ADD COLUMN IF NOT EXISTS net_profit FLOAT DEFAULT 0.0",
    "ALTER TABLE cropexpense ADD COLUMN IF NOT EXISTS bill_url VARCHAR",
    "ALTER TABLE cropexpense ADD COLUMN IF NOT EXISTS notes VARCHAR",
]


async def run_migrations():
    async with engine.begin() as conn:
        for sql in MIGRATIONS:
            print(f"Running: {sql}")
            try:
                await conn.execute(text(sql))
                print("  -> Success")
            except Exception as e:
                print(f"  -> Error (may already exist): {e}")
    
    print("\n✅ Migration complete!")


if __name__ == "__main__":
    asyncio.run(run_migrations())
