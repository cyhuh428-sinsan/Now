"""Typed linked storage keeps original execution metadata separate from CAS."""
import json
from datetime import timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import select, delete, update
from sqlalchemy.orm import object_session
from sqlalchemy.exc import IntegrityError

from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence, NoteCryptoUpload
from app.models.note import AnalysisJob, Recording
from app.models.note_related import LinkedText
from app.models.note_history import NoteHead
from app.models.protected_analysis import ProtectedAnalysisClaim
from app.schemas.mixed_related import Initial, Replan, LinkedCommit, Transcript
from app.schemas.mixed_related import LegacyDispatchReceipt, LegacyTerminalReceipt
from app.schemas.protected_analysis import Bundle as LegacyBundle, Settle as LegacySettle
from app.schemas.note_mixed import MixedDescriptor
from app.services import note_mixed_metadata as meta, note_mixed_read as read, note_mixed_operations as ops
from app.services import protected_analysis as legacy, mixed_analysis as claims
from app.services.note_crypto_fence import error, database_now, expire
from app.services.note_protected_write import date

MA = "mixed_analysis_write"
MT = "mixed_transcript_write"
PURPOSES = (MA, MT)
SECTIONS = ("S", "DSET", "P", "O", "existing", "verified_existing")


def insert_operation(db, row):
    try:
        db.add(row); db.flush()
    except IntegrityError as exc:
        if getattr(exc.orig, "sqlstate", None) != "23505" and getattr(exc.orig, "sqlite_errorcode", None) not in (1555, 2067):
            raise
        db.rollback()
        error("operation_exists")


def transcript_manifest(row, body, sources, source_token, output_token):
    old = body.expected_descriptor.model_dump()
    key = legacy.linked.key("recording_transcript", body.recording_id)
    if old["key"] != key or old not in sources or old["linked_slot_version"] is None:
        error("source_changed")
    epoch = body.base.base.crypto_epoch
    if epoch < 1:
        error("crypto_epoch_changed")
    p = [d for d in sources if d["key"] != key]
    origin = {"purpose": MT, "operation_id": row.id, "recording_id": body.recording_id, "previous_descriptor": old}
    o = [{"destination_key": d["key"], **{f: d[f] for f in ("is_null", "origin_validator", "origin_row_required", "storage_operation_id", "semantic_origin_id")}} for d in p]
    o.append({"destination_key": key, "is_null": body.is_null, "origin_validator": "linked_mixed_v1", "origin_row_required": False,
        "storage_operation_id": row.id, "semantic_origin_id": row.id})
    return {"schema_version": 3, "purpose": MT, "operation_id": row.id, "server_instance_id": body.server_instance_id,
        "owner_id": row.owner_id, "local_id": row.local_id, "actor_device_id": row.actor_device_id, "mutation_id": row.mutation_id,
        "base": body.base.model_dump(), "source_catalog_digest": body.expected_catalog_digest, "target_epoch": epoch,
        "revision_ref": None, "parent_ref": None, "server_fields": None,
        "control": {"recording_id": body.recording_id, "expected_descriptor": old, "is_null": body.is_null}, "operation_origin": origin,
        "S": [{"descriptor": old, "source_etag": source_token}],
        "DSET": [{"destination_key": key, "source_keys": [key], "source_etag": output_token,
            "output_kind": "linked_text_envelope_v1", "output_epoch": epoch, "is_null": body.is_null,
            "expected_binding": None if body.is_null else ops.binding(row.owner_id, row.local_id, body.server_instance_id, row.id, epoch, key, None, None)}],
        "P": p, "O": sorted(o, key=lambda e: legacy.store.key_order(e["destination_key"])), "existing": [], "verified_existing": []}


