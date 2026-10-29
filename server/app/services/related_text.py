"""Exact linked slot ownership and explicit presence; no content inference."""
import json
from contextlib import contextmanager

from sqlalchemy import event, inspect, select, delete
from sqlalchemy.orm import Session

from app.models.note import AnalysisJob, Recording, Note
from app.models.note_history import NoteHead
from app.models.note_related import LinkedSchema, LinkedText
from app.services.note_crypto_fence import error, require_unfenced
from app.services.note_history import lock_note_writes

SLOTS = {"analysis_input": (AnalysisJob, "input_text"), "analysis_result": (AnalysisJob, "result_json"),
         "analysis_error": (AnalysisJob, "error_message"), "recording_transcript": (Recording, "transcript")}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def key(kind, ident):
    return {"kind": kind, "id": str(ident), "slot": SLOTS[kind][1]}


def linked_rows(db, owner, local):
    rows = []
    for model in (AnalysisJob, Recording):
        rows.extend(db.scalars(select(model).where(model.owner_id == owner, model.note_local_id == local)))
    return rows


def exists(db, owner, local):
    return any(db.scalar(select(model.id).where(model.owner_id == owner, model.note_local_id == local).limit(1)) is not None
               for model in (AnalysisJob, Recording))


def ensure_head(db, owner, local):
    head = db.get(NoteHead, (owner, local))
    if head is None and db.scalar(select(Note.id).where(Note.owner_id == owner, Note.local_id == local).limit(1)) is None:
        head = NoteHead(owner_id=owner, local_id=local, version=0, head_revision_id=None, crypto_epoch=0,
                        history_generation=0, protection_state="legacy", identity_state="related_only")
        db.add(head)
    return head


def active_drain(db, owner, local):
    from app.models.note_related import RelatedDrain
    from app.services.note_crypto_fence import database_now
    rows = list(db.scalars(select(RelatedDrain).where(RelatedDrain.owner_id == owner, RelatedDrain.local_id == local,
                                                     RelatedDrain.state.in_(("draining", "ready")))))
    for row in rows:
        if row.expires_at <= database_now(db):
            row.state = "expired"
        else:
            return row
    return None


def guard(db, refs, *, worker_job=None):
    lock_note_writes(db, [o for o, l in refs])
    require_unfenced(db, refs)
    for owner, local in refs:
        head = db.get(NoteHead, (owner, local))
        if head is not None and (head.crypto_epoch or head.protection_state != "legacy"):
            error("related_representation_required")
        d = active_drain(db, owner, local)
        if d is not None:
            runs = json.loads(d.conditions_json)["accepted_runs"]
            if worker_job is None or worker_job not in [r["job_id"] for r in runs]:
                error("related_drain_in_progress", 423)


def legacy_read(db, rows):
    if not rows:
        return
    lock_note_writes(db, [row.owner_id for row in rows])
    checked = set()
    for row in rows:
        original = (row.owner_id, row.note_local_id)
        db.refresh(row)
        if (row.owner_id, row.note_local_id) != original:
            error("related_identity_changed")
        if row.note_local_id is None:
            continue
        scope = (row.owner_id, row.note_local_id)
        if scope not in checked:
            require_unfenced(db, [scope])
            slots(db, *scope)
            checked.add(scope)
        head = db.get(NoteHead, (row.owner_id, row.note_local_id))
        if head is not None and (head.crypto_epoch or head.protection_state != "legacy"):
            error("related_representation_required")


@contextmanager
def worker_write(db, job_id):
    before = db.info.get("related_worker_job")
    db.info["related_worker_job"] = job_id
    try:
        yield
        db.flush()
    finally:
        db.info["related_worker_job"] = before


def slots(db, owner, local):
    result = []
    for row in linked_rows(db, owner, local):
        for kind, (model, field) in SLOTS.items():
            if not isinstance(row, model):
                continue
            k = key(kind, row.id)
            m = db.get(LinkedText, (owner, local, canonical(k)))
            if m is None or m.is_null != (getattr(row, field) is None):
                error("inconsistent_related_text")
            if (type(m.slot_version) is not int or m.slot_version < 0 or type(m.representation_epoch) is not int
                or m.representation_kind not in ("plain_text_v1", "linked_text_envelope_v1")):
                error("inconsistent_related_text")
            head = db.get(NoteHead, (owner, local))
            if m.representation_kind == "plain_text_v1":
                if m.representation_epoch != 0 or m.storage_operation_id is not None or (head and head.crypto_epoch):
                    error("inconsistent_related_text")
            else:
                from app.services.related_conversion import descriptor
                if head is None or m.representation_epoch != head.crypto_epoch:
                    error("inconsistent_related_text")
                descriptor(db, owner, local, k, row, m, getattr(row, field))
            result.append((k, row, m, getattr(row, field)))
    return sorted(result, key=lambda value: tuple(value[0][k].encode() for k in ("kind", "id", "slot")))


