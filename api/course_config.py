"""Active course flags persisted in one JSON configuration file."""
import json
import os
import tempfile
from pathlib import Path
from threading import Lock
from uuid import UUID

CONFIG_FILE = Path(__file__).resolve().parent / 'config' / 'matakuliah.json'
_lock = Lock()


def read_course_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    return json.loads(CONFIG_FILE.read_text(encoding='utf-8'))


def is_course_active(course_id, config=None) -> bool:
    flags = read_course_config() if config is None else config
    return flags.get(str(course_id), True) is True


def set_course_active(course_id: UUID, active: bool):
    with _lock:
        flags = read_course_config()
        flags[str(course_id)] = active
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=CONFIG_FILE.parent,
                                             suffix='.tmp', delete=False) as file:
                temporary = file.name
                json.dump(flags, file, indent=2)
            os.replace(temporary, CONFIG_FILE)
        finally:
            if temporary and os.path.exists(temporary):
                os.unlink(temporary)
