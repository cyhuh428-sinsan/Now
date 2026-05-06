from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_api_token
from app.db import get_db
from app.models.note import AnalysisJob, Note, Recording, SyncLog

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
    dependencies=[Depends(require_api_token)],
)


@router.get("/export/notes")
def export_notes(
    owner_id: str | None = Query(default=None),
    include_deleted: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(Note).order_by(Note.updated_at.desc(), Note.id.desc())
    if owner_id:
        stmt = stmt.where(Note.owner_id == owner_id)
    if not include_deleted:
        stmt = stmt.where(Note.deleted_at.is_(None))
    return _export_payload("notes", list(db.scalars(stmt).all()))


@router.get("/export/recordings")
def export_recordings(
    owner_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(Recording).order_by(Recording.updated_at.desc(), Recording.id.desc())
    if owner_id:
        stmt = stmt.where(Recording.owner_id == owner_id)
    return _export_payload("recordings", list(db.scalars(stmt).all()))


@router.get("/export/analysis-jobs")
def export_analysis_jobs(
    owner_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(AnalysisJob).order_by(AnalysisJob.updated_at.desc(), AnalysisJob.id.desc())
    if owner_id:
        stmt = stmt.where(AnalysisJob.owner_id == owner_id)
    return _export_payload("analysis_jobs", list(db.scalars(stmt).all()))


@router.get("/export/sync-logs")
def export_sync_logs(
    owner_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(SyncLog).order_by(SyncLog.created_at.desc(), SyncLog.id.desc())
    if owner_id:
        stmt = stmt.where(SyncLog.owner_id == owner_id)
    return _export_payload("sync_logs", list(db.scalars(stmt).all()))


def _export_payload(name: str, rows: list) -> dict:
    return {
        "name": name,
        "exported_at": datetime.utcnow(),
        "count": len(rows),
        "items": [_model_to_dict(row) for row in rows],
    }


def _model_to_dict(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}
