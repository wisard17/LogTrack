from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from api.db_utils import fetch_all, fetch_one, execute_returning_one
from api.group_selection_config import save_deadline, selection_status

router = APIRouter(prefix="/matakuliah", tags=["matakuliah"])


class MatakuliahCreate(BaseModel):
    nama: str = Field(min_length=1, max_length=150)

    @field_validator("nama", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class PesertaUpdate(BaseModel):
    grup_id: UUID | None = None


class SelectionDeadline(BaseModel):
    deadline: datetime | None = None

    @field_validator("deadline")
    @classmethod
    def require_timezone(cls, value):
        if value is not None and value.utcoffset() is None:
            raise ValueError("Deadline harus menyertakan zona waktu")
        return value


class SelectGroup(BaseModel):
    grup_id: UUID


@router.get("/{matakuliah_id}/group-selection")
def get_group_selection(matakuliah_id: UUID):
    return selection_status(matakuliah_id)


@router.put("/{matakuliah_id}/group-selection")
def set_group_selection(matakuliah_id: UUID, payload: SelectionDeadline):
    if not fetch_one("SELECT id FROM matakuliah WHERE id = :id", {"id": str(matakuliah_id)}):
        raise HTTPException(404, "Mata kuliah tidak ditemukan")
    save_deadline(matakuliah_id, payload.deadline)
    return selection_status(matakuliah_id)


@router.post("/{matakuliah_id}/peserta/{mahasiswa_id}/pilih-kelompok")
def select_group(matakuliah_id: UUID, mahasiswa_id: str, payload: SelectGroup):
    if not selection_status(matakuliah_id)["is_open"]:
        raise HTTPException(403, "Pemilihan kelompok belum dibuka atau deadline sudah lewat")
    # A single conditional UPDATE prevents simultaneous choices from replacing a group.
    result = fetch_one(
        """UPDATE peserta_matakuliah p SET grup_id = :grup
           WHERE p.mahasiswa_id = :mahasiswa AND p.matakuliah_id = :mk
             AND p.grup_id IS NULL
             AND EXISTS (SELECT 1 FROM grup g WHERE g.id = :grup AND g.matakuliah_id = :mk)
           RETURNING mahasiswa_id, matakuliah_id, grup_id""",
        {"mahasiswa": mahasiswa_id, "mk": str(matakuliah_id), "grup": str(payload.grup_id)},
    )
    if not result:
        raise HTTPException(409, "Pilihan tidak dapat disimpan. Pastikan Anda terdaftar pada MK, belum memiliki kelompok, dan memilih kelompok pada MK ini.")
    return result


@router.get("")
def list_matakuliah(mahasiswa_id: str | None = None):
    return fetch_all(
        """SELECT mk.id, mk.nama, mk.created_at,
            COALESCE((SELECT json_agg(p.mahasiswa_id) FROM peserta_matakuliah p
                      WHERE p.matakuliah_id = mk.id), '[]'::json) AS members
           FROM matakuliah mk
           WHERE (:mahasiswa_id IS NULL OR EXISTS (
             SELECT 1 FROM peserta_matakuliah p
             WHERE p.matakuliah_id = mk.id AND p.mahasiswa_id = :mahasiswa_id))
           ORDER BY mk.nama""",
        {"mahasiswa_id": mahasiswa_id},
    )


@router.post("", status_code=201)
def create_matakuliah(payload: MatakuliahCreate):
    return execute_returning_one(
        "INSERT INTO matakuliah (nama) VALUES (:nama) RETURNING id, nama, created_at",
        {"nama": payload.nama.strip()},
    )


@router.put("/{matakuliah_id}")
def rename_matakuliah(matakuliah_id: UUID, payload: MatakuliahCreate):
    result = fetch_one(
        "UPDATE matakuliah SET nama = :nama WHERE id = :id RETURNING id, nama",
        {"id": str(matakuliah_id), "nama": payload.nama.strip()},
    )
    if not result:
        raise HTTPException(404, "Mata kuliah tidak ditemukan")
    return result


@router.put("/{matakuliah_id}/peserta/{mahasiswa_id}")
def update_peserta(matakuliah_id: UUID, mahasiswa_id: str, payload: PesertaUpdate):
    if payload.grup_id and not fetch_one(
        "SELECT id FROM grup WHERE id = :id AND matakuliah_id = :mk",
        {"id": str(payload.grup_id), "mk": str(matakuliah_id)},
    ):
        raise HTTPException(400, "Kelompok tidak termasuk mata kuliah ini")
    return execute_returning_one(
        """INSERT INTO peserta_matakuliah (mahasiswa_id, matakuliah_id, grup_id)
           VALUES (:mahasiswa, :mk, :grup)
           ON CONFLICT (mahasiswa_id, matakuliah_id) DO UPDATE SET grup_id = EXCLUDED.grup_id
           RETURNING mahasiswa_id, matakuliah_id, grup_id""",
        {"mahasiswa": mahasiswa_id, "mk": str(matakuliah_id),
         "grup": str(payload.grup_id) if payload.grup_id else None},
    )
