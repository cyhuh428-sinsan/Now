"""C1 review regressions: current preview, cancellation and original run retention."""
import json
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from .test_note_crypto import subject, query
from .test_related_text import related, drain, prepare, stage, ROOT, DRAIN


@pytest.mark.parametrize("field", ["input_text", "result_json", "error_message", "transcript"])
def test_monitor_stale_unlinked_row_cannot_return_previous_plaintext(client, subject, field):
    from app.models.note import AnalysisJob, Recording
    from app.api.monitor import _analysis_job_detail_rows, _admin_recording_rows
    s, local = subject, "stale-preview"
    if field == "transcript":
        row = Recording(owner_id=s["owner"], device_id="actor", local_id=str(uuid4()), note_local_id=None,
            file_name="synthetic.wav", content_type="audio/wav", storage_path="synthetic.wav", transcript="stale plain")
    else:
        row = AnalysisJob(owner_id=s["owner"], job_type="memo_summary", status="done", note_local_id=None,
            input_text="stale plain", result_json="stale plain", error_message="stale plain")
    s["db"].add(row); s["db"].commit()
    ident, stale = row.id, getattr(row, field)
    assert row.note_local_id is None and stale == "stale plain"
    with Session(s["engine"], autoflush=False) as other:
        changed = other.get(type(row), ident); changed.note_local_id = local; other.commit()
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    rendered = _admin_recording_rows([row]) if field == "transcript" else _analysis_job_detail_rows([row])
    assert "stale plain" not in rendered and "[보호된 텍스트]" in rendered


def test_monitor_uses_fresh_independent_field_and_never_detached_raw(client, subject):
    from app.models.note import AnalysisJob
    from app.api.monitor import _analysis_job_detail_rows
    s = subject
    row = AnalysisJob(owner_id=s["owner"], job_type="memo_summary", status="done", input_text="old",
        error_message="old error", result_json="old result")
    s["db"].add(row); s["db"].commit(); ident = row.id
    assert row.input_text == "old"
    with s["engine"].begin() as conn:
        conn.execute(AnalysisJob.__table__.update().where(AnalysisJob.id == ident).values(
            input_text="fresh", error_message=None, result_json="fresh result"))
    rendered = _analysis_job_detail_rows([row])
    assert "fresh" in rendered and "fresh result" in rendered and "old" not in rendered
    s["db"].rollback(); s["db"].refresh(row); s["db"].expunge(row)
    assert "fresh" not in _analysis_job_detail_rows([row])


def queued(client, s, local):
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "note_local_id": local,
        "job_type": "memo_summary", "input_text": "keep original input"}, headers=s["headers"])
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_cancel_before_dispatch_settles_original_run_without_replacing_text(client, subject):
    from app.services import related_drain as runs
    from app.models.note import AnalysisJob
    from app.models.note_related import AnalysisRun
    from fastapi import HTTPException
    s, local = subject, "cancel-before"
    ident = queued(client, s, local)
    old = s["db"].get(AnalysisJob, ident); old.result_json = "previous result"; old.error_message = "previous error"; s["db"].commit()
    task = runs.claim(s["db"], ident, "synthetic-worker")
    r = client.post(f"/api/v1/analysis/jobs/{ident}/cancel", headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all(); run = s["db"].get(AnalysisRun, ident)
    assert run.run_id == task["run_id"] and not run.dispatched
    assert json.loads(run.receipt_json)["outcome"] == "cancelled"
    assert s["db"].get(AnalysisJob, ident).input_text == "keep original input"
    assert s["db"].get(AnalysisJob, ident).result_json == "previous result"
    assert s["db"].get(AnalysisJob, ident).error_message == "previous error"
    with pytest.raises(HTTPException):
        runs.dispatch(s["db"], task)
    assert drain(client, s, local)["state"] == "ready"


def test_retry_cannot_erase_dispatched_original_run_before_late_finish(client, subject):
    from app.services import related_drain as runs
    from app.models.note_related import AnalysisRun
    from app.models.note import AnalysisJob
    s, local = subject, "retry-after"
    ident = queued(client, s, local)
    task = runs.dispatch(s["db"], runs.claim(s["db"], ident, "synthetic-worker"))
    assert client.post(f"/api/v1/analysis/jobs/{ident}/cancel", headers=s["headers"]).status_code == 200
    r = client.post(f"/api/v1/analysis/jobs/{ident}/retry", headers=s["headers"])
    assert r.status_code == 409, r.text
    s["db"].expire_all(); run = s["db"].get(AnalysisRun, ident)
    assert run.run_id == task["run_id"] and run.dispatched and run.receipt_json is None
    assert s["db"].get(AnalysisJob, ident).input_text == "keep original input"
    receipt = runs.finish(s["db"], task, result_json="must not publish cancelled result")
    assert receipt["outcome"] == "cancelled"
    assert client.post(f"/api/v1/analysis/jobs/{ident}/retry", headers=s["headers"]).status_code == 200
    s["db"].expire_all(); run = s["db"].get(AnalysisRun, ident)
    assert run.run_id != task["run_id"] and run.receipt_json is None and not run.dispatched


@pytest.mark.parametrize("first", ["cancel", "dispatch"])
def test_cancel_dispatch_race_has_exactly_one_order_and_retains_original_run(client, subject, first):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from fastapi import HTTPException
    from app.api.analysis import cancel_job
    from app.models.note_related import AnalysisRun
    from app.services import related_drain as runs
    from app.services.note_history import lock_note_writes
    s, local = subject, "race-" + first
    ident = queued(client, s, local)
    task = runs.claim(s["db"], ident, "race-worker")
    held, competing = Event(), Event()
    def action(operation, leading):
        with Session(s["engine"], autoflush=False) as db:
            if leading:
                lock_note_writes(db, [s["owner"]]); held.set()
                assert competing.wait(5)
            else:
                assert held.wait(5); competing.set()
            try:
                if operation == "cancel":
                    value = cancel_job(ident, user_token=s["headers"]["X-Now-User-Token"], web_session_token=None, db=db)
                    return value.status
                return runs.dispatch(db, task)
            except HTTPException as exc:
                db.rollback(); return exc.status_code
    with ThreadPoolExecutor(2) as pool:
        a = pool.submit(action, first, True)
        b = pool.submit(action, "dispatch" if first == "cancel" else "cancel", False)
        leading, trailing = a.result(timeout=15), b.result(timeout=15)
    s["db"].expire_all(); run = s["db"].get(AnalysisRun, ident)
    assert run.run_id == task["run_id"]
    if first == "cancel":
        assert leading == "cancelled" and trailing == 409
        assert not run.dispatched and json.loads(run.receipt_json)["settled"] is True
        assert drain(client, s, local)["state"] == "ready"
    else:
        assert isinstance(leading, dict) and trailing == "cancelled"
        assert run.dispatched and run.receipt_json is None
        assert client.post(f"/api/v1/analysis/jobs/{ident}/retry", headers=s["headers"]).status_code == 409
        assert runs.finish(s["db"], leading, result_json="discard cancelled")['outcome'] == "cancelled"
        assert drain(client, s, local)["state"] == "ready"
