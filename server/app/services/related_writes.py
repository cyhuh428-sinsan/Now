"""Purpose-scoped cipher writes: new analysis triples or one existing transcript."""
import base64
import json
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.models.note import AnalysisJob, Recording
from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence, NoteCryptoUpload
from app.models.note_history import NoteHead
from app.models.note_related import LinkedText
from app.schemas.protected_analysis import ResultPrepare, Replan, TranscriptPrepare, BaseContext
from app.services import note_crypto as prep, note_crypto_storage as store, related_text as linked, protected_analysis as claims
from app.services.note_crypto_fence import ACTIVE_STATES, active_fence, database_now, error

ANALYSIS = "protected_analysis_write"
TRANSCRIPT = "protected_transcript_write"
PURPOSES = (ANALYSIS, TRANSCRIPT)
h = claims.h


def metadata(row, c):
    return {"schema_version": 1, "purpose": row.purpose, "write_id": row.id, "server_instance_id": c["server_instance_id"],
        "owner_id": row.owner_id, "local_id": row.local_id, "actor_device_id": row.actor_device_id, "base": c["base"],
        "target_epoch": c["request"]["target_epoch"], "execution_id": c["execution_id"], "job_id_mode": c["job_id_mode"],
        "drain_ref": None, "linked_metadata_version": 1}


def fixed(row):
    try:
        c = json.loads(row.conditions_json)
        cls = TranscriptPrepare if row.purpose == TRANSCRIPT else Replan if c["request_type"] == "replan" else ResultPrepare
        request = cls.model_validate(c["request_core"]).model_dump()
        if (row.purpose not in PURPOSES or type(c["linked_write_version"]) is not int or c["linked_write_version"] != 1
            or request != c["request_core"] or request["base"] != BaseContext.model_validate(c["base"]).model_dump()
            or tuple(request[k] for k in ("owner_id", "local_id", "device_id", "mutation_id")) !=
                (row.owner_id, row.local_id, row.actor_device_id, row.mutation_id)
            or request["server_instance_id"] != c["server_instance_id"] or c["request"]["target_epoch"] != c["base"]["crypto_epoch"]
            or row.manifest_digest != h({**metadata(row, c), "slots": c["slots"], "origin": c["origin"]})):
            error("inconsistent_related_text")
        keys = [s["key"] for s in c["slots"]]
        expected = [linked.key(k, c["job_id"]) for k in sorted(k for k in linked.SLOTS if k.startswith("analysis_"))] if row.purpose == ANALYSIS else [linked.key("recording_transcript", request["recording_id"])]
        if keys != expected:
            error("inconsistent_related_text")
        for s in c["slots"]:
            if (set(s) != {"key", "is_null", "source_slot_version", "target_slot_version", "expected_representation_etag", "source_etag", "expected_binding", "operation_origin"}
                or type(s["is_null"]) is not bool or type(s["source_slot_version"]) is not int or s["source_slot_version"] < 0
                or type(s["target_slot_version"]) is not int or s["target_slot_version"] != s["source_slot_version"] + 1
                or s["operation_origin"] is not None or (s["source_etag"] is None) != s["is_null"]
                or s["expected_binding"] != claims.binding(row.owner_id, row.local_id, c["server_instance_id"], row.id,
                    c["request"]["target_epoch"], s["key"])):
                error("inconsistent_related_text")
        return c
    except (ValueError, TypeError, KeyError):
        error("inconsistent_related_text")


def own(db, owner, local, device, instance, ident, purpose, *, creator=False):
    claims.authenticate(db, owner, device, instance)
    row = prep.owned(db, owner, local, device, ident, purpose)
    c = fixed(row)
    if c["server_instance_id"] != instance:
        error("server_instance_changed")
    if creator and row.actor_device_id != device:
        error("transition_actor_mismatch", 403)
    return row


def signature(row):
    return {k: getattr(row, k).isoformat(timespec="microseconds") if isinstance(getattr(row, k), datetime) else getattr(row, k)
        for k in ("owner_id", "note_local_id", "device_id", "local_id", "file_name", "content_type", "storage_path", "created_at", "updated_at")}