def fixed_transcript(row):
    try:
        c = json.loads(row.conditions_json); b = Transcript.model_validate(c["request"]); m = c["M0"]
        if (c["request_type"] != "transcript" or not same(b.model_dump(), c["request"]) or
            (b.owner_id, b.local_id, b.device_id, b.mutation_id) != (row.owner_id, row.local_id, row.actor_device_id, row.mutation_id)):
            error("inconsistent_history")
        sources = sorted([s["descriptor"] for s in m["S"]] + m["P"], key=lambda d: legacy.store.key_order(d["key"]))
        if len({meta.canonical(d["key"]) for d in sources}) != len(sources) or any(
            not same(MixedDescriptor.model_validate(d).model_dump(), d) for d in sources):
            error("inconsistent_history")
        if meta.h({"server_instance_id": b.server_instance_id, "owner_id": b.owner_id, "local_id": b.local_id,
            "context": b.base.model_dump(), "entries": sources}) != b.expected_catalog_digest:
            error("inconsistent_history")
        tokens = [m["S"][0]["source_etag"], m["DSET"][0]["source_etag"]]
        if len(set(tokens)) != 2 or any(str(UUID(t)) != t for t in tokens):
            error("inconsistent_history")
        expected = transcript_manifest(row, b, sources, *tokens)
        if not same(m, expected) or meta.h(expected) != row.manifest_digest:
            error("inconsistent_history")
        return expected
    except (ValueError, TypeError, KeyError, IndexError, HTTPException):
        error("inconsistent_history")


@ops.atomic
def prepare_transcript(db, body):
    legacy.authenticate(db, body.owner_id, body.device_id, body.server_instance_id)
    ops.gate()
    old = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id,
        NoteCryptoTransition.mutation_id == body.mutation_id))
    if old is not None:
        if old.purpose != MT or not same(json.loads(old.conditions_json)["request"], body.model_dump()):
            error("idempotency_mismatch")
        expire(db, old)
        return result(db, old)
    legacy.available(db, body.owner_id, body.local_id)
    current = read.context(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id)
    if not same(current["context"], body.base.model_dump()) or current["catalog_digest"] != body.expected_catalog_digest:
        error("context_changed")
    rec = db.get(Recording, body.recording_id)
    if rec is None or (rec.owner_id, rec.note_local_id) != (body.owner_id, body.local_id):
        error("recording_not_found", 404)
    row = NoteCryptoTransition(id=str(uuid4()), owner_id=body.owner_id, local_id=body.local_id, actor_device_id=body.device_id,
        mutation_id=body.mutation_id, purpose=MT, state="prepared", lease_version=1, created_at=database_now(db),
        expires_at=database_now(db) + timedelta(minutes=30))
    m = transcript_manifest(row, body, read.descriptors(db, body.owner_id, body.local_id), str(uuid4()), str(uuid4()))
    row.conditions_json = meta.canonical({"request": body.model_dump(), "request_type": "transcript", "M0": m,
        "source_row_signatures": ops.row_signatures(db, body.owner_id, body.local_id)})
    row.manifest_digest = meta.h(m); insert_operation(db, row)
    d = m["DSET"][0]
    if not d["is_null"]:
        db.add(NoteCryptoEntry(transition_id=row.id, key_json=meta.canonical(d["destination_key"]), source_etag=d["source_etag"],
            source_kind="client_pending", output_kind=d["output_kind"], representation_epoch=d["output_epoch"], binding_json=meta.canonical(d["expected_binding"])))
    db.add(NoteCryptoFence(owner_id=row.owner_id, local_id=row.local_id, transition_id=row.id)); db.flush()
    return {"http_status": 201, **result(db, row)}


def same(a, b):
    return meta.canonical(a) == meta.canonical(b)


