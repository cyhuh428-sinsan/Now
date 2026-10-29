"""Schema3 semantic-write controls, independent of the legacy wire."""
from sqlalchemy import select

from app.models.note import Note
from app.services import note_crypto as prep, note_mixed_read as read
from app.services.note_crypto_fence import error, require_unfenced
from app.services.note_protected_write import date
import json
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4
from sqlalchemy import func
from app.services import note_mixed_metadata as meta, note_mixed_operations as ops
from app.services.note_crypto_fence import database_now, expire
from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence

PURPOSE = "mixed_note_write"
SECTIONS = ("S", "DSET", "P", "O", "existing", "verified_existing")
CONTROL = ("operation", "selection", "target_current_mode", "replica_policy", "structure", "parent_context", "restore_source")


def fixed(row):
    from app.schemas.note_mixed import WriteQuote
    try:
        c = json.loads(row.conditions_json)
        m, request = c["M0"], c["request"]
        parsed = WriteQuote.model_validate(request).model_dump()
        if (type(m.get("schema_version")) is not int or m["schema_version"] != 3
            or any(parsed[field] != m[field] for field in ("owner_id", "local_id", "mutation_id", "server_instance_id"))
            or parsed["device_id"] != row.actor_device_id or m["actor_device_id"] != row.actor_device_id):
            error("inconsistent_history")
        if (parsed != request or m["control"] != {k: parsed[k] for k in CONTROL}
            or m["base"] != parsed["base"] or m["source_catalog_digest"] != parsed["expected_catalog_digest"]
            or m["operation_id"] != row.id or m["purpose"] != PURPOSE or m["mutation_id"] != row.mutation_id
            or m["owner_id"] != row.owner_id or m["local_id"] != row.local_id or meta.h(m) != row.manifest_digest):
            error("inconsistent_history")
        if (m["actor_device_id"] != parsed["device_id"] or m["server_instance_id"] != parsed["server_instance_id"]
            or m["target_epoch"] != m["base"]["base"]["crypto_epoch"] or m["existing"] != [] or m["verified_existing"] != []
            or m["server_fields"]["owner_id"] != row.owner_id or m["server_fields"]["local_id"] != row.local_id):
            error("inconsistent_history")
        source = [s["descriptor"] for s in m["S"]]
        if meta.h({"server_instance_id": m["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id,
            "context": m["base"], "entries": source}) != m["source_catalog_digest"]:
            error("inconsistent_history")
        selection = m["control"]["selection"]
        physical = m["server_fields"]["id"]
        originals = [s["fields"] for s in c["source_row_signatures"] if s["table"] == "notes"]
        selected = next((s for s in originals if s["id"] == physical), None)
        stamp = date(row.created_at)
        expected_server = {"id": physical, "owner_id": row.owner_id, "local_id": row.local_id,
            "device_id": selected["device_id"] if selection is not None and selected else row.actor_device_id,
            "created_at": selected["created_at"] if selection is not None and selected else stamp,
            "updated_at": stamp, "client_updated_at": max([stamp] + [s["client_updated_at"] or s["updated_at"] for s in originals])}
        if selection is not None and selected is None or m["server_fields"] != expected_server:
            error("inconsistent_history")
        pair = [meta.key("note_body", physical, "content"), meta.key("inventory_snapshot", physical, "current")]
        if selection is not None and selection["physical_note_id"] != physical:
            error("inconsistent_history")
        if m["P"] != [d for d in source if selection is None or d["key"] not in pair]:
            error("inconsistent_history")
        expected_keys = pair + [meta.key("revision_snapshot", m["revision_ref"]["id"], "after"),
            meta.key("revision_before", m["revision_ref"]["id"], "before")]
        if len(m["DSET"]) != 4 or {meta.canonical(d["destination_key"]) for d in m["DSET"]} != {meta.canonical(k) for k in expected_keys}:
            error("inconsistent_history")
        expected_o = []
        inventory = next((d for d in source if selection and d["key"] == pair[1]), None)
        from app.services.note_crypto_storage import key_order
        for d in m["DSET"]:
            k = d["destination_key"]
            before, isbody = k["kind"] == "revision_before", k["kind"] == "note_body"
            plain = m["control"]["target_current_mode"] == "plain"
            epoch = inventory["representation_epoch"] if before and inventory else 0 if plain else m["target_epoch"]
            kind = inventory["representation_kind"] if before and inventory else "plain_text_v1" if isbody and plain else "content_encrypted_v1" if isbody else "snapshot_v1" if plain else "history_envelope_v1"
            expected_binding = ops.binding(row.owner_id, row.local_id, m["server_instance_id"], row.id, epoch, k,
                m["revision_ref"], m["parent_ref"]) if epoch > 0 and not isbody and not (before and inventory is None) else None
            if (d["output_epoch"], d["output_kind"], d["is_null"], d["source_keys"], d["expected_binding"]) != (
                epoch, kind, before and inventory is None, [inventory["key"]] if before and inventory else [], expected_binding):
                error("inconsistent_history")
            expected_o.append({"destination_key": k, "is_null": before and inventory is None,
                "origin_validator": "body_mixed_v1" if isbody else "native_mixed_v1", "origin_row_required": not isbody,
                "storage_operation_id": row.id, "semantic_origin_id": None if isbody or before and inventory is None else inventory["semantic_origin_id"] if before else row.id})
        expected_o += [{"destination_key": d["key"], **{f: d[f] for f in ("is_null", "origin_validator", "origin_row_required", "storage_operation_id", "semantic_origin_id")}} for d in m["P"]]
        if m["O"] != sorted(expected_o, key=lambda d: key_order(d["destination_key"])):
            error("inconsistent_history")
        restore = parsed["restore_source"]
        if m["operation_origin"] != {"purpose": PURPOSE, "operation_id": row.id, "mutation_id": row.mutation_id,
            "operation": parsed["operation"], "restore_source_ref": restore["revision_ref"] if restore else None,
            "restore_source_descriptor": restore["descriptor"] if restore else None}:
            error("inconsistent_history")
        expected_parent = {"kind": "note_revision", "id": m["base"]["base"]["head_revision_id"]} if m["base"]["base"]["head_revision_id"] else None
        if m["parent_ref"] != expected_parent:
            error("inconsistent_history")
        return m
    except (ValueError, KeyError, TypeError):
        error("inconsistent_history")


def result(db, row):
    m = fixed(row)
    c = read.context(db, row.owner_id, row.local_id, row.actor_device_id, m["server_instance_id"])
    counts = {s: read.count([e["descriptor"] for e in m[s]] if s == "S" else m[s],
        "destination_key" if s in ("DSET", "O") else "key") for s in SECTIONS}
    return {"schema_version": 3, "purpose": PURPOSE, "operation_id": row.id, "mutation_id": row.mutation_id,
        "state": "uploading" if row.state in ("staging", "ready") else row.state, "lease_version": row.lease_version, "expires_at": date(row.expires_at),
        "metadata_manifest_digest": row.manifest_digest, "metadata_header": {k: v for k, v in m.items() if k not in SECTIONS},
        "counts": counts, "receipt": json.loads(row.receipt_json) if row.receipt_json else None, "latest_context": c["context"]}


def check_parent(db, request):
    from app.schemas.note_protected_write import Structure, ParentBase
    structure = request.structure
    from app.schemas.note import NoteIn
    from app.services.note_sync import validate_note
    value = NoteIn(owner_id=request.owner_id, local_id=request.local_id, device_id=request.device_id,
        title="", content="", **structure.model_dump())
    validate_note(value)
    if structure.parent_local_id is None:
        if request.parent_context is not None:
            error("invalid_note_parent", 422)
        return
    p = request.parent_context
    if p is None or structure.parent_local_id == request.local_id:
        error("invalid_note_parent", 422)
    current = parent_context(db, SimpleNamespace(owner_id=request.owner_id, local_id=request.local_id,
        device_id=request.device_id, server_instance_id=request.server_instance_id,
        parent_local_id=structure.parent_local_id, child_level=structure.level,
        child_deleted=structure.deleted_at is not None))["parent_context"]
    if p.kind == "legacy":
        ParentBase.model_validate(p.parent_base)
    if p.model_dump() != current:
        error("parent_changed")


@ops.atomic
def prepare(db, body):
    prep.authenticate_actor(db, body.owner_id, body.device_id)
    if prep.initialize_identity(db.connection()) != body.server_instance_id:
        error("server_instance_changed")
    ops.gate()
    old = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id,
        NoteCryptoTransition.mutation_id == body.mutation_id))
    if old is not None:
        if old.purpose != PURPOSE or json.loads(old.conditions_json)["request"] != body.model_dump() or old.actor_device_id != body.device_id:
            error("idempotency_mismatch")
        expire(db, old)
        return {"created": False, **result(db, old)}
    require_unfenced(db, [(body.owner_id, body.local_id)])
    from app.services.related_text import active_drain
    if active_drain(db, body.owner_id, body.local_id) is not None:
        error("related_drain_in_progress", 423)
    c = read.context(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id)
    if c["context"] != body.base.model_dump() or c["catalog_digest"] != body.expected_catalog_digest:
        error("context_changed")
    if c["context"]["base"]["identity_state"] == "ambiguous":
        error("ambiguous_note_identity")
    check_parent(db, body)
    note = meta.selected(db, body.owner_id, body.local_id)
    if (body.operation in ("put", "delete") and note is None or body.operation == "create" and note is not None
        or note is not None and body.target_current_mode != c["context"]["current_mode"]):
        error("wrong_operation_state")
    if (body.operation == "restore") != (body.restore_source is not None):
        error("invalid_restore_target", 422)
    sources = read.descriptors(db, body.owner_id, body.local_id)
    pair = [] if note is None else [meta.key("note_body", note.id, "content"), meta.key("inventory_snapshot", note.id, "current")]
    inventory = next((d for d in sources if pair and d["key"] == pair[1]), None)
    if note:
        nd = next(d for d in sources if d["key"] == pair[0])
        expected = {"physical_note_id": note.id, "inventory_revision_ref": inventory["revision_ref"],
            "note_representation_etag": nd["representation_etag"], "inventory_representation_etag": inventory["representation_etag"]}
        if body.selection is None or body.selection.model_dump() != expected:
            error("source_changed")
    elif body.selection is not None:
        error("source_changed")
    if body.restore_source is not None:
        target = body.restore_source.descriptor.model_dump()
        ref = body.restore_source.revision_ref
        expected_key = meta.key("revision_snapshot" if ref.kind == "note_revision" else "offline_snapshot",
            ref.id, "after" if ref.kind == "note_revision" else "snapshot")
        if target.get("key") != expected_key or target.get("revision_ref") != ref.model_dump() or target.get("is_null"):
            error("invalid_restore_target", 422)
        if target not in sources:
            error("source_changed")
    stamp = database_now(db)
    if note:
        physical, device, created = note.id, note.device_id, note.created_at
    else:
        physical = db.scalar(select(func.nextval(func.pg_get_serial_sequence("notes", "id")))) if db.bind.dialect.name == "postgresql" else (db.scalar(select(func.max(Note.id))) or 0) + 1
        device, created = body.device_id, stamp
    from app.services.note_sync import _note_sort_key
    rows = list(db.scalars(select(Note).where(Note.owner_id == body.owner_id, Note.local_id == body.local_id)))
    server = {"id": physical, "owner_id": body.owner_id, "local_id": body.local_id, "device_id": device,
        "created_at": date(created), "updated_at": date(stamp), "client_updated_at": date(max([stamp] + [_note_sort_key(n)[0] for n in rows]))}
    ident, ref = str(uuid4()), {"kind": "note_revision", "id": str(uuid4())}
    parent = {"kind": "note_revision", "id": c["context"]["base"]["head_revision_id"]} if c["context"]["base"]["head_revision_id"] else None
    origin = {"purpose": PURPOSE, "operation_id": ident, "mutation_id": body.mutation_id, "operation": body.operation,
        "restore_source_ref": body.restore_source.revision_ref.model_dump() if body.restore_source else None,
        "restore_source_descriptor": body.restore_source.descriptor.model_dump() if body.restore_source else None}
    m = {"schema_version": 3, "purpose": PURPOSE, "operation_id": ident, "server_instance_id": body.server_instance_id,
        "owner_id": body.owner_id, "local_id": body.local_id, "actor_device_id": body.device_id, "mutation_id": body.mutation_id,
        "base": c["context"], "source_catalog_digest": c["catalog_digest"], "target_epoch": c["context"]["base"]["crypto_epoch"],
        "revision_ref": ref, "parent_ref": parent, "server_fields": server, "operation_origin": origin,
        "control": {k: body.model_dump()[k] for k in CONTROL}, "S": [{"descriptor": d, "source_etag": str(uuid4())} for d in sources],
        "DSET": [], "P": [d for d in sources if d["key"] not in pair], "O": [], "existing": [], "verified_existing": []}
    plain = body.target_current_mode == "plain"
    for key in (meta.key("note_body", physical, "content"), meta.key("inventory_snapshot", physical, "current"), meta.key("revision_snapshot", ref["id"], "after"), meta.key("revision_before", ref["id"], "before")):
        before, isbody = key["kind"] == "revision_before", key["kind"] == "note_body"
        epoch = inventory["representation_epoch"] if before and inventory else 0 if plain else m["target_epoch"]
        kind = inventory["representation_kind"] if before and inventory else "plain_text_v1" if isbody and plain else "content_encrypted_v1" if isbody else "snapshot_v1" if plain else "history_envelope_v1"
        binding = ops.binding(body.owner_id, body.local_id, body.server_instance_id, ident, epoch, key, ref, parent) if epoch > 0 and not isbody and not (before and inventory is None) else None
        m["DSET"].append(ops.output(key, [inventory["key"]] if before and inventory else [], kind, epoch, before and inventory is None, binding))
        m["O"].append({"destination_key": key, "is_null": before and inventory is None,
            "origin_validator": "body_mixed_v1" if isbody else "native_mixed_v1", "origin_row_required": not isbody,
            "storage_operation_id": ident, "semantic_origin_id": None if isbody or before and inventory is None else inventory["semantic_origin_id"] if before else ident})
    m["O"] += [{"destination_key": d["key"], **{f: d[f] for f in ("is_null", "origin_validator", "origin_row_required", "storage_operation_id", "semantic_origin_id")}} for d in m["P"]]
    from app.services.note_crypto_storage import key_order
    for section in ("DSET", "O"):
        m[section].sort(key=lambda d: key_order(d["destination_key"]))
    row = NoteCryptoTransition(id=ident, owner_id=body.owner_id, local_id=body.local_id, actor_device_id=body.device_id,
        mutation_id=body.mutation_id, purpose=PURPOSE, conditions_json=meta.canonical({"request": body.model_dump(), "M0": m,
            "source_row_signatures": ops.row_signatures(db, body.owner_id, body.local_id)}), manifest_digest=meta.h(m),
        state="prepared", lease_version=1, created_at=stamp, expires_at=stamp + timedelta(minutes=30))
    db.add(row); db.flush()
    for d in m["DSET"]:
        if d["output_epoch"] > 0 and not d["is_null"]:
            db.add(NoteCryptoEntry(transition_id=ident, key_json=meta.canonical(d["destination_key"]), source_etag=d["source_etag"],
                source_kind="client_pending", output_kind=d["output_kind"], representation_epoch=d["output_epoch"],
                binding_json=meta.canonical(d["expected_binding"]) if d["expected_binding"] else None))
    db.add(NoteCryptoFence(owner_id=body.owner_id, local_id=body.local_id, transition_id=ident)); db.flush()
    return {"created": True, **result(db, row)}


