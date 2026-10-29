"""Client execution claims contain no raw Provider input, output, or credential."""
import json
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import func, select

from app.models.note import AnalysisJob
from app.models.note_crypto import NoteCryptoTransition
from app.models.protected_analysis import ProtectedAnalysisClaim as ClaimRow
from app.schemas.protected_analysis import Claim, Bundle
from app.services import note_crypto as prep, note_crypto_storage as store, related_text as linked
from app.services.note_crypto_fence import database_now, error, require_unfenced

TERMINAL = ("client_settled", "result_unavailable", "cancelled")
STATES = ("client_pending", "client_running", "cancel_requested", "expired") + TERMINAL
BASE = ("head_version", "head_revision_id", "crypto_epoch", "history_generation", "protection_state",
        "inventory_revision_ids", "identity_state", "current_exists")


def h(value):
    return store.sha(store.canonical_bytes(value))


def binding(owner, local, instance, operation, epoch, key):
    return {"server_instance_id": instance, "owner_id": owner, "local_id": local, "transition_id": operation,
        "crypto_epoch": epoch, "destination_key": key, "revision_ref": None, "parent_ref": None}


def allocate(db):
    if db.bind.dialect.name == "postgresql":
        value = db.scalar(select(func.nextval(func.pg_get_serial_sequence("analysis_jobs", "id"))))
        mode = "allocated"
    else:
        value, mode = (db.scalar(select(func.max(AnalysisJob.id))) or 0) + 1, "provisional"
    if type(value) is not int or value < 1 or value > 2147483647:
        error("id_space_exhausted", 507)
    return value, mode


def authenticate(db, owner, device, instance):
    prep.authenticate_actor(db, owner, device)
    if instance != prep.initialize_identity(db.connection()):
        error("server_instance_changed")


def available(db, owner, local, *, execution=None):
    require_unfenced(db, [(owner, local)])
    drain = linked.active_drain(db, owner, local)
    if drain is not None and (execution is None or execution not in [r["execution_id"] for r in json.loads(drain.conditions_json).get("accepted_claims", [])]):
        error("related_drain_in_progress", 423)


def source_now(db, owner, local):
    base = prep.base_state(db, owner, local)
    if base["crypto_epoch"] < 1:
        error("protected_representation_required")
    rows = store.live_entries(db, owner, local)
    context = {"server_instance_id": prep.initialize_identity(db.connection()),
        **{k: v for k, v in base.items() if k not in ("inventory_revision_ids", "protection_state")}}
    digest = h({"context": context, "items": [r[0] for r in rows]})
    return {"server_instance_id": context["server_instance_id"], "base": base, "catalog_digest": digest}, rows


def fixed(row):
    try:
        c = json.loads(row.conditions_json)
        request = Claim.model_validate(c["request"]).model_dump()
        expected = h({k: request[k] for k in ("source_context", "source_keys", "job_type", "prompt_version", "source_job_id")})
        if (request != c["request"] or (row.owner_id, row.local_id, row.actor_device_id, row.mutation_id) !=
            tuple(request[k] for k in ("owner_id", "local_id", "device_id", "mutation_id")) or c["source_digest"] != expected
            or row.state not in STATES or row.job_id_mode not in ("allocated", "provisional")
            or c["job_id"] != row.job_id or c["job_id_mode"] != row.job_id_mode):
            error("inconsistent_analysis_claim")
        return c
    except (ValueError, KeyError, TypeError):
        error("inconsistent_analysis_claim")


def original_slots(row, c):
    return [{"key": linked.key(kind, row.job_id), "initial_slot_version": 0,
        "expected_binding": binding(row.owner_id, row.local_id, c["request"]["server_instance_id"], row.id,
            c["request"]["source_context"]["base"]["crypto_epoch"], linked.key(kind, row.job_id))}
        for kind in sorted(k for k in linked.SLOTS if k.startswith("analysis_"))]


