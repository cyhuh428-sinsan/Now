"""Immutable protected offline provenance receipt; never adopts a current Note."""
import base64
import json
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence, NoteCryptoUpload, NoteRepresentationOrigin
from app.models.note_history import NoteHead
from app.models.note_v2 import NoteOfflineBranch, NoteMutation
from app.schemas.note_protected_import import PrepareImport
from app.services import note_crypto as prep, note_crypto_storage as store, note_operation_origin as origin
from app.services.note_crypto_fence import ACTIVE_STATES, error, require_unfenced, database_now
from app.services.note_v2 import canonical

PURPOSE = "protected_import"


def key(ident):
    return {"kind": "offline_snapshot", "id": ident, "slot": "snapshot"}


def ref(ident):
    return {"kind": "offline_branch", "id": ident}


def meaning(row):
    return {"purpose": PURPOSE, "import_id": row.id, "mutation_id": row.mutation_id,
            "operation": "import", "restore_source_ref": None, "target_ciphertext_sha256": None}


def hashed(value):
    return store.sha(store.canonical_bytes(value))


def metadata(row, c):
    return {"schema_version": 1, "purpose": PURPOSE, "import_id": row.id, "mutation_id": row.mutation_id,
            "server_instance_id": c["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id,
            "actor_device_id": row.actor_device_id, **{k: c[k] for k in ("base", "target_epoch", "new_entries",
                "existing_entries", "parent_sources", "origin_metadata_version", "origin_expectations")}}


def condition(row):
    try:
        c = json.loads(row.conditions_json)
        request = PrepareImport.model_validate(c["request"]).model_dump()
        if (request != c["request"] or row.purpose != PURPOSE or request["owner_id"] != row.owner_id
            or request["local_id"] != row.local_id or request["device_id"] != row.actor_device_id
            or request["mutation_id"] != row.mutation_id or request["server_instance_id"] != c["server_instance_id"]
            or request["target_epoch"] != c["target_epoch"] or type(c["origin_metadata_version"]) is not int
            or c["origin_metadata_version"] != 1 or hashed(metadata(row, c)) != row.manifest_digest):
            error("inconsistent_history")
        expected = [{"destination_key": n["key"], "is_null": False, "origin_row_required": True,
                     "semantic_origin_id": row.id} for n in c["new_entries"]]
        if c["origin_expectations"] != expected:
            error("inconsistent_history")
        base_fields = {"crypto_epoch": "crypto_epoch", "base_head_version": "head_version",
            "base_revision_id": "head_revision_id", "expected_history_generation": "history_generation",
            "expected_inventory_revision_ids": "inventory_revision_ids"}
        entries = [{"revision_id": n["key"]["id"], "parent_ref": n["parent_ref"], "origin_device_id": n["origin_device_id"],
                    "expected_existing_ciphertext_sha256": None} for n in c["new_entries"]]
        entries += [{"revision_id": e["key"]["id"], "parent_ref": e["parent_ref"], "origin_device_id": e["origin_device_id"],
                     "expected_existing_ciphertext_sha256": e["source"]["ciphertext_sha256"]} for e in c["existing_entries"]]
        entries.sort(key=lambda e: e["revision_id"])
        if (any(request[k] != c["base"][v] for k, v in base_fields.items()) or entries != request["entries"]
            or len(entries) != len({e["revision_id"] for e in entries})):
            error("inconsistent_history")
        return c
    except (ValueError, TypeError, KeyError):
        error("inconsistent_history")


def binding(row, c, e):
    return {"server_instance_id": c["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id,
            "transition_id": row.id, "crypto_epoch": c["target_epoch"], "destination_key": key(e["revision_id"]),
            "revision_ref": ref(e["revision_id"]), "parent_ref": e["parent_ref"]}


def source_expectation(db, owner, local, descriptor, raw):
    # Keep the original storage and semantic origins, including positive legacy evidence.
    origin.semantic_id(db, owner, local, descriptor["key"], raw.decode())
    stored = origin.storage_row(db, owner, local, descriptor["key"], raw.decode())
    c = json.loads(stored.conditions_json)
    legacy = c.get("origin_metadata_legacy") == origin.LEGACY
    semantic = None if legacy else origin.expectation(stored, descriptor["key"])["semantic_origin_id"]
    return {"storage_origin_id": stored.id, "origin_metadata_version": None if legacy else c["origin_metadata_version"],
            "origin_expectations_digest": None if legacy else origin.expectations_digest(stored),
            "origin_metadata_legacy": origin.LEGACY if legacy else None, "semantic_origin_id": semantic,
            "operation_origin": descriptor["operation_origin"]}


def classify(db, row, c):
    request = c["request"]
    entries = {e["revision_id"]: e for e in request["entries"]}
    if len(entries) != len(request["entries"]):
        error("revision_id_conflict")
    sources = store.live_entries(db, row.owner_id, row.local_id) if c["base"]["crypto_epoch"] else []
    by_ref = {canonical(d["revision_ref"]): (d, raw) for d, raw in sources
              if d["key"]["kind"] in ("revision_snapshot", "offline_snapshot")}
    new, existing, parents = [], [], {}
    for e in request["entries"]:
        ident, parent = e["revision_id"], e["parent_ref"]
        old = db.get(NoteOfflineBranch, ident)
        if old is not None:
            d_raw = by_ref.get(canonical(ref(ident)))
            if (old.owner_id != row.owner_id or old.local_id != row.local_id or d_raw is None
                or d_raw[0]["ciphertext_sha256"] != e["expected_existing_ciphertext_sha256"]
                or d_raw[0]["parent_ref"] != parent or old.origin_device_id != e["origin_device_id"]):
                error("revision_id_conflict")
            d, raw = d_raw
            existing.append({"key": key(ident), "revision_ref": ref(ident), "parent_ref": parent,
                "origin_device_id": e["origin_device_id"], "source": d,
                "origin_expectation": source_expectation(db, row.owner_id, row.local_id, d, raw)})
        else:
            if e["expected_existing_ciphertext_sha256"] is not None:
                error("revision_id_conflict")
            new.append(e)
        if parent and not (parent["kind"] == "offline_branch" and parent["id"] in entries):
            target = by_ref.get(canonical(parent))
            if target is None:
                error("invalid_revision_parent")
            d, raw = target
            parents[canonical(parent)] = {"ref": parent, "source": d,
                "origin_expectation": source_expectation(db, row.owner_id, row.local_id, d, raw)}
    done = set()
    for ident in entries:
        path, node = set(), ident
        while node in entries and node not in done:
            if node in path:
                error("invalid_revision_parent")
            path.add(node)
            parent = entries[node]["parent_ref"]
            node = parent["id"] if parent and parent["kind"] == "offline_branch" else None
        done.update(path)
    return new, existing, sorted(parents.values(), key=lambda p: (p["ref"]["kind"].encode(), p["ref"]["id"].encode()))


def validate_sources(db, row):
    c = condition(row)
    if prep.related_plaintext(db, row.owner_id, row.local_id):
        error("related_plaintext_unresolved")
    new, existing, parents = classify(db, row, c)
    if existing != c["existing_entries"] or parents != c["parent_sources"]:
        error("manifest_changed")
    records = c["new_entries"]
    if [e["revision_id"] for e in new] != [n["key"]["id"] for n in records]:
        error("manifest_changed")
    rows = {e.key_json: e for e in db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id))}
    if len(rows) != len(records):
        error("inconsistent_history")
    for e, n in zip(new, records):
        stored = rows.get(canonical(key(e["revision_id"])))
        expected = {"key": key(e["revision_id"]), "destination_key": key(e["revision_id"]),
            "source_etag": stored.source_etag if stored else None, "source_kind": "client_pending",
            "output_kind": "history_envelope_v1", "representation_epoch": c["base"]["crypto_epoch"],
            "target_epoch": c["target_epoch"], "expected_binding": binding(row, c, e),
            "revision_ref": ref(e["revision_id"]), "parent_ref": e["parent_ref"],
            "origin_device_id": e["origin_device_id"], "operation_origin": meaning(row)}
        if (n != expected or stored is None or json.loads(stored.binding_json) != expected["expected_binding"]
            or prep.entry_result(stored) != {k: n[k] for k in ("key", "source_etag", "source_kind", "output_kind", "representation_epoch")}):
            error("inconsistent_history")


