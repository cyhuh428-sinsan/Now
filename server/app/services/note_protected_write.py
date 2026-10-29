"""Protected semantic writes: fixed provenance quote, cipher-only transport, CAS."""
import base64
import json
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.models.note import Note
from app.models.note_history import NoteHead, NoteInventory, NoteRevision
from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence, NoteCryptoUpload
from app.schemas.note import NoteIn
from app.schemas.note_protected_write import Quote
from app.services import note_crypto as prep, note_crypto_storage as store, note_operation_origin as origin
from app.services.note_crypto_fence import error, require_unfenced, database_now, ACTIVE_STATES
from app.services.note_history import encoded, raw_snapshot, inventories
from app.services.note_sync import _note_sort_key, validate_note, validate_tree_parent
from app.services.note_v2 import canonical


def date(value):
    return value.isoformat(timespec="microseconds") + "Z"


def parsed(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None) if value else None


def own(db, owner, local, device, ident, creator=False):
    row = prep.owned(db, owner, local, device, ident, "protected_write")
    if creator and row.actor_device_id != device:
        error("transition_actor_mismatch", 403)
    if json.loads(row.conditions_json)["server_instance_id"] != prep.initialize_identity(db.connection()):
        error("server_instance_changed")
    return row


def parent_state(db, body):
    structure = body.structure
    if structure.parent_local_id is None:
        if body.parent_base is not None:
            error("invalid_note_parent", 422)
        return
    if structure.parent_local_id == body.local_id or body.parent_base is None or body.parent_base.local_id != structure.parent_local_id:
        error("invalid_note_parent")
    require_unfenced(db, [(body.owner_id, structure.parent_local_id)])
    state = prep.base_state(db, body.owner_id, structure.parent_local_id, baseline=False)
    expected = body.parent_base.model_dump(exclude={"local_id", "physical_note_id"})
    if state["identity_state"] != "coherent" or any(state[k] != v for k, v in expected.items()):
        error("parent_changed")
    query = select(Note).where(Note.owner_id == body.owner_id, Note.local_id == structure.parent_local_id, Note.note_type == "tree")
    if structure.deleted_at is None:
        query = query.where(Note.deleted_at.is_(None))
    parent = db.scalar(query.order_by(Note.updated_at.desc(), Note.id.desc()))
    if parent is None or parent.id != body.parent_base.physical_note_id or parent.level != structure.level - 1:
        error("parent_changed")


def structure_valid(db, body):
    payload = NoteIn(owner_id=body.owner_id, local_id=body.local_id, device_id=body.device_id,
                     title="", content="", **body.structure.model_dump())
    try:
        validate_note(payload)
        validate_tree_parent(payload, db)
    except Exception as exc:
        from fastapi import HTTPException
        if isinstance(exc, HTTPException):
            error("invalid_note_parent")
        raise
    parent_state(db, body)


def live_sources(db, owner, local):
    return store.live_entries(db, owner, local)


def validate_sources(db, row):
    c = json.loads(row.conditions_json)
    body = Quote.model_validate(c["request"])
    parent_state(db, body)
    if prep.related_plaintext(db, row.owner_id, row.local_id):
        error("related_plaintext_unresolved")
    if c["sources"]:
        current = {canonical(item["key"]): item for item, _ in live_sources(db, row.owner_id, row.local_id)}
        for descriptor in c["sources"]:
            if current.get(canonical(descriptor["key"])) != descriptor:
                error("target_changed")


def current_result(db, row):
    receipt = json.loads(row.receipt_json)
    latest = store.current_context(db, row.owner_id, row.local_id)
    mapping = {"result_revision_id": "head_revision_id", "result_head_version": "head_version",
               "result_inventory_revision_ids": "inventory_revision_ids", "crypto_epoch": "crypto_epoch",
               "history_generation": "history_generation", "identity_state": "identity_state",
               "current_exists": "current_exists", "protection_state": "protection_state", "server_instance_id": "server_instance_id"}
    return {"schema_version": 1, "status": "ok", "purpose": "protected_write", "quote_id": row.id,
            "mutation_id": row.mutation_id, "state": "committed", "receipt": receipt, "current_context": latest,
            "receipt_matches_current": latest["active_transition_id"] is None and all(receipt[k] == latest[v] for k, v in mapping.items())}


