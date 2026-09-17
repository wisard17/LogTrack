from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from api.db_utils import fetch_all, fetch_one, execute_returning_one
from api.group_selection_config import save_deadline, selection_status
from api.course_config import read_course_config, is_course_active, set_course_active

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


class CourseStatus(BaseModel):
    active: bool


@router.put("/{matakuliah_id}/status")
def update_course_status(matakuliah_id: UUID, payload: CourseStatus):
    if not fetch_one("SELECT id FROM matakuliah WHERE id = :id", {"id": str(matakuliah_id)}):
        raise HTTPException(404, "Mata kuliah tidak ditemukan")
    set_course_active(matakuliah_id, payload.active)
    return {"active": payload.active}


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
    # Enroll and join atomically; concurrent requests cannot replace an existing group.
    result = fetch_one(
        """INSERT INTO peserta_matakuliah (mahasiswa_id, matakuliah_id, grup_id)
           SELECT m.id, g.matakuliah_id, g.id
           FROM mahasiswa m CROSS JOIN grup g
           WHERE m.id = :mahasiswa AND g.id = :grup AND g.matakuliah_id = :mk
           ON CONFLICT (mahasiswa_id, matakuliah_id)
           DO UPDATE SET grup_id = EXCLUDED.grup_id
           WHERE peserta_matakuliah.grup_id IS NULL
           RETURNING mahasiswa_id, matakuliah_id, grup_id""",
        {"mahasiswa": mahasiswa_id, "mk": str(matakuliah_id), "grup": str(payload.grup_id)},
    )
    if not result:
        raise HTTPException(409, "Pilihan tidak dapat disimpan. Anda sudah memiliki kelompok, kelompok tidak sesuai MK, atau profil mahasiswa belum tersedia. Muat ulang halaman untuk memperbarui data.")
    return result


@router.get("")
def list_matakuliah(mahasiswa_id: str | None = None, include_available: bool = False):
    courses = fetch_all(
        """SELECT mk.id, mk.nama, mk.created_at,
            COALESCE((SELECT json_agg(p.mahasiswa_id) FROM peserta_matakuliah p
                      WHERE p.matakuliah_id = mk.id), '[]'::json) AS members
           FROM matakuliah mk
           WHERE (:mahasiswa_id IS NULL OR EXISTS (
             SELECT 1 FROM peserta_matakuliah p
             WHERE p.matakuliah_id = mk.id AND p.mahasiswa_id = :mahasiswa_id))
           ORDER BY mk.nama""",
        {"mahasiswa_id": None if include_available else mahasiswa_id},
    )
    config = read_course_config()
    for course in courses:
        course['active'] = is_course_active(course['id'], config)
    if mahasiswa_id and include_available:
        courses = [course for course in courses if course['active'] and (
            mahasiswa_id in course['members'] or selection_status(course['id'])['is_open'])]
        courses.sort(key=lambda course: mahasiswa_id not in course['members'])
    return courses


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
