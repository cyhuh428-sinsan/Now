"""Schema2 fixed metadata sets and linked slot publication/read verification."""
import base64
import json
from uuid import uuid4

from sqlalchemy import select

from app.models.note_crypto import NoteCryptoEntry, NoteCryptoTransition
from app.models.note_related import LinkedText
from app.models.note_history import NoteRevision
from app.models.note import Note, AnalysisJob, Recording
from app.schemas.related_text import PrepareRelated
from app.services import related_text as linked, note_crypto as prep, note_crypto_storage as store
from app.services.note_crypto_fence import ACTIVE_STATES, error

SETS = ("entries", "null_slots", "origin_expectations", "linked_expectations")


def is_schema2(row):
    return json.loads(row.conditions_json).get("schema_version") == 2


def context(row, c):
    return {"schema_version": 2, "purpose": "conversion", "transition_id": row.id,
        "server_instance_id": c["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id,
        "actor_device_id": row.actor_device_id, "base": c["base"], "target_epoch": c["request"]["target_epoch"],
        "drain_ref": {k: c["request"][k] for k in ("drain_id", "drain_version")}, "linked_metadata_version": 1}


def payload(row, c):
    return {**context(row, c), **c["metadata_sets"]}


def hash_value(value):
    return store.sha(store.canonical_bytes(value))


def fixed(row):
    try:
        c = json.loads(row.conditions_json)
        request = PrepareRelated.model_validate(c["request"]).model_dump()
        if (type(c["schema_version"]) is not int or c["schema_version"] != 2
            or type(c["linked_metadata_version"]) is not int or c["linked_metadata_version"] != 1
            or type(c["origin_metadata_version"]) is not int or c["origin_metadata_version"] != 1
            or request != c["request"] or row.purpose != "conversion"
            or request["owner_id"] != row.owner_id or request["local_id"] != row.local_id
            or request["device_id"] != row.actor_device_id or request["mutation_id"] != row.mutation_id
            or request["server_instance_id"] != c["server_instance_id"]
            or set(c["metadata_sets"]) != set(SETS) or hash_value(payload(row, c)) != row.manifest_digest):
            error("inconsistent_related_text")
        mapping = {"crypto_epoch": "crypto_epoch", "base_head_version": "head_version", "base_revision_id": "head_revision_id",
            "expected_history_generation": "history_generation", "expected_inventory_revision_ids": "inventory_revision_ids"}
        if any(request[k] != c["base"][v] for k, v in mapping.items()):
            error("inconsistent_related_text")
        if c["metadata_sets"]["origin_expectations"] != c["origin_expectations"] or c["metadata_sets"]["linked_expectations"] != c["linked_expectations"]:
            error("inconsistent_related_text")
        return c
    except (KeyError, TypeError, ValueError):
        error("inconsistent_related_text")


def expectation(row, c, k, meta):
    return {"key": k, "source_slot_version": meta.slot_version, "target_slot_version": meta.slot_version + 1,
        "is_null": meta.is_null, "source_kind": meta.representation_kind, "target_kind": "linked_text_envelope_v1",
        "target_epoch": c["request"]["target_epoch"], "storage_operation_id": row.id}


def public_rows(db, owner, local):
    result = []
    for model in (AnalysisJob, Recording):
        for row in db.scalars(select(model).where(model.owner_id == owner, model.note_local_id == local).order_by(model.id)):
            fields = {"id": row.id, "owner_id": row.owner_id, "note_local_id": row.note_local_id,
                "created_at": row.created_at.isoformat(), "updated_at": row.updated_at.isoformat()}
            if model is AnalysisJob:
                fields.update(status=row.status, job_type=row.job_type)
            else:
                fields.update(device_id=row.device_id, local_id=row.local_id, file_name=row.file_name,
                              content_type=row.content_type, storage_path=row.storage_path)
            result.append({"model": model.__tablename__, **fields})
    return result


def collect(db, owner, local):
    result, nulls = [], []
    for k, row, meta, raw in linked.slots(db, owner, local):
        if raw is None:
            nulls.append(k)
        else:
            result.append({"key": k, "source_etag": str(uuid4()), "source_kind": meta.representation_kind,
                "output_kind": "linked_text_envelope_v1", "representation_epoch": meta.representation_epoch})
    return result, nulls


def finish_prepare(db, row):
    c = json.loads(row.conditions_json)
    c["schema_version"], c["linked_metadata_version"] = 2, 1
    c["linked_expectations"] = [expectation(row, c, k, m) for k, target, m, raw in linked.slots(db, row.owner_id, row.local_id)]
    c["row_expectations"] = public_rows(db, row.owner_id, row.local_id)
    row.conditions_json = linked.canonical(c)
    entries = []
    for entry in db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)):
        k = json.loads(entry.key_json)
        e = store.entry_metadata(db, row, entry)
        version = next((item["source_slot_version"] for item in c["linked_expectations"] if item["key"] == k), None)
        entries.append({**prep.entry_result(entry), "destination_key": store.destination(k),
            "expected_binding": e["expected_binding"], "operation_origin": e["operation_origin"], "slot_version": version})
    entries.sort(key=lambda e: store.key_order(e["key"]))
    nulls = []
    for k in c["null_slots"]:
        version = next((item["source_slot_version"] for item in c["linked_expectations"] if item["key"] == k), None)
        nulls.append({"key": k, "is_null": True, "representation_epoch": c["base"]["crypto_epoch"], "slot_version": version,
                      "expected_binding": store.expected_binding(db, row, k), "operation_origin": None})
    nulls.sort(key=lambda e: store.key_order(e["key"]))
    c["origin_expectations"].sort(key=lambda e: store.key_order(e["destination_key"]))
    c["metadata_sets"] = dict(zip(SETS, (entries, nulls, c["origin_expectations"], c["linked_expectations"])))
    row.conditions_json, row.manifest_digest = linked.canonical(c), hash_value(payload(row, c))
    if not entries:
        row.state = "ready"


