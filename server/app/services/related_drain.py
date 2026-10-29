"""Fixed accepted worker cohorts; promotion never treats lost work as settled."""
import json
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import select

from app.models.note import AnalysisJob
from app.models.note_history import NoteHead
from app.models.note_related import RelatedDrain, AnalysisRun
from app.services import note_crypto as prep, note_crypto_storage as store, related_text as linked
from app.services.note_crypto_fence import error, database_now, require_unfenced
from app.services.note_history import lock_note_writes


def current_input(db, job):
    if job.note_local_id is None:
        return 0, None
    rows = linked.slots(db, job.owner_id, job.note_local_id)
    meta = next(m for k, r, m, value in rows if k == linked.key("analysis_input", job.id))
    head = db.get(NoteHead, (job.owner_id, job.note_local_id))
    return head.crypto_epoch if head else 0, meta.slot_version


def run_for(db, job, *, create=False):
    run = db.get(AnalysisRun, job.id)
    if run is None and create:
        epoch, version = current_input(db, job)
        run = AnalysisRun(job_id=job.id, run_id=str(uuid4()), owner_id=job.owner_id, local_id=job.note_local_id,
            run_version=1, source_epoch=epoch, input_slot_version=version, dispatched=False)
        db.add(run); db.flush()
    return run


def expire(db, row):
    if row.state in ("draining", "ready") and row.expires_at <= database_now(db):
        row.state = "expired"
    return row


def own(db, owner, local, device, ident, instance):
    prep.authenticate_actor(db, owner, device)
    row = db.get(RelatedDrain, ident)
    if row is None or row.owner_id != owner or row.local_id != local:
        error("drain_not_found", 404)
    if row.actor_device_id != device:
        error("transition_actor_mismatch", 403)
    if instance != prep.initialize_identity(db.connection()) or json.loads(row.conditions_json)["server_instance_id"] != instance:
        error("server_instance_changed")
    if row.state not in ("draining", "ready", "promoted", "aborted", "expired"):
        error("inconsistent_related_text")
    return expire(db, row)


def result(db, row):
    c = json.loads(row.conditions_json)
    from app.services import protected_analysis as client_runs
    schema = c["request"]["schema_version"]
    client_current, client_pending = client_runs.progress(db, row.owner_id, row.local_id, c.get("accepted_claims", []),
        check_new=row.state in ("draining", "ready"))
    if row.state in ("draining", "ready") and db.scalar(select(AnalysisJob.id).where(AnalysisJob.owner_id == row.owner_id,
        AnalysisJob.note_local_id == row.local_id, AnalysisJob.status.in_(("client_pending", "client_running"))).limit(1)) is not None:
        error("related_jobs_unsettled")
    current, pending = [], client_pending
    for accepted in c["accepted_runs"]:
        run = db.get(AnalysisRun, accepted["job_id"])
        job = db.get(AnalysisJob, accepted["job_id"])
        if (run is None or job is None or run.run_id != accepted["run_id"] or run.owner_id != row.owner_id
            or run.local_id != row.local_id or job.owner_id != row.owner_id or job.note_local_id != row.local_id):
            error("related_jobs_unsettled")
        settled = False
        if run.receipt_json:
            receipt = json.loads(run.receipt_json)
            settled = (receipt.get("settled") is True and type(receipt.get("source_epoch")) is int and receipt.get("job_id") == run.job_id
                and receipt.get("run_id") == run.run_id and receipt.get("source_epoch") == accepted["source_epoch"]
                and receipt.get("terminal_run_version") == run.run_version and receipt.get("input_slot_version") == accepted["input_slot_version"]
                and receipt.get("outcome") == job.status and job.status in ("done", "failed", "cancelled"))
            if settled and row.state in ("draining", "ready"):
                versions = {k["slot"]: m.slot_version for k, target, m, raw in linked.slots(db, row.owner_id, row.local_id)
                            if isinstance(target, AnalysisJob) and target.id == job.id}
                fields = {"input_slot_version": "input_text", "result_slot_version": "result_json", "error_slot_version": "error_message"}
                settled = (all(type(receipt.get(field)) is int and receipt[field] == versions.get(slot) for field, slot in fields.items())
                    and type(receipt.get("terminal_run_version")) is int
                    and receipt.get("job_updated_at") == job.updated_at.isoformat(timespec="microseconds") + "Z")
        pending += not settled
        current.append({"job_id": run.job_id, "run_id": run.run_id, "run_version": run.run_version,
                        "status": job.status, "settled": settled})
    if row.state in ("draining", "ready"):
        if not pending:
            row.state = "ready"
            ready_base = prep.base_state(db, row.owner_id, row.local_id)
        else:
            row.state, ready_base = "draining", None
        c["ready_base"] = ready_base
        row.conditions_json = linked.canonical(c)
    output = {"schema_version": schema, "drain_id": row.id, "drain_version": row.drain_version, "state": row.state,
        "lease_version": row.lease_version, "expires_at": row.expires_at.isoformat(timespec="microseconds") + "Z",
        "server_instance_id": c["server_instance_id"], "base_epoch": c["request"]["crypto_epoch"],
        "accepted_runs": c["accepted_runs"], "current_runs": current, "pending_count": pending,
        "ready_base": c.get("ready_base"), "transition_id": row.transition_id}
    if schema == 2:
        output.update(accepted_claims=c["accepted_claims"], current_claims=client_current)
    return output


