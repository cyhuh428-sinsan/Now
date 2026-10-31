"""Positive cohorts and per-slot metadata; never infer a lost row at read time."""
import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.note import Note
from app.models.note_history import NoteHead, NoteInventory, NoteRevision
from app.models.note_v2 import NoteOfflineBranch
from app.models.note_crypto import NoteCryptoTransition, NoteCryptoUpload, NoteRepresentationOrigin
from app.models.note_mixed import MixedSchema, MixedScope, MixedSlot
from app.services.note_crypto_fence import error, database_now
from app.services.note_v2 import canonical

UPDATING = "mixed_updating"
NEW_PURPOSES = ("current_plain_transition", "mixed_conversion", "mixed_note_write", "mixed_offline_import", "mixed_analysis_write", "mixed_transcript_write")


def h(value):
    from app.services.note_crypto_storage import sha
    return sha(canonical(value).encode())


def stored_json(value):
    from app.services.note_crypto_storage import strict_object
    try:
        return json.loads(value, object_pairs_hook=strict_object)
    except (ValueError, TypeError):
        error("inconsistent_history")


def key(kind, ident, slot):
    return {"kind": kind, "id": str(ident), "slot": slot}


def slots(db, owner, local):
    from app.services.related_text import linked_rows, SLOTS
    from app.models.note_related import LinkedText
    found = []
    for row in db.scalars(select(Note).where(Note.owner_id == owner, Note.local_id == local)):
        inv = db.get(NoteInventory, (owner, local, row.id))
        if inv is None:
            error("inconsistent_history")
        kind = "plain_text_v1" if inv.representation_kind == "snapshot_v1" else "content_encrypted_v1"
        found.append((key("note_body", row.id, "content"), row, row.content, kind, inv.representation_epoch))
    for row in db.scalars(select(NoteRevision).where(NoteRevision.owner_id == owner, NoteRevision.local_id == local)):
        found.append((key("revision_snapshot", row.id, "after"), row, row.snapshot_json, row.representation_kind, row.representation_epoch))
        side = db.get(MixedSlot, (owner, local, canonical(key("revision_before", row.id, "before"))))
        found.append((key("revision_before", row.id, "before"), row, row.before_snapshot_json,
                      side.representation_kind if side else row.representation_kind,
                      side.representation_epoch if side else row.representation_epoch))
    for row in db.scalars(select(NoteInventory).where(NoteInventory.owner_id == owner, NoteInventory.local_id == local)):
        found.append((key("inventory_snapshot", row.note_id, "current"), row, row.snapshot_json, row.representation_kind, row.representation_epoch))
    for row in db.scalars(select(NoteOfflineBranch).where(NoteOfflineBranch.owner_id == owner, NoteOfflineBranch.local_id == local)):
        found.append((key("offline_snapshot", row.id, "snapshot"), row, row.snapshot_json, row.representation_kind, row.representation_epoch))
    for row in linked_rows(db, owner, local):
        for kind, (model, field) in SLOTS.items():
            if not isinstance(row, model):
                continue
            k = key(kind, row.id, field)
            meta = db.get(LinkedText, (owner, local, canonical(k)))
            if meta is None or meta.is_null != (getattr(row, field) is None):
                error("inconsistent_related_text")
            found.append((k, meta, getattr(row, field), meta.representation_kind, meta.representation_epoch))
    return sorted(found, key=lambda item: tuple(item[0][f].encode() for f in ("kind", "id", "slot")))


def lineage(db, owner, local):
    scope = db.get(MixedScope, (owner, local))
    if scope is None:
        return False
    for side in db.scalars(select(MixedSlot).where(MixedSlot.owner_id == owner, MixedSlot.local_id == local)):
        for ident in (side.storage_operation_id, side.semantic_origin_id):
            if ident is None:
                continue
            op = db.get(NoteCryptoTransition, ident)
            if op is None or (op.owner_id, op.local_id) != (owner, local) or op.state != "committed":
                error("inconsistent_history")
            if op.purpose in NEW_PURPOSES:
                return True
    return False


def require_old_wire(db, owner, local):
    if lineage(db, owner, local):
        from fastapi import HTTPException
        raise HTTPException(409, detail={"code": "mixed_representation_requires_upgrade", "required_schema_version": 3}, headers={"Cache-Control": "no-store"})


def selected(db, owner, local):
    from app.services.note_sync import _note_sort_key
    rows = list(db.scalars(select(Note).where(Note.owner_id == owner, Note.local_id == local)))
    return max(rows, key=_note_sort_key) if rows else None


def mode(db, owner, local):
    note = selected(db, owner, local)
    if note is None:
        return "absent"
    inv = db.get(NoteInventory, (owner, local, note.id))
    if inv is None:
        error("inconsistent_history")
    return "plain" if inv.representation_kind == "snapshot_v1" else "protected"


