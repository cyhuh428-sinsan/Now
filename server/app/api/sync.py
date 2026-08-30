from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.models.note import Note, SyncLog
from app.schemas.note import SyncRequest, SyncResponse
from app.services.note_sync import as_naive_utc, list_changed_notes, sort_notes_for_upsert, upsert_note
from app.services.user_accounts import require_user_api_access
from app.services.user_devices import require_active_user_device

router = APIRouter(
    prefix="/api/v1/sync",
    tags=["sync"],
    dependencies=[Depends(require_client_api_access)],
)


@router.post("", response_model=SyncResponse)
def sync(
    payload: SyncRequest,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> SyncResponse:
    require_user_api_access(
        db,
        owner_id=payload.owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    require_active_user_device(db, owner_id=payload.owner_id, device_id=payload.device_id)

    pushed: list[Note] = []
    try:
        for note in sort_notes_for_upsert(payload.notes):
            pushed.append(upsert_note(note, db))
        db.commit()
    except HTTPException as exc:
        # upsert_note()가 던진 예외로 이 함수가 끝난다. 부분 반영이 커밋되지
        # 않도록 롤백부터 하고, 실패 사유만 담은 SyncLog를 남긴 뒤 원래
        # 예외를 그대로 다시 던진다(클라이언트 응답은 지금과 같아야 한다).
        db.rollback()
        db.add(
            SyncLog(
                owner_id=payload.owner_id,
                device_id=payload.device_id,
                pushed_count=0,
                pulled_count=0,
                include_deleted=1 if payload.include_deleted else 0,
                updated_after=as_naive_utc(payload.updated_after),
                succeeded=0,
                failure_reason=f"{note.local_id}: {exc.detail}",
            )
        )
        db.commit()
        raise

    for note in pushed:
        db.refresh(note)

    pulled = list_changed_notes(
        db,
        owner_id=payload.owner_id,
        updated_after=payload.updated_after,
        include_deleted=payload.include_deleted,
        include_group_shared=bool(web_session_token),
    )
    db.add(
        SyncLog(
            owner_id=payload.owner_id,
            device_id=payload.device_id,
            pushed_count=len(pushed),
            pulled_count=len(pulled),
            include_deleted=1 if payload.include_deleted else 0,
            updated_after=as_naive_utc(payload.updated_after),
            succeeded=1,
        )
    )
    db.commit()
    return SyncResponse(
        pushed_notes=pushed,
        pulled_notes=pulled,
        server_time=datetime.utcnow(),
    )


@router.get("/status")
def sync_status(
    owner_id: str = Query(max_length=80),
    device_id: str = Query(max_length=120),
    limit: int = Query(default=5, ge=1, le=50),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    logs = list(
        db.scalars(
            select(SyncLog)
            .where(SyncLog.owner_id == owner_id, SyncLog.device_id == device_id)
            .order_by(SyncLog.created_at.desc(), SyncLog.id.desc())
            .limit(limit)
        ).all()
    )
    latest = logs[0] if logs else None
    latest_failure = next((log for log in logs if not bool(log.succeeded)), None)
    return {
        "status": "ok",
        "owner_id": owner_id,
        "device_id": device_id,
        "last_synced_at": latest.created_at if latest else None,
        "last_sync_succeeded": bool(latest.succeeded) if latest else None,
        "last_failure_reason": latest_failure.failure_reason if latest_failure else None,
        "last_failure_at": latest_failure.created_at if latest_failure else None,
        "recent": [_sync_log_payload(log) for log in logs],
    }


def _sync_log_payload(log: SyncLog) -> dict:
    return {
        "created_at": log.created_at,
        "succeeded": bool(log.succeeded),
        "failure_reason": log.failure_reason,
        "pushed_count": log.pushed_count,
        "pulled_count": log.pulled_count,
    }