def result(db, row):
    if row.state == "committed":
        return current_result(db, row)
    c = json.loads(row.conditions_json)
    value = {"schema_version": 1, "status": "ok", "purpose": "protected_write", "quote_id": row.id,
             "mutation_id": row.mutation_id, "state": row.state, "expires_at": date(row.expires_at),
             "lease_version": row.lease_version, "base": c["base"], "crypto_epoch": c["request"]["target_epoch"],
             "target_epoch": c["request"]["target_epoch"], "operation": c["request"]["operation"],
             "server_fields": c["server_fields"], "revision_ref": c["revision_ref"], "parent_ref": c["parent_ref"],
             "restore_source_ref": c["request"]["target_ref"], "quote_operation_origin": c["quote_operation_origin"],
             "manifest_digest": row.manifest_digest, "null_slots": [{"key": k, "is_null": True, "operation_origin": None} for k in c["null_slots"]],
             "before_source": c["before_source"], "restore_source": c["restore_source"], "before_public_fields": None,
             "required_entries": [], "failure_code": c.get("failure_code")}
    if row.state in ACTIVE_STATES:
        for entry in db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id).order_by(NoteCryptoEntry.key_json)):
            value["required_entries"].append(store.entry_metadata(db, row, entry))
        if c["before_source"]:
            target = db.get(Note, c["server_fields"]["id"])
            value["before_public_fields"] = {k: v for k, v in json.loads(encoded(raw_snapshot(target)))["note"].items() if k != "content"}
    else:
        # Terminal metadata must never make a later current look like old before.
        value["before_source"], value["restore_source"] = None, None
    return value