def own(db, owner, local, device, ident):
    row = prep.owned(db, owner, local, device, ident, PURPOSE)
    if row.state not in ACTIVE_STATES + ("committed", "expired", "aborted"):
        error("inconsistent_history")
    if row.actor_device_id != device:
        error("transition_actor_mismatch", 403)
    c = condition(row)
    if c["server_instance_id"] != prep.initialize_identity(db.connection()):
        error("server_instance_changed")
    return row


def result(db, row):
    c = condition(row)
    if row.state == "committed":
        try:
            receipt = json.loads(row.receipt_json)
            if (type(receipt["origin_metadata_version"]) is not int or receipt["origin_metadata_version"] != 1
                or receipt["origin_expectations_digest"] != origin.expectations_digest(row)):
                error("inconsistent_history")
        except (ValueError, KeyError, TypeError):
            error("inconsistent_history")
        current = store.current_context(db, row.owner_id, row.local_id)
        mapping = {"result_head_version": "head_version", "result_revision_id": "head_revision_id",
                   "result_inventory_revision_ids": "inventory_revision_ids"}
        mapping.update({k: k for k in ("server_instance_id", "crypto_epoch", "history_generation", "identity_state",
                                      "current_exists", "protection_state")})
        matches = current["active_transition_id"] is None and all(receipt[k] == current[v] for k, v in mapping.items())
        return {"schema_version": 2, "status": "ok", "purpose": PURPOSE, "import_id": row.id,
                "mutation_id": row.mutation_id, "state": row.state, "receipt": receipt,
                "current_context": current, "receipt_matches_current": matches}
    return {"schema_version": 1, "status": "ok", "purpose": PURPOSE, "import_id": row.id, "mutation_id": row.mutation_id,
        "state": row.state, "lease_version": row.lease_version, "expires_at": row.expires_at.isoformat(timespec="microseconds") + "Z",
        **{k: c[k] for k in ("base", "target_epoch", "new_entries", "existing_entries", "parent_sources",
                             "origin_metadata_version", "origin_expectations")},
        "manifest_digest": row.manifest_digest, "failure_code": "import_expired" if row.state == "expired" else None}


