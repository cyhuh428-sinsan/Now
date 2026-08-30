"""메신저 API 테스트 (2.3.5 신규 기능)

검증 범위:
  - 인증 없이 접근 시 401
  - 그룹 룸 자동 생성 및 목록 조회
  - 메시지 전송 및 읽음 처리
  - 프라이빗 룸 생성 / 멤버 아닌 사용자 403
  - 첨부파일 업로드 정책 (확장자·MIME 거부, 허용)
  - 첨부파일 다운로드 (멤버 O/X)
  - 읽지 않은 메시지 수 API (2.3.5 신규)

2.3.6 P9: 첨부 업로드 실패 시 detail을 {"reason": ..., "message": ...} 구조로
반환한다. reason은 클라이언트가 문자열 비교로 분기할 안정적인 코드이고,
message는 기존 영어 문구를 유지한다(디버깅/로그용). 아래 확장자·MIME·용량
테스트는 이 구조 변경에 맞춰 detail 검증 방식을 dict 접근으로 바꿨다 —
검증 대상(400/413이 나고 실패 사유가 식별됨)은 그대로 유지한다.
"""
import os

import pytest
from fastapi.testclient import TestClient


# ── 인증 ──────────────────────────────────────────────────────────────────────

def test_rooms_requires_session(client: TestClient) -> None:
    res = client.get("/api/v1/messenger/rooms", params={"owner_id": "sinsan"})
    assert res.status_code == 401
    assert res.json()["detail"] == "web session required"


def test_unread_requires_session(client: TestClient) -> None:
    res = client.get("/api/v1/messenger/rooms/unread", params={"owner_id": "sinsan"})
    assert res.status_code == 401


# ── 룸 목록 ───────────────────────────────────────────────────────────────────