def legacy_execution(row):
    try:
        c, tr = legacy.fixed(row), legacy.receipt(row)
        p = json.loads(row.progress_json)
        bm = p.get("terminal_bundle")
        if tr is None or bm is None or tr["outcome"] not in ("done", "failed"):
            error("original_bundle_unavailable")
        if (type(c["job_id"]) is not int or type(row.job_id) is not int
            or not same(LegacyTerminalReceipt.model_validate(tr).model_dump(), tr)
            or not same(LegacyDispatchReceipt.model_validate(p["dispatch_receipt"]).model_dump(), p["dispatch_receipt"])
            or not same(LegacyBundle.model_validate(bm).model_dump(), bm)
            or not same(LegacySettle.model_validate(p["terminal_core"]).model_dump(), p["terminal_core"])):
            error("inconsistent_analysis_claim")
        dr, core = p["dispatch_receipt"], p["terminal_core"]
        if ((dr["execution_id"], dr["source_digest"], dr["dispatch_id"], dr["run_version"]) !=
            (row.id, c["source_digest"], tr["dispatch_id"], 2)
            or (core["owner_id"], core["local_id"], core["device_id"], core["server_instance_id"], core["execution_id"],
                core["dispatch_id"], core["run_version"], core["lease_version"], core["outcome"], core["local_checkpoint_confirmed"], core["unavailable_reason"]) !=
            (row.owner_id, row.local_id, row.actor_device_id, c["request"]["server_instance_id"], row.id,
                dr["dispatch_id"], row.run_version - 1, row.lease_version, bm["outcome"], True, None)
            or not same(core["bundle_metadata"], bm)):
            error("inconsistent_analysis_claim")
        legacy.validate_bundle(row, LegacyBundle.model_validate(bm))
        return c, tr, bm
    except (ValueError, TypeError, KeyError, AttributeError):
        error("inconsistent_analysis_claim")


def execution(db, body):
    ref = body.execution_ref.model_dump()
    row = db.get(ProtectedAnalysisClaim, ref["execution_id"])
    if row is None or (row.owner_id, row.local_id) != (body.owner_id, body.local_id):
        error("execution_not_found", 404)
    if type(json.loads(row.conditions_json)["request"]["schema_version"]) is not int or json.loads(row.conditions_json)["request"]["schema_version"] != ref["schema_version"]:
        error("execution_schema_mismatch")
    if ref["schema_version"] == 1:
        c, tr, bm = legacy_execution(row)
    else:
        c, tr = claims.fixed(row), claims.receipt(row)
        bm = claims.progress(row).get("terminal_bundle")
    if tr is None or bm is None or tr["outcome"] not in ("done", "failed"):
        error("original_bundle_unavailable")
    if (tr["terminal_run_version"] != ref["terminal_run_version"] or meta.h(tr) != ref["terminal_receipt_digest"]
        or bm["bundle_digest"] != ref["original_bundle_digest"] or c["request"]["server_instance_id"] != body.server_instance_id):
        error("execution_receipt_changed")
    original = {"reference": ref, "source_schema_version": ref["schema_version"], "source_context": c["request"]["source_context"],
        "terminal_receipt": tr, "bundle_metadata": bm}
    return row, c, original


def operation_origin(row, body, original):
    if isinstance(body, Replan):
        return {"purpose": MA, "operation_id": row.id, "request_type": "replan", "execution_ref": body.execution_ref.model_dump(),
            "original_source_context": original["source_context"], "previous_write_id": body.previous_write_id}
    return {"purpose": MA, "operation_id": row.id, "execution_id": body.execution_ref.execution_id, "request_type": "initial",
        "source_context": original["source_context"], "source_digest": original["terminal_receipt"]["source_digest"],
        "terminal_receipt_digest": body.execution_ref.terminal_receipt_digest,
        "original_bundle_digest": body.execution_ref.original_bundle_digest, "previous_write_id": None}