def status_fields(row):
    c = fixed(row); sets = c["metadata_sets"]
    counts = {kind: {"nonnull": 0, "null": 0} for kind in linked.SLOTS}
    for item in c["linked_expectations"]:
        counts[item["key"]["kind"]]["null" if item["is_null"] else "nonnull"] += 1
    return {"schema_version": 2, "metadata_context": context(row, c), "linked_metadata_version": 1,
        "drain_id": c["request"]["drain_id"], "drain_version": c["request"]["drain_version"],
        "metadata_manifest_digest": row.manifest_digest, "manifest_digest": row.manifest_digest,
        "set_counts": {k: len(v) for k, v in sets.items()}, "linked_counts": counts,
        "linked_slots": [e for e in sets["entries"] + sets["null_slots"] if e["key"]["kind"] in linked.SLOTS]}


def checked_schema(row, schema, digest):
    if schema != 2 or digest != row.manifest_digest:
        error("manifest_changed")
    return fixed(row)


def manifest(row, limit, cursor, schema, digest):
    c = checked_schema(row, schema, digest)
    items = [{"set": name, "entry": e} for name in SETS for e in c["metadata_sets"][name]]
    scope = {k: v for k, v in context(row, c).items() if k in ("schema_version", "purpose", "transition_id", "server_instance_id", "owner_id", "local_id", "actor_device_id")}
    scope["metadata_manifest_digest"] = row.manifest_digest
    def item_key(item):
        return item["entry"]["destination_key" if item["set"] == "origin_expectations" else "key"]
    start = 0
    if cursor:
        try:
            parsed = json.loads(base64.urlsafe_b64decode(cursor))
            if {k: parsed[k] for k in scope} != scope or set(parsed) != set(scope) | {"last_set", "last_key"}:
                error("manifest_changed")
            matches = [i for i, item in enumerate(items) if item["set"] == parsed["last_set"] and item_key(item) == parsed["last_key"]]
            if len(matches) != 1:
                error("manifest_changed")
            start = matches[0] + 1
        except (ValueError, KeyError, TypeError):
            error("invalid_cursor", 422)
    page = items[start:start + limit]
    next_cursor = None
    if start + limit < len(items):
        next_cursor = base64.urlsafe_b64encode(store.canonical_bytes({**scope, "last_set": page[-1]["set"], "last_key": item_key(page[-1])})).decode()
    fields = status_fields(row)
    return {"schema_version": 2, "purpose": "conversion", "state": row.state,
        **{k: fields[k] for k in ("metadata_context", "manifest_digest", "metadata_manifest_digest", "set_counts", "linked_counts")},
        "items": page, "next_cursor": next_cursor}


