"""Schema3 metadata contexts; legacy contexts are deliberately not extended."""
import base64
import json

from app.models.note_history import NoteHead
from app.services import note_crypto as prep, note_mixed_metadata as meta
from app.services.note_crypto_fence import error

KINDS = ("analysis_error", "analysis_input", "analysis_result", "inventory_snapshot", "note_body", "offline_snapshot",
         "recording_transcript", "reserved_offline_snapshot", "revision_before", "revision_snapshot")


def count(values, key="key"):
    result = {"total": len(values), "nonnull": sum(not v["is_null"] for v in values), "nulls": sum(v["is_null"] for v in values), "by_kind": []}
    for kind in KINDS:
        rows = [v for v in values if v[key]["kind"] == kind]
        result["by_kind"].append({"kind": kind, "total": len(rows), "nonnull": sum(not v["is_null"] for v in rows), "nulls": sum(v["is_null"] for v in rows)})
    return result


def context(db, owner, local, device, instance):
    prep.authenticate_actor(db, owner, device)
    if prep.initialize_identity(db.connection()) != instance:
        error("server_instance_changed")
    base = prep.base_state(db, owner, local)
    if base["crypto_epoch"] < 1:
        error("protected_representation_required")
    meta.validate(db, owner, local)
    head, note = db.get(NoteHead, (owner, local)), meta.selected(db, owner, local)
    b3 = {"base": base, "current_mode": head.current_mode, "selected_physical_note_id": note.id if note else None, "mixed_metadata_version": 1}
    items = descriptors(db, owner, local)
    return {"schema_version": 3, "status": "ok", "server_instance_id": instance, "context": b3,
        "catalog_digest": meta.h({"server_instance_id": instance, "owner_id": owner, "local_id": local, "context": b3, "entries": items}),
        "counts": count(items), "coverage": {"supported_kinds": list(KINDS), "scope_complete": True, "full_protection_complete": False}}


def descriptors(db, owner, local):
    import json
    from app.models.note_mixed import MixedSlot
    from app.models.note_crypto import NoteCryptoTransition
    from app.services import note_crypto_storage as store
    result = []
    for k, target, raw, kind, epoch in meta.slots(db, owner, local):
        side = db.get(MixedSlot, (owner, local, meta.canonical(k)))
        ref, parent = store.references(db, owner, local, k)
        physical = int(k["id"]) if k["kind"] in ("note_body", "inventory_snapshot") else getattr(target, "note_id", None)
        binding = None
        if raw is not None and kind.endswith("envelope_v1"):
            binding = json.loads(raw)["binding"]
        elif raw is None and epoch > 0 and kind.endswith("envelope_v1"):
            operation = db.get(NoteCryptoTransition, side.storage_operation_id)
            if operation.purpose in meta.NEW_PURPOSES:
                from app.services.note_mixed_operations import fixed
                binding = next(d["expected_binding"] for d in fixed(operation)["DSET"] if d["destination_key"] == k)
            elif operation.purpose in ("protected_analysis_write", "protected_transcript_write"):
                from app.services.related_writes import fixed
                binding = next(d["expected_binding"] for d in fixed(operation)["slots"] if d["key"] == k)
            else:
                binding = store.expected_binding(db, operation, k)
        result.append({"key": k, "representation_kind": kind, "representation_epoch": epoch, "is_null": raw is None,
            "representation_version": side.representation_version, "representation_etag": side.representation_etag,
            "storage_operation_id": side.storage_operation_id, "semantic_origin_id": side.semantic_origin_id,
            "origin_validator": side.origin_validator, "origin_row_required": side.origin_validator in ("native_v1", "native_mixed_v1"),
            "expected_binding": binding, "revision_ref": ref, "parent_ref": parent, "physical_note_id": physical,
            "inventory_revision_id": getattr(target, "revision_id", None), "linked_slot_version": getattr(target, "slot_version", None),
            "ciphertext_sha256": store.sha(raw.encode()) if raw is not None and epoch > 0 else None})
    return result


def encode(value):
    return base64.urlsafe_b64encode(meta.canonical(value).encode()).decode().rstrip("=")


def decode(value):
    from app.services.note_crypto_storage import strict_object
    return json.loads(base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True), object_pairs_hook=strict_object)


def checked(db, body):
    from app.schemas.note_mixed import MixedBase
    latest = context(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id)
    try:
        expected = MixedBase.model_validate(decode(body.expected_context)).model_dump()
    except (ValueError, TypeError, KeyError):
        error("invalid_context", 422)
    if latest["context"] != expected or latest["catalog_digest"] != body.catalog_digest:
        error("context_changed")
    return latest, descriptors(db, body.owner_id, body.local_id)


