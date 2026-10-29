"""M1 gated current-only decryption and full re-encryption metadata operations."""
import base64
import json
from datetime import datetime, timedelta
from functools import wraps
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence, NoteCryptoUpload, NoteCryptoChunk
from app.models.note_history import NoteHead
from app.services import note_crypto as prep, note_crypto_storage as store, note_mixed_metadata as meta, note_mixed_read as read
from app.services.note_crypto_fence import ACTIVE_STATES, active_fence, database_now, error, expire, require_unfenced

CP = "current_plain_transition"
RC = "mixed_conversion"


class Expired(Exception):
    def __init__(self, row):
        self.row = row


def atomic(fn):
    @wraps(fn)
    def execute(db, *args, **kwargs):
        try:
            return fn(db, *args, **kwargs)
        except Expired as exc:
            return {"http_status": 410, "detail": {"code": "operation_expired", "required_schema_version": None},
                    "operation": result(db, exc.row)}
    return store.atomic(execute)


def gate():
    from app.core.capabilities import MIXED_MUTATIONS_ENABLED
    if not MIXED_MUTATIONS_ENABLED:
        error("mixed_mode_not_enabled")


def binding(owner, local, instance, ident, epoch, key, ref, parent):
    return {"server_instance_id": instance, "owner_id": owner, "local_id": local, "transition_id": ident,
            "crypto_epoch": epoch, "destination_key": key, "revision_ref": ref, "parent_ref": parent}


def fixed(row):
    if row.purpose == "mixed_note_write":
        from app.services.note_mixed_write import fixed as write_fixed
        return write_fixed(row)
    from app.schemas.note_mixed import PlainQuote, ConversionPrepare
    try:
        c = json.loads(row.conditions_json)
        m, request = c["M0"], c["request"]
        parsed = (PlainQuote if row.purpose == CP else ConversionPrepare).model_validate(request).model_dump()
        source_digest = meta.h({"server_instance_id": m["server_instance_id"], "owner_id": m["owner_id"], "local_id": m["local_id"],
            "context": m["base"], "entries": [s["descriptor"] for s in m["S"]]})
        if (parsed != request or request["base"] != m["base"] or request["expected_catalog_digest"] != source_digest
            or request["drain_ref"] != m["drain_ref"] or request["target_current_mode"] != m["target_current_mode"]
            or any(request[field] != m[field] for field in ("owner_id", "local_id", "server_instance_id", "mutation_id"))
            or request["device_id"] != m["actor_device_id"]
            or row.purpose == CP and (request["selection"] != m["selection"] or m["target_epoch"] != m["base"]["base"]["crypto_epoch"])
            or row.purpose == RC and (request["target_epoch"] != m["target_epoch"] or sorted(request["reserved_branches"], key=lambda b: b["revision_id"]) != m["reserved_branches"])):
            error("inconsistent_history")
    except (ValueError, KeyError, TypeError):
        error("inconsistent_history")
    if (m["operation_id"] != row.id or m["purpose"] != row.purpose or m["mutation_id"] != row.mutation_id
        or m["owner_id"] != row.owner_id or m["local_id"] != row.local_id or meta.h(m) != row.manifest_digest):
        error("inconsistent_history")
    return m


def own(db, body, purpose):
    prep.authenticate_actor(db, body.owner_id, body.device_id)
    if prep.initialize_identity(db.connection()) != body.server_instance_id:
        error("server_instance_changed")
    row = db.get(NoteCryptoTransition, body.operation_id)
    if row is None or (row.owner_id, row.local_id, row.purpose) != (body.owner_id, body.local_id, purpose):
        error("operation_not_found", 404)
    if row.actor_device_id != body.device_id:
        error("transition_actor_mismatch", 403)
    fixed(row)
    expire(db, row)
    return row


def latest(db, owner, local, device, instance):
    c = read.context(db, owner, local, device, instance)
    fence = active_fence(db, owner, local)
    return {**c["context"], "server_instance_id": instance, "active_operation_id": fence.id if fence else None}


def counts(m):
    return {name: read.count([v["descriptor"] for v in m[name]] if name == "S" else m[name],
        "destination_key" if name in ("DSET", "O") else "key") for name in (("S", "DSET", "P", "O", "existing", "verified_existing") if m["purpose"] == "mixed_note_write" else ("S", "DSET", "P", "O"))}


def result(db, row):
    if row.purpose == "mixed_note_write":
        from app.services.note_mixed_write import result as write_result
        return write_result(db, row)
    m = fixed(row)
    receipt = json.loads(row.receipt_json) if row.receipt_json else None
    c = latest(db, row.owner_id, row.local_id, row.actor_device_id, m["server_instance_id"])
    b3 = {k: c[k] for k in ("base", "current_mode", "selected_physical_note_id", "mixed_metadata_version")}
    return {"schema_version": 3, "status": "ok", "purpose": row.purpose, "operation_id": row.id, "mutation_id": row.mutation_id,
        "state": row.state, "lease_version": row.lease_version, "expires_at": row.expires_at.isoformat(timespec="microseconds") + "Z",
        "metadata_header": {k: v for k, v in m.items() if k not in ("S", "DSET", "P", "O")}, "counts": counts(m),
        "set_digests": {k: meta.h(m[k]) for k in ("S", "DSET", "P", "O")}, "metadata_manifest_digest": row.manifest_digest,
        "receipt": receipt, "current_context": c,
        "receipt_matches_current": receipt is not None and receipt["result"] == b3 and c["active_operation_id"] is None}


