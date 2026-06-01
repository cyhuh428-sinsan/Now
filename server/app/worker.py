import logging
import time
from datetime import datetime

from sqlalchemy import select

from app.core.config import get_settings
from app.db import SessionLocal, create_tables
from app.models.note import AnalysisJob
from app.services.analysis_processor import process_analysis_job

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("nownote.worker")


def run_once() -> int:
    settings = get_settings()
    processed = 0
    with SessionLocal() as db:
        jobs = list(
            db.scalars(
                select(AnalysisJob)
                .where(AnalysisJob.status == "queued")
                .order_by(AnalysisJob.created_at.asc())
                .limit(settings.worker_batch_size)
            ).all()
        )
        for job in jobs:
            job.status = "running"
            db.commit()
            db.refresh(job)
            try:
                result_json = process_analysis_job(job)
                db.refresh(job)
                if job.status == "cancelled":
                    logger.info("analysis job %s cancelled before completion", job.id)
                    continue
                job.status = "done"
                job.result_json = result_json
                job.error_message = None
                job.updated_at = datetime.utcnow()
                db.commit()
                processed += 1
                logger.info("analysis job %s done", job.id)
            except Exception as exc:  # noqa: BLE001 - worker must persist failures
                job.status = "failed"
                job.error_message = str(exc)
                job.updated_at = datetime.utcnow()
                db.commit()
                logger.exception("analysis job %s failed", job.id)
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