def initialize(connection):
    """One initial, locked cohort only; never backfill missing rows at read time."""
    version = connection.scalar(select(LinkedSchema.version).where(LinkedSchema.id == 1))
    if version is not None:
        if type(version) is not int or version != 1:
            raise RuntimeError("unsupported linked metadata schema")
        return
    if connection.dialect.name == "postgresql":
        import hashlib
        from sqlalchemy import text
        owners = set()
        for model in (AnalysisJob, Recording):
            owners.update(connection.scalars(select(model.owner_id).where(model.note_local_id.is_not(None))))
        for owner in sorted(owners):
            ident = int.from_bytes(hashlib.sha256(("note-history:" + owner).encode()).digest()[:8], "big", signed=True)
            connection.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": ident})
    for model in (AnalysisJob, Recording):
        for row in connection.execute(select(model.__table__).where(model.note_local_id.is_not(None))).mappings():
            head = connection.execute(select(NoteHead.__table__).where(NoteHead.owner_id == row["owner_id"],
                NoteHead.local_id == row["note_local_id"])).mappings().first()
            if head and (head["crypto_epoch"] or head["protection_state"] != "legacy"):
                raise RuntimeError("linked schema requires explicit protected cohort verification")
            if head is None and connection.scalar(select(Note.id).where(Note.owner_id == row["owner_id"],
                Note.local_id == row["note_local_id"]).limit(1)) is None:
                connection.execute(NoteHead.__table__.insert().values(owner_id=row["owner_id"], local_id=row["note_local_id"],
                    version=0, head_revision_id=None, crypto_epoch=0, history_generation=0,
                    protection_state="legacy", identity_state="related_only"))
            for kind, (target, field) in SLOTS.items():
                if target is model:
                    connection.execute(LinkedText.__table__.insert().values(owner_id=row["owner_id"], local_id=row["note_local_id"],
                        key_json=canonical(key(kind, row["id"])), representation_kind="plain_text_v1", representation_epoch=0,
                        is_null=row[field] is None, storage_operation_id=None, slot_version=0))
    connection.execute(LinkedSchema.__table__.insert().values(id=1, version=1))


@event.listens_for(Session, "before_flush")
def guard_natural(db, flush_context, instances):
    queue = []
    for row in list(db.new) + list(db.dirty) + list(db.deleted):
        if not isinstance(row, (AnalysisJob, Recording)):
            continue
        state = inspect(row)
        old = None
        if state.identity is not None:
            old = db.connection().execute(select(type(row).__table__).where(type(row).id == state.identity[0])).mappings().first()
            if old is None:
                error("related_identity_changed")
        owner = state.dict.get("owner_id", old["owner_id"] if old else None)
        local = state.dict.get("note_local_id", old["note_local_id"] if old else None)
        refs = []
        if old is not None and old["note_local_id"] is not None:
            refs.append((old["owner_id"], old["note_local_id"]))
        if owner is not None and local is not None:
            refs.append((owner, local))
        if refs:
            guard(db, sorted(set(refs)), worker_job=db.info.get("related_worker_job"))
            if old is not None:
                current = db.connection().execute(select(type(row).__table__).where(type(row).id == state.identity[0])).mappings().first()
                if current is None or (current["owner_id"], current["note_local_id"]) != (old["owner_id"], old["note_local_id"]):
                    error("related_identity_changed")
                old = current
            if isinstance(row, AnalysisJob) and old is not None and db.info.get("related_worker_job") != row.id:
                from app.models.note_related import AnalysisRun
                run = db.get(AnalysisRun, row.id)
                if run is not None and run.claimed_by is not None and run.receipt_json is None:
                    error("worker_claim_required")
            queue.append((row, old, row in db.deleted))
    if queue:
        db.info["related_queue"] = queue


@event.listens_for(Session, "after_flush_postexec")
def persist_metadata(db, flush_context):
    for row, old, removed in db.info.pop("related_queue", []):
        actual = None if removed else db.connection().execute(select(type(row).__table__).where(type(row).id == row.id)).mappings().one()
        scopes = set()
        if old and old["note_local_id"] is not None:
            scopes.add((old["owner_id"], old["note_local_id"]))
        if actual is not None and actual["note_local_id"] is not None:
            scopes.add((actual["owner_id"], actual["note_local_id"]))
        for owner, local in scopes:
            changed = False
            moved = removed or (owner, local) != (actual["owner_id"], actual["note_local_id"])
            for kind, (model, field) in SLOTS.items():
                if not isinstance(row, model):
                    continue
                k = canonical(key(kind, row.id)); m = db.get(LinkedText, (owner, local, k))
                if moved:
                    if m is not None:
                        db.delete(m); changed = True
                    continue
                new_value = actual[field]
                if m is None:
                    if old and (old["owner_id"], old["note_local_id"]) == (owner, local):
                        error("inconsistent_related_text")
                    db.add(LinkedText(owner_id=owner, local_id=local, key_json=k, representation_kind="plain_text_v1",
                        representation_epoch=0, is_null=new_value is None, storage_operation_id=None, slot_version=1))
                    changed = True
                elif old is not None and old[field] != new_value:
                    m.slot_version += 1; m.is_null = new_value is None; changed = True
            if changed:
                head = ensure_head(db, owner, local)
                if head is not None:
                    head.history_generation += 1
                    if head.identity_state == "related_only" and not exists(db, owner, local) and db.scalar(select(Note.id).where(
                        Note.owner_id == owner, Note.local_id == local).limit(1)) is None:
                        head.identity_state = "branch_only"


@event.listens_for(Session, "after_soft_rollback")
def discard_queue(db, previous_transaction):
    db.info.pop("related_queue", None)