def test_list_rooms_creates_group_room(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    res = client.get(
        "/api/v1/messenger/rooms",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert len(data["rooms"]) >= 1
    # 전체 그룹 룸이 자동 생성된다
    group_room = next((r for r in data["rooms"] if r["room_type"] == "group"), None)
    assert group_room is not None, "전체 그룹 룸 자동 생성 실패"


def test_list_rooms_payload_fields(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    res = client.get(
        "/api/v1/messenger/rooms",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": token},
    )
    room = res.json()["rooms"][0]
    for field in ("id", "room_type", "name", "last_message_id", "last_read_message_id", "unread_count"):
        assert field in room, f"필드 누락: {field}"


# ── 메시지 전송 및 읽음 처리 ──────────────────────────────────────────────────

def test_send_message_to_group_room(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    room_id = _get_group_room_id(client, owner_id, token)

    res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        json={"owner_id": owner_id, "body": "테스트 메시지"},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 200
    item = res.json()["item"]
    assert item["body"] == "테스트 메시지"
    assert item["sender_owner_id"] == owner_id
    assert isinstance(item["id"], int)


def test_send_empty_message_returns_400(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    room_id = _get_group_room_id(client, owner_id, token)
    res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        json={"owner_id": owner_id, "body": "   "},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 400
    assert res.json()["detail"] == "message body required"


def test_mark_room_read_updates_last_read_id(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    room_id = _get_group_room_id(client, owner_id, token)

    # 메시지 전송
    msg_res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        json={"owner_id": owner_id, "body": "읽음 처리 테스트"},
        headers={"X-Now-Web-Session": token},
    )
    message_id = msg_res.json()["item"]["id"]

    # 읽음 처리
    read_res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/read",
        json={"owner_id": owner_id, "last_read_message_id": message_id},
        headers={"X-Now-Web-Session": token},
    )
    assert read_res.status_code == 200
    assert read_res.json()["last_read_message_id"] >= message_id


def test_list_messages_returns_sent_messages(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    room_id = _get_group_room_id(client, owner_id, token)

    client.post(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        json={"owner_id": owner_id, "body": "목록 확인용 메시지"},
        headers={"X-Now-Web-Session": token},
    )

    list_res = client.get(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": token},
    )
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    bodies = [item["body"] for item in items]
    assert "목록 확인용 메시지" in bodies


# ── 프라이빗 룸 생성 및 접근 제어 ───────────────────────────────────────────

def test_create_private_room(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    member_id, _ = user_member

    res = client.post(
        "/api/v1/messenger/rooms",
        json={"owner_id": sinsan_id, "name": "작업방", "member_owner_ids": [member_id]},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    assert res.status_code == 200
    room = res.json()["room"]
    assert room["room_type"] == "private"
    assert room["name"] == "작업방"


def test_outsider_cannot_access_private_room(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
    user_outsider: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    member_id, _ = user_member
    outsider_id, outsider_token = user_outsider

    # 프라이빗 룸 생성
    create_res = client.post(
        "/api/v1/messenger/rooms",
        json={"owner_id": sinsan_id, "name": "비공개방", "member_owner_ids": [member_id]},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    private_room_id = create_res.json()["room"]["id"]

    # 외부 사용자 접근 시도
    res = client.get(
        f"/api/v1/messenger/rooms/{private_room_id}/messages",
        params={"owner_id": outsider_id},
        headers={"X-Now-Web-Session": outsider_token},
    )
    assert res.status_code in (403, 404)


def test_create_room_without_members_returns_400(
    client: TestClient,
    user_sinsan: tuple[str, str],
) -> None:
    owner_id, token = user_sinsan
    res = client.post(
        "/api/v1/messenger/rooms",
        json={"owner_id": owner_id, "name": "빈방", "member_owner_ids": [owner_id]},
        headers={"X-Now-Web-Session": token},
    )
    # 자기 자신만 있으면 최소 2명 미충족 → 400
    assert res.status_code == 400


# ── 첨부파일 정책 ──────────────────────────────────────────────────────────────

def test_attachment_blocked_extension(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    member_id, _ = user_member
    room_id = _get_or_create_private_room(client, sinsan_id, sinsan_token, member_id)

    res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/attachments",
        params={"owner_id": sinsan_id, "body": "확장자 차단 테스트"},
        files={"file": ("malware.exe", b"evil", "text/plain")},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["reason"] == "extension_not_allowed"
    assert detail["message"] == "file extension not allowed"


def test_attachment_blocked_mime_type(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    member_id, _ = user_member
    room_id = _get_or_create_private_room(client, sinsan_id, sinsan_token, member_id)

    res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/attachments",
        params={"owner_id": sinsan_id, "body": "MIME 차단 테스트"},
        files={"file": ("test.txt", b"blocked", "application/x-msdownload")},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["reason"] == "mime_type_not_allowed"
    assert detail["message"] == "file mime type not allowed"


def test_attachment_blocked_too_large(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
) -> None:
    """설정값(messenger_max_upload_mb) 경계값을 넘기면 413 + file_too_large 사유가 나온다."""
    sinsan_id, sinsan_token = user_sinsan
    member_id, _ = user_member
    room_id = _get_or_create_private_room(client, sinsan_id, sinsan_token, member_id)

    from app.core.config import get_settings

    os.environ["NOW_MESSENGER_MAX_UPLOAD_MB"] = "1"
    get_settings.cache_clear()
    try:
        oversized = b"x" * (1024 * 1024 + 1)  # 설정값(1MB) 경계를 1바이트 초과
        res = client.post(
            f"/api/v1/messenger/rooms/{room_id}/attachments",
            params={"owner_id": sinsan_id, "body": "용량 초과 테스트"},
            files={"file": ("big.txt", oversized, "text/plain")},
            headers={"X-Now-Web-Session": sinsan_token},
        )
        assert res.status_code == 413
        detail = res.json()["detail"]
        assert detail["reason"] == "file_too_large"
        assert detail["message"] == "file too large"
    finally:
        del os.environ["NOW_MESSENGER_MAX_UPLOAD_MB"]
        get_settings.cache_clear()


def test_attachment_upload_and_download(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    member_id, _ = user_member
    room_id = _get_or_create_private_room(client, sinsan_id, sinsan_token, member_id)

    upload_res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/attachments",
        params={"owner_id": sinsan_id, "body": "파일 업로드"},
        files={"file": ("hello.txt", b"hello messenger 2.3.5", "text/plain")},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    assert upload_res.status_code == 200
    attachment = upload_res.json()["item"]["attachments"][0]
    assert attachment["original_name"] == "hello.txt"
    assert attachment["extension"] == "txt"

    download_res = client.get(
        f"/api/v1/messenger/attachments/{attachment['id']}",
        params={"owner_id": sinsan_id},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    assert download_res.status_code == 200
    assert download_res.content == b"hello messenger 2.3.5"


def test_attachment_download_blocked_for_non_member(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
    user_outsider: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    member_id, _ = user_member
    outsider_id, outsider_token = user_outsider
    room_id = _get_or_create_private_room(client, sinsan_id, sinsan_token, member_id)

    upload_res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/attachments",
        params={"owner_id": sinsan_id, "body": "접근 제어 테스트"},
        files={"file": ("secret.txt", b"secret content", "text/plain")},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    attachment_id = upload_res.json()["item"]["attachments"][0]["id"]

    res = client.get(
        f"/api/v1/messenger/attachments/{attachment_id}",
        params={"owner_id": outsider_id},
        headers={"X-Now-Web-Session": outsider_token},
    )
    assert res.status_code in (403, 404)


# ── 읽지 않은 메시지 수 API (2.3.5 신규) ─────────────────────────────────────

def test_unread_count_api_returns_correct_structure(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    member_id, member_token = user_member

    room_id = _get_or_create_private_room(client, sinsan_id, sinsan_token, member_id)
    client.post(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        json={"owner_id": sinsan_id, "body": "읽지 않은 메시지"},
        headers={"X-Now-Web-Session": sinsan_token},
    )

    res = client.get(
        "/api/v1/messenger/rooms/unread",
        params={"owner_id": member_id},
        headers={"X-Now-Web-Session": member_token},
    )
    assert res.status_code == 200
    data = res.json()
    assert "total_unread_count" in data
    assert "rooms" in data
    assert isinstance(data["total_unread_count"], int)
    assert data["total_unread_count"] >= 1


def test_unread_count_decreases_after_read(
    client: TestClient,
    user_sinsan: tuple[str, str],
    user_member: tuple[str, str],
) -> None:
    sinsan_id, sinsan_token = user_sinsan
    member_id, member_token = user_member

    room_id = _get_or_create_private_room(client, sinsan_id, sinsan_token, member_id)
    msg_res = client.post(
        f"/api/v1/messenger/rooms/{room_id}/messages",
        json={"owner_id": sinsan_id, "body": "읽음 후 감소 확인"},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    message_id = msg_res.json()["item"]["id"]

    # 읽기 전 unread
    before = client.get(
        "/api/v1/messenger/rooms/unread",
        params={"owner_id": member_id},
        headers={"X-Now-Web-Session": member_token},
    ).json()["total_unread_count"]

    # 읽음 처리
    client.post(
        f"/api/v1/messenger/rooms/{room_id}/read",
        json={"owner_id": member_id, "last_read_message_id": message_id},
        headers={"X-Now-Web-Session": member_token},
    )

    # 읽은 후 unread
    after = client.get(
        "/api/v1/messenger/rooms/unread",
        params={"owner_id": member_id},
        headers={"X-Now-Web-Session": member_token},
    ).json()["total_unread_count"]

    assert after < before or after == 0


# ── 업로드 정책 엔드포인트 ────────────────────────────────────────────────────

def test_messenger_policy_endpoint(client: TestClient) -> None:
    res = client.get("/api/v1/messenger/policy")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "max_size_bytes" in data
    assert "allowed_extensions" in data
    assert "allowed_mime_types" in data
    assert "txt" in data["allowed_extensions"]
    assert "exe" not in data["allowed_extensions"]


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _get_group_room_id(client: TestClient, owner_id: str, token: str) -> int:
    res = client.get(
        "/api/v1/messenger/rooms",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": token},
    )
    rooms = res.json()["rooms"]
    return rooms[0]["id"]


def _get_or_create_private_room(
    client: TestClient, sinsan_id: str, sinsan_token: str, member_id: str
) -> int:
    """매번 고유 이름으로 프라이빗 룸을 생성해 unique constraint 충돌을 피한다."""
    import uuid
    unique_name = f"방_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/messenger/rooms",
        json={"owner_id": sinsan_id, "name": unique_name, "member_owner_ids": [member_id]},
        headers={"X-Now-Web-Session": sinsan_token},
    )
    assert res.status_code == 200, f"룸 생성 실패: {res.text}"
    return res.json()["room"]["id"]
