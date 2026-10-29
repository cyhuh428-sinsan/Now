import base64
import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import literal, select, tuple_, union_all

from app.models.note import Note
from app.models.note_history import NoteHead, NoteInventory, NoteRevision
from app.models.note_v2 import NoteMutation, NoteOfflineBranch
from app.schemas.note import NoteIn
from app.schemas.note_v2 import NoteValue, Snapshot
from app.services.note_history import (
    MEANING, capture_change, encoded, finalize_history, inventories,
    lock_note_writes, prepare_history, raw_snapshot,
)
from app.services.note_sync import _note_sort_key, validate_note, validate_tree_parent
from app.services.user_devices import require_active_user_device


def error(code, status=409):
    raise HTTPException(status_code=status, detail={"code": code}, headers={"Cache-Control": "no-store"})


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def scope(db, owner, local):
    lock_note_writes(db, [owner])
    rows = list(db.scalars(select(Note).where(Note.owner_id == owner, Note.local_id == local).order_by(Note.id)))
    return db.get(NoteHead, (owner, local)), rows


def baseline(db, owner, local):
    prepare_history(db, owner, local)
    finalize_history(db, None)
    return db.get(NoteHead, (owner, local))


def check_epoch(head, epoch):
    if epoch != (head.crypto_epoch if head else 0):
        error("crypto_epoch_changed")


def encrypted(content):
    try:
        prefix = "NOW_ENCRYPTED_V1:"
        if not content.startswith(prefix):
            return False
        value = json.loads(base64.b64decode(content[len(prefix):], validate=True))
        return (set(value) == {"v", "alg", "kdf", "iterations", "salt", "iv", "data"}
                and type(value["v"]) is int and value["v"] == 1
                and value["alg"] == "AES-GCM" and value["kdf"] == "PBKDF2-SHA256"
                and type(value["iterations"]) is int and value["iterations"] > 0
                and len(base64.b64decode(value["salt"], validate=True)) == 16
                and len(base64.b64decode(value["iv"], validate=True)) == 12
                and len(base64.b64decode(value["data"], validate=True)) >= 16)
    except (ValueError, TypeError, KeyError, AttributeError):
        return False


def protected(head):
    return head is not None and (head.protection_state != "legacy" or head.crypto_epoch != 0)


def get_ref(db, owner, local, ref):
    model = NoteRevision if ref.kind == "note_revision" else NoteOfflineBranch
    row = db.get(model, ref.id)
    if row is None or row.owner_id != owner or row.local_id != local:
        error("revision_not_found", 404)
    return row


def representation(row, head):
    if row.representation_epoch != (head.crypto_epoch if head else 0):
        error("crypto_epoch_changed")
    if row.representation_kind != "snapshot_v1":
        error("unsupported_representation")
    try:
        value = Snapshot.model_validate(json.loads(row.snapshot_json)).model_dump()
    except (ValueError, TypeError):
        error("unsupported_representation")
    if protected(head) and not encrypted(value["note"]["content"]):
        error("unsupported_representation")
    return value


def current(db, owner, local):
    try:
        head, rows = scope(db, owner, local)
        if not rows:
            error("note_not_found", 404)
        head = baseline(db, owner, local)
        if head.identity_state != "coherent":
            db.commit()  # Retain the non-destructive baseline, not a chosen body.
            error("ambiguous_note_identity")
        row = max(rows, key=_note_sort_key)
        if protected(head) and not encrypted(row.content):
            error("unsupported_representation")
        inventory = inventories(db, owner, local)
        bodies = [tuple(json.loads(item.snapshot_json)["note"][field] for field in MEANING) for item in inventory]
        result = {"status": "ok", "snapshot": json.loads(encoded(raw_snapshot(row))),
                  "head_version": head.version, "head_revision_id": head.head_revision_id,
                  "identity_state": head.identity_state, "crypto_epoch": head.crypto_epoch,
                  "protection_state": head.protection_state, "history_generation": head.history_generation,
                  "replica_count": len(rows), "inventory_revision_ids": sorted(item.revision_id for item in inventory),
                  "has_replica_variants": len(set(bodies)) > 1}
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


def read_revision(db, owner, local, ref):
    head, _ = scope(db, owner, local)
    value = representation(get_ref(db, owner, local, ref), head)
    return {"status": "ok", "revision_ref": ref.model_dump(), "snapshot": value,
            "crypto_epoch": head.crypto_epoch if head else 0}


