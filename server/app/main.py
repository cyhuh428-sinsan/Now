from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.admin import router as admin_router
from app.api.analysis import router as analysis_router
from app.api.auth import api_router as auth_api_router
from app.api.auth import page_router as auth_page_router
from app.api.health import router as health_router
from app.api.group_messages import router as group_messages_router
from app.api.monitor import router as monitor_router
from app.api.notes import router as notes_router
from app.api.public_pages import router as public_pages_router
from app.api.recordings import router as recordings_router
from app.api.server import router as server_router
from app.api.sync import router as sync_router
from app.api.users import router as users_router
from app.core.config import get_settings
from app.db import SessionLocal, create_tables
from app.services.user_accounts import ensure_user_groups


def _web_app_dir() -> Path | None:
    candidates = [
        Path("/web_app"),
        Path(__file__).resolve().parents[2] / "web",
    ]
    for path in candidates:
        if (path / "index.html").exists():
            return path
    return None


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.server_name)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def on_startup() -> None:
        create_tables()
        with SessionLocal() as db:
            ensure_user_groups(db)
            db.commit()

    web_app_dir = _web_app_dir()
    app.include_router(health_router)
    app.include_router(auth_page_router)
    app.include_router(public_pages_router)
    app.include_router(monitor_router)
    app.include_router(server_router)
    app.include_router(auth_api_router)
    app.include_router(notes_router)
    app.include_router(recordings_router)
    app.include_router(sync_router)
    app.include_router(users_router)
    app.include_router(group_messages_router)
    app.include_router(analysis_router)
    app.include_router(admin_router)
    if web_app_dir is not None:
        @app.get("/app", include_in_schema=False)
        def web_app_compat_index() -> FileResponse:
            return FileResponse(web_app_dir / "index.html")

        app.mount("/app", StaticFiles(directory=str(web_app_dir), html=True), name="web_app_compat")
        app.mount("/", StaticFiles(directory=str(web_app_dir), html=True), name="web_app")
    return app


app = create_app()