def own(db, owner, local, device, instance, ident, *, creator=False):
    authenticate(db, owner, device, instance)
    row = db.get(ClaimRow, ident)
    if row is None or (row.owner_id, row.local_id) != (owner, local):
        error("execution_not_found", 404)
    c = fixed(row)
    if c["request"]["server_instance_id"] != instance:
        error("server_instance_changed")
    if creator and row.actor_device_id != device:
        error("transition_actor_mismatch", 403)
    if row.state == "client_pending" and row.expires_at <= database_now(db):
        row.state = "expired"
    return row


def result(db, row):
    c, p = fixed(row), json.loads(row.progress_json)
    if p.get("terminal_receipt") is not None or row.state in TERMINAL:
        receipt(row)
    current = store.current_context(db, row.owner_id, row.local_id)
    from app.services.note_mixed_metadata import lineage
    sc = None
    if not lineage(db, row.owner_id, row.local_id):
        sc, _ = source_now(db, row.owner_id, row.local_id)
    receipts = [json.loads(r.receipt_json) for r in db.scalars(select(NoteCryptoTransition).where(
        NoteCryptoTransition.owner_id == row.owner_id, NoteCryptoTransition.local_id == row.local_id,
        NoteCryptoTransition.purpose == "protected_analysis_write", NoteCryptoTransition.state == "committed"))
        if json.loads(r.conditions_json).get("execution_id") == row.id]
    return {"schema_version": 1, "execution_id": row.id, "original_job_id": row.job_id, "job_id_mode": row.job_id_mode,
        "execution_state": row.state, "run_version": row.run_version, "lease_version": row.lease_version,
        "expires_at": row.expires_at.isoformat(timespec="microseconds") + "Z", "source_context": c["request"]["source_context"],
        "source_keys": c["request"]["source_keys"], "source_digest": c["source_digest"], "output_slots": original_slots(row, c),
        "dispatch_receipt": p.get("dispatch_receipt"), "terminal_receipt": p.get("terminal_receipt"),
        "storage_receipts": receipts, "current_context": current, "source_matches_current": sc == c["request"]["source_context"]}


def claim_response(db, row):
    value = result(db, row)
    for field in ("dispatch_receipt", "terminal_receipt", "storage_receipts", "source_matches_current"):
        value.pop(field)
    return value


@store.atomic
def claim(db, body):
    authenticate(db, body.owner_id, body.device_id, body.server_instance_id)
    previous = db.scalar(select(ClaimRow).where(ClaimRow.owner_id == body.owner_id, ClaimRow.mutation_id == body.mutation_id))
    if previous:
        if fixed(previous)["request"] != body.model_dump():
            error("idempotency_mismatch")
        return {"created": False, **claim_response(db, own(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id, previous.id, creator=True))}
    available(db, body.owner_id, body.local_id)
    sc, rows = source_now(db, body.owner_id, body.local_id)
    if sc != body.source_context.model_dump():
        error("source_changed")
    from app.api.analysis import ALLOWED_JOB_TYPES
    if body.job_type not in ALLOWED_JOB_TYPES:
        error("unsupported_job_type")
    keys = [k.model_dump() for k in body.source_keys]
    expected = {linked.canonical(d["key"]): {k: d.get(k) for k in ("key", "representation_etag", "slot_version", "ciphertext_sha256", "is_null")} for d, raw in rows}
    if (keys != sorted(keys, key=lambda k: store.key_order(k["key"])) or len({linked.canonical(k["key"]) for k in keys}) != len(keys)
        or any(expected.get(linked.canonical(k["key"])) != k for k in keys)):
        error("unsupported_source_scope")
    if body.source_job_id is not None:
        source = db.get(AnalysisJob, body.source_job_id)
        if source is None or (source.owner_id, source.note_local_id) != (body.owner_id, body.local_id):
            error("source_job_not_found")
    ident, mode = allocate(db)
    core = body.model_dump()
    row = ClaimRow(id=str(uuid4()), owner_id=body.owner_id, local_id=body.local_id, actor_device_id=body.device_id,
        mutation_id=body.mutation_id, job_id=ident, job_id_mode=mode, state="client_pending", run_version=1, lease_version=1,
        expires_at=database_now(db) + timedelta(minutes=30), progress_json="{}",
        conditions_json=linked.canonical({"request": core, "job_id": ident, "job_id_mode": mode, "source_digest": h({k: core[k] for k in (
            "source_context", "source_keys", "job_type", "prompt_version", "source_job_id")})}))
    db.add(row); db.flush()
    return {"created": True, **claim_response(db, row)}