def output(key, sources, kind, epoch, is_null, expected):
    return {"destination_key": key, "source_keys": sources, "source_etag": str(uuid4()),
        "output_kind": kind, "output_epoch": epoch, "is_null": is_null, "expected_binding": expected}


def row_signatures(db, owner, local):
    from app.models.note import Note, AnalysisJob, Recording
    from app.models.note_history import NoteRevision, NoteInventory
    from app.models.note_v2 import NoteOfflineBranch
    # Only identity/graph/time/file metadata, never note text or its fingerprint.
    fields = {
        Note: ("id", "owner_id", "local_id", "device_id", "note_type", "parent_local_id", "level", "deleted_at", "created_at", "updated_at", "client_updated_at"),
        NoteRevision: ("id", "owner_id", "local_id", "note_id", "parent_revision_id", "reason", "captured_at"),
        NoteInventory: ("owner_id", "local_id", "note_id", "revision_id"),
        NoteOfflineBranch: ("id", "owner_id", "local_id", "parent_kind", "parent_id", "origin_device_id", "captured_at", "schema_version"),
        AnalysisJob: ("id", "owner_id", "note_local_id", "job_type", "status", "created_at", "updated_at"),
        Recording: ("id", "owner_id", "note_local_id", "device_id", "local_id", "file_name", "content_type", "storage_path", "created_at", "updated_at"),
    }
    signatures = []
    for model, names in fields.items():
        local_column = model.note_local_id if model in (AnalysisJob, Recording) else model.local_id
        rows = db.execute(select(*(getattr(model, name) for name in names)).where(model.owner_id == owner, local_column == local).order_by(*model.__table__.primary_key.columns))
        for row in rows.mappings():
            signatures.append({"table": model.__tablename__, "fields": {
                name: value.isoformat(timespec="microseconds") + "Z" if isinstance(value, datetime) else value for name, value in row.items()}})
    return signatures


