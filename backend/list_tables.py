import asyncio
from sqlalchemy import text
from app.database import engine

async def list_tables():
    async with engine.connect() as conn:
        print("--- Public Schema Tables ---")
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        for r in res:
            print(r[0])

if __name__ == "__main__":
    engine.echo = False
    asyncio.run(list_tables())
