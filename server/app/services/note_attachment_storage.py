"""노트/스케치 첨부 저장소 (2.3.6 P12).

`docs/NOW_2_3_6_FEATURE_DESIGN.md`의 "3. 스케치 저장 형식과 경로" 결정에 따라
메신저 첨부 저장소(`messenger_storage.py`)의 기계적인 부분
(`app/services/attachment_storage.py`)을 그대로 재사용한다. 정책만 다르다.

정책 결정과 근거:
  - 허용 형식은 PNG만이다. 지금 스케치 캔버스가 만드는 형식이 PNG
    (`web/app.js`의 `canvas.toDataURL("image/png")`)뿐이고, 로드맵 1이 요구하는
    것도 PNG 저장이다. jpg 등 사진 형식을 지금 열면 검증되지 않은 채 표면만
    넓어지므로, 실제로 쓰는 형식이 생기는 시점에 넓힌다.
  - 크기 제한은 기본 5MB다. 스케치는 사진보다 작은 벡터형 손그림이 PNG로
    떨어진 것이라 메신저 사진 기본값(10MB)보다 작게 잡았고, 운영자가
    `NOW_NOTE_ATTACHMENT_MAX_UPLOAD_MB`로 조정할 수 있게 했다(메신저와 같은 패턴).
  - 저장 경로는 `owner_id` 아래에 둔다. 노트 첨부는 메시지방이 아니라
    소유자에게 속하고, 첨부와 노트 사이에 강한 외래키를 걸지 않기로 했으므로
    (본문의 `nownote-attachment://{storage_key}` 참조로만 연결) 경로도 소유자
    기준으로만 나눈다.
"""
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

# 스케치 캔버스가 만드는 형식만 허용한다. PNG 유지 결정
# (docs/NOW_2_3_6_FEATURE_DESIGN.md "3. 스케치 저장 형식과 경로")을 따른다.
NOTE_ATTACHMENT_ALLOWED_EXTENSIONS = {"png"}
NOTE_ATTACHMENT_ALLOWED_MIME_TYPES = {"image/png"}


def note_attachment_upload_policy() -> dict:
    settings = get_settings()
    return {
        "max_size_bytes": max(1, settings.note_attachment_max_upload_mb) * 1024 * 1024,
        "allowed_extensions": sorted(NOTE_ATTACHMENT_ALLOWED_EXTENSIONS),
        "allowed_mime_types": sorted(NOTE_ATTACHMENT_ALLOWED_MIME_TYPES),
    }


async def save_note_attachment(
    *,
    owner_id: str,
    upload: UploadFile,
) -> dict:
    policy = note_attachment_upload_policy()
    original_name = safe_name(upload.filename or "attachment")
    extension = file_extension(original_name)
    if extension not in NOTE_ATTACHMENT_ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"reason": "extension_not_allowed", "message": "file extension not allowed"},
        )
    content_type = (upload.content_type or "application/octet-stream").split(";", 1)[0].strip().lower()
    if content_type not in NOTE_ATTACHMENT_ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"reason": "mime_type_not_allowed", "message": "file mime type not allowed"},
        )

    settings = get_settings()
    base = Path(settings.note_attachment_storage_dir) / safe_name(owner_id)
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


def resolve_note_attachment_path(storage_path: str) -> Path | None:
    settings = get_settings()
    return resolve_storage_path(Path(settings.note_attachment_storage_dir), storage_path)


def note_attachment_storage_state() -> tuple[str, str]:
    settings = get_settings()
    storage_path = Path(settings.note_attachment_storage_dir)
    if not storage_path.exists():
        return "warn", f"노트 첨부 저장소 경로 없음: {settings.note_attachment_storage_dir}"
    if not storage_path.is_dir():
        return "bad", f"노트 첨부 저장소가 디렉터리가 아님: {settings.note_attachment_storage_dir}"
    return "ok", f"노트 첨부 저장소 경로 확인됨: {settings.note_attachment_storage_dir}"
