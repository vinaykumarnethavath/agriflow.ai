
import asyncio
import aiosqlite
import os

async def list_tables():
    db_path = "app/agrichain.db"
    print(f"Checking DB at: {os.path.abspath(db_path)}")
    if not os.path.exists(db_path):
        print("DB file does not exist!")
        return
        
    async with aiosqlite.connect(db_path) as db:
        async with db.execute("SELECT name FROM sqlite_master WHERE type='table';") as cursor:
            tables = await cursor.fetchall()
            print("Tables found:")
            for table in tables:
                print(f"  - {table[0]}")

if __name__ == "__main__":
    asyncio.run(list_tables())
