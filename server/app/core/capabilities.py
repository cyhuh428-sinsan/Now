API_VERSION = "v1"
TWO_FACTOR_AUTH_STATUS = "token_code"
MAX_TREE_NOTE_LEVEL = 3
SUPPORTED_NOTE_TYPES = ["daily", "tree", "record"]

# 앱/설치형 버전 안내 (P10)에서 쓰는 "최신 버전" 값.
# NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md의 버전 기준에 따라 서버·Web·설치형·앱은
# 같은 릴리즈 번호를 쓴다. 이 상수가 그 기준의 서버 쪽 선언이다.
# GitHub Release API 등 외부 서비스를 요청마다 부르지 않기 위해 코드 상수로 둔다.
# 릴리즈마다 여기와 now_app/pubspec.yaml의 version, desktop/package.json의 version,
# desktop/app/app.js의 APP_VERSION을 같은 값으로 맞춰 올린다.
LATEST_APP_VERSION = "2.3.6"
GITHUB_RELEASE_REPO = "cyhuh428-sinsan/Now"

# 사설 네트워크 연결 판정에 쓸 수 있는 무인증 엔드포인트 목록.
# 세 경로 모두 토큰 없이 호출된다. 경로를 바꾸면 여기도 함께 바꾼다.
CONNECTION_PROBE_ENDPOINTS = ["/health", "/health/ready", f"/api/{API_VERSION}/server"]

# 2.3.6에서 들어올 기능은 P축(P7~P12)에서 실제 API가 생긴 뒤에 True로 바꾼다.
# 지금은 구현이 없으므로 명시적으로 False를 선언한다.
# NOTE_MOVE_API: 문서 이동 "전용" 엔드포인트(예: POST /notes/{id}/move) 유무만 뜻한다.
# 문서 이동 자체는 이미 지원한다 — POST /api/v1/notes(/sync)로 parent_local_id를
# 바꿔 upsert하면 note_tree_parent_validation(아래)이 새 부모를 검증한다.
# P7 검증 결과 전용 API가 필요하지 않다고 판단해 이 값은 False로 유지한다
# (server/tests/test_note_tree_move.py 참고).
NOTE_MOVE_API = False  # P7 문서 이동 전용 API
SYNC_STATUS_API = True  # P8 마지막 동기화 시각/실패 사유 조회. GET /api/v1/sync/status로 제공한다
APP_UPDATE_INFO_API = True  # P10 최신 버전 안내. GET /api/v1/app/release로 제공한다
# P12에서 저장소·모델·API(POST/GET /api/v1/notes/attachments)가 갖춰졌으므로
# 둘 다 True로 바꾼다. note_attachments는 저장소 존재 자체를, sketch_attachments는
# 그 저장소가 스케치(PNG) 첨부까지 감당한다는 뜻이다. 지금은 같은 저장소이므로
# 값이 같지만, 나중에 사진 첨부가 스케치와 다른 조건을 가지면 분리될 수 있어
# 키를 둘로 유지한다.
NOTE_ATTACHMENTS = True  # P12 노트 첨부 저장소
SKETCH_ATTACHMENTS = True  # P12 스케치 이미지 저장

PUBLIC_SERVER_READY_ITEMS = [
    {
        "id": "self_registration",
        "label": "사용자 직접 가입",
        "message": "관리자 개입 없이 Web에서 사용자 가입과 Web 로그인을 지원",
    },
    {
        "id": "user_access_tokens",
        "label": "기기별 연결 토큰",
        "message": "Web에서 앱/설치형 연결 토큰 발급, 재확인, 재발급 지원",
    },
    {
        "id": "user_profile_admin",
        "label": "사용자 프로필 관리",
        "message": "시간대, 그룹, 활성 상태, 2단계 사용 여부 관리 지원",
    },
    {
        "id": "user_device_registry",
        "label": "사용자별 기기 레지스트리",
        "message": "기기별 등록 흔적, 활성/비활성 차단, 최근 접속 시각 추적 지원",
    },
    {
        "id": "user_device_self_management",
        "label": "사용자별 기기 조회/해제 API",
        "message": "사용자가 자기 기기 목록을 확인하고 기기 활성 상태를 변경하는 API 지원",
    },
    {
        "id": "backup_recovery_checks",
        "label": "백업/복구 점검",
        "message": "백업 내보내기, 백업 검증, 운영 점검 화면 지원",
    },
    {
        "id": "user_data_isolation_verification",
        "label": "사용자별 데이터 격리 자동 검증",
        "message": "메모, 검색, 동기화, 녹음, 분석 작업의 사용자별 데이터 격리 smoke 검증 지원",
    },
    {
        "id": "login_or_token_delivery",
        "label": "사용자 로그인",
        "message": "Web ID/비밀번호 로그인과 앱/설치형 token-login API 지원",
    },
    {
        "id": "real_two_factor_challenge",
        "label": "2단계 코드 검증 절차",
        "message": "2단계 인증 사용자는 토큰 로그인 때 6자리 추가 코드를 검증",
    },
]