@store.atomic
def prepare(db, body):
    prep.authenticate_actor(db, body.owner_id, body.device_id)
    instance = prep.initialize_identity(db.connection())
    if body.server_instance_id != instance:
        error("server_instance_changed")
    previous = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id,
                                                           NoteCryptoTransition.mutation_id == body.mutation_id))
    if previous:
        if previous.purpose != PURPOSE or condition(previous)["request"] != body.model_dump():
            error("idempotency_mismatch")
        return {"created": False, **result(db, own(db, body.owner_id, body.local_id, body.device_id, previous.id))}
    if db.get(NoteMutation, (body.owner_id, body.mutation_id)) is not None:
        error("idempotency_mismatch")
    require_unfenced(db, [(body.owner_id, body.local_id)])
    base = prep.base_state(db, body.owner_id, body.local_id, baseline=False)
    if body.crypto_epoch != base["crypto_epoch"] or body.target_epoch != (base["crypto_epoch"] or 1):
        error("crypto_epoch_changed")
    if (body.base_head_version != base["head_version"] or body.base_revision_id != base["head_revision_id"]
        or body.expected_history_generation != base["history_generation"] or body.expected_inventory_revision_ids != base["inventory_revision_ids"]):
        error("version_conflict")
    if prep.related_plaintext(db, body.owner_id, body.local_id):
        error("related_plaintext_unresolved")
    if not base["crypto_epoch"]:
        if base["protection_state"] != "legacy" or db.scalar(select(NoteRepresentationOrigin.key_json).where(
            NoteRepresentationOrigin.owner_id == body.owner_id, NoteRepresentationOrigin.local_id == body.local_id).limit(1)) is not None:
            error("inconsistent_history")
        if base["current_exists"] or base["history_generation"] or base["head_version"] or base["head_revision_id"] or base["inventory_revision_ids"]:
            error("history_envelope_required")
        if prep.catalog(db, body.owner_id, body.local_id, 0):
            error("history_envelope_required")
    stamp = database_now(db)
    row = NoteCryptoTransition(id=str(uuid4()), owner_id=body.owner_id, local_id=body.local_id, mutation_id=body.mutation_id,
        actor_device_id=body.device_id, purpose=PURPOSE, state="prepared", lease_version=1,
        created_at=stamp, expires_at=stamp + timedelta(minutes=30))
    c = {"request": body.model_dump(), "server_instance_id": instance, "base": base, "target_epoch": body.target_epoch,
         "origin_metadata_version": 1, "new_entries": [], "null_slots": []}
    new, c["existing_entries"], c["parent_sources"] = classify(db, row, c)
    for e in new:
        c["new_entries"].append({"key": key(e["revision_id"]), "destination_key": key(e["revision_id"]),
            "source_etag": str(uuid4()), "source_kind": "client_pending", "output_kind": "history_envelope_v1",
            "representation_epoch": base["crypto_epoch"], "target_epoch": body.target_epoch,
            "expected_binding": binding(row, c, e), "revision_ref": ref(e["revision_id"]), "parent_ref": e["parent_ref"],
            "origin_device_id": e["origin_device_id"], "operation_origin": meaning(row)})
    c["origin_expectations"] = [{"destination_key": n["key"], "is_null": False, "origin_row_required": True,
                                 "semantic_origin_id": row.id} for n in c["new_entries"]]
    row.conditions_json, row.manifest_digest = canonical(c), hashed(metadata(row, c))
    row.state = "prepared" if new else "ready"
    db.add(row); db.flush()
    for n in c["new_entries"]:
        db.add(NoteCryptoEntry(transition_id=row.id, key_json=canonical(n["key"]), binding_json=canonical(n["expected_binding"]),
            **{k: n[k] for k in ("source_etag", "source_kind", "output_kind", "representation_epoch")}))
    db.add(NoteCryptoFence(owner_id=row.owner_id, local_id=row.local_id, transition_id=row.id)); db.flush()
    return {"created": True, **result(db, row)}


