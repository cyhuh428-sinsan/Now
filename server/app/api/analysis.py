from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.models.note import AnalysisJob
from app.schemas.analysis import AnalysisJobCreate, AnalysisJobOut, AnalysisJobUpdate
from app.services.user_accounts import require_user_api_access
from app.services import related_text as linked

router = APIRouter(
    prefix="/api/v1/analysis",
    tags=["analysis"],
    dependencies=[Depends(require_client_api_access)],
)

ALLOWED_JOB_TYPES = {
    "memo_summary",
    "daily_briefing",
    "tree_note_index",
    "recording_summary",
    "knowledge_2_0_review",
    "embedding_index",
    "similar_notes",
    "duplicate_candidates",
    "relation_suggestions",
    "tag_property_suggestions",
    "knowledge_health",
}
ALLOWED_STATUSES = {"queued", "running", "done", "failed", "cancelled"}
RESTARTABLE_STATUSES = {"failed", "cancelled", "done"}


def locked_job(db, job_id):
    from app.services.note_history import lock_note_writes
    identity = db.execute(select(AnalysisJob.owner_id, AnalysisJob.note_local_id).where(AnalysisJob.id == job_id)).first()
    if identity is None:
        raise HTTPException(status_code=404, detail="job not found")
    lock_note_writes(db, [identity[0]])
    db.expire_all()
    job = db.get(AnalysisJob, job_id)
    if job is None or (job.owner_id, job.note_local_id) != tuple(identity):
        linked.error("related_identity_changed")
    return job


@router.get("/jobs", response_model=list[AnalysisJobOut])
def list_jobs(
    owner_id: str = Query(default="local_user"),
    status_filter: str | None = Query(default=None, alias="status"),
    note_local_id: str | None = Query(default=None),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> list[AnalysisJob]:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    stmt = select(AnalysisJob).where(AnalysisJob.owner_id == owner_id)
    if note_local_id is not None:
        stmt = stmt.where(AnalysisJob.note_local_id == note_local_id)
    if status_filter is not None:
        stmt = stmt.where(AnalysisJob.status == status_filter)
    stmt = stmt.order_by(AnalysisJob.created_at.desc()).limit(100)
    rows = list(db.scalars(stmt).all())
    linked.legacy_read(db, rows)
    return rows


@router.post("/jobs", response_model=AnalysisJobOut)
def create_job(
    payload: AnalysisJobCreate,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    require_user_api_access(
        db,
        owner_id=payload.owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    if payload.job_type not in ALLOWED_JOB_TYPES:
        raise HTTPException(status_code=400, detail="unsupported analysis job type")
    if payload.note_local_id is not None:
        linked.guard(db, [(payload.owner_id, payload.note_local_id)])
    job = AnalysisJob(**payload.model_dump(), status="queued")
    db.add(job)
    db.commit()
    db.refresh(job)
    linked.legacy_read(db, [job])
    return job


@router.get("/jobs/{job_id}", response_model=AnalysisJobOut)
def get_job(
    job_id: int,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    job = db.get(AnalysisJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    require_user_api_access(
        db,
        owner_id=job.owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    linked.legacy_read(db, [job])
    return job


@router.patch("/jobs/{job_id}", response_model=AnalysisJobOut)
def update_job(
    job_id: int,
    payload: AnalysisJobUpdate,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="unsupported analysis job status")
    job = db.get(AnalysisJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    require_user_api_access(
        db,
        owner_id=job.owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    if job.note_local_id is not None:
        linked.guard(db, [(job.owner_id, job.note_local_id)])
    job.status = payload.status
    job.result_json = payload.result_json
    job.error_message = payload.error_message
    db.commit()
    db.refresh(job)
    linked.legacy_read(db, [job])
    return job


@router.post("/jobs/{job_id}/cancel", response_model=AnalysisJobOut)
def cancel_job(
    job_id: int,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    job = locked_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    require_user_api_access(
        db,
        owner_id=job.owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    if job.note_local_id is not None:
        linked.guard(db, [(job.owner_id, job.note_local_id)])
    if job.status not in {"queued", "running"}:
        raise HTTPException(status_code=400, detail="analysis job cannot be cancelled")
    from app.services.related_drain import cancel
    cancel(db, job)
    db.commit()
    db.refresh(job)
    linked.legacy_read(db, [job])
    return job


@router.post("/jobs/{job_id}/retry", response_model=AnalysisJobOut)
def retry_job(
    job_id: int,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    job = locked_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    require_user_api_access(
        db,
        owner_id=job.owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    if job.note_local_id is not None:
        linked.guard(db, [(job.owner_id, job.note_local_id)])
    if job.status not in RESTARTABLE_STATUSES:
        raise HTTPException(status_code=400, detail="analysis job cannot be retried")
    from app.models.note_related import AnalysisRun
    from app.services.related_drain import require_settled_retry
    from uuid import uuid4
    run = db.get(AnalysisRun, job.id)
    require_settled_retry(db, job, run)
    job.status = "queued"
    job.result_json = None
    job.error_message = None
    if run is not None:
        run.run_id, run.receipt_json, run.claimed_by, run.claimed_until = str(uuid4()), None, None, None
        run.dispatched = False; run.run_version += 1
    db.commit()
    db.refresh(job)
    linked.legacy_read(db, [job])
    return job
