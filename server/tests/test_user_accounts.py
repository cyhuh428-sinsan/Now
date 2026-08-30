"""사용자 계정 서비스 단위 테스트

검증 범위:
  - 비밀번호 정책 검증
  - 비밀번호 해시 / 검증
  - 계정 생성 및 웹 세션 발급
  - 중복 계정 생성 방지
  - 헬스 엔드포인트 응답
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


# ── 비밀번호 정책 ──────────────────────────────────────────────────────────────

def test_password_policy_requires_letter_number_symbol() -> None:
    from fastapi import HTTPException
    from app.services.user_accounts import validate_password_policy

    with pytest.raises(HTTPException):
        validate_password_policy("onlyletters")  # 숫자·기호 없음

    with pytest.raises(HTTPException):
        validate_password_policy("12345678901")  # 문자·기호 없음

    with pytest.raises(HTTPException):
        validate_password_policy("Short1!")  # 10자 미만


def test_password_policy_accepts_valid_password() -> None:
    from app.services.user_accounts import validate_password_policy
    validate_password_policy("Aa12345678!")  # 예외 없어야 함


# ── 비밀번호 해시 및 검증 ─────────────────────────────────────────────────────

def test_hash_and_verify_password() -> None:
    from app.services.user_accounts import hash_password, verify_password
    pw = "Secure#Pass99"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True
    assert verify_password("wrong_password!", hashed) is False


def test_verify_password_returns_false_for_none_hash() -> None:
    from app.services.user_accounts import verify_password
    assert verify_password("any_password!", None) is False


def test_hash_password_produces_different_hashes() -> None:
    from app.services.user_accounts import hash_password
    pw = "SamePassword1!"
    h1 = hash_password(pw)
    h2 = hash_password(pw)
    assert h1 != h2  # salt가 다르므로 해시도 달라야 함


# ── 계정 생성 및 세션 발급 ────────────────────────────────────────────────────

def test_create_user_account_success(db: Session) -> None:
    import uuid
    from app.services.user_accounts import create_user_account
    owner_id = f"user_{uuid.uuid4().hex[:8]}"
    user = create_user_account(
        db,
        owner_id=owner_id,
        password="TestPass1!",
        email=f"{owner_id}@test.com",
        group_name="testgroup",
    )
    db.commit()
    assert user.owner_id == owner_id
    assert user.is_active == 1
    assert user.password_hash is not None


def test_create_duplicate_user_returns_none(db: Session) -> None:
    """create_user_account는 중복 owner_id에 대해 예외를 발생시키지 않고 None을 반환한다."""
    import uuid
    from app.services.user_accounts import create_user_account
    owner_id = f"dup_{uuid.uuid4().hex[:8]}"
    first = create_user_account(db, owner_id=owner_id, password="TestPass1!", email=f"{owner_id}@t.com", group_name="g")
    db.commit()
    second = create_user_account(db, owner_id=owner_id, password="TestPass1!", email=f"{owner_id}2@t.com", group_name="g")
    assert first is not None
    assert second is None  # 중복 시 None 반환


def test_issue_web_session_returns_token(db: Session) -> None:
    import uuid
    from app.services.user_accounts import create_user_account, issue_web_session
    owner_id = f"sess_{uuid.uuid4().hex[:8]}"
    create_user_account(db, owner_id=owner_id, password="TestPass1!", email=f"{owner_id}@t.com", group_name="g")
    db.commit()
    _session, token = issue_web_session(db, owner_id=owner_id)
    db.commit()
    assert token and len(token) > 10


def test_require_web_session_access_with_valid_token(db: Session) -> None:
    import uuid
    from app.services.user_accounts import create_user_account, issue_web_session, require_web_session_access
    owner_id = f"auth_{uuid.uuid4().hex[:8]}"
    create_user_account(db, owner_id=owner_id, password="TestPass1!", email=f"{owner_id}@t.com", group_name="g")
    db.commit()
    _session, token = issue_web_session(db, owner_id=owner_id)
    db.commit()
    user = require_web_session_access(db, owner_id=owner_id, session_token=token)
    assert user.owner_id == owner_id


def test_require_web_session_access_with_invalid_token(db: Session) -> None:
    from fastapi import HTTPException
    from app.services.user_accounts import require_web_session_access
    with pytest.raises(HTTPException) as exc_info:
        require_web_session_access(db, owner_id="nobody", session_token="bad_token")
    assert exc_info.value.status_code == 401


# ── 헬스 엔드포인트 ───────────────────────────────────────────────────────────

def test_health_endpoint_returns_ok(client: TestClient) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data.get("status") in ("ok", "degraded", "warn")


def test_health_ready_endpoint(client: TestClient) -> None:
    res = client.get("/health/ready")
    assert res.status_code in (200, 503)
