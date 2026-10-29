"""Mixed client execution metadata, separate from legacy C2 wire objects."""
import json
from datetime import timedelta
from uuid import UUID, uuid4

from sqlalchemy import select

from app.models.note import AnalysisJob
from app.models.protected_analysis import ProtectedAnalysisClaim as ClaimRow
from app.schemas.mixed_analysis import Claim, Bundle, Settle, Action
from app.services import protected_analysis as legacy, note_crypto_storage as store
from app.services import note_mixed_read as read, note_mixed_metadata as meta, note_mixed_operations as ops
from app.services.note_crypto_fence import database_now, error
from app.services.note_protected_write import date

SOURCE_FIELDS = ("source_context", "source_keys", "job_type", "prompt_version", "source_job_id")
CONTROL_FIELDS = SOURCE_FIELDS + ("execution_route", "client_execution_confirmed")


def output_slots(row, request, tokens):
    epoch = request["source_context"]["base"]["base"]["crypto_epoch"]
    return [{"key": legacy.linked.key(kind, row.job_id), "source_etag": token,
        "expected_binding": legacy.binding(row.owner_id, row.local_id, request["server_instance_id"], row.id,
            epoch, legacy.linked.key(kind, row.job_id))}
        for kind, token in zip(sorted(k for k in legacy.linked.SLOTS if k.startswith("analysis_")), tokens)]


def fixed(row):
    try:
        c = json.loads(row.conditions_json)
        request = Claim.model_validate(c["request"]).model_dump()
        control = c["control"]
        tokens = [s["source_etag"] for s in control["output_slots"]]
        if (len(tokens) != 3 or any(str(UUID(t)) != t for t in tokens) or len(set(tokens)) != 3
            or request != c["request"] or (row.owner_id, row.local_id, row.actor_device_id, row.mutation_id) !=
            tuple(request[k] for k in ("owner_id", "local_id", "device_id", "mutation_id"))
            or request["source_context"]["server_instance_id"] != request["server_instance_id"]
            or row.state not in legacy.STATES or row.job_id_mode not in ("allocated", "provisional")
            or type(row.job_id) is not int or not 1 <= row.job_id <= 2147483647
            or type(row.run_version) is not int or row.run_version < 1
            or type(row.lease_version) is not int or row.lease_version < 1
            or request["source_context"]["base"]["base"]["crypto_epoch"] < 1
            or c["source_digest"] != meta.h({k: request[k] for k in SOURCE_FIELDS})
            or meta.canonical(control) != meta.canonical({"schema_version": 3, **{k: request[k] for k in CONTROL_FIELDS},
                "job_id": row.job_id, "job_id_mode": row.job_id_mode, "output_slots": output_slots(row, request, tokens)})
            or c["claim_metadata_digest"] != meta.h(control)):
            error("inconsistent_analysis_claim")
        keys = [s["descriptor"]["key"] for s in request["source_keys"]]
        if keys != sorted(keys, key=store.key_order) or len({meta.canonical(k) for k in keys}) != len(keys):
            error("inconsistent_analysis_claim")
        return c
    except (ValueError, KeyError, TypeError):
        error("inconsistent_analysis_claim")


def source_now(db, owner, local, device, instance):
    c = read.context(db, owner, local, device, instance)
    return {"server_instance_id": instance, "base": c["context"], "catalog_digest": c["catalog_digest"]}, read.descriptors(db, owner, local)


def current(db, row, c, device=None):
    sc, ds = source_now(db, row.owner_id, row.local_id, device or row.actor_device_id, c["request"]["server_instance_id"])
    ds = {meta.canonical(d["key"]): d for d in ds}
    matches = sc == c["request"]["source_context"] and all(
        ds.get(meta.canonical(s["descriptor"]["key"])) == s["descriptor"] for s in c["request"]["source_keys"])
    return sc, matches


def progress(row):
    try:
        p = json.loads(row.progress_json)
        if type(p) is not dict:
            error("inconsistent_analysis_claim")
        return p
    except (ValueError, TypeError):
        error("inconsistent_analysis_claim")


