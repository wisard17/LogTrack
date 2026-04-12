from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class MahasiswaBase(BaseModel):
    nama: str = Field(min_length=1, max_length=150)
    email: EmailStr
    role: Literal["student", "admin"] = "student"
    grup_id: UUID | None = None


class MahasiswaCreate(MahasiswaBase):
    pass


class MahasiswaUpdate(MahasiswaBase):
    pass


class MahasiswaResponse(MahasiswaBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
