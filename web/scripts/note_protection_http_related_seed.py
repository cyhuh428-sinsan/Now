"""Create linked-only entities in one fresh, exact isolated HTTP QA scope."""
import json
import re
import sys
from datetime import datetime

from sqlalchemy import select

from app.main import app  # noqa: F401 - register all guards before the first ORM flush
from app.db import SessionLocal
from app.models.note import AnalysisJob, Note, Recording, UserAccount
from app.models.note_crypto import NoteCryptoTransition
from app.models.note_history import NoteHead
from app.models.note_mixed import MixedScope
from app.models.note_v2 import NoteOfflineBranch

phase = "args"


def main():
    global phase
    run, mode, owner, local = sys.argv[1:]
    if not re.fullmatch(r"[0-9a-f]{12}", run) or mode not in ("web", "desktop"):
        raise ValueError("qa_scope")
    if owner != f"qa_http_{run}_{mode}_a" or local != f"qa-http-{run}-target":
        raise ValueError("qa_scope")
    with SessionLocal() as db:
        phase = "account"
        account = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner))
        if account is None or not account.is_active:
            raise ValueError("qa_account")
        phase = "scope"
        if db.get(NoteHead, (owner, local)) or db.get(MixedScope, (owner, local)):
            raise ValueError("qa_existing_scope")
        for model, field in ((Note, "local_id"), (NoteOfflineBranch, "local_id"), (NoteCryptoTransition, "local_id"),
                             (AnalysisJob, "note_local_id"), (Recording, "note_local_id")):
            if db.scalar(select(model.id).where(model.owner_id == owner, getattr(model, field) == local).limit(1)) is not None:
                raise ValueError("qa_existing_scope")
        stamp = datetime(2026, 10, 30, 0, 0, 0, 123456)
        phase = "create"
        job = AnalysisJob(owner_id=owner, note_local_id=local, job_type="memo_summary", status="done",
            input_text="HTTP-QA-LINKED-" + run + "\r\n", result_json=json.dumps({"summary": "HTTP-QA-RESULT-" + run}),
            error_message=None, created_at=stamp, updated_at=stamp)
        recording = Recording(owner_id=owner, note_local_id=local, device_id="qa-original-" + run,
            local_id="qa-recording-" + run, file_name="qa-only.wav", content_type="audio/wav",
            storage_path="qa-only-no-file-" + run, transcript="HTTP-QA-TRANSCRIPT-" + run + "\r\n",
            created_at=stamp, updated_at=stamp)
        for row in (job, recording):
            db.add(row)
            db.flush()
            # The existing after-flush hook queues Head/LinkedText metadata.
            db.flush()
        phase = "verify"
        head = db.get(NoteHead, (owner, local))
        if head is None or head.identity_state != "related_only" or head.crypto_epoch != 0:
            raise ValueError("qa_related_head")
        if db.scalar(select(Note.id).where(Note.owner_id == owner, Note.local_id == local)) is not None:
            raise ValueError("qa_placeholder_note")
        ids = {"job_id": job.id, "recording_id": recording.id}
        db.commit()
    print(json.dumps({"ok": True, "owner": owner, "local_id": local, **ids, "identity_state": "related_only"}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"ok": False, "code": "qa_related_seed_failed", "phase": phase, "error_type": type(exc).__name__}))
        sys.exit(1)
