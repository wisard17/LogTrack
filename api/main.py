from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(grup_router)
app.include_router(mahasiswa_router)
app.include_router(logbook_router)


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
