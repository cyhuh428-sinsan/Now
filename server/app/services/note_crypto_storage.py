"""A2a ciphertext transport, atomic representation conversion and live recovery."""
import base64
import hashlib
import json
from functools import wraps

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import OperationalError

from app.models.note import Note
from app.models.note_crypto import NoteCryptoChunk, NoteCryptoEntry, NoteCryptoFence, NoteCryptoTransition, NoteCryptoUpload
from app.models.note_history import NoteHead, NoteInventory, NoteRevision
from app.models.note_v2 import NoteOfflineBranch
from app.services import note_crypto as preparation
from app.services.note_crypto_fence import ACTIVE_STATES, active_fence, database_now, error
from app.services.note_history import inventories
from app.services.note_v2 import canonical, encrypted

CHUNK_BYTES = 262144
KINDS = ("note_body", "revision_snapshot", "revision_before", "inventory_snapshot", "offline_snapshot", "reserved_offline_snapshot")


def canonical_bytes(value):
    return canonical(value).encode("utf-8")


def sha(value):
    return hashlib.sha256(value).hexdigest()


def key_order(value):
    return tuple(value[field].encode("utf-8") for field in ("kind", "id", "slot"))


def atomic(fn):
    @wraps(fn)
    def transaction(db, *args, **kwargs):
        try:
            value = fn(db, *args, **kwargs)
            db.commit()
            return value
        except HTTPException:
            db.rollback()
            raise
        except OperationalError as exc:
            db.rollback()
            if getattr(exc.orig, "sqlite_errorcode", None) == 13 or getattr(exc.orig, "sqlstate", None) == "53100":
                error("storage_full", 507)
            error("storage_unavailable", 503)
        except Exception:
            db.rollback()
            # No exception/SQL parameters: these can contain original text.
            error("internal_error", 500)
    return transaction


def destination(key):
    return {**key, "kind": "offline_snapshot"} if key["kind"] == "reserved_offline_snapshot" else key


def references(db, owner, local, key, request=None):
    kind, ident = key["kind"], key["id"]
    from app.services.related_text import SLOTS
    if kind == "note_body" or kind in SLOTS:
        return None, None
    if kind == "reserved_offline_snapshot":
        reservation = next((b for b in request["local_branches"] if b["revision_id"] == ident), None)
        if reservation is None:
            error("inconsistent_history")
        return {"kind": "offline_branch", "id": ident}, reservation["parent_ref"]
    if kind == "inventory_snapshot":
        inventory = db.get(NoteInventory, (owner, local, int(ident)))
        row = db.get(NoteRevision, inventory.revision_id) if inventory else None
    else:
        row = db.get(NoteOfflineBranch if kind == "offline_snapshot" else NoteRevision, ident)
    if row is None or row.owner_id != owner or row.local_id != local:
        error("inconsistent_history")
    if isinstance(row, NoteOfflineBranch):
        return {"kind": "offline_branch", "id": row.id}, ({"kind": row.parent_kind, "id": row.parent_id} if row.parent_id else None)
    return {"kind": "note_revision", "id": row.id}, ({"kind": "note_revision", "id": row.parent_revision_id} if row.parent_revision_id else None)


def expected_binding(db, row, key):
    conditions = json.loads(row.conditions_json)
    entry = db.get(NoteCryptoEntry, (row.id, canonical(key)))
    if entry is not None and entry.binding_json is not None:
        return json.loads(entry.binding_json)
    if entry is not None and preparation.base_state(db, row.owner_id, row.local_id, baseline=False) != conditions["base"]:
        error("binding_metadata_unavailable")
    if key["kind"] == "note_body":
        value = None
    else:
        ref, parent = references(db, row.owner_id, row.local_id, key, conditions["request"])
        value = {"server_instance_id": conditions["server_instance_id"], "owner_id": row.owner_id,
                 "local_id": row.local_id, "transition_id": row.id, "crypto_epoch": conditions["request"]["target_epoch"],
                 "destination_key": destination(key), "revision_ref": ref, "parent_ref": parent}
    if entry is not None:
        entry.binding_json = canonical(value)
    return value