def transcript_source(db, owner, local, ident):
    row = db.get(Recording, ident)
    if row is None or (row.owner_id, row.note_local_id) != (owner, local):
        error("recording_not_found", 404)
    key = linked.key("recording_transcript", ident)
    source = next(d for d, raw in store.live_entries(db, owner, local) if d["key"] == key)
    return row, source


def validate_sources(db, row):
    c = fixed(row)
    expected = {linked.canonical(s["key"]): s for s in c["slots"] if not s["is_null"]}
    entries = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
    if len(entries) != len(expected):
        error("manifest_changed")
    for entry in entries:
        slot = expected.get(entry.key_json)
        if (slot is None or entry.source_etag != slot["source_etag"] or entry.output_kind != "linked_text_envelope_v1"
            or entry.source_kind != ("client_pending" if row.purpose == ANALYSIS else "linked_text_envelope_v1")
            or entry.representation_epoch != c["request"]["target_epoch"] or json.loads(entry.binding_json) != slot["expected_binding"]):
            error("manifest_changed")
    if prep.base_state(db, row.owner_id, row.local_id, baseline=False) != c["base"]:
        error("version_conflict")
    if row.purpose == ANALYSIS:
        claim = db.get(claims.ClaimRow, c["execution_id"])
        tr = claims.receipt(claim) if claim else None
        if (claim is None or (claim.owner_id, claim.local_id) != (row.owner_id, row.local_id)
            or tr is None or h(tr) != c["terminal_receipt_digest"] or tr["outcome"] not in ("done", "failed")):
            error("inconsistent_analysis_claim")
    else:
        target, d = transcript_source(db, row.owner_id, row.local_id, c["request_core"]["recording_id"])
        s = c["slots"][0]
        if signature(target) != c["recording_signature"] or d["slot_version"] != s["source_slot_version"] or d["representation_etag"] != s["expected_representation_etag"]:
            error("source_changed")


def response(db, row, *, detailed=False):
    c = fixed(row)
    value = {"schema_version": 1, "state": row.state, "write_id": row.id, "purpose": row.purpose,
        "lease_version": row.lease_version, "expires_at": row.expires_at.isoformat(timespec="microseconds") + "Z",
        "metadata_context": metadata(row, c), "origin": c["origin"], "slots": c["slots"],
        "metadata_manifest_digest": row.manifest_digest, "current_context": store.current_context(db, row.owner_id, row.local_id)}
    if row.receipt_json:
        receipt = json.loads(row.receipt_json)
        if not detailed:
            compact = {"schema_version": 1, "state": row.state, "receipt": receipt, "current_context": value["current_context"]}
            if row.state == "committed":
                compact.update(receipt_matches_current=receipt["crypto_epoch"] == value["current_context"]["crypto_epoch"] and
                    receipt["history_generation"] == value["current_context"]["history_generation"], source_matches_current=False)
            return compact
        value["receipt"] = receipt
    elif detailed:
        value["receipt"] = None
    return value


def previous(db, body, purpose):
    row = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id,
        NoteCryptoTransition.mutation_id == body.mutation_id))
    if row:
        if row.purpose != purpose or fixed(row)["request_core"] != body.model_dump():
            error("idempotency_mismatch")
        return own(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id, row.id, purpose, creator=True)


def already_stored(db, execution, owner, local):
    for row in db.scalars(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == owner, NoteCryptoTransition.local_id == local,
        NoteCryptoTransition.purpose == ANALYSIS, NoteCryptoTransition.state == "committed")):
        if fixed(row)["execution_id"] == execution:
            return {"http_status": 409, "detail": {"code": "result_already_committed"}, **response(db, row)}
    return None