@store.atomic
def quote(db, body):
    prep.authenticate_actor(db, body.owner_id, body.device_id)
    instance = prep.initialize_identity(db.connection())
    if body.server_instance_id != instance:
        error("server_instance_changed")
    previous = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id,
                                                          NoteCryptoTransition.mutation_id == body.mutation_id))
    if previous:
        if previous.purpose != "protected_write" or json.loads(previous.conditions_json)["request"] != body.model_dump():
            error("idempotency_mismatch")
        previous = own(db, body.owner_id, body.local_id, body.device_id, previous.id, creator=True)
        return {"created": False, **result(db, previous)}
    require_unfenced(db, [(body.owner_id, body.local_id)])
    base = prep.base_state(db, body.owner_id, body.local_id)
    if body.crypto_epoch != base["crypto_epoch"] or body.target_epoch != (base["crypto_epoch"] or 1):
        error("crypto_epoch_changed")
    if (body.base_head_version != base["head_version"] or body.base_revision_id != base["head_revision_id"]
        or body.expected_history_generation != base["history_generation"] or body.expected_inventory_revision_ids != base["inventory_revision_ids"]):
        error("version_conflict")
    if base["identity_state"] == "ambiguous":
        error("ambiguous_note_identity")
    if body.operation == "create":
        from app.models.note_v2 import NoteOfflineBranch
        if base["current_exists"] or base["head_version"] or base["history_generation"] or db.scalar(select(NoteOfflineBranch.id).where(
            NoteOfflineBranch.owner_id == body.owner_id, NoteOfflineBranch.local_id == body.local_id).limit(1)):
            error("wrong_operation_state")
    elif base["crypto_epoch"] < 1 or body.operation == "put" and not base["current_exists"]:
        error("wrong_operation_state")
    if (body.operation == "restore") != (body.target_ref is not None and body.target_ciphertext_sha256 is not None):
        error("invalid_restore_target", 422)
    if body.operation != "restore" and (body.target_ref is not None or body.target_ciphertext_sha256 is not None):
        error("invalid_restore_target", 422)
    if prep.related_plaintext(db, body.owner_id, body.local_id):
        error("related_plaintext_unresolved")
    structure_valid(db, body)
    rows = list(db.scalars(select(Note).where(Note.owner_id == body.owner_id, Note.local_id == body.local_id)))
    if len(rows) > 1 and body.replica_policy != "selected_head_only":
        error("replica_selection_required")
    if len(rows) > 1 and any(r.note_type != body.structure.note_type for r in rows):
        error("ambiguous_note_identity")
    selected = max(rows, key=_note_sort_key) if rows else None
    stamp = database_now(db)
    if selected:
        ident, device, created = selected.id, selected.device_id, selected.created_at
    elif db.bind.dialect.name == "postgresql":
        ident = db.scalar(select(func.nextval(func.pg_get_serial_sequence("notes", "id"))))
        if ident is None:
            error("note_id_allocator_unavailable", 503)
        device, created = body.device_id, stamp
    else:
        ident = (db.scalar(select(func.max(Note.id))) or 0) + 1
        device, created = body.device_id, stamp
    server = {"id": ident, "owner_id": body.owner_id, "device_id": device, "local_id": body.local_id,
              "created_at": date(created), "updated_at": date(stamp),
              "client_updated_at": date(max([stamp] + [_note_sort_key(r)[0] for r in rows]))}
    qid, revision_id = str(uuid4()), str(uuid4())
    ref = {"kind": "note_revision", "id": revision_id}
    parent = {"kind": "note_revision", "id": base["head_revision_id"]} if base["head_revision_id"] else None
    sources = live_sources(db, body.owner_id, body.local_id) if base["crypto_epoch"] else []
    by_key = {canonical(i["key"]): i for i, _ in sources}
    def source(kind, ident, slot):
        value = by_key.get(canonical({"kind": kind, "id": str(ident), "slot": slot}))
        if value is None:
            error("revision_not_found", 404)
        return value
    before = {"note_body": source("note_body", ident, "content"), "inventory": source("inventory_snapshot", ident, "current")} if selected else None
    restore = None
    if body.target_ref:
        restore = source("revision_snapshot" if body.target_ref.kind == "note_revision" else "offline_snapshot", body.target_ref.id,
                         "after" if body.target_ref.kind == "note_revision" else "snapshot")
        if restore["ciphertext_sha256"] != body.target_ciphertext_sha256:
            error("target_changed")
    meaning = {"purpose": "protected_write", "quote_id": qid, "mutation_id": body.mutation_id, "operation": body.operation,
               "restore_source_ref": body.target_ref.model_dump() if body.target_ref else None,
               "target_ciphertext_sha256": body.target_ciphertext_sha256}
    entries, expects = [], []
    slots = [("note_body", str(ident), "content"), ("revision_snapshot", revision_id, "after"), ("inventory_snapshot", str(ident), "current")]
    if before:
        slots.append(("revision_before", revision_id, "before"))
    for kind, key_id, slot in slots:
        key = {"kind": kind, "id": key_id, "slot": slot}
        binding = None if kind == "note_body" else {"server_instance_id": instance, "owner_id": body.owner_id, "local_id": body.local_id,
            "transition_id": qid, "crypto_epoch": body.target_epoch, "destination_key": key, "revision_ref": ref, "parent_ref": parent}
        semantic_id = None if kind == "note_body" else qid
        if kind == "revision_before":
            semantic_id = origin.semantic_id(db, body.owner_id, body.local_id, before["inventory"]["key"],
                next(raw.decode() for item, raw in sources if item["key"] == before["inventory"]["key"]))
        expects.append({"destination_key": key, "is_null": False, "origin_row_required": kind != "note_body", "semantic_origin_id": semantic_id})
        entries.append({"key": key, "source_etag": str(uuid4()), "source_kind": "client_pending",
                        "output_kind": "content_encrypted_v1" if kind == "note_body" else "history_envelope_v1",
                        "representation_epoch": base["crypto_epoch"], "binding": binding})
    nulls = [] if before else [{"kind": "revision_before", "id": revision_id, "slot": "before"}]
    expects += [{"destination_key": k, "is_null": True, "origin_row_required": True, "semantic_origin_id": None} for k in nulls]
    conditions = {"request": body.model_dump(), "server_instance_id": instance, "base": base, "server_fields": server,
                  "revision_ref": ref, "parent_ref": parent, "quote_operation_origin": meaning, "before_source": before, "restore_source": restore,
                  "sources": ([before["note_body"], before["inventory"]] if before else []) + ([restore] if restore else []),
                  "null_slots": nulls, "origin_metadata_version": 1, "origin_expectations": sorted(expects, key=lambda e: canonical(e["destination_key"]))}
    cores = [{k: v for k, v in entry.items() if k != "binding"} for entry in entries]
    cores.sort(key=lambda e: canonical(e["key"]))
    row = NoteCryptoTransition(id=qid, owner_id=body.owner_id, local_id=body.local_id, mutation_id=body.mutation_id,
        actor_device_id=body.device_id, purpose="protected_write", conditions_json=canonical(conditions),
        manifest_digest=store.sha(store.canonical_bytes(cores)), state="prepared", lease_version=1,
        created_at=stamp, expires_at=stamp + timedelta(minutes=30))
    db.add(row)
    db.flush()
    for entry in entries:
        db.add(NoteCryptoEntry(transition_id=qid, key_json=canonical(entry["key"]), binding_json=canonical(entry["binding"]),
            **{k: v for k, v in entry.items() if k not in ("key", "binding")}))
    db.add(NoteCryptoFence(owner_id=body.owner_id, local_id=body.local_id, transition_id=qid))
    db.flush()
    return {"created": True, **result(db, row)}