PUBLIC_SERVER_PASSWORD_RESET_ITEM = {
    "id": "password_reset_email",
    "label": "이메일 비밀번호 재설정",
    "message": "등록 이메일 기반 비밀번호 재설정 메일 발송 설정 확인",
}

PUBLIC_SERVER_HTTPS_ITEM = {
    "id": "public_https_reverse_proxy",
    "label": "공개 운영 환경",
    "message": "공개 URL이 https://이고 reverse proxy 사용 설정이 켜져 있는지 확인",
}

SERVER_CAPABILITIES = {
    "sync": True,
    "recordings": True,
    "analysis_jobs": True,
    "admin_ops": True,
    "backup_export": True,
    "backup_verify": True,
    "user_accounts": True,
    "user_profile": True,
    "user_timezone": True,
    "two_factor_status": True,
    "two_factor_auth": TWO_FACTOR_AUTH_STATUS,
    "user_groups": True,
    "group_readonly_sharing": True,
    "group_messenger": True,
    "group_messenger_unread": True,
    "messenger_rooms": True,
    "messenger_attachments": True,
    "user_access_tokens": True,
    "self_registration": True,
    "device_access_tokens": True,
    "web_login_auth": True,
    "web_session_auth": True,
    "app_installed_token_auth": True,
    "legacy_api_token_auth": True,
    "password_reset_email": True,
    "max_tree_note_level": MAX_TREE_NOTE_LEVEL,
    "supported_note_types": SUPPORTED_NOTE_TYPES,
    # 문서 이동 (P7)
    # note_tree_parent_validation: parent_local_id를 바꿔 upsert하는 방식으로
    # 이동이 이미 가능하고 서버가 새 부모의 존재/레벨을 검증한다는 뜻.
    # note_move_api(False): 그 검증을 감싸는 전용 이동 엔드포인트는 없다는 뜻.
    # 화면은 note_move_api가 아니라 note_tree_parent_validation을 보고
    # "upsert로 이동" 흐름을 구현하면 된다.
    "note_tree_parent_validation": True,
    "note_move_api": NOTE_MOVE_API,
    # 동기화 상태 표시 (P8)
    "sync_server_time": True,
    "sync_status_api": SYNC_STATUS_API,
    # 메신저 첨부 UX (P9)
    "messenger_attachment_metadata": True,
    "messenger_upload_policy": True,
    # 업데이트 안내 (P10)
    "app_update_info": APP_UPDATE_INFO_API,
    # 사설 네트워크 연결 (P11)
    "connection_probe": True,
    "server_info_public": True,
    # 스케치 저장 (P12)
    "note_attachments": NOTE_ATTACHMENTS,
    "sketch_attachments": SKETCH_ATTACHMENTS,
}