def create(db, body, purpose, ident, job_id, mode, execution, origin, specs, *, terminal_digest=None, record_signature=None, kind="initial"):
    c = {"linked_write_version": 1, "request_type": kind, "request_core": body.model_dump(), "request": {"target_epoch": body.base.crypto_epoch},
        "server_instance_id": body.server_instance_id, "base": body.base.model_dump(), "execution_id": execution,
        "job_id": job_id, "job_id_mode": mode, "origin": origin, "terminal_receipt_digest": terminal_digest,
        "recording_signature": record_signature, "slots": []}
    for key, is_null, version, etag, source_etag in specs:
        c["slots"].append({"key": key, "is_null": is_null, "source_slot_version": version, "target_slot_version": version + 1,
            "expected_representation_etag": etag, "source_etag": None if is_null else source_etag,
            "expected_binding": claims.binding(body.owner_id, body.local_id, body.server_instance_id, ident, body.base.crypto_epoch, key), "operation_origin": None})
    c["slots"].sort(key=lambda s: store.key_order(s["key"]))
    row = NoteCryptoTransition(id=ident, owner_id=body.owner_id, local_id=body.local_id, actor_device_id=body.device_id,
        mutation_id=body.mutation_id, purpose=purpose, state="prepared" if any(not s["is_null"] for s in c["slots"]) else "ready",
        lease_version=1, expires_at=database_now(db) + timedelta(minutes=30), created_at=database_now(db), manifest_digest="", conditions_json="")
    row.conditions_json = linked.canonical(c); row.manifest_digest = h({**metadata(row, c), "slots": c["slots"], "origin": origin})
    db.add(row); db.flush()
    for s in c["slots"]:
        if not s["is_null"]:
            db.add(NoteCryptoEntry(transition_id=row.id, key_json=linked.canonical(s["key"]), source_etag=s["source_etag"],
                source_kind="client_pending" if purpose == ANALYSIS else "linked_text_envelope_v1", output_kind="linked_text_envelope_v1",
                representation_epoch=body.base.crypto_epoch, binding_json=linked.canonical(s["expected_binding"])))
    db.add(NoteCryptoFence(owner_id=row.owner_id, local_id=row.local_id, transition_id=row.id)); db.flush()
    return {"created": True, **response(db, row)}


def claim_origin(row, c, bm, previous_write):
    p = json.loads(row.progress_json)
    return {"execution_id": row.id, "dispatch_id": p["dispatch_receipt"]["dispatch_id"], "original_job_id": row.job_id,
        "source_job_id": c["request"]["source_job_id"], "source_context": c["request"]["source_context"],
        "source_keys": c["request"]["source_keys"], "source_digest": c["source_digest"], "original_bundle_digest": bm["bundle_digest"],
        "previous_write_id": previous_write}


@store.atomic
def prepare_analysis(db, body, *, replan=False):
    claims.authenticate(db, body.owner_id, body.device_id, body.server_instance_id)
    old = previous(db, body, ANALYSIS)
    if old:
        return {"created": False, **response(db, old)}
    claims.available(db, body.owner_id, body.local_id)
    row = claims.own(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id, body.execution_id, creator=not replan)
    c, tr = claims.fixed(row), claims.receipt(row)
    p = json.loads(row.progress_json); bm = p.get("terminal_bundle")
    if tr is None or bm is None or tr["outcome"] not in ("done", "failed") or h(tr) != body.terminal_receipt_digest:
        error("execution_not_settled")
    stored = already_stored(db, row.id, row.owner_id, row.local_id)
    if stored:
        return stored
    current, _ = claims.source_now(db, row.owner_id, row.local_id)
    if body.base.model_dump() != current["base"]:
        error("version_conflict")
    if replan:
        if body.original_bundle_digest != bm["bundle_digest"] or body.target_epoch != current["base"]["crypto_epoch"]:
            error("cipher_bundle_changed")
        if body.previous_write_id is None:
            if body.previous_write_state != "none" or db.get(NoteCryptoTransition, row.id) is not None:
                error("wrong_operation_state")
        else:
            prior = db.get(NoteCryptoTransition, body.previous_write_id)
            if (prior is None or prior.purpose != ANALYSIS or (prior.owner_id, prior.local_id) != (row.owner_id, row.local_id)
                or fixed(prior)["execution_id"] != row.id):
                error("wrong_operation_state")
            prep.owned(db, row.owner_id, row.local_id, body.device_id, prior.id, ANALYSIS)
            if prior.state != body.previous_write_state or prior.state not in ("stale", "expired", "aborted"):
                error("wrong_operation_state")
        ident = str(uuid4()); job_id, mode = claims.allocate(db)
    else:
        if body.terminal_run_version != tr["terminal_run_version"] or body.bundle_metadata.model_dump() != bm:
            error("cipher_bundle_changed")
        if current != c["request"]["source_context"]:
            error("source_changed")
        if db.get(NoteCryptoTransition, row.id) is not None:
            error("wrong_operation_state")
        ident, job_id, mode = row.id, row.job_id, row.job_id_mode
    original_etags = {r["entry_key"]["kind"]: r["source_etag"] for r in bm["ciphertext_manifest"]}
    specs = [(linked.key(s["key"]["kind"], job_id), s["is_null"], 0, None,
        str(uuid4()) if replan else original_etags.get(s["key"]["kind"])) for s in bm["slot_nulls"]]
    return create(db, body, ANALYSIS, ident, job_id, mode, row.id, claim_origin(row, c, bm, body.previous_write_id if replan else None),
        specs, terminal_digest=h(tr), kind="replan" if replan else "initial")


