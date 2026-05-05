from fastapi import APIRouter
from sqlalchemy import text

from app.core.config import get_settings
from app.db import SessionLocal

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    return {"status": "ok", "server": settings.server_name}


@router.get("/health/ready")
def ready() -> dict[str, str]:
    with SessionLocal() as db:
        db.execute(text("select 1"))
    return {"status": "ready"}
