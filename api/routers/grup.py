from uuid import UUID

from fastapi import APIRouter, HTTPException

from api.db_utils import execute_returning_one, fetch_all, fetch_one
from api.schemas.grup import GrupCreate, GrupResponse, GrupUpdate

router = APIRouter(prefix="/grup", tags=["grup"])


@router.get("", response_model=list[GrupResponse])
def list_grup() -> list[dict]:
    return fetch_all("SELECT id, nama, created_at FROM grup ORDER BY created_at DESC")


@router.get("/{grup_id}", response_model=GrupResponse)
def get_grup(grup_id: UUID) -> dict:
    grup = fetch_one(
        "SELECT id, nama, created_at FROM grup WHERE id = :id",
        {"id": str(grup_id)},
    )
    if not grup:
        raise HTTPException(status_code=404, detail="Grup tidak ditemukan")
    return grup


@router.post("", response_model=GrupResponse, status_code=201)
def create_grup(payload: GrupCreate) -> dict:
    return execute_returning_one(
        """
        INSERT INTO grup (nama)
        VALUES (:nama)
        RETURNING id, nama, created_at
        """,
        payload.model_dump(),
    )


@router.put("/{grup_id}", response_model=GrupResponse)
def update_grup(grup_id: UUID, payload: GrupUpdate) -> dict:
    grup = fetch_one(
        """
        UPDATE grup
        SET nama = :nama
        WHERE id = :id
        RETURNING id, nama, created_at
        """,
        {"id": str(grup_id), **payload.model_dump()},
    )
    if not grup:
        raise HTTPException(status_code=404, detail="Grup tidak ditemukan")
    return grup


@router.delete("/{grup_id}")
def delete_grup(grup_id: UUID) -> dict[str, str]:
    deleted = fetch_one(
        """
        DELETE FROM grup
        WHERE id = :id
        RETURNING id
        """,
        {"id": str(grup_id)},
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Grup tidak ditemukan")
    return {"message": "Grup berhasil dihapus"}