@store.atomic
def status(db, owner, local, device, instance, ident):
    return result(db, own(db, owner, local, device, instance, ident))


def cas(row, body):
    if row.run_version != body.run_version or row.lease_version != body.lease_version:
        error("execution_changed")


@store.atomic
def dispatch(db, body):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id, body.execution_id, creator=True)
    cas(row, body)
    c, p = fixed(row), json.loads(row.progress_json)
    available(db, row.owner_id, row.local_id, execution=row.id)
    sc, _ = source_now(db, row.owner_id, row.local_id)
    if (row.state != "client_pending" or p.get("dispatch_receipt") or c["source_digest"] != body.source_digest
        or sc != c["request"]["source_context"]):
        error("execution_not_dispatchable")
    row.state = "client_running"; row.run_version += 1
    p["dispatch_receipt"] = {"execution_id": row.id, "dispatch_id": str(uuid4()), "source_digest": c["source_digest"], "run_version": row.run_version}
    row.progress_json = linked.canonical(p)
    return result(db, row)


def receipt(row):
    c, p = fixed(row), json.loads(row.progress_json)
    tr = p.get("terminal_receipt")
    if tr is None:
        if row.state in TERMINAL:
            error("inconsistent_analysis_claim")
        return None
    dr = p.get("dispatch_receipt")
    bm = p.get("terminal_bundle")
    if (row.state not in TERMINAL or tr != {"execution_id": row.id, "original_job_id": row.job_id,
        "dispatch_id": dr["dispatch_id"] if dr else None, "source_digest": c["source_digest"],
        "terminal_run_version": row.run_version, "outcome": p["terminal_outcome"],
        "bundle_digest": bm["bundle_digest"] if bm else None, "client_reported": True,
        "external_settled": True, "result_server_persisted": False}):
        error("inconsistent_analysis_claim")
    if bm:
        validate_bundle(row, Bundle.model_validate(bm))
    return tr


def finish_metadata(row, p, outcome, bm=None):
    row.state = "client_settled" if outcome in ("done", "failed") else outcome
    row.run_version += 1
    c = fixed(row)
    p.update(terminal_outcome=outcome, terminal_bundle=bm)
    p["terminal_receipt"] = {"execution_id": row.id, "original_job_id": row.job_id,
        "dispatch_id": p["dispatch_receipt"]["dispatch_id"] if p.get("dispatch_receipt") else None,
        "source_digest": c["source_digest"], "terminal_run_version": row.run_version, "outcome": outcome,
        "bundle_digest": bm["bundle_digest"] if bm else None, "client_reported": True, "external_settled": True,
        "result_server_persisted": False}
    row.progress_json = linked.canonical(p)


@store.atomic
def action(db, body, operation):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id, body.execution_id, creator=True)
    p = json.loads(row.progress_json)
    if operation == "abort" and p.get("abort_core") == body.model_dump():
        return result(db, row)
    cas(row, body)
    if row.state in TERMINAL:
        error("execution_not_active")
    if operation == "renew":
        if row.expires_at <= database_now(db):
            error("execution_expired", 410)
        row.lease_version += 1; row.expires_at = database_now(db) + timedelta(minutes=30)
    else:
        p["abort_core"] = body.model_dump()
        if p.get("dispatch_receipt"):
            row.state = "cancel_requested"; row.run_version += 1
            row.progress_json = linked.canonical(p)
        else:
            finish_metadata(row, p, "cancelled")
    return result(db, row)