@atomic
def prepare(db, body, purpose):
    prep.authenticate_actor(db, body.owner_id, body.device_id)
    if prep.initialize_identity(db.connection()) != body.server_instance_id:
        error("server_instance_changed")
    gate()
    previous = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id, NoteCryptoTransition.mutation_id == body.mutation_id))
    if previous is not None:
        if previous.purpose != purpose or json.loads(previous.conditions_json)["request"] != body.model_dump() or previous.actor_device_id != body.device_id:
            error("idempotency_mismatch")
        expire(db, previous)
        return {"created": False, **result(db, previous)}
    require_unfenced(db, [(body.owner_id, body.local_id)])
    from app.services.related_drain import ready
    drainer, ready_base = ready(db, SimpleNamespace(owner_id=body.owner_id, local_id=body.local_id, device_id=body.device_id,
        server_instance_id=body.server_instance_id, **body.drain_ref.model_dump()))
    c = read.context(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id)
    b3 = body.base.model_dump()
    if c["context"] != b3 or ready_base != b3["base"] or c["catalog_digest"] != body.expected_catalog_digest:
        error("version_conflict")
    owner, local, instance, ident = body.owner_id, body.local_id, body.server_instance_id, str(uuid4())
    sources = read.descriptors(db, owner, local)
    m = {"schema_version": 3, "purpose": purpose, "operation_id": ident, "mutation_id": body.mutation_id,
        "server_instance_id": instance, "owner_id": owner, "local_id": local, "actor_device_id": body.device_id, "base": b3,
        "target_epoch": b3["base"]["crypto_epoch"], "target_current_mode": body.target_current_mode,
        "drain_ref": body.drain_ref.model_dump(), "selection": None, "server_fields": None, "revision_ref": None, "parent_ref": None,
        "reserved_branches": [], "S": [{"descriptor": d, "source_etag": str(uuid4())} for d in sources], "DSET": [], "P": [], "O": []}
    if purpose == CP:
        from app.services.note_history import raw_snapshot, encoded
        if not b3["base"]["current_exists"]:
            error("current_required")
        if b3["base"]["identity_state"] != "coherent":
            error("ambiguous_note_identity")
        if b3["current_mode"] != "protected":
            error("wrong_operation_state")
        note = meta.selected(db, owner, local)
        pair = [meta.key("note_body", note.id, "content"), meta.key("inventory_snapshot", note.id, "current")]
        nd, inv = [next(d for d in sources if d["key"] == key) for key in pair]
        expected_selection = {"physical_note_id": note.id, "inventory_revision_ref": inv["revision_ref"],
            "note_representation_etag": nd["representation_etag"], "inventory_representation_etag": inv["representation_etag"]}
        if body.selection.model_dump() != expected_selection:
            error("source_changed")
        ref = {"kind": "note_revision", "id": str(uuid4())}
        parent = {"kind": "note_revision", "id": b3["base"]["head_revision_id"]}
        snapshot = json.loads(encoded(raw_snapshot(note)))["note"]
        server = {k: snapshot[k] for k in ("id", "owner_id", "device_id", "local_id", "client_updated_at", "created_at", "updated_at")}
        m.update(selection=expected_selection, server_fields=server, revision_ref=ref, parent_ref=parent)
        for key in [pair[0], pair[1], meta.key("revision_snapshot", ref["id"], "after")]:
            m["DSET"].append(output(key, pair, "plain_text_v1" if key["kind"] == "note_body" else "snapshot_v1", 0, False, None))
        before = meta.key("revision_before", ref["id"], "before")
        m["DSET"].append(output(before, [pair[1]], "history_envelope_v1", inv["representation_epoch"], False,
            binding(owner, local, instance, ident, inv["representation_epoch"], before, ref, parent)))
        m["P"] = [d for d in sources if d["key"] not in pair]
    else:
        if body.target_epoch != m["target_epoch"] + 1 or body.target_current_mode != ("protected" if b3["base"]["current_exists"] else "absent"):
            error("crypto_epoch_changed")
        m["target_epoch"] = body.target_epoch
        for d in sources:
            k = d["key"]
            kind = "content_encrypted_v1" if k["kind"] == "note_body" else "linked_text_envelope_v1" if d["origin_validator"] == "linked_v1" else "history_envelope_v1"
            expected = None if k["kind"] == "note_body" else binding(owner, local, instance, ident, body.target_epoch, k, d["revision_ref"], d["parent_ref"])
            m["DSET"].append(output(k, [k], kind, body.target_epoch, d["is_null"], expected))
        reserve(db, body, m)
    by_key = {meta.canonical(d["key"]): d for d in sources}
    for d in m["DSET"]:
        k = d["destination_key"]
        validator = "body_v1" if k["kind"] == "note_body" else "linked_v1" if d["output_kind"] == "linked_text_envelope_v1" else "native_v1"
        original = by_key.get(meta.canonical(d["source_keys"][0]))
        semantic = original["semantic_origin_id"] if original else None
        if purpose == CP and k["kind"] in ("revision_snapshot", "inventory_snapshot"):
            semantic = ident
        if validator != "native_v1":
            semantic = None
        m["O"].append({"destination_key": k, "is_null": d["is_null"], "origin_validator": validator,
            "origin_row_required": validator == "native_v1", "storage_operation_id": ident, "semantic_origin_id": semantic})
    m["O"] += [{"destination_key": d["key"], **{f: d[f] for f in ("is_null", "origin_validator", "origin_row_required", "storage_operation_id", "semantic_origin_id")}} for d in m["P"]]
    for section in ("DSET", "O"):
        m[section].sort(key=lambda e: store.key_order(e["destination_key"]))
    stamp = database_now(db)
    row = NoteCryptoTransition(id=ident, owner_id=owner, local_id=local, mutation_id=body.mutation_id, actor_device_id=body.device_id,
        purpose=purpose, conditions_json=meta.canonical({"request": body.model_dump(), "M0": m,
            "source_row_signatures": row_signatures(db, owner, local)}), manifest_digest=meta.h(m), state="prepared",
        lease_version=1, created_at=stamp, expires_at=stamp + timedelta(minutes=30))
    db.add(row); db.flush()
    for d in m["DSET"]:
        if d["is_null"] or d["output_epoch"] == 0:
            continue
        db.add(NoteCryptoEntry(transition_id=ident, key_json=meta.canonical(d["destination_key"]), source_etag=d["source_etag"],
            source_kind="client_pending", output_kind=d["output_kind"], representation_epoch=d["output_epoch"], binding_json=meta.canonical(d["expected_binding"]) if d["expected_binding"] else None))
    db.add(NoteCryptoFence(owner_id=owner, local_id=local, transition_id=ident))
    drainer.state, drainer.transition_id = "promoted", ident
    db.flush()
    return {"created": True, **result(db, row)}


def reserve(db, body, m):
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_history import NoteRevision
    seen = set()
    for b in body.reserved_branches:
        if b.revision_id in seen or db.get(NoteOfflineBranch, b.revision_id) or db.get(NoteRevision, b.revision_id):
            error("revision_id_conflict")
        seen.add(b.revision_id)
    graph = {b.revision_id: b.parent_ref.model_dump() if b.parent_ref else None for b in body.reserved_branches}
    for start in graph:
        chain, node = set(), start
        while node in graph:
            if node in chain:
                error("invalid_branch_graph")
            chain.add(node); parent = graph[node]
            if parent is None:
                break
            if parent["kind"] == "offline_branch" and parent["id"] in graph:
                node = parent["id"]; continue
            if not any(s["descriptor"]["revision_ref"] == parent for s in m["S"]):
                error("invalid_branch_graph")
            break
    m["reserved_branches"] = sorted([b.model_dump() for b in body.reserved_branches], key=lambda b: b["revision_id"])
    for b in m["reserved_branches"]:
        k = meta.key("offline_snapshot", b["revision_id"], "snapshot")
        source = meta.key("reserved_offline_snapshot", b["revision_id"], "snapshot")
        expected = binding(m["owner_id"], m["local_id"], m["server_instance_id"], m["operation_id"], m["target_epoch"], k,
            {"kind": "offline_branch", "id": b["revision_id"]}, b["parent_ref"])
        m["DSET"].append(output(k, [source], "history_envelope_v1", m["target_epoch"], False, expected))