@store.atomic
def prepare(db, body):
    prep.authenticate_actor(db, body.owner_id, body.device_id)
    if body.server_instance_id != prep.initialize_identity(db.connection()):
        error("server_instance_changed")
    previous = db.scalar(select(RelatedDrain).where(RelatedDrain.owner_id == body.owner_id, RelatedDrain.mutation_id == body.mutation_id))
    if previous:
        if json.loads(previous.conditions_json)["request"] != body.model_dump():
            error("idempotency_mismatch")
        return {"created": False, **result(db, own(db, body.owner_id, body.local_id, body.device_id, previous.id, body.server_instance_id))}
    require_unfenced(db, [(body.owner_id, body.local_id)])
    if linked.active_drain(db, body.owner_id, body.local_id):
        error("related_drain_in_progress", 423)
    base = prep.base_state(db, body.owner_id, body.local_id)
    if base["crypto_epoch"] != body.crypto_epoch:
        error("crypto_epoch_changed")
    if base["history_generation"] != body.expected_history_generation:
        error("version_conflict")
    linked.slots(db, body.owner_id, body.local_id)
    from app.services import protected_analysis as client_runs
    accepted_claims = client_runs.cohort(db, body.owner_id, body.local_id)
    if accepted_claims and body.schema_version != 2:
        error("client_claims_require_drain_v2")
    accepted = []
    for job in db.scalars(select(AnalysisJob).where(AnalysisJob.owner_id == body.owner_id,
        AnalysisJob.note_local_id == body.local_id).order_by(AnalysisJob.id)):
        if job.status in ("client_pending", "client_running"):
            error("related_jobs_unsettled")
        known = db.get(AnalysisRun, job.id)
        if job.status not in ("queued", "running") and not (known and known.claimed_by and known.receipt_json is None):
            continue
        if base["crypto_epoch"]:
            error("related_jobs_unsettled")
        run = run_for(db, job, create=job.status == "queued")
        if run is None or run.receipt_json is not None:
            error("worker_protocol_required")
        accepted.append({"job_id": job.id, "run_id": run.run_id, "initial_run_version": run.run_version,
            "source_epoch": run.source_epoch, "input_slot_version": run.input_slot_version, "initial_status": job.status})
    row = RelatedDrain(id=str(uuid4()), owner_id=body.owner_id, local_id=body.local_id, actor_device_id=body.device_id,
        mutation_id=body.mutation_id, state="draining", drain_version=1, lease_version=1,
        expires_at=database_now(db) + timedelta(minutes=30), conditions_json=linked.canonical({"request": body.model_dump(),
            "server_instance_id": body.server_instance_id, "accepted_runs": accepted, "ready_base": None,
            **({"accepted_claims": accepted_claims} if body.schema_version == 2 else {})}))
    db.add(row); db.flush()
    return {"created": True, **result(db, row)}