def manifest(row, body, original, c, sources, source_tokens, job_id, output_tokens):
    epoch = body.base.base.crypto_epoch
    initial = isinstance(body, Initial)
    if initial and (not same(original["source_context"], {"server_instance_id": body.server_instance_id, "base": body.base.model_dump(),
        "catalog_digest": body.expected_catalog_digest}) or not same(body.bundle_metadata.model_dump(), original["bundle_metadata"])):
        error("source_changed")
    if not initial and body.target_epoch != epoch:
        error("crypto_epoch_changed")
    outputs, expectations = [], []
    for slot, token in zip(original["bundle_metadata"]["slot_nulls"], output_tokens):
        key = legacy.linked.key(slot["key"]["kind"], job_id)
        outputs.append({"destination_key": key, "source_keys": [], "source_etag": token,
            "output_kind": "linked_text_envelope_v1", "output_epoch": epoch, "is_null": slot["is_null"],
            "expected_binding": None if slot["is_null"] else ops.binding(row.owner_id, row.local_id, body.server_instance_id, row.id, epoch, key, None, None)})
        expectations.append({"destination_key": key, "is_null": slot["is_null"], "origin_validator": "linked_mixed_v1",
            "origin_row_required": False, "storage_operation_id": row.id, "semantic_origin_id": row.id})
    expectations.extend({"destination_key": d["key"], **{f: d[f] for f in ("is_null", "origin_validator", "origin_row_required", "storage_operation_id", "semantic_origin_id")}} for d in sources)
    return {"schema_version": 3, "purpose": MA, "operation_id": row.id, "server_instance_id": body.server_instance_id,
        "owner_id": row.owner_id, "local_id": row.local_id, "actor_device_id": row.actor_device_id, "mutation_id": row.mutation_id,
        "base": body.base.model_dump(), "source_catalog_digest": body.expected_catalog_digest, "target_epoch": epoch,
        "revision_ref": None, "parent_ref": None, "server_fields": None,
        "control": {"request_type": "initial" if initial else "replan", "execution_ref": body.execution_ref.model_dump(),
            "previous_write_id": None if initial else body.previous_write_id, "previous_write_state": "none" if initial else body.previous_write_state,
            "target_epoch": epoch, "confirmed_reuse_original_result": not initial},
        "operation_origin": operation_origin(row, body, original),
        "S": [{"descriptor": d, "source_etag": token} for d, token in zip(sources, source_tokens)],
        "DSET": outputs, "P": sources, "O": sorted(expectations, key=lambda e: legacy.store.key_order(e["destination_key"])),
        "existing": [], "verified_existing": []}


def request_model(stored):
    if stored["request_type"] == "transcript":
        return Transcript.model_validate(stored["request"])
    return (Initial if stored["request_type"] == "initial" else Replan).model_validate(stored["request"])


def fixed(row, seen=None):
    if row.purpose == MT:
        return fixed_transcript(row)
    try:
        seen = set() if seen is None else seen
        if row.id in seen:
            error("inconsistent_history")
        seen = seen | {row.id}
        stored = json.loads(row.conditions_json)
        body = request_model(stored)
        initial = isinstance(body, Initial)
        if (row.purpose != MA or not same(body.model_dump(), stored["request"])
            or tuple(getattr(body, k) for k in ("owner_id", "local_id", "device_id", "mutation_id")) !=
            (row.owner_id, row.local_id, row.actor_device_id, row.mutation_id) or initial and row.id != body.execution_ref.execution_id
            or not initial and row.id == body.execution_ref.execution_id or stored["request_type"] not in ("initial", "replan")):
            error("inconsistent_history")
        db = object_session(row)
        if db is None:
            error("inconsistent_history")
        claim, c, original = execution(db, body)
        if (type(stored["job_id"]) is not int or not 1 <= stored["job_id"] <= 2147483647
            or stored["job_id_mode"] not in ("allocated", "provisional")
            or initial and (stored["job_id"], stored["job_id_mode"]) != (claim.job_id, claim.job_id_mode)):
            error("inconsistent_history")
        if not initial and body.previous_write_id is not None:
            previous_identity(db, body, seen)
        sources = [s["descriptor"] for s in stored["M0"]["S"]]
        tokens = [s["source_etag"] for s in stored["M0"]["S"]]
        if (any(MixedDescriptor.model_validate(d).model_dump() != d for d in sources)
            or any(not isinstance(t, str) or str(UUID(t)) != t for t in tokens)
            or len({meta.canonical(d["key"]) for d in sources}) != len(sources)
            or sources != sorted(sources, key=lambda d: legacy.store.key_order(d["key"]))
            or meta.h({"server_instance_id": body.server_instance_id, "owner_id": row.owner_id, "local_id": row.local_id,
                "context": body.base.model_dump(), "entries": sources}) != body.expected_catalog_digest):
            error("inconsistent_history")
        output_tokens = [s["source_etag"] for s in c["control"]["output_slots"]] if initial else [d["source_etag"] for d in stored["M0"]["DSET"]]
        if len(output_tokens) != 3 or len(set(output_tokens)) != 3 or any(not isinstance(t, str) or str(UUID(t)) != t for t in output_tokens):
            error("inconsistent_history")
        expected = manifest(row, body, original, c, sources, tokens, stored["job_id"], output_tokens)
        if not same(stored["M0"], expected) or meta.h(expected) != row.manifest_digest:
            error("inconsistent_history")
        return expected
    except HTTPException:
        error("inconsistent_history")
    except (ValueError, KeyError, TypeError, AttributeError):
        error("inconsistent_history")


