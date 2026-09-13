from uuid import UUID

from fastapi import APIRouter, HTTPException

from api.db_utils import execute_returning_one, fetch_all, fetch_one
from api.schemas.logbook import LogbookCreate, LogbookResponse, LogbookUpdate

router = APIRouter(prefix="/logbook", tags=["logbook"])


@router.get("", response_model=list[LogbookResponse])
def list_logbook(matakuliah_id: UUID, mahasiswa_id: str | None = None) -> list[dict]:
    return fetch_all(
        """
        SELECT l.id, l.week_number, l.description, l.evidence_url, l.evidence_name,
               l.evidence_type, l.mahasiswa_id, l.grup_id, l.matakuliah_id, l.created_at,
               row_to_json(m) AS mahasiswa
        FROM logbook l
        LEFT JOIN mahasiswa m ON m.id = l.mahasiswa_id
        WHERE l.matakuliah_id = :mk AND (:mahasiswa IS NULL OR l.mahasiswa_id = :mahasiswa
          OR l.grup_id IN (SELECT grup_id FROM peserta_matakuliah
                          WHERE mahasiswa_id = :mahasiswa AND matakuliah_id = :mk))
        ORDER BY l.created_at DESC
        """,
        {"mk": str(matakuliah_id), "mahasiswa": mahasiswa_id},
    )


@router.get("/{logbook_id}", response_model=LogbookResponse)
def get_logbook(logbook_id: UUID) -> dict:
    logbook = fetch_one(
        """
        SELECT id, week_number, description, evidence_url, evidence_name, evidence_type, mahasiswa_id, grup_id, matakuliah_id, created_at
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
    validate_membership(payload)
    return execute_returning_one(
        """
        INSERT INTO logbook (
            week_number,
            description,
            evidence_url,
            evidence_name,
            evidence_type,
            mahasiswa_id,
            grup_id,
            matakuliah_id
        )
        VALUES (
            :week_number,
            :description,
            :evidence_url,
            :evidence_name,
            :evidence_type,
            :mahasiswa_id,
            :grup_id,
            :matakuliah_id
        )
        RETURNING id, week_number, description, evidence_url, evidence_name, evidence_type, mahasiswa_id, grup_id, matakuliah_id, created_at
        """,
        {
            **payload.model_dump(),
            "mahasiswa_id": payload.mahasiswa_id,
            "grup_id": str(payload.grup_id),
            "matakuliah_id": str(payload.matakuliah_id),
        },
    )


@router.put("/{logbook_id}", response_model=LogbookResponse)
def update_logbook(logbook_id: UUID, payload: LogbookUpdate) -> dict:
    validate_membership(payload)
    logbook = fetch_one(
        """
        UPDATE logbook
        SET week_number = :week_number,
            description = :description,
            evidence_url = :evidence_url,
            evidence_name = :evidence_name,
            evidence_type = :evidence_type,
            mahasiswa_id = :mahasiswa_id,
            grup_id = :grup_id,
            matakuliah_id = :matakuliah_id
        WHERE id = :id
        RETURNING id, week_number, description, evidence_url, evidence_name, evidence_type, mahasiswa_id, grup_id, matakuliah_id, created_at
        """,
        {
            "id": str(logbook_id),
            **payload.model_dump(),
            "mahasiswa_id": payload.mahasiswa_id,
            "grup_id": str(payload.grup_id),
            "matakuliah_id": str(payload.matakuliah_id),
        },
    )
    if not logbook:
        raise HTTPException(status_code=404, detail="Logbook tidak ditemukan")
    return logbook


@router.delete("")
def delete_logbook(id: UUID) -> dict[str, str]:
    deleted = fetch_one(
        """
        DELETE FROM logbook
        WHERE id = :id
        RETURNING id
        """,
        {"id": str(id)},
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Logbook tidak ditemukan")
    return {"message": "Logbook berhasil dihapus"}


def validate_membership(payload: LogbookCreate | LogbookUpdate):
    if not fetch_one(
        "SELECT mahasiswa_id FROM peserta_matakuliah WHERE mahasiswa_id = :student AND matakuliah_id = :mk AND grup_id = :grup",
        {"student": payload.mahasiswa_id, "mk": str(payload.matakuliah_id), "grup": str(payload.grup_id)},
    ):
        raise HTTPException(400, "Mahasiswa tidak terdaftar dalam kelompok dan mata kuliah ini")
