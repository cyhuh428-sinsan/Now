from datetime import datetime

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.models.note import Note, NoteAttachment
from app.schemas.note import NoteIn, NoteOut, NoteSyncRequest, NoteSyncResponse
from app.services.note_attachment_storage import resolve_note_attachment_path, save_note_attachment
from app.services.note_sync import group_shared_owner_ids, list_changed_notes, sort_notes_for_upsert, upsert_note as save_note
from app.services.mail_settings import send_note_mail
from app.services.user_accounts import require_user_api_access
from app.services.user_devices import require_active_user_device

router = APIRouter(
    prefix="/api/v1/notes",
    tags=["notes"],
    dependencies=[Depends(require_client_api_access)],
)


class NoteMailRequest(BaseModel):
    to: list[str] = Field(min_length=1, max_length=20)
    subject: str | None = Field(default=None, max_length=240)
    message: str | None = Field(default=None, max_length=2000)


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
        include_group_shared=bool(web_session_token),
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
    group_owner_ids = group_shared_owner_ids(db, owner_id=owner_id) if web_session_token else []
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


@router.post("/{note_id}/mail")
def mail_note(
    note_id: str,
    payload: NoteMailRequest,
    owner_id: str = Query(max_length=80),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    stmt = select(Note).where(Note.owner_id == user.owner_id, Note.deleted_at.is_(None))
    if note_id.isdigit():
        stmt = stmt.where(or_(Note.local_id == note_id, Note.id == int(note_id)))
    else:
        stmt = stmt.where(Note.local_id == note_id)
    note = db.scalar(stmt)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="note not found")
    send_note_mail(
        db,
        owner_id=user.owner_id,
        note=note,
        to=payload.to,
        subject=payload.subject,
        message=payload.message,
    )
    return {"status": "ok", "sent": True}


# 2.3.6 P12: 노트/스케치 첨부. 본문에는 참조(nownote-attachment://{storage_key})만
# 남기고 이미지 자체는 여기로 올리고 내려받는다. 메신저 첨부 저장소의 기계적인 부분
# (app/services/attachment_storage.py)을 재사용하되 정책은 노트 전용
# (note_attachment_storage.py: PNG만, owner_id 기준 경로)이다.


@router.post("/attachments")
async def upload_note_attachment(
    owner_id: str = Query(max_length=80),
    file: UploadFile = File(...),
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
    saved = await save_note_attachment(owner_id=owner_id, upload=file)
    attachment = NoteAttachment(owner_id=owner_id, **saved)
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return {"status": "ok", "attachment": _note_attachment_payload(attachment)}


@router.get("/attachments/{storage_key}")
def download_note_attachment(
    storage_key: str,
    owner_id: str = Query(max_length=80),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> FileResponse:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    attachment = db.scalar(select(NoteAttachment).where(NoteAttachment.storage_key == storage_key))
    if attachment is None or attachment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="attachment not found")
    if attachment.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="attachment not owned by this user")
    target = resolve_note_attachment_path(attachment.storage_path)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="attachment file missing")
    return FileResponse(
        target,
        media_type=attachment.content_type,
        filename=attachment.original_name,
    )


def _note_attachment_payload(attachment: NoteAttachment) -> dict:
    return {
        "storage_key": attachment.storage_key,
        "original_name": attachment.original_name,
        "content_type": attachment.content_type,
        "extension": attachment.extension,
        "size_bytes": attachment.size_bytes,
        "sha256": attachment.sha256,
        "created_at": attachment.created_at,
    }
