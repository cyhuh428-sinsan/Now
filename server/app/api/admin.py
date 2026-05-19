import hashlib
import json
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.capabilities import API_VERSION, TWO_FACTOR_AUTH_STATUS
from app.core.config import get_settings
from app.core.security import require_api_token
from app.db import get_db
from app.models.note import AnalysisJob, Note, Recording, SyncLog, UserAccount, UserDevice
from app.services.user_accounts import create_user_account, issue_user_access_token, update_user_account
from app.services.user_devices import set_user_device_active

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
    dependencies=[Depends(require_api_token)],
)


class UserAccountUpdate(BaseModel):
    email: str | None = Field(default=None, max_length=240)
    display_name: str | None = Field(default=None, max_length=120)
    timezone: str = Field(default="Asia/Seoul", max_length=80)
    group_name: str = Field(default="사용자", max_length=80)
    two_factor_enabled: bool = False
    is_active: bool = True


class UserAccountCreate(UserAccountUpdate):
    owner_id: str = Field(max_length=80)


class BackupVerifyRequest(BaseModel):
    backup: dict = Field(default_factory=dict)


class UserDeviceUpdate(BaseModel):
    is_active: bool = True


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
    device_id: str | None = Query(default=None),
    transcript_status: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(Recording).order_by(Recording.updated_at.desc(), Recording.id.desc())
    if owner_id:
        stmt = stmt.where(Recording.owner_id == owner_id)
    if device_id:
        stmt = stmt.where(Recording.device_id == device_id)
    if transcript_status == "with":
        stmt = stmt.where(Recording.transcript.is_not(None))
    elif transcript_status == "without":
        stmt = stmt.where(Recording.transcript.is_(None))
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
    device_id: str | None = Query(default=None),
    include_deleted: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(SyncLog).order_by(SyncLog.created_at.desc(), SyncLog.id.desc())
    if owner_id:
        stmt = stmt.where(SyncLog.owner_id == owner_id)
    if device_id:
        stmt = stmt.where(SyncLog.device_id == device_id)
    if include_deleted is not None:
        stmt = stmt.where(SyncLog.include_deleted == (1 if include_deleted else 0))
    return _export_payload("sync_logs", list(db.scalars(stmt).all()))


