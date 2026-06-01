from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.models.note import Note
from app.schemas.note import NoteIn, NoteOut, NoteSyncRequest, NoteSyncResponse
from app.services.note_sync import group_shared_owner_ids, list_changed_notes, sort_notes_for_upsert, upsert_note as save_note
from app.services.user_accounts import require_user_api_access
from app.services.user_devices import require_active_user_device

router = APIRouter(
    prefix="/api/v1/notes",
    tags=["notes"],
    dependencies=[Depends(require_client_api_access)],
)


@router.get("", response_model=list[NoteOut])
def list_notes(
    owner_id: str = Query(default="local_user"),
    updated_after: datetime | None = None,
    include_deleted: bool = False,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> list[Note]:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    return list_changed_notes(
        db,
        owner_id=owner_id,
        updated_after=updated_after,
        include_deleted=include_deleted,
        include_group_shared=True,
    )


@router.post("", response_model=NoteOut)
def upsert_note(
    payload: NoteIn,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> Note:
    require_user_api_access(
        db,
        owner_id=payload.owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    require_active_user_device(db, owner_id=payload.owner_id, device_id=payload.device_id)
    note = save_note(payload, db)
    db.commit()
    db.refresh(note)
    return note


@router.get("/search", response_model=list[NoteOut])
def search_notes(
    q: str = Query(min_length=1),
    owner_id: str = Query(default="local_user"),
    note_type: str | None = None,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> list[Note]:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    keyword = f"%{q}%"
    group_owner_ids = group_shared_owner_ids(db, owner_id=owner_id)
    stmt = (
        select(Note)
        .where(
            or_(
                Note.owner_id == owner_id,
                Note.owner_id.in_(group_owner_ids) & (Note.note_type == "tree"),
            )
        )
        .where(Note.deleted_at.is_(None))
        .where(or_(Note.title.ilike(keyword), Note.content.ilike(keyword)))
    )
    if note_type is not None:
        stmt = stmt.where(Note.note_type == note_type)
    stmt = stmt.order_by(Note.updated_at.desc()).limit(100)
    return list(db.scalars(stmt).all())


@router.delete("/{local_id}", response_model=NoteOut)
def delete_note(
    local_id: str,
    owner_id: str = Query(default="local_user"),
    device_id: str | None = None,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> Note:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    stmt = select(Note).where(Note.owner_id == owner_id, Note.local_id == local_id)
    if device_id is not None:
        stmt = stmt.where(Note.device_id == device_id)
    note = db.scalar(stmt)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="note not found")
    note.deleted_at = datetime.utcnow()
    db.commit()
    db.refresh(note)
    return note


@router.post("/sync", response_model=NoteSyncResponse)
def sync_notes(
    payload: NoteSyncRequest,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> NoteSyncResponse:
    saved: list[Note] = []
    owner_ids = {item.owner_id for item in payload.notes}
    for owner_id in owner_ids:
        require_user_api_access(
            db,
            owner_id=owner_id,
            access_token=user_token,
            web_session_token=web_session_token,
        )
    for item in sort_notes_for_upsert(payload.notes):
        require_active_user_device(db, owner_id=item.owner_id, device_id=item.device_id)
        saved.append(save_note(item, db))
    db.commit()
    for note in saved:
        db.refresh(note)
    return NoteSyncResponse(notes=saved)
