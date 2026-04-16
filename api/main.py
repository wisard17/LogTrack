from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import uuid
import shutil
from pathlib import Path

from api.db import test_connection
from api.routers.grup import router as grup_router
from api.routers.logbook import router as logbook_router
from api.routers.mahasiswa import router as mahasiswa_router

app = FastAPI(
    title="Logbook API",
    description="Backend API untuk aplikasi Logbook",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(grup_router)
app.include_router(mahasiswa_router)
app.include_router(logbook_router)

# Setup static files directory
UPLOAD_DIR = Path("api/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Create unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename

    # Save file to local storage
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Return local access URL
    # Assuming the API runs on API_BASE_URL (http://localhost:8000)
    # The client can use this URL to access the file
    return {
        "filename": file.filename,
        "url": f"http://localhost:8000/uploads/{unique_filename}",
        "unique_filename": unique_filename
    }


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "logbook-api",
        "status": "ok",
        "message": "backend berjalan",
    }


@app.get("/db/connect")
def db_connect() -> dict[str, str]:
    try:
        test_connection()
        return {
            "status": "connected",
            "database": "postgresql",
            "message": "Koneksi PostgreSQL berhasil",
        }
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Gagal koneksi PostgreSQL: {error}") from error