@store.atomic
def status(db, owner, local, device, ident):
    return result(db, own(db, owner, local, device, ident))


@store.atomic
def action(db, body, operation):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.transition_id)
    if operation == "abort":
        if row.state == "committed":
            error("import_already_committed")
        if row.state in ACTIVE_STATES:
            if row.lease_version != body.lease_version:
                error("lease_changed")
            row.state = "aborted"
            db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    else:
        if row.state == "expired":
            return {"http_status": 410, "detail": {"code": "import_expired"}, "import_id": row.id, "state": "expired"}
        if row.state not in ACTIVE_STATES:
            error("import_not_active")
        if row.lease_version != body.lease_version:
            error("lease_changed")
        row.lease_version += 1
        row.expires_at = database_now(db) + timedelta(minutes=30)
    return result(db, row)


@store.atomic
def manifest(db, owner, local, device, ident, limit, cursor):
    row = own(db, owner, local, device, ident); c = condition(row)
    items = [{"set": name, "entry": e} for name, field in (("already_present", "existing_entries"),
             ("new", "new_entries"), ("parent_source", "parent_sources")) for e in c[field]]
    binding_cursor, start = [owner, local, ident, PURPOSE, row.manifest_digest], 0
    if cursor:
        try:
            value = json.loads(base64.urlsafe_b64decode(cursor))
            if value[:-1] != binding_cursor or type(value[-1]) is not int or not 0 <= value[-1] <= len(items):
                error("manifest_changed")
            start = value[-1]
        except (ValueError, TypeError, IndexError):
            error("invalid_cursor", 422)
    end = start + limit
    return {"schema_version": 1, "purpose": PURPOSE, "import_id": ident, "state": row.state,
        "manifest_digest": row.manifest_digest, "counts": {k: sum(i["set"] == k for i in items) for k in ("new", "already_present", "parent_source")},
        "items": items[start:end], "next_cursor": base64.urlsafe_b64encode(store.canonical_bytes(binding_cursor + [end])).decode() if end < len(items) else None}


@store.atomic
def source(db, owner, local, device, ident, key_value, etag, index):
    known = own(db, owner, local, device, ident)
    if known.state not in ACTIVE_STATES:
        error("import_expired" if known.state == "expired" else "source_unavailable", 410 if known.state == "expired" else 409)
    row = store.active(db, owner, local, device, ident, PURPOSE); c = condition(row)
    descriptors = [e["source"] for e in c["existing_entries"] + c["parent_sources"]]
    descriptor = next((d for d in descriptors if d["key"] == key_value and d["representation_etag"] == etag), None)
    if descriptor is None:
        error("source_not_found", 404)
    raw = next(raw for d, raw in store.live_entries(db, owner, local) if d["key"] == key_value)
    if index >= descriptor["total_chunks"]:
        error("invalid_chunk_index", 422)
    chunk = raw[index * store.CHUNK_BYTES:(index + 1) * store.CHUNK_BYTES]
    return {**descriptor, "import_id": ident, "chunk_index": index, "chunk_sha256": store.sha(chunk),
            "data_base64": base64.b64encode(chunk).decode()}


def verified_existing(c):
    return [{"key": e["key"], "revision_ref": e["revision_ref"], "parent_ref": e["parent_ref"],
        "origin_device_id": e["origin_device_id"], "crypto_epoch": c["target_epoch"],
        **{k: e["source"][k] for k in ("representation_etag", "total_bytes", "total_chunks", "ciphertext_sha256", "expected_binding")},
        "origin_expectation": e["origin_expectation"]} for e in c["existing_entries"]]