def entry_metadata(db, row, entry):
    key = json.loads(entry.key_json)
    upload = db.get(NoteCryptoUpload, (row.id, entry.key_json))
    chunks = list(db.scalars(select(NoteCryptoChunk.chunk_index).where(NoteCryptoChunk.transition_id == row.id,
                                                                   NoteCryptoChunk.key_json == entry.key_json)))
    from app.services import note_operation_origin as origin
    origin.upgrade_pending(db, row)
    condition = json.loads(row.conditions_json)
    from app.services.related_text import SLOTS
    semantic_origin = None if key["kind"] in SLOTS or condition.get("origin_metadata_legacy") == origin.LEGACY else origin.expected_origin(db, row, destination(key))
    return {**preparation.entry_result(entry), "destination_key": destination(key), "operation_origin": semantic_origin,
            "expected_binding": expected_binding(db, row, key), "uploaded_chunks": len(chunks),
            "sealed": upload is not None and upload.ciphertext_sha256 is not None,
            "ciphertext_sha256": upload.ciphertext_sha256 if upload else None}


def active(db, owner, local, device, ident, purpose="conversion"):
    row = preparation.owned(db, owner, local, device, ident, purpose)
    if row.actor_device_id != device:
        error("transition_actor_mismatch", 403)
    if json.loads(row.conditions_json)["server_instance_id"] != preparation.initialize_identity(db.connection()):
        error("server_instance_changed")
    if row.state == "expired":
        error({"protected_write": "quote_expired", "protected_import": "import_expired"}.get(purpose, "transition_expired"), 410)
    if row.state not in ACTIVE_STATES:
        error({"protected_write": "quote_not_active", "protected_import": "import_not_active"}.get(purpose, "transition_not_active"))
    fence = active_fence(db, owner, local)
    if fence is None or fence.id != row.id:
        error("inconsistent_crypto_fence")
    if preparation.base_state(db, owner, local, baseline=False) != json.loads(row.conditions_json)["base"]:
        error("manifest_changed")
    from app.services.note_operation_origin import upgrade_pending
    upgrade_pending(db, row)
    if json.loads(row.conditions_json).get("schema_version") == 2:
        from app.services.related_conversion import validate
        validate(db, row)
    if purpose == "protected_write":
        from app.services.note_protected_write import validate_sources
        validate_sources(db, row)
    elif purpose == "protected_import":
        from app.services.note_protected_import import validate_sources
        validate_sources(db, row)
    return row


def entry_for(db, row, key, etag, epoch):
    entry = db.get(NoteCryptoEntry, (row.id, canonical(key)))
    if entry is None or entry.source_etag != etag:
        error("source_not_found", 404)
    if epoch != json.loads(row.conditions_json)["request"]["target_epoch"]:
        error("crypto_epoch_changed")
    return entry


def transport(db, row, entry, body):
    upload = db.get(NoteCryptoUpload, (row.id, entry.key_json))
    if upload is not None and (upload.total_chunks != body.total_chunks or upload.total_bytes != body.total_bytes):
        error("stage_mismatch")
    return upload


@atomic
def put_chunk(db, body, purpose="conversion"):
    row = active(db, body.owner_id, body.local_id, body.device_id, body.transition_id, purpose)
    key = body.entry_key.model_dump()
    entry = entry_for(db, row, key, body.source_etag, body.target_epoch)
    try:
        data = base64.b64decode(body.data_base64, validate=True)
    except (ValueError, TypeError):
        error("invalid_chunk", 422)
    expected_size = min(CHUNK_BYTES, body.total_bytes - body.chunk_index * CHUNK_BYTES)
    if body.chunk_index >= body.total_chunks or len(data) != expected_size or sha(data) != body.chunk_sha256:
        error("invalid_chunk", 422)
    upload = transport(db, row, entry, body)
    chunk = db.get(NoteCryptoChunk, (row.id, entry.key_json, body.chunk_index))
    if chunk:
        if chunk.data != data or chunk.chunk_sha256 != body.chunk_sha256:
            error("stage_mismatch")
    else:
        if upload and upload.ciphertext_sha256:
            error("stage_mismatch")
        if upload is None:
            upload = NoteCryptoUpload(transition_id=row.id, key_json=entry.key_json,
                                      total_chunks=body.total_chunks, total_bytes=body.total_bytes)
            db.add(upload)
        db.add(NoteCryptoChunk(transition_id=row.id, key_json=entry.key_json, chunk_index=body.chunk_index,
                               chunk_sha256=body.chunk_sha256, data=data))
        row.state = "staging"
        db.flush()
    count = len(list(db.scalars(select(NoteCryptoChunk.chunk_index).where(NoteCryptoChunk.transition_id == row.id,
                                                                         NoteCryptoChunk.key_json == entry.key_json))))
    return {"schema_version": 1, "status": "ok", "transition_id": row.id, "entry_key": key,
            "chunk_index": body.chunk_index, "chunk_sha256": body.chunk_sha256,
            "uploaded_chunks": count, "total_chunks": body.total_chunks, "state": row.state}