@store.atomic
def status(db, owner, local, device, ident):
    return result(db, own(db, owner, local, device, ident))


@store.atomic
def action(db, body, operation):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.transition_id, True)
    if operation == "abort":
        if row.state == "committed":
            error("quote_already_committed")
        if row.state in ACTIVE_STATES:
            row.state = "aborted"
            db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    else:
        if row.state == "expired":
            return {"http_status": 410, "detail": {"code": "quote_expired"}, "quote_id": row.id, "state": "expired"}
        if row.state not in ACTIVE_STATES:
            error("quote_not_active")
        if row.lease_version != body.lease_version:
            error("lease_changed")
        row.expires_at, row.lease_version = database_now(db) + timedelta(minutes=30), row.lease_version + 1
    return result(db, row)


@store.atomic
def source(db, owner, local, device, ident, key, etag, index):
    row = store.active(db, owner, local, device, ident, "protected_write")
    c = json.loads(row.conditions_json)
    descriptor = next((s for s in c["sources"] if s["key"] == key and s["representation_etag"] == etag), None)
    if descriptor is None:
        error("source_not_found", 404)
    raw = next(raw for item, raw in live_sources(db, owner, local) if item["key"] == key)
    if index >= descriptor["total_chunks"]:
        error("invalid_chunk_index", 422)
    chunk = raw[index * store.CHUNK_BYTES:(index + 1) * store.CHUNK_BYTES]
    return {**descriptor, "chunk_index": index, "chunk_sha256": store.sha(chunk), "data_base64": base64.b64encode(chunk).decode()}


def stale(db, row, code):
    c = json.loads(row.conditions_json)
    c["failure_code"] = code
    row.conditions_json, row.state = canonical(c), "stale"
    db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    return {"http_status": 409, "detail": {"code": code}, "quote_id": row.id, "state": "stale"}


