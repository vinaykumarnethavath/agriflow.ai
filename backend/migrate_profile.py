import sqlite3
import os

db_path = r'c:\Users\vinay\OneDrive\Desktop\agri\backend\agrichain.db'

def update_db():
    if not os.path.exists(db_path):
        print("Database not found")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Add profile_picture_url column to farmerprofile
        cursor.execute("ALTER TABLE farmerprofile ADD COLUMN profile_picture_url VARCHAR")
        print("Added profile_picture_url column to farmerprofile")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("profile_picture_url column already exists")
        else:
            print(f"Error adding profile_picture_url: {e}")
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    update_db()