def result(db, row):
    m = fixed(row)
    if row.state == "committed":
        validate_receipt(db, row, m)
    current = read.context(db, row.owner_id, row.local_id, row.actor_device_id, m["server_instance_id"])
    return {"schema_version": 3, "purpose": row.purpose, "operation_id": row.id, "mutation_id": row.mutation_id,
        "state": "uploading" if row.state in ("staging", "ready") else row.state,
        "lease_version": row.lease_version, "expires_at": date(row.expires_at), "metadata_manifest_digest": row.manifest_digest,
        "metadata_header": {k: v for k, v in m.items() if k not in SECTIONS}, "counts": ops.counts(m),
        "receipt": json.loads(row.receipt_json) if row.receipt_json else None, "latest_context": current["context"]}


def intent_execution(db, row, seen=None):
    if row.purpose == MA:
        return fixed(row, seen)["control"]["execution_ref"]["execution_id"]
    from app.services import related_writes
    if row.purpose == related_writes.ANALYSIS:
        return related_writes.fixed(row)["execution_id"]
    error("wrong_operation_state")


def intents(db, body):
    return list(db.scalars(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id,
        NoteCryptoTransition.local_id == body.local_id, NoteCryptoTransition.purpose.in_((MA, "protected_analysis_write")))))


def previous_identity(db, body, seen=None):
    row = db.get(NoteCryptoTransition, body.previous_write_id)
    if (row is None or (row.owner_id, row.local_id) != (body.owner_id, body.local_id)
        or row.state != body.previous_write_state or row.state not in ("stale", "aborted", "expired")
        or intent_execution(db, row, seen) != body.execution_ref.execution_id):
        error("wrong_operation_state")
    return row


def already_stored(db, body, original):
    for row in intents(db, body):
        if row.state != "committed" or intent_execution(db, row) != body.execution_ref.execution_id:
            continue
        if row.purpose == MA:
            validate_receipt(db, row, fixed(row))
        else:
            from app.services import related_writes
            c = related_writes.fixed(row)
            r = json.loads(row.receipt_json)
            records = []
            for slot in c["slots"]:
                if slot["is_null"]:
                    continue
                upload = db.get(NoteCryptoUpload, (row.id, meta.canonical(slot["key"])))
                if upload is None or upload.ciphertext_sha256 is None:
                    error("inconsistent_history")
                records.append({"entry_key": slot["key"], "destination_key": slot["key"], "source_etag": slot["source_etag"],
                    "output_kind": "linked_text_envelope_v1", "target_epoch": c["request"]["target_epoch"],
                    "total_bytes": upload.total_bytes, "ciphertext_sha256": upload.ciphertext_sha256})
            expected = {"write_id": row.id, "purpose": row.purpose, "execution_id": c["execution_id"], "job_id": c["job_id"],
                "recording_id": c["request_core"].get("recording_id"), "source_digest": c["origin"].get("source_digest"),
                "origin_digest": meta.h(c["origin"]), "crypto_epoch": c["request"]["target_epoch"],
                "history_generation": c["base"]["history_generation"] + 1,
                "slot_receipts": [{"key": s["key"], "is_null": s["is_null"], "slot_version": s["target_slot_version"],
                    "storage_operation_id": row.id} for s in c["slots"]],
                "metadata_manifest_digest": row.manifest_digest, "ciphertext_manifest_digest": meta.h(records)}
            if not same(r, expected):
                error("inconsistent_history")
        return {"schema_version": 3, "status": "already_stored", "stored_result": {
            "schema_version": 3 if row.purpose == MA else 1, "operation_id": row.id,
            "status_path": "/api/v2/notes/mixed-analysis-writes/status" if row.purpose == MA else "/api/v2/notes/protected-analysis/status",
            "receipt": json.loads(row.receipt_json)}, "original_execution": original,
            "latest_context": read.context(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id)["context"]}


