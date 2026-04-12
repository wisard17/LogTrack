from uuid import UUID

from fastapi import APIRouter, HTTPException

from api.db_utils import execute_returning_one, fetch_all, fetch_one
from api.schemas.mahasiswa import MahasiswaCreate, MahasiswaResponse, MahasiswaUpdate

router = APIRouter(prefix="/mahasiswa", tags=["mahasiswa"])


@router.get("", response_model=list[MahasiswaResponse])
def list_mahasiswa() -> list[dict]:
    return fetch_all(
        """
        SELECT id, nama, email, role, grup_id, created_at
        FROM mahasiswa
        ORDER BY created_at DESC
        """
    )


@router.get("/{mahasiswa_id}", response_model=MahasiswaResponse)
def get_mahasiswa(mahasiswa_id: UUID) -> dict:
    mahasiswa = fetch_one(
        """
        SELECT id, nama, email, role, grup_id, created_at
        FROM mahasiswa
        WHERE id = :id
        """,
        {"id": str(mahasiswa_id)},
    )
    if not mahasiswa:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return mahasiswa


@router.post("", response_model=MahasiswaResponse, status_code=201)
def create_mahasiswa(payload: MahasiswaCreate) -> dict:
    return execute_returning_one(
        """
        INSERT INTO mahasiswa (nama, email, role, grup_id)
        VALUES (:nama, :email, :role, :grup_id)
        RETURNING id, nama, email, role, grup_id, created_at
        """,
        {
            **payload.model_dump(),
            "grup_id": str(payload.grup_id) if payload.grup_id else None,
        },
    )


@router.put("/{mahasiswa_id}", response_model=MahasiswaResponse)
def update_mahasiswa(mahasiswa_id: UUID, payload: MahasiswaUpdate) -> dict:
    mahasiswa = fetch_one(
        """
        UPDATE mahasiswa
        SET nama = :nama,
            email = :email,
            role = :role,
            grup_id = :grup_id
        WHERE id = :id
        RETURNING id, nama, email, role, grup_id, created_at
        """,
        {
            "id": str(mahasiswa_id),
            **payload.model_dump(),
            "grup_id": str(payload.grup_id) if payload.grup_id else None,
        },
    )
    if not mahasiswa:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return mahasiswa


@router.delete("/{mahasiswa_id}")
def delete_mahasiswa(mahasiswa_id: UUID) -> dict[str, str]:
    deleted = fetch_one(
        """
        DELETE FROM mahasiswa
        WHERE id = :id
        RETURNING id
        """,
        {"id": str(mahasiswa_id)},
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return {"message": "Mahasiswa berhasil dihapus"}
