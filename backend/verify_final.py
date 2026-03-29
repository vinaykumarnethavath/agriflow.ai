import asyncio
from sqlalchemy import text
from app.database import engine

async def verify():
    async with engine.connect() as conn:
        print("--- Database Verification ---")
        tables = ['user', 'crop', 'product', 'shop_orders']
        for table in tables:
            try:
                table_query = f'"{table}"' if table == 'user' else table
                res = await conn.execute(text(f"SELECT count(*) FROM {table_query}"))
                print(f"Table {table:15} : {res.scalar()} rows")
            except Exception as e:
                print(f"Table {table:15} : Error")

if __name__ == "__main__":
    asyncio.run(verify())