def assembled(db, upload):
    chunks = list(db.scalars(select(NoteCryptoChunk).where(NoteCryptoChunk.transition_id == upload.transition_id,
        NoteCryptoChunk.key_json == upload.key_json).order_by(NoteCryptoChunk.chunk_index)))
    if [c.chunk_index for c in chunks] != list(range(upload.total_chunks)):
        error("incomplete_entry")
    if any(sha(c.data) != c.chunk_sha256 for c in chunks):
        error("stage_mismatch")
    data = b"".join(c.data for c in chunks)
    if len(data) != upload.total_bytes:
        error("stage_mismatch")
    return data


def strict_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON key")
        value[key] = item
    return value


def validate_output(data, kind, epoch, binding):
    try:
        text = data.decode("utf-8", errors="strict")
        if kind == "content_encrypted_v1":
            if not encrypted(text):
                raise ValueError("invalid current cipher")
            return None
        if kind not in ("history_envelope_v1", "linked_text_envelope_v1"):
            raise ValueError("invalid output kind")
        value = json.loads(text, object_pairs_hook=strict_object)
        if (set(value) != {"schema_version", "kind", "crypto_epoch", "binding", "ciphertext"}
            or type(value["schema_version"]) is not int or value["schema_version"] != 1
            or type(value["crypto_epoch"]) is not int or value["crypto_epoch"] != epoch
            or value["kind"] != kind or canonical_bytes(value["binding"]) != canonical_bytes(binding)
            or not encrypted(value["ciphertext"])):
            raise ValueError("invalid envelope")
        return value
    except (ValueError, TypeError, UnicodeError, AttributeError):
        error("invalid_ciphertext_representation", 422)


@atomic
def seal(db, body, purpose="conversion"):
    row = active(db, body.owner_id, body.local_id, body.device_id, body.transition_id, purpose)
    key = body.entry_key.model_dump()
    entry = entry_for(db, row, key, body.source_etag, body.target_epoch)
    upload = transport(db, row, entry, body)
    if upload is None:
        error("incomplete_entry")
    data = assembled(db, upload)
    if sha(data) != body.ciphertext_sha256 or (upload.ciphertext_sha256 and upload.ciphertext_sha256 != body.ciphertext_sha256):
        error("stage_mismatch")
    validate_output(data, entry.output_kind, body.target_epoch, expected_binding(db, row, key))
    upload.ciphertext_sha256 = body.ciphertext_sha256
    db.flush()
    entries = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
    uploads = list(db.scalars(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == row.id)))
    row.state = "ready" if len(entries) == len(uploads) and all(u.ciphertext_sha256 for u in uploads) else "staging"
    return {"schema_version": 1, "status": "ok", "transition_id": row.id, "entry_key": key,
            "source_etag": body.source_etag, "target_epoch": body.target_epoch, "total_chunks": body.total_chunks,
            "total_bytes": body.total_bytes, "sealed": True, "ciphertext_sha256": upload.ciphertext_sha256}


