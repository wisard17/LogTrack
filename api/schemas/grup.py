from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from api.schemas.mahasiswa import MahasiswaResponse


class GrupBase(BaseModel):
    nama: str = Field(min_length=1, max_length=150)


class GrupCreate(GrupBase):
    pass


class GrupUpdate(GrupBase):
    pass


class GrupResponse(GrupBase):
    id: UUID
    created_at: datetime
    mahasiswa: list[MahasiswaResponse] = []

    model_config = ConfigDict(from_attributes=True)
