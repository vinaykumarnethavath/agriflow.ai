
import asyncio
import aiosqlite
import os

async def list_tables():
    db_paths = ["agri.db", "agrichain.db", "app/agrichain.db"]
    for db_path in db_paths:
        print(f"\nChecking DB at: {os.path.abspath(db_path)}")
        if not os.path.exists(db_path):
            print("DB file does not exist!")
            continue
            
        async with aiosqlite.connect(db_path) as db:
            async with db.execute("SELECT name FROM sqlite_master WHERE type='table';") as cursor:
                tables = await cursor.fetchall()
                print("Tables found:")
                for table in tables:
                    print(f"  - {table[0]}")
                    if table[0] == "shop_orders":
                        async with db.execute("SELECT status, count(*) FROM shop_orders GROUP BY status;") as c2:
                            counts = await c2.fetchall()
                            for s, ct in counts:
                                print(f"    * {s}: {ct}")

if __name__ == "__main__":
    asyncio.run(list_tables())
