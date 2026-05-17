from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_api_token
from app.db import get_db
from app.models.note import AnalysisJob
from app.schemas.analysis import AnalysisJobCreate, AnalysisJobOut, AnalysisJobUpdate
from app.services.user_accounts import require_user_api_access

router = APIRouter(
    prefix="/api/v1/analysis",
    tags=["analysis"],
    dependencies=[Depends(require_api_token)],
)

ALLOWED_JOB_TYPES = {"memo_summary", "daily_briefing", "tree_note_index", "recording_summary"}
ALLOWED_STATUSES = {"queued", "running", "done", "failed", "cancelled"}


@router.get("/jobs", response_model=list[AnalysisJobOut])
def list_jobs(
    owner_id: str = Query(default="local_user"),
    status_filter: str | None = Query(default=None, alias="status"),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    db: Session = Depends(get_db),
) -> list[AnalysisJob]:
    require_user_api_access(db, owner_id=owner_id, access_token=user_token)
    stmt = select(AnalysisJob).where(AnalysisJob.owner_id == owner_id)
    if status_filter is not None:
        stmt = stmt.where(AnalysisJob.status == status_filter)
    stmt = stmt.order_by(AnalysisJob.created_at.desc()).limit(100)
    return list(db.scalars(stmt).all())


@router.post("/jobs", response_model=AnalysisJobOut)
def create_job(
    payload: AnalysisJobCreate,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    require_user_api_access(db, owner_id=payload.owner_id, access_token=user_token)
    if payload.job_type not in ALLOWED_JOB_TYPES:
        raise HTTPException(status_code=400, detail="unsupported analysis job type")
    job = AnalysisJob(**payload.model_dump(), status="queued")
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.get("/jobs/{job_id}", response_model=AnalysisJobOut)
def get_job(
    job_id: int,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    job = db.get(AnalysisJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    require_user_api_access(db, owner_id=job.owner_id, access_token=user_token)
    return job


@router.patch("/jobs/{job_id}", response_model=AnalysisJobOut)
def update_job(
    job_id: int,
    payload: AnalysisJobUpdate,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    db: Session = Depends(get_db),
) -> AnalysisJob:
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="unsupported analysis job status")
    job = db.get(AnalysisJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="job not found")
    require_user_api_access(db, owner_id=job.owner_id, access_token=user_token)
    job.status = payload.status
    job.result_json = payload.result_json
    job.error_message = payload.error_message
    db.commit()
    db.refresh(job)
    return job