@store.atomic
def commit(db, body):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.quote_id, True)
    if body.server_instance_id != prep.initialize_identity(db.connection()):
        error("server_instance_changed")
    core = canonical(body.model_dump(exclude={"projection"}))
    c = json.loads(row.conditions_json)
    if row.state == "committed":
        if core != row.commit_conditions_json:
            error("idempotency_mismatch")
        return current_result(db, row)
    if row.state == "stale":
        error(c["failure_code"])
    if row.state == "expired":
        return {"http_status": 410, "detail": {"code": "quote_expired"}, "quote_id": row.id, "state": "expired"}
    if row.state not in ACTIVE_STATES:
        error("quote_not_active")
    if body.mutation_id != row.mutation_id:
        error("idempotency_mismatch")
    if body.crypto_epoch != c["request"]["target_epoch"]:
        error("crypto_epoch_changed")
    if body.metadata_manifest_digest != row.manifest_digest:
        error("manifest_changed")
    base = c["base"]
    if (body.base_head_version != base["head_version"] or body.base_revision_id != base["head_revision_id"]
        or body.expected_history_generation != base["history_generation"] or body.expected_inventory_revision_ids != base["inventory_revision_ids"]):
        error("version_conflict")
    if body.projection.model_dump(include={"note_type", "parent_local_id", "level", "deleted_at"}) != c["request"]["structure"]:
        error("idempotency_mismatch")
    if prep.base_state(db, row.owner_id, row.local_id, baseline=False) != base:
        return stale(db, row, "version_conflict")
    from fastapi import HTTPException
    try:
        store.active(db, row.owner_id, row.local_id, row.actor_device_id, row.id, "protected_write")
    except HTTPException as exc:
        if exc.detail.get("code") in ("parent_changed", "target_changed", "version_conflict"):
            return stale(db, row, exc.detail["code"])
        raise
    entries = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
    cores = sorted([prep.entry_result(e) for e in entries], key=lambda e: canonical(e["key"]))
    if store.sha(store.canonical_bytes(cores)) != row.manifest_digest:
        error("manifest_changed")
    expected_keys = [e["destination_key"] for e in c["origin_expectations"] if not e["is_null"]]
    if sorted(e.key_json for e in entries) != sorted(canonical(k) for k in expected_keys):
        error("inconsistent_history")
    records, values = [], {}
    for entry in entries:
        key = json.loads(entry.key_json)
        origin.expectation(row, key)
        expected_binding = None if key["kind"] == "note_body" else {
            "server_instance_id": c["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id,
            "transition_id": row.id, "crypto_epoch": body.crypto_epoch, "destination_key": key,
            "revision_ref": c["revision_ref"], "parent_ref": c["parent_ref"]}
        if entry.binding_json != canonical(expected_binding):
            error("inconsistent_history")
        u = db.get(NoteCryptoUpload, (row.id, entry.key_json))
        if u is None or u.ciphertext_sha256 is None:
            error("incomplete_manifest")
        raw = store.assembled(db, u)
        if store.sha(raw) != u.ciphertext_sha256:
            error("stage_mismatch")
        store.validate_output(raw, entry.output_kind, body.crypto_epoch, store.expected_binding(db, row, key))
        values[key["kind"]] = raw.decode()
        records.append({"entry_key": key, "destination_key": key, "source_etag": entry.source_etag,
                        "output_kind": entry.output_kind, "target_epoch": body.crypto_epoch,
                        "total_bytes": u.total_bytes, "ciphertext_sha256": u.ciphertext_sha256})
    records.sort(key=lambda r: store.key_order(r["entry_key"]))
    cipher_digest = store.sha(store.canonical_bytes(records))
    if cipher_digest != body.client_verified_ciphertext_manifest_digest:
        error("verification_manifest_mismatch")
    server = c["server_fields"]
    new_current = not base["current_exists"]
    try:
        with db.begin_nested():
            # Only live writes are inside the savepoint; conflicts leave a valid outer ledger transaction.
            note_values = {**server, **body.projection.model_dump(), "content": values["note_body"]}
            for field in ("created_at", "updated_at", "client_updated_at", "deleted_at"):
                note_values[field] = parsed(note_values[field])
            if new_current:
                db.execute(Note.__table__.insert().values(**note_values))
            else:
                db.execute(Note.__table__.update().where(Note.id == server["id"], Note.owner_id == row.owner_id,
                    Note.local_id == row.local_id).values(**note_values))
            db.add(NoteRevision(id=c["revision_ref"]["id"], owner_id=row.owner_id, local_id=row.local_id,
                note_id=server["id"], parent_revision_id=base["head_revision_id"], reason="restore" if c["request"]["operation"] == "restore" else "write",
                captured_at=parsed(server["updated_at"]), snapshot_json=values["revision_snapshot"], before_snapshot_json=values.get("revision_before"),
                representation_epoch=body.crypto_epoch, representation_kind="history_envelope_v1"))
            inv = db.get(NoteInventory, (row.owner_id, row.local_id, server["id"]))
            if inv is None:
                inv = NoteInventory(owner_id=row.owner_id, local_id=row.local_id, note_id=server["id"])
                db.add(inv)
            inv.revision_id, inv.snapshot_json = c["revision_ref"]["id"], values["inventory_snapshot"]
            inv.representation_epoch, inv.representation_kind = body.crypto_epoch, "history_envelope_v1"
            head = db.get(NoteHead, (row.owner_id, row.local_id))
            if head is None:
                head = NoteHead(owner_id=row.owner_id, local_id=row.local_id, version=0, history_generation=0)
                db.add(head)
            head.version, head.history_generation = base["head_version"] + 1, base["history_generation"] + 1
            head.head_revision_id, head.identity_state = c["revision_ref"]["id"], "coherent"
            head.protection_state, head.crypto_epoch = "protected", body.crypto_epoch
            origin.install(db, row)
            db.flush()
    except IntegrityError:
        if new_current:
            prep.authenticate_actor(db, row.owner_id, row.actor_device_id)
            return stale(db, row, "provisional_note_id_conflict")
        raise
    row.state, row.commit_conditions_json = "committed", core
    db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    db.flush()
    latest = store.current_context(db, row.owner_id, row.local_id)
    receipt = {"server_instance_id": c["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id,
        "operation": c["request"]["operation"], "result_revision_id": c["revision_ref"]["id"], "result_head_version": latest["head_version"],
        "result_inventory_revision_ids": latest["inventory_revision_ids"], "note_id": server["id"], "crypto_epoch": latest["crypto_epoch"],
        "history_generation": latest["history_generation"], "identity_state": latest["identity_state"], "current_exists": True,
        "protection_state": "protected", "manifest_digest": row.manifest_digest, "ciphertext_manifest_digest": cipher_digest,
        "committed_at": date(database_now(db)), "origin_metadata_version": 1, "origin_expectations_digest": origin.expectations_digest(row)}
    row.receipt_json = canonical(receipt)
    return current_result(db, row)