@atomic
def staged(db, owner, local, device, transition_id, key, etag, index, purpose="conversion", read_schema=None, metadata_digest=None):
    # Terminal stage reads are closed even for the original creator.
    known = preparation.owned(db, owner, local, device, transition_id, purpose)
    if known.state not in ACTIVE_STATES:
        error("source_unavailable", 410 if known.state == "expired" else 409)
    row = active(db, owner, local, device, transition_id, purpose)
    epoch = json.loads(row.conditions_json)["request"]["target_epoch"]
    entry = entry_for(db, row, key, etag, epoch)
    upload = db.get(NoteCryptoUpload, (row.id, entry.key_json))
    chunk = db.get(NoteCryptoChunk, (row.id, entry.key_json, index))
    if upload is None or chunk is None:
        error("chunk_not_found", 404)
    result = {"entry_key": key, "source_etag": etag, "target_epoch": epoch, "chunk_index": index,
            "operation_origin": entry_metadata(db, row, entry)["operation_origin"],
            "total_chunks": upload.total_chunks, "total_bytes": upload.total_bytes, "chunk_sha256": chunk.chunk_sha256,
            "ciphertext_sha256": upload.ciphertext_sha256, "data_base64": base64.b64encode(chunk.data).decode(),
            "sealed": upload.ciphertext_sha256 is not None}
    if json.loads(row.conditions_json).get("schema_version") == 2:
        from app.services.related_conversion import checked_schema, context
        c = checked_schema(row, read_schema, metadata_digest)
        result.update(metadata_context=context(row, c), metadata_manifest_digest=row.manifest_digest,
            slot_version=next(e["slot_version"] for e in c["metadata_sets"]["entries"] if e["key"] == key))
    return result


def current_context(db, owner, local):
    base = preparation.base_state(db, owner, local, baseline=False)
    fence = active_fence(db, owner, local)
    return {"server_instance_id": preparation.initialize_identity(db.connection()), **base,
            "active_transition_id": fence.id if fence else None}


def committed_result(db, row):
    conditions = json.loads(row.conditions_json)
    if conditions["server_instance_id"] != preparation.initialize_identity(db.connection()):
        error("server_instance_changed")
    if row.receipt_json is None:
        error("inconsistent_history")
    receipt = json.loads(row.receipt_json)
    latest = current_context(db, row.owner_id, row.local_id)
    fields = ("server_instance_id", "crypto_epoch", "head_version", "head_revision_id", "history_generation",
              "identity_state", "current_exists", "protection_state", "inventory_revision_ids")
    result = {"schema_version": 1, "status": "ok", "state": "committed", "preparation_only": False,
            "transition_id": row.id, "mutation_id": json.loads(row.commit_conditions_json)["mutation_id"],
            "receipt": receipt, "current_context": latest,
            "receipt_matches_current": latest["active_transition_id"] is None and all(receipt[f] == latest[f] for f in fields)}
    if conditions.get("schema_version") == 2:
        from app.services.related_conversion import status_fields
        result.update(status_fields(row))
    return result


def check_manifest(db, row):
    conditions = json.loads(row.conditions_json)
    base, request = conditions["base"], conditions["request"]
    if preparation.base_state(db, row.owner_id, row.local_id, baseline=False) != base:
        error("version_conflict")
    if conditions.get("schema_version") == 2:
        from app.services.related_conversion import validate
        return validate(db, row)
    if "null_slots" in conditions and preparation.null_slots(db, row.owner_id, row.local_id) != conditions["null_slots"]:
        error("manifest_changed")
    if preparation.related_plaintext(db, row.owner_id, row.local_id):
        error("related_plaintext_unresolved")
    from app.schemas.note_crypto import PrepareTransition
    preparation.validate_reservations(db, PrepareTransition.model_validate(request))
    actual = preparation.catalog(db, row.owner_id, row.local_id, base["crypto_epoch"])
    actual += [{"key": {"kind": "reserved_offline_snapshot", "id": b["revision_id"], "slot": "snapshot"},
                "source_kind": "client_pending", "output_kind": "history_envelope_v1", "representation_epoch": base["crypto_epoch"]}
               for b in request["local_branches"]]
    entries = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
    from app.services.note_operation_origin import conversion_expectations
    if type(conditions.get("origin_metadata_version")) is not int or conditions.get("origin_metadata_version") != 1 or conditions.get("origin_expectations") != conversion_expectations(
        db, row.owner_id, row.local_id, actual, conditions["null_slots"]):
        error("inconsistent_history")
    fields = ("key", "source_kind", "output_kind", "representation_epoch")
    expected = sorted([canonical({k: preparation.entry_result(e)[k] for k in fields}) for e in entries])
    if expected != sorted(canonical({k: item[k] for k in fields}) for item in actual):
        error("manifest_changed")
    # Recheck the persisted random-etag manifest, not a plaintext checksum.
    persisted = sorted([preparation.entry_result(e) for e in entries], key=lambda item: canonical(item["key"]))
    if sha(canonical_bytes(persisted)) != row.manifest_digest:
        error("manifest_changed")
    return entries


