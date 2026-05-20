from fastapi import APIRouter

from app.core.capabilities import API_VERSION, public_server_readiness, server_capabilities
from app.core.config import get_settings

router = APIRouter(prefix="/api/v1/server", tags=["server"])


@router.get("")
def server_info() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "server": settings.server_name,
        "auth_required": bool(settings.api_token),
        "user_token_required": bool(settings.user_token_required),
        "api_version": API_VERSION,
        "capabilities": server_capabilities(),
        "public_server_readiness": public_server_readiness(),
    }