@router.get("/export/users")
def export_users(
    owner_id: str | None = Query(default=None),
    group_name: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    token_filter: str | None = Query(default=None, alias="token"),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(UserAccount).order_by(
        UserAccount.last_seen_at.desc().nullslast(),
        UserAccount.updated_at.desc(),
        UserAccount.id.desc(),
    )
    if owner_id:
        stmt = stmt.where(UserAccount.owner_id == owner_id)
    if group_name:
        stmt = stmt.where(UserAccount.group_name == group_name)
    if status_filter == "active":
        stmt = stmt.where(UserAccount.is_active == 1)
    elif status_filter == "inactive":
        stmt = stmt.where(UserAccount.is_active == 0)
    elif status_filter == "never_seen":
        stmt = stmt.where(UserAccount.last_seen_at.is_(None))
    if token_filter == "issued":
        stmt = stmt.where(UserAccount.access_token_hash.is_not(None))
    elif token_filter == "missing":
        stmt = stmt.where(UserAccount.access_token_hash.is_(None))
    if q:
        keyword = f"%{q.strip()}%"
        stmt = stmt.where(
            UserAccount.owner_id.ilike(keyword)
            | UserAccount.email.ilike(keyword)
            | UserAccount.display_name.ilike(keyword)
        )
    return _export_payload("users", list(db.scalars(stmt).all()))


@router.get("/export/devices")
def export_devices(
    owner_id: str | None = Query(default=None),
    device_id: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(UserDevice).order_by(
        UserDevice.last_seen_at.desc().nullslast(),
        UserDevice.updated_at.desc(),
        UserDevice.id.desc(),
    )
    if owner_id:
        stmt = stmt.where(UserDevice.owner_id == owner_id)
    if device_id:
        stmt = stmt.where(UserDevice.device_id == device_id)
    if status_filter == "active":
        stmt = stmt.where(UserDevice.is_active == 1)
    elif status_filter == "inactive":
        stmt = stmt.where(UserDevice.is_active == 0)
    return _export_payload("devices", list(db.scalars(stmt).all()))


@router.get("/export/all")
def export_all(db: Session = Depends(get_db)) -> JSONResponse:
    settings = get_settings()
    exported_at = datetime.utcnow()
    notes = list(db.scalars(select(Note).order_by(Note.updated_at.desc(), Note.id.desc())).all())
    recordings = list(
        db.scalars(select(Recording).order_by(Recording.updated_at.desc(), Recording.id.desc())).all()
    )
    users = list(
        db.scalars(
            select(UserAccount).order_by(
                UserAccount.last_seen_at.desc().nullslast(),
                UserAccount.updated_at.desc(),
                UserAccount.id.desc(),
            )
        ).all()
    )
    devices = list(
        db.scalars(
            select(UserDevice).order_by(
                UserDevice.last_seen_at.desc().nullslast(),
                UserDevice.updated_at.desc(),
                UserDevice.id.desc(),
            )
        ).all()
    )
    analysis_jobs = list(
        db.scalars(
            select(AnalysisJob).order_by(AnalysisJob.updated_at.desc(), AnalysisJob.id.desc())
        ).all()
    )
    sync_logs = list(
        db.scalars(select(SyncLog).order_by(SyncLog.created_at.desc(), SyncLog.id.desc())).all()
    )
    payload = {
        "name": "now_note_server_backup",
        "backup_schema_version": 1,
        "api_version": API_VERSION,
        "server": settings.server_name,
        "exported_at": exported_at,
        "includes_recording_files": False,
        "includes_deleted_notes": True,
        "summary": _export_summary_counts(db),
        "items": {
            "notes": [_model_to_dict(row) for row in notes],
            "recordings": [_model_to_dict(row) for row in recordings],
            "users": [_model_to_dict(row) for row in users],
            "devices": [_model_to_dict(row) for row in devices],
            "analysis_jobs": [_model_to_dict(row) for row in analysis_jobs],
            "sync_logs": [_model_to_dict(row) for row in sync_logs],
        },
    }
    encoded_payload = jsonable_encoder(payload)
    content_sha256 = _backup_content_sha256(encoded_payload)
    encoded_payload["content_sha256"] = content_sha256
    filename = f"nownote-server-backup-{exported_at.strftime('%Y%m%d-%H%M%S')}.json"
    return JSONResponse(
        content=encoded_payload,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Now-Backup-Sha256": content_sha256,
        },
    )


@router.get("/export/summary")
def export_summary(db: Session = Depends(get_db)) -> dict:
    return {
        "name": "export_summary",
        "checked_at": datetime.utcnow(),
        "items": _export_summary_counts(db),
    }


@router.post("/export/verify")
def verify_export(payload: BackupVerifyRequest) -> dict:
    checks = _verify_backup_payload(payload.backup)
    status_counts = _check_status_counts(checks)
    return {
        "status": _verification_status(status_counts),
        "checked_at": datetime.utcnow(),
        "summary": _backup_verify_summary(payload.backup),
        "status_counts": status_counts,
        "checks": checks,
    }


@router.get("/users")
def users(
    owner_id: str | None = Query(default=None),
    group_name: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    token_filter: str | None = Query(default=None, alias="token"),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> dict:
    stmt = select(UserAccount)
    if owner_id:
        stmt = stmt.where(UserAccount.owner_id == owner_id)
    if group_name:
        stmt = stmt.where(UserAccount.group_name == group_name)
    if status_filter == "active":
        stmt = stmt.where(UserAccount.is_active == 1)
    elif status_filter == "inactive":
        stmt = stmt.where(UserAccount.is_active == 0)
    elif status_filter == "never_seen":
        stmt = stmt.where(UserAccount.last_seen_at.is_(None))
    if token_filter == "issued":
        stmt = stmt.where(UserAccount.access_token_hash.is_not(None))
    elif token_filter == "missing":
        stmt = stmt.where(UserAccount.access_token_hash.is_(None))
    if q:
        keyword = f"%{q.strip()}%"
        stmt = stmt.where(
            UserAccount.owner_id.ilike(keyword)
            | UserAccount.email.ilike(keyword)
            | UserAccount.display_name.ilike(keyword)
        )
    stmt = stmt.order_by(
        UserAccount.last_seen_at.desc().nullslast(),
        UserAccount.updated_at.desc(),
        UserAccount.id.desc(),
    )
    rows = list(
        db.scalars(stmt).all()
    )
    return {
        "count": len(rows),
        "active": sum(1 for row in rows if row.is_active),
        "two_factor_enabled": sum(1 for row in rows if row.two_factor_enabled),
        "token_issued": sum(1 for row in rows if row.access_token_hash),
        "token_missing": sum(1 for row in rows if not row.access_token_hash),
        "items": [_model_to_dict(row) for row in rows],
    }


@router.post("/users")
def create_user(
    payload: UserAccountCreate,
    db: Session = Depends(get_db),
) -> dict:
    user = create_user_account(
        db,
        owner_id=payload.owner_id,
        email=payload.email,
        display_name=payload.display_name,
        timezone=payload.timezone,
        group_name=payload.group_name,
        two_factor_enabled=payload.two_factor_enabled,
        is_active=payload.is_active,
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="user already exists or owner_id is empty",
        )
    db.commit()
    db.refresh(user)
    return {"status": "ok", "user": _model_to_dict(user)}


@router.patch("/users/{owner_id}")
def update_user(
    owner_id: str,
    payload: UserAccountUpdate,
    db: Session = Depends(get_db),
) -> dict:
    user = update_user_account(
        db,
        owner_id=owner_id,
        email=payload.email,
        display_name=payload.display_name,
        timezone=payload.timezone,
        group_name=payload.group_name,
        two_factor_enabled=payload.two_factor_enabled,
        is_active=payload.is_active,
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found",
        )
    db.commit()
    db.refresh(user)
    return {"status": "ok", "user": _model_to_dict(user)}


@router.post("/users/{owner_id}/token")
def issue_user_token(
    owner_id: str,
    db: Session = Depends(get_db),
) -> dict:
    issued = issue_user_access_token(db, owner_id=owner_id)
    if issued is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user not found",
        )
    user, raw_token = issued
    db.commit()
    db.refresh(user)
    return {
        "status": "ok",
        "owner_id": user.owner_id,
        "token": raw_token,
        "issued_at": user.access_token_issued_at,
        "message": "이 토큰은 다시 표시되지 않습니다.",
    }


@router.patch("/devices/{owner_id}/{device_id}")
def update_device(
    owner_id: str,
    device_id: str,
    payload: UserDeviceUpdate,
    db: Session = Depends(get_db),
) -> dict:
    device = set_user_device_active(
        db,
        owner_id=owner_id,
        device_id=device_id,
        is_active=payload.is_active,
    )
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="device not found",
        )
    db.commit()
    db.refresh(device)
    return {"status": "ok", "device": _model_to_dict(device)}


