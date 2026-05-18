import argparse
import base64
import hashlib
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4


USER_TOKEN: str | None = None
API_VERSION = "v1"


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
    if USER_TOKEN:
        headers["X-Now-User-Token"] = USER_TOKEN
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
    if USER_TOKEN:
        headers["X-Now-User-Token"] = USER_TOKEN
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
    global USER_TOKEN
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8750")
    parser.add_argument("--token", default=None)
    parser.add_argument(
        "--user-token",
        default=None,
        help="Per-user access token used when NOW_USER_TOKEN_REQUIRED=true",
    )
    parser.add_argument(
        "--issue-local-user-token",
        action="store_true",
        help="Issue a fresh local_user token through the admin API before data checks",
    )
    args = parser.parse_args()
    USER_TOKEN = args.user_token

    base_url = args.base_url.rstrip("/")
    checks = [
        ("GET", "/health", None),
        ("GET", "/health/ready", None),
        ("GET", "/api/v1/server", None),
    ]

    for method, path, payload in checks:
        status, data = request(method, f"{base_url}{path}", args.token, payload)
        if path == "/api/v1/server":
            require(data.get("api_version") == API_VERSION, "서버 API 버전이 올바르지 않습니다")
            capabilities = data.get("capabilities", {})
            require(capabilities.get("sync") is True, "서버 capability에 sync가 없습니다")
            require(capabilities.get("recordings") is True, "서버 capability에 recordings가 없습니다")
            require(capabilities.get("analysis_jobs") is True, "서버 capability에 analysis_jobs가 없습니다")
            require(capabilities.get("admin_ops") is True, "서버 capability에 admin_ops가 없습니다")
            require(capabilities.get("backup_export") is True, "서버 capability에 backup_export가 없습니다")
            require(capabilities.get("backup_verify") is True, "서버 capability에 backup_verify가 없습니다")
            require(capabilities.get("user_accounts") is True, "서버 capability에 user_accounts가 없습니다")
            require(capabilities.get("user_profile") is True, "서버 capability에 user_profile이 없습니다")
            require(capabilities.get("user_timezone") is True, "서버 capability에 user_timezone이 없습니다")
            require(capabilities.get("user_groups") is True, "서버 capability에 user_groups가 없습니다")
            require(capabilities.get("user_access_tokens") is True, "서버 capability에 user_access_tokens가 없습니다")
            require(capabilities.get("two_factor_status") is True, "서버 capability에 two_factor_status가 없습니다")
            require(capabilities.get("two_factor_auth") == "planned", "서버 capability의 two_factor_auth 상태가 planned가 아닙니다")
            require(capabilities.get("max_tree_note_level") == 3, "서버 capability의 max_tree_note_level이 3이 아닙니다")
            require(
                capabilities.get("supported_note_types") == ["daily", "tree", "record"],
                "서버 capability의 supported_note_types가 예상과 다릅니다",
            )
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
        "/admin/recovery",
        "/admin/deploy",
        "/admin/users",
        "/admin/users/new",
        "/admin/users?status=inactive",
        "/admin/users?status=never_seen&q=smoke",
        "/admin/users?group=테스트",
        "/admin/users?token=missing",
    ]
    for path in admin_pages:
        status, text = request_text("GET", f"{base_url}{path}", args.token)
        if path == "/admin/export":
            require("/api/v1/admin/export/verify" in text, "내보내기 화면에 백업 검증 API 안내가 없습니다")
            require("YOUR_ADMIN_TOKEN" in text, "내보내기 화면에 백업 검증 요청 예시가 없습니다")
        if path == "/admin/recovery":
            require("NowNote 서버 복구 절차" in text, "복구 절차 화면에 RECOVERY.md 내용이 없습니다")
            require("/api/v1/admin/export/verify" in text, "복구 절차 화면에 백업 검증 API 안내가 없습니다")
        if path == "/admin/deploy":
            require("NowNote 서버 배포 체크리스트" in text, "배포 체크리스트 화면에 DEPLOY.md 내용이 없습니다")
            require("git pull origin main" in text, "배포 체크리스트 화면에 소스 갱신 안내가 없습니다")
        if path == "/admin/help":
            require("공용 서버 로그인 화면" in text, "도움말 화면에 공용 서버 로그인 화면 점검 안내가 없습니다")
            require("/admin/deploy" in text, "도움말 화면에 배포 체크리스트 링크가 없습니다")
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

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/summary",
        args.token,
    )
    require(data.get("name") == "export_summary", "내보내기 요약 이름이 export_summary가 아닙니다")
    require("notes" in data.get("items", {}), "내보내기 요약에 메모 건수가 없습니다")
    print(
        "GET /api/v1/admin/export/summary:",
        status,
        {
            "notes": data.get("items", {}).get("notes"),
            "recordings": data.get("items", {}).get("recordings"),
            "users": data.get("items", {}).get("users"),
        },
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/all",
        args.token,
    )
    require(data.get("name") == "now_note_server_backup", "전체 백업 이름이 올바르지 않습니다")
    require(data.get("backup_schema_version") == 1, "전체 백업 스키마 버전이 올바르지 않습니다")
    require(data.get("api_version") == API_VERSION, "전체 백업 API 버전이 올바르지 않습니다")
    require(data.get("includes_recording_files") is False, "전체 백업의 녹음 파일 포함 여부가 올바르지 않습니다")
    require(data.get("includes_deleted_notes") is True, "전체 백업의 삭제 표시 메모 포함 여부가 올바르지 않습니다")
    require(
        re.fullmatch(r"[0-9a-f]{64}", data.get("content_sha256", "") or "") is not None,
        "전체 백업 체크섬 형식이 올바르지 않습니다",
    )
    checksum_payload = dict(data)
    checksum = checksum_payload.pop("content_sha256", "")
    recalculated_checksum = hashlib.sha256(
        json.dumps(
            checksum_payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    require(checksum == recalculated_checksum, "전체 백업 체크섬이 본문 내용과 일치하지 않습니다")
    require("notes" in data.get("items", {}), "전체 백업에 메모 항목이 없습니다")
    full_backup = data
    print(
        "GET /api/v1/admin/export/all:",
        status,
        {
            "notes": len(data.get("items", {}).get("notes", [])),
            "recordings": len(data.get("items", {}).get("recordings", [])),
            "users": len(data.get("items", {}).get("users", [])),
        },
    )

    status, data = request(
        "POST",
        f"{base_url}/api/v1/admin/export/verify",
        args.token,
        {"backup": full_backup},
    )
    require(data.get("status") == "ok", "전체 백업 검증 API가 실패했습니다")
    require("notes" in data.get("summary", {}), "전체 백업 검증 요약에 메모 건수가 없습니다")
    print(
        "POST /api/v1/admin/export/verify:",
        status,
        {
            "status": data.get("status"),
            "checks": len(data.get("checks", [])),
            "notes": data.get("summary", {}).get("notes"),
        },
    )

    status, data = request(
        "POST",
        f"{base_url}/api/v1/admin/export/verify",
        args.token,
        {"backup": {}},
    )
    require(data.get("status") == "bad", "빈 백업 검증이 실패 상태를 반환하지 않았습니다")
    require(len(data.get("checks", [])) >= 1, "빈 백업 검증 결과가 비어 있습니다")
    print(
        "POST /api/v1/admin/export/verify(empty):",
        status,
        {"status": data.get("status"), "checks": len(data.get("checks", []))},
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/ops", args.token)
    ops_check_names = {item.get("name") for item in data.get("checks", [])}
    require("공용 서버 로그인 화면" in ops_check_names, "운영 점검에 공용 서버 로그인 화면 항목이 없습니다")
    require("공용 서버 2단계 인증" in ops_check_names, "운영 점검에 공용 서버 2단계 인증 항목이 없습니다")
    require("공개 운영 환경" in ops_check_names, "운영 점검에 공개 운영 환경 항목이 없습니다")
    print(
        "GET /api/v1/admin/ops:",
        status,
        {
            "status": data.get("status"),
            "checks": len(data.get("checks", [])),
        },
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/users?token=missing", args.token)
    require("token_missing" in data, "사용자 토큰 미발급 집계가 없습니다")
    print(
        "GET /api/v1/admin/users(token=missing):",
        status,
        {"count": data.get("count"), "token_missing": data.get("token_missing")},
    )

    if args.issue_local_user_token:
        status, data = request_error(
            "POST",
            f"{base_url}/api/v1/admin/users",
            args.token,
            {
                "owner_id": "local_user",
                "email": "local_user@example.com",
                "display_name": "Local User",
                "timezone": "Asia/Seoul",
                "group_name": "사용자",
                "two_factor_enabled": False,
                "is_active": True,
            },
        )
        require(status in (200, 409), "local_user 생성 API 응답이 예상과 다릅니다")
        status, data = request(
            "POST",
            f"{base_url}/api/v1/admin/users/local_user/token",
            args.token,
        )
        USER_TOKEN = data.get("token")
        require(USER_TOKEN and len(USER_TOKEN) >= 32, "local_user 사용자별 토큰 발급에 실패했습니다")
        print(
            "POST /api/v1/admin/users/local_user/token:",
            status,
            {"owner_id": data.get("owner_id"), "issued": bool(USER_TOKEN)},
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
    status, data = request(
        "POST",
        f"{base_url}/api/v1/admin/users/smoke_admin_user/token",
        args.token,
    )
    require(status == 200, "사용자별 토큰 발급 API가 실패했습니다")
    require(len(data.get("token", "")) >= 32, "사용자별 토큰 길이가 너무 짧습니다")
    issued_smoke_token = data.get("token", "")
    print(
        "POST /api/v1/admin/users/{owner_id}/token:",
        status,
        {"owner_id": data.get("owner_id"), "issued": bool(data.get("token"))},
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/users?token=issued", args.token)
    require(data.get("token_issued", 0) >= 1, "사용자 토큰 발급 집계가 증가하지 않았습니다")
    print(
        "GET /api/v1/admin/users(token=issued):",
        status,
        {"count": data.get("count"), "token_issued": data.get("token_issued")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/all",
        args.token,
    )
    exported_users = data.get("items", {}).get("users", [])
    require(
        all("access_token_hash" not in user for user in exported_users),
        "전체 백업에 사용자 토큰 해시가 포함되었습니다",
    )
    require(
        issued_smoke_token not in json.dumps(exported_users, ensure_ascii=False),
        "전체 백업에 사용자 토큰 원문이 포함되었습니다",
    )
    print(
        "GET /api/v1/admin/export/all(token_safety):",
        status,
        {"users": len(exported_users), "token_hash_hidden": True},
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

    if USER_TOKEN:
        status, data = request("GET", f"{base_url}/api/v1/admin/users?owner_id=local_user", args.token)
        items = data.get("items", []) if isinstance(data, dict) else []
        last_used_at = items[0].get("access_token_last_used_at") if items else None
        require(last_used_at is not None, "사용자별 토큰 마지막 사용 시각이 갱신되지 않았습니다")
        print(
            "GET /api/v1/admin/users(owner_id=local_user token_used):",
            status,
            {"access_token_last_used_at": last_used_at},
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
