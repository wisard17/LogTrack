from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from api.db import get_engine


def fetch_all(query: str, params: dict | None = None) -> list[dict]:
    engine = get_engine()
    with engine.begin() as connection:
        result = connection.execute(text(query), params or {})
        return [dict(row._mapping) for row in result]


def fetch_one(query: str, params: dict | None = None) -> dict | None:
    engine = get_engine()
    with engine.begin() as connection:
        result = connection.execute(text(query), params or {})
        row = result.first()
        return dict(row._mapping) if row else None


def execute_returning_one(query: str, params: dict) -> dict:
    engine = get_engine()
    try:
        with engine.begin() as connection:
            result = connection.execute(text(query), params)
            row = result.first()
            if not row:
                raise HTTPException(status_code=500, detail="Tidak ada data yang dikembalikan dari database")
            return dict(row._mapping)
    except IntegrityError as error:
        raise HTTPException(status_code=400, detail=f"Pelanggaran constraint database: {error.orig}") from error