def begin_update(db, owner, local):
    from app.services.wiki_guards import require_review
    require_review(db, [(owner, local)])
    if (owner, local) not in db.info.get(UPDATING, set()):
        head = db.get(NoteHead, (owner, local))
        if head is not None and head.crypto_epoch > 0:
            validate(db, owner, local)
        db.info.setdefault(UPDATING, set()).add((owner, local))


def homogeneous(db, owner, local):
    from app.services import note_crypto_storage as store, note_operation_origin as origin
    verified = {canonical(k["key"]): k for k, raw in store.live_entries(db, owner, local)}
    values = []
    for k, row, raw, kind, epoch in slots(db, owner, local):
        public = verified.get(canonical(k))
        if public is None or public["is_null"] != (raw is None):
            error("inconsistent_history")
        kind, epoch = public["representation_kind"], public["representation_epoch"]
        if k["kind"] == "note_body":
            inv = db.get(NoteInventory, (owner, local, int(k["id"])))
            ident = json.loads(inv.snapshot_json)["binding"]["transition_id"]
            validator, semantic = "body_v1", None
        elif kind == "linked_text_envelope_v1":
            ident, validator, semantic = row.storage_operation_id, "linked_v1", None
        else:
            op = origin.storage_row(db, owner, local, k, raw)
            ident = op.id
            validator = "a2a_pre_origin_v0" if json.loads(op.conditions_json).get("origin_metadata_legacy") == origin.LEGACY else "native_v1"
            semantic = origin.semantic_id(db, owner, local, k, raw)
        values.append((k, raw, kind, epoch, ident, semantic, validator))
    return values


def install_homogeneous(db, owner, local, *, initial=False):
    # Origin rows installed by the enclosing writer must exist before validation.
    db.flush()
    head = db.get(NoteHead, (owner, local))
    if head is None or head.crypto_epoch <= 0:
        return
    scope = db.get(MixedScope, (owner, local))
    if scope is not None and lineage(db, owner, local):
        error("mixed_representation_requires_upgrade")
    values = homogeneous(db, owner, local)
    if not values:
        error("inconsistent_history")
    new = scope is None
    if new:
        scope = MixedScope(owner_id=owner, local_id=local, metadata_version=1, cohort_id=str(uuid4()),
            initial_slots_json="[]", initial_slots_digest=h([]), classified_at=database_now(db))
        db.add(scope)
        db.flush()
    existing = {s.key_json: s for s in db.scalars(select(MixedSlot).where(MixedSlot.owner_id == owner, MixedSlot.local_id == local))}
    expected = set()
    for k, raw, kind, epoch, storage, semantic, validator in values:
        kj = canonical(k); expected.add(kj)
        row = existing.get(kj)
        state = (kind, epoch, raw is None, storage, semantic, validator)
        old = None if row is None else (row.representation_kind, row.representation_epoch, row.is_null,
            row.storage_operation_id, row.semantic_origin_id, row.origin_validator)
        if row is None:
            row = MixedSlot(owner_id=owner, local_id=local, key_json=kj, cohort_id=scope.cohort_id,
                            representation_version=1, representation_etag=str(uuid4()))
            db.add(row)
        elif state != old:
            row.representation_version += 1; row.representation_etag = str(uuid4())
        (row.representation_kind, row.representation_epoch, row.is_null, row.storage_operation_id,
         row.semantic_origin_id, row.origin_validator) = state
    if set(existing) - expected:
        error("inconsistent_history")
    head.current_mode = mode(db, owner, local)
    db.flush()
    if new:
        initial_slots = [stored(s) for s in db.scalars(select(MixedSlot).where(MixedSlot.owner_id == owner, MixedSlot.local_id == local).order_by(MixedSlot.key_json))]
        scope.initial_slots_json, scope.initial_slots_digest = canonical(initial_slots), h(initial_slots)
    if not initial:
        db.info.get(UPDATING, set()).discard((owner, local))


def stored(side):
    return {f: getattr(side, f) for f in ("key_json", "representation_kind", "representation_epoch", "is_null",
        "representation_version", "representation_etag", "storage_operation_id", "semantic_origin_id", "origin_validator", "cohort_id")}


def validate(db, owner, local):
    if (owner, local) in db.info.get(UPDATING, set()):
        return
    marker = db.get(MixedSchema, 1)
    if marker is None or marker.version != 1 or h(stored_json(marker.initial_scopes_json)) != marker.initial_scopes_digest:
        error("inconsistent_history")
    scope, head = db.get(MixedScope, (owner, local)), db.get(NoteHead, (owner, local))
    if scope is None or head is None or scope.metadata_version != 1 or h(stored_json(scope.initial_slots_json)) != scope.initial_slots_digest:
        error("inconsistent_history")
    rows = {s.key_json: s for s in db.scalars(select(MixedSlot).where(MixedSlot.owner_id == owner, MixedSlot.local_id == local))}
    live = slots(db, owner, local)
    if not live or set(rows) != {canonical(v[0]) for v in live} or head.current_mode != mode(db, owner, local):
        error("inconsistent_history")
    for k, target, raw, kind, epoch in live:
        side = rows[canonical(k)]
        if (side.cohort_id != scope.cohort_id or side.representation_kind != kind or side.representation_epoch != epoch
            or side.is_null != (raw is None) or side.representation_version < 1):
            error("inconsistent_history")
        from fastapi import HTTPException
        try:
            verify_slot(db, owner, local, k, raw, side)
        except HTTPException as exc:
            if exc.status_code == 422:
                error("unsupported_representation")
            raise
        except (ValueError, TypeError, KeyError, AttributeError):
            error("inconsistent_history")