def result(db, row, device=None):
    c, p = fixed(row), progress(row)
    receipt(row)
    sc, matches = current(db, row, c, device)
    return {"schema_version": 3, "execution_id": row.id, "job_id": row.job_id, "job_id_mode": row.job_id_mode,
        "state": row.state, "run_version": row.run_version, "lease_version": row.lease_version,
        "expires_at": date(row.expires_at), "source_context": c["request"]["source_context"],
        "source_keys": c["request"]["source_keys"], "source_digest": c["source_digest"],
        "claim_metadata_digest": c["claim_metadata_digest"], "output_slots": c["control"]["output_slots"],
        "dispatch_receipt": p.get("dispatch_receipt"), "terminal_receipt": p.get("terminal_receipt"),
        "bundle_metadata": p.get("terminal_bundle"), "source_matches_current": matches, "latest_context": sc["base"]}


@store.atomic
def claim(db, body):
    legacy.authenticate(db, body.owner_id, body.device_id, body.server_instance_id)
    ops.gate()
    previous = db.scalar(select(ClaimRow).where(ClaimRow.owner_id == body.owner_id, ClaimRow.mutation_id == body.mutation_id))
    if previous:
        if json.loads(previous.conditions_json)["request"] != body.model_dump():
            error("idempotency_mismatch")
        if previous.state == "client_pending" and previous.expires_at <= database_now(db):
            previous.state = "expired"
        return {"created": False, **result(db, previous)}
    legacy.available(db, body.owner_id, body.local_id)
    sc, ds = source_now(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id)
    if sc != body.source_context.model_dump():
        error("source_changed")
    from app.api.analysis import ALLOWED_JOB_TYPES
    if body.job_type not in ALLOWED_JOB_TYPES:
        error("unsupported_job_type")
    keys = [s.model_dump()["descriptor"] for s in body.source_keys]
    by_key = {meta.canonical(d["key"]): d for d in ds}
    if (keys != sorted(keys, key=lambda d: store.key_order(d["key"]))
        or len({meta.canonical(d["key"]) for d in keys}) != len(keys)
        or any(by_key.get(meta.canonical(d["key"])) != d for d in keys)):
        error("unsupported_source_scope")
    if body.source_job_id is not None:
        source = db.get(AnalysisJob, body.source_job_id)
        if source is None or (source.owner_id, source.note_local_id) != (body.owner_id, body.local_id):
            error("source_job_not_found")
    ident, mode = legacy.allocate(db)
    request = body.model_dump()
    row = ClaimRow(id=str(uuid4()), owner_id=body.owner_id, local_id=body.local_id, actor_device_id=body.device_id,
        mutation_id=body.mutation_id, job_id=ident, job_id_mode=mode, state="client_pending", run_version=1, lease_version=1,
        expires_at=database_now(db) + timedelta(minutes=30), progress_json="{}")
    control = {"schema_version": 3, **{k: request[k] for k in CONTROL_FIELDS}, "job_id": ident, "job_id_mode": mode,
        "output_slots": output_slots(row, request, [str(uuid4()) for _ in range(3)])}
    row.conditions_json = meta.canonical({"request": request, "control": control, "claim_metadata_digest": meta.h(control),
        "source_digest": meta.h({k: request[k] for k in SOURCE_FIELDS})})
    db.add(row); db.flush()
    return {"created": True, **result(db, row)}


def own(db, body, *, creator=False):
    legacy.authenticate(db, body.owner_id, body.device_id, body.server_instance_id)
    row = db.get(ClaimRow, body.execution_id)
    if row is None or (row.owner_id, row.local_id) != (body.owner_id, body.local_id):
        error("execution_not_found", 404)
    if json.loads(row.conditions_json)["request"]["schema_version"] != 3:
        error("execution_schema_mismatch")
    c = fixed(row)
    if c["request"]["server_instance_id"] != body.server_instance_id:
        error("server_instance_changed")
    if creator and row.actor_device_id != body.device_id:
        error("transition_actor_mismatch", 403)
    if row.state == "client_pending" and row.expires_at <= database_now(db):
        row.state = "expired"
    return row


@store.atomic
def status(db, body):
    return result(db, own(db, body), body.device_id)


@store.atomic
def source(db, body):
    row = own(db, body)
    receipt(row)
    c = fixed(row)
    _, matches = current(db, row, c, body.device_id)
    if not matches or body.source_digest != c["source_digest"]:
        error("source_changed")
    from app.schemas.note_crypto import RepresentationKey
    try:
        key = RepresentationKey(kind=body.kind, id=body.representation_id, slot=body.slot).model_dump()
    except ValueError:
        error("invalid_representation_key", 422)
    d = next((s["descriptor"] for s in c["request"]["source_keys"] if s["descriptor"]["key"] == key), None)
    if d is None:
        error("source_not_on_server", 404)
    if body.source_etag != d["representation_etag"]:
        error("source_changed")
    value = next(v for k, _, v, _, _ in meta.slots(db, row.owner_id, row.local_id) if k == key)
    return {"schema_version": 3, "execution_id": row.id, "source_digest": c["source_digest"], "descriptor": d,
        **read.framed(value, body.chunk_index)}


