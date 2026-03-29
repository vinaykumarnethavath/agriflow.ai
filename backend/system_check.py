import asyncio
from sqlalchemy import text
from app.database import engine
import json

async def check_everything():
    print("--- SYSTEM CHECK ---")
    
    # 1. Database Check
    print("\n[DATABASE CHECK]")
    try:
        async with engine.connect() as conn:
            # Check Tables
            res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
            tables = [r[0] for r in res]
            print(f"Tables found: {tables}")
            
            # Check shop_orders columns
            if 'shop_orders' in tables:
                res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'shop_orders'"))
                print("\nColumns in 'shop_orders':")
                for r in res:
                    print(f"  - {r[0]} ({r[1]})")
            
            # Check shop_expenses columns
            if 'shop_expenses' in tables:
                res = await conn.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'shop_expenses'"))
                print("\nColumns in 'shop_expenses':")
                for r in res:
                    print(f"  - {r[0]} ({r[1]})")
                    
            # Check recent data
            print("\nRecent 'shop_orders' data:")
            try:
                res = await conn.execute(text("SELECT id, total_amount, total_expenses, profit, status FROM shop_orders ORDER BY id DESC LIMIT 5"))
                for r in res:
                    print(f"  ID: {r[0]} | Amt: {r[1]} | Exp: {r[2]} | Profit: {r[3]} | Status: {r[4]}")
            except Exception as e:
                print(f"  Error fetching records: {e}")
                
    except Exception as e:
        print(f"CRITICAL: Database connection failed: {e}")

if __name__ == "__main__":
    engine.echo = False
    asyncio.run(check_everything())
