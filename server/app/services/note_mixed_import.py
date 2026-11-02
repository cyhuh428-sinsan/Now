"""Typed offline branches: immutable source provenance and disjoint C/V3 sets."""
import json
from datetime import timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import object_session
from fastapi import HTTPException

from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence
from app.models.note_history import NoteRevision
from app.models.note_v2 import NoteOfflineBranch
from app.services import note_crypto as prep, note_crypto_storage as store
from app.services import note_mixed_metadata as meta, note_mixed_operations as ops, note_mixed_read as read
from app.services.note_crypto_fence import error, require_unfenced, database_now, expire
from app.services.note_protected_write import date

PURPOSE = "mixed_offline_import"
SECTIONS = ("S", "DSET", "P", "O", "existing", "verified_existing")


def branch_key(ident):
    return meta.key("offline_snapshot", ident, "snapshot")


def branch_ref(ident):
    return {"kind": "offline_branch", "id": ident}


def fixed(row):
    from app.schemas.note_mixed import MixedImportPrepare
    try:
        c = json.loads(row.conditions_json)
        m, request = c["M0"], c["request"]
        parsed = MixedImportPrepare.model_validate(request).model_dump()
        if (parsed != request or type(m["schema_version"]) is not int or m["schema_version"] != 3 or m["purpose"] != PURPOSE
            or m["operation_id"] != row.id or m["mutation_id"] != row.mutation_id or m["actor_device_id"] != row.actor_device_id
            or any(parsed[f] != m[f] for f in ("owner_id", "local_id", "mutation_id", "server_instance_id"))
            or (m["owner_id"], m["local_id"], parsed["device_id"]) != (row.owner_id, row.local_id, row.actor_device_id)
            or m["base"] != parsed["base"] or m["source_catalog_digest"] != parsed["expected_catalog_digest"]
            or m["control"] != {"entries": parsed["entries"]} or m["target_epoch"] != m["base"]["base"]["crypto_epoch"]
            or any(m[k] is not None for k in ("revision_ref", "parent_ref", "server_fields")) or meta.h(m) != row.manifest_digest):
            error("inconsistent_history")
        if meta.h({"server_instance_id": m["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id,
            "context": m["base"], "entries": [s["descriptor"] for s in m["S"]]}) != m["source_catalog_digest"]:
            error("inconsistent_history")
        if m["P"] != [s["descriptor"] for s in m["S"]] or m["operation_origin"] != {
            "purpose": PURPOSE, "operation_id": row.id, "mutation_id": row.mutation_id, "entries": parsed["entries"]}:
            error("inconsistent_history")
        validate_sets(c, m, row)
        db = object_session(row)
        if db is None:
            error("inconsistent_history")
        existing_keys = {e["revision_id"] for e in m["existing"]}
        prepared = MixedImportPrepare.model_validate(request)
        for entry in prepared.entries:
            provenance(db, prepared, entry, True if entry.revision_id in existing_keys else None,
                frozen_sources=[s["descriptor"] for s in m["S"]])
        return m
    except HTTPException:
        error("inconsistent_history")
    except (ValueError, TypeError, KeyError):
        error("inconsistent_history")


def validate_sets(c, m, row):
    from app.schemas.note_mixed import MixedDescriptor
    entries = c["request"]["entries"]
    ids = [e["revision_id"] for e in entries]
    if ids != sorted(set(ids)):
        error("inconsistent_history")
    source = {meta.canonical(d["key"]): d for d in m["P"]}
    if len(source) != len(m["P"]) or any(MixedDescriptor.model_validate(d).model_dump() != d for d in m["P"]):
        error("inconsistent_history")
    known_parents = {meta.canonical(d["revision_ref"]) for d in m["P"]
        if d["key"]["kind"] in ("revision_snapshot", "offline_snapshot")}
    batch = {e["revision_id"]: e for e in entries}
    done = set()
    for ident in batch:
        path, node = set(), ident
        while node is not None and node not in done:
            if node in path:
                error("inconsistent_history")
            path.add(node)
            parent = batch[node]["parent_ref"]
            if parent is None:
                node = None
            elif parent["kind"] == "offline_branch" and parent["id"] in batch:
                node = parent["id"]
            elif meta.canonical(parent) in known_parents:
                node = None
            else:
                error("inconsistent_history")
        done.update(path)
    signatures = {s["fields"]["id"]: s["fields"] for s in c["source_row_signatures"] if s["table"] == NoteOfflineBranch.__tablename__}
    outputs, existing, expectations, verified_ids = [], [], [], []
    actual_d = {meta.canonical(d["destination_key"]): d for d in m["DSET"]}
    if len(actual_d) != len(m["DSET"]):
        error("inconsistent_history")
    for d in m["P"]:
        expectations.append({"destination_key": d["key"], **{f: d[f] for f in ("is_null", "origin_validator", "origin_row_required", "storage_operation_id", "semantic_origin_id")}})
    for entry in entries:
        key = branch_key(entry["revision_id"]); kj = meta.canonical(key)
        old = source.get(kj)
        if (entry["source_kind"] == "snapshot_v1") != (entry["source_epoch"] == 0) or (
            entry["target_epoch"] != (0 if entry["target_kind"] == "snapshot_v1" else m["target_epoch"])):
            error("inconsistent_history")
        if entry["source_kind"] == "history_envelope_v1" and entry["target_kind"] == "snapshot_v1":
            error("inconsistent_history")
        ip = entry["provenance"]
        if (ip["origin_owner_id"], ip["origin_server_instance_id"]) != (row.owner_id, m["server_instance_id"]):
            error("inconsistent_history")
        if old is not None:
            sig = signatures.get(entry["revision_id"])
            parent = {"kind": sig["parent_kind"], "id": sig["parent_id"]} if sig and sig["parent_id"] else None
            if (sig is None or entry["expected_existing"] != old or entry["origin_device_id"] != sig["origin_device_id"]
                or entry["parent_ref"] != parent or old["is_null"] or (entry["source_kind"], entry["source_epoch"], entry["target_kind"], entry["target_epoch"]) !=
                (old["representation_kind"], old["representation_epoch"], old["representation_kind"], old["representation_epoch"])):
                error("inconsistent_history")
            if ip["kind"] == "cipher_branch" and ip["origin_storage_operation_id"] is not None and ip["origin_storage_operation_id"] != old["storage_operation_id"]:
                error("inconsistent_history")
            if ip["kind"] == "plain_branch" and ip["origin_revision_ref"] is not None and ip["origin_revision_ref"] != old["revision_ref"]:
                error("inconsistent_history")
            existing.append({"revision_id": entry["revision_id"], "descriptor": old, "comparison": "plain_exact" if old["representation_epoch"] == 0 else "cipher_exact"})
            verified_ids.append(entry["revision_id"])
        else:
            if entry["expected_existing"] is not None or entry["target_epoch"] == 0 and (
                ip["kind"] != "post_plain_draft" or m["base"]["current_mode"] != "plain"):
                error("inconsistent_history")
            d = actual_d.get(kj)
            if d is None or str(UUID(d["source_etag"])) != d["source_etag"]:
                error("inconsistent_history")
            expected_binding = ops.binding(row.owner_id, row.local_id, m["server_instance_id"], row.id, entry["target_epoch"],
                key, branch_ref(entry["revision_id"]), entry["parent_ref"]) if entry["target_epoch"] else None
            outputs.append({"destination_key": key, "source_keys": [], "source_etag": d["source_etag"],
                "output_kind": entry["target_kind"], "output_epoch": entry["target_epoch"], "is_null": False, "expected_binding": expected_binding})
            expectations.append({"destination_key": key, "is_null": False, "origin_validator": "native_mixed_v1", "origin_row_required": True,
                "storage_operation_id": row.id, "semantic_origin_id": row.id})
    if (m["DSET"] != outputs or m["existing"] != existing
        or m["O"] != sorted(expectations, key=lambda e: store.key_order(e["destination_key"]))
        or [v["key"]["id"] for v in m["verified_existing"]] != verified_ids):
        error("inconsistent_history")
    by_id = {e["revision_id"]: e for e in entries}
    for v in m["verified_existing"]:
        entry = by_id[v["key"]["id"]]; d = source[meta.canonical(v["key"])]
        expectation = next(o for o in expectations if o["destination_key"] == v["key"])
        size = v["total_bytes"]
        if d["representation_epoch"]:
            if type(size) is not int or size < 1 or type(v["total_chunks"]) is not int or v["total_chunks"] != (size+262143)//262144:
                error("inconsistent_history")
        elif size is not None or v["total_chunks"] is not None:
            error("inconsistent_history")
        if v != {"key": branch_key(entry["revision_id"]), "revision_ref": branch_ref(entry["revision_id"]),
            "parent_ref": entry["parent_ref"], "origin_device_id": entry["origin_device_id"], "descriptor": d,
            "origin_expectation": expectation, "total_bytes": size, "total_chunks": v["total_chunks"],
            "expected_binding": d["expected_binding"], "ciphertext_sha256": d["ciphertext_sha256"]}:
            error("inconsistent_history")


def result(db, row):
    m = fixed(row)
    latest = read.context(db, row.owner_id, row.local_id, row.actor_device_id, m["server_instance_id"])
    return {"schema_version": 3, "purpose": PURPOSE, "operation_id": row.id, "mutation_id": row.mutation_id,
        "state": "uploading" if row.state in ("staging", "ready") else row.state,
        "lease_version": row.lease_version, "expires_at": date(row.expires_at), "metadata_manifest_digest": row.manifest_digest,
        "metadata_header": {k: v for k, v in m.items() if k not in SECTIONS}, "counts": ops.counts(m),
        "receipt": json.loads(row.receipt_json) if row.receipt_json else None, "latest_context": latest["context"]}


def parents(db, body):
    entries = {e.revision_id: e for e in body.entries}
    for entry in body.entries:
        p = entry.parent_ref
        if p is None:
            continue
        if p.kind == "offline_branch" and p.id in entries:
            continue
        model = NoteRevision if p.kind == "note_revision" else NoteOfflineBranch
        row = db.get(model, p.id)
        if row is None or (row.owner_id, row.local_id) != (body.owner_id, body.local_id):
            error("parent_not_found", 404)
    done = set()
    for ident in entries:
        path, node = set(), ident
        while node is not None and node not in done:
            if node in path:
                error("invalid_branch_graph", 422)
            path.add(node)
            p = entries[node].parent_ref
            node = p.id if p is not None and p.kind == "offline_branch" and p.id in entries else None
        done.update(path)


def provenance(db, body, entry, existing, *, frozen_sources=None):
    ip = entry.provenance
    if (ip.origin_owner_id, ip.origin_server_instance_id) != (body.owner_id, body.server_instance_id):
        error("foreign_import_requires_remap", 422)
    if (entry.source_kind == "snapshot_v1") != (entry.source_epoch == 0):
        error("invalid_source_representation", 422)
    if entry.source_kind == "history_envelope_v1" and entry.target_kind == "snapshot_v1":
        error("historical_cipher_plain_forbidden", 422)
    if entry.target_epoch != (0 if entry.target_kind == "snapshot_v1" else body.base.base.crypto_epoch):
        error("crypto_epoch_changed")
    if entry.source_kind == "history_envelope_v1" and ip.kind != "cipher_branch" or entry.source_kind == "snapshot_v1" and ip.kind == "cipher_branch":
        error("invalid_import_provenance", 422)
    if existing is None and (ip.kind == "cipher_branch" and ip.origin_storage_operation_id is not None
        or ip.kind == "plain_branch" and ip.origin_revision_ref is not None):
        error("invalid_import_provenance", 422)
    if existing is not None:
        if frozen_sources is not None:
            descriptor = next((d for d in frozen_sources if d["key"] == branch_key(entry.revision_id)), None)
            if descriptor is None:
                error("inconsistent_history")
            storage_id = descriptor["storage_operation_id"]
        else:
            from app.models.note_mixed import MixedSlot
            side = db.get(MixedSlot, (body.owner_id, body.local_id, meta.canonical(branch_key(entry.revision_id))))
            if side is None:
                error("inconsistent_history")
            storage_id = side.storage_operation_id
        if ip.kind == "cipher_branch" and ip.origin_storage_operation_id is not None and ip.origin_storage_operation_id != storage_id:
            error("existing_representation_changed")
        if ip.kind == "plain_branch" and ip.origin_revision_ref is not None and ip.origin_revision_ref.model_dump() != branch_ref(entry.revision_id):
            error("existing_representation_changed")
    if ip.kind == "post_plain_draft":
        mode = db.get(NoteCryptoTransition, ip.mode_operation_id)
        if (mode is None or (mode.owner_id, mode.local_id, mode.purpose, mode.state) !=
            (body.owner_id, body.local_id, ops.CP, "committed") or mode.receipt_json is None
            or meta.h(json.loads(mode.receipt_json)) != ip.mode_receipt_digest):
            error("invalid_import_provenance", 422)
        cm = ops.fixed(mode)
        from app.services.note_operation_origin import operation
        operation(db, mode.id, body.owner_id, body.local_id)
        if cm["server_instance_id"] != body.server_instance_id or json.loads(mode.receipt_json)["result"]["current_mode"] != "plain":
            error("invalid_import_provenance", 422)
        if existing is None and entry.target_kind == "snapshot_v1":
            if body.base.current_mode != "plain":
                error("plain_draft_context_changed")
            descriptors = frozen_sources if frozen_sources is not None else read.descriptors(db, body.owner_id, body.local_id)
            live = next(d for d in descriptors if d["key"] == meta.key(
                "inventory_snapshot", body.base.selected_physical_note_id, "current"))
            seen, ident = set(), live["storage_operation_id"]
            while ident != mode.id:
                if ident in seen:
                    error("inconsistent_history")
                seen.add(ident)
                prior = db.get(NoteCryptoTransition, ident)
                if prior is None or prior.purpose != "mixed_note_write" or prior.state != "committed":
                    error("plain_draft_context_changed")
                pm = ops.fixed(prior)
                operation(db, prior.id, body.owner_id, body.local_id)
                if (pm["owner_id"], pm["local_id"], pm["base"]["current_mode"], pm["control"]["target_current_mode"]) != (
                    body.owner_id, body.local_id, "plain", "plain") or pm["control"]["selection"] is None:
                    error("plain_draft_context_changed")
                physical = pm["control"]["selection"]["physical_note_id"]
                ident = next(s["descriptor"]["storage_operation_id"] for s in pm["S"] if s["descriptor"]["key"] == meta.key("inventory_snapshot", physical, "current"))
            if cm["selection"]["physical_note_id"] != body.base.selected_physical_note_id:
                error("plain_draft_context_changed")
    elif existing is None and entry.target_kind == "snapshot_v1":
        error("plain_draft_provenance_required", 422)


@ops.atomic
def prepare(db, body):
    prep.authenticate_actor(db, body.owner_id, body.device_id)
    if prep.initialize_identity(db.connection()) != body.server_instance_id:
        error("server_instance_changed")
    ops.gate()
    old = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id,
        NoteCryptoTransition.mutation_id == body.mutation_id))
    if old is not None:
        if old.purpose != PURPOSE or old.actor_device_id != body.device_id or json.loads(old.conditions_json)["request"] != body.model_dump():
            error("idempotency_mismatch")
        expire(db, old)
        return {"created": False, **result(db, old)}
    require_unfenced(db, [(body.owner_id, body.local_id)])
    from app.services.related_text import active_drain
    if active_drain(db, body.owner_id, body.local_id) is not None:
        error("related_drain_in_progress", 423)
    current = read.context(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id)
    if current["context"] != body.base.model_dump() or current["catalog_digest"] != body.expected_catalog_digest:
        error("context_changed")
    ids = [e.revision_id for e in body.entries]
    if ids != sorted(set(ids)):
        error("invalid_request", 422)
    parents(db, body)
    sources = read.descriptors(db, body.owner_id, body.local_id)
    raw = {meta.canonical(k): value for k, _, value, _, _ in meta.slots(db, body.owner_id, body.local_id)}
    ident = str(uuid4())
    m = {"schema_version": 3, "purpose": PURPOSE, "operation_id": ident, "server_instance_id": body.server_instance_id,
        "owner_id": body.owner_id, "local_id": body.local_id, "actor_device_id": body.device_id, "mutation_id": body.mutation_id,
        "base": body.base.model_dump(), "source_catalog_digest": current["catalog_digest"], "target_epoch": body.base.base.crypto_epoch,
        "revision_ref": None, "parent_ref": None, "server_fields": None, "control": {"entries": [e.model_dump() for e in body.entries]},
        "operation_origin": {"purpose": PURPOSE, "operation_id": ident, "mutation_id": body.mutation_id, "entries": [e.model_dump() for e in body.entries]},
        "S": [{"descriptor": d, "source_etag": str(uuid4())} for d in sources], "DSET": [], "P": sources, "O": [], "existing": [], "verified_existing": []}
    m["O"] = [{"destination_key": d["key"], **{f: d[f] for f in ("is_null", "origin_validator", "origin_row_required", "storage_operation_id", "semantic_origin_id")}} for d in sources]
    for entry in body.entries:
        k = branch_key(entry.revision_id)
        old = db.get(NoteOfflineBranch, entry.revision_id)
        if old is not None and (old.owner_id, old.local_id) != (body.owner_id, body.local_id):
            error("revision_id_conflict")
        provenance(db, body, entry, old)
        if old is not None:
            d = next(d for d in sources if d["key"] == k)
            parent = {"kind": old.parent_kind, "id": old.parent_id} if old.parent_id else None
            if (entry.expected_existing is None or entry.expected_existing.model_dump() != d or entry.origin_device_id != old.origin_device_id
                or (entry.parent_ref.model_dump() if entry.parent_ref else None) != parent
                or (entry.source_kind, entry.source_epoch, entry.target_kind, entry.target_epoch) !=
                (d["representation_kind"], d["representation_epoch"], d["representation_kind"], d["representation_epoch"])):
                error("existing_representation_changed")
            m["existing"].append({"revision_id": entry.revision_id, "descriptor": d,
                "comparison": "plain_exact" if entry.target_epoch == 0 else "cipher_exact"})
            expectation = next(o for o in m["O"] if o["destination_key"] == k)
            data = raw[meta.canonical(k)].encode() if entry.target_epoch else None
            m["verified_existing"].append({"key": k, "revision_ref": branch_ref(entry.revision_id), "parent_ref": parent,
                "origin_device_id": old.origin_device_id, "descriptor": d, "origin_expectation": expectation,
                "total_bytes": len(data) if data is not None else None,
                "total_chunks": (len(data) + 262143)//262144 if data is not None else None,
                "expected_binding": d["expected_binding"], "ciphertext_sha256": store.sha(data) if data is not None else None})
        else:
            if entry.expected_existing is not None:
                error("existing_representation_changed")
            binding = ops.binding(body.owner_id, body.local_id, body.server_instance_id, ident, entry.target_epoch,
                k, branch_ref(entry.revision_id), entry.parent_ref.model_dump() if entry.parent_ref else None) if entry.target_epoch else None
            m["DSET"].append(ops.output(k, [], entry.target_kind, entry.target_epoch, False, binding))
            m["O"].append({"destination_key": k, "is_null": False, "origin_validator": "native_mixed_v1", "origin_row_required": True,
                "storage_operation_id": ident, "semantic_origin_id": ident})
    m["O"].sort(key=lambda e: store.key_order(e["destination_key"]))
    stamp = database_now(db)
    row = NoteCryptoTransition(id=ident, owner_id=body.owner_id, local_id=body.local_id, actor_device_id=body.device_id,
        mutation_id=body.mutation_id, purpose=PURPOSE, state="prepared", lease_version=1, created_at=stamp,
        expires_at=stamp+timedelta(minutes=30), manifest_digest=meta.h(m), conditions_json=meta.canonical({
            "request": body.model_dump(), "M0": m, "source_row_signatures": ops.row_signatures(db, body.owner_id, body.local_id)}))
    db.add(row); db.flush()
    for d in m["DSET"]:
        if d["output_epoch"]:
            db.add(NoteCryptoEntry(transition_id=ident, key_json=meta.canonical(d["destination_key"]), source_etag=d["source_etag"],
                source_kind="client_pending", output_kind=d["output_kind"], representation_epoch=d["output_epoch"],
                binding_json=meta.canonical(d["expected_binding"])))
    db.add(NoteCryptoFence(owner_id=body.owner_id, local_id=body.local_id, transition_id=ident)); db.flush()
    return {"created": True, **result(db, row)}


