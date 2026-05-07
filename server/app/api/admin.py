from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
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


@router.get("/ops")
def ops_status(db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    checks = []

    db_status = "ok"
    db_message = "DB 연결 정상"
    note_total = 0
    recording_total = 0
    failed_jobs = 0
    queued_jobs = 0
    running_jobs = 0
    deleted_notes = 0
    recordings_without_transcript = 0
    try:
        db.execute(text("select 1"))
        note_total = db.scalar(select(func.count()).select_from(Note)) or 0
        recording_total = db.scalar(select(func.count()).select_from(Recording)) or 0
        failed_jobs = _count_jobs_by_status(db, "failed")
        queued_jobs = _count_jobs_by_status(db, "queued")
        running_jobs = _count_jobs_by_status(db, "running")
        deleted_notes = (
            db.scalar(
                select(func.count()).select_from(Note).where(Note.deleted_at.is_not(None))
            )
            or 0
        )
        recordings_without_transcript = (
            db.scalar(
                select(func.count())
                .select_from(Recording)
                .where(Recording.transcript.is_(None))
            )
            or 0
        )
    except Exception as exc:
        db_status = "bad"
        db_message = f"DB 연결 오류: {exc}"

    checks.append({"name": "Database", "status": db_status, "message": db_message})
    storage_status, storage_message = _recording_storage_state(settings.storage_dir)
    checks.append(
        {
            "name": "Recording Storage",
            "status": storage_status,
            "message": storage_message,
        }
    )
    checks.append(
        {
            "name": "API Token",
            "status": "ok" if settings.api_token else "warn",
            "message": "설정됨" if settings.api_token else "공용 오픈 전 설정 필요",
        }
    )
    checks.append(
        {
            "name": "Postgres Password",
            "status": "warn" if _uses_default_database_password(settings.database_url) else "ok",
            "message": (
                "기본 DB 비밀번호 사용 중"
                if _uses_default_database_password(settings.database_url)
                else "기본 DB 비밀번호 아님"
            ),
        }
    )
    checks.append(
        {
            "name": "LLM Provider",
            "status": "ok" if settings.llm_provider != "local" else "info",
            "message": _llm_state(settings.llm_provider, settings.openai_api_key),
        }
    )
    checks.append(
        {
            "name": "Failed Analysis Jobs",
            "status": "bad" if failed_jobs else "ok",
            "message": f"{failed_jobs}건",
        }
    )
    checks.append(
        {
            "name": "Queued Analysis Jobs",
            "status": "warn" if queued_jobs > 20 else "ok",
            "message": f"queued {queued_jobs}건, running {running_jobs}건",
        }
    )
    checks.append(
        {
            "name": "Deleted Notes",
            "status": "info" if deleted_notes else "ok",
            "message": f"삭제 표시 메모 {deleted_notes}건",
        }
    )
    checks.append(
        {
            "name": "Recordings Without Transcript",
            "status": "info" if recordings_without_transcript else "ok",
            "message": f"transcript 없는 녹음 {recordings_without_transcript}건",
        }
    )

    return {
        "status": _ops_summary_status(checks),
        "checked_at": datetime.utcnow(),
        "summary": {
            "notes": note_total,
            "recordings": recording_total,
            "failed_analysis_jobs": failed_jobs,
            "queued_analysis_jobs": queued_jobs,
            "running_analysis_jobs": running_jobs,
        },
        "checks": checks,
    }


def _export_payload(name: str, rows: list) -> dict:
    return {
        "name": name,
        "exported_at": datetime.utcnow(),
        "count": len(rows),
        "items": [_model_to_dict(row) for row in rows],
    }


def _model_to_dict(row) -> dict:
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}


def _count_jobs_by_status(db: Session, job_status: str) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(AnalysisJob)
            .where(AnalysisJob.status == job_status)
        )
        or 0
    )


def _recording_storage_state(storage_dir: str) -> tuple[str, str]:
    storage_path = Path(storage_dir)
    if not storage_path.exists():
        return "warn", f"녹음 저장소 경로 없음: {storage_dir}"
    if not storage_path.is_dir():
        return "bad", f"녹음 저장소가 디렉터리가 아님: {storage_dir}"
    return "ok", f"녹음 저장소 경로 확인됨: {storage_dir}"


def _uses_default_database_password(database_url: str) -> bool:
    return "now-local-password" in database_url


def _llm_state(provider: str, api_key: str | None) -> str:
    if provider == "local":
        return "외부 LLM 없이 로컬 기본 처리"
    if api_key:
        return "외부 LLM 연결 정보 있음"
    return "외부 LLM API Key 미설정"


def _ops_summary_status(checks: list[dict[str, str]]) -> str:
    statuses = {check["status"] for check in checks}
    if "bad" in statuses:
        return "bad"
    if "warn" in statuses:
        return "warn"
    return "ok"
