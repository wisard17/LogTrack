from fastapi import FastAPI, HTTPException, UploadFile, File, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import os
import uuid
import shutil
import secrets
from pathlib import Path

from api.db import test_connection
from api.routers.grup import router as grup_router
from api.routers.logbook import router as logbook_router
from api.routers.mahasiswa import router as mahasiswa_router
from fastapi import Depends

app = FastAPI(
    title="Logbook API",
    description="Backend API untuk aplikasi Logbook",
    version="0.1.0",
)

# Initialize CSRF Protection
CSRF_SECRET = secrets.token_urlsafe(32)
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_COOKIE_NAME = "csrf_token"

class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Allow /csrf-token and / without CSRF
        if request.url.path in ["/csrf-token", "/"]:
            return await call_next(request)

        csrf_token_header = request.headers.get(CSRF_HEADER_NAME)
        csrf_token_cookie = request.cookies.get(CSRF_COOKIE_NAME)

        # Jika cookie CSRF valid (dikirim otomatis oleh browser).
        if request.url.path.startswith("/uploads/"):
            if csrf_token_cookie:
                return await call_next(request)
            else:
                return Response(content="Access denied: Missing CSRF cookie", status_code=403)

        # Check CSRF for all other methods/paths (wajib header + cookie match)
        if not csrf_token_header or not csrf_token_cookie or csrf_token_header != csrf_token_cookie:
            return Response(
                content="CSRF token validation failed", 
                status_code=403
            )
        
        response = await call_next(request)
        return response

app.add_middleware(CSRFMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://logbook.wisard17.my.id",
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

@app.get("/csrf-token")
async def get_csrf_token(response: Response):
    token = secrets.token_urlsafe(32)
    response.set_cookie(
        key=CSRF_COOKIE_NAME, 
        value=token, 
        httponly=False, # Accessible by JS to be sent in header
        samesite="lax"
    )
    return {CSRF_HEADER_NAME: token}

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
    # Use relative path to allow frontend proxy handling if needed
    return {
        "filename": file.filename,
        "url": f"/uploads/{unique_filename}",
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
