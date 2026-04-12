from uuid import UUID

from fastapi import APIRouter, HTTPException

from api.db_utils import execute_returning_one, fetch_all, fetch_one
from api.schemas.logbook import LogbookCreate, LogbookResponse, LogbookUpdate

router = APIRouter(prefix="/logbook", tags=["logbook"])


@router.get("", response_model=list[LogbookResponse])
def list_logbook() -> list[dict]:
    return fetch_all(
        """
        SELECT id, week_number, description, evidence_url, evidence_name, evidence_type, mahasiswa_id, grup_id, created_at
        FROM logbook
        ORDER BY created_at DESC
        """
    )


@router.get("/{logbook_id}", response_model=LogbookResponse)
def get_logbook(logbook_id: UUID) -> dict:
    logbook = fetch_one(
        """
        SELECT id, week_number, description, evidence_url, evidence_name, evidence_type, mahasiswa_id, grup_id, created_at
        FROM logbook
        WHERE id = :id
        """,
        {"id": str(logbook_id)},
    )
    if not logbook:
        raise HTTPException(status_code=404, detail="Logbook tidak ditemukan")
    return logbook


@router.post("", response_model=LogbookResponse, status_code=201)
def create_logbook(payload: LogbookCreate) -> dict:
    return execute_returning_one(
        """
        INSERT INTO logbook (
            week_number,
            description,
            evidence_url,
            evidence_name,
            evidence_type,
            mahasiswa_id,
            grup_id
        )
        VALUES (
            :week_number,
            :description,
            :evidence_url,
            :evidence_name,
            :evidence_type,
            :mahasiswa_id,
            :grup_id
        )
        RETURNING id, week_number, description, evidence_url, evidence_name, evidence_type, mahasiswa_id, grup_id, created_at
        """,
        {
            **payload.model_dump(),
            "mahasiswa_id": str(payload.mahasiswa_id),
            "grup_id": str(payload.grup_id),
        },
    )


@router.put("/{logbook_id}", response_model=LogbookResponse)
def update_logbook(logbook_id: UUID, payload: LogbookUpdate) -> dict:
    logbook = fetch_one(
        """
        UPDATE logbook
        SET week_number = :week_number,
            description = :description,
            evidence_url = :evidence_url,
            evidence_name = :evidence_name,
            evidence_type = :evidence_type,
            mahasiswa_id = :mahasiswa_id,
            grup_id = :grup_id
        WHERE id = :id
        RETURNING id, week_number, description, evidence_url, evidence_name, evidence_type, mahasiswa_id, grup_id, created_at
        """,
        {
            "id": str(logbook_id),
            **payload.model_dump(),
            "mahasiswa_id": str(payload.mahasiswa_id),
            "grup_id": str(payload.grup_id),
        },
    )
    if not logbook:
        raise HTTPException(status_code=404, detail="Logbook tidak ditemukan")
    return logbook


@router.delete("/{logbook_id}")
def delete_logbook(logbook_id: UUID) -> dict[str, str]:
    deleted = fetch_one(
        """
        DELETE FROM logbook
        WHERE id = :id
        RETURNING id
        """,
        {"id": str(logbook_id)},
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Logbook tidak ditemukan")
    return {"message": "Logbook berhasil dihapus"}