@atomic
def commit(db, body):
    row = preparation.owned(db, body.owner_id, body.local_id, body.device_id, body.transition_id)
    if row.actor_device_id != body.device_id:
        error("transition_actor_mismatch", 403)
    if body.server_instance_id != preparation.initialize_identity(db.connection()):
        error("server_instance_changed")
    prepared = json.loads(row.conditions_json)["request"]
    if body.schema_version != prepared["schema_version"]:
        error("manifest_changed")
    if body.schema_version == 2 and any(getattr(body, field) != prepared[field]
        for field in ("drain_id", "drain_version", "linked_metadata_version")):
        error("drain_changed")
    core = canonical(body.model_dump())
    if row.state == "committed":
        if row.commit_conditions_json != core:
            error("idempotency_mismatch")
        return committed_result(db, row)
    row = active(db, body.owner_id, body.local_id, body.device_id, body.transition_id)
    condition = json.loads(row.conditions_json)
    base, request = condition["base"], condition["request"]
    if body.from_epoch != base["crypto_epoch"] or body.target_epoch != request["target_epoch"]:
        error("crypto_epoch_changed")
    if (body.base_head_version != base["head_version"] or body.base_revision_id != base["head_revision_id"]
        or body.expected_inventory_revision_ids != base["inventory_revision_ids"]
        or body.expected_history_generation != base["history_generation"]):
        error("version_conflict")
    if body.metadata_manifest_digest != row.manifest_digest:
        error("manifest_changed")
    entries, records, replacements = check_manifest(db, row), [], []
    for entry in entries:
        upload = db.get(NoteCryptoUpload, (row.id, entry.key_json))
        if upload is None or upload.ciphertext_sha256 is None:
            error("incomplete_manifest")
        data = assembled(db, upload)
        if sha(data) != upload.ciphertext_sha256:
            error("stage_mismatch")
        key = json.loads(entry.key_json)
        validate_output(data, entry.output_kind, body.target_epoch, expected_binding(db, row, key))
        records.append({"entry_key": key, "destination_key": destination(key), "source_etag": entry.source_etag,
                        "output_kind": entry.output_kind, "target_epoch": body.target_epoch,
                        "total_bytes": upload.total_bytes, "ciphertext_sha256": upload.ciphertext_sha256})
        replacements.append((key, data.decode("utf-8")))
    records.sort(key=lambda value: key_order(value["entry_key"]))
    cipher_digest = sha(canonical_bytes(records))
    if cipher_digest != body.client_verified_ciphertext_manifest_digest:
        error("verification_manifest_mismatch")
    # Core Note UPDATE bypasses natural history capture and pins onupdate time.
    for key, text in replacements:
        kind, ident = key["kind"], key["id"]
        from app.services.related_text import SLOTS
        if kind in SLOTS:
            from app.services.related_conversion import publish
            publish(db, row, key, text)
        elif kind == "note_body":
            db.execute(Note.__table__.update().where(Note.id == int(ident), Note.owner_id == row.owner_id,
                Note.local_id == row.local_id).values(content=text, updated_at=Note.updated_at))
        elif kind in ("revision_snapshot", "revision_before"):
            target = db.get(NoteRevision, ident)
            setattr(target, "before_snapshot_json" if kind == "revision_before" else "snapshot_json", text)
            target.representation_kind, target.representation_epoch = "history_envelope_v1", body.target_epoch
        elif kind == "inventory_snapshot":
            target = db.get(NoteInventory, (row.owner_id, row.local_id, int(ident)))
            target.snapshot_json = text
            target.representation_kind, target.representation_epoch = "history_envelope_v1", body.target_epoch
        elif kind == "offline_snapshot":
            target = db.get(NoteOfflineBranch, ident)
            target.snapshot_json = text
            target.representation_kind, target.representation_epoch = "history_envelope_v1", body.target_epoch
        else:
            reserved = next(b for b in request["local_branches"] if b["revision_id"] == ident)
            parent = reserved["parent_ref"]
            db.add(NoteOfflineBranch(id=ident, owner_id=row.owner_id, local_id=row.local_id,
                parent_kind=parent["kind"] if parent else None, parent_id=parent["id"] if parent else None,
                origin_device_id=reserved["origin_device_id"], snapshot_json=text,
                representation_kind="history_envelope_v1", representation_epoch=body.target_epoch))
    if condition.get("schema_version") == 2:
        from app.services.related_conversion import publish_nulls
        publish_nulls(db, row)
    head = db.get(NoteHead, (row.owner_id, row.local_id))
    if head is None:
        head = NoteHead(owner_id=row.owner_id, local_id=row.local_id, version=0, history_generation=0,
                        identity_state="branch_only", head_revision_id=None)
        db.add(head)
    head.crypto_epoch, head.protection_state = body.target_epoch, "protected"
    head.version += 1
    head.history_generation += 1
    row.state, row.commit_conditions_json = "committed", core
    db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    db.flush()
    expected_counts, applied_counts = {kind: 0 for kind in KINDS}, {kind: 0 for kind in KINDS}
    if condition.get("schema_version") == 2:
        from app.services.related_text import SLOTS
        expected_counts.update({k: 0 for k in SLOTS}); applied_counts.update({k: 0 for k in SLOTS})
    for key, _ in replacements:
        expected_counts[key["kind"]] += 1
        applied_counts[destination(key)["kind"]] += 1
    latest = current_context(db, row.owner_id, row.local_id)
    from app.services import note_operation_origin as origin
    origin.install(db, row)
    row.receipt_json = canonical({k: v for k, v in latest.items() if k != "active_transition_id"} | {
        "owner_id": row.owner_id, "local_id": row.local_id, "metadata_manifest_digest": row.manifest_digest,
        "ciphertext_manifest_digest": cipher_digest, "expected_counts": expected_counts, "applied_counts": applied_counts,
        "reserved_branch_ids": sorted(b["revision_id"] for b in request["local_branches"]),
        "origin_metadata_version": 1, "origin_expectations_digest": origin.expectations_digest(row)})
    if condition.get("schema_version") == 2:
        from app.services.related_conversion import hash_value, status_fields
        receipt = json.loads(row.receipt_json)
        null_counts = {}
        for k in condition["null_slots"]:
            null_counts[k["kind"]] = null_counts.get(k["kind"], 0) + 1
        receipt.update(linked_metadata_version=1, linked_expectations_digest=hash_value(condition["linked_expectations"]),
            linked_counts=status_fields(row)["linked_counts"], null_expected_counts=null_counts, null_applied_counts=null_counts,
            full_protection_complete=False, protected_analysis_execution_v1=False)
        row.receipt_json = canonical(receipt)
    return committed_result(db, row)


