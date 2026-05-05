from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/api/v1/server", tags=["server"])


@router.get("")
def server_info() -> dict[str, str | bool]:
    settings = get_settings()
    return {
        "status": "ok",
        "server": settings.server_name,
        "auth_required": bool(settings.api_token),
        "api_version": "v1",
    }
