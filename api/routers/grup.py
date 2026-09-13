from uuid import UUID

from fastapi import APIRouter, HTTPException

from api.db_utils import execute_returning_one, fetch_all, fetch_one
from api.schemas.grup import GrupCreate, GrupResponse, GrupUpdate

router = APIRouter(prefix="/grup", tags=["grup"])


@router.get("", response_model=list[GrupResponse])
def list_grup(id: str | None = None, nama: str | None = None, matakuliah_id: UUID | None = None) -> list[dict]:
    query = "SELECT id, nama, matakuliah_id, created_at FROM grup"
    params = {}
    if id:
        if id.startswith("eq."):
            id = id[3:]
        query += " WHERE id = :id"
        params["id"] = id
    elif nama:
        if nama.startswith("eq."):
            nama = nama[3:]
        query += " WHERE nama = :nama"
        params["nama"] = nama
    
    if matakuliah_id:
        query += " AND" if params else " WHERE"
        query += " matakuliah_id = :mk"
        params["mk"] = str(matakuliah_id)
    query += " ORDER BY created_at DESC"
    
    groups = fetch_all(query, params)
    for group in groups:
        mahasiswa = fetch_all(
            "SELECT m.id, m.nama, m.email, m.role, p.grup_id, m.created_at FROM mahasiswa m JOIN peserta_matakuliah p ON p.mahasiswa_id = m.id WHERE p.grup_id = :grup_id",
            {"grup_id": str(group["id"])},
        )
        group["mahasiswa"] = mahasiswa
    return groups


@router.get("/{grup_id}", response_model=GrupResponse)
def get_grup(grup_id: UUID) -> dict:
    grup = fetch_one(
        "SELECT id, nama, matakuliah_id, created_at FROM grup WHERE id = :id",
        {"id": str(grup_id)},
    )
    if not grup:
        raise HTTPException(status_code=404, detail="Grup tidak ditemukan")
    return grup


@router.post("", response_model=GrupResponse, status_code=201)
def create_grup(payload: GrupCreate) -> dict:
    # Check if group already exists by name
    existing = fetch_one(
        "SELECT id, nama, matakuliah_id, created_at FROM grup WHERE nama = :nama AND matakuliah_id = :matakuliah_id",
        {"nama": payload.nama, "matakuliah_id": str(payload.matakuliah_id)},
    )
    if existing:
        return existing

    return execute_returning_one(
        """
        INSERT INTO grup (nama, matakuliah_id)
        VALUES (:nama, :matakuliah_id)
        RETURNING id, nama, matakuliah_id, created_at
        """,
        {**payload.model_dump(), "matakuliah_id": str(payload.matakuliah_id)},
    )


@router.put("/{grup_id}", response_model=GrupResponse)
def update_grup(grup_id: UUID, payload: GrupUpdate) -> dict:
    grup = fetch_one(
        """
        UPDATE grup
        SET nama = :nama
        WHERE id = :id AND matakuliah_id = :matakuliah_id
        RETURNING id, nama, matakuliah_id, created_at
        """,
        {"id": str(grup_id), **payload.model_dump(), "matakuliah_id": str(payload.matakuliah_id)},
    )
    if not grup:
        raise HTTPException(status_code=404, detail="Grup tidak ditemukan")
    return grup


@router.delete("/{grup_id}")
def delete_grup(grup_id: UUID) -> dict[str, str]:
    if fetch_one("SELECT id FROM logbook WHERE grup_id = :id LIMIT 1", {"id": str(grup_id)}):
        raise HTTPException(400, "Kelompok masih memiliki logbook")
    deleted = fetch_one(
        """
        WITH cleared AS (UPDATE peserta_matakuliah SET grup_id = NULL WHERE grup_id = :id)
        DELETE FROM grup
        WHERE id = :id
        RETURNING id
        """,
        {"id": str(grup_id)},
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Grup tidak ditemukan")
    return {"message": "Grup berhasil dihapus"}