@ops.atomic
def parent_lookup(db, body):
    return parent_context(db, body, initialize_legacy=True)


def parent_context(db, body, *, initialize_legacy=False):
    prep.authenticate_actor(db, body.owner_id, body.device_id)
    if prep.initialize_identity(db.connection()) != body.server_instance_id:
        error("server_instance_changed")
    require_unfenced(db, [(body.owner_id, body.parent_local_id)])
    if initialize_legacy:
        from app.models.note_history import NoteHead
        from app.models.note_mixed import MixedScope, MixedSlot
        if db.get(NoteHead, (body.owner_id, body.parent_local_id)) is None and (
            db.get(MixedScope, (body.owner_id, body.parent_local_id)) is not None or db.scalar(select(MixedSlot.key_json).where(
                MixedSlot.owner_id == body.owner_id, MixedSlot.local_id == body.parent_local_id).limit(1)) is not None):
            error("inconsistent_history")
    state = prep.base_state(db, body.owner_id, body.parent_local_id, baseline=initialize_legacy)
    if state["identity_state"] != "coherent":
        error("parent_changed")
    if state["crypto_epoch"] > 0:
        c = read.context(db, body.owner_id, body.parent_local_id, body.device_id, body.server_instance_id)
        parent = db.get(Note, c["context"]["selected_physical_note_id"])
        if parent is None or parent.note_type != "tree" or parent.level != body.child_level - 1 or (
            not body.child_deleted and parent.deleted_at is not None):
            error("parent_changed")
        result = {"kind": "mixed", "local_id": body.parent_local_id,
            "context": c["context"], "catalog_digest": c["catalog_digest"]}
    else:
        rows = select(Note).where(Note.owner_id == body.owner_id, Note.local_id == body.parent_local_id, Note.note_type == "tree")
        if not body.child_deleted:
            rows = rows.where(Note.deleted_at.is_(None))
        parent = db.scalar(rows.order_by(Note.updated_at.desc(), Note.id.desc()))
        if parent is None or parent.level != body.child_level - 1:
            error("parent_changed")
        base = {k: state[k] for k in ("head_version", "head_revision_id", "crypto_epoch",
            "history_generation", "inventory_revision_ids")}
        base.update(local_id=body.parent_local_id, physical_note_id=parent.id)
        signature = {k: getattr(parent, k) for k in ("note_type", "parent_local_id", "level", "device_id")}
        signature.update(physical_note_id=parent.id)
        signature.update({k: date(getattr(parent, k)) if getattr(parent, k) is not None else None
            for k in ("deleted_at", "created_at", "updated_at", "client_updated_at")})
        result = {"kind": "legacy", "parent_base": base, "structure_signature": signature}
    return {"schema_version": 3, "parent_context": result}