@store.atomic
def dispatch(db, body):
    row = own(db, body, creator=True)
    ops.gate()
    legacy.cas(row, body)
    c, p = fixed(row), progress(row)
    receipt(row)
    legacy.available(db, row.owner_id, row.local_id, execution=row.id)
    _, matches = current(db, row, c)
    if (row.state != "client_pending" or p.get("dispatch_receipt") or not matches
        or body.source_digest != c["source_digest"] or body.claim_metadata_digest != c["claim_metadata_digest"]):
        error("execution_not_dispatchable")
    row.state = "client_running"; row.run_version += 1
    p["dispatch_receipt"] = {"schema_version": 3, "execution_id": row.id, "dispatch_id": str(uuid4()),
        "source_digest": c["source_digest"], "run_version": row.run_version}
    row.progress_json = meta.canonical(p)
    return result(db, row)


def validate_bundle(row, bundle):
    c, bm = fixed(row), bundle.model_dump()
    slots = c["control"]["output_slots"]
    epoch = c["request"]["source_context"]["base"]["base"]["crypto_epoch"]
    nulls, records = bm["slot_nulls"], bm["ciphertext_manifest"]
    shape = {n["key"]["slot"]: n["is_null"] for n in nulls}
    if (bm["schema_version"] != 3 or bm["source_digest"] != c["source_digest"] or bm["original_job_id"] != row.job_id
        or bm["original_epoch"] != epoch or [n["key"] for n in nulls] != [s["key"] for s in slots]
        or bm["bundle_digest"] != meta.h({k: v for k, v in bm.items() if k != "bundle_digest"})
        or shape.get("input_text") is not False or shape.get("result_json") != (bm["outcome"] == "failed")
        or shape.get("error_message") != (bm["outcome"] == "done")
        or (bm["error_code"] is None) != (bm["outcome"] == "done")):
        error("invalid_cipher_bundle")
    required = [s for s, n in zip(slots, nulls) if not n["is_null"]]
    if len(records) != len(required) or any((r["entry_key"], r["destination_key"], r["source_etag"], r["target_epoch"]) !=
        (s["key"], s["key"], s["source_etag"], epoch) for r, s in zip(records, required)):
        error("invalid_cipher_bundle")


def receipt(row):
    c, p = fixed(row), progress(row)
    try:
        if set(p) - {"dispatch_receipt", "cancel_core", "terminal_core", "terminal_outcome", "terminal_bundle", "terminal_receipt"}:
            error("inconsistent_analysis_claim")
        dr, tr, bm = p.get("dispatch_receipt"), p.get("terminal_receipt"), p.get("terminal_bundle")
        if dr is not None:
            if (meta.canonical(dr) != meta.canonical({"schema_version": 3, "execution_id": row.id, "dispatch_id": dr["dispatch_id"],
                "source_digest": c["source_digest"], "run_version": 2}) or str(UUID(dr["dispatch_id"])) != dr["dispatch_id"]
                or row.run_version < 2 or row.state in ("client_pending", "expired", "cancelled")):
                error("inconsistent_analysis_claim")
        elif row.state in ("client_running", "cancel_requested", "client_settled", "result_unavailable"):
            error("inconsistent_analysis_claim")
        elif row.state in ("client_pending", "expired") and row.run_version != 1:
            error("inconsistent_analysis_claim")
        if tr is None:
            if row.state in legacy.TERMINAL or bm is not None or p.get("terminal_core") is not None:
                error("inconsistent_analysis_claim")
            return None
        outcome = p["terminal_outcome"]
        if (row.state != ("client_settled" if outcome in ("done", "failed") else outcome) or meta.canonical(tr) != meta.canonical({
            "schema_version": 3, "execution_id": row.id, "original_job_id": row.job_id,
            "dispatch_id": dr["dispatch_id"] if dr else None, "source_digest": c["source_digest"],
            "terminal_run_version": row.run_version, "outcome": outcome, "bundle_digest": bm["bundle_digest"] if bm else None,
            "client_reported": True, "external_settled": True, "result_server_persisted": False})):
            error("inconsistent_analysis_claim")
        if outcome == "cancelled":
            if dr is not None or bm is not None or "terminal_core" in p:
                error("inconsistent_analysis_claim")
            core = Action.model_validate(p["cancel_core"]).model_dump()
        else:
            core = Settle.model_validate(p["terminal_core"]).model_dump()
            if (core["dispatch_id"] != dr["dispatch_id"] or core["claim_metadata_digest"] != c["claim_metadata_digest"]
                or core["outcome"] != outcome or core["bundle_metadata"] != bm
                or core["local_checkpoint_confirmed"] != (bm is not None)
                or (core["unavailable_reason"] is None) != (bm is not None)):
                error("inconsistent_analysis_claim")
            if outcome in ("done", "failed"):
                if bm is None or bm["outcome"] != outcome or not core["local_checkpoint_confirmed"] or core["unavailable_reason"] is not None:
                    error("inconsistent_analysis_claim")
            elif outcome != "result_unavailable" or bm is not None or core["local_checkpoint_confirmed"] or core["unavailable_reason"] is None:
                error("inconsistent_analysis_claim")
        if (tuple(core[f] for f in ("owner_id", "local_id", "device_id", "server_instance_id", "execution_id")) !=
            (row.owner_id, row.local_id, row.actor_device_id, c["request"]["server_instance_id"], row.id)
            or core["run_version"] != row.run_version - 1 or core["lease_version"] != row.lease_version):
            error("inconsistent_analysis_claim")
        if bm is not None:
            validate_bundle(row, Bundle.model_validate(bm))
        return tr
    except (ValueError, KeyError, TypeError):
        error("inconsistent_analysis_claim")


