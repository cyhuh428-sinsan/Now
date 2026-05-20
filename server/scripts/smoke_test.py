import argparse
import base64
import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4


USER_TOKEN: str | None = None
USER_TOKEN_REQUIRED = False
REQUEST_TIMEOUT = 10.0
API_VERSION = "v1"
TWO_FACTOR_AUTH_STATUS = "planned"
MAX_TREE_NOTE_LEVEL = 3
SUPPORTED_NOTE_TYPES = ["daily", "tree", "record"]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def request(method: str, url: str, token: str | None = None, data: dict | None = None):
    return request_with_user_token(method, url, token, data, USER_TOKEN)


def request_with_user_token(
    method: str,
    url: str,
    token: str | None = None,
    data: dict | None = None,
    user_token: str | None = None,
):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if user_token:
        headers["X-Now-User-Token"] = user_token
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
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


def request_error_with_user_token(
    method: str,
    url: str,
    token: str | None = None,
    data: dict | None = None,
    user_token: str | None = None,
):
    try:
        return request_with_user_token(method, url, token, data, user_token)
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
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        text = res.read().decode("utf-8")
        return res.status, json.loads(text) if text else None


def request_text(method: str, url: str, token: str | None = None):
    headers = {}
    if token:
        encoded = base64.b64encode(f"admin:{token}".encode("utf-8")).decode("ascii")
        headers["Authorization"] = f"Basic {encoded}"
    req = urllib.request.Request(url, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        text = res.read().decode("utf-8")
        return res.status, text


def wait_until_ready(base_url: str, token: str | None, retries: int, delay_seconds: float) -> None:
    for attempt in range(1, retries + 1):
        try:
            request("GET", f"{base_url}/health/ready", token)
            if retries > 1:
                print(f"GET /health/ready: ready after {attempt}/{retries}")
            return
        except (urllib.error.HTTPError, urllib.error.URLError) as exc:
            if attempt >= retries:
                raise
            print(f"GET /health/ready: waiting {attempt}/{retries} ({exc})")
            time.sleep(delay_seconds)


def main() -> None:
    global REQUEST_TIMEOUT, USER_TOKEN, USER_TOKEN_REQUIRED
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8750")
    parser.add_argument("--token", default=None)
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="HTTP request timeout seconds",
    )
    parser.add_argument(
        "--ready-retries",
        type=int,
        default=1,
        help="Number of readiness attempts before running full checks",
    )
    parser.add_argument(
        "--ready-delay",
        type=float,
        default=2.0,
        help="Seconds to wait between readiness attempts",
    )
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
    require(args.timeout > 0, "--timeout은 0보다 커야 합니다")
    require(args.ready_retries > 0, "--ready-retries는 0보다 커야 합니다")
    require(args.ready_delay >= 0, "--ready-delay는 0 이상이어야 합니다")
    REQUEST_TIMEOUT = args.timeout
    USER_TOKEN = args.user_token

    base_url = args.base_url.rstrip("/")
    wait_until_ready(base_url, args.token, args.ready_retries, args.ready_delay)
    checks = [
        ("GET", "/health", None),
        ("GET", "/health/ready", None),
        ("GET", "/api/v1/server", None),
    ]

    for method, path, payload in checks:
        status, data = request(method, f"{base_url}{path}", args.token, payload)
        if path == "/api/v1/server":
            require(data.get("api_version") == API_VERSION, "서버 API 버전이 올바르지 않습니다")
            USER_TOKEN_REQUIRED = bool(data.get("user_token_required"))
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
            require(
                capabilities.get("two_factor_auth") == TWO_FACTOR_AUTH_STATUS,
                "서버 capability의 two_factor_auth 상태가 planned가 아닙니다",
            )
            require(
                capabilities.get("max_tree_note_level") == MAX_TREE_NOTE_LEVEL,
                "서버 capability의 max_tree_note_level이 3이 아닙니다",
            )
            require(
                capabilities.get("supported_note_types") == SUPPORTED_NOTE_TYPES,
                "서버 capability의 supported_note_types가 예상과 다릅니다",
            )
        print(f"{method} {path}: {status} {data}")

    admin_pages = [
        "/monitor",
        "/admin",
        "/admin/notes",
        "/admin/notes?owner_id=local_user",
        "/admin/notes?note_type=daily&source=smoke_test",
        "/admin/notes?q=Smoke&include_deleted=no",
        "/admin/recordings",
        "/admin/analysis",
        "/admin/analysis?status=queued",
        "/admin/analysis?owner_id=local_user&job_type=summary",
        "/admin/recordings?owner_id=local_user",
        "/admin/recordings?device_id=smoke_test&transcript=without",
        "/admin/devices",
        "/admin/devices?owner_id=local_user",
        "/admin/devices?device_id=smoke_test&status=active",
        "/admin/devices?status=inactive",
        "/admin/sync",
        "/admin/sync?owner_id=local_user",
        "/admin/sync?device_id=smoke_test&include_deleted=yes",
        "/admin/ops",
        "/admin/export",
        "/admin/recovery",
        "/admin/deploy",
        "/admin/help",
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
            require("/api/v1/admin/export/devices" in text, "내보내기 화면에 기기 export 링크가 없습니다")
            require("등록 기기" in text, "내보내기 화면에 기기 집계가 없습니다")
            require("YOUR_ADMIN_TOKEN" in text, "내보내기 화면에 백업 검증 요청 예시가 없습니다")
            require("status=ok" in text, "내보내기 화면에 백업 검증 성공 기준 안내가 없습니다")
            require("status_counts.bad=0" in text, "내보내기 화면에 백업 검증 상태 집계 기준 안내가 없습니다")
            require("/admin/recovery" in text, "내보내기 화면에 복구 절차 안내가 없습니다")
            require("NOW_STORAGE_DIR" in text, "내보내기 화면에 원본 음성 파일 보존 안내가 없습니다")
        if path == "/admin/recovery":
            require("NowNote 서버 복구 절차" in text, "복구 절차 화면에 RECOVERY.md 내용이 없습니다")
            require("/api/v1/admin/export/verify" in text, "복구 절차 화면에 백업 검증 API 안내가 없습니다")
            require("bad" in text and "복구 작업을 시작하지 말고" in text, "복구 절차 화면에 bad 검증 결과 대응 기준이 없습니다")
            require("warn" in text and "/admin/ops" in text, "복구 절차 화면에 warn 검증 결과 대응 기준이 없습니다")
            require("/admin/ops" in text, "복구 절차 화면에 운영 점검 화면 안내가 없습니다")
        if path == "/admin/deploy":
            require("NowNote 서버 배포 체크리스트" in text, "배포 체크리스트 화면에 DEPLOY.md 내용이 없습니다")
            require("git pull origin main" in text, "배포 체크리스트 화면에 소스 갱신 안내가 없습니다")
            require("백업/복구 절차" in text, "배포 체크리스트 화면에 운영 점검 백업/복구 항목 안내가 없습니다")
            require("status_counts.bad=0" in text, "배포 체크리스트 화면에 백업 검증 집계 기준 안내가 없습니다")
            require("/admin/export" in text and "/admin/recovery" in text, "배포 체크리스트 화면에 백업/복구 화면 안내가 없습니다")
        if path.startswith("/admin/devices"):
            require("기기 활성 상태" in text, "기기 관리 화면에 활성 상태 안내가 없습니다")
            require("비활성 기기는 동기화" in text, "기기 관리 화면에 비활성 기기 차단 안내가 없습니다")
            require("/admin/devices/status" in text, "기기 관리 화면에 상태 변경 폼이 없습니다")
            require("현재 조건 JSON" in text, "기기 관리 화면에 현재 조건 JSON 링크가 없습니다")
            require("Owner ID" in text and "Device ID" in text, "기기 관리 화면에 owner/device 필터가 없습니다")
        if path.startswith("/admin/users"):
            require("현재 조건 JSON" in text, "사용자 관리 화면에 현재 조건 JSON 링크가 없습니다")
            require("Owner, 이메일, 표시 이름 검색" in text, "사용자 관리 화면에 검색 필터가 없습니다")
        if path.startswith("/admin/analysis"):
            require("현재 조건 JSON" in text, "분석 관리 화면에 현재 조건 JSON 링크가 없습니다")
            require("Owner ID" in text and "작업 유형" in text, "분석 관리 화면에 필터가 없습니다")
        if path.startswith("/admin/notes"):
            require("현재 조건 JSON" in text, "메모 관리 화면에 현재 조건 JSON 링크가 없습니다")
            require("Owner ID" in text and "제목/내용 검색" in text, "메모 관리 화면에 검색 필터가 없습니다")
            require("메모 타입" in text and "삭제 제외" in text, "메모 관리 화면에 타입/삭제 필터가 없습니다")
        if path == "/admin/ops":
            require("백업/복구 절차" in text, "운영 점검 화면에 백업/복구 절차 항목이 없습니다")
            require("status_counts.bad=0" in text, "운영 점검 화면에 백업 검증 집계 기준 안내가 없습니다")
            require("공용 서버 로그인 화면" in text, "운영 점검 화면에 공용 서버 로그인 화면 항목이 없습니다")
            require("공용 서버 2단계 인증" in text, "운영 점검 화면에 공용 서버 2단계 인증 항목이 없습니다")
            require("공용 서버 기기 등록" in text, "운영 점검 화면에 공용 서버 기기 등록 항목이 없습니다")
            require("공용 서버 데이터 격리" in text, "운영 점검 화면에 공용 서버 데이터 격리 항목이 없습니다")
            require("공개 운영 환경" in text, "운영 점검 화면에 공개 운영 환경 항목이 없습니다")
        if path == "/admin/help":
            require("공용 서버 로그인 화면" in text, "도움말 화면에 공용 서버 로그인 화면 점검 안내가 없습니다")
            require("기기 등록" in text, "도움말 화면에 공용 서버 기기 등록 점검 안내가 없습니다")
            require("데이터 격리" in text, "도움말 화면에 공용 서버 데이터 격리 점검 안내가 없습니다")
            require("/admin/deploy" in text, "도움말 화면에 배포 체크리스트 링크가 없습니다")
            require("배포 직후" in text and "/admin/export" in text, "도움말 화면에 배포 후 백업 확인 안내가 없습니다")
            require("bad" in text and "warn" in text and "/admin/ops" in text, "도움말 화면에 복구 검증 결과 대응 안내가 없습니다")
        print(f"GET {path}: {status} html={len(text)} bytes")

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/notes?include_deleted=false&note_type=daily&source=smoke_test&q=Smoke",
        args.token,
    )
    require(data.get("name") == "notes", "메모 export 이름이 notes가 아닙니다")
    print(
        "GET /api/v1/admin/export/notes(filtered):",
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
        f"{base_url}/api/v1/admin/export/devices?status=active",
        args.token,
    )
    require(data.get("name") == "devices", "기기 export 이름이 devices가 아닙니다")
    print(
        "GET /api/v1/admin/export/devices:",
        status,
        {"count": data.get("count"), "name": data.get("name")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/users?token=missing",
        args.token,
    )
    require(data.get("name") == "users", "사용자 export 이름이 users가 아닙니다")
    print(
        "GET /api/v1/admin/export/users(filtered):",
        status,
        {"count": data.get("count"), "name": data.get("name")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/analysis-jobs?status=queued",
        args.token,
    )
    require(data.get("name") == "analysis_jobs", "분석 작업 export 이름이 analysis_jobs가 아닙니다")
    print(
        "GET /api/v1/admin/export/analysis-jobs(filtered):",
        status,
        {"count": data.get("count"), "name": data.get("name")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/summary",
        args.token,
    )
    require(data.get("name") == "export_summary", "내보내기 요약 이름이 export_summary가 아닙니다")
    summary_items = data.get("items", {})
    require("notes" in summary_items, "내보내기 요약에 메모 건수가 없습니다")
    require("devices" in summary_items, "내보내기 요약에 기기 건수가 없습니다")
    require("total_export_items" in summary_items, "내보내기 요약에 전체 export 건수가 없습니다")
    summed_items = sum(
        int(summary_items.get(name, 0) or 0)
        for name in ["notes", "recordings", "users", "devices", "analysis_jobs", "sync_logs"]
    )
    require(
        summary_items.get("total_export_items") == summed_items,
        "내보내기 요약의 전체 export 건수가 항목 합계와 다릅니다",
    )
    print(
        "GET /api/v1/admin/export/summary:",
        status,
        {
            "notes": summary_items.get("notes"),
            "recordings": summary_items.get("recordings"),
            "users": summary_items.get("users"),
            "devices": summary_items.get("devices"),
            "total_export_items": summary_items.get("total_export_items"),
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
    require("devices" in data.get("items", {}), "전체 백업에 기기 항목이 없습니다")
    full_backup = data
    print(
        "GET /api/v1/admin/export/all:",
        status,
        {
            "notes": len(data.get("items", {}).get("notes", [])),
            "recordings": len(data.get("items", {}).get("recordings", [])),
            "users": len(data.get("items", {}).get("users", [])),
            "devices": len(data.get("items", {}).get("devices", [])),
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
    require("devices" in data.get("summary", {}), "전체 백업 검증 요약에 기기 건수가 없습니다")
    require(data.get("status_counts", {}).get("bad") == 0, "전체 백업 검증 결과에 bad가 있습니다")
    require(data.get("status_counts", {}).get("ok", 0) >= 1, "전체 백업 검증 결과의 ok 집계가 없습니다")
    print(
        "POST /api/v1/admin/export/verify:",
        status,
        {
            "status": data.get("status"),
            "checks": len(data.get("checks", [])),
            "notes": data.get("summary", {}).get("notes"),
            "status_counts": data.get("status_counts"),
        },
    )

    missing_devices_backup = json.loads(json.dumps(full_backup))
    missing_devices_backup.get("items", {}).pop("devices", None)
    missing_devices_backup.pop("content_sha256", None)
    missing_devices_backup["content_sha256"] = hashlib.sha256(
        json.dumps(
            missing_devices_backup,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    status, data = request(
        "POST",
        f"{base_url}/api/v1/admin/export/verify",
        args.token,
        {"backup": missing_devices_backup},
    )
    item_check = next((item for item in data.get("checks", []) if item.get("name") == "백업 항목"), {})
    require(data.get("status") == "bad", "기기 항목이 빠진 백업 검증이 실패 상태를 반환하지 않았습니다")
    require("devices" in str(item_check.get("actual", "")), "기기 누락 백업 검증이 devices 누락을 표시하지 않습니다")
    print(
        "POST /api/v1/admin/export/verify(missing-devices):",
        status,
        {"status": data.get("status"), "item_check": item_check.get("actual")},
    )

    status, data = request(
        "POST",
        f"{base_url}/api/v1/admin/export/verify",
        args.token,
        {"backup": {}},
    )
    require(data.get("status") == "bad", "빈 백업 검증이 실패 상태를 반환하지 않았습니다")
    require(len(data.get("checks", [])) >= 1, "빈 백업 검증 결과가 비어 있습니다")
    require(data.get("status_counts", {}).get("bad", 0) >= 1, "빈 백업 검증 결과의 bad 집계가 없습니다")
    print(
        "POST /api/v1/admin/export/verify(empty):",
        status,
        {"status": data.get("status"), "checks": len(data.get("checks", []))},
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/ops", args.token)
    ops_check_names = {item.get("name") for item in data.get("checks", [])}
    public_auth_check = next(
        (item for item in data.get("checks", []) if item.get("name") == "공용 서버 인증"),
        {},
    )
    require("공용 서버 로그인 화면" in ops_check_names, "운영 점검에 공용 서버 로그인 화면 항목이 없습니다")
    require("공용 서버 2단계 인증" in ops_check_names, "운영 점검에 공용 서버 2단계 인증 항목이 없습니다")
    require("공용 서버 기기 등록" in ops_check_names, "운영 점검에 공용 서버 기기 등록 항목이 없습니다")
    require("공용 서버 데이터 격리" in ops_check_names, "운영 점검에 공용 서버 데이터 격리 항목이 없습니다")
    require("공개 운영 환경" in ops_check_names, "운영 점검에 공개 운영 환경 항목이 없습니다")
    require("공용 서버 인증" in ops_check_names, "운영 점검에 공용 서버 인증 항목이 없습니다")
    require("users_without_token" in data.get("summary", {}), "운영 점검 요약에 토큰 없는 사용자 집계가 없습니다")
    require(
        "사용자별 토큰" in str(public_auth_check.get("message", "")),
        "운영 점검의 공용 서버 인증 메시지에 사용자별 토큰 기준이 없습니다",
    )
    require("백업/복구 절차" in ops_check_names, "운영 점검에 백업/복구 절차 항목이 없습니다")
    require("비활성 기기" in ops_check_names, "운영 점검에 비활성 기기 항목이 없습니다")
    require("inactive_devices" in data.get("summary", {}), "운영 점검 요약에 비활성 기기 집계가 없습니다")
    require(
        any("status_counts.bad=0" in str(item.get("message", "")) for item in data.get("checks", [])),
        "운영 점검에 백업 검증 status_counts 기준 안내가 없습니다",
    )
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
        if USER_TOKEN_REQUIRED:
            status, data = request_error_with_user_token(
                "GET",
                f"{base_url}/api/v1/notes?owner_id=local_user",
                args.token,
                user_token=None,
            )
            require(
                status == 401 and data.get("detail") == "user token required",
                "사용자 토큰 필수 모드에서 토큰 없는 요청이 user token required로 차단되지 않았습니다",
            )
            status, data = request_error_with_user_token(
                "GET",
                f"{base_url}/api/v1/notes?owner_id=local_user",
                args.token,
                user_token="invalid-smoke-user-token",
            )
            require(
                status == 401 and data.get("detail") == "invalid user token",
                "사용자 토큰 필수 모드에서 잘못된 토큰 요청이 invalid user token으로 차단되지 않았습니다",
            )
            status, data = request("GET", f"{base_url}/api/v1/admin/users?owner_id=local_user", args.token)
            items = data.get("items", []) if isinstance(data, dict) else []
            last_used_at = items[0].get("access_token_last_used_at") if items else None
            require(
                last_used_at is None,
                "실패한 사용자 토큰 요청이 마지막 사용 시각을 갱신했습니다",
            )
            print(
                "GET /api/v1/notes(user_token_required_errors):",
                status,
                {"missing": "user token required", "invalid": "invalid user token"},
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
    issued_users = data.get("items", [])
    require(
        all("access_token_hash" not in user for user in issued_users),
        "사용자 목록 API에 사용자 토큰 해시가 포함되었습니다",
    )
    require(
        issued_smoke_token not in json.dumps(issued_users, ensure_ascii=False),
        "사용자 목록 API에 사용자 토큰 원문이 포함되었습니다",
    )
    print(
        "GET /api/v1/admin/users(token=issued):",
        status,
        {"count": data.get("count"), "token_issued": data.get("token_issued")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/users?token=issued",
        args.token,
    )
    exported_token_users = data.get("items", [])
    require(
        all("access_token_hash" not in user for user in exported_token_users),
        "사용자 export에 사용자 토큰 해시가 포함되었습니다",
    )
    require(
        issued_smoke_token not in json.dumps(exported_token_users, ensure_ascii=False),
        "사용자 export에 사용자 토큰 원문이 포함되었습니다",
    )
    print(
        "GET /api/v1/admin/export/users(token_safety):",
        status,
        {"users": len(exported_token_users), "token_hash_hidden": True},
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

    blocked_device_payload = {
        "owner_id": "local_user",
        "device_id": "smoke_blocked",
        "updated_after": None,
        "include_deleted": True,
        "notes": [],
    }
    status, data = request("POST", f"{base_url}/api/v1/sync", args.token, blocked_device_payload)
    require(status == 200, "차단 검증용 기기 등록 동기화가 실패했습니다")
    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/admin/devices/local_user/smoke_blocked",
        args.token,
        {"is_active": False},
    )
    require(data.get("device", {}).get("is_active") == 0, "기기 비활성화 API가 상태를 반영하지 않았습니다")
    status, data = request_error("POST", f"{base_url}/api/v1/sync", args.token, blocked_device_payload)
    require(status == 403 and data.get("detail") == "device inactive", "비활성 기기 동기화 차단이 동작하지 않습니다")
    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/admin/devices/local_user/smoke_blocked",
        args.token,
        {"is_active": True},
    )
    require(data.get("device", {}).get("is_active") == 1, "기기 재활성화 API가 상태를 반영하지 않았습니다")
    print(
        "PATCH /api/v1/admin/devices/{owner_id}/{device_id}:",
        status,
        {"device_id": "smoke_blocked", "reactivated": True},
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
    require(
        status == 403 and data.get("detail") == "user inactive",
        "비활성 사용자의 동기화 요청이 user inactive로 차단되지 않았습니다",
    )
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
    print("NowNote server smoke test passed")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"SMOKE TEST FAILED: {e}")
        raise
    except urllib.error.HTTPError as e:
        print(f"SMOKE TEST HTTP FAILED: {e.code} {e.read().decode('utf-8')}")
        raise
    except urllib.error.URLError as e:
        print(f"SMOKE TEST CONNECTION FAILED: {e.reason}")
        raise
    except json.JSONDecodeError as e:
        print(f"SMOKE TEST JSON FAILED: {e}")
        raise