@router.get("/ops")
def ops_status(db: Session = Depends(get_db)) -> dict:
    settings = get_settings()
    checks = []

    db_status = "ok"
    db_message = "DB 연결 정상"
    note_total = 0
    recording_total = 0
    user_total = 0
    inactive_users = 0
    users_without_seen = 0
    users_without_token = 0
    device_total = 0
    inactive_devices = 0
    failed_jobs = 0
    queued_jobs = 0
    running_jobs = 0
    deleted_notes = 0
    recordings_without_transcript = 0
    try:
        db.execute(text("select 1"))
        note_total = db.scalar(select(func.count()).select_from(Note)) or 0
        recording_total = db.scalar(select(func.count()).select_from(Recording)) or 0
        user_total = db.scalar(select(func.count()).select_from(UserAccount)) or 0
        inactive_users = (
            db.scalar(
                select(func.count()).select_from(UserAccount).where(UserAccount.is_active == 0)
            )
            or 0
        )
        users_without_seen = (
            db.scalar(
                select(func.count())
                .select_from(UserAccount)
                .where(UserAccount.last_seen_at.is_(None))
            )
            or 0
        )
        users_without_token = (
            db.scalar(
                select(func.count())
                .select_from(UserAccount)
                .where(UserAccount.access_token_hash.is_(None))
            )
            or 0
        )
        device_total = db.scalar(select(func.count()).select_from(UserDevice)) or 0
        inactive_devices = (
            db.scalar(
                select(func.count()).select_from(UserDevice).where(UserDevice.is_active == 0)
            )
            or 0
        )
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

    checks.append({"name": "데이터베이스", "status": db_status, "message": db_message})
    storage_status, storage_message = _recording_storage_state(settings.storage_dir)
    checks.append(
        {
            "name": "녹음 저장소",
            "status": storage_status,
            "message": storage_message,
        }
    )
    token_status, token_message = _api_token_state(settings.api_token)
    checks.append({"name": "API 토큰", "status": token_status, "message": token_message})
    checks.append(
        {
            "name": "공용 서버 인증",
            "status": "warn" if settings.user_token_required and users_without_token else "info",
            "message": _user_token_state(settings.user_token_required, users_without_token),
        }
    )
    checks.extend(_public_server_readiness_checks())
    password_status, password_message = _database_password_state(settings.database_url)
    checks.append(
        {
            "name": "PostgreSQL 비밀번호",
            "status": password_status,
            "message": password_message,
        }
    )
    checks.append(
        {
            "name": "LLM 제공자",
            "status": "ok" if settings.llm_provider != "local" else "info",
            "message": _llm_state(settings.llm_provider, settings.openai_api_key),
        }
    )
    checks.append(
        {
            "name": "실패한 분석 작업",
            "status": "bad" if failed_jobs else "ok",
            "message": f"{failed_jobs}건",
        }
    )
    checks.append(
        {
            "name": "대기 중인 분석 작업",
            "status": "warn" if queued_jobs > 20 else "ok",
            "message": f"queued {queued_jobs}건, running {running_jobs}건",
        }
    )
    checks.append(
        {
            "name": "비활성 사용자",
            "status": "info" if inactive_users else "ok",
            "message": f"비활성 사용자 {inactive_users}명",
        }
    )
    checks.append(
        {
            "name": "접속 기록 없는 사용자",
            "status": "info" if users_without_seen else "ok",
            "message": f"최근 접속 기록 없음 {users_without_seen}명",
        }
    )
    checks.append(
        {
            "name": "비활성 기기",
            "status": "info" if inactive_devices else "ok",
            "message": f"등록 기기 {device_total}개, 비활성 기기 {inactive_devices}개",
        }
    )
    checks.append(
        {
            "name": "삭제 표시 메모",
            "status": "info" if deleted_notes else "ok",
            "message": f"삭제 표시 메모 {deleted_notes}건",
        }
    )
    checks.append(
        {
            "name": "텍스트 없는 녹음",
            "status": "info" if recordings_without_transcript else "ok",
            "message": f"transcript 없는 녹음 {recordings_without_transcript}건",
        }
    )
    checks.append(
        {
            "name": "백업/복구 절차",
            "status": "info",
            "message": "/admin/export에서 전체 백업과 status_counts.bad=0 검증, /admin/recovery에서 복구 기준 확인",
        }
    )

    return {
        "status": _ops_summary_status(checks),
        "checked_at": datetime.utcnow(),
        "summary": {
            "notes": note_total,
            "recordings": recording_total,
            "users": user_total,
            "inactive_users": inactive_users,
            "users_without_seen": users_without_seen,
            "users_without_token": users_without_token,
            "devices": device_total,
            "inactive_devices": inactive_devices,
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


def _backup_content_sha256(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _verify_backup_payload(payload: dict) -> list[dict[str, str]]:
    checks = [
        _verify_check(
            "백업 이름",
            payload.get("name") == "now_note_server_backup",
            "now_note_server_backup",
            str(payload.get("name")),
        ),
        _verify_check(
            "스키마 버전",
            payload.get("backup_schema_version") == 1,
            "1",
            str(payload.get("backup_schema_version")),
        ),
        _verify_check(
            "API 버전",
            payload.get("api_version") == API_VERSION,
            API_VERSION,
            str(payload.get("api_version")),
        ),
        _verify_check(
            "녹음 파일 포함 여부",
            payload.get("includes_recording_files") is False,
            "false",
            str(payload.get("includes_recording_files")),
        ),
        _verify_check(
            "삭제 표시 메모 포함 여부",
            payload.get("includes_deleted_notes") is True,
            "true",
            str(payload.get("includes_deleted_notes")),
        ),
    ]

    items = payload.get("items") if isinstance(payload.get("items"), dict) else {}
    required_sections = ["notes", "recordings", "users", "analysis_jobs", "sync_logs"]
    missing_sections = [section for section in required_sections if not isinstance(items.get(section), list)]
    checks.append(
        _verify_check(
            "백업 항목",
            not missing_sections,
            "필수 항목 모두 존재",
            ", ".join(missing_sections) if missing_sections else "정상",
        )
    )

    checksum = payload.get("content_sha256")
    checksum_payload = dict(payload)
    checksum_payload.pop("content_sha256", None)
    recalculated = _backup_content_sha256(checksum_payload)
    checks.append(
        _verify_check(
            "체크섬",
            checksum == recalculated,
            "본문 기준 SHA-256 일치",
            "일치" if checksum == recalculated else "불일치",
        )
    )

    users = items.get("users") if isinstance(items.get("users"), list) else []
    token_leaks = [
        user
        for user in users
        if isinstance(user, dict) and ("access_token_hash" in user or "token" in user)
    ]
    checks.append(
        _verify_check(
            "토큰 민감정보",
            not token_leaks,
            "원문 토큰/토큰 해시 없음",
            f"{len(token_leaks)}건 발견" if token_leaks else "정상",
        )
    )
    return checks


def _backup_verify_summary(payload: dict) -> dict:
    items = payload.get("items") if isinstance(payload.get("items"), dict) else {}
    summary = {}
    for section in ["notes", "recordings", "users", "devices", "analysis_jobs", "sync_logs"]:
        value = items.get(section)
        summary[section] = len(value) if isinstance(value, list) else None
    summary["exported_at"] = payload.get("exported_at")
    summary["content_sha256"] = payload.get("content_sha256")
    return summary


def _verify_check(name: str, passed: bool, expected: str, actual: str) -> dict[str, str]:
    return {
        "name": name,
        "status": "ok" if passed else "bad",
        "expected": expected,
        "actual": actual,
    }


def _check_status_counts(checks: list[dict[str, str]]) -> dict[str, int]:
    counts = {"ok": 0, "warn": 0, "bad": 0}
    for check in checks:
        status = check.get("status")
        if status not in counts:
            continue
        counts[status] += 1
    return counts


def _verification_status(status_counts: dict[str, int]) -> str:
    if status_counts.get("bad", 0):
        return "bad"
    if status_counts.get("warn", 0):
        return "warn"
    return "ok"


def _export_summary_counts(db: Session) -> dict:
    note_total = db.scalar(select(func.count()).select_from(Note)) or 0
    active_notes = (
        db.scalar(select(func.count()).select_from(Note).where(Note.deleted_at.is_(None)))
        or 0
    )
    deleted_notes = note_total - active_notes
    recordings = db.scalar(select(func.count()).select_from(Recording)) or 0
    recordings_without_transcript = (
        db.scalar(
            select(func.count()).select_from(Recording).where(Recording.transcript.is_(None))
        )
        or 0
    )
    users = db.scalar(select(func.count()).select_from(UserAccount)) or 0
    devices = db.scalar(select(func.count()).select_from(UserDevice)) or 0
    users_with_token = (
        db.scalar(
            select(func.count())
            .select_from(UserAccount)
            .where(UserAccount.access_token_hash.is_not(None))
        )
        or 0
    )
    analysis_jobs = db.scalar(select(func.count()).select_from(AnalysisJob)) or 0
    sync_logs = db.scalar(select(func.count()).select_from(SyncLog)) or 0
    return {
        "notes": note_total,
        "active_notes": active_notes,
        "deleted_notes": deleted_notes,
        "recordings": recordings,
        "recordings_without_transcript": recordings_without_transcript,
        "users": users,
        "users_with_token": users_with_token,
        "devices": devices,
        "analysis_jobs": analysis_jobs,
        "sync_logs": sync_logs,
        "total_export_items": note_total + recordings + users + devices + analysis_jobs + sync_logs,
    }


def _model_to_dict(row) -> dict:
    data = {column.name: getattr(row, column.name) for column in row.__table__.columns}
    if isinstance(row, UserAccount):
        data.pop("access_token_hash", None)
        data["access_token_configured"] = bool(row.access_token_hash)
    return data


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


def _api_token_state(api_token: str | None) -> tuple[str, str]:
    if not api_token:
        return "warn", "로컬 개발은 가능하지만 공용 오픈 전 설정 필요"
    if api_token.startswith("change-this"):
        return "warn", ".env.example 예시 토큰 사용 중"
    return "ok", "설정됨"


def _database_password_state(database_url: str) -> tuple[str, str]:
    if "now-local-password" in database_url:
        return "warn", "기본 DB 비밀번호 사용 중"
    if "change-this-postgres-password" in database_url:
        return "warn", ".env.example 예시 DB 비밀번호 사용 중"
    return "ok", "기본 DB 비밀번호 아님"


def _user_token_state(required: bool, users_without_token: int) -> str:
    if required and users_without_token:
        return f"사용자별 토큰 필수, 토큰 없는 사용자 {users_without_token}명"
    if required:
        return "사용자별 토큰 필수, 모든 사용자 토큰 발급됨"
    if users_without_token:
        return f"개인 서버 기본값, 사용자별 토큰 선택 사용 가능, 토큰 없는 사용자 {users_without_token}명"
    return "개인 서버 기본값, 사용자별 토큰 선택 사용 가능"


def _public_server_readiness_checks() -> list[dict[str, str]]:
    return [
        {
            "name": "공용 서버 로그인 화면",
            "status": "info",
            "message": "정식 오픈 전 사용자별 토큰 전달 UI 또는 로그인 화면 필요",
        },
        {
            "name": "공용 서버 2단계 인증",
            "status": "info",
            "message": f"현재는 사용 여부 관리 상태, 실제 로그인 2단계 인증 절차는 {TWO_FACTOR_AUTH_STATUS}",
        },
        {
            "name": "공용 서버 기기 등록",
            "status": "info",
            "message": "정식 오픈 전 사용자별 기기 등록/해제 흐름 확인 필요",
        },
        {
            "name": "공용 서버 데이터 격리",
            "status": "info",
            "message": "정식 오픈 전 사용자별 데이터 접근 격리 검증 필요",
        },
        {
            "name": "공개 운영 환경",
            "status": "info",
            "message": "정식 오픈 전 도메인, HTTPS, reverse proxy, 복구 절차 최종 확인 필요",
        },
    ]


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