def list_revisions(db, owner, local, limit, cursor):
    lock_note_writes(db, [owner])
    head = db.get(NoteHead, (owner, local))
    epoch, generation = (head.crypto_epoch, head.history_generation) if head else (0, 0)
    queries = []
    for model, kind in [(NoteRevision, "note_revision"), (NoteOfflineBranch, "offline_branch")]:
        parent_kind = literal("note_revision") if kind == "note_revision" else model.parent_kind
        parent_id = model.parent_revision_id if kind == "note_revision" else model.parent_id
        reason = model.reason if kind == "note_revision" else literal("offline_import")
        queries.append(select(model.id.label("id"), literal(kind).label("kind"), model.captured_at.label("stamp"),
                              parent_kind.label("parent_kind"), parent_id.label("parent_id"),
                              model.representation_epoch.label("epoch"), reason.label("reason"))
                       .where(model.owner_id == owner, model.local_id == local))
    table = union_all(*queries).subquery()
    query = select(table).order_by(table.c.stamp.desc(), table.c.id.desc(), table.c.kind.desc()).limit(limit + 1)
    if cursor:
        try:
            value = json.loads(base64.urlsafe_b64decode(cursor))
            if value[:4] != [owner, local, epoch, generation] or len(value) != 7:
                error("history_changed")
            stamp = datetime.fromisoformat(value[4])
            query = query.where(tuple_(table.c.stamp, table.c.id, table.c.kind) < (stamp, value[5], value[6]))
        except (ValueError, TypeError, IndexError):
            error("invalid_cursor", 422)
    rows = list(db.execute(query).mappings())
    items = [{"revision_ref": {"kind": row["kind"], "id": row["id"]},
              "parent_ref": {"kind": row["parent_kind"], "id": row["parent_id"]} if row["parent_id"] else None,
              "captured_at": row["stamp"].isoformat(timespec="microseconds") + "Z",
              "representation_epoch": row["epoch"], "reason": row["reason"]} for row in rows[:limit]]
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = base64.urlsafe_b64encode(canonical(
            [owner, local, epoch, generation, last["stamp"].isoformat(), last["id"], last["kind"]]).encode()).decode()
    return {"status": "ok", "items": items, "next_cursor": next_cursor,
            "crypto_epoch": epoch, "history_generation": generation}


def semantic(note):
    return NoteValue.model_validate({field: note[field] for field in MEANING}).model_dump()


def conditions(body, operation):
    value = body.model_dump(exclude={"note", "entries"})
    if operation == "import":
        value["entries"] = sorted([entry.model_dump(exclude={"snapshot"}) for entry in body.entries], key=lambda entry: entry["revision_id"])
    return value


def replay(db, body, operation, head):
    previous = db.get(NoteMutation, (body.owner_id, body.mutation_id))
    if previous is None:
        return None
    if previous.crypto_epoch != body.crypto_epoch:
        error("crypto_epoch_changed")
    if previous.operation != operation or json.loads(previous.conditions_json) != conditions(body, operation):
        error("idempotency_mismatch")
    result = json.loads(previous.result_json)
    if operation == "put":
        from app.schemas.note_v2 import RevisionRef
        row = get_ref(db, body.owner_id, body.local_id, RevisionRef(kind="note_revision", id=result["result_revision_id"]))
        if semantic(representation(row, head)["note"]) != body.note.model_dump():
            error("idempotency_mismatch")
    if operation == "import":
        for entry in body.entries:
            from app.schemas.note_v2 import RevisionRef
            row = get_ref(db, body.owner_id, body.local_id, RevisionRef(kind="offline_branch", id=entry.revision_id))
            if representation(row, head) != entry.snapshot.model_dump():
                error("idempotency_mismatch")
    return result


def validate_cas(db, body, head, rows):
    if rows and head is None:
        error("baseline_required")
    if head and head.identity_state == "ambiguous":
        error("ambiguous_note_identity")
    if body.base_head_version != (head.version if head else 0):
        error("version_conflict")
    if body.base_revision_id != (head.head_revision_id if head else None):
        error("base_revision_mismatch")
    inventory = sorted(item.revision_id for item in inventories(db, body.owner_id, body.local_id))
    if inventory != body.expected_inventory_revision_ids:
        error("version_conflict")
    if len(rows) > 1 and body.replica_policy != "selected_head_only":
        error("replica_selection_required")


def validate_v2_note(payload, db=None):
    try:
        validate_note(payload)
    except HTTPException:
        error("invalid_note_structure", 422)
    if db is not None:
        try:
            validate_tree_parent(payload, db)
        except HTTPException:
            error("invalid_note_parent")


def adopt(db, body, value, head, rows, reason):
    if protected(head) and not encrypted(value.content):
        error("protected_note_requires_upgrade")
    if len(rows) > 1 and any(row.note_type != value.note_type for row in rows):
        error("ambiguous_note_identity")
    row = max(rows, key=_note_sort_key) if rows else None
    if rows:
        pointer = db.get(NoteRevision, head.head_revision_id)
        if pointer is None or pointer.note_id != row.id:
            error("head_application_conflict")
    stamp = max([datetime.utcnow()] + [_note_sort_key(item)[0] for item in rows])
    data = value.model_dump()
    if data["deleted_at"]:
        data["deleted_at"] = datetime.fromisoformat(data["deleted_at"].replace("Z", "+00:00")).replace(tzinfo=None)
    payload = NoteIn(owner_id=body.owner_id, local_id=body.local_id, device_id=row.device_id if row else body.device_id,
                     client_updated_at=stamp, **data)
    validate_v2_note(payload, db)
    prepare_history(db, body.owner_id, body.local_id)
    before = raw_snapshot(row) if row else None
    if row is None:
        row = Note(**payload.model_dump())
        db.add(row)
    else:
        for field, item in data.items():
            setattr(row, field, item)
        row.client_updated_at = stamp
    capture_change(db, row, before, reason)
    db.flush()
    head = db.get(NoteHead, (body.owner_id, body.local_id))
    revision = db.get(NoteRevision, head.head_revision_id) if head else None
    if (head is None or head.identity_state != "coherent" or revision is None or revision.note_id != row.id
            or semantic(json.loads(revision.snapshot_json)["note"]) != value.model_dump()):
        error("head_application_conflict")
    return head


