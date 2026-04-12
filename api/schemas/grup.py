from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GrupBase(BaseModel):
    nama: str = Field(min_length=1, max_length=150)


class GrupCreate(GrupBase):
    pass


class GrupUpdate(GrupBase):
    pass


class GrupResponse(GrupBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
