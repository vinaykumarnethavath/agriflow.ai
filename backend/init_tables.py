from sqlmodel import SQLModel, create_engine
from app.database import DATABASE_URL
from app.models import * # Import all models to ensure they are registered

def init_db():
    engine = create_engine(DATABASE_URL.replace("postgresql+asyncpg", "postgresql"))
    SQLModel.metadata.create_all(engine)
    print("Tables initialized.")

if __name__ == "__main__":
    init_db()