def import_branches(db, body, head):
    entries = {entry.revision_id: entry for entry in body.entries}
    if len(entries) != len(body.entries):
        error("revision_id_conflict")
    for entry in body.entries:
        raw = entry.snapshot.note
        if raw.owner_id != body.owner_id or raw.local_id != body.local_id:
            error("owner_mismatch", 403)
        validate_v2_note(NoteIn(**raw.model_dump(exclude={"id", "created_at", "updated_at"})))
        if protected(head) and not encrypted(raw.content):
            error("protected_note_requires_upgrade")
        parent = entry.parent_ref
        if parent and not (parent.kind == "offline_branch" and parent.id in entries):
            try:
                get_ref(db, body.owner_id, body.local_id, parent)
            except HTTPException as exc:
                if exc.status_code == 404:
                    error("invalid_revision_parent")
                raise
        previous = db.get(NoteOfflineBranch, entry.revision_id)
        if previous:
            parent_value = {"kind": previous.parent_kind, "id": previous.parent_id} if previous.parent_id else None
            if (previous.owner_id != body.owner_id or previous.local_id != body.local_id
                    or representation(previous, head) != entry.snapshot.model_dump()
                    or parent_value != (parent.model_dump() if parent else None)):
                error("revision_id_conflict")
    completed = set()
    for start in entries:
        path, current_id = set(), start
        while current_id in entries and current_id not in completed:
            if current_id in path:
                error("invalid_revision_parent")
            path.add(current_id)
            parent = entries[current_id].parent_ref
            current_id = parent.id if parent and parent.kind == "offline_branch" else None
        completed.update(path)
    if head is None:
        head = NoteHead(owner_id=body.owner_id, local_id=body.local_id, version=0, identity_state="branch_only",
                        protection_state="legacy", crypto_epoch=0, history_generation=0)
        db.add(head)
    refs = []
    for entry in body.entries:
        if db.get(NoteOfflineBranch, entry.revision_id) is None:
            db.add(NoteOfflineBranch(id=entry.revision_id, owner_id=body.owner_id, local_id=body.local_id,
                                    parent_kind=entry.parent_ref.kind if entry.parent_ref else None,
                                    parent_id=entry.parent_ref.id if entry.parent_ref else None,
                                    origin_device_id=entry.snapshot.note.device_id,
                                    representation_epoch=head.crypto_epoch, representation_kind="snapshot_v1",
                                    snapshot_json=canonical(entry.snapshot.model_dump())))
            head.history_generation += 1
        refs.append({"kind": "offline_branch", "id": entry.revision_id})
    db.flush()
    return head, sorted(refs, key=lambda ref: ref["id"])


def mutate(db, body, operation):
    try:
        head, rows = scope(db, body.owner_id, body.local_id)
        check_epoch(head, body.crypto_epoch)
        require_active_user_device(db, owner_id=body.owner_id, device_id=body.device_id)
        previous = replay(db, body, operation, head)
        if previous is not None:
            db.commit()
            return previous
        refs = None
        if operation == "import":
            if rows:
                head = baseline(db, body.owner_id, body.local_id)
            head, refs = import_branches(db, body, head)
        else:
            validate_cas(db, body, head, rows)
            value = body.note if operation == "put" else NoteValue.model_validate(semantic(
                representation(get_ref(db, body.owner_id, body.local_id, body.target_ref), head)["note"]))
            head = adopt(db, body, value, head, rows, "write" if operation == "put" else "restore")
        result = {"status": "ok", "mutation_id": body.mutation_id, "result_revision_id": head.head_revision_id,
                  "result_head_version": head.version,
                  "result_inventory_revision_ids": sorted(item.revision_id for item in inventories(db, body.owner_id, body.local_id)),
                  "crypto_epoch": head.crypto_epoch, "history_generation": head.history_generation}
        if refs is not None:
            result["imported_refs"] = refs
        db.add(NoteMutation(owner_id=body.owner_id, mutation_id=body.mutation_id, local_id=body.local_id,
                            operation=operation, actor_device_id=body.device_id, crypto_epoch=body.crypto_epoch,
                            conditions_json=canonical(conditions(body, operation)), result_json=canonical(result)))
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