def active(db, body, purpose):
    row = own(db, body, purpose)
    if row.state == "expired":
        raise Expired(row)
    if row.state not in ACTIVE_STATES:
        error("operation_expired" if row.state == "expired" else "operation_not_active", 410 if row.state == "expired" else 409)
    fence = active_fence(db, row.owner_id, row.local_id)
    if fence is None or fence.id != row.id:
        error("inconsistent_crypto_fence")
    m = fixed(row)
    if purpose == "mixed_note_write":
        from app.schemas.note_mixed import WriteQuote
        from app.services.note_mixed_write import check_parent
        check_parent(db, WriteQuote.model_validate(json.loads(row.conditions_json)["request"]))
    c = read.context(db, row.owner_id, row.local_id, row.actor_device_id, m["server_instance_id"])
    if c["context"] != m["base"]:
        error("context_changed" if purpose == "mixed_note_write" else "version_conflict")
    current = read.descriptors(db, row.owner_id, row.local_id)
    if current != [s["descriptor"] for s in m["S"]]:
        error("context_changed" if purpose == "mixed_note_write" else "source_changed")
    if row_signatures(db, row.owner_id, row.local_id) != json.loads(row.conditions_json).get("source_row_signatures"):
        error("source_changed")
    if hasattr(body, "metadata_manifest_digest") and body.metadata_manifest_digest != row.manifest_digest:
        error("manifest_changed")
    return row, m


@atomic
def status(db, body, purpose):
    return result(db, own(db, body, purpose))


@atomic
def action(db, body, purpose, operation):
    gate()
    row = own(db, body, purpose)
    if row.state == "expired":
        raise Expired(row)
    if operation == "abort" and row.state == "aborted":
        return result(db, row)
    if row.state not in ACTIVE_STATES:
        error("operation_expired" if row.state == "expired" else "operation_not_active", 410 if row.state == "expired" else 409)
    if row.lease_version != body.lease_version:
        error("lease_changed")
    if operation == "abort":
        row.state = "aborted"
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    else:
        row.lease_version += 1; row.expires_at = database_now(db) + timedelta(minutes=30)
    db.flush()
    return result(db, row)


@atomic
def manifest(db, body, purpose):
    row, m = active(db, body, purpose)
    section, start = body.section, 0
    entries = m[section]
    scope = meta.h({"server_instance_id": body.server_instance_id, "owner_id": body.owner_id, "local_id": body.local_id,
        "actor_device_id": body.device_id, "operation_id": row.id, "metadata_manifest_digest": row.manifest_digest, "section": section})
    get_key = lambda e: e["descriptor"]["key"] if section == "S" else e["key"] if section == "P" else e["destination_key"]
    if body.cursor:
        try:
            cursor = read.decode(body.cursor)
            if set(cursor) != {"schema_version", "scope_digest", "section", "last_key"} or cursor["schema_version"] != 3 or cursor["section"] != section:
                error("invalid_cursor", 422)
            if cursor["scope_digest"] != scope:
                error("manifest_changed")
            start = next(i + 1 for i, e in enumerate(entries) if get_key(e) == cursor["last_key"])
        except (ValueError, KeyError, TypeError, StopIteration):
            error("invalid_cursor", 422)
    page = entries[start:start + body.limit]
    cursor = read.encode({"schema_version": 3, "scope_digest": scope, "section": section, "last_key": get_key(page[-1])}) if start + len(page) < len(entries) else None
    sections = ("S", "DSET", "P", "O", "existing", "verified_existing") if purpose == "mixed_note_write" else ("S", "DSET", "P", "O")
    return {"schema_version": 3, "metadata_header": {k: v for k, v in m.items() if k not in sections},
        "counts": counts(m), "set_digests": {k: meta.h(m[k]) for k in sections},
        "metadata_manifest_digest": row.manifest_digest, "section": section, "entries": page, "next_cursor": cursor}


def body_key(body):
    from app.schemas.note_crypto import RepresentationKey
    try:
        return RepresentationKey(kind=body.kind, id=body.representation_id, slot=body.slot).model_dump()
    except ValueError:
        error("invalid_representation_key", 422)


@atomic
def source(db, body, purpose):
    row, m = active(db, body, purpose)
    k = body_key(body)
    s = next((s for s in m["S"] if s["descriptor"]["key"] == k), None)
    if s is None:
        error("source_not_on_server", 404)
    if s["source_etag"] != body.source_etag:
        error("source_changed")
    value = next(v for key, _, v, _, _ in meta.slots(db, row.owner_id, row.local_id) if key == k)
    return {"schema_version": 3, "operation_id": row.id, "metadata_manifest_digest": row.manifest_digest,
        "entry_key": k, "source_etag": body.source_etag, "descriptor": s["descriptor"], **read.framed(value, body.chunk_index)}


