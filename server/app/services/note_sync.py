from datetime import datetime, timezone

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


def validate_tree_parent(payload: NoteIn, db: Session) -> None:
    if payload.note_type != "tree" or payload.level == 1:
        return
    db.flush()
    stmt = select(Note).where(
        Note.owner_id == payload.owner_id,
        Note.local_id == payload.parent_local_id,
        Note.note_type == "tree",
    )
    if payload.deleted_at is None:
        stmt = stmt.where(Note.deleted_at.is_(None))
    parent = db.scalar(stmt.order_by(Note.updated_at.desc(), Note.id.desc()))
    if parent is None:
        raise HTTPException(status_code=400, detail="parent note not found")
    if parent.level != payload.level - 1:
        raise HTTPException(status_code=400, detail="invalid parent note level")


def sort_notes_for_upsert(notes: list[NoteIn]) -> list[NoteIn]:
    return sorted(notes, key=lambda note: (note.level if note.note_type == "tree" else 0, note.local_id))


def upsert_note(payload: NoteIn, db: Session) -> Note:
    validate_note(payload)
    validate_tree_parent(payload, db)
    payload_data = _normalized_note_data(payload)
    note = db.scalar(
        select(Note)
        .where(
            Note.owner_id == payload.owner_id,
            Note.device_id == payload.device_id,
            Note.local_id == payload.local_id,
        )
    )
    if note is None:
        note = db.scalar(
            select(Note)
            .where(
                Note.owner_id == payload.owner_id,
                Note.local_id == payload.local_id,
            )
            .order_by(Note.updated_at.desc(), Note.id.desc())
        )

    if note is None:
        note = Note(**payload_data)
        db.add(note)
        return note

    if (
        note.client_updated_at
        and payload_data["client_updated_at"]
        and payload_data["client_updated_at"] < note.client_updated_at
    ):
        return note

    for key, value in payload_data.items():
        setattr(note, key, value)
    return note


def list_changed_notes(
    db: Session,
    *,
    owner_id: str,
    updated_after: datetime | None,
    include_deleted: bool,
) -> list[Note]:
    updated_after = as_naive_utc(updated_after)
    stmt = select(Note).where(Note.owner_id == owner_id)
    if updated_after is not None:
        stmt = stmt.where(Note.updated_at > updated_after)
    if not include_deleted:
        stmt = stmt.where(Note.deleted_at.is_(None))
    stmt = stmt.order_by(Note.updated_at.asc(), Note.id.asc())
    return _dedupe_notes_by_local_id(list(db.scalars(stmt).all()))


def _dedupe_notes_by_local_id(notes: list[Note]) -> list[Note]:
    latest: dict[tuple[str, str], Note] = {}
    for note in notes:
        key = (note.note_type, note.local_id)
        current = latest.get(key)
        if current is None or _note_sort_key(note) > _note_sort_key(current):
            latest[key] = note
    return sorted(latest.values(), key=_note_sort_key)


def _note_sort_key(note: Note) -> tuple[datetime, int]:
    return (note.client_updated_at or note.updated_at or note.created_at, note.id)


def _normalized_note_data(payload: NoteIn) -> dict:
    data = payload.model_dump()
    data["client_updated_at"] = as_naive_utc(data["client_updated_at"])
    data["deleted_at"] = as_naive_utc(data["deleted_at"])
    return data


def as_naive_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)