@store.atomic
def status(db, owner, local, device, ident, instance):
    return result(db, own(db, owner, local, device, ident, instance))


@store.atomic
def action(db, body, operation):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.drain_id, body.server_instance_id)
    if row.drain_version != body.drain_version:
        error("drain_changed")
    if row.state == "promoted":
        return {"http_status": 409, "detail": {"code": "drain_promoted"}, "transition_id": row.transition_id}
    if row.state in ("draining", "ready"):
        if body.lease_version != row.lease_version:
            error("lease_changed")
        if operation == "abort":
            row.state = "aborted"
        else:
            row.lease_version += 1; row.expires_at = database_now(db) + timedelta(minutes=30)
    elif operation != "abort":
        return {"http_status": 410 if row.state == "expired" else 409,
                "detail": {"code": "drain_expired" if row.state == "expired" else "drain_not_active"}}
    return result(db, row)


def ready(db, body):
    row = own(db, body.owner_id, body.local_id, body.device_id, body.drain_id, body.server_instance_id)
    if row.drain_version != body.drain_version:
        error("drain_changed")
    state = result(db, row)
    if state["state"] != "ready":
        error("related_jobs_unsettled")
    return row, state["ready_base"]


@store.atomic
def claim(db, job_id, worker_id):
    identity = db.execute(select(AnalysisJob.owner_id, AnalysisJob.note_local_id).where(AnalysisJob.id == job_id)).first()
    if identity is None:
        return None
    lock_note_writes(db, [identity[0]])
    db.expire_all()
    job = db.get(AnalysisJob, job_id)
    if job is None or (job.owner_id, job.note_local_id) != tuple(identity) or job.status != "queued":
        return None
    if job.note_local_id is not None:
        linked.guard(db, [(job.owner_id, job.note_local_id)], worker_job=job.id)
    run = run_for(db, job, create=True)
    if run.dispatched or run.claimed_by is not None or run.receipt_json:
        return None
    epoch, version = current_input(db, job)
    if (run.owner_id, run.local_id, run.source_epoch, run.input_slot_version) != (job.owner_id, job.note_local_id, epoch, version):
        error("stale_execution")
    run.claimed_by, run.claimed_until = worker_id, database_now(db) + timedelta(minutes=30)
    run.run_version += 1
    with linked.worker_write(db, job.id):
        job.status = "running"
    return {"job_id": job.id, "run_id": run.run_id, "run_version": run.run_version,
            "worker_id": worker_id, "job_type": job.job_type, "input_text": job.input_text}


def checked_run(db, task):
    identity = db.execute(select(AnalysisRun.owner_id).where(AnalysisRun.job_id == task["job_id"])).scalar_one_or_none()
    if identity is None:
        error("stale_execution")
    lock_note_writes(db, [identity]); db.expire_all()
    run, job = db.get(AnalysisRun, task["job_id"]), db.get(AnalysisJob, task["job_id"])
    if (run is None or job is None or run.run_id != task["run_id"] or run.claimed_by != task["worker_id"]
        or run.owner_id != job.owner_id or run.local_id != job.note_local_id):
        error("stale_execution")
    return run, job


def cancel(db, job):
    run = run_for(db, job, create=job.status == "queued")
    if run is None:
        error("worker_protocol_required")
    if (run.receipt_json or (run.owner_id, run.local_id) != (job.owner_id, job.note_local_id)
        or current_input(db, job) != (run.source_epoch, run.input_slot_version)):
        error("stale_execution")
    from datetime import datetime
    with linked.worker_write(db, job.id):
        job.status = "cancelled"
        job.updated_at = datetime.utcnow()
    if not run.dispatched:
        terminal_receipt(db, job, run)


