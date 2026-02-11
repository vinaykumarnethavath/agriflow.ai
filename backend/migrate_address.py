import sqlite3
import os

db_path = r'c:\Users\vinay\OneDrive\Desktop\agri\backend\agrichain.db'

def update_db():
    if not os.path.exists(db_path):
        print("Database not found")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    columns_to_add = [
        ("house_no", "VARCHAR"),
        ("street", "VARCHAR"),
        ("village", "VARCHAR"),
        ("mandal", "VARCHAR"),
        ("district", "VARCHAR"),
        ("state", "VARCHAR"),
        ("country", "VARCHAR DEFAULT 'India'"),
        ("pincode", "VARCHAR")
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE farmerprofile ADD COLUMN {col_name} {col_type}")
            print(f"Added {col_name} column to farmerprofile")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"{col_name} column already exists")
            else:
                print(f"Error adding {col_name}: {e}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    update_db()