@store.atomic
def prepare_transcript(db, body):
    claims.authenticate(db, body.owner_id, body.device_id, body.server_instance_id)
    old = previous(db, body, TRANSCRIPT)
    if old:
        return {"created": False, **response(db, old)}
    claims.available(db, body.owner_id, body.local_id)
    sc, _ = claims.source_now(db, body.owner_id, body.local_id)
    if sc["base"] != body.base.model_dump():
        error("version_conflict")
    row, d = transcript_source(db, body.owner_id, body.local_id, body.recording_id)
    if (d["slot_version"], d["representation_etag"]) != (body.expected_slot_version, body.expected_representation_etag):
        error("source_changed")
    origin = {"recording_id": row.id, "previous_slot_version": d["slot_version"], "previous_representation_etag": d["representation_etag"]}
    return create(db, body, TRANSCRIPT, str(uuid4()), None, None, None, origin,
        [(d["key"], body.is_null, d["slot_version"], d["representation_etag"], str(uuid4()))], record_signature=signature(row))


@store.atomic
def status(db, owner, local, device, instance, ident, purpose):
    return response(db, own(db, owner, local, device, instance, ident, purpose), detailed=True)


@store.atomic
def manifest(db, owner, local, device, instance, ident, purpose, digest, limit, cursor):
    row = own(db, owner, local, device, instance, ident, purpose)
    c = fixed(row)
    if digest != row.manifest_digest:
        error("manifest_changed")
    scope = {"owner": owner, "local": local, "device": device, "instance": instance, "write_id": ident, "digest": digest}
    start = 0
    if cursor:
        try:
            parsed = json.loads(base64.urlsafe_b64decode(cursor))
            if parsed["scope"] != scope or set(parsed) != {"scope", "last"}:
                error("manifest_changed")
            start = [s["key"] for s in c["slots"]].index(parsed["last"]) + 1
        except (ValueError, KeyError, TypeError):
            error("invalid_cursor", 422)
    page = c["slots"][start:start + limit]
    next_cursor = base64.urlsafe_b64encode(store.canonical_bytes({"scope": scope, "last": page[-1]["key"]})).decode() if start + limit < len(c["slots"]) else None
    return {"metadata_context": metadata(row, c), "origin": c["origin"], "metadata_manifest_digest": row.manifest_digest,
        "slot_count": len(c["slots"]), "slots": page, "next_cursor": next_cursor}


@store.atomic
def action(db, body, purpose, operation):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id, body.write_id, purpose, creator=True)
    if row.state not in ACTIVE_STATES:
        if operation == "abort" and row.state == "aborted":
            return response(db, row, detailed=True)
        error("write_expired" if row.state == "expired" else "write_not_active", 410 if row.state == "expired" else 409)
    if body.lease_version != row.lease_version:
        error("lease_changed")
    if operation == "abort":
        row.state = "aborted"
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    else:
        row.lease_version += 1; row.expires_at = database_now(db) + timedelta(minutes=30)
    return response(db, row, detailed=True)