def live_entries(db, owner, local):
    """Current storage only; includes null-before metadata, never transition stage."""
    head = db.get(NoteHead, (owner, local))
    if head is None or head.protection_state != "protected" or head.crypto_epoch <= 0:
        error("unsupported_representation")
    rows = []
    def add(kind, ident, slot, raw, target=None, physical=None, inventory_id=None):
        key = {"kind": kind, "id": str(ident), "slot": slot}
        is_null = raw is None
        output_kind = "content_encrypted_v1" if kind == "note_body" else "history_envelope_v1"
        binding = None
        if target is not None and (target.representation_epoch != head.crypto_epoch or target.representation_kind != "history_envelope_v1"):
            error("inconsistent_history")
        ref, parent = references(db, owner, local, key)
        data = b"" if is_null else raw.encode("utf-8")
        if not is_null:
            if kind != "note_body":
                try:
                    binding = json.loads(raw, object_pairs_hook=strict_object)["binding"]
                    if (set(binding) != {"server_instance_id", "owner_id", "local_id", "transition_id", "crypto_epoch",
                                         "destination_key", "revision_ref", "parent_ref"}
                        or binding["server_instance_id"] != preparation.initialize_identity(db.connection())
                        or binding["owner_id"] != owner or binding["local_id"] != local
                        or type(binding["crypto_epoch"]) is not int or binding["crypto_epoch"] != head.crypto_epoch
                        or binding["destination_key"] != key or binding["revision_ref"] != ref or binding["parent_ref"] != parent):
                        raise ValueError("invalid live binding")
                except (ValueError, TypeError, KeyError):
                    error("inconsistent_history")
            try:
                validate_output(data, output_kind, head.crypto_epoch, binding)
            except HTTPException:
                error("unsupported_representation")
        item = {"key": key, "representation_kind": output_kind, "representation_epoch": head.crypto_epoch,
                "representation_etag": sha(canonical_bytes([key, head.crypto_epoch, sha(data) if not is_null else None])),
                "is_null": is_null, "total_bytes": len(data), "total_chunks": (len(data) + CHUNK_BYTES - 1) // CHUNK_BYTES,
                "ciphertext_sha256": sha(data) if not is_null else None, "expected_binding": binding,
                "revision_ref": ref, "parent_ref": parent, "physical_note_id": physical,
                "inventory_revision_id": inventory_id}
        from app.services.note_operation_origin import read
        item["operation_origin"] = read(db, owner, local, key, raw)
        rows.append((item, data))
    inventory = {i.note_id: i for i in inventories(db, owner, local)}
    for note in db.scalars(select(Note).where(Note.owner_id == owner, Note.local_id == local)):
        inv = inventory.get(note.id)
        add("note_body", note.id, "content", note.content, physical=note.id, inventory_id=inv.revision_id if inv else None)
    for revision in db.scalars(select(NoteRevision).where(NoteRevision.owner_id == owner, NoteRevision.local_id == local)):
        add("revision_snapshot", revision.id, "after", revision.snapshot_json, revision, revision.note_id)
        add("revision_before", revision.id, "before", revision.before_snapshot_json, revision, revision.note_id)
    for inv in inventory.values():
        add("inventory_snapshot", inv.note_id, "current", inv.snapshot_json, inv, inv.note_id, inv.revision_id)
    for branch in db.scalars(select(NoteOfflineBranch).where(NoteOfflineBranch.owner_id == owner, NoteOfflineBranch.local_id == local)):
        add("offline_snapshot", branch.id, "snapshot", branch.snapshot_json, branch)
    from app.services.related_text import slots
    from app.services.related_conversion import descriptor
    for key, target, meta, raw in slots(db, owner, local):
        rows.append(descriptor(db, owner, local, key, target, meta, raw))
    return sorted(rows, key=lambda pair: key_order(pair[0]["key"]))