def replay(db, row, body):
    from app.models.note_history import NoteRevision
    core = body.model_dump(exclude={"plain_after", "plain_before", "projection"})
    if json.loads(row.commit_conditions_json) != core:
        error("idempotency_mismatch")
    m = fixed(row)
    saved = db.get(NoteRevision, m["revision_ref"]["id"])
    if saved is None:
        error("inconsistent_history")
    from app.models.note_mixed import MixedSlot
    for name, raw, kind in (("plain_after", saved.snapshot_json, saved.representation_kind),
        ("plain_before", saved.before_snapshot_json, db.get(MixedSlot, (row.owner_id, row.local_id,
            meta.canonical(meta.key("revision_before", saved.id, "before")))).representation_kind)):
        value = getattr(body, name)
        original = next(d for d in m["DSET"] if d["destination_key"]["kind"] == (
            "revision_snapshot" if name == "plain_after" else "revision_before"))
        required_plain = original["output_epoch"] == 0 and not original["is_null"]
        if (value is not None) != required_plain:
            error("idempotency_mismatch")
        if value is not None:
            if kind != "snapshot_v1":
                error("replay_payload_requires_status")
            if raw is None or json.loads(raw)["note"] != value.model_dump():
                error("idempotency_mismatch")
    if saved.representation_kind == "snapshot_v1":
        final = json.loads(saved.snapshot_json)["note"]
    else:
        from app.models.note_history import NoteHead
        head = db.get(NoteHead, (row.owner_id, row.local_id))
        if head.head_revision_id != saved.id:
            error("replay_payload_requires_status")
        note = db.get(Note, saved.note_id)
        final = {k: date(getattr(note, k)) if k == "deleted_at" and getattr(note, k) is not None else getattr(note, k)
            for k in body.projection.model_dump()}
    if any(final[k] != v for k, v in body.projection.model_dump().items()):
        error("idempotency_mismatch")
    return result(db, row)