def validate(db, row):
    c = fixed(row)
    from app.models.note_related import RelatedDrain
    drainer = db.get(RelatedDrain, c["request"]["drain_id"])
    if (drainer is None or drainer.owner_id != row.owner_id or drainer.local_id != row.local_id
        or drainer.transition_id != row.id or drainer.state != "promoted" or drainer.drain_version != c["request"]["drain_version"]):
        error("inconsistent_related_text")
    if public_rows(db, row.owner_id, row.local_id) != c["row_expectations"]:
        error("manifest_changed")
    actual = [expectation(row, c, k, m) for k, target, m, raw in linked.slots(db, row.owner_id, row.local_id)]
    if actual != c["linked_expectations"]:
        error("inconsistent_related_text")
    records = {linked.canonical(e["key"]): e for e in c["metadata_sets"]["entries"]}
    entries = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
    if len(entries) != len(records):
        error("manifest_changed")
    for entry in entries:
        record = records.get(entry.key_json)
        if record is None or any(record[k] != prep.entry_result(entry)[k] for k in prep.entry_result(entry)) or json.loads(entry.binding_json) != record["expected_binding"]:
            error("manifest_changed")
    request = PrepareRelated.model_validate(c["request"])
    prep.validate_reservations(db, request)
    native_nulls = prep.null_slots(db, row.owner_id, row.local_id)
    related_nulls = [k for k, target, m, raw in linked.slots(db, row.owner_id, row.local_id) if raw is None]
    if sorted(c["null_slots"], key=store.key_order) != sorted(native_nulls + related_nulls, key=store.key_order):
        error("manifest_changed")
    from app.services.note_operation_origin import conversion_expectations
    existing = [prep.entry_result(e) for e in entries if json.loads(e.key_json)["kind"] not in linked.SLOTS]
    origins = conversion_expectations(db, row.owner_id, row.local_id, existing, native_nulls)
    origins.sort(key=lambda e: store.key_order(e["destination_key"]))
    if origins != c["origin_expectations"]:
        error("inconsistent_history")
    return entries


def raw_value(db, row, k):
    kind, ident = k["kind"], k["id"]
    if kind in linked.SLOTS:
        model, field = linked.SLOTS[kind]
        target = db.get(model, int(ident))
        if target is None or target.owner_id != row.owner_id or target.note_local_id != row.local_id:
            error("manifest_changed")
        return getattr(target, field)
    if kind == "note_body":
        target = db.get(Note, int(ident)); field = "content"
    elif kind in ("revision_snapshot", "revision_before"):
        target = db.get(NoteRevision, ident); field = "snapshot_json" if kind == "revision_snapshot" else "before_snapshot_json"
    else:
        from app.models.note_history import NoteInventory
        from app.models.note_v2 import NoteOfflineBranch
        target = db.get(NoteInventory, (row.owner_id, row.local_id, int(ident))) if kind == "inventory_snapshot" else db.get(NoteOfflineBranch, ident)
        field = "snapshot_json"
    if target is None or target.owner_id != row.owner_id or target.local_id != row.local_id:
        error("manifest_changed")
    return getattr(target, field)


def source(db, row, k, etag, schema, digest):
    c = checked_schema(row, schema, digest)
    if row.state not in ACTIVE_STATES:
        error("source_unavailable", 410 if row.state == "expired" else 409)
    store.active(db, row.owner_id, row.local_id, row.actor_device_id, row.id)
    for name in ("entries", "null_slots"):
        e = next((e for e in c["metadata_sets"][name] if e["key"] == k), None)
        if e is not None:
            if e.get("source_etag") != etag:
                error("source_not_found", 404)
            if k["kind"] == "reserved_offline_snapshot":
                error("client_source_only")
            return {"schema_version": 2, "metadata_context": context(row, c), "metadata_manifest_digest": row.manifest_digest,
                    "set": name, "entry": e, "value": raw_value(db, row, k)}
    error("source_not_found", 404)