def require_settled_retry(db, job, run):
    if run is None:
        return
    try:
        receipt = json.loads(run.receipt_json) if run.receipt_json else {}
        if (not isinstance(receipt, dict) or receipt.get("settled") is not True or receipt.get("run_id") != run.run_id
            or type(receipt.get("terminal_run_version")) is not int or receipt["terminal_run_version"] != run.run_version
            or receipt.get("outcome") != job.status or (run.owner_id, run.local_id) != (job.owner_id, job.note_local_id)
            or type(receipt.get("job_id")) is not int or receipt["job_id"] != job.id
            or type(receipt.get("source_epoch")) is not int or receipt["source_epoch"] != run.source_epoch
            or current_input(db, job) != (run.source_epoch, run.input_slot_version)
            or receipt.get("job_updated_at") != job.updated_at.isoformat(timespec="microseconds") + "Z"):
            error("related_jobs_unsettled")
        versions = {k["slot"]: m.slot_version for k, target, m, raw in linked.slots(db, job.owner_id, job.note_local_id)
                    if isinstance(target, AnalysisJob) and target.id == job.id} if job.note_local_id is not None else {}
        for field, slot in (("input_slot_version", "input_text"), ("result_slot_version", "result_json"), ("error_slot_version", "error_message")):
            expected = versions.get(slot)
            if receipt.get(field) != expected or (expected is not None and type(receipt.get(field)) is not int):
                error("related_jobs_unsettled")
    except (ValueError, TypeError):
        error("related_jobs_unsettled")


@store.atomic
def dispatch(db, task):
    run, job = checked_run(db, task)
    if (run.run_version != task["run_version"] or run.dispatched or job.status != "running"
        or run.claimed_until <= database_now(db)):
        error("stale_execution")
    if job.note_local_id is not None:
        linked.guard(db, [(job.owner_id, job.note_local_id)], worker_job=job.id)
    if current_input(db, job) != (run.source_epoch, run.input_slot_version):
        error("stale_execution")
    run.dispatched = True; run.run_version += 1
    return {**task, "run_version": run.run_version}


@store.atomic
def finish(db, task, *, result_json=None, error_message=None):
    run, job = checked_run(db, task)
    if run.receipt_json:
        return json.loads(run.receipt_json)
    if run.run_version != task["run_version"] or not run.dispatched or job.status not in ("running", "cancelled"):
        error("stale_execution")
    if job.note_local_id is not None:
        linked.guard(db, [(job.owner_id, job.note_local_id)], worker_job=job.id)
    if current_input(db, job) != (run.source_epoch, run.input_slot_version):
        error("stale_execution")
    from datetime import datetime
    with linked.worker_write(db, job.id):
        if job.status != "cancelled":
            job.status = "failed" if error_message is not None else "done"
            job.result_json, job.error_message = result_json, error_message
        job.updated_at = datetime.utcnow()
    return terminal_receipt(db, job, run)


def terminal_receipt(db, job, run):
    run.run_version += 1
    versions = {k["slot"]: m.slot_version for k, row, m, value in linked.slots(db, job.owner_id, job.note_local_id)
                if k["id"] == str(job.id) and isinstance(row, AnalysisJob)} if job.note_local_id is not None else {}
    receipt = {"job_id": job.id, "run_id": run.run_id, "source_epoch": run.source_epoch, "outcome": job.status,
        "terminal_run_version": run.run_version, "input_slot_version": run.input_slot_version,
        "result_slot_version": versions.get("result_json"), "error_slot_version": versions.get("error_message"),
        "job_updated_at": job.updated_at.isoformat(timespec="microseconds") + "Z", "settled": True}
    run.receipt_json = linked.canonical(receipt)
    return receipt
