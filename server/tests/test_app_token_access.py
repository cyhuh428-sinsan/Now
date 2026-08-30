"""2.3.6 P6 — 앱 접속 토큰(X-Now-User-Token) 전용 접근 검증

NowNote는 Web 세션 로그인이 없고 사용자 ID + 앱 접속 토큰만 사용한다.
노트 동기화(sync), 사용자 프로필(users), 메신저(messenger) 세 API가
`X-Now-Web-Session` 없이 `X-Now-User-Token`만으로 동작하는지 확인한다.

그룹 공유 메모를 Web 세션에만 내려주는 것은 의도된 설계다
(`docs/WORK_PROGRESS.md`, `server/README.md` 참고). 이 테스트는 그 동작이
앱 토큰 경로에서도 그대로 유지되는지 "확인"만 하고 바꾸지 않는다.
"""
import uuid
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.fixture()
def app_token_required(monkeypatch: pytest.MonkeyPatch):
    """운영에서 앱 접속 토큰이 실제로 검증되는 조건(NOW_USER_TOKEN_REQUIRED=true)을 흉내낸다."""
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "user_token_required", True)
    return settings


def _issue_app_token(db: Session, *, owner_id: str) -> str:
    from app.services.user_accounts import issue_user_device_access_token

    device_id = f"app-device-{uuid.uuid4().hex[:8]}"
    _device, token = issue_user_device_access_token(
        db,
        owner_id=owner_id,
        device_id=device_id,
        display_name="app token test device",
    )
    db.commit()
    return token


# ── 노트 동기화: POST /api/v1/sync ───────────────────────────────────────────

