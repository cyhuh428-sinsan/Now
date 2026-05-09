from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/api/v1/server", tags=["server"])


@router.get("")
def server_info() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "server": settings.server_name,
        "auth_required": bool(settings.api_token),
        "api_version": "v1",
        "capabilities": {
            "sync": True,
            "recordings": True,
            "analysis_jobs": True,
            "admin_ops": True,
            "user_accounts": True,
            "user_profile": True,
            "user_timezone": True,
            "two_factor_auth": "planned",
            "user_groups": True,
            "max_tree_note_level": 3,
            "supported_note_types": ["daily", "tree", "record"],
        },
    }
