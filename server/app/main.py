from fastapi import FastAPI

from app.api.admin import router as admin_router
from app.api.analysis import router as analysis_router
from app.api.health import router as health_router
from app.api.monitor import router as monitor_router
from app.api.notes import router as notes_router
from app.api.recordings import router as recordings_router
from app.api.server import router as server_router
from app.api.sync import router as sync_router
from app.api.users import router as users_router
from app.core.config import get_settings
from app.db import create_tables


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.server_name)

    @app.on_event("startup")
    def on_startup() -> None:
        create_tables()

    app.include_router(health_router)
    app.include_router(monitor_router)
    app.include_router(server_router)
    app.include_router(notes_router)
    app.include_router(recordings_router)
    app.include_router(sync_router)
    app.include_router(users_router)
    app.include_router(analysis_router)
    app.include_router(admin_router)
    return app


app = create_app()