def destination(db, body, purpose):
    gate()
    row, m = active(db, body, purpose)
    k = body.entry_key.model_dump() if hasattr(body, "entry_key") else body_key(body)
    d = next((d for d in m["DSET"] if d["destination_key"] == k), None)
    if d is None or d["is_null"] or d["output_epoch"] == 0:
        error("non_cipher_destination", 422)
    if body.source_etag != d["source_etag"] or body.target_epoch != d["output_epoch"]:
        error("manifest_changed")
    entry = db.get(NoteCryptoEntry, (row.id, meta.canonical(k)))
    if entry is None or (entry.source_etag, entry.output_kind, entry.representation_epoch, entry.binding_json) != (
        d["source_etag"], d["output_kind"], d["output_epoch"], meta.canonical(d["expected_binding"]) if d["expected_binding"] else None):
        error("manifest_changed")
    return row, d


@atomic
def upload(db, body, purpose):
    row, d = destination(db, body, purpose)
    try:
        data = base64.b64decode(body.data_base64, validate=True)
    except ValueError:
        error("invalid_chunk", 422)
    expected_size = min(262144, body.total_bytes - body.chunk_index * 262144)
    if body.chunk_index >= body.total_chunks or len(data) != expected_size or store.sha(data) != body.chunk_sha256:
        error("chunk_mismatch")
    kj = meta.canonical(d["destination_key"])
    u = db.get(NoteCryptoUpload, (row.id, kj))
    if u is None:
        u = NoteCryptoUpload(transition_id=row.id, key_json=kj, total_chunks=body.total_chunks, total_bytes=body.total_bytes)
        db.add(u); db.flush()
    if (u.total_chunks, u.total_bytes) != (body.total_chunks, body.total_bytes):
        error("chunk_mismatch")
    previous = db.get(NoteCryptoChunk, (row.id, kj, body.chunk_index))
    if previous:
        if previous.chunk_sha256 != body.chunk_sha256 or previous.data != data:
            error("chunk_mismatch")
    elif u.ciphertext_sha256 is not None:
        error("stage_mismatch")
    else:
        db.add(NoteCryptoChunk(transition_id=row.id, key_json=kj, chunk_index=body.chunk_index, chunk_sha256=body.chunk_sha256, data=data))
    row.state = "staging" if row.state == "prepared" else row.state
    return {"schema_version": 3, "operation_id": row.id, "entry_key": d["destination_key"], "source_etag": d["source_etag"],
            "target_epoch": d["output_epoch"], "chunk_index": body.chunk_index, "stored": True}


@atomic
def seal(db, body, purpose):
    row, d = destination(db, body, purpose)
    u = db.get(NoteCryptoUpload, (row.id, meta.canonical(d["destination_key"])))
    if u is None or (u.total_chunks, u.total_bytes) != (body.total_chunks, body.total_bytes):
        error("incomplete_manifest")
    raw = store.assembled(db, u)
    if store.sha(raw) != body.ciphertext_sha256 or (u.ciphertext_sha256 is not None and u.ciphertext_sha256 != body.ciphertext_sha256):
        error("stage_mismatch")
    store.validate_output(raw, d["output_kind"], d["output_epoch"], d["expected_binding"])
    u.ciphertext_sha256 = body.ciphertext_sha256
    db.flush()
    required = [v for v in fixed(row)["DSET"] if not v["is_null"] and v["output_epoch"] > 0]
    if all((saved := db.get(NoteCryptoUpload, (row.id, meta.canonical(v["destination_key"])))) is not None and saved.ciphertext_sha256 is not None for v in required):
        row.state = "ready"
    return {"schema_version": 3, "operation_id": row.id, "entry_key": d["destination_key"], "source_etag": d["source_etag"],
        "target_epoch": d["output_epoch"], "total_chunks": u.total_chunks, "total_bytes": u.total_bytes,
        "ciphertext_sha256": u.ciphertext_sha256, "sealed": True}


@atomic
def staged(db, body, purpose):
    row, d = destination(db, body, purpose)
    u = db.get(NoteCryptoUpload, (row.id, meta.canonical(d["destination_key"])))
    if u is None or u.ciphertext_sha256 is None:
        error("incomplete_manifest")
    chunk = db.get(NoteCryptoChunk, (row.id, u.key_json, body.chunk_index))
    if chunk is None:
        error("chunk_out_of_range", 416)
    if store.sha(chunk.data) != chunk.chunk_sha256:
        error("stage_mismatch")
    return {"schema_version": 3, "operation_id": row.id, "metadata_manifest_digest": row.manifest_digest,
        "entry_key": d["destination_key"], "source_etag": d["source_etag"], "target_epoch": d["output_epoch"], "output_kind": d["output_kind"],
        "total_bytes": u.total_bytes, "total_chunks": u.total_chunks, "ciphertext_sha256": u.ciphertext_sha256,
        "chunk_index": body.chunk_index, "data_base64": base64.b64encode(chunk.data).decode()}


def mode_origin(row):
    m = fixed(row)
    return {"purpose": CP, "operation_id": row.id, "mutation_id": row.mutation_id,
        "source_inventory_ref": m["selection"]["inventory_revision_ref"],
        "selected_physical_note_id": m["selection"]["physical_note_id"], "target_current_mode": "plain"}


