API_VERSION = "v1"
TWO_FACTOR_AUTH_STATUS = "token_code"
MAX_TREE_NOTE_LEVEL = 3
SUPPORTED_NOTE_TYPES = ["daily", "tree", "record"]

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
    "user_access_tokens": True,
    "self_registration": True,
    "device_access_tokens": True,
    "password_reset_email": True,
    "max_tree_note_level": MAX_TREE_NOTE_LEVEL,
    "supported_note_types": SUPPORTED_NOTE_TYPES,
}


def server_capabilities() -> dict:
    capabilities = dict(SERVER_CAPABILITIES)
    capabilities["supported_note_types"] = list(SERVER_CAPABILITIES["supported_note_types"])
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
