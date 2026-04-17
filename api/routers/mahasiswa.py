from uuid import UUID

from fastapi import APIRouter, HTTPException

from api.db_utils import execute_returning_one, fetch_all, fetch_one
from api.schemas.mahasiswa import MahasiswaCreate, MahasiswaResponse, MahasiswaUpdate

router = APIRouter(prefix="/mahasiswa", tags=["mahasiswa"])


@router.get("", response_model=list[MahasiswaResponse])
def list_mahasiswa(email: str | None = None, id: str | None = None) -> list[dict]:
    if email:
        if email.startswith("eq."):
            email = email[3:]
        return fetch_all(
            "SELECT id, nama, email, role, grup_id, created_at FROM mahasiswa WHERE email = :email",
            {"email": email},
        )
    if id:
        if id.startswith("eq."):
            id = id[3:]
        return fetch_all(
            "SELECT id, nama, email, role, grup_id, created_at FROM mahasiswa WHERE id = :id",
            {"id": id},
        )
    return fetch_all(
        """
        SELECT id, nama, email, role, grup_id, created_at
        FROM mahasiswa
        ORDER BY created_at DESC
        """
    )


@router.get("/{mahasiswa_id}", response_model=MahasiswaResponse)
def get_mahasiswa(mahasiswa_id: str) -> dict:
    mahasiswa = fetch_one(
        """
        SELECT id, nama, email, role, grup_id, created_at
        FROM mahasiswa
        WHERE id = :id
        """,
        {"id": mahasiswa_id},
    )
    if not mahasiswa:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return mahasiswa


@router.post("", response_model=MahasiswaResponse, status_code=201)
def create_mahasiswa(payload: MahasiswaCreate) -> dict:
    # Check if student already exists by email
    existing = fetch_one(
        "SELECT id, nama, email, role, grup_id, created_at FROM mahasiswa WHERE email = :email",
        {"email": payload.email},
    )
    if existing:
        # Update existing student if needed (e.g. name or role)
        # Convert UUID to str if present, otherwise keep None
        update_data = payload.model_dump()
        # Keep existing grup_id if payload doesn't provide one
        if not payload.grup_id:
            update_data["grup_id"] = str(existing.get("grup_id")) if existing.get("grup_id") else None
        else:
            update_data["grup_id"] = str(payload.grup_id)
        
        return execute_returning_one(
            """
            UPDATE mahasiswa
            SET id = :id, nama = :nama, role = :role, grup_id = :grup_id
            WHERE email = :email
            RETURNING id, nama, email, role, grup_id, created_at
            """,
            update_data,
        )

    # For new student
    insert_data = payload.model_dump()
    insert_data["grup_id"] = str(payload.grup_id) if payload.grup_id else None

    return execute_returning_one(
        """
        INSERT INTO mahasiswa (id, nama, email, role, grup_id)
        VALUES (:id, :nama, :email, :role, :grup_id)
        RETURNING id, nama, email, role, grup_id, created_at
        """,
        insert_data,
    )


@router.put("/{mahasiswa_id}", response_model=MahasiswaResponse)
def update_mahasiswa(mahasiswa_id: str, payload: MahasiswaUpdate) -> dict:
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
            "id": mahasiswa_id,
            **payload.model_dump(),
            "grup_id": str(payload.grup_id) if payload.grup_id else None,
        },
    )
    if not mahasiswa:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return mahasiswa


@router.delete("/{mahasiswa_id}")
def delete_mahasiswa(mahasiswa_id: str) -> dict[str, str]:
    deleted = fetch_one(
        """
        DELETE FROM mahasiswa
        WHERE id = :id
        RETURNING id
        """,
        {"id": mahasiswa_id},
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Mahasiswa tidak ditemukan")
    return {"message": "Mahasiswa berhasil dihapus"}
