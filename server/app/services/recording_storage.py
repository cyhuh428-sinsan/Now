from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings


def _safe_name(name: str) -> str:
    return Path(name).name.replace("\\", "_").replace("/", "_")


async def save_recording_file(
    owner_id: str,
    device_id: str,
    local_id: str,
    upload: UploadFile,
) -> tuple[str, str]:
    settings = get_settings()
    base = Path(settings.storage_dir) / owner_id / device_id
    base.mkdir(parents=True, exist_ok=True)

    file_name = f"{_safe_name(local_id)}_{uuid4().hex}_{_safe_name(upload.filename or 'audio.aac')}"
    target = base / file_name
    with target.open("wb") as output:
        while chunk := await upload.read(1024 * 1024):
            output.write(chunk)

    return file_name, str(target)
