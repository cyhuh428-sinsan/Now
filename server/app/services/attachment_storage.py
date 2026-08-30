"""첨부파일 저장의 기계적인 공통 부분.

메신저 첨부(`messenger_storage.py`)와 노트/스케치 첨부(`note_attachment_storage.py`)가
공유한다. 여기 있는 함수는 "누구나 통과해야 하는 안전 장치"만 다룬다 — 허용 확장자
목록, MIME 화이트리스트, 저장 경로 규칙(`group_name/room_id` vs `owner_id`) 같은
정책은 각자의 모듈에 남아 있다.

이관 시 지켜야 할 것 (2.3.6 P12):
  - 안전한 파일명 만들기(경로 traversal 방어)
  - 확장자 추출
  - 용량 제한을 지키며 스트리밍으로 디스크에 쓰기 + sha256 계산
  - 저장 루트 밖 경로를 걸러내는 경로 검증
동작을 조금이라도 바꾸면 기존 메신저 테스트(test_messenger.py, test_messenger_storage.py)가
깨지므로, 기존 `_safe_name`/`_extension`/저장 루프와 바이트 단위로 같게 유지한다.
"""
import hashlib
from pathlib import Path

from fastapi import HTTPException, UploadFile, status


def safe_name(name: str) -> str:
    cleaned = Path(name or "").name.replace("\\", "_").replace("/", "_").strip()
    if cleaned in {"", ".", ".."}:
        return "_"
    return cleaned[:240]


def file_extension(name: str) -> str:
    return Path(name).suffix.lower().lstrip(".")


async def stream_save_upload(
    *,
    upload: UploadFile,
    target: Path,
    max_size_bytes: int,
) -> tuple[int, str]:
    """업로드를 스트리밍으로 target에 저장한다.

    반환값은 (size_bytes, sha256_hex). max_size_bytes를 넘으면 부분 파일을
    지우고 413 HTTPException을 던진다. 정책(허용 확장자/MIME) 판단은 호출자가
    이 함수를 부르기 전에 끝내둔다 — 여기는 순수하게 저장만 한다.
    """
    digest = hashlib.sha256()
    size = 0
    with target.open("wb") as output:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > max_size_bytes:
                output.close()
                target.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail={"reason": "file_too_large", "message": "file too large"},
                )
            digest.update(chunk)
            output.write(chunk)
    return size, digest.hexdigest()


def resolve_storage_path(storage_root: Path, storage_path: str) -> Path | None:
    """storage_root 밖을 가리키는 storage_path는 None. 경로 traversal 방어 공용 로직."""
    root = storage_root.resolve(strict=False)
    target = Path(storage_path).resolve(strict=False)
    try:
        target.relative_to(root)
    except ValueError:
        return None
    return target if target.is_file() else None