def prepared(db, row, original, created):
    value = result(db, row)
    if json.loads(row.conditions_json)["request_type"] == "replan":
        value = {"schema_version": 3, "status": "prepared", "operation": value, "original_execution": original}
    return {"created": created, **value}


@ops.atomic
def prepare(db, body, replan=False):
    legacy.authenticate(db, body.owner_id, body.device_id, body.server_instance_id)
    ops.gate()
    previous = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id, NoteCryptoTransition.mutation_id == body.mutation_id))
    if previous is not None:
        if previous.purpose != MA or not same(json.loads(previous.conditions_json)["request"], body.model_dump()):
            error("idempotency_mismatch")
        expire(db, previous)
        _, _, original = execution(db, body)
        return prepared(db, previous, original, False)
    claim, c, original = execution(db, body)
    if replan:
        stored = already_stored(db, body, original)
        if stored:
            return stored
    if not replan and claim.actor_device_id != body.device_id:
        error("transition_actor_mismatch", 403)
    legacy.available(db, body.owner_id, body.local_id)
    current = read.context(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id)
    if not same(current["context"], body.base.model_dump()) or current["catalog_digest"] != body.expected_catalog_digest:
        error("context_changed")
    if not replan and db.get(NoteCryptoTransition, claim.id) is not None:
        error("operation_exists")
    if replan:
        if body.previous_write_id is None:
            if body.previous_write_state != "none" or any(intent_execution(db, p) == claim.id for p in intents(db, body)):
                error("wrong_operation_state")
        else:
            prior = db.get(NoteCryptoTransition, body.previous_write_id)
            if prior is not None:
                expire(db, prior)
            previous_identity(db, body)
        job_id, job_mode = legacy.allocate(db)
        ident, tokens = str(uuid4()), [str(uuid4()) for _ in range(3)]
    else:
        job_id, job_mode = claim.job_id, claim.job_id_mode
        ident, tokens = claim.id, [s["source_etag"] for s in c["control"]["output_slots"]]
    row = NoteCryptoTransition(id=ident, owner_id=body.owner_id, local_id=body.local_id, actor_device_id=body.device_id,
        mutation_id=body.mutation_id, purpose=MA, state="prepared", lease_version=1, created_at=database_now(db),
        expires_at=database_now(db) + timedelta(minutes=30))
    sources = read.descriptors(db, body.owner_id, body.local_id)
    m = manifest(row, body, original, c, sources, [str(uuid4()) for _ in sources], job_id, tokens)
    row.conditions_json = meta.canonical({"request": body.model_dump(), "request_type": "replan" if replan else "initial", "job_id": job_id,
        "job_id_mode": job_mode, "M0": m, "source_row_signatures": ops.row_signatures(db, body.owner_id, body.local_id)})
    row.manifest_digest = meta.h(m)
    insert_operation(db, row)
    for d in m["DSET"]:
        if not d["is_null"]:
            db.add(NoteCryptoEntry(transition_id=row.id, key_json=meta.canonical(d["destination_key"]), source_etag=d["source_etag"],
                source_kind="client_pending", output_kind=d["output_kind"], representation_epoch=d["output_epoch"], binding_json=meta.canonical(d["expected_binding"])))
    db.add(NoteCryptoFence(owner_id=row.owner_id, local_id=row.local_id, transition_id=row.id)); db.flush()
    return prepared(db, row, original, True)