def stale(db, row, code):
    c = fixed(row)
    row.state = "stale"
    row.receipt_json = linked.canonical({"write_id": row.id, "state": "stale", "code": code,
        "metadata_manifest_digest": row.manifest_digest, "origin_digest": h(c["origin"])})
    db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    return {"http_status": 409, "detail": {"code": code}, **response(db, row)}


@store.atomic
def commit(db, body, purpose):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id, body.write_id, purpose, creator=True)
    c, core = fixed(row), linked.canonical(body.model_dump())
    if row.state == "committed":
        if row.commit_conditions_json != core:
            error("idempotency_mismatch")
        return response(db, row)
    if row.state == "stale":
        return {"http_status": 409, "detail": {"code": json.loads(row.receipt_json)["code"]}, **response(db, row)}
    if row.state not in ACTIVE_STATES:
        error("write_expired" if row.state == "expired" else "write_not_active", 410 if row.state == "expired" else 409)
    if body.mutation_id != row.mutation_id or body.target_epoch != c["request"]["target_epoch"] or body.metadata_manifest_digest != row.manifest_digest:
        error("manifest_changed")
    fence = active_fence(db, row.owner_id, row.local_id)
    if fence is None or fence.id != row.id:
        error("inconsistent_crypto_fence")
    if prep.base_state(db, row.owner_id, row.local_id, baseline=False) != c["base"]:
        return stale(db, row, "version_conflict")
    validate_sources(db, row)
    if purpose == ANALYSIS:
        duplicate = already_stored(db, c["execution_id"], row.owner_id, row.local_id)
        if duplicate:
            return duplicate
    entries = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
    expected = [s for s in c["slots"] if not s["is_null"]]
    if {e.key_json for e in entries} != {linked.canonical(s["key"]) for s in expected}:
        error("manifest_changed")
    records, values = [], {}
    for s in expected:
        upload = db.get(NoteCryptoUpload, (row.id, linked.canonical(s["key"])))
        if upload is None or upload.ciphertext_sha256 is None:
            error("incomplete_manifest")
        raw = store.assembled(db, upload)
        if store.sha(raw) != upload.ciphertext_sha256:
            error("stage_mismatch")
        store.validate_output(raw, "linked_text_envelope_v1", body.target_epoch, s["expected_binding"])
        values[s["key"]["slot"]] = raw.decode()
        records.append({"entry_key": s["key"], "destination_key": s["key"], "source_etag": s["source_etag"],
            "output_kind": "linked_text_envelope_v1", "target_epoch": body.target_epoch, "total_bytes": len(raw), "ciphertext_sha256": store.sha(raw)})
    if body.client_verified_ciphertext_manifest_digest != h(records):
        error("verification_manifest_mismatch")
    if purpose == ANALYSIS and c["request_type"] == "initial":
        original_claim = db.get(claims.ClaimRow, c["execution_id"])
        original_bundle = json.loads(original_claim.progress_json)["terminal_bundle"]
        if records != original_bundle["ciphertext_manifest"]:
            error("original_cipher_bundle_mismatch")
    try:
        if purpose == ANALYSIS:
            claim = db.get(claims.ClaimRow, c["execution_id"])
            bm = json.loads(claim.progress_json)["terminal_bundle"]
            db.execute(AnalysisJob.__table__.insert().values(id=c["job_id"], owner_id=row.owner_id, note_local_id=row.local_id,
                job_type=claims.fixed(claim)["request"]["job_type"], status=bm["outcome"],
                input_text=values.get("input_text"), result_json=values.get("result_json"), error_message=values.get("error_message"),
                created_at=datetime.utcnow(), updated_at=datetime.utcnow()))
        else:
            db.execute(Recording.__table__.update().where(Recording.id == c["request_core"]["recording_id"], Recording.owner_id == row.owner_id,
                Recording.note_local_id == row.local_id).values(transcript=values.get("transcript"), updated_at=datetime.utcnow()))
        for s in c["slots"]:
            meta = db.get(LinkedText, (row.owner_id, row.local_id, linked.canonical(s["key"])))
            if purpose == ANALYSIS:
                if meta is not None:
                    error("inconsistent_related_text")
                meta = LinkedText(owner_id=row.owner_id, local_id=row.local_id, key_json=linked.canonical(s["key"]))
                db.add(meta)
            meta.representation_kind, meta.representation_epoch = "linked_text_envelope_v1", body.target_epoch
            meta.storage_operation_id, meta.slot_version, meta.is_null = row.id, s["target_slot_version"], s["is_null"]
        head = db.get(NoteHead, (row.owner_id, row.local_id)); head.history_generation += 1
        row.state, row.commit_conditions_json = "committed", core
        row.receipt_json = linked.canonical({"write_id": row.id, "purpose": purpose, "execution_id": c["execution_id"], "job_id": c["job_id"],
            "recording_id": c["request_core"].get("recording_id"), "source_digest": c["origin"].get("source_digest"), "origin_digest": h(c["origin"]),
            "crypto_epoch": body.target_epoch, "history_generation": head.history_generation,
            "slot_receipts": [{"key": s["key"], "is_null": s["is_null"], "slot_version": s["target_slot_version"], "storage_operation_id": row.id} for s in c["slots"]],
            "metadata_manifest_digest": row.manifest_digest, "ciphertext_manifest_digest": h(records)})
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id)); db.flush()
    except IntegrityError:
        ident, owner, local, device, instance, candidate = row.id, row.owner_id, row.local_id, row.actor_device_id, c["server_instance_id"], c["job_id"]
        db.rollback()
        from app.services.note_history import lock_note_writes
        lock_note_writes(db, [owner])
        db.expire_all()
        row = own(db, owner, local, device, instance, ident, purpose, creator=True)
        if row.state == "committed":
            if row.commit_conditions_json != core:
                error("idempotency_mismatch")
            return response(db, row)
        if row.state == "stale":
            return {"http_status": 409, "detail": {"code": json.loads(row.receipt_json)["code"]}, **response(db, row)}
        if row.state not in ACTIVE_STATES:
            return {"http_status": 410 if row.state == "expired" else 409,
                "detail": {"code": "write_expired" if row.state == "expired" else "write_not_active"}, **response(db, row, detailed=True)}
        current = fixed(row)
        fence = active_fence(db, owner, local)
        if fence is None or fence.id != row.id:
            error("inconsistent_crypto_fence")
        if body.mutation_id != row.mutation_id or body.metadata_manifest_digest != row.manifest_digest or body.target_epoch != current["request"]["target_epoch"]:
            error("manifest_changed")
        if prep.base_state(db, owner, local, baseline=False) != current["base"]:
            return stale(db, row, "version_conflict")
        if purpose == ANALYSIS and db.get(AnalysisJob, candidate) is not None:
            return stale(db, row, "provisional_job_id_conflict")
        error("storage_integrity_error", 500)
    db.expire_all()
    return response(db, db.get(NoteCryptoTransition, row.id))