def finish(row, p, outcome, bundle=None):
    row.state = "client_settled" if outcome in ("done", "failed") else outcome
    row.run_version += 1
    c = fixed(row)
    p.update(terminal_outcome=outcome, terminal_bundle=bundle)
    dr = p.get("dispatch_receipt")
    p["terminal_receipt"] = {"schema_version": 3, "execution_id": row.id, "original_job_id": row.job_id,
        "dispatch_id": dr["dispatch_id"] if dr else None, "source_digest": c["source_digest"],
        "terminal_run_version": row.run_version, "outcome": outcome, "bundle_digest": bundle["bundle_digest"] if bundle else None,
        "client_reported": True, "external_settled": True, "result_server_persisted": False}
    row.progress_json = meta.canonical(p)


@store.atomic
def action(db, body, operation):
    row = own(db, body, creator=True)
    receipt(row)
    p = progress(row)
    if operation == "cancel" and p.get("cancel_core") == body.model_dump():
        return result(db, row)
    legacy.cas(row, body)
    if row.state in legacy.TERMINAL:
        error("execution_not_active")
    if operation == "renew":
        if row.expires_at <= database_now(db):
            error("execution_expired", 410)
        row.lease_version += 1; row.expires_at = database_now(db) + timedelta(minutes=30)
    else:
        p["cancel_core"] = body.model_dump()
        if p.get("dispatch_receipt"):
            row.state = "cancel_requested"; row.run_version += 1
            row.progress_json = meta.canonical(p)
        else:
            finish(row, p, "cancelled")
    return result(db, row)


@store.atomic
def settle(db, body):
    row = own(db, body, creator=True)
    c, p = fixed(row), progress(row)
    receipt(row)
    if p.get("terminal_core") is not None:
        if p["terminal_core"] != body.model_dump():
            error("terminal_mismatch")
        return result(db, row)
    legacy.cas(row, body)
    dr = p.get("dispatch_receipt")
    if (row.state not in ("client_running", "cancel_requested") or dr is None or dr["dispatch_id"] != body.dispatch_id
        or body.claim_metadata_digest != c["claim_metadata_digest"]):
        error("execution_not_settleable")
    if body.outcome == "result_unavailable":
        if body.bundle_metadata is not None or body.local_checkpoint_confirmed or body.unavailable_reason is None:
            error("invalid_cipher_bundle")
    else:
        if (body.bundle_metadata is None or not body.local_checkpoint_confirmed or body.unavailable_reason is not None
            or body.bundle_metadata.outcome != body.outcome):
            error("invalid_cipher_bundle")
        validate_bundle(row, body.bundle_metadata)
    p["terminal_core"] = body.model_dump()
    finish(row, p, body.outcome, body.bundle_metadata.model_dump() if body.bundle_metadata else None)
    return result(db, row)