def validate_bundle(row, bundle):
    c, bm = fixed(row), bundle.model_dump()
    epoch = c["request"]["source_context"]["base"]["crypto_epoch"]
    keys = [s["key"] for s in original_slots(row, c)]
    nulls, records = bm["slot_nulls"], bm["ciphertext_manifest"]
    if (bm["source_digest"] != c["source_digest"] or bm["original_job_id"] != row.job_id or bm["original_epoch"] != epoch
        or [s["key"] for s in nulls] != keys or bm["bundle_digest"] != h({k: v for k, v in bm.items() if k != "bundle_digest"})):
        error("invalid_cipher_bundle")
    shape = {s["key"]["slot"]: s["is_null"] for s in nulls}
    if shape["input_text"] or (bm["outcome"] == "done" and (shape["result_json"] or not shape["error_message"] or bm["error_code"] is not None)):
        error("invalid_cipher_bundle")
    if bm["outcome"] == "failed" and (not shape["result_json"] or bm["error_code"] is None):
        error("invalid_cipher_bundle")
    if [r["entry_key"] for r in records] != [s["key"] for s in nulls if not s["is_null"]]:
        error("invalid_cipher_bundle")
    if any(r["entry_key"] != r["destination_key"] or r["target_epoch"] != epoch for r in records):
        error("invalid_cipher_bundle")


@store.atomic
def settle(db, body):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.server_instance_id, body.execution_id, creator=True)
    p = json.loads(row.progress_json)
    if p.get("terminal_core") is not None:
        if p["terminal_core"] != body.model_dump():
            error("idempotency_mismatch")
        receipt(row)
        return result(db, row)
    cas(row, body)
    dr = p.get("dispatch_receipt")
    if row.state not in ("client_running", "cancel_requested") or dr is None or dr["dispatch_id"] != body.dispatch_id:
        error("execution_not_settleable")
    if body.outcome == "result_unavailable":
        if body.bundle_metadata is not None or body.local_checkpoint_confirmed or body.unavailable_reason is None:
            error("invalid_cipher_bundle")
    else:
        if body.bundle_metadata is None or not body.local_checkpoint_confirmed or body.unavailable_reason is not None or body.bundle_metadata.outcome != body.outcome:
            error("invalid_cipher_bundle")
        validate_bundle(row, body.bundle_metadata)
    p["terminal_core"] = body.model_dump()
    finish_metadata(row, p, body.outcome, body.bundle_metadata.model_dump() if body.bundle_metadata else None)
    return result(db, row)


def unsettled(db, owner, local):
    rows = list(db.scalars(select(ClaimRow).where(ClaimRow.owner_id == owner, ClaimRow.local_id == local).order_by(ClaimRow.id)))
    return [row for row in rows if receipt(row) is None]


def cohort(db, owner, local):
    return [{"execution_id": row.id, "original_job_id": row.job_id, "initial_run_version": row.run_version,
        "source_digest": fixed(row)["source_digest"], "initial_state": row.state} for row in unsettled(db, owner, local)]


def progress(db, owner, local, accepted, *, check_new=True):
    allowed = {r["execution_id"] for r in accepted}
    if check_new and any(row.id not in allowed for row in unsettled(db, owner, local)):
        error("related_jobs_unsettled")
    current, pending = [], 0
    for fixed_run in accepted:
        row = db.get(ClaimRow, fixed_run["execution_id"])
        if (row is None or (row.owner_id, row.local_id) != (owner, local) or row.job_id != fixed_run["original_job_id"]
            or fixed(row)["source_digest"] != fixed_run["source_digest"]):
            error("related_jobs_unsettled")
        tr = receipt(row)
        pending += tr is None
        current.append({"execution_id": row.id, "run_version": row.run_version, "state": row.state,
            "external_settled": tr is not None, "terminal_receipt_digest": h(tr) if tr else None})
    return current, pending
