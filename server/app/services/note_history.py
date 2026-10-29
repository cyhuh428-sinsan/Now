"""Capture Note operations at the caller's natural flush, without committing."""
import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import event, select, text
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy import inspect

from app.models.note import Note
from app.models.note_history import NoteHead, NoteInventory, NoteRevision

FIELDS = tuple(column.name for column in Note.__table__.columns)
MEANING = ("note_type", "title", "content", "parent_local_id", "level", "tags", "source", "deleted_at")
QUEUE = "now_note_history_queue"
LOCKS = "now_note_history_locks"


def lock_note_writes(db, owners):
    transaction = db.get_transaction()
    state = db.info.get(LOCKS)
    if state is None or state[0] is not transaction:
        connection = db.connection()
        transaction = db.get_transaction()
        if connection.dialect.name == "sqlite" and not connection.connection.driver_connection.in_transaction:
            db.execute(text("BEGIN IMMEDIATE"))
        state = (transaction, set())
        db.info[LOCKS] = state
    for owner in sorted(set(owners)):
        if owner in state[1]:
            continue
        if db.bind.dialect.name == "postgresql":
            key = int.from_bytes(hashlib.sha256(("note-history:" + owner).encode()).digest()[:8], "big", signed=True)
            db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})
        state[1].add(owner)


def raw_snapshot(note):
    return {field: getattr(note, field) for field in FIELDS}


def encoded(raw):
    def date(value):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")
    values = {key: date(value) if isinstance(value, datetime) else value for key, value in raw.items()}
    return json.dumps({"schema_version": 1, "note": values}, ensure_ascii=False, separators=(",", ":"))


def prepare_history(db, owner, local_id):
    from app.services.note_crypto_fence import require_unfenced
    require_unfenced(db, [(owner, local_id)])
    lock_note_writes(db, [owner])
    queue = db.info.setdefault(QUEUE, {"baselines": {}, "events": []})
    key = (owner, local_id)
    if key not in queue["baselines"]:
        rows = db.scalars(select(Note).where(Note.owner_id == owner, Note.local_id == local_id)).all()
        queue["baselines"][key] = [raw_snapshot(row) for row in rows]


def require_legacy_writes(db, refs):
    refs = set(refs)
    lock_note_writes(db, [owner for owner, _ in refs])
    from app.services.note_crypto_fence import require_unfenced
    require_unfenced(db, refs)
    for ref in sorted(refs):
        head = db.get(NoteHead, ref)
        if head and (head.protection_state != "legacy" or head.crypto_epoch != 0):
            raise HTTPException(status_code=409, detail={"code": "protected_note_requires_upgrade"},
                                headers={"Cache-Control": "no-store"})


def capture_change(db, note, before, reason="write"):
    from app.services.note_crypto_fence import require_unfenced
    require_unfenced(db, [(note.owner_id, note.local_id)])
    db.info[QUEUE]["events"].append((note, before, raw_snapshot(note), reason))


def pending_or_get(db, model, key):
    for row in db.new:
        if isinstance(row, model) and tuple(getattr(row, column.name) for column in model.__table__.primary_key) == key:
            return row
    return db.get(model, key)


def inventories(db, owner, local_id):
    rows = list(db.scalars(select(NoteInventory).where(
        NoteInventory.owner_id == owner, NoteInventory.local_id == local_id)))
    rows.extend(row for row in db.new if isinstance(row, NoteInventory)
                and row.owner_id == owner and row.local_id == local_id)
    return rows


def representative(rows):
    if not rows:
        return "coherent", None
    notes = [(row, json.loads(row.snapshot_json)["note"]) for row in rows]
    if len({note["note_type"] for _, note in notes}) > 1:
        return "ambiguous", None
    def sort_key(pair):
        note = pair[1]
        stamp = note["client_updated_at"] or note["updated_at"] or note["created_at"]
        return datetime.fromisoformat(stamp.replace("Z", "+00:00")), note["id"]
    return "coherent", max(notes, key=sort_key)[0].revision_id


def add_revision(db, raw, reason, parent=None, before=None):
    head = pending_or_get(db, NoteHead, (raw["owner_id"], raw["local_id"]))
    revision = NoteRevision(id=str(uuid4()), owner_id=raw["owner_id"], local_id=raw["local_id"],
                            note_id=raw["id"], reason=reason, parent_revision_id=parent,
                            snapshot_json=encoded(raw), before_snapshot_json=encoded(before) if before else None,
                            representation_epoch=head.crypto_epoch if head else 0, representation_kind="snapshot_v1")
    db.add(revision)
    return revision.id


