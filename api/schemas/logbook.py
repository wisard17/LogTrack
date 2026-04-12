from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LogbookBase(BaseModel):
    week_number: int = Field(ge=1, le=52)
    description: str = Field(min_length=1)
    evidence_url: str = Field(min_length=1)
    evidence_name: str | None = Field(default=None, max_length=255)
    evidence_type: str | None = Field(default=None, max_length=100)
    mahasiswa_id: UUID
    grup_id: UUID


class LogbookCreate(LogbookBase):
    pass


class LogbookUpdate(LogbookBase):
    pass


class LogbookResponse(LogbookBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