def live_context(db, owner, local, device, expected):
    preparation.authenticate_actor(db, owner, device)
    latest = current_context(db, owner, local)
    if latest["active_transition_id"]:
        error("crypto_transition_in_progress", 423)
    if preparation.related_plaintext(db, owner, local):
        error("related_plaintext_unresolved")
    rows = live_entries(db, owner, local)
    context = {k: v for k, v in latest.items() if k not in ("inventory_revision_ids", "active_transition_id", "protection_state")}
    context["catalog_digest"] = sha(canonical_bytes({"context": context, "items": [r[0] for r in rows]}))
    if expected:
        for field, code in [("server_instance_id", "server_instance_changed"), ("crypto_epoch", "crypto_epoch_changed")]:
            if expected.get(field) != context[field]:
                error(code)
        if any(value != context.get(field) for field, value in expected.items()):
            error("catalog_changed")
    return context, rows


@atomic
def representations(db, owner, local, device, limit=100, cursor=None, expected=None):
    context, rows = live_context(db, owner, local, device, expected)
    after = None
    if cursor:
        if expected is None:
            error("invalid_cursor", 422)
        try:
            parsed = json.loads(base64.urlsafe_b64decode(cursor))
            if parsed["context"] != context or parsed["owner"] != owner or parsed["local"] != local:
                error("catalog_changed")
            after = key_order(parsed["after"])
        except (ValueError, TypeError, KeyError):
            error("invalid_cursor", 422)
    candidates = [item for item, _ in rows if after is None or key_order(item["key"]) > after]
    page = candidates[:limit]
    next_cursor = base64.urlsafe_b64encode(canonical_bytes({"context": context, "owner": owner, "local": local,
                                                         "after": page[-1]["key"]})).decode() if len(candidates) > limit else None
    kinds = [kind for kind in KINDS if kind != "reserved_offline_snapshot"]
    from app.services.related_text import SLOTS
    if any(item["key"]["kind"] in SLOTS for item, raw in rows):
        kinds += list(SLOTS)
    counts = {kind: sum(item["key"]["kind"] == kind for item, _ in rows) for kind in kinds}
    return {"context": context, "items": page, "next_cursor": next_cursor, "counts": counts,
            "catalog_digest": context["catalog_digest"], "coverage": {"scope": "note_history", "scope_complete": True,
                "supported_kinds": list(counts), "full_protection_complete": False}}


