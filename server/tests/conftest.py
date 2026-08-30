"""공유 픽스처 — 인메모리 SQLite DB + FastAPI TestClient"""
import os
import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# 서버 루트를 sys.path에 추가
_SERVER_DIR = Path(__file__).resolve().parents[1]
if str(_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(_SERVER_DIR))


@pytest.fixture(scope="session", autouse=True)
def _env_setup(tmp_path_factory: pytest.TempPathFactory):
    """테스트 전용 SQLite DB / 저장소 경로를 환경변수로 설정."""
    base = tmp_path_factory.mktemp("now_test")
    db_path = base / "test.db"
    storage_path = base / "messenger_files"
    storage_path.mkdir(parents=True, exist_ok=True)
    note_attachment_storage_path = base / "note_attachment_files"
    note_attachment_storage_path.mkdir(parents=True, exist_ok=True)

    os.environ["NOW_DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["NOW_MESSENGER_STORAGE_DIR"] = storage_path.as_posix()
    os.environ["NOW_NOTE_ATTACHMENT_STORAGE_DIR"] = note_attachment_storage_path.as_posix()
    os.environ["NOW_WEB_SESSION_TTL_HOURS"] = "24"
    os.environ["NOW_USER_TOKEN_REQUIRED"] = "false"

    from app.core.config import get_settings
    get_settings.cache_clear()

    from app.db import SessionLocal, create_tables, engine
    from app.main import app
    create_tables()

    # 테스트 사용자 초기 생성 (session 범위)
    from app.services.user_accounts import create_user_account, issue_web_session
    with SessionLocal() as db:
        for owner_id, email, group in [
            ("sinsan", "sinsan@test.com", "testgroup"),
            ("member", "member@test.com", "testgroup"),
            ("outsider2", "outsider2@test.com", "othergroup"),
        ]:
            try:
                create_user_account(db, owner_id=owner_id, password="Aa12345678!", email=email, group_name=group)
            except Exception:
                pass
        db.commit()

    yield

    engine.dispose()


@pytest.fixture()
def db() -> Generator[Session, None, None]:
    from app.db import SessionLocal
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client() -> TestClient:
    from app.main import app
    return TestClient(app)


@pytest.fixture()
def user_sinsan(db: Session) -> tuple[str, str]:
    """sinsan 계정 + 웹 세션 토큰 (owner_id, token)."""
    from app.services.user_accounts import issue_web_session
    _session, token = issue_web_session(db, owner_id="sinsan")
    db.commit()
    return "sinsan", token


@pytest.fixture()
def user_member(db: Session) -> tuple[str, str]:
    """member 계정 + 웹 세션 토큰."""
    from app.services.user_accounts import issue_web_session
    _session, token = issue_web_session(db, owner_id="member")
    db.commit()
    return "member", token


@pytest.fixture()
def user_outsider(db: Session) -> tuple[str, str]:
    """다른 그룹 outsider 계정 + 웹 세션 토큰."""
    from app.services.user_accounts import issue_web_session
    _session, token = issue_web_session(db, owner_id="outsider2")
    db.commit()
    return "outsider2", token