def verify_live(db, row, k, raw, side):
    from app.models.note_crypto import NoteRepresentationOrigin
    m = fixed(row)
    r = json.loads(row.receipt_json)
    o = next((o for o in m["O"] if o["destination_key"] == k), None)
    d = next((d for d in m["DSET"] if d["destination_key"] == k), None)
    if (row.state != "committed" or r.get("metadata_manifest_digest") != row.manifest_digest or r.get("origin_expectations_digest") != meta.h(m["O"])
        or o is None or d is None or o["storage_operation_id"] != row.id or o["is_null"] != (raw is None)
        or (side.representation_kind, side.representation_epoch, side.origin_validator, side.semantic_origin_id) != (
            d["output_kind"], d["output_epoch"], o["origin_validator"], o["semantic_origin_id"])):
        error("inconsistent_history")
    if o["origin_row_required"]:
        stored = db.get(NoteRepresentationOrigin, (row.owner_id, row.local_id, meta.canonical(k)))
        if stored is None or stored.semantic_origin_id != o["semantic_origin_id"]:
            error("inconsistent_history")
    if o["semantic_origin_id"] is not None:
        from app.services.note_operation_origin import operation
        operation(db, o["semantic_origin_id"], row.owner_id, row.local_id)
    if o["origin_validator"] == "linked_v1":
        from app.models.note_related import LinkedText
        linked = db.get(LinkedText, (row.owner_id, row.local_id, meta.canonical(k)))
        source = next((s["descriptor"] for s in m["S"] if s["descriptor"]["key"] == k), None)
        if (linked is None or source is None or linked.storage_operation_id != row.id
            or linked.slot_version != source["linked_slot_version"] + 1 or linked.is_null != (raw is None)):
            error("inconsistent_related_text")
    if raw is not None and d["output_epoch"] > 0:
        u = db.get(NoteCryptoUpload, (row.id, meta.canonical(k)))
        if u is None or u.ciphertext_sha256 != store.sha(raw.encode()):
            error("inconsistent_history")
        store.validate_output(raw.encode(), d["output_kind"], d["output_epoch"], d["expected_binding"])
    if raw is not None and d["output_kind"] == "snapshot_v1":
        from app.schemas.note_v2 import Snapshot
        snapshot = Snapshot.model_validate_json(raw).note
        if (snapshot.owner_id, snapshot.local_id) != (row.owner_id, row.local_id):
            error("inconsistent_history")
    if k["kind"] == "note_body":
        from app.models.note_mixed import MixedSlot
        from app.models.note_history import NoteInventory
        from app.models.note import Note
        from app.services.note_history import raw_snapshot, encoded
        inv = db.get(NoteInventory, (row.owner_id, row.local_id, int(k["id"])))
        inv_side = db.get(MixedSlot, (row.owner_id, row.local_id, meta.canonical(meta.key("inventory_snapshot", k["id"], "current"))))
        if inv is None or inv_side is None or (inv_side.storage_operation_id, inv_side.representation_epoch) != (side.storage_operation_id, side.representation_epoch):
            error("inconsistent_history")
        if side.representation_epoch == 0:
            note = db.get(Note, int(k["id"]))
            if note is None or json.loads(inv.snapshot_json) != json.loads(encoded(raw_snapshot(note))):
                error("inconsistent_history")


def install_slots(db, row, m):
    from app.models.note_mixed import MixedScope, MixedSlot
    from app.models.note_crypto import NoteRepresentationOrigin
    scope = db.get(MixedScope, (row.owner_id, row.local_id))
    if scope is None:
        error("inconsistent_history")
    origins = {meta.canonical(o["destination_key"]): o for o in m["O"]}
    for d in m["DSET"]:
        kj = meta.canonical(d["destination_key"]); o = origins[kj]
        side = db.get(MixedSlot, (row.owner_id, row.local_id, kj))
        if side is None:
            side = MixedSlot(owner_id=row.owner_id, local_id=row.local_id, key_json=kj, cohort_id=scope.cohort_id, representation_version=1)
            db.add(side)
        else:
            side.representation_version += 1
        side.representation_etag = str(uuid4())
        side.representation_kind, side.representation_epoch, side.is_null = d["output_kind"], d["output_epoch"], d["is_null"]
        side.storage_operation_id, side.semantic_origin_id, side.origin_validator = row.id, o["semantic_origin_id"], o["origin_validator"]
        if o["origin_row_required"]:
            origin = db.get(NoteRepresentationOrigin, (row.owner_id, row.local_id, kj))
            if origin is None:
                origin = NoteRepresentationOrigin(owner_id=row.owner_id, local_id=row.local_id, key_json=kj)
                db.add(origin)
            origin.semantic_origin_id = o["semantic_origin_id"]
    db.flush()