def publish(db, row, k, value):
    model, field = linked.SLOTS[k["kind"]]
    target = db.get(model, int(k["id"]))
    db.execute(model.__table__.update().where(model.id == target.id, model.owner_id == row.owner_id,
        model.note_local_id == row.local_id).values(**{field: value, "updated_at": model.updated_at}))
    meta = db.get(LinkedText, (row.owner_id, row.local_id, linked.canonical(k)))
    meta.representation_kind, meta.representation_epoch = "linked_text_envelope_v1", json.loads(row.conditions_json)["request"]["target_epoch"]
    meta.storage_operation_id, meta.slot_version, meta.is_null = row.id, meta.slot_version + 1, value is None


def publish_nulls(db, row):
    c = fixed(row)
    for item in c["linked_expectations"]:
        if item["is_null"]:
            publish(db, row, item["key"], None)


def descriptor(db, owner, local, k, target, meta, raw):
    try:
        op = db.get(NoteCryptoTransition, meta.storage_operation_id)
        if op is None or op.owner_id != owner or op.local_id != local or op.state != "committed":
            error("inconsistent_related_text")
        if op.purpose in ("protected_analysis_write", "protected_transcript_write"):
            from app.services.related_writes import validate_live
            binding = validate_live(op, k, meta, raw)
            if binding["server_instance_id"] != prep.initialize_identity(db.connection()):
                error("server_instance_changed")
            data = b"" if raw is None else raw.encode("utf-8")
            if raw is not None:
                store.validate_output(data, "linked_text_envelope_v1", meta.representation_epoch, binding)
            return {"key": k, "representation_kind": "linked_text_envelope_v1", "representation_epoch": meta.representation_epoch,
                "representation_etag": hash_value([k, meta.representation_epoch, store.sha(data) if raw is not None else None, meta.slot_version]),
                "is_null": raw is None, "slot_version": meta.slot_version, "total_bytes": len(data),
                "total_chunks": (len(data) + store.CHUNK_BYTES - 1) // store.CHUNK_BYTES,
                "ciphertext_sha256": store.sha(data) if raw is not None else None, "expected_binding": binding,
                "revision_ref": None, "parent_ref": None, "physical_note_id": None, "inventory_revision_id": None,
                "operation_origin": None}, data
        c = fixed(op); receipt = json.loads(op.receipt_json)
        if c["server_instance_id"] != prep.initialize_identity(db.connection()):
            error("server_instance_changed")
        expected = next((e for e in c["linked_expectations"] if e["key"] == k), None)
        if (type(receipt.get("linked_metadata_version")) is not int or receipt["linked_metadata_version"] != 1
            or receipt.get("linked_expectations_digest") != hash_value(c["linked_expectations"])
            or expected is None or expected["target_slot_version"] != meta.slot_version
            or expected["target_epoch"] != meta.representation_epoch or expected["is_null"] != (raw is None)
            or meta.representation_kind != "linked_text_envelope_v1"):
            error("inconsistent_related_text")
        binding = {"server_instance_id": c["server_instance_id"], "owner_id": owner, "local_id": local,
            "transition_id": op.id, "crypto_epoch": meta.representation_epoch, "destination_key": k, "revision_ref": None, "parent_ref": None}
        data = b"" if raw is None else raw.encode("utf-8")
        if raw is not None:
            store.validate_output(data, "linked_text_envelope_v1", meta.representation_epoch, binding)
        return {"key": k, "representation_kind": "linked_text_envelope_v1", "representation_epoch": meta.representation_epoch,
            "representation_etag": hash_value([k, meta.representation_epoch, store.sha(data) if raw is not None else None, meta.slot_version]),
            "is_null": raw is None, "slot_version": meta.slot_version, "total_bytes": len(data),
            "total_chunks": (len(data) + store.CHUNK_BYTES - 1) // store.CHUNK_BYTES,
            "ciphertext_sha256": store.sha(data) if raw is not None else None, "expected_binding": binding,
            "revision_ref": None, "parent_ref": None, "physical_note_id": None, "inventory_revision_id": None,
            "operation_origin": None}, data
    except (TypeError, ValueError, KeyError):
        error("inconsistent_related_text")