def test_sync_works_with_app_token_only(client: TestClient, db: Session, app_token_required) -> None:
    owner_id = "sinsan"
    token = _issue_app_token(db, owner_id=owner_id)

    res = client.post(
        "/api/v1/sync",
        json={
            "owner_id": owner_id,
            "device_id": f"sync-device-{uuid.uuid4().hex[:8]}",
            "notes": [],
        },
        headers={"X-Now-User-Token": token},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "pushed_notes" in data
    assert "pulled_notes" in data


def test_sync_rejects_missing_auth_when_token_required(client: TestClient, app_token_required) -> None:
    res = client.post(
        "/api/v1/sync",
        json={"owner_id": "sinsan", "device_id": "no-auth-device", "notes": []},
    )
    assert res.status_code == 401


def test_sync_app_token_excludes_group_shared_notes(
    client: TestClient, db: Session, app_token_required
) -> None:
    """그룹 공유(다른 그룹원의 tree 메모)는 앱 토큰 동기화에 내려주지 않는다 (의도된 설계)."""
    from app.models.note import Note

    owner_id = "sinsan"
    member_id = "member"
    shared_title = f"그룹 공유 확인용_{uuid.uuid4().hex[:8]}"

    db.add(
        Note(
            owner_id=member_id,
            device_id="member-seed-device",
            local_id=f"local-{uuid.uuid4().hex[:8]}",
            note_type="tree",
            title=shared_title,
            content="",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db.commit()

    token = _issue_app_token(db, owner_id=owner_id)
    app_res = client.post(
        "/api/v1/sync",
        json={
            "owner_id": owner_id,
            "device_id": f"sync-device-{uuid.uuid4().hex[:8]}",
            "notes": [],
        },
        headers={"X-Now-User-Token": token},
    )
    assert app_res.status_code == 200, app_res.text
    app_titles = [n["title"] for n in app_res.json()["pulled_notes"]]
    assert shared_title not in app_titles


def test_sync_web_session_includes_group_shared_notes(client: TestClient, db: Session) -> None:
    """대조군: Web 세션은 그룹 공유 메모를 그대로 내려받는다 (기존 설계, 변경 없음 확인)."""
    from app.models.note import Note
    from app.services.user_accounts import issue_web_session

    owner_id = "sinsan"
    member_id = "member"
    shared_title = f"그룹 공유 웹확인용_{uuid.uuid4().hex[:8]}"

    db.add(
        Note(
            owner_id=member_id,
            device_id="member-seed-device-2",
            local_id=f"local-{uuid.uuid4().hex[:8]}",
            note_type="tree",
            title=shared_title,
            content="",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    )
    db.commit()

    _session, web_token = issue_web_session(db, owner_id=owner_id)
    db.commit()

    web_res = client.post(
        "/api/v1/sync",
        json={
            "owner_id": owner_id,
            "device_id": f"sync-device-{uuid.uuid4().hex[:8]}",
            "notes": [],
        },
        headers={"X-Now-Web-Session": web_token},
    )
    assert web_res.status_code == 200, web_res.text
    web_titles = [n["title"] for n in web_res.json()["pulled_notes"]]
    assert shared_title in web_titles


# ── 사용자 프로필: /api/v1/users/{owner_id} ──────────────────────────────────

def test_user_profile_get_works_with_app_token_only(client: TestClient, db: Session, app_token_required) -> None:
    owner_id = "sinsan"
    token = _issue_app_token(db, owner_id=owner_id)

    res = client.get(
        f"/api/v1/users/{owner_id}",
        headers={"X-Now-User-Token": token},
    )
    assert res.status_code == 200, res.text
    assert res.json()["user"]["owner_id"] == owner_id


def test_user_profile_patch_works_with_app_token_only(client: TestClient, db: Session, app_token_required) -> None:
    owner_id = "sinsan"
    token = _issue_app_token(db, owner_id=owner_id)
    new_name = f"App Token Tester {uuid.uuid4().hex[:6]}"

    res = client.patch(
        f"/api/v1/users/{owner_id}",
        json={"display_name": new_name, "timezone": "Asia/Seoul"},
        headers={"X-Now-User-Token": token},
    )
    assert res.status_code == 200, res.text
    assert res.json()["user"]["display_name"] == new_name


def test_user_profile_rejects_missing_auth_when_token_required(client: TestClient, app_token_required) -> None:
    res = client.get("/api/v1/users/sinsan")
    assert res.status_code == 401


# ── 메신저: /api/v1/messenger/* ──────────────────────────────────────────────

def test_messenger_rooms_works_with_app_token_only(client: TestClient, db: Session) -> None:
    owner_id = "sinsan"
    token = _issue_app_token(db, owner_id=owner_id)

    res = client.get(
        "/api/v1/messenger/rooms",
        params={"owner_id": owner_id},
        headers={"X-Now-User-Token": token},
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "ok"


def test_messenger_send_and_read_with_app_token_only(client: TestClient, db: Session) -> None:
    owner_id = "sinsan"
    token = _issue_app_token(db, owner_id=owner_id)
    headers = {"X-Now-User-Token": token}

    rooms_res = client.get("/api/v1/messenger/rooms", params={"owner_id": owner_id}, headers=headers)
    assert rooms_res.status_code == 200
    room_id = rooms_res.json()["rooms"][0]["id"]

    send_res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        json={"owner_id": owner_id, "body": "앱 토큰 전용 메시지"},
        headers=headers,
    )
    assert send_res.status_code == 200, send_res.text
    message_id = send_res.json()["item"]["id"]

    read_res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/read",
        json={"owner_id": owner_id, "last_read_message_id": message_id},
        headers=headers,
    )
    assert read_res.status_code == 200, read_res.text


def test_messenger_attachment_upload_and_download_with_app_token_only(
    client: TestClient, db: Session
) -> None:
    sinsan_token = _issue_app_token(db, owner_id="sinsan")
    member_token = _issue_app_token(db, owner_id="member")

    unique_name = f"앱토큰방_{uuid.uuid4().hex[:8]}"
    create_res = client.post(
        "/api/v1/messenger/rooms",
        json={"owner_id": "sinsan", "name": unique_name, "member_owner_ids": ["member"]},
        headers={"X-Now-User-Token": sinsan_token},
    )
    assert create_res.status_code == 200, create_res.text
    room_id = create_res.json()["room"]["id"]

    upload_res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/attachments",
        params={"owner_id": "sinsan", "body": "앱 토큰 첨부 테스트"},
        files={"file": ("app_token.txt", b"app token attachment", "text/plain")},
        headers={"X-Now-User-Token": sinsan_token},
    )
    assert upload_res.status_code == 200, upload_res.text
    attachment_id = upload_res.json()["item"]["attachments"][0]["id"]

    download_res = client.get(
        f"/api/v1/messenger/attachments/{attachment_id}",
        params={"owner_id": "member"},
        headers={"X-Now-User-Token": member_token},
    )
    assert download_res.status_code == 200, download_res.text
    assert download_res.content == b"app token attachment"


def test_messenger_unread_works_with_app_token_only(client: TestClient, db: Session) -> None:
    owner_id = "sinsan"
    token = _issue_app_token(db, owner_id=owner_id)

    res = client.get(
        "/api/v1/messenger/rooms/unread",
        params={"owner_id": owner_id},
        headers={"X-Now-User-Token": token},
    )
    assert res.status_code == 200, res.text
    assert "total_unread_count" in res.json()


def test_messenger_rejects_missing_auth(client: TestClient) -> None:
    """메신저는 NOW_USER_TOKEN_REQUIRED 설정과 무관하게 두 헤더 모두 없으면 항상 차단한다."""
    res = client.get("/api/v1/messenger/rooms", params={"owner_id": "sinsan"})
    assert res.status_code == 401
    assert res.json()["detail"] == "web session required"
