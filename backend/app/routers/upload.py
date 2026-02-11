from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import uuid

router = APIRouter(tags=["upload"])

UPLOAD_DIR = "uploads"

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    print(f"DEBUG: Received upload request for file: {file.filename}")
    try:
        # Generate a unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Return the URL (assuming local dev environment for now)
        # In production, this would be a full domain or CDN URL
        return {"url": f"http://127.0.0.1:8000/static/{unique_filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