def cipher_records(db, row, m, *, assemble=False):
    required = [d for d in m["DSET"] if not d["is_null"]]
    if {e.key_json for e in db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id))} != {meta.canonical(d["destination_key"]) for d in required}:
        error("manifest_changed")
    records, values = [], {}
    for d in required:
        key = d["destination_key"]; kj = meta.canonical(key)
        entry = db.get(NoteCryptoEntry, (row.id, kj))
        if (entry.source_etag, entry.output_kind, entry.representation_epoch, entry.binding_json) != (
            d["source_etag"], d["output_kind"], d["output_epoch"], meta.canonical(d["expected_binding"])):
            error("manifest_changed")
        upload = db.get(NoteCryptoUpload, (row.id, kj))
        if upload is None or upload.ciphertext_sha256 is None:
            error("incomplete_manifest")
        if assemble:
            data = legacy.store.assembled(db, upload)
            if legacy.store.sha(data) != upload.ciphertext_sha256:
                error("stage_mismatch")
            legacy.store.validate_output(data, d["output_kind"], d["output_epoch"], d["expected_binding"])
            values[key["slot"]] = data.decode()
        records.append({"entry_key": key, "destination_key": key, "source_etag": d["source_etag"], "output_kind": d["output_kind"],
            "target_epoch": d["output_epoch"], "total_bytes": upload.total_bytes, "ciphertext_sha256": upload.ciphertext_sha256})
    if row.purpose == MA and m["control"]["request_type"] == "initial":
        request = request_model(json.loads(row.conditions_json))
        _, _, original = execution(db, request)
        if not same(records, original["bundle_metadata"]["ciphertext_manifest"]):
            error("original_cipher_bundle_mismatch")
    return records, values


def result_context(m):
    return {**m["base"], "base": {**m["base"]["base"], "history_generation": m["base"]["base"]["history_generation"] + 1}}


def receipt(row, m, records, stamp):
    return {"schema_version": 3, "purpose": row.purpose, "operation_id": row.id, "mutation_id": row.mutation_id,
        "server_instance_id": m["server_instance_id"], "owner_id": row.owner_id, "local_id": row.local_id,
        "result": result_context(m), "metadata_manifest_digest": row.manifest_digest,
        "set_digests": {s: meta.h(m[s]) for s in SECTIONS}, "ciphertext_manifest_digest": meta.h(records),
        "origin_expectations_digest": meta.h(m["O"]), "committed_at": stamp}


def validate_receipt(db, row, m):
    from app.schemas.note_v2 import timestamp
    try:
        if row.state != "committed" or row.receipt_json is None:
            error("inconsistent_history")
        r = json.loads(row.receipt_json)
        records, _ = cipher_records(db, row, m)
        if not same(r, receipt(row, m, records, r["committed_at"])) or timestamp(r["committed_at"]) != r["committed_at"]:
            error("inconsistent_history")
        core = LinkedCommit.model_validate_json(row.commit_conditions_json)
        if (not same(core.model_dump(), json.loads(row.commit_conditions_json)) or
            (core.owner_id, core.local_id, core.device_id, core.operation_id, core.mutation_id, core.server_instance_id, core.target_epoch,
             core.metadata_manifest_digest, core.client_verified_ciphertext_manifest_digest) !=
            (row.owner_id, row.local_id, row.actor_device_id, row.id, row.mutation_id, m["server_instance_id"], m["target_epoch"], row.manifest_digest, meta.h(records))
            or not same(core.base.model_dump(), m["base"])):
            error("inconsistent_history")
        stored = json.loads(row.conditions_json)
        if row.purpose == MA:
            request = request_model(stored)
            _, c, original = execution(db, request)
            job = db.get(AnalysisJob, stored["job_id"])
            if (job is None or (job.owner_id, job.note_local_id, job.job_type, job.status, date(job.created_at), date(job.updated_at)) !=
                (row.owner_id, row.local_id, c["request"]["job_type"], original["bundle_metadata"]["outcome"], date(row.created_at), date(row.created_at))):
                error("inconsistent_history")
        else:
            recording_id = stored["request"]["recording_id"]
            def recording_signature(signatures):
                return [s for s in signatures if s["table"] == "recordings" and s["fields"]["id"] == recording_id]
            original = recording_signature(stored["source_row_signatures"])
            if len(original) != 1 or not same(original, recording_signature(ops.row_signatures(db, row.owner_id, row.local_id))):
                error("inconsistent_history")
    except (ValueError, KeyError, TypeError):
        error("inconsistent_history")


@ops.atomic
def status(db, body, purpose):
    row = ops.own(db, body, purpose)
    value = result(db, row)
    if purpose == MT:
        return value
    request = request_model(json.loads(row.conditions_json))
    _, _, original = execution(db, request)
    return {"schema_version": 3, "status": "operation", "operation": value, "original_execution": original}


