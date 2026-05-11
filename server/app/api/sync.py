from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_api_token
from app.db import get_db
from app.models.note import SyncLog
from app.schemas.note import SyncRequest, SyncResponse
from app.services.note_sync import as_naive_utc, list_changed_notes, upsert_note
from app.services.user_accounts import require_active_user

router = APIRouter(
    prefix="/api/v1/sync",
    tags=["sync"],
    dependencies=[Depends(require_api_token)],
)


@router.post("", response_model=SyncResponse)
def sync(payload: SyncRequest, db: Session = Depends(get_db)) -> SyncResponse:
    require_active_user(db, owner_id=payload.owner_id)
    pushed = [upsert_note(note, db) for note in payload.notes]
    db.commit()
    for note in pushed:
        db.refresh(note)

    pulled = list_changed_notes(
        db,
        owner_id=payload.owner_id,
        updated_after=payload.updated_after,
        include_deleted=payload.include_deleted,
    )
    db.add(
        SyncLog(
            owner_id=payload.owner_id,
            device_id=payload.device_id,
            pushed_count=len(pushed),
            pulled_count=len(pulled),
            include_deleted=1 if payload.include_deleted else 0,
            updated_after=as_naive_utc(payload.updated_after),
        )
    )
    db.commit()
    return SyncResponse(
        pushed_notes=pushed,
        pulled_notes=pulled,
        server_time=datetime.utcnow(),
    )
