import argparse
import base64
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def request(method: str, url: str, token: str | None = None, data: dict | None = None):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as res:
        text = res.read().decode("utf-8")
        return res.status, json.loads(text) if text else None


def request_error(method: str, url: str, token: str | None = None, data: dict | None = None):
    try:
        return request(method, url, token, data)
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        try:
            return e.code, json.loads(text) if text else None
        except json.JSONDecodeError:
            return e.code, {"detail": text}


def request_multipart(
    url: str,
    token: str | None,
    fields: dict[str, str],
    file_field: str,
    file_name: str,
    content_type: str,
    file_bytes: bytes,
):
    boundary = f"----nownote-smoke-{uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                str(value).encode("utf-8"),
                b"\r\n",
            ]
        )
    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="{file_field}"; '
                f'filename="{file_name}"\r\n'
            ).encode("utf-8"),
            f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
            file_bytes,
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=b"".join(chunks), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as res:
        text = res.read().decode("utf-8")
        return res.status, json.loads(text) if text else None


def request_text(method: str, url: str, token: str | None = None):
    headers = {}
    if token:
        encoded = base64.b64encode(f"admin:{token}".encode("utf-8")).decode("ascii")
        headers["Authorization"] = f"Basic {encoded}"
    req = urllib.request.Request(url, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=10) as res:
        text = res.read().decode("utf-8")
        return res.status, text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8750")
    parser.add_argument("--token", default=None)
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    checks = [
        ("GET", "/health", None),
        ("GET", "/health/ready", None),
        ("GET", "/api/v1/server", None),
    ]

    for method, path, payload in checks:
        status, data = request(method, f"{base_url}{path}", args.token, payload)
        print(f"{method} {path}: {status} {data}")

    admin_pages = [
        "/monitor",
        "/admin",
        "/admin/notes",
        "/admin/recordings",
        "/admin/recordings?owner_id=local_user",
        "/admin/recordings?device_id=smoke_test&transcript=without",
        "/admin/devices",
        "/admin/sync",
        "/admin/sync?owner_id=local_user",
        "/admin/sync?device_id=smoke_test&include_deleted=yes",
        "/admin/ops",
        "/admin/export",
        "/admin/users",
        "/admin/users/new",
        "/admin/users?status=inactive",
        "/admin/users?status=never_seen&q=smoke",
        "/admin/users?group=테스트",
    ]
    for path in admin_pages:
        status, text = request_text("GET", f"{base_url}{path}", args.token)
        print(f"GET {path}: {status} html={len(text)} bytes")

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/notes?include_deleted=false",
        args.token,
    )
    print(
        "GET /api/v1/admin/export/notes:",
        status,
        {"count": data.get("count"), "name": data.get("name")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/recordings?device_id=smoke_test&transcript_status=without",
        args.token,
    )
    require(data.get("name") == "recordings", "녹음 export 이름이 recordings가 아닙니다")
    print(
        "GET /api/v1/admin/export/recordings(filtered):",
        status,
        {"count": data.get("count"), "name": data.get("name")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/sync-logs?device_id=smoke_test&include_deleted=true",
        args.token,
    )
    require(data.get("name") == "sync_logs", "동기화 이력 export 이름이 sync_logs가 아닙니다")
    print(
        "GET /api/v1/admin/export/sync-logs(filtered):",
        status,
        {"count": data.get("count"), "name": data.get("name")},
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/ops", args.token)
    print(
        "GET /api/v1/admin/ops:",
        status,
        {
            "status": data.get("status"),
            "checks": len(data.get("checks", [])),
        },
    )

    status, data = request_error(
        "POST",
        f"{base_url}/api/v1/admin/users",
        args.token,
        {
            "owner_id": "smoke_admin_user",
            "email": "smoke_admin_user@example.com",
            "display_name": "Smoke Admin User",
            "timezone": "Asia/Seoul",
            "group_name": "테스트",
            "two_factor_enabled": False,
            "is_active": True,
        },
    )
    require(status in (200, 409), "관리자 사용자 생성 API 응답이 예상과 다릅니다")
    print(
        "POST /api/v1/admin/users:",
        status,
        {
            "status": data.get("status") if isinstance(data, dict) else None,
            "detail": data.get("detail") if isinstance(data, dict) else None,
        },
    )

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    sync_payload = {
        "owner_id": "local_user",
        "device_id": "smoke_test",
        "updated_after": None,
        "include_deleted": True,
        "notes": [
            {
                "owner_id": "local_user",
                "device_id": "smoke_test",
                "local_id": "smoke_note_001",
                "note_type": "daily",
                "title": "Smoke test memo",
                "content": "NowNote server smoke test",
                "parent_local_id": None,
                "level": 1,
                "tags": "test=smoke",
                "source": "smoke_test",
                "client_updated_at": now,
                "deleted_at": None,
            }
        ],
    }
    status, data = request("POST", f"{base_url}/api/v1/sync", args.token, sync_payload)
    print(
        "POST /api/v1/sync:",
        status,
        {
            "pushed": len(data.get("pushed_notes", [])),
            "pulled": len(data.get("pulled_notes", [])),
            "server_time": data.get("server_time"),
        },
    )

    recording_local_id = f"smoke_recording_{now.replace(':', '').replace('-', '').replace('T', '_')}"
    status, data = request_multipart(
        f"{base_url}/api/v1/recordings",
        args.token,
        {
            "owner_id": "local_user",
            "device_id": "smoke_test",
            "local_id": recording_local_id,
            "note_local_id": "smoke_note_001",
            "transcript": "Smoke recording transcript",
        },
        "file",
        "smoke-recording.webm",
        "audio/webm",
        b"NowNote smoke recording bytes",
    )
    require(data.get("local_id") == recording_local_id, "녹음 업로드 local_id가 일치하지 않습니다")
    print(
        "POST /api/v1/recordings:",
        status,
        {
            "local_id": data.get("local_id"),
            "content_type": data.get("content_type"),
        },
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/recordings?owner_id=local_user",
        args.token,
    )
    has_recording = any(item.get("local_id") == recording_local_id for item in data)
    require(has_recording, "업로드한 녹음이 목록에서 확인되지 않았습니다")
    print(
        "GET /api/v1/recordings:",
        status,
        {"has_recording": has_recording, "count": len(data)},
    )

    deleted_local_id = f"smoke_deleted_{now.replace(':', '').replace('-', '').replace('T', '_')}"
    deleted_note = {
        "owner_id": "local_user",
        "device_id": "smoke_test",
        "local_id": deleted_local_id,
        "note_type": "tree",
        "title": "삭제 동기화 검증 메모",
        "content": "삭제 후 동기화 처리 확인용",
        "parent_local_id": None,
        "level": 1,
        "tags": "kind=tree;level=1;owner=smoke",
        "source": "smoke_test",
        "client_updated_at": now,
        "deleted_at": now,
    }
    status, data = request(
        "POST",
        f"{base_url}/api/v1/sync",
        args.token,
        {
            "owner_id": "local_user",
            "device_id": "smoke_test",
            "updated_after": None,
            "include_deleted": True,
            "notes": [deleted_note],
        },
    )
    deleted_payload = data.get("pushed_notes", [])
    deleted_pulled = data.get("pulled_notes", [])
    print(
        "POST /api/v1/sync(deleted_note):",
        status,
        {
            "pushed": len(deleted_payload),
            "pulled": len(deleted_pulled),
            "is_deleted": bool(deleted_payload and deleted_payload[0].get("deleted_at")),
            "server_time": data.get("server_time"),
        },
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/notes?include_deleted=true",
        args.token,
    )
    has_deleted_item = any(
        item.get("local_id") == deleted_local_id and item.get("deleted_at") is not None
        for item in data.get("items", [])
    )
    require(has_deleted_item, "삭제 처리한 메모가 include_deleted 조회에서 확인되지 않았습니다")
    print(
        "GET /api/v1/admin/export/notes(include_deleted):",
        status,
        {"has_deleted_item": has_deleted_item, "count": data.get("count")},
    )
    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/notes?include_deleted=false",
        args.token,
    )
    has_deleted_item_hidden = any(
        item.get("local_id") == deleted_local_id for item in data.get("items", [])
    )
    require(not has_deleted_item_hidden, "삭제 처리한 메모가 exclude_deleted 조회에도 노출됩니다")
    print(
        "GET /api/v1/admin/export/notes(exclude_deleted):",
        status,
        {"is_hidden": not has_deleted_item_hidden, "count": data.get("count")},
    )

    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/users/local_user",
        args.token,
        {
            "email": "local_user@example.com",
            "display_name": "Local User",
            "timezone": "Asia/Seoul",
        },
    )
    require(data.get("status") == "ok", "사용자 프로필 수정 응답 상태가 ok가 아닙니다")
    require(data.get("user", {}).get("owner_id") == "local_user", "사용자 프로필 owner_id가 일치하지 않습니다")
    print(
        "PATCH /api/v1/users/local_user:",
        status,
        {"status": data.get("status"), "owner_id": data.get("user", {}).get("owner_id")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/users/local_user",
        args.token,
    )
    require(data.get("status") == "ok", "사용자 프로필 조회 응답 상태가 ok가 아닙니다")
    require(data.get("user", {}).get("timezone") == "Asia/Seoul", "사용자 프로필 시간대가 저장되지 않았습니다")
    print(
        "GET /api/v1/users/local_user:",
        status,
        {
            "status": data.get("status"),
            "timezone": data.get("user", {}).get("timezone"),
        },
    )

    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/users/local_user",
        args.token,
        {
            "email": "local_user@example.com",
            "display_name": "Local User",
            "timezone": "Asia/Seoul",
        },
    )
    require(data.get("status") == "ok", "사용자 프로필 두 번째 수정 응답 상태가 ok가 아닙니다")
    require(data.get("user", {}).get("timezone") == "Asia/Seoul", "사용자 프로필 두 번째 수정 시간대가 일치하지 않습니다")
    print(
        "PATCH /api/v1/users/local_user(second):",
        status,
        {
            "status": data.get("status"),
            "timezone": data.get("user", {}).get("timezone"),
        },
    )

    status, data = request(
        "POST",
        f"{base_url}/api/v1/analysis/jobs",
        args.token,
        {
            "owner_id": "local_user",
            "job_type": "memo_summary",
            "note_local_id": "smoke_note_001",
            "input_text": "Smoke test memo\n\nNowNote server smoke test",
        },
    )
    analysis_job_id = data.get("id")
    require(analysis_job_id is not None, "분석 작업 ID가 반환되지 않았습니다")
    print(
        "POST /api/v1/analysis/jobs:",
        status,
        {
            "id": analysis_job_id,
            "status": data.get("status"),
            "job_type": data.get("job_type"),
        },
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/analysis/jobs?owner_id=local_user",
        args.token,
    )
    has_analysis_job = any(item.get("id") == analysis_job_id for item in data)
    require(has_analysis_job, "생성한 분석 작업이 목록에서 확인되지 않았습니다")
    print(
        "GET /api/v1/analysis/jobs:",
        status,
        {"has_analysis_job": has_analysis_job, "count": len(data)},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/analysis/jobs/{analysis_job_id}",
        args.token,
    )
    require(data.get("id") == analysis_job_id, "분석 작업 단건 조회 ID가 일치하지 않습니다")
    print(
        "GET /api/v1/analysis/jobs/{id}:",
        status,
        {"id": data.get("id"), "status": data.get("status")},
    )

    inactive_payload = {
        "email": "local_user@example.com",
        "display_name": "Local User",
        "timezone": "Asia/Seoul",
        "group_name": "사용자",
        "two_factor_enabled": False,
        "is_active": False,
    }
    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/admin/users/local_user",
        args.token,
        inactive_payload,
    )
    require(data.get("user", {}).get("is_active") is False, "사용자 비활성 상태가 저장되지 않았습니다")
    print(
        "PATCH /api/v1/admin/users/local_user(inactive):",
        status,
        {"is_active": data.get("user", {}).get("is_active")},
    )

    status, data = request_error("POST", f"{base_url}/api/v1/sync", args.token, sync_payload)
    require(status == 403, "비활성 사용자의 동기화 요청이 차단되지 않았습니다")
    print(
        "POST /api/v1/sync(inactive_user):",
        status,
        {"detail": data.get("detail") if isinstance(data, dict) else None},
    )

    active_payload = {
        **inactive_payload,
        "is_active": True,
    }
    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/admin/users/local_user",
        args.token,
        active_payload,
    )
    require(data.get("user", {}).get("is_active") is True, "사용자 활성 상태가 복구되지 않았습니다")
    print(
        "PATCH /api/v1/admin/users/local_user(active):",
        status,
        {"is_active": data.get("user", {}).get("is_active")},
    )


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8')}")
        raise
