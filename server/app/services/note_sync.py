from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.note import Note
from app.schemas.note import NoteIn


def validate_note(payload: NoteIn) -> None:
    if payload.level > 3:
        raise HTTPException(status_code=400, detail="note level must be 1..3")
    if payload.level == 1 and payload.parent_local_id:
        raise HTTPException(status_code=400, detail="level 1 note cannot have parent")
    if payload.level > 1 and not payload.parent_local_id:
        raise HTTPException(status_code=400, detail="child note requires parent")
    if payload.note_type != "tree" and payload.parent_local_id:
        raise HTTPException(status_code=400, detail="only tree note can have parent")


def upsert_note(payload: NoteIn, db: Session) -> Note:
    validate_note(payload)
    note = db.scalar(
        select(Note).where(
            Note.owner_id == payload.owner_id,
            Note.device_id == payload.device_id,
            Note.local_id == payload.local_id,
        )
    )

    if note is None:
        note = Note(**payload.model_dump())
        db.add(note)
        return note

    if (
        note.client_updated_at
        and payload.client_updated_at
        and payload.client_updated_at < note.client_updated_at
    ):
        return note

    for key, value in payload.model_dump().items():
        setattr(note, key, value)
    return note


def list_changed_notes(
    db: Session,
    *,
    owner_id: str,
    updated_after: datetime | None,
    include_deleted: bool,
) -> list[Note]:
    stmt = select(Note).where(Note.owner_id == owner_id)
    if updated_after is not None:
        stmt = stmt.where(Note.updated_at > updated_after)
    if not include_deleted:
        stmt = stmt.where(Note.deleted_at.is_(None))
    stmt = stmt.order_by(Note.updated_at.asc(), Note.id.asc())
    return list(db.scalars(stmt).all())