def app_release_info() -> dict:
    """최신 버전, 플랫폼별 다운로드 링크, GitHub Release 페이지 안내.

    자동 업데이트가 아니라 안내용 정보만 준다. 설치형(.exe)·앱(.apk) asset 이름은
    NOW_2_3_RELEASE_GOVERNANCE_CHECKLIST.md의 규칙(`NowNote-Setup-2.3.x-x64.exe`,
    `NowNote-2.3.x.apk`)을 따른다.
    """
    version = LATEST_APP_VERSION
    tag = f"v{version}"
    download_base = f"https://github.com/{GITHUB_RELEASE_REPO}/releases/download/{tag}"
    return {
        "latest_version": version,
        "release_tag": tag,
        "release_url": f"https://github.com/{GITHUB_RELEASE_REPO}/releases/tag/{tag}",
        "downloads": {
            "windows_installer": f"{download_base}/NowNote-Setup-{version}-x64.exe",
            "android_apk": f"{download_base}/NowNote-{version}.apk",
        },
    }


def messenger_attachment_capabilities() -> dict:
    """메신저 첨부 제한값. 업로드 검증이 쓰는 정책과 같은 함수에서 읽는다."""
    from app.services.messenger_storage import messenger_upload_policy

    policy = messenger_upload_policy()
    return {
        "messenger_max_upload_bytes": int(policy["max_size_bytes"]),
        "messenger_allowed_extensions": list(policy["allowed_extensions"]),
        "messenger_allowed_mime_types": list(policy["allowed_mime_types"]),
        "messenger_image_extensions": list(policy["image_extensions"]),
    }


def server_capabilities() -> dict:
    capabilities = dict(SERVER_CAPABILITIES)
    capabilities["supported_note_types"] = list(SERVER_CAPABILITIES["supported_note_types"])
    capabilities["connection_probe_endpoints"] = list(CONNECTION_PROBE_ENDPOINTS)
    capabilities.update(messenger_attachment_capabilities())
    return capabilities


def public_server_readiness() -> dict:
    https_item = dict(PUBLIC_SERVER_HTTPS_ITEM)
    https_item["status"] = "ready" if public_https_ready() else "planned"
    https_item["message"] = public_https_message()
    password_reset_item = dict(PUBLIC_SERVER_PASSWORD_RESET_ITEM)
    password_reset_item["status"] = "ready" if password_reset_email_ready() else "planned"
    password_reset_item["message"] = password_reset_email_message()
    dynamic_items = [*PUBLIC_SERVER_READY_ITEMS, password_reset_item, https_item]
    ready = [item["id"] for item in dynamic_items if item.get("status", "ready") == "ready"]
    remaining = [item["id"] for item in dynamic_items if item.get("status") == "planned"]
    return {
        "status": "ready" if not remaining else "planned",
        "ready": ready,
        "remaining": remaining,
        "items": [
            {
                **item,
                "status": item.get("status", "ready"),
            }
            for item in dynamic_items
        ],
    }


def public_server_readiness_checks() -> list[dict[str, str]]:
    readiness = public_server_readiness()
    return [
        {
            "name": item["label"],
            "status": "ok" if item["status"] == "ready" else "info",
            "message": item["message"],
        }
        for item in readiness["items"]
    ]


def public_https_ready() -> bool:
    from app.core.config import get_settings

    settings = get_settings()
    public_base_url = (settings.public_base_url or "").strip().lower()
    return public_base_url.startswith("https://") and bool(settings.behind_reverse_proxy)


def password_reset_email_ready() -> bool:
    from app.core.config import get_settings

    settings = get_settings()
    return bool((settings.smtp_host or "").strip() and (settings.smtp_from or "").strip())


def password_reset_email_message() -> str:
    if password_reset_email_ready():
        return "등록 이메일 기반 비밀번호 재설정 메일 발송 설정 확인됨"
    return "공용 오픈 전 NOW_SMTP_HOST와 NOW_SMTP_FROM 설정 필요"


def public_https_message() -> str:
    from app.core.config import get_settings

    settings = get_settings()
    public_base_url = (settings.public_base_url or "").strip()
    if public_https_ready():
        return f"공개 URL 확인됨: {public_base_url}"
    if not public_base_url:
        return "공용 오픈 전 NOW_PUBLIC_BASE_URL=https://도메인 설정 필요"
    if not public_base_url.lower().startswith("https://"):
        return "공용 오픈 전 NOW_PUBLIC_BASE_URL은 https:// 주소여야 함"
    return "공용 오픈 전 NOW_BEHIND_REVERSE_PROXY=true 설정 필요"