def verify_slot(db, owner, local, k, raw, side):
    from app.services import note_crypto_storage as store, note_operation_origin as origin
    op = db.get(NoteCryptoTransition, side.storage_operation_id) if side.storage_operation_id else None
    if op is None or (op.owner_id, op.local_id) != (owner, local) or op.state != "committed" or op.receipt_json is None:
        error("inconsistent_history")
    if op.purpose in NEW_PURPOSES:
        from app.services.note_mixed_operations import verify_live
        verify_live(db, op, k, raw, side)
        return
    if side.origin_validator == "body_v1":
        if side.semantic_origin_id is not None:
            error("inconsistent_history")
        upload = db.get(NoteCryptoUpload, (op.id, canonical(k)))
        if upload is None or upload.ciphertext_sha256 != store.sha(raw.encode()):
            error("inconsistent_history")
        store.validate_output(raw.encode(), side.representation_kind, side.representation_epoch, None)
        inventory = db.get(MixedSlot, (owner, local, canonical(key("inventory_snapshot", k["id"], "current"))))
        if inventory is None or (inventory.storage_operation_id, inventory.representation_epoch) != (side.storage_operation_id, side.representation_epoch):
            error("inconsistent_history")
    elif side.origin_validator == "linked_v1":
        from app.services.related_conversion import descriptor
        from app.services.related_text import linked_rows, SLOTS
        from app.models.note_related import LinkedText
        target = next((r for r in linked_rows(db, owner, local) if isinstance(r, SLOTS[k["kind"]][0]) and str(r.id) == k["id"]), None)
        if target is None:
            error("inconsistent_related_text")
        descriptor(db, owner, local, k, target, db.get(LinkedText, (owner, local, canonical(k))), raw)
    elif side.origin_validator in ("native_v1", "a2a_pre_origin_v0"):
        if origin.storage_row(db, owner, local, k, raw).id != op.id or origin.semantic_id(db, owner, local, k, raw) != side.semantic_origin_id:
            error("inconsistent_history")
        if raw is not None:
            wrapper = json.loads(raw)
            store.validate_output(raw.encode(), side.representation_kind, side.representation_epoch, wrapper["binding"])
            upload = db.get(NoteCryptoUpload, (op.id, canonical(k)))
            if upload is None and k["kind"] == "offline_snapshot":
                upload = db.get(NoteCryptoUpload, (op.id, canonical({**k, "kind": "reserved_offline_snapshot"})))
            if upload is None or upload.ciphertext_sha256 != store.sha(raw.encode()):
                error("inconsistent_history")
    else:
        error("inconsistent_history")


def initialize(connection):
    with Session(bind=connection, autoflush=False) as db:
        marker = db.get(MixedSchema, 1)
        heads = list(db.scalars(select(NoteHead).where(NoteHead.crypto_epoch > 0)))
        if marker is None:
            if (db.scalar(select(MixedScope.cohort_id).limit(1)) is not None or db.scalar(select(MixedSlot.key_json).limit(1)) is not None
                or any(head.current_mode is not None for head in heads)):
                error("inconsistent_history")
            initial = []
            for head in heads:
                from app.services.note_crypto import base_state
                base_state(db, head.owner_id, head.local_id, baseline=False)
                install_homogeneous(db, head.owner_id, head.local_id, initial=True)
                scope = db.get(MixedScope, (head.owner_id, head.local_id))
                initial.append({"owner_id": head.owner_id, "local_id": head.local_id, "cohort_id": scope.cohort_id})
            initial.sort(key=lambda x: (x["owner_id"].encode(), x["local_id"].encode()))
            db.add(MixedSchema(id=1, version=1, initial_scopes_json=canonical(initial), initial_scopes_digest=h(initial), initialized_at=database_now(db)))
            db.flush()
            for head in heads:
                validate(db, head.owner_id, head.local_id)
        else:
            initial = stored_json(marker.initial_scopes_json)
            if marker.version != 1 or h(initial) != marker.initial_scopes_digest:
                error("inconsistent_history")
            for item in initial:
                scope = db.get(MixedScope, (item["owner_id"], item["local_id"]))
                if scope is None or scope.cohort_id != item["cohort_id"]:
                    error("inconsistent_history")
            scopes = {(s.owner_id, s.local_id) for s in db.scalars(select(MixedScope))}
            if scopes != {(head.owner_id, head.local_id) for head in heads}:
                error("inconsistent_history")
            for head in heads:
                validate(db, head.owner_id, head.local_id)
        db.commit()
