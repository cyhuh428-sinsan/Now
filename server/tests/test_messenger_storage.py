"""메신저 저장소 서비스 단위 테스트

검증 범위:
  - messenger_upload_policy() 반환 구조 및 값
  - _safe_name() 경로 traversal 방어
  - _extension() 확장자 추출
  - resolve_messenger_attachment_path() 경로 검증
  - messenger_storage_state() 상태 반환
  - messenger_storage_usage() 사용량 집계
"""
import os
import tempfile
from pathlib import Path

import pytest


# ── 정책 ──────────────────────────────────────────────────────────────────────

def test_upload_policy_has_required_fields() -> None:
    from app.services.messenger_storage import messenger_upload_policy
    policy = messenger_upload_policy()
    assert "max_size_bytes" in policy
    assert "allowed_extensions" in policy
    assert "allowed_mime_types" in policy
    assert "image_extensions" in policy


def test_upload_policy_max_size_is_positive() -> None:
    from app.services.messenger_storage import messenger_upload_policy
    policy = messenger_upload_policy()
    assert policy["max_size_bytes"] > 0


def test_upload_policy_allows_safe_extensions() -> None:
    from app.services.messenger_storage import messenger_upload_policy
    policy = messenger_upload_policy()
    for ext in ("jpg", "png", "pdf", "txt"):
        assert ext in policy["allowed_extensions"], f"{ext} 허용 확장자에 없음"


def test_upload_policy_blocks_dangerous_extensions() -> None:
    from app.services.messenger_storage import messenger_upload_policy
    policy = messenger_upload_policy()
    for ext in ("exe", "bat", "sh", "ps1", "php"):
        assert ext not in policy["allowed_extensions"], f"{ext} 차단 대상이어야 함"


def test_upload_policy_image_extensions_subset_of_allowed() -> None:
    from app.services.messenger_storage import messenger_upload_policy
    policy = messenger_upload_policy()
    allowed = set(policy["allowed_extensions"])
    for img_ext in policy["image_extensions"]:
        assert img_ext in allowed, f"이미지 확장자 {img_ext}가 허용 목록에 없음"


# ── _safe_name 경로 traversal 방어 ────────────────────────────────────────────

def test_safe_name_strips_path_traversal() -> None:
    from app.services.messenger_storage import _safe_name
    assert "/" not in _safe_name("../../etc/passwd")
    assert "\\" not in _safe_name("..\\windows\\system32")


def test_safe_name_returns_fallback_for_empty() -> None:
    from app.services.messenger_storage import _safe_name
    assert _safe_name("") == "_"
    assert _safe_name("..") == "_"
    assert _safe_name(".") == "_"


def test_safe_name_truncates_long_names() -> None:
    from app.services.messenger_storage import _safe_name
    long_name = "a" * 300 + ".txt"
    result = _safe_name(long_name)
    assert len(result) <= 240


def test_safe_name_preserves_normal_filename() -> None:
    from app.services.messenger_storage import _safe_name
    assert _safe_name("hello.txt") == "hello.txt"
    assert _safe_name("문서.pdf") == "문서.pdf"


# ── _extension 추출 ───────────────────────────────────────────────────────────

def test_extension_extracts_lowercase() -> None:
    from app.services.messenger_storage import _extension
    assert _extension("File.TXT") == "txt"
    assert _extension("image.PNG") == "png"
    assert _extension("archive.ZIP") == "zip"


def test_extension_empty_for_no_extension() -> None:
    from app.services.messenger_storage import _extension
    assert _extension("README") == ""


def test_extension_uses_last_dot() -> None:
    from app.services.messenger_storage import _extension
    assert _extension("archive.tar.gz") == "gz"


# ── resolve_messenger_attachment_path ─────────────────────────────────────────

def test_resolve_path_returns_none_for_missing_file() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["NOW_MESSENGER_STORAGE_DIR"] = tmp
        from app.core.config import get_settings
        get_settings.cache_clear()

        from app.services.messenger_storage import resolve_messenger_attachment_path
        result = resolve_messenger_attachment_path(str(Path(tmp) / "nonexistent.txt"))
        assert result is None

        get_settings.cache_clear()


def test_resolve_path_returns_none_for_traversal() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["NOW_MESSENGER_STORAGE_DIR"] = str(Path(tmp) / "storage")
        from app.core.config import get_settings
        get_settings.cache_clear()

        from app.services.messenger_storage import resolve_messenger_attachment_path
        # storage 루트 밖의 경로는 None 반환
        outside = str(Path(tmp) / "outside.txt")
        Path(outside).write_text("data")
        result = resolve_messenger_attachment_path(outside)
        assert result is None

        get_settings.cache_clear()


# ── messenger_storage_state ───────────────────────────────────────────────────

def test_storage_state_ok_when_dir_exists() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["NOW_MESSENGER_STORAGE_DIR"] = tmp
        from app.core.config import get_settings
        get_settings.cache_clear()

        from app.services.messenger_storage import messenger_storage_state
        state, msg = messenger_storage_state()
        assert state == "ok"
        assert tmp in msg

        get_settings.cache_clear()


def test_storage_state_warn_when_dir_missing() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        missing = str(Path(tmp) / "no_such_dir")
        os.environ["NOW_MESSENGER_STORAGE_DIR"] = missing
        from app.core.config import get_settings
        get_settings.cache_clear()

        from app.services.messenger_storage import messenger_storage_state
        state, _ = messenger_storage_state()
        assert state == "warn"

        get_settings.cache_clear()


# ── messenger_storage_usage ───────────────────────────────────────────────────

def test_storage_usage_counts_files() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["NOW_MESSENGER_STORAGE_DIR"] = tmp
        from app.core.config import get_settings
        get_settings.cache_clear()

        # 파일 2개 생성
        Path(tmp, "a.txt").write_bytes(b"hello")
        Path(tmp, "b.txt").write_bytes(b"world!!")

        from app.services.messenger_storage import messenger_storage_usage
        usage = messenger_storage_usage()
        assert usage["files"] == 2
        assert usage["bytes"] == len(b"hello") + len(b"world!!")

        get_settings.cache_clear()


def test_storage_usage_returns_zeros_when_missing() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        missing = str(Path(tmp) / "ghost")
        os.environ["NOW_MESSENGER_STORAGE_DIR"] = missing
        from app.core.config import get_settings
        get_settings.cache_clear()

        from app.services.messenger_storage import messenger_storage_usage
        usage = messenger_storage_usage()
        assert usage == {"files": 0, "bytes": 0}

        get_settings.cache_clear()
