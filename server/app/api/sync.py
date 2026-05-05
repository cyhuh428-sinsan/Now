from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_api_token
from app.db import get_db
from app.schemas.note import SyncRequest, SyncResponse
from app.services.note_sync import list_changed_notes, upsert_note

router = APIRouter(
    prefix="/api/v1/sync",
    tags=["sync"],
    dependencies=[Depends(require_api_token)],
)


@router.post("", response_model=SyncResponse)
def sync(payload: SyncRequest, db: Session = Depends(get_db)) -> SyncResponse:
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
    return SyncResponse(
        pushed_notes=pushed,
        pulled_notes=pulled,
        server_time=datetime.utcnow(),
    )
