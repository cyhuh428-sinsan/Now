"""서버 capability 선언 검증

- /api/v1/server 응답에 2.3.6 capability가 실제로 나오는지
- 선언한 값이 실제 동작(업로드 정책, 계층 제한, 무인증 엔드포인트)과 일치하는지
- 아직 구현이 없는 기능이 True로 새어 나가지 않는지
"""
import pytest
from fastapi.testclient import TestClient


def _capabilities(client: TestClient) -> dict:
    res = client.get("/api/v1/server")
    assert res.status_code == 200
    return res.json()["capabilities"]


def test_server_info_needs_no_auth_header(client: TestClient) -> None:
    """앱/설치형이 연결 전에 읽어야 하므로 토큰 없이 200이어야 한다."""
    res = client.get("/api/v1/server")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "capabilities" in body


def test_server_info_router_has_no_auth_dependency() -> None:
    from app.api.server import router

    assert router.dependencies == []


def test_server_info_public_even_with_api_token(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """NOW_API_TOKEN이 설정된 서버에서도 /api/v1/server는 열려 있어야 한다."""
    from app.core.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "api_token", "test-secret-token")
    res = client.get("/api/v1/server")
    assert res.status_code == 200
    assert res.json()["auth_required"] is True
    assert _capabilities(client)["server_info_public"] is True


def test_existing_capability_names_unchanged(client: TestClient) -> None:
    """클라이언트가 이미 읽고 있는 이름은 그대로 있어야 한다."""
    capabilities = _capabilities(client)
    for name in (
        "sync",
        "recordings",
        "analysis_jobs",
        "admin_ops",
        "user_accounts",
        "messenger_rooms",
        "messenger_attachments",
        "max_tree_note_level",
        "supported_note_types",
    ):
        assert name in capabilities, f"{name} capability가 사라졌습니다"


def test_worklog_note_type_is_declared(client: TestClient) -> None:
    """작업 일지는 선택형 기록이므로 note_type=worklog를 공식 지원 타입으로 알려야 한다."""
    capabilities = _capabilities(client)
    assert "worklog" in capabilities["supported_note_types"]
    assert capabilities["worklog_mail_recipients_api"] is True


def test_tree_depth_capability_matches_validation(client: TestClient) -> None:
    """선언한 계층 깊이와 서버가 실제로 막는 깊이가 같아야 한다."""
    from app.core.capabilities import MAX_TREE_NOTE_LEVEL

    capabilities = _capabilities(client)
    assert capabilities["max_tree_note_level"] == MAX_TREE_NOTE_LEVEL

    over_limit = client.post(
        "/api/v1/notes",
        json={
            "owner_id": "sinsan",
            "device_id": "cap-test-device",
            "local_id": "cap-over-limit",
            "note_type": "tree",
            "title": "깊이 초과",
            "parent_local_id": "cap-parent",
            "level": MAX_TREE_NOTE_LEVEL + 1,
        },
    )
    assert over_limit.status_code == 422


def test_note_move_and_sketch_capabilities_are_not_claimed(client: TestClient) -> None:
    """아직 P축에서 구현하지 않은 기능은 False여야 한다. API가 생기기 전에 True로 바꾸지 않는다.

    app_update_info는 P10에서 GET /api/v1/app/release로, sync_status_api는
    P8에서 GET /api/v1/sync/status로, note_attachments/sketch_attachments는
    P12에서 POST/GET /api/v1/notes/attachments로 실제 구현됐으므로 이 목록에서
    빠진다. 각각 test_app_update_info_capability_is_real,
    test_sync_status_capability_is_real, test_note_attachments_capability_is_real이
    그 값을 검증한다.
    """
    capabilities = _capabilities(client)
    assert capabilities["note_move_api"] is False


def test_declared_unsupported_endpoints_really_absent() -> None:
    """False로 선언한 기능의 경로가 실제로 없는지 라우팅 표로 확인한다."""
    from app.main import app

    paths = {getattr(route, "path", "") for route in app.routes}
    assert not any(path.endswith("/move") for path in paths)
    assert "/api/v1/notes/{local_id}/attachments" not in paths


def test_app_update_info_capability_is_real(client: TestClient) -> None:
    """app_update_info 선언이 True면 GET /api/v1/app/release가 실제로 응답해야 한다."""
    assert _capabilities(client)["app_update_info"] is True
    res = client.get("/api/v1/app/release")
    assert res.status_code == 200
    body = res.json()
    assert body["latest_version"]
    assert body["downloads"]["windows_installer"]
    assert body["downloads"]["android_apk"]


