import logging
import time
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy import select

from app.core.config import get_settings
from app.db import SessionLocal, create_tables
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


def run_once() -> int:
    processed = 0
    with SessionLocal() as db:
        jobs = candidate_jobs(db, get_settings().worker_batch_size)
    worker_id = str(uuid4())
    for ident in jobs:
        try:
            with SessionLocal() as db:
                task = related_drain.claim(db, ident, worker_id)
            if task is None:
                continue
            with SessionLocal() as db:
                task = related_drain.dispatch(db, task)
            value, failure = None, None
            try:
                value = process_analysis_job(SimpleNamespace(job_type=task["job_type"], input_text=task["input_text"]))
            except Exception as exc:
                failure = str(exc)
            with SessionLocal() as db:
                receipt = related_drain.finish(db, task, result_json=value, error_message=failure)
            processed += receipt["outcome"] == "done"
            logger.info("analysis job %s settled outcome=%s", ident, receipt["outcome"])
        except HTTPException:
            logger.warning("analysis job %s deferred code=execution_not_settled", ident)
        except Exception:
            logger.warning("analysis job %s deferred code=storage_unavailable", ident)
    return processed


def main() -> None:
    settings = get_settings()
    create_tables()
    logger.info("NowNote worker started")
    while True:
        processed = run_once()
        if processed == 0:
            time.sleep(settings.worker_poll_seconds)


if __name__ == "__main__":
    main()
