"""Persist course deadlines as atomic JSON files, independent of the database."""
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

CONFIG_DIR = Path(__file__).resolve().parent / "config" / "group_selection"


def config_path(course_id: UUID) -> Path:
    return CONFIG_DIR / f"{UUID(str(course_id))}.json"


def read_deadline(course_id: UUID) -> datetime | None:
    path = config_path(course_id)
    if not path.exists():
        return None
    value = json.loads(path.read_text(encoding="utf-8"))["deadline"]
    return datetime.fromisoformat(value) if value else None


def save_deadline(course_id: UUID, deadline: datetime | None) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    value = deadline.astimezone(timezone.utc).isoformat() if deadline else None
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=CONFIG_DIR,
                                         suffix=".tmp", delete=False) as file:
            temporary = file.name
            json.dump({"deadline": value}, file, indent=2)
        os.replace(temporary, config_path(course_id))
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def selection_status(course_id: UUID) -> dict:
    now = datetime.now(timezone.utc)
    deadline = read_deadline(course_id)
    return {"deadline": deadline, "server_now": now,
            "is_open": deadline is not None and now < deadline}