def test_note_tree_parent_validation_capability_is_real(client: TestClient) -> None:
    """계층 검증 선언 — 부모 없는 하위 노트는 서버가 막아야 한다."""
    assert _capabilities(client)["note_tree_parent_validation"] is True
    res = client.post(
        "/api/v1/notes",
        json={
            "owner_id": "sinsan",
            "device_id": "cap-test-device",
            "local_id": "cap-orphan",
            "note_type": "tree",
            "title": "부모 없는 하위 노트",
            "level": 2,
        },
    )
    assert res.status_code == 400


def test_sync_status_capability_is_real(client: TestClient) -> None:
    """sync_status_api 선언이 True면 GET /api/v1/sync/status가 실제로 응답해야 한다."""
    assert _capabilities(client)["sync_status_api"] is True
    res = client.get(
        "/api/v1/sync/status",
        params={"owner_id": "sinsan", "device_id": "cap-test-device"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["owner_id"] == "sinsan"
    assert body["device_id"] == "cap-test-device"
    assert "last_synced_at" in body
    assert "last_sync_succeeded" in body


def test_note_attachments_capability_is_real(client: TestClient, user_sinsan) -> None:
    """note_attachments/sketch_attachments 선언이 True면 업로드·다운로드가 실제로 동작해야 한다."""
    owner_id, token = user_sinsan
    assert _capabilities(client)["note_attachments"] is True
    assert _capabilities(client)["sketch_attachments"] is True

    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    upload_res = client.post(
        "/api/v1/notes/attachments",
        params={"owner_id": owner_id},
        files={"file": ("cap-test.png", png_bytes, "image/png")},
        headers={"X-Now-Web-Session": token},
    )
    assert upload_res.status_code == 200
    storage_key = upload_res.json()["attachment"]["storage_key"]

    download_res = client.get(
        f"/api/v1/notes/attachments/{storage_key}",
        params={"owner_id": owner_id},
        headers={"X-Now-Web-Session": token},
    )
    assert download_res.status_code == 200
    assert download_res.content == png_bytes


def test_sync_server_time_capability_is_real(client: TestClient, user_sinsan) -> None:
    owner_id, token = user_sinsan
    assert _capabilities(client)["sync_server_time"] is True
    res = client.post(
        "/api/v1/sync",
        json={"owner_id": owner_id, "device_id": "cap-test-device", "notes": []},
        headers={"X-Now-Web-Session": token},
    )
    assert res.status_code == 200
    assert res.json()["server_time"]


def test_messenger_attachment_limits_match_upload_policy(client: TestClient) -> None:
    """선언한 첨부 제한값이 업로드 검증이 쓰는 정책과 같아야 한다."""
    from app.services.messenger_storage import messenger_upload_policy

    capabilities = _capabilities(client)
    policy = messenger_upload_policy()
    assert capabilities["messenger_max_upload_bytes"] == policy["max_size_bytes"]
    assert capabilities["messenger_allowed_extensions"] == policy["allowed_extensions"]
    assert capabilities["messenger_allowed_mime_types"] == policy["allowed_mime_types"]
    assert capabilities["messenger_image_extensions"] == policy["image_extensions"]
    assert capabilities["messenger_upload_policy"] is True
    assert capabilities["messenger_attachment_metadata"] is True


def test_messenger_policy_endpoint_matches_capabilities(client: TestClient) -> None:
    capabilities = _capabilities(client)
    res = client.get("/api/v1/messenger/policy")
    assert res.status_code == 200
    policy = res.json()
    assert policy["max_size_bytes"] == capabilities["messenger_max_upload_bytes"]
    assert policy["allowed_extensions"] == capabilities["messenger_allowed_extensions"]


def test_connection_probe_endpoints_answer_without_auth(client: TestClient) -> None:
    """사설망 연결 판정 근거로 선언한 경로가 실제로 무인증 응답을 준다."""
    capabilities = _capabilities(client)
    assert capabilities["connection_probe"] is True
    endpoints = capabilities["connection_probe_endpoints"]
    assert endpoints == ["/health", "/health/ready", "/api/v1/server"]
    for path in endpoints:
        res = client.get(path)
        assert res.status_code == 200, f"{path} 무인증 호출이 실패했습니다"
        assert res.json()["status"] in {"ok", "ready"}


def test_capabilities_are_json_serializable_copies() -> None:
    """호출자가 받은 리스트를 고쳐도 서버 상수가 오염되지 않아야 한다."""
    from app.core.capabilities import SUPPORTED_NOTE_TYPES, server_capabilities

    first = server_capabilities()
    first["supported_note_types"].append("oops")
    first["connection_probe_endpoints"].append("/oops")
    second = server_capabilities()
    assert second["supported_note_types"] == SUPPORTED_NOTE_TYPES
    assert second["connection_probe_endpoints"] == ["/health", "/health/ready", "/api/v1/server"]