@atomic
def live_chunk(db, owner, local, device, key, etag, index, expected):
    context, rows = live_context(db, owner, local, device, expected)
    selected = next(((item, data) for item, data in rows if item["key"] == key and item["representation_etag"] == etag), None)
    if selected is None:
        error("representation_not_found", 404)
    item, data = selected
    if item["is_null"]:
        error("null_representation")
    if index < 0 or index >= item["total_chunks"]:
        error("invalid_chunk_index", 422)
    chunk = data[index * CHUNK_BYTES:(index + 1) * CHUNK_BYTES]
    return {**item, "context": context, "output_kind": item["representation_kind"], "chunk_index": index,
            "chunk_sha256": sha(chunk), "data_base64": base64.b64encode(chunk).decode()}


@atomic
def typed_current(db, owner, local, device):
    if not device:
        error("device_required", 422)
    preparation.authenticate_actor(db, owner, device)
    state = preparation.base_state(db, owner, local)
    if state["crypto_epoch"] == 0:
        from app.services.note_v2 import current
        return current(db, owner, local)
    if not state["current_exists"]:
        error("note_not_found", 404)
    if state["identity_state"] != "coherent":
        error("ambiguous_note_identity")
    from app.services.note_history import raw_snapshot, encoded
    from app.services.note_sync import _note_sort_key
    rows = list(db.scalars(select(Note).where(Note.owner_id == owner, Note.local_id == local)))
    note = max(rows, key=_note_sort_key)
    representations = live_entries(db, owner, local)
    key = {"kind": "inventory_snapshot", "id": str(note.id), "slot": "current"}
    raw = next(data for item, data in representations if item["key"] == key)
    return {"schema_version": 2, "status": "ok", "note": json.loads(encoded(raw_snapshot(note)))["note"],
            "current_representation": json.loads(raw), "head_revision_ref": {"kind": "note_revision", "id": state["head_revision_id"]},
            "current_representation_metadata": {"operation_origin": next(item["operation_origin"] for item, _ in representations if item["key"] == key)},
            "note_body_metadata": {"operation_origin": None},
            "base_fields": state, **state}


@atomic
def typed_revision(db, owner, local, device, ref):
    if not device:
        error("device_required", 422)
    preparation.authenticate_actor(db, owner, device)
    state = preparation.base_state(db, owner, local)
    if state["crypto_epoch"] == 0:
        from app.services.note_v2 import read_revision
        return read_revision(db, owner, local, ref)
    rows = live_entries(db, owner, local)
    key = {"kind": "offline_snapshot" if ref.kind == "offline_branch" else "revision_snapshot", "id": ref.id,
           "slot": "snapshot" if ref.kind == "offline_branch" else "after"}
    selected = next(((item, data) for item, data in rows if item["key"] == key), None)
    if selected is None:
        error("revision_not_found", 404)
    item, data = selected
    before = None
    if ref.kind == "note_revision":
        before_key = {"kind": "revision_before", "id": ref.id, "slot": "before"}
        before_item, before_data = next((i, d) for i, d in rows if i["key"] == before_key)
        if not before_item["is_null"]:
            before = {"kind": before_item["representation_kind"], "crypto_epoch": state["crypto_epoch"],
                      "envelope": json.loads(before_data), "operation_origin": before_item["operation_origin"]}
    return {"schema_version": 2, "status": "ok", "revision_ref": ref.model_dump(), "parent_ref": item["parent_ref"],
            "before_representation": before,
            "representation": {"kind": item["representation_kind"], "crypto_epoch": state["crypto_epoch"],
                               "envelope": json.loads(data), "operation_origin": item["operation_origin"]}}