def plain_ids(m):
    return sorted([d["destination_key"]["id"] for d in m["DSET"] if d["output_epoch"] == 0] +
        [x["revision_id"] for x in m["existing"] if x["comparison"] == "plain_exact"])


def replay(db, row, body):
    core = body.model_dump(exclude={"plain_entries"})
    if json.loads(row.commit_conditions_json) != core:
        error("idempotency_mismatch")
    m = fixed(row)
    if [e.revision_id for e in body.plain_entries] != plain_ids(m):
        error("idempotency_mismatch")
    for entry in body.plain_entries:
        stored = db.get(NoteOfflineBranch, entry.revision_id)
        if stored is None or (stored.owner_id, stored.local_id) != (row.owner_id, row.local_id):
            error("inconsistent_history")
        if stored.representation_kind != "snapshot_v1":
            error("replay_payload_requires_status")
        if json.loads(stored.snapshot_json)["note"] != entry.snapshot.model_dump():
            error("idempotency_mismatch")
    return result(db, row)


def verified_existing(db, row, m):
    descriptors = {meta.canonical(d["key"]): d for d in read.descriptors(db, row.owner_id, row.local_id)}
    raw = {meta.canonical(k): value for k, _, value, _, _ in meta.slots(db, row.owner_id, row.local_id)}
    verified = []
    for expected in m["verified_existing"]:
        key = expected["key"]; kj = meta.canonical(key)
        d = descriptors.get(kj)
        branch = db.get(NoteOfflineBranch, key["id"])
        if d is None or branch is None or (branch.owner_id, branch.local_id) != (row.owner_id, row.local_id):
            error("existing_representation_changed")
        data = raw[kj].encode() if d["representation_epoch"] else None
        expectation = {"destination_key": key, **{f: d[f] for f in ("is_null", "origin_validator", "origin_row_required", "storage_operation_id", "semantic_origin_id")}}
        verified.append({"key": key, "revision_ref": branch_ref(branch.id),
            "parent_ref": {"kind": branch.parent_kind, "id": branch.parent_id} if branch.parent_id else None,
            "origin_device_id": branch.origin_device_id, "descriptor": d, "origin_expectation": expectation,
            "total_bytes": len(data) if data is not None else None,
            "total_chunks": (len(data)+262143)//262144 if data is not None else None,
            "expected_binding": d["expected_binding"], "ciphertext_sha256": store.sha(data) if data is not None else None})
    return verified