def publish_plain(db, row, m, body, values):
    from app.models.note import Note
    from app.models.note_history import NoteInventory, NoteRevision
    from app.services.note_history import encoded, raw_snapshot
    from app.services.note_protected_write import parsed
    note = db.get(Note, m["selection"]["physical_note_id"])
    original = json.loads(encoded(raw_snapshot(note)))["note"]
    incoming = body.plain_current.model_dump()
    if any(incoming[k] != original[k] for k in original if k != "content") or any(incoming[k] != v for k, v in m["server_fields"].items()):
        error("projection_mismatch")
    after = meta.canonical({"schema_version": 1, "note": incoming})
    before_key = meta.key("revision_before", m["revision_ref"]["id"], "before")
    before = values[meta.canonical(before_key)]
    db.execute(Note.__table__.update().where(Note.id == note.id, Note.owner_id == row.owner_id, Note.local_id == row.local_id).values(
        content=incoming["content"], updated_at=note.updated_at, client_updated_at=note.client_updated_at))
    db.add(NoteRevision(id=m["revision_ref"]["id"], owner_id=row.owner_id, local_id=row.local_id, note_id=note.id,
        parent_revision_id=m["parent_ref"]["id"], reason=CP, captured_at=row.created_at, snapshot_json=after,
        before_snapshot_json=before, representation_kind="snapshot_v1", representation_epoch=0))
    inv = db.get(NoteInventory, (row.owner_id, row.local_id, note.id))
    inv.snapshot_json, inv.revision_id, inv.representation_kind, inv.representation_epoch = after, m["revision_ref"]["id"], "snapshot_v1", 0
    head = db.get(NoteHead, (row.owner_id, row.local_id))
    head.head_revision_id, head.current_mode = m["revision_ref"]["id"], "plain"
    db.flush(); db.expire(note)


def publish_conversion(db, row, m, values):
    from app.models.note import Note, AnalysisJob, Recording
    from app.models.note_history import NoteRevision, NoteInventory
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_related import LinkedText
    from app.services.related_text import SLOTS
    reservations = {r["revision_id"]: r for r in m["reserved_branches"]}
    for d in m["DSET"]:
        k = d["destination_key"]; kind, ident = k["kind"], k["id"]
        raw = None if d["is_null"] else values[meta.canonical(k)]
        if kind == "note_body":
            note = db.get(Note, int(ident))
            db.execute(Note.__table__.update().where(Note.id == note.id, Note.owner_id == row.owner_id, Note.local_id == row.local_id).values(content=raw, updated_at=note.updated_at, client_updated_at=note.client_updated_at))
            db.expire(note)
        elif kind in ("revision_snapshot", "revision_before"):
            target = db.get(NoteRevision, ident)
            if kind == "revision_snapshot":
                target.snapshot_json, target.representation_kind, target.representation_epoch = raw, d["output_kind"], d["output_epoch"]
            else:
                target.before_snapshot_json = raw
        elif kind == "inventory_snapshot":
            target = db.get(NoteInventory, (row.owner_id, row.local_id, int(ident)))
            target.snapshot_json, target.representation_kind, target.representation_epoch = raw, d["output_kind"], d["output_epoch"]
        elif kind == "offline_snapshot":
            target = db.get(NoteOfflineBranch, ident)
            if target is None:
                b = reservations[ident]; p = b["parent_ref"]
                target = NoteOfflineBranch(id=ident, owner_id=row.owner_id, local_id=row.local_id, parent_kind=p["kind"] if p else None,
                    parent_id=p["id"] if p else None, origin_device_id=b["origin_device_id"], captured_at=row.created_at)
                db.add(target)
            target.snapshot_json, target.representation_kind, target.representation_epoch = raw, d["output_kind"], d["output_epoch"]
        else:
            model, field = SLOTS[kind]
            target = db.get(model, int(ident))
            db.execute(model.__table__.update().where(model.id == int(ident), model.owner_id == row.owner_id, model.note_local_id == row.local_id).values(**{field: raw, "updated_at": target.updated_at}))
            db.expire(target)
            linked = db.get(LinkedText, (row.owner_id, row.local_id, meta.canonical(k)))
            linked.representation_kind, linked.representation_epoch, linked.storage_operation_id = d["output_kind"], d["output_epoch"], row.id
            linked.is_null = d["is_null"]; linked.slot_version += 1
    head = db.get(NoteHead, (row.owner_id, row.local_id))
    head.crypto_epoch, head.current_mode = m["target_epoch"], m["target_current_mode"]
    if not m["base"]["base"]["current_exists"] and reservations:
        head.identity_state = "branch_only"
    db.flush()


