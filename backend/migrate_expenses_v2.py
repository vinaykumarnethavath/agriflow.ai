from sqlalchemy import create_engine, text
from app.database import DATABASE_URL

def migrate():
    # Fix for SQLite async driver
    sync_url = DATABASE_URL.replace("postgresql+asyncpg", "postgresql").replace("sqlite+aiosqlite", "sqlite")
    engine = create_engine(sync_url)
    with engine.connect() as conn:
        print("Migrating CropExpense Table (v2)...")
        columns = [
             ("unit_size", "FLOAT DEFAULT 1.0"),
             ("duration", "FLOAT DEFAULT 1.0"),
             ("stage", "VARCHAR DEFAULT 'General'"),
             ("bill_url", "VARCHAR DEFAULT NULL"),
             ("notes", "VARCHAR DEFAULT NULL")
        ]
        
        for col, dtype in columns:
            try:
                conn.execute(text(f"ALTER TABLE cropexpense ADD COLUMN {col} {dtype}"))
                print(f"Added {col}")
            except Exception as e:
                print(f"{col} might exist: {e}")

        conn.commit()
        print("Migration v2 complete.")

if __name__ == "__main__":
    migrate()
