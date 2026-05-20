API_VERSION = "v1"
TWO_FACTOR_AUTH_STATUS = "planned"
MAX_TREE_NOTE_LEVEL = 3
SUPPORTED_NOTE_TYPES = ["daily", "tree", "record"]

PUBLIC_SERVER_READY_ITEMS = [
    {
        "id": "user_access_tokens",
        "label": "사용자별 접속 토큰",
        "message": "사용자별 토큰 발급, 필수 모드, 마지막 사용 시각 추적 지원",
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
        "label": "사용자 토큰 확인 화면/API",
        "message": "사용자별 접속 토큰을 확인하는 공개 화면과 token-login API 지원",
    },
]

PUBLIC_SERVER_REMAINING_ITEMS = [
    {
        "id": "real_two_factor_challenge",
        "label": "실제 2단계 인증 절차",
        "message": f"현재는 사용 여부 관리 상태, 실제 로그인 2단계 인증 절차는 {TWO_FACTOR_AUTH_STATUS}",
    },
    {
        "id": "public_https_reverse_proxy",
        "label": "공개 HTTPS/reverse proxy",
        "message": "정식 오픈 전 도메인, HTTPS, reverse proxy, 복구 절차 최종 확인 필요",
    },
]

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
    "user_access_tokens": True,
    "max_tree_note_level": MAX_TREE_NOTE_LEVEL,
    "supported_note_types": SUPPORTED_NOTE_TYPES,
}


def server_capabilities() -> dict:
    capabilities = dict(SERVER_CAPABILITIES)
    capabilities["supported_note_types"] = list(SERVER_CAPABILITIES["supported_note_types"])
    return capabilities


def public_server_readiness() -> dict:
    ready = [item["id"] for item in PUBLIC_SERVER_READY_ITEMS]
    remaining = [item["id"] for item in PUBLIC_SERVER_REMAINING_ITEMS]
    return {
        "status": "ready" if not remaining else "planned",
        "ready": ready,
        "remaining": remaining,
        "items": [
            *[
                {
                    **item,
                    "status": "ready",
                }
                for item in PUBLIC_SERVER_READY_ITEMS
            ],
            *[
                {
                    **item,
                    "status": "planned",
                }
                for item in PUBLIC_SERVER_REMAINING_ITEMS
            ],
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
