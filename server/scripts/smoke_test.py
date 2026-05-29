import argparse
import base64
import hashlib
import hmac
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from uuid import uuid4


USER_TOKEN: str | None = None
USER_TOKEN_REQUIRED = False
REQUEST_TIMEOUT = 10.0
API_VERSION = "v1"
TWO_FACTOR_AUTH_STATUS = "token_code"
MAX_TREE_NOTE_LEVEL = 3
SUPPORTED_NOTE_TYPES = ["daily", "tree", "record"]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def ascii_url(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            urllib.parse.quote(parts.path, safe="/"),
            urllib.parse.quote(parts.query, safe="=&%"),
            urllib.parse.quote(parts.fragment, safe=""),
        )
    )


def stale_server_message(field_name: str, data: dict) -> str:
    capabilities = data.get("capabilities")
    capability_keys = (
        ", ".join(sorted(capabilities.keys()))
        if isinstance(capabilities, dict)
        else "확인 불가"
    )
    return (
        f"서버 정보에 {field_name} 항목이 없습니다. "
        "현재 실행 중인 서버가 최신 소스보다 오래된 배포본일 수 있습니다. "
        "WSL/Linux 배포 경로에서 git pull origin main 후 docker compose up --build -d "
        "또는 docker-compose up --build -d를 다시 실행하세요. "
        f"현재 capability: {capability_keys}"
    )


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
    req = urllib.request.Request(ascii_url(url), data=body, headers=headers, method=method)
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
    user_token: str | None = None,
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
    effective_user_token = USER_TOKEN if user_token is None else user_token
    if effective_user_token:
        headers["X-Now-User-Token"] = effective_user_token
    req = urllib.request.Request(ascii_url(url), data=b"".join(chunks), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        text = res.read().decode("utf-8")
        return res.status, json.loads(text) if text else None


def request_text(method: str, url: str, token: str | None = None):
    headers = {}
    if token:
        encoded = base64.b64encode(f"admin:{token}".encode("utf-8")).decode("ascii")
        headers["Authorization"] = f"Basic {encoded}"
    req = urllib.request.Request(ascii_url(url), headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as res:
        text = res.read().decode("utf-8")
        return res.status, text


def two_factor_code(owner_id: str, access_token: str) -> str:
    token_hash = hashlib.sha256(access_token.strip().encode("utf-8")).hexdigest()
    step = int(time.time() // 30)
    digest = hmac.new(
        token_hash.encode("utf-8"),
        f"{owner_id.strip()}:{step}".encode("utf-8"),
        "sha256",
    ).hexdigest()
    return str(int(digest[:12], 16) % 1_000_000).zfill(6)


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
            public_readiness = data.get("public_server_readiness")
            require(
                isinstance(public_readiness, dict),
                stale_server_message("public_server_readiness", data),
            )
            require(
                public_readiness.get("status") in {"planned", "ready"},
                "서버 정보의 공용 서버 준비 상태가 planned 또는 ready가 아닙니다",
            )
            require(
                "real_two_factor_challenge" in public_readiness.get("ready", []),
                "서버 정보의 공용 서버 준비 상태에 2단계 인증 준비 항목이 없습니다",
            )
            require(
                "user_data_isolation_verification" in public_readiness.get("ready", []),
                "서버 정보의 공용 서버 준비 상태에 사용자별 데이터 격리 자동 검증 준비 항목이 없습니다",
            )
            require(
                "login_or_token_delivery" in public_readiness.get("ready", []),
                "서버 정보의 공용 서버 준비 상태에 사용자 토큰 확인 화면/API 준비 항목이 없습니다",
            )
            require(
                "user_access_tokens" in public_readiness.get("ready", []),
                "서버 정보의 공용 서버 준비 상태에 사용자별 접속 토큰 준비 항목이 없습니다",
            )
            public_readiness_items = public_readiness.get("items", [])
            require(
                isinstance(public_readiness_items, list)
                and any(
                    item.get("id") == "user_device_self_management"
                    and item.get("status") == "ready"
                    for item in public_readiness_items
                    if isinstance(item, dict)
                ),
                "서버 정보의 공용 서버 준비 상태 상세에 사용자 기기 관리 준비 항목이 없습니다",
            )
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
                "서버 capability의 two_factor_auth 상태가 token_code가 아닙니다",
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

    for path in ["/", "/privacy", "/privacy-policy"]:
        status, text = request_text("GET", f"{base_url}{path}")
        require("NowNote 개인정보처리방침" in text, f"{path} 개인정보처리방침 제목이 없습니다")
        require("공개 URL: https://nownote.sinsan.kr/" in text, f"{path} 공개 URL 안내가 없습니다")
        require("서버 연결을 켠 경우" in text, f"{path} 서버 연결 개인정보 처리 안내가 없습니다")
        print(f"GET {path}: {status} html={len(text)} bytes")

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
        "/admin/public",
        "/admin/release",
        "/admin/evidence",
        "/admin/mobile",
        "/admin/play",
        "/admin/open-source",
        "/admin/help",
        "/admin/users",
        "/admin/users/new",
        "/admin/users?status=inactive",
        "/admin/users?status=never_seen&q=smoke",
        "/admin/users?group=테스트",
        "/admin/users?token=missing",
    ]
    status, text = request_text("GET", f"{base_url}/auth/token")
    require("NowNote 토큰 확인" in text, "사용자 토큰 확인 화면 제목이 없습니다")
    require("사용자별 접속 토큰" in text, "사용자 토큰 확인 화면에 토큰 입력 안내가 없습니다")
    print(f"GET /auth/token: {status} html={len(text)} bytes")

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
            require("서버 이름" in text and "서버 정보 API" in text, "배포 체크리스트 화면에 현재 서버 요약과 확인 링크가 없습니다")
            require("git pull origin main" in text, "배포 체크리스트 화면에 소스 갱신 안내가 없습니다")
            require("NOW_USER_TOKEN_REQUIRED=true" in text, "배포 체크리스트 화면에 공용 서버 사용자 토큰 강제 설정 안내가 없습니다")
            require("백업/복구 절차" in text, "배포 체크리스트 화면에 운영 점검 백업/복구 항목 안내가 없습니다")
            require("status_counts.bad=0" in text, "배포 체크리스트 화면에 백업 검증 집계 기준 안내가 없습니다")
            require("/admin/export" in text and "/admin/recovery" in text, "배포 체크리스트 화면에 백업/복구 화면 안내가 없습니다")
            require(
                "docker-compose logs now-api --tail=80" in text
                and "docker-compose logs now-worker --tail=80" in text,
                "배포 체크리스트 화면에 WSL docker-compose 로그 확인 안내가 없습니다",
            )
        if path == "/admin/public":
            require("NowNote 서버 인증 기준" in text, "공용 서버 준비 화면에 SERVER_AUTH_POLICY.md 내용이 없습니다")
            require("NOW_USER_TOKEN_REQUIRED=true" in text, "공용 서버 준비 화면에 사용자별 토큰 필수 기준이 없습니다")
            require("2단계 코드 검증 절차" in text, "공용 서버 준비 화면에 2단계 인증 기준이 없습니다")
            require("사용자별 데이터 격리 자동 검증" in text, "공용 서버 준비 화면에 데이터 격리 기준이 없습니다")
            require("/admin/users" in text and "/admin/devices" in text, "공용 서버 준비 화면에 사용자/기기 관리 링크가 없습니다")
            require("/api/v1/admin/public-route" in text, "공용 서버 준비 화면에 공개 연결 JSON 링크가 없습니다")
            require("Forward Hostname/IP" in text and "now-api" in text, "공용 서버 준비 화면에 Nginx Proxy Manager 연결 대상 안내가 없습니다")
            require("Forward Port" in text and "8080" in text, "공용 서버 준비 화면에 Nginx Proxy Manager 포트 안내가 없습니다")
            require("서버 IP 또는 호스트명:8750" in text, "공용 서버 준비 화면에 다른 네트워크 NPM 대체 연결값이 없습니다")
        if path == "/admin/release":
            require("NowNote 1차 릴리스 준비" in text, "1차 릴리스 준비 화면 제목이 없습니다")
            require("영역별 진행" in text, "1차 릴리스 준비 화면에 영역별 진행이 없습니다")
            require("남은 항목 유형" in text, "1차 릴리스 준비 화면에 남은 항목 유형이 없습니다")
            require("다음 행동" in text, "1차 릴리스 준비 화면에 다음 행동 안내가 없습니다")
            require("수동 증빙 반영" in text, "1차 릴리스 준비 화면에 수동 증빙 반영 집계가 없습니다")
            require("외부 작업 바로가기" in text, "1차 릴리스 준비 화면에 외부 작업 바로가기 섹션이 없습니다")
            require("Nginx Proxy Manager" in text and "now-api" in text and "8080" in text, "1차 릴리스 준비 화면에 NPM 입력값이 없습니다")
            require("now_app/build/app/outputs/bundle/release/app-release.aab" in text, "1차 릴리스 준비 화면에 Play AAB 경로가 없습니다")
            require("dispatch_github_actions.py" in text, "1차 릴리스 준비 화면에 Actions 실행 명령이 없습니다")
            require("바로 완료 증빙 기록" in text, "1차 릴리스 준비 화면에 바로 증빙 기록 섹션이 없습니다")
            require('return_to" value="/admin/release"' in text, "1차 릴리스 준비 화면의 완료 기록 폼이 다시 릴리스 화면으로 돌아오지 않습니다")
            require("/admin/evidence" in text, "1차 릴리스 준비 화면에 수동 증빙 화면 링크가 없습니다")
            require("/admin/mobile" in text, "1차 릴리스 준비 화면에 모바일 점검 화면 링크가 없습니다")
            require("/api/v1/admin/release-readiness" in text, "1차 릴리스 준비 화면에 JSON API 링크가 없습니다")
        if path == "/admin/evidence":
            require("NowNote 수동 증빙" in text, "수동 증빙 화면 제목이 없습니다")
            require("증빙 기록 템플릿" in text, "수동 증빙 화면에 증빙 기록 템플릿이 없습니다")
            require("확인자:" in text, "수동 증빙 화면의 템플릿에 확인자 입력칸이 없습니다")
            require("증빙 기록 저장" in text, "수동 증빙 화면에 증빙 기록 저장 폼이 없습니다")
            require("최근 증빙 기록" in text, "수동 증빙 화면에 최근 증빙 기록 목록이 없습니다")
            require("증빙 완료 기록" in text, "수동 증빙 화면에 완료 기록 집계가 없습니다")
            require("미기록" in text, "수동 증빙 화면에 미기록 집계가 없습니다")
            require("수동 증빙 기준" in text, "수동 증빙 화면에 증빙 기준 표가 없습니다")
            require("필요 증빙" in text, "수동 증빙 화면에 필요 증빙 열이 없습니다")
            require("/api/v1/admin/release-evidence" in text, "수동 증빙 화면에 JSON API 링크가 없습니다")
            require(
                "/api/v1/admin/release-evidence-template" in text,
                "수동 증빙 화면에 기록 템플릿 API 링크가 없습니다",
            )
        if path == "/admin/mobile":
            require("NowNote 모바일 실제 실행 점검" in text, "모바일 실제 실행 점검 화면 제목이 없습니다")
            require("음성 메모" in text, "모바일 실제 실행 점검 화면에 음성 메모 절차가 없습니다")
            require("녹음 업로드 상태" in text, "모바일 실제 실행 점검 화면에 녹음 업로드 확인 절차가 없습니다")
            require("check_android_launch.py" in text, "모바일 실제 실행 점검 화면에 Android 실행 점검 스크립트 안내가 없습니다")
        if path == "/admin/play":
            require("NowNote Google Play 등록 준비" in text, "Google Play 등록 준비 화면 제목이 없습니다")
            require("자동 확인 항목" in text, "Google Play 등록 준비 화면에 자동 확인 항목이 없습니다")
            require("Play Console 수동 확인" in text, "Google Play 등록 준비 화면에 수동 확인 항목이 없습니다")
            require("/api/v1/admin/play-release" in text, "Google Play 등록 준비 화면에 JSON API 링크가 없습니다")
        if path == "/admin/open-source":
            require("NowNote 공개 저장소 준비" in text, "공개 저장소 준비 화면 제목이 없습니다")
            require("자동 확인 항목" in text, "공개 저장소 준비 화면에 자동 확인 항목이 없습니다")
            require("공개 전 수동 확인" in text, "공개 저장소 준비 화면에 수동 확인 항목이 없습니다")
            require("/api/v1/admin/open-source-release" in text, "공개 저장소 준비 화면에 JSON API 링크가 없습니다")
        if path.startswith("/admin/devices"):
            require("기기 활성 상태" in text, "기기 관리 화면에 활성 상태 안내가 없습니다")
            require("비활성 기기는 동기화" in text, "기기 관리 화면에 비활성 기기 차단 안내가 없습니다")
            require("/admin/devices/status" in text, "기기 관리 화면에 상태 변경 폼이 없습니다")
            require("현재 조건 JSON" in text, "기기 관리 화면에 현재 조건 JSON 링크가 없습니다")
            require("Owner ID" in text and "Device ID" in text, "기기 관리 화면에 owner/device 필터가 없습니다")
        if path == "/admin/users/new":
            require("사용자 추가" in text, "사용자 추가 화면 제목이 없습니다")
            require("/admin/users/new" in text, "사용자 추가 화면에 생성 폼이 없습니다")
        if path == "/admin/users" or path.startswith("/admin/users?"):
            require("현재 조건 JSON" in text, "사용자 관리 화면에 현재 조건 JSON 링크가 없습니다")
            require("Owner, 이메일, 표시 이름 검색" in text, "사용자 관리 화면에 검색 필터가 없습니다")
        if path.startswith("/admin/analysis"):
            require("현재 조건 JSON" in text, "분석 관리 화면에 현재 조건 JSON 링크가 없습니다")
            require("Owner ID" in text and "작업 유형" in text, "분석 관리 화면에 필터가 없습니다")
        if path.startswith("/admin/notes"):
            require("현재 조건 JSON" in text, "메모 관리 화면에 현재 조건 JSON 링크가 없습니다")
            require("Owner ID" in text and "제목/내용 검색" in text, "메모 관리 화면에 검색 필터가 없습니다")
            require("메모 타입" in text and "삭제 제외" in text, "메모 관리 화면에 타입/삭제 필터가 없습니다")
        if path.startswith("/admin/recordings"):
            require("고아 녹음 파일 JSON" in text, "녹음 관리 화면에 고아 녹음 파일 JSON 링크가 없습니다")
            require("누락 녹음 파일 JSON" in text, "녹음 관리 화면에 누락 녹음 파일 JSON 링크가 없습니다")
            require("/api/v1/admin/export/recording-missing-files" in text, "녹음 관리 화면에 누락 녹음 파일 export 링크가 없습니다")
        if path == "/admin/ops":
            require("백업/복구 절차" in text, "운영 점검 화면에 백업/복구 절차 항목이 없습니다")
            require("status_counts.bad=0" in text, "운영 점검 화면에 백업 검증 집계 기준 안내가 없습니다")
            require("사용자별 접속 토큰" in text, "운영 점검 화면에 준비된 사용자별 접속 토큰 항목이 없습니다")
            require("사용자 토큰 확인 화면/API" in text, "운영 점검 화면에 사용자 토큰 확인 준비 항목이 없습니다")
            require("2단계 코드 검증 절차" in text, "운영 점검 화면에 2단계 인증 항목이 없습니다")
            require("사용자별 기기 조회/해제 API" in text, "운영 점검 화면에 사용자별 기기 조회/해제 준비 항목이 없습니다")
            require("사용자별 데이터 격리 자동 검증" in text, "운영 점검 화면에 공용 서버 데이터 격리 항목이 없습니다")
            require("공개 운영 환경" in text, "운영 점검 화면에 공개 운영 환경 항목이 없습니다")
            require("공개 도메인 연결" in text, "운영 점검 화면에 공개 도메인 실제 연결 항목이 없습니다")
        if path == "/admin/help":
            require("사용자 토큰 확인 화면/API" in text, "도움말 화면에 사용자 토큰 확인 화면/API 점검 안내가 없습니다")
            require("2단계 코드 검증" in text, "도움말 화면에 2단계 코드 검증 점검 안내가 없습니다")
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

    status, data = request("GET", f"{base_url}/api/v1/admin/release-readiness", args.token)
    require(data.get("name") == "phase_one_release_readiness", "릴리스 준비 API 이름이 예상과 다릅니다")
    require(data.get("summary", {}).get("total") == 57, "릴리스 준비 API의 전체 항목 수가 예상과 다릅니다")
    require(data.get("summary", {}).get("remaining", 0) >= 0, "릴리스 준비 API의 남은 항목 수가 없습니다")
    require("evidence_done" in data.get("summary", {}), "릴리스 준비 API에 수동 증빙 완료 집계가 없습니다")
    require(data.get("blockers") is not None, "릴리스 준비 API에 남은 항목 유형이 없습니다")
    require(
        all("next_action" in blocker for blocker in data.get("blockers", [])),
        "릴리스 준비 API의 남은 항목 유형에 다음 행동 안내가 없습니다",
    )
    print(
        "GET /api/v1/admin/release-readiness:",
        status,
        data.get("summary"),
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/release-evidence", args.token)
    require(data.get("name") == "phase_one_manual_evidence", "수동 증빙 API 이름이 예상과 다릅니다")
    require(data.get("summary", {}).get("remaining", 0) >= 0, "수동 증빙 API의 남은 항목 수가 없습니다")
    require(data.get("items") is not None, "수동 증빙 API에 항목 목록이 없습니다")
    require(
        all("evidence" in item and "action" in item for item in data.get("items", [])),
        "수동 증빙 API 항목에 증빙 기준 또는 다음 행동이 없습니다",
    )
    print(
        "GET /api/v1/admin/release-evidence:",
        status,
        data.get("summary"),
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/release-evidence-template", args.token)
    require(
        data.get("name") == "phase_one_manual_evidence_template",
        "수동 증빙 템플릿 API 이름이 예상과 다릅니다",
    )
    require("확인자:" in data.get("content", ""), "수동 증빙 템플릿 API에 확인자 입력칸이 없습니다")
    require("증빙 위치:" in data.get("content", ""), "수동 증빙 템플릿 API에 증빙 위치 입력칸이 없습니다")
    print(
        "GET /api/v1/admin/release-evidence-template:",
        status,
        {"name": data.get("name"), "content": len(data.get("content", ""))},
    )

    evidence_record_payload = {
        "group_name": "smoke_test",
        "section": "server smoke",
        "label": "smoke_release_evidence_record",
        "result": "재확인 필요",
        "checked_by": "smoke_test",
        "evidence_location": "/api/v1/admin/release-evidence-records",
        "actual_note": "smoke test record",
        "memo": "자동 검증용 기록",
    }
    status, data = request(
        "POST",
        f"{base_url}/api/v1/admin/release-evidence-records",
        args.token,
        evidence_record_payload,
    )
    require(data.get("status") == "ok", "수동 증빙 기록 저장 API 상태가 ok가 아닙니다")
    require(data.get("record", {}).get("label") == "smoke_release_evidence_record", "수동 증빙 기록 저장 결과가 예상과 다릅니다")
    print(
        "POST /api/v1/admin/release-evidence-records:",
        status,
        {"id": data.get("record", {}).get("id"), "label": data.get("record", {}).get("label")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/release-evidence-records?label=smoke_release_evidence_record",
        args.token,
    )
    require(data.get("name") == "phase_one_manual_evidence_records", "수동 증빙 기록 API 이름이 예상과 다릅니다")
    require(data.get("count", 0) >= 1, "수동 증빙 기록 API에 저장된 기록이 없습니다")
    require(
        any(item.get("checked_by") == "smoke_test" for item in data.get("items", [])),
        "수동 증빙 기록 API에서 smoke 기록을 찾지 못했습니다",
    )
    print(
        "GET /api/v1/admin/release-evidence-records:",
        status,
        {"count": data.get("count"), "result_counts": data.get("result_counts")},
    )

    status, text = request_text("GET", f"{base_url}/admin/evidence", args.token)
    require("smoke_release_evidence_record" in text, "수동 증빙 화면의 최근 기록 목록에 저장된 기록이 없습니다")
    require("증빙 완료 기록" in text, "수동 증빙 화면의 증빙 진행 집계가 없습니다")
    print(f"GET /admin/evidence(after record): {status} html={len(text)} bytes")

    status, data = request("GET", f"{base_url}/api/v1/admin/play-release", args.token)
    require(data.get("name") == "google_play_release_readiness", "Play 등록 준비 API 이름이 예상과 다릅니다")
    require(data.get("summary", {}).get("auto_total", 0) >= 20, "Play 등록 준비 API의 자동 확인 항목이 부족합니다")
    require(data.get("summary", {}).get("manual", 0) >= 1, "Play 등록 준비 API의 수동 확인 항목이 없습니다")
    require(data.get("manual_items") is not None, "Play 등록 준비 API에 수동 확인 목록이 없습니다")
    print(
        "GET /api/v1/admin/play-release:",
        status,
        data.get("summary"),
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/open-source-release", args.token)
    require(data.get("name") == "open_source_release_readiness", "공개 저장소 준비 API 이름이 예상과 다릅니다")
    require(data.get("summary", {}).get("auto_total", 0) >= 10, "공개 저장소 준비 API의 자동 확인 항목이 부족합니다")
    require(data.get("summary", {}).get("manual", 0) >= 1, "공개 저장소 준비 API의 수동 확인 항목이 없습니다")
    require(data.get("manual_items") is not None, "공개 저장소 준비 API에 수동 확인 목록이 없습니다")
    print(
        "GET /api/v1/admin/open-source-release:",
        status,
        data.get("summary"),
    )

    status, data = request("GET", f"{base_url}/api/v1/admin/public-route", args.token)
    require(data.get("name") == "public_route", "공개 연결 점검 API 이름이 예상과 다릅니다")
    require(data.get("checks") is not None, "공개 연결 점검 API에 확인 항목이 없습니다")
    require(data.get("status") in {"ok", "warn", "bad", "planned"}, "공개 연결 점검 API 상태가 예상과 다릅니다")
    print(
        "GET /api/v1/admin/public-route:",
        status,
        {"status": data.get("status"), "checks": len(data.get("checks", []))},
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
        f"{base_url}/api/v1/admin/export/recording-orphans",
        args.token,
    )
    require(data.get("name") == "recording_orphans", "고아 녹음 export 이름이 recording_orphans가 아닙니다")
    require("storage_dir" in data, "고아 녹음 export에 storage_dir가 없습니다")
    require(isinstance(data.get("items"), list), "고아 녹음 export items가 목록이 아닙니다")
    print(
        "GET /api/v1/admin/export/recording-orphans:",
        status,
        {"count": data.get("count"), "name": data.get("name")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/recording-missing-files",
        args.token,
    )
    require(data.get("name") == "recording_missing_files", "누락 녹음 export 이름이 recording_missing_files가 아닙니다")
    require(isinstance(data.get("items"), list), "누락 녹음 export items가 목록이 아닙니다")
    print(
        "GET /api/v1/admin/export/recording-missing-files:",
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
    require("recording_orphan_files" in summary_items, "내보내기 요약에 고아 녹음 파일 건수가 없습니다")
    require("recording_orphan_bytes" in summary_items, "내보내기 요약에 고아 녹음 파일 크기가 없습니다")
    require("recording_missing_files" in summary_items, "내보내기 요약에 누락 녹음 파일 건수가 없습니다")
    require("release_evidence_records" in summary_items, "내보내기 요약에 수동 증빙 기록 건수가 없습니다")
    summed_items = sum(
        int(summary_items.get(name, 0) or 0)
        for name in [
            "notes",
            "recordings",
            "users",
            "devices",
            "analysis_jobs",
            "sync_logs",
            "release_evidence_records",
        ]
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
            "release_evidence_records": summary_items.get("release_evidence_records"),
            "recording_orphan_files": summary_items.get("recording_orphan_files"),
            "recording_missing_files": summary_items.get("recording_missing_files"),
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
    require("release_evidence_records" in data.get("items", {}), "전체 백업에 수동 증빙 기록 항목이 없습니다")
    full_backup = data
    print(
        "GET /api/v1/admin/export/all:",
        status,
        {
            "notes": len(data.get("items", {}).get("notes", [])),
            "recordings": len(data.get("items", {}).get("recordings", [])),
            "users": len(data.get("items", {}).get("users", [])),
            "devices": len(data.get("items", {}).get("devices", [])),
            "release_evidence_records": len(data.get("items", {}).get("release_evidence_records", [])),
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
    require("release_evidence_records" in data.get("summary", {}), "전체 백업 검증 요약에 수동 증빙 기록 건수가 없습니다")
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
    require("사용자 토큰 확인 화면/API" in ops_check_names, "운영 점검에 사용자 토큰 확인 화면/API 항목이 없습니다")
    require("2단계 코드 검증 절차" in ops_check_names, "운영 점검에 2단계 코드 검증 절차 항목이 없습니다")
    require("사용자별 기기 조회/해제 API" in ops_check_names, "운영 점검에 사용자별 기기 조회/해제 API 항목이 없습니다")
    require("사용자별 데이터 격리 자동 검증" in ops_check_names, "운영 점검에 사용자별 데이터 격리 자동 검증 항목이 없습니다")
    require("공개 운영 환경" in ops_check_names, "운영 점검에 공개 운영 환경 항목이 없습니다")
    require("공개 도메인 연결" in ops_check_names, "운영 점검에 공개 도메인 실제 연결 항목이 없습니다")
    require("공용 서버 인증" in ops_check_names, "운영 점검에 공용 서버 인증 항목이 없습니다")
    require("users_without_token" in data.get("summary", {}), "운영 점검 요약에 토큰 없는 사용자 집계가 없습니다")
    require(
        "사용자별 토큰" in str(public_auth_check.get("message", "")),
        "운영 점검의 공용 서버 인증 메시지에 사용자별 토큰 기준이 없습니다",
    )
    require("백업/복구 절차" in ops_check_names, "운영 점검에 백업/복구 절차 항목이 없습니다")
    require("비활성 기기" in ops_check_names, "운영 점검에 비활성 기기 항목이 없습니다")
    require("inactive_devices" in data.get("summary", {}), "운영 점검 요약에 비활성 기기 집계가 없습니다")
    require("고아 녹음 파일" in ops_check_names, "운영 점검에 고아 녹음 파일 항목이 없습니다")
    require("orphan_recording_files" in data.get("summary", {}), "운영 점검 요약에 고아 녹음 파일 집계가 없습니다")
    require("누락 녹음 파일" in ops_check_names, "운영 점검에 누락 녹음 파일 항목이 없습니다")
    require("missing_recording_files" in data.get("summary", {}), "운영 점검 요약에 누락 녹음 파일 집계가 없습니다")
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
    status, data = request(
        "POST",
        f"{base_url}/api/v1/auth/token-login",
        None,
        {"owner_id": "smoke_admin_user", "access_token": issued_smoke_token},
    )
    require(data.get("status") == "ok", "사용자 토큰 로그인 API 응답 상태가 ok가 아닙니다")
    require(
        data.get("user", {}).get("owner_id") == "smoke_admin_user",
        "사용자 토큰 로그인 API owner_id가 일치하지 않습니다",
    )
    print(
        "POST /api/v1/auth/token-login:",
        status,
        {"owner_id": data.get("user", {}).get("owner_id")},
    )

    status, data = request_error(
        "POST",
        f"{base_url}/api/v1/auth/token-login",
        None,
        {"owner_id": "smoke_admin_user", "access_token": "invalid-smoke-user-token"},
    )
    require(
        status == 401 and data.get("detail") == "invalid user token",
        "잘못된 사용자 토큰 로그인이 invalid user token으로 차단되지 않았습니다",
    )
    print(
        "POST /api/v1/auth/token-login(invalid):",
        status,
        {"detail": data.get("detail")},
    )

    status, data = request_error(
        "POST",
        f"{base_url}/api/v1/admin/users",
        args.token,
        {
            "owner_id": "smoke_2fa_user",
            "email": "smoke_2fa_user@example.com",
            "display_name": "Smoke 2FA User",
            "timezone": "Asia/Seoul",
            "group_name": "테스트",
            "two_factor_enabled": True,
            "is_active": True,
        },
    )
    require(status in (200, 409), "2단계 인증 검증용 사용자 생성 API 응답이 예상과 다릅니다")
    status, data = request(
        "POST",
        f"{base_url}/api/v1/admin/users/smoke_2fa_user/token",
        args.token,
    )
    two_factor_token = data.get("token", "")
    require(len(two_factor_token) >= 32, "2단계 인증 검증용 사용자 토큰 발급에 실패했습니다")
    status, data = request_error(
        "POST",
        f"{base_url}/api/v1/auth/token-login",
        None,
        {"owner_id": "smoke_2fa_user", "access_token": two_factor_token},
    )
    require(
        status == 401 and data.get("detail") == "two factor code required",
        "2단계 인증 사용자의 코드 없는 로그인이 차단되지 않았습니다",
    )
    status, data = request_error(
        "POST",
        f"{base_url}/api/v1/auth/token-login",
        None,
        {
            "owner_id": "smoke_2fa_user",
            "access_token": two_factor_token,
            "two_factor_code": "000000",
        },
    )
    require(
        status == 401 and data.get("detail") == "invalid two factor code",
        "2단계 인증 사용자의 잘못된 코드 로그인이 차단되지 않았습니다",
    )
    status, data = request(
        "POST",
        f"{base_url}/api/v1/auth/token-login",
        None,
        {
            "owner_id": "smoke_2fa_user",
            "access_token": two_factor_token,
            "two_factor_code": two_factor_code("smoke_2fa_user", two_factor_token),
        },
    )
    require(data.get("status") == "ok", "2단계 인증 코드 로그인 응답 상태가 ok가 아닙니다")
    require(
        data.get("user", {}).get("two_factor_enabled") is True,
        "2단계 인증 코드 로그인 응답에 사용 상태가 반영되지 않았습니다",
    )
    print(
        "POST /api/v1/auth/token-login(two_factor):",
        status,
        {"owner_id": data.get("user", {}).get("owner_id"), "two_factor": True},
    )

    if USER_TOKEN_REQUIRED:
        status, data = request_error_with_user_token(
            "GET",
            f"{base_url}/api/v1/notes?owner_id=local_user",
            args.token,
            user_token=issued_smoke_token,
        )
        require(
            status == 401 and data.get("detail") == "invalid user token",
            "다른 사용자 토큰으로 local_user 데이터 API가 차단되지 않았습니다",
        )
        print(
            "GET /api/v1/notes(cross_user_token_blocked):",
            status,
            {"detail": data.get("detail")},
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

    local_user_active_payload = {
        "email": "local_user@example.com",
        "display_name": "Local User",
        "timezone": "Asia/Seoul",
        "group_name": "사용자",
        "two_factor_enabled": False,
        "is_active": True,
    }
    status, data = request_error(
        "PATCH",
        f"{base_url}/api/v1/admin/users/local_user",
        args.token,
        local_user_active_payload,
    )
    require(status in (200, 404), "local_user 활성 상태 초기화 API 응답이 예상과 다릅니다")
    if status == 200:
        require(data.get("user", {}).get("is_active") is True, "local_user 활성 상태 초기화에 실패했습니다")
    print(
        "PATCH /api/v1/admin/users/local_user(active baseline):",
        status,
        {"is_active": data.get("user", {}).get("is_active") if isinstance(data, dict) else None},
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

    other_user_note = {
        "owner_id": "smoke_admin_user",
        "device_id": "smoke_other_device",
        "local_id": "smoke_other_user_note",
        "note_type": "daily",
        "title": "Other user smoke memo",
        "content": "This memo must not appear in local_user data responses",
        "parent_local_id": None,
        "level": 1,
        "tags": "test=other-user",
        "source": "smoke_test",
        "client_updated_at": now,
        "deleted_at": None,
    }
    status, data = request_with_user_token(
        "POST",
        f"{base_url}/api/v1/notes",
        args.token,
        other_user_note,
        issued_smoke_token,
    )
    require(data.get("owner_id") == "smoke_admin_user", "다른 사용자 검증용 메모 owner_id가 일치하지 않습니다")
    print(
        "POST /api/v1/notes(other_user):",
        status,
        {"owner_id": data.get("owner_id"), "local_id": data.get("local_id")},
    )

    status, data = request("GET", f"{base_url}/api/v1/notes?owner_id=local_user", args.token)
    local_note_ids = {item.get("local_id") for item in data}
    require("smoke_note_001" in local_note_ids, "local_user 메모 목록에 기준 메모가 없습니다")
    require(
        "smoke_other_user_note" not in local_note_ids,
        "local_user 메모 목록에 다른 사용자 메모가 섞였습니다",
    )
    print(
        "GET /api/v1/notes(user_data_isolation):",
        status,
        {"other_user_note_hidden": True, "count": len(data)},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/notes/search?q=Other%20user&owner_id=local_user",
        args.token,
    )
    require(
        all(item.get("owner_id") == "local_user" for item in data),
        "local_user 검색 결과에 다른 사용자 메모가 섞였습니다",
    )
    require(
        all(item.get("local_id") != "smoke_other_user_note" for item in data),
        "local_user 검색 결과에 다른 사용자 메모가 노출됩니다",
    )
    print(
        "GET /api/v1/notes/search(user_data_isolation):",
        status,
        {"other_user_note_hidden": True, "count": len(data)},
    )

    status, data = request_with_user_token(
        "GET",
        f"{base_url}/api/v1/notes?owner_id=smoke_admin_user",
        args.token,
        user_token=issued_smoke_token,
    )
    other_note_ids = {item.get("local_id") for item in data}
    require(
        "smoke_other_user_note" in other_note_ids,
        "smoke_admin_user 메모 목록에서 자기 메모를 확인하지 못했습니다",
    )
    print(
        "GET /api/v1/notes(other_user_visible):",
        status,
        {"has_other_user_note": True, "count": len(data)},
    )

    isolation_sync_payload = {
        "owner_id": "local_user",
        "device_id": "smoke_test",
        "updated_after": None,
        "include_deleted": True,
        "notes": [],
    }
    status, data = request("POST", f"{base_url}/api/v1/sync", args.token, isolation_sync_payload)
    pulled_note_ids = {item.get("local_id") for item in data.get("pulled_notes", [])}
    require("smoke_note_001" in pulled_note_ids, "local_user 동기화 응답에 기준 메모가 없습니다")
    require(
        "smoke_other_user_note" not in pulled_note_ids,
        "local_user 동기화 응답에 다른 사용자 메모가 섞였습니다",
    )
    print(
        "POST /api/v1/sync(user_data_isolation):",
        status,
        {"other_user_note_hidden": True, "pulled": len(data.get("pulled_notes", []))},
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
    first_recording_file_name = data.get("file_name")

    status, data = request_multipart(
        f"{base_url}/api/v1/recordings",
        args.token,
        {
            "owner_id": "local_user",
            "device_id": "smoke_test",
            "local_id": recording_local_id,
            "note_local_id": "smoke_note_001",
            "transcript": "Smoke recording transcript replaced",
        },
        "file",
        "smoke-recording-replaced.webm",
        "audio/webm",
        b"NowNote smoke recording replacement bytes",
    )
    require(data.get("local_id") == recording_local_id, "녹음 재업로드 local_id가 일치하지 않습니다")
    require(data.get("file_name") != first_recording_file_name, "녹음 재업로드 파일명이 갱신되지 않았습니다")
    print(
        "POST /api/v1/recordings(replace):",
        status,
        {"local_id": data.get("local_id"), "file_replaced": True},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/recordings?owner_id=local_user",
        args.token,
    )
    matching_recordings = [item for item in data if item.get("local_id") == recording_local_id]
    has_recording = bool(matching_recordings)
    require(has_recording, "업로드한 녹음이 목록에서 확인되지 않았습니다")
    require(len(matching_recordings) == 1, "녹음 재업로드 후 같은 local_id가 중복 노출됩니다")
    print(
        "GET /api/v1/recordings:",
        status,
        {"has_recording": has_recording, "count": len(data)},
    )

    other_recording_local_id = f"smoke_other_recording_{now.replace(':', '').replace('-', '').replace('T', '_')}"
    status, data = request_multipart(
        f"{base_url}/api/v1/recordings",
        args.token,
        {
            "owner_id": "smoke_admin_user",
            "device_id": "smoke_other_device",
            "local_id": other_recording_local_id,
            "note_local_id": "smoke_other_user_note",
            "transcript": "Other user recording transcript",
        },
        "file",
        "other-smoke-recording.webm",
        "audio/webm",
        b"NowNote other user smoke recording bytes",
        user_token=issued_smoke_token,
    )
    require(data.get("owner_id") == "smoke_admin_user", "다른 사용자 녹음 owner_id가 일치하지 않습니다")
    print(
        "POST /api/v1/recordings(other_user):",
        status,
        {"owner_id": data.get("owner_id"), "local_id": data.get("local_id")},
    )

    status, data = request("GET", f"{base_url}/api/v1/recordings?owner_id=local_user", args.token)
    require(
        all(item.get("local_id") != other_recording_local_id for item in data),
        "local_user 녹음 목록에 다른 사용자 녹음이 섞였습니다",
    )
    print(
        "GET /api/v1/recordings(user_data_isolation):",
        status,
        {"other_user_recording_hidden": True, "count": len(data)},
    )

    status, data = request_with_user_token(
        "GET",
        f"{base_url}/api/v1/recordings?owner_id=smoke_admin_user",
        args.token,
        user_token=issued_smoke_token,
    )
    require(
        any(item.get("local_id") == other_recording_local_id for item in data),
        "smoke_admin_user 녹음 목록에서 자기 녹음을 확인하지 못했습니다",
    )
    print(
        "GET /api/v1/recordings(other_user_visible):",
        status,
        {"has_other_user_recording": True, "count": len(data)},
    )

    unsafe_recording_local_id = f"../smoke_escape_{now.replace(':', '').replace('-', '').replace('T', '_')}"
    status, data = request_multipart(
        f"{base_url}/api/v1/recordings",
        args.token,
        {
            "owner_id": "local_user",
            "device_id": "smoke_test",
            "local_id": unsafe_recording_local_id,
            "note_local_id": "smoke_note_001",
            "transcript": "Smoke unsafe path transcript",
        },
        "file",
        "../unsafe-recording.webm",
        "audio/webm",
        b"NowNote unsafe path smoke recording bytes",
    )
    require(data.get("local_id") == unsafe_recording_local_id, "위험 문자 local_id가 메타데이터에서 보존되지 않았습니다")
    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/recordings?device_id=smoke_test",
        args.token,
    )
    unsafe_recording = next(
        (
            item
            for item in data.get("items", [])
            if item.get("local_id") == unsafe_recording_local_id
        ),
        {},
    )
    unsafe_file_name = str(unsafe_recording.get("file_name", ""))
    unsafe_storage_path = str(unsafe_recording.get("storage_path", ""))
    require(unsafe_recording, "위험 문자 local_id 녹음 export 항목을 찾지 못했습니다")
    require(
        "/" not in unsafe_file_name and "\\" not in unsafe_file_name and not unsafe_file_name.startswith(".."),
        "녹음 저장 파일명에 경로 문자가 남아 있습니다",
    )
    normalized_unsafe_path = unsafe_storage_path.replace("\\", "/")
    require("/../" not in normalized_unsafe_path, "녹음 저장 경로에 상위 경로 이동이 남아 있습니다")
    require(
        "/local_user/smoke_test/" in normalized_unsafe_path,
        "녹음 저장 경로가 owner/device 디렉터리 아래에 있지 않습니다",
    )
    print(
        "POST /api/v1/recordings(path_safety):",
        status,
        {"file_name": unsafe_file_name, "path_safe": True},
    )

    dot_recording_local_id = ".."
    status, data = request_multipart(
        f"{base_url}/api/v1/recordings",
        args.token,
        {
            "owner_id": "local_user",
            "device_id": "smoke_test",
            "local_id": dot_recording_local_id,
            "note_local_id": "smoke_note_001",
            "transcript": "Smoke dot path transcript",
        },
        "file",
        ".",
        "audio/webm",
        b"NowNote dot path smoke recording bytes",
    )
    require(data.get("local_id") == dot_recording_local_id, "점 local_id가 메타데이터에서 보존되지 않았습니다")
    status, data = request(
        "GET",
        f"{base_url}/api/v1/admin/export/recordings?device_id=smoke_test",
        args.token,
    )
    dot_recording = next(
        (
            item
            for item in data.get("items", [])
            if item.get("local_id") == dot_recording_local_id
        ),
        {},
    )
    dot_file_name = str(dot_recording.get("file_name", ""))
    dot_storage_path = str(dot_recording.get("storage_path", ""))
    normalized_dot_path = dot_storage_path.replace("\\", "/")
    require(dot_recording, "점 local_id 녹음 export 항목을 찾지 못했습니다")
    require(
        "/" not in dot_file_name and "\\" not in dot_file_name and dot_file_name.startswith("_"),
        "점 local_id 녹음 저장 파일명이 안전한 대체 이름으로 시작하지 않습니다",
    )
    require("/../" not in normalized_dot_path, "점 local_id 녹음 저장 경로에 상위 경로 이동이 남아 있습니다")
    print(
        "POST /api/v1/recordings(dot_path_safety):",
        status,
        {"file_name": dot_file_name, "path_safe": True},
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
        "GET",
        f"{base_url}/api/v1/users/local_user/devices",
        args.token,
    )
    devices = data.get("devices", [])
    require(data.get("status") == "ok", "사용자 기기 목록 조회 응답 상태가 ok가 아닙니다")
    require(
        any(device.get("device_id") == "smoke_test" for device in devices),
        "사용자 기기 목록에 smoke_test 기기가 없습니다",
    )
    print(
        "GET /api/v1/users/local_user/devices:",
        status,
        {"count": len(devices)},
    )

    status, data = request(
        "PATCH",
        f"{base_url}/api/v1/users/local_user/devices/smoke_test",
        args.token,
        {"is_active": True},
    )
    require(data.get("status") == "ok", "사용자 기기 상태 변경 응답 상태가 ok가 아닙니다")
    require(
        data.get("device", {}).get("device_id") == "smoke_test"
        and data.get("device", {}).get("is_active") is True,
        "사용자 기기 상태 변경 결과가 예상과 다릅니다",
    )
    print(
        "PATCH /api/v1/users/local_user/devices/smoke_test:",
        status,
        {"is_active": data.get("device", {}).get("is_active")},
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

    status, data = request_with_user_token(
        "POST",
        f"{base_url}/api/v1/analysis/jobs",
        args.token,
        {
            "owner_id": "smoke_admin_user",
            "job_type": "memo_summary",
            "note_local_id": "smoke_other_user_note",
            "input_text": "Other user analysis input",
        },
        issued_smoke_token,
    )
    other_analysis_job_id = data.get("id")
    require(other_analysis_job_id is not None, "다른 사용자 분석 작업 ID가 반환되지 않았습니다")
    print(
        "POST /api/v1/analysis/jobs(other_user):",
        status,
        {"id": other_analysis_job_id, "owner_id": data.get("owner_id")},
    )

    status, data = request(
        "GET",
        f"{base_url}/api/v1/analysis/jobs?owner_id=local_user",
        args.token,
    )
    require(
        all(item.get("id") != other_analysis_job_id for item in data),
        "local_user 분석 작업 목록에 다른 사용자 작업이 섞였습니다",
    )
    print(
        "GET /api/v1/analysis/jobs(user_data_isolation):",
        status,
        {"other_user_job_hidden": True, "count": len(data)},
    )

    status, data = request_with_user_token(
        "GET",
        f"{base_url}/api/v1/analysis/jobs?owner_id=smoke_admin_user",
        args.token,
        user_token=issued_smoke_token,
    )
    require(
        any(item.get("id") == other_analysis_job_id for item in data),
        "smoke_admin_user 분석 작업 목록에서 자기 작업을 확인하지 못했습니다",
    )
    print(
        "GET /api/v1/analysis/jobs(other_user_visible):",
        status,
        {"has_other_user_job": True, "count": len(data)},
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