@atomic
def commit(db, body, purpose):
    gate()
    row = own(db, body, purpose); m = fixed(row)
    core = body.model_dump(exclude={"plain_current"})
    if row.state == "committed":
        return replay(db, row, body, core)
    if row.state == "stale":
        return failed(db, row, json.loads(row.conditions_json).get("failure_code", "version_conflict"))
    row, m = active(db, body, purpose)
    if body.lease_version != row.lease_version:
        error("lease_changed")
    if body.mutation_id != row.mutation_id or body.base.model_dump() != m["base"]:
        error("version_conflict")
    if purpose == RC and body.target_epoch != m["target_epoch"]:
        error("crypto_epoch_changed")
    required = [d for d in m["DSET"] if not d["is_null"] and d["output_epoch"] > 0]
    entries = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
    if {e.key_json for e in entries} != {meta.canonical(d["destination_key"]) for d in required}:
        error("manifest_changed")
    values, records = {}, []
    for d in required:
        k = d["destination_key"]; kj = meta.canonical(k)
        e = db.get(NoteCryptoEntry, (row.id, kj))
        if (e.source_etag, e.output_kind, e.representation_epoch, e.binding_json) != (d["source_etag"], d["output_kind"], d["output_epoch"], meta.canonical(d["expected_binding"]) if d["expected_binding"] else None):
            error("manifest_changed")
        u = db.get(NoteCryptoUpload, (row.id, kj))
        if u is None or u.ciphertext_sha256 is None:
            error("incomplete_manifest")
        raw = store.assembled(db, u)
        if store.sha(raw) != u.ciphertext_sha256:
            error("stage_mismatch")
        store.validate_output(raw, d["output_kind"], d["output_epoch"], d["expected_binding"])
        values[kj] = raw.decode()
        records.append({"entry_key": k, "destination_key": k, "source_etag": d["source_etag"], "output_kind": d["output_kind"],
            "target_epoch": d["output_epoch"], "total_bytes": len(raw), "ciphertext_sha256": store.sha(raw)})
    if meta.h(records) != body.client_verified_ciphertext_manifest_digest:
        error("verification_manifest_mismatch")
    from app.models.note_related import RelatedDrain
    from app.services.related_drain import result as drain_result
    drainer = db.get(RelatedDrain, m["drain_ref"]["drain_id"])
    if (drainer is None or (drainer.owner_id, drainer.local_id, drainer.state, drainer.transition_id, drainer.drain_version) !=
        (row.owner_id, row.local_id, "promoted", row.id, m["drain_ref"]["drain_version"]) or drain_result(db, drainer)["pending_count"] != 0):
        error("drain_changed")
    try:
        return publish(db, row, m, body, values, core, records)
    except IntegrityError as exc:
        unique = getattr(exc.orig, "sqlstate", None) == "23505" or getattr(exc.orig, "sqlite_errorcode", None) in (1555, 2067)
        if not unique:
            raise
        db.rollback()
        prep.authenticate_actor(db, body.owner_id, body.device_id)
        db.expire_all()
        row = own(db, body, purpose)
        if row.state == "committed":
            return replay(db, row, body, core)
        if row.state == "expired":
            raise Expired(row)
        if row.state in ("stale", "aborted"):
            return failed(db, row, json.loads(row.conditions_json).get("failure_code", "operation_not_active"))
        row, fresh = active(db, body, purpose)
        if fresh != m or body.base.model_dump() != fresh["base"] or row.manifest_digest != body.metadata_manifest_digest:
            error("version_conflict")
        row.state = "stale"
        conditions = json.loads(row.conditions_json)
        conditions["failure_code"] = "revision_id_conflict"
        row.conditions_json = meta.canonical(conditions)
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
        return failed(db, row, "revision_id_conflict")


def failed(db, row, code):
    return {"http_status": 409, "detail": {"code": code, "required_schema_version": None}, "operation": result(db, row)}


def replay(db, row, body, core):
    if json.loads(row.commit_conditions_json) != core:
        error("idempotency_mismatch")
    if row.purpose == CP:
        from app.models.note_history import NoteRevision
        m = fixed(row)
        saved = db.get(NoteRevision, m["revision_ref"]["id"])
        if saved is None:
            error("inconsistent_history")
        if saved.representation_kind != "snapshot_v1":
            error("replay_payload_requires_status")
        if json.loads(saved.snapshot_json)["note"] != body.plain_current.model_dump():
            error("idempotency_mismatch")
    return result(db, row)


def publish(db, row, m, body, values, core, records):
    meta.begin_update(db, row.owner_id, row.local_id)
    if row.purpose == CP:
        publish_plain(db, row, m, body, values)
    else:
        publish_conversion(db, row, m, values)
    install_slots(db, row, m)
    head = db.get(NoteHead, (row.owner_id, row.local_id))
    head.version += 1; head.history_generation += 1
    row.state, row.commit_conditions_json = "committed", meta.canonical(core)
    db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
    current = latest(db, row.owner_id, row.local_id, row.actor_device_id, m["server_instance_id"])
    b3 = {k: current[k] for k in ("base", "current_mode", "selected_physical_note_id", "mixed_metadata_version")}
    row.receipt_json = meta.canonical({"schema_version": 3, "purpose": row.purpose, "operation_id": row.id, "mutation_id": row.mutation_id,
        "server_instance_id": m["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id, "result": b3,
        "metadata_manifest_digest": row.manifest_digest, "counts": counts(m), "set_digests": {k: meta.h(m[k]) for k in ("S", "DSET", "P", "O")},
        "applied_counts": counts(m)["DSET"], "client_verified_ciphertext_manifest_digest": meta.h(records),
        "origin_expectations_digest": meta.h(m["O"]), "committed_at": database_now(db).isoformat(timespec="microseconds") + "Z"})
    db.flush()
    db.info.get(meta.UPDATING, set()).discard((row.owner_id, row.local_id))
    return result(db, row)