def persist_history(db):
    # Do not defer these rows to another ORM flush: a subsequent SAVEPOINT may
    # otherwise roll back history belonging to an already-flushed outer Note.
    models = (NoteHead, NoteRevision, NoteInventory)
    connection = db.connection()
    for row in list(db.new) + list(db.dirty):
        if not isinstance(row, models):
            continue
        table = row.__table__
        values = {column.name: getattr(row, column.name) for column in table.columns}
        if row in db.new:
            if isinstance(row, NoteRevision) and values["captured_at"] is None:
                values.pop("captured_at")
            connection.execute(table.insert().values(**values))
            db.expunge(row)
        else:
            statement = table.update()
            for column in table.primary_key:
                statement = statement.where(column == values[column.name])
            connection.execute(statement.values(**values))
            for field, value in values.items():
                set_committed_value(row, field, value)


@event.listens_for(Session, "after_flush_postexec")
def finalize_history(db, flush_context):
    queue = db.info.pop(QUEUE, None)
    if queue is None:
        return
    from app.services.note_crypto_fence import require_unfenced
    require_unfenced(db, list(queue["baselines"]) + [(after["owner_id"], after["local_id"]) for _, _, after, _ in queue["events"]])
    for key, snapshots in queue["baselines"].items():
        head = pending_or_get(db, NoteHead, key)
        initial = head is None
        if initial:
            head = NoteHead(owner_id=key[0], local_id=key[1], version=0, identity_state="coherent",
                            protection_state="legacy", crypto_epoch=0, history_generation=0)
            db.add(head)
        for raw in snapshots:
            if pending_or_get(db, NoteInventory, (*key, raw["id"])) is None:
                revision_id = add_revision(db, raw, "baseline")
                db.add(NoteInventory(owner_id=key[0], local_id=key[1], note_id=raw["id"],
                                     revision_id=revision_id, snapshot_json=encoded(raw)))
                head.history_generation += 1
        if initial:
            head.identity_state, head.head_revision_id = representative(inventories(db, *key))

    for note, before, after, reason in queue["events"]:
        # Defaults/onupdate now exist; content keeps each pre-flush accepted step.
        for field in ("id", "created_at", "updated_at"):
            after[field] = getattr(note, field)
        key = (after["owner_id"], after["local_id"])
        head = pending_or_get(db, NoteHead, key)
        inventory = pending_or_get(db, NoteInventory, (*key, after["id"]))
        changed = before is None or any(before[field] != after[field] for field in MEANING)
        if changed:
            revision_id = add_revision(db, after, reason, inventory.revision_id if inventory else None, before)
        else:
            revision_id = inventory.revision_id
        if inventory is None:
            inventory = NoteInventory(owner_id=key[0], local_id=key[1], note_id=after["id"], revision_id=revision_id)
            db.add(inventory)
        next_snapshot = encoded(after)
        if inventory.snapshot_json != next_snapshot:
            head.history_generation += 1
        inventory.revision_id = revision_id
        inventory.snapshot_json = next_snapshot
        state, pointer = representative(inventories(db, *key))
        if changed or state != head.identity_state or pointer != head.head_revision_id:
            head.version += 1
        head.identity_state, head.head_revision_id = state, pointer
    persist_history(db)


@event.listens_for(Session, "before_flush")
def fence_natural_note_writes(db, flush_context, instances):
    from app.services.note_crypto_fence import require_unfenced
    from app.services.note_crypto_fence import error
    refs, originals = [], []
    for row in list(db.new) + list(db.dirty) + list(db.deleted):
        if not isinstance(row, Note):
            continue
        state = inspect(row)
        original = None
        if state.identity is not None:
            # Attribute history can be empty after an expired/deferred assignment.
            original = db.connection().execute(select(Note.owner_id, Note.local_id).where(Note.id == state.identity[0])).first()
            if original is None:
                error("note_identity_changed")
            refs.append(tuple(original))
            originals.append((state.identity[0], tuple(original)))
        owner = state.dict.get("owner_id", original[0] if original else None)
        local = state.dict.get("local_id", original[1] if original else None)
        if owner is not None and local is not None:
            refs.append((owner, local))
    if refs:
        require_unfenced(db, refs)
        for ident, expected in originals:
            actual = db.connection().execute(select(Note.owner_id, Note.local_id).where(Note.id == ident)).first()
            if actual is None or tuple(actual) != expected:
                error("note_identity_changed")


@event.listens_for(Session, "after_soft_rollback")
def discard_history(db, previous_transaction):
    db.info.pop(QUEUE, None)
    # PostgreSQL releases advisory locks acquired after a rolled-back savepoint.
    db.info.pop(LOCKS, None)


@event.listens_for(Session, "before_commit")
def capture_read_only_baseline(db):
    # A stale request has no dirty Note, so SQLAlchemy would skip flush entirely.
    if QUEUE in db.info and not (db.new or db.dirty or db.deleted):
        finalize_history(db, None)


@event.listens_for(Session, "after_transaction_end")
def end_history_transaction(db, transaction):
    if transaction.parent is None:
        db.info.pop(QUEUE, None)
        db.info.pop(LOCKS, None)
