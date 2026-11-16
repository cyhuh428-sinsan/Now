import logging
import signal
import time
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import select

from app.core.config import get_settings
from app.db import SessionLocal, create_tables, engine
from app.models.note import AnalysisJob
from app.services.analysis_processor import process_analysis_job
from app.services import related_drain
from fastapi import HTTPException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("nownote.worker")


def candidate_jobs(db, limit):
    return list(db.scalars(select(AnalysisJob.id).where(AnalysisJob.status == "queued")
                           .order_by(AnalysisJob.created_at.asc(), AnalysisJob.id).limit(limit)))


class ShutdownState:
    def __init__(self):
        self.requested = False
        self.unsettled = False

    def request(self, *_signal):
        self.requested = True

    @property
    def exit_code(self):
        return int(self.unsettled)


def run_once(shutdown: ShutdownState | None = None) -> int:
    shutdown = shutdown if shutdown is not None else ShutdownState()
    processed = 0
    if shutdown.requested:
        return processed
    with SessionLocal() as db:
        jobs = candidate_jobs(db, get_settings().worker_batch_size)
    worker_id = str(uuid4())
    for ident in jobs:
        if shutdown.requested:
            break
        stage = "before_claim"
        try:
            with SessionLocal() as db:
                if shutdown.requested:
                    break
                # A signal racing this boundary drains the claim already entering the DB.
                stage = "claim"
                task = related_drain.claim(db, ident, worker_id)
            if task is None:
                continue
            stage = "dispatch"
            with SessionLocal() as db:
                task = related_drain.dispatch(db, task)
            value, failure = None, None
            try:
                value = process_analysis_job(SimpleNamespace(job_type=task["job_type"], input_text=task["input_text"]))
            except Exception as exc:
                failure = str(exc)
            stage = "finish"
            with SessionLocal() as db:
                receipt = related_drain.finish(db, task, result_json=value, error_message=failure)
            if (receipt.get("settled") is not True or receipt.get("job_id") != ident
                or receipt.get("run_id") != task["run_id"]
                or receipt.get("outcome") not in ("done", "failed", "cancelled")):
                raise RuntimeError("Unverified terminal receipt")
            processed += receipt["outcome"] == "done"
            logger.info("analysis job %s settled outcome=%s", ident, receipt["outcome"])
        except HTTPException:
            shutdown.unsettled |= stage != "before_claim"
            logger.warning("analysis job %s deferred stage=%s code=execution_not_settled", ident, stage)
        except Exception:
            shutdown.unsettled |= stage != "before_claim"
            logger.warning("analysis job %s deferred stage=%s code=storage_unavailable", ident, stage)
    return processed


def main() -> int:
    shutdown = ShutdownState()
    signal.signal(signal.SIGTERM, shutdown.request)
    signal.signal(signal.SIGINT, shutdown.request)
    try:
        settings = get_settings()
        if not shutdown.requested:
            create_tables()
        logger.info("NowNote worker started")
        while not shutdown.requested:
            if run_once(shutdown) == 0:
                deadline = time.monotonic() + settings.worker_poll_seconds
                while not shutdown.requested and (remaining := deadline - time.monotonic()) > 0:
                    time.sleep(min(remaining, 0.1))
        logger.log(logging.ERROR if shutdown.unsettled else logging.INFO,
                   "NowNote worker stopping unsettled=%s", shutdown.unsettled)
    finally:
        engine.dispose()
    return shutdown.exit_code


if __name__ == "__main__":
    raise SystemExit(main())
