"""노트/스케치 첨부 저장소 테스트 (2.3.6 P12)

검증 범위:
  - PNG 업로드/다운로드 왕복
  - 허용 안 된 확장자·MIME 차단
  - 용량 초과 차단
  - 다른 사용자의 첨부 접근 차단 (403/404)
  - 경로 traversal 방어 (resolve_note_attachment_path)
"""
import os

from fastapi.testclient import TestClient

_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n"
    b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
    b"\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_upload_and_download_round_trip(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    upload_res = client.post(
        "/api/v1/notes/attachments",
        params={"owner_id": owner_id},
        files={"file": ("sketch.png", _PNG_BYTES, "image/png")},
        headers={"X-Now-Web-Session": token},
    )
    assert upload_res.status_code == 200
    body = upload_res.json()
    assert body["status"] == "ok"
    attachment = body["attachment"]
    assert attachment["original_name"] == "sketch.png"
    assert attachment["extension"] == "png"
    assert attachment["content_type"] == "image/png"
    assert attachment["size_bytes"] == len(_PNG_BYTES)
    storage_key = attachment["storage_key"]

    download_res = client.get(
        f"/api/v1/notes/attachments/{storage_key}",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": token},
    )
    assert download_res.status_code == 200
    assert download_res.content == _PNG_BYTES
    assert download_res.headers["content-type"].startswith("image/png")


def test_upload_blocks_disallowed_extension(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    res = client.post(
        "/api/v1/notes/attachments",
        params={"owner_id": owner_id},
        files={"file": ("sketch.jpg", _PNG_BYTES, "image/png")},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["reason"] == "extension_not_allowed"
    assert detail["message"] == "file extension not allowed"


def test_upload_blocks_disallowed_mime_type(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    res = client.post(
        "/api/v1/notes/attachments",
        params={"owner_id": owner_id},
        files={"file": ("sketch.png", _PNG_BYTES, "text/plain")},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["reason"] == "mime_type_not_allowed"
    assert detail["message"] == "file mime type not allowed"


def test_upload_blocks_too_large(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    """설정값(note_attachment_max_upload_mb) 경계값을 넘기면 413 + file_too_large 사유가 나온다."""
    owner_id, token = user_sinsan

    from app.core.config import get_settings

    os.environ["NOW_NOTE_ATTACHMENT_MAX_UPLOAD_MB"] = "1"
    get_settings.cache_clear()
    try:
        oversized = _PNG_BYTES + b"\x00" * (1024 * 1024 + 1 - len(_PNG_BYTES))
        res = client.post(
            "/api/v1/notes/attachments",
            params={"owner_id": owner_id},
            files={"file": ("big.png", oversized, "image/png")},
            headers={"X-Now-Web-Session": token},
        )
        assert res.status_code == 413
        detail = res.json()["detail"]
        assert detail["reason"] == "file_too_large"
        assert detail["message"] == "file too large"
    finally:
        del os.environ["NOW_NOTE_ATTACHMENT_MAX_UPLOAD_MB"]
        get_settings.cache_clear()


def test_download_blocked_for_other_owner(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_outsider: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    outsider_id, outsider_token = user_outsider

    upload_res = client.post(
        "/api/v1/notes/attachments",
        params={"owner_id": sinsan_id},
        files={"file": ("sketch.png", _PNG_BYTES, "image/png")},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    storage_key = upload_res.json()["attachment"]["storage_key"]

    res = client.get(
        f"/api/v1/notes/attachments/{storage_key}",
        params={"owner_id": outsider_id},
        headers={"X-Now-Web-Session": outsider_token},
    )
    assert res.status_code in (403, 404)


def test_download_missing_storage_key_returns_404(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    res = client.get(
        "/api/v1/notes/attachments/does-not-exist.png",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 404


# ── 경로 traversal 방어 ────────────────────────────────────────────────────────

def test_resolve_note_attachment_path_rejects_traversal() -> None:
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        os.environ["NOW_NOTE_ATTACHMENT_STORAGE_DIR"] = str(Path(tmp) / "storage")
        from app.core.config import get_settings
        get_settings.cache_clear()

        from app.services.note_attachment_storage import resolve_note_attachment_path

        outside = str(Path(tmp) / "outside.png")
        Path(outside).write_bytes(_PNG_BYTES)
        result = resolve_note_attachment_path(outside)
        assert result is None

        get_settings.cache_clear()


def test_upload_sanitizes_path_traversal_in_filename(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    """업로드 파일명에 ../가 들어가도 safe_name()이 디렉터리 부분을 제거한다.

    storage_key는 서버가 uuid4로 생성하므로 파일명이 실제 저장 경로에 영향을
    주지 않지만, original_name에 traversal 문자가 남지 않는지는 확인해둔다.
    """
    owner_id, token = user_sinsan
    res = client.post(
        "/api/v1/notes/attachments",
        params={"owner_id": owner_id},
        files={"file": ("../../evil.png", _PNG_BYTES, "image/png")},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 200
    attachment = res.json()["attachment"]
    assert attachment["original_name"] == "evil.png"
    assert "/" not in attachment["storage_key"]
    assert "\\" not in attachment["storage_key"]
    assert ".." not in attachment["storage_key"]


def test_download_rejects_path_traversal_storage_key(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    """storage_key에 ../를 넣어도 DB 조회 기반이라 404로 막힌다(파일시스템 직접 접근 불가)."""
    owner_id, token = user_sinsan
    res = client.get(
        "/api/v1/notes/attachments/..%2F..%2F..%2Fetc%2Fpasswd",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 404


def test_resolve_note_attachment_path_returns_none_for_missing_file() -> None:
    import tempfile
    from pathlib import Path

    with tempfile.TemporaryDirectory() as tmp:
        os.environ["NOW_NOTE_ATTACHMENT_STORAGE_DIR"] = tmp
        from app.core.config import get_settings
        get_settings.cache_clear()

        from app.services.note_attachment_storage import resolve_note_attachment_path

        result = resolve_note_attachment_path(str(Path(tmp) / "nonexistent.png"))
        assert result is None

        get_settings.cache_clear()