@ops.atomic
def commit(db, body, purpose):
    ops.gate()
    row = ops.own(db, body, purpose)
    m = fixed(row)
    if row.state == "committed":
        validate_receipt(db, row, m)
        if not same(json.loads(row.commit_conditions_json), body.model_dump()):
            error("idempotency_mismatch")
        return result(db, row)
    if row.state in ("stale", "aborted"):
        return failed(db, row, json.loads(row.conditions_json).get("failure_code", "operation_not_active"))
    row, m = ops.active(db, body, purpose)
    if body.lease_version != row.lease_version:
        error("lease_changed")
    if body.mutation_id != row.mutation_id or body.target_epoch != m["target_epoch"] or not same(body.base.model_dump(), m["base"]):
        error("context_changed")
    records, values = cipher_records(db, row, m, assemble=True)
    if meta.h(records) != body.client_verified_ciphertext_manifest_digest:
        error("verification_manifest_mismatch")
    stored = json.loads(row.conditions_json)
    request = request_model(stored)
    if purpose == MA:
        claim, c, original = execution(db, request)
    scope = (row.owner_id, row.local_id)
    try:
        meta.begin_update(db, *scope)
        if purpose == MA:
            db.execute(AnalysisJob.__table__.insert().values(id=stored["job_id"], owner_id=row.owner_id, note_local_id=row.local_id,
                job_type=c["request"]["job_type"], status=original["bundle_metadata"]["outcome"],
                input_text=values.get("input_text"), result_json=values.get("result_json"), error_message=values.get("error_message"),
                created_at=row.created_at, updated_at=row.created_at))
        else:
            recording = db.get(Recording, request.recording_id)
            db.execute(update(Recording).where(Recording.id == recording.id).values(
                transcript=values.get("transcript"), updated_at=recording.updated_at))
        for d in m["DSET"]:
            key = d["destination_key"]
            if purpose == MA:
                db.add(LinkedText(owner_id=row.owner_id, local_id=row.local_id, key_json=meta.canonical(key),
                    representation_kind=d["output_kind"], representation_epoch=d["output_epoch"], is_null=d["is_null"],
                    storage_operation_id=row.id, slot_version=1))
            else:
                linked = db.get(LinkedText, (row.owner_id, row.local_id, meta.canonical(key)))
                if linked is None:
                    error("inconsistent_related_text")
                linked.representation_kind = d["output_kind"]; linked.representation_epoch = d["output_epoch"]
                linked.is_null = d["is_null"]; linked.storage_operation_id = row.id; linked.slot_version += 1
        ops.install_slots(db, row, m)
        head = db.get(NoteHead, scope)
        head.history_generation += 1
        row.state = "committed"; row.commit_conditions_json = meta.canonical(body.model_dump())
        row.receipt_json = meta.canonical(receipt(row, m, records, date(database_now(db))))
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
    except IntegrityError as exc:
        unique = getattr(exc.orig, "sqlstate", None) == "23505" or getattr(exc.orig, "sqlite_errorcode", None) in (1555, 2067)
        if not unique:
            raise
        db.rollback()
        db.info.get(meta.UPDATING, set()).discard(scope)
        db.expire_all()
        row = ops.own(db, body, purpose)
        if row.state == "committed":
            validate_receipt(db, row, fixed(row))
            if not same(json.loads(row.commit_conditions_json), body.model_dump()):
                error("idempotency_mismatch")
            return result(db, row)
        if row.state == "expired":
            raise ops.Expired(row)
        if row.state in ("stale", "aborted"):
            return failed(db, row, json.loads(row.conditions_json).get("failure_code", "operation_not_active"))
        row, fresh = ops.active(db, body, purpose)
        if not same(fresh, m):
            error("context_changed")
        row.state = "stale"
        conditions = json.loads(row.conditions_json); conditions["failure_code"] = "linked_id_conflict"
        row.conditions_json = meta.canonical(conditions)
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
        return failed(db, row, "linked_id_conflict")
    finally:
        db.info.get(meta.UPDATING, set()).discard(scope)
    return result(db, row)


def failed(db, row, code):
    return {"http_status": 409, "detail": {"code": code, "required_schema_version": None}, "operation": result(db, row)}
