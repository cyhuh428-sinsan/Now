from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import get_settings
from app.services.attachment_storage import (
    file_extension,
    resolve_storage_path,
    safe_name,
    stream_save_upload,
)


IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}


def is_image_extension(extension: str | None) -> bool:
    return (extension or "").strip().lower().lstrip(".") in IMAGE_EXTENSIONS


def messenger_upload_policy() -> dict:
    settings = get_settings()
    extensions = sorted(
        {
            item.strip().lower().lstrip(".")
            for item in settings.messenger_allowed_extensions.split(",")
            if item.strip()
        }
    )
    mime_types = sorted(
        {
            item.strip().lower()
            for item in settings.messenger_allowed_mime_types.split(",")
            if item.strip()
        }
    )
    return {
        "max_size_bytes": max(1, settings.messenger_max_upload_mb) * 1024 * 1024,
        "allowed_extensions": extensions,
        "allowed_mime_types": mime_types,
        "image_extensions": sorted(IMAGE_EXTENSIONS.intersection(extensions)),
    }


async def save_messenger_attachment(
    *,
    group_name: str,
    room_id: int,
    owner_id: str,
    upload: UploadFile,
) -> dict:
    policy = messenger_upload_policy()
    original_name = _safe_name(upload.filename or "attachment")
    extension = _extension(original_name)
    if extension not in set(policy["allowed_extensions"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"reason": "extension_not_allowed", "message": "file extension not allowed"},
        )
    content_type = (upload.content_type or "application/octet-stream").split(";", 1)[0].strip().lower()
    if content_type not in set(policy["allowed_mime_types"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"reason": "mime_type_not_allowed", "message": "file mime type not allowed"},
        )

    settings = get_settings()
    base = Path(settings.messenger_storage_dir) / _safe_name(group_name) / str(room_id)
    base.mkdir(parents=True, exist_ok=True)

    storage_key = f"{uuid4().hex}.{extension}"
    target = base / storage_key
    size, digest_hex = await stream_save_upload(
        upload=upload,
        target=target,
        max_size_bytes=int(policy["max_size_bytes"]),
    )

    return {
        "storage_key": storage_key,
        "storage_path": str(target),
        "original_name": original_name,
        "content_type": content_type,
        "extension": extension,
        "size_bytes": size,
        "sha256": digest_hex,
    }


def resolve_messenger_attachment_path(storage_path: str) -> Path | None:
    settings = get_settings()
    return resolve_storage_path(Path(settings.messenger_storage_dir), storage_path)


def messenger_storage_state() -> tuple[str, str]:
    settings = get_settings()
    storage_path = Path(settings.messenger_storage_dir)
    if not storage_path.exists():
        return "warn", f"메신저 첨부 저장소 경로 없음: {settings.messenger_storage_dir}"
    if not storage_path.is_dir():
        return "bad", f"메신저 첨부 저장소가 디렉터리가 아님: {settings.messenger_storage_dir}"
    return "ok", f"메신저 첨부 저장소 경로 확인됨: {settings.messenger_storage_dir}"


def messenger_storage_usage() -> dict[str, int]:
    settings = get_settings()
    storage_path = Path(settings.messenger_storage_dir)
    if not storage_path.exists() or not storage_path.is_dir():
        return {"files": 0, "bytes": 0}
    files = 0
    total_bytes = 0
    for path in storage_path.rglob("*"):
        if not path.is_file():
            continue
        files += 1
        try:
            total_bytes += path.stat().st_size
        except OSError:
            pass
    return {"files": files, "bytes": total_bytes}


def _safe_name(name: str) -> str:
    return safe_name(name)


def _extension(name: str) -> str:
    return file_extension(name)