def catalog(db, body):
    c, items = checked(db, body)
    scope = meta.h({"server_instance_id": body.server_instance_id, "owner_id": body.owner_id, "local_id": body.local_id,
        "device_id": body.device_id, "context": c["context"], "catalog_digest": c["catalog_digest"]})
    start = 0
    if body.cursor:
        try:
            cursor = decode(body.cursor)
            if set(cursor) != {"schema_version", "scope_digest", "last_key"} or cursor["schema_version"] != 3 or cursor["scope_digest"] != scope:
                raise ValueError()
            start = next(i + 1 for i, d in enumerate(items) if d["key"] == cursor["last_key"])
        except (ValueError, TypeError, KeyError, StopIteration):
            error("invalid_cursor", 422)
    page = items[start:start + body.limit]
    cursor = encode({"schema_version": 3, "scope_digest": scope, "last_key": page[-1]["key"]}) if start + len(page) < len(items) else None
    return {"schema_version": 3, "context": c["context"], "catalog_digest": c["catalog_digest"], "counts": c["counts"],
            "coverage": c["coverage"], "entries": page, "next_cursor": cursor}


def item(db, body, *, raw=False):
    from app.schemas.note_crypto import RepresentationKey
    c, items = checked(db, body)
    try:
        key = RepresentationKey(kind=body.kind, id=body.representation_id, slot=body.slot).model_dump()
    except ValueError:
        error("invalid_representation_key", 422)
    d = next((d for d in items if d["key"] == key), None)
    if d is None:
        error("representation_not_found", 404)
    if d["representation_etag"] != body.representation_etag:
        error("source_changed")
    result = {"schema_version": 3, "context": c["context"], "catalog_digest": c["catalog_digest"], "descriptor": d}
    if raw:
        value = next(v for k, _, v, _, _ in meta.slots(db, body.owner_id, body.local_id) if k == key)
        result.update(framed(value, body.chunk_index))
    return result


def framed(value, index):
    if value is None:
        if index != 0:
            error("chunk_out_of_range", 416)
        return {"total_bytes": 0, "total_chunks": 0, "chunk_index": None, "data_base64": None}
    data = value.encode()
    count = max(1, (len(data) + 262143) // 262144)
    if index >= count:
        error("chunk_out_of_range", 416)
    return {"total_bytes": len(data), "total_chunks": count, "chunk_index": index,
            "data_base64": base64.b64encode(data[index * 262144:(index + 1) * 262144]).decode()}


def value(db, owner, local, descriptor):
    from app.services.note_operation_origin import read
    key = descriptor["key"]
    raw = next(v for k, _, v, _, _ in meta.slots(db, owner, local) if k == key)
    plain = descriptor["representation_kind"] == "snapshot_v1"
    return {"descriptor": descriptor, "snapshot": json.loads(raw) if plain and raw is not None else None,
        "envelope": json.loads(raw) if not plain and raw is not None else None,
        "operation_origin": read(db, owner, local, key, raw)}


def current(db, body):
    from app.services.note_history import encoded, raw_snapshot
    c, items = checked(db, body)
    if not c["context"]["base"]["current_exists"]:
        error("note_not_found", 404)
    if c["context"]["base"]["identity_state"] != "coherent":
        error("ambiguous_note_identity")
    note = meta.selected(db, body.owner_id, body.local_id)
    inv = next(d for d in items if d["key"] == meta.key("inventory_snapshot", note.id, "current"))
    nd = next(d for d in items if d["key"] == meta.key("note_body", note.id, "content"))
    return {"schema_version": 3, "status": "ok", "context": c["context"], "catalog_digest": c["catalog_digest"],
        "note": json.loads(encoded(raw_snapshot(note)))["note"], "current_representation": value(db, body.owner_id, body.local_id, inv),
        "note_body_metadata": nd, "head_revision_ref": {"kind": "note_revision", "id": c["context"]["base"]["head_revision_id"]}}


def revision(db, body):
    c, items = checked(db, body)
    branch = body.revision_kind == "offline_branch"
    key = meta.key("offline_snapshot" if branch else "revision_snapshot", body.revision_id, "snapshot" if branch else "after")
    d = next((d for d in items if d["key"] == key), None)
    if d is None:
        error("revision_not_found", 404)
    before = None if branch else next((d for d in items if d["key"] == meta.key("revision_before", body.revision_id, "before")), None)
    if not branch and before is None:
        error("inconsistent_history")
    return {"schema_version": 3, "status": "ok", "context": c["context"], "catalog_digest": c["catalog_digest"],
        "revision_ref": {"kind": body.revision_kind, "id": body.revision_id}, "parent_ref": d["parent_ref"],
        "representation": value(db, body.owner_id, body.local_id, d),
        "before_representation": value(db, body.owner_id, body.local_id, before) if before else None}