def validate_live(op, key, meta, raw):
    c, receipt = fixed(op), json.loads(op.receipt_json)
    expected = next((s for s in c["slots"] if s["key"] == key), None)
    if (op.state != "committed" or expected is None or expected["is_null"] != (raw is None)
        or meta.slot_version != expected["target_slot_version"] or meta.representation_epoch != c["request"]["target_epoch"]
        or receipt.get("metadata_manifest_digest") != op.manifest_digest or receipt.get("origin_digest") != h(c["origin"])
        or {"key": key, "is_null": raw is None, "slot_version": meta.slot_version, "storage_operation_id": op.id} not in receipt.get("slot_receipts", [])):
        error("inconsistent_related_text")
    return expected["expected_binding"]


def job_origin(db, owner, local, ident):
    found = []
    for row in db.scalars(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == owner,
        NoteCryptoTransition.local_id == local, NoteCryptoTransition.purpose == ANALYSIS, NoteCryptoTransition.state == "committed")):
        c = fixed(row)
        if c["job_id"] == ident:
            receipt = json.loads(row.receipt_json)
            if receipt.get("job_id") != ident or receipt.get("origin_digest") != h(c["origin"]):
                error("inconsistent_related_text")
            found.append((row.id, c["origin"]))
    if len(found) > 1:
        error("inconsistent_related_text")
    return found[0] if found else (None, None)