@ops.atomic
def commit(db, body):
    from sqlalchemy import delete
    from sqlalchemy.exc import IntegrityError
    from app.models.note_crypto import NoteCryptoUpload
    from app.models.note_history import NoteHead
    from app.schemas.note_mixed import MixedImportPrepare
    ops.gate()
    row = ops.own(db, body, PURPOSE)
    if row.state == "committed":
        return replay(db, row, body)
    if row.state == "stale":
        return {"http_status": 409, "detail": {"code": json.loads(row.conditions_json).get("failure_code", "operation_not_active"),
            "required_schema_version": None}, "operation": result(db, row)}
    row, m = ops.active(db, body, PURPOSE)
    if body.lease_version != row.lease_version:
        error("lease_changed")
    if body.mutation_id != row.mutation_id or body.base.model_dump() != m["base"]:
        error("context_changed")
    request = MixedImportPrepare.model_validate(json.loads(row.conditions_json)["request"])
    parents(db, request)
    entries = {e.revision_id: e for e in request.entries}
    existing_ids = {e["revision_id"] for e in m["existing"]}
    for entry in request.entries:
        provenance(db, request, entry, db.get(NoteOfflineBranch, entry.revision_id) if entry.revision_id in existing_ids else None)
    actual_v = verified_existing(db, row, m)
    if actual_v != m["verified_existing"] or meta.h(actual_v) != body.client_verified_existing_set_digest:
        error("verification_manifest_mismatch")
    expected_cipher = [{"revision_id": v["key"]["id"], "ciphertext_sha256": v["ciphertext_sha256"]}
        for v in actual_v if v["ciphertext_sha256"] is not None]
    if [e.model_dump() for e in body.existing_ciphertexts] != expected_cipher:
        error("existing_representation_changed")
    if [e.revision_id for e in body.plain_entries] != plain_ids(m):
        error("invalid_plain_payload", 422)
    plain = {e.revision_id: e.snapshot.model_dump() for e in body.plain_entries}
    for ident, snapshot in plain.items():
        if (snapshot["owner_id"], snapshot["local_id"]) != (row.owner_id, row.local_id):
            error("foreign_import_requires_remap", 422)
        existing = db.get(NoteOfflineBranch, ident) if ident in existing_ids else None
        if existing is not None and (existing.representation_kind != "snapshot_v1" or json.loads(existing.snapshot_json)["note"] != snapshot):
            error("existing_representation_changed")
    required = [d for d in m["DSET"] if d["output_epoch"] > 0]
    if {e.key_json for e in db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id))} != {meta.canonical(d["destination_key"]) for d in required}:
        error("manifest_changed")
    records, values = [], {}
    for d in required:
        k = d["destination_key"]; kj = meta.canonical(k)
        entry = db.get(NoteCryptoEntry, (row.id, kj))
        if (entry.source_etag, entry.output_kind, entry.representation_epoch, entry.binding_json) != (
            d["source_etag"], d["output_kind"], d["output_epoch"], meta.canonical(d["expected_binding"])):
            error("manifest_changed")
        upload = db.get(NoteCryptoUpload, (row.id, kj))
        if upload is None or upload.ciphertext_sha256 is None:
            error("incomplete_manifest")
        data = store.assembled(db, upload)
        if store.sha(data) != upload.ciphertext_sha256:
            error("stage_mismatch")
        store.validate_output(data, d["output_kind"], d["output_epoch"], d["expected_binding"])
        values[k["id"]] = data.decode()
        records.append({"entry_key": k, "destination_key": k, "source_etag": d["source_etag"], "output_kind": d["output_kind"],
            "target_epoch": d["output_epoch"], "total_bytes": len(data), "ciphertext_sha256": store.sha(data)})
    if meta.h(records) != body.client_verified_ciphertext_manifest_digest:
        error("verification_manifest_mismatch")
    for d in m["DSET"]:
        if d["output_epoch"] == 0:
            values[d["destination_key"]["id"]] = meta.canonical({"schema_version": 1, "note": plain[d["destination_key"]["id"]]})
    try:
        meta.begin_update(db, row.owner_id, row.local_id)
        for d in m["DSET"]:
            ident = d["destination_key"]["id"]; entry = entries[ident]
            db.add(NoteOfflineBranch(id=ident, owner_id=row.owner_id, local_id=row.local_id,
                parent_kind=entry.parent_ref.kind if entry.parent_ref else None, parent_id=entry.parent_ref.id if entry.parent_ref else None,
                origin_device_id=entry.origin_device_id, captured_at=row.created_at, snapshot_json=values[ident],
                schema_version=1, representation_kind=d["output_kind"], representation_epoch=d["output_epoch"]))
        ops.install_slots(db, row, m)
        head = db.get(NoteHead, (row.owner_id, row.local_id))
        if m["DSET"]:
            head.version += 1; head.history_generation += 1
            if not m["base"]["base"]["current_exists"]:
                head.identity_state = "branch_only"
        row.state = "committed"
        row.commit_conditions_json = meta.canonical(body.model_dump(exclude={"plain_entries"}))
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
        latest = read.context(db, row.owner_id, row.local_id, row.actor_device_id, m["server_instance_id"])["context"]
        row.receipt_json = meta.canonical({"schema_version": 3, "purpose": PURPOSE, "operation_id": row.id,
            "mutation_id": row.mutation_id, "server_instance_id": m["server_instance_id"], "owner_id": row.owner_id,
            "local_id": row.local_id, "result": latest, "metadata_manifest_digest": row.manifest_digest,
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
        if row.state not in ("aborted", "stale"):
            row, _ = ops.active(db, body, PURPOSE)
            row.state = "stale"
            c = json.loads(row.conditions_json); c["failure_code"] = "revision_id_conflict"
            row.conditions_json = meta.canonical(c)
            db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
        return {"http_status": 409, "detail": {"code": "revision_id_conflict", "required_schema_version": None}, "operation": result(db, row)}