@store.atomic
def commit(db, body):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.import_id); c = condition(row)
    if body.server_instance_id != c["server_instance_id"]:
        error("server_instance_changed")
    core = canonical(body.model_dump())
    if row.state == "committed":
        if core != row.commit_conditions_json:
            error("idempotency_mismatch")
        return result(db, row)
    if row.state == "expired":
        return {"http_status": 410, "detail": {"code": "import_expired"}, "import_id": row.id, "state": "expired"}
    row = store.active(db, row.owner_id, row.local_id, body.device_id, row.id, PURPOSE)
    if body.mutation_id != row.mutation_id:
        error("idempotency_mismatch")
    if body.crypto_epoch != c["target_epoch"]:
        error("crypto_epoch_changed")
    if body.metadata_manifest_digest != row.manifest_digest:
        error("manifest_changed")
    if body.client_verified_existing_set_digest != hashed(verified_existing(c)):
        error("verification_manifest_mismatch")
    records, inserts = [], []
    for n in c["new_entries"]:
        upload = db.get(NoteCryptoUpload, (row.id, canonical(n["key"])))
        if upload is None or upload.ciphertext_sha256 is None:
            error("incomplete_manifest")
        raw = store.assembled(db, upload)
        if store.sha(raw) != upload.ciphertext_sha256:
            error("stage_mismatch")
        store.validate_output(raw, "history_envelope_v1", c["target_epoch"], n["expected_binding"])
        records.append({"entry_key": n["key"], "destination_key": n["key"], "source_etag": n["source_etag"],
            "output_kind": n["output_kind"], "target_epoch": c["target_epoch"], "total_bytes": len(raw), "ciphertext_sha256": store.sha(raw)})
        inserts.append((n, raw.decode()))
    if body.client_verified_ciphertext_manifest_digest != hashed(records):
        error("verification_manifest_mismatch")
    head = db.get(NoteHead, (row.owner_id, row.local_id))
    if head is None:
        head = NoteHead(owner_id=row.owner_id, local_id=row.local_id, version=0, head_revision_id=None,
                        history_generation=0, identity_state="branch_only", protection_state="protected", crypto_epoch=1)
        db.add(head)
    elif not c["base"]["crypto_epoch"]:
        head.identity_state, head.protection_state, head.crypto_epoch = "branch_only", "protected", 1
    for n, text in inserts:
        parent = n["parent_ref"]
        db.add(NoteOfflineBranch(id=n["key"]["id"], owner_id=row.owner_id, local_id=row.local_id,
            parent_kind=parent["kind"] if parent else None, parent_id=parent["id"] if parent else None,
            origin_device_id=n["origin_device_id"], representation_kind="history_envelope_v1",
            representation_epoch=c["target_epoch"], snapshot_json=text))
    head.history_generation += len(inserts)
    origin.install(db, row)
    try:
        db.flush()
    except IntegrityError as exc:
        unique = getattr(exc.orig, "sqlstate", None) == "23505" or getattr(exc.orig, "sqlite_errorcode", None) in (1555, 2067)
        if unique and (exc.statement or "").lower().startswith("insert into note_offline_branches"):
            db.rollback()
            error("revision_id_conflict")
        raise
    row.state, row.commit_conditions_json = "committed", core
    db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
    latest = store.current_context(db, row.owner_id, row.local_id)
    statuses = {e["key"]["id"]: "already_present" for e in c["existing_entries"]}
    statuses.update({n["key"]["id"]: "new" for n in c["new_entries"]})
    row.receipt_json = canonical({"server_instance_id": c["server_instance_id"], "owner_id": row.owner_id,
        "local_id": row.local_id, "import_id": row.id, "mutation_id": row.mutation_id,
        "imported_refs": [{**ref(i), "status": statuses[i], "crypto_epoch": c["target_epoch"]} for i in sorted(statuses)],
        "crypto_epoch": c["target_epoch"], "result_head_version": latest["head_version"], "result_revision_id": latest["head_revision_id"],
        "result_inventory_revision_ids": latest["inventory_revision_ids"],
        **{k: latest[k] for k in ("history_generation", "identity_state", "current_exists", "protection_state")},
        "metadata_manifest_digest": row.manifest_digest, "ciphertext_manifest_digest": hashed(records),
        "existing_set_digest": hashed(verified_existing(c)), "origin_metadata_version": 1,
        "origin_expectations_digest": origin.expectations_digest(row)})
    return result(db, row)
