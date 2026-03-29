import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

async def run():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [r[0] for r in res]
        print(f"Tables: {tables}\n")
        
        for t in tables:
            res = await conn.execute(text(f'SELECT count(*) FROM "{t}"'))
            count = res.scalar()
            print(f"Table: {t:20} | Rows: {count}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run())