@ops.atomic
def commit(db, body):
    from sqlalchemy import delete
    from sqlalchemy.exc import IntegrityError
    from app.models.note_history import NoteHead, NoteInventory, NoteRevision
    from app.models.note_crypto import NoteCryptoUpload
    from app.services import note_crypto_storage as store
    from app.services.note_protected_write import parsed
    from app.schemas.note_protected_write import Projection
    ops.gate()
    row = ops.own(db, body, PURPOSE)
    if row.state == "committed":
        return replay(db, row, body)
    row, m = ops.active(db, body, PURPOSE)
    if body.mutation_id != row.mutation_id or body.lease_version != row.lease_version or body.base.model_dump() != m["base"]:
        error("version_conflict")
    projection = body.projection.model_dump()
    from app.schemas.note_mixed import WriteQuote
    request = WriteQuote.model_validate(json.loads(row.conditions_json)["request"])
    if any(projection[k] != m["control"]["structure"][k] for k in ("note_type", "parent_local_id", "level", "deleted_at")):
        error("projection_mismatch")
    values, records = {}, []
    required = [d for d in m["DSET"] if d["output_epoch"] > 0 and not d["is_null"]]
    if {e.key_json for e in db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id))} != {meta.canonical(d["destination_key"]) for d in required}:
        error("manifest_changed")
    for d in required:
        k = d["destination_key"]
        u = db.get(NoteCryptoUpload, (row.id, meta.canonical(k)))
        if u is None or u.ciphertext_sha256 is None:
            error("incomplete_manifest")
        raw = store.assembled(db, u)
        if store.sha(raw) != u.ciphertext_sha256:
            error("stage_mismatch")
        store.validate_output(raw, d["output_kind"], d["output_epoch"], d["expected_binding"])
        values[meta.canonical(k)] = raw.decode()
        records.append({"entry_key": k, "destination_key": k, "source_etag": d["source_etag"], "output_kind": d["output_kind"],
            "target_epoch": d["output_epoch"], "total_bytes": len(raw), "ciphertext_sha256": store.sha(raw)})
    if meta.h(records) != body.client_verified_ciphertext_manifest_digest:
        error("verification_manifest_mismatch")
    after_key = meta.key("revision_snapshot", m["revision_ref"]["id"], "after")
    before_key = meta.key("revision_before", m["revision_ref"]["id"], "before")
    by_key = {meta.canonical(d["destination_key"]): d for d in m["DSET"]}
    after_d, before_d = by_key[meta.canonical(after_key)], by_key[meta.canonical(before_key)]
    after = body.plain_after.model_dump() if body.plain_after is not None else None
    before = body.plain_before.model_dump() if body.plain_before is not None else None
    if (after is not None) != (after_d["output_epoch"] == 0) or (before is not None) != (before_d["output_epoch"] == 0 and not before_d["is_null"]):
        error("invalid_plain_payload", 422)
    if after is not None:
        if any(after[k] != v for k, v in {**m["server_fields"], **projection}.items()):
            error("projection_mismatch")
        encoded = meta.canonical({"schema_version": 1, "note": after})
        for d in m["DSET"]:
            if d["destination_key"]["kind"] != "revision_before":
                values[meta.canonical(d["destination_key"])] = after["content"] if d["destination_key"]["kind"] == "note_body" else encoded
    if before is not None:
        source = next(v for k, _, v, _, _ in meta.slots(db, row.owner_id, row.local_id) if k == before_d["source_keys"][0])
        if json.loads(source)["note"] != before:
            error("source_changed")
        values[meta.canonical(before_key)] = meta.canonical({"schema_version": 1, "note": before})
    if before_d["is_null"]:
        values[meta.canonical(before_key)] = None
    if request.operation == "restore" and after is not None:
        target = request.restore_source.descriptor.model_dump()
        if target["representation_kind"] == "snapshot_v1":
            source = next(raw for key, _, raw, _, _ in meta.slots(db, row.owner_id, row.local_id) if key == target["key"])
            restored = json.loads(source)["note"]
            if any(after[k] != restored[k] for k in ("note_type", "parent_local_id", "level", "deleted_at", "title", "content", "tags", "source")):
                error("restore_target_mismatch")
    if request.operation == "delete":
        original = meta.selected(db, row.owner_id, row.local_id)
        if request.structure.deleted_at is None or any(projection[k] != getattr(original, k)
            for k in ("note_type", "parent_local_id", "level", "title", "tags", "source")):
            error("projection_mismatch")
    if request.operation == "delete" and after is not None and before is not None:
        if any(after[k] != before[k] for k in ("content", "title", "tags", "source", "note_type", "parent_local_id", "level")) or after["deleted_at"] is None:
            error("projection_mismatch")
    try:
        meta.begin_update(db, row.owner_id, row.local_id)
        server, ref = m["server_fields"], m["revision_ref"]
        note_values = {**server, **projection, "content": values[meta.canonical(meta.key("note_body", server["id"], "content"))]}
        for field in ("created_at", "updated_at", "client_updated_at", "deleted_at"):
            note_values[field] = parsed(note_values[field])
        if request.selection is None:
            db.execute(Note.__table__.insert().values(**note_values))
        else:
            db.execute(Note.__table__.update().where(Note.id == server["id"], Note.owner_id == row.owner_id,
                Note.local_id == row.local_id).values(**note_values))
        db.expire_all()
        db.add(NoteRevision(id=ref["id"], owner_id=row.owner_id, local_id=row.local_id, note_id=server["id"],
            parent_revision_id=m["parent_ref"]["id"] if m["parent_ref"] else None, reason=PURPOSE, captured_at=row.created_at,
            snapshot_json=values[meta.canonical(after_key)], before_snapshot_json=values[meta.canonical(before_key)],
            representation_kind=after_d["output_kind"], representation_epoch=after_d["output_epoch"]))
        inv = db.get(NoteInventory, (row.owner_id, row.local_id, server["id"]))
        if inv is None:
            inv = NoteInventory(owner_id=row.owner_id, local_id=row.local_id, note_id=server["id"])
            db.add(inv)
        inv.revision_id, inv.snapshot_json = ref["id"], values[meta.canonical(meta.key("inventory_snapshot", server["id"], "current"))]
        inv.representation_kind, inv.representation_epoch = after_d["output_kind"], after_d["output_epoch"]
        ops.install_slots(db, row, m)
        head = db.get(NoteHead, (row.owner_id, row.local_id))
        head.version += 1; head.history_generation += 1
        head.head_revision_id, head.identity_state, head.current_mode = ref["id"], "coherent", request.target_current_mode
        row.state = "committed"
        row.commit_conditions_json = meta.canonical(body.model_dump(exclude={"plain_after", "plain_before", "projection"}))
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
        current = read.context(db, row.owner_id, row.local_id, row.actor_device_id, m["server_instance_id"])["context"]
        row.receipt_json = meta.canonical({"schema_version": 3, "purpose": PURPOSE, "operation_id": row.id,
            "mutation_id": row.mutation_id, "server_instance_id": m["server_instance_id"], "owner_id": row.owner_id,
            "local_id": row.local_id, "result": current, "metadata_manifest_digest": row.manifest_digest,
            "set_digests": {s: meta.h(m[s]) for s in SECTIONS}, "ciphertext_manifest_digest": meta.h(records),
            "origin_expectations_digest": meta.h(m["O"]), "committed_at": date(database_now(db))})
        db.flush(); db.info.get(meta.UPDATING, set()).discard((row.owner_id, row.local_id))
        return result(db, row)
    except IntegrityError as exc:
        unique = getattr(exc.orig, "sqlstate", None) == "23505" or getattr(exc.orig, "sqlite_errorcode", None) in (1555, 2067)
        if not unique:
            raise
        db.rollback()
        prep.authenticate_actor(db, body.owner_id, body.device_id)
        db.expire_all()
        row = ops.own(db, body, PURPOSE)
        if row.state == "committed":
            return replay(db, row, body)
        if row.state == "expired":
            raise ops.Expired(row)
        if row.state not in ("aborted", "expired", "stale"):
            row, _ = ops.active(db, body, PURPOSE)
            row.state = "stale"
            db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
        return {"http_status": 409, "detail": {"code": "revision_id_conflict", "required_schema_version": None}, "operation": result(db, row)}
