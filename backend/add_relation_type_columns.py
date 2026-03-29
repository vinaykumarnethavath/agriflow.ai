import asyncio
from sqlalchemy import text
from app.database import engine

async def main():
    async with engine.begin() as conn:
        tables_to_update = ['shop_profiles', 'mill_profiles', 'customer_profiles']
        
        for table_name in tables_to_update:
            try:
                # Add column if not exists
                result = await conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{table_name}' AND column_name='relation_type';"))
                if not result.fetchone():
                    await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN relation_type VARCHAR DEFAULT 'S/O';"))
                    print(f"Added relation_type to {table_name}")
                else:
                    print(f"relation_type already exists in {table_name}")
            except Exception as e:
                print(f"Error updating {table_name}: {e}")

        # For farmer_profiles, ensure it has relation_type
        try:
            result = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='farmerprofile' AND column_name='relation_type';"))
            if not result.fetchone():
                await conn.execute(text("ALTER TABLE farmerprofile ADD COLUMN relation_type VARCHAR DEFAULT 'S/O';"))
                print("Added relation_type to farmerprofile")
            else:
                print("relation_type already exists in farmerprofile")
        except Exception as e:
            print(f"Error updating farmerprofile: {e}")

if __name__ == '__main__':
    asyncio.run(main())
