"""C1 actual authenticated APIs and synthetic cipher-only linked text client."""
import base64
import json
from uuid import uuid4

import pytest
from sqlalchemy import select

from .test_note_crypto import subject, query, context
from .test_note_crypto_conversion import canonical, digest, encrypt, decrypt, SIZE

ROOT = "/api/v2/notes/crypto-transitions"
DRAIN = "/api/v2/notes/related-drains"


def related(client, s, local="linked", *, nulls=False):
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "note_local_id": local,
        "job_type": "memo_summary", "input_text": None if nulls else "raw\r\nline\n"}, headers=s["headers"])
    assert r.status_code == 200, r.text
    ident = r.json()["id"]
    raw = None if nulls else ' {\n "result": "original  value"\n}\n'
    r = client.patch(f"/api/v1/analysis/jobs/{ident}", json={"status": "done", "result_json": raw,
                     "error_message": None if nulls else ""}, headers=s["headers"])
    assert r.status_code == 200, r.text
    return ident, r.json()


def drain(client, s, local):
    c = context(client, s, local)
    b = {"schema_version": 1, **query(s, local), "mutation_id": str(uuid4()), "server_instance_id": c["server_instance_id"],
         "crypto_epoch": c["crypto_epoch"], "expected_history_generation": c["history_generation"]}
    r = client.post(DRAIN, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    return r.json()


def prepare(client, s, local):
    d = drain(client, s, local)
    assert d["state"] == "ready", d
    c = d["ready_base"]
    b = {"schema_version": 2, **query(s, local), "mutation_id": str(uuid4()), "server_instance_id": d["server_instance_id"],
        "crypto_epoch": c["crypto_epoch"], "target_epoch": c["crypto_epoch"] + 1,
        "base_head_version": c["head_version"], "base_revision_id": c["head_revision_id"],
        "expected_history_generation": c["history_generation"], "expected_inventory_revision_ids": c["inventory_revision_ids"],
        "local_branches": [], "drain_id": d["drain_id"], "drain_version": d["drain_version"], "linked_metadata_version": 1}
    r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    return b, r.json(), d


def stage(client, s, local, b, t):
    sets = {k: [] for k in ("entries", "null_slots", "origin_expectations", "linked_expectations")}
    cursor = None
    while True:
        args = {**query(s, local), "transition_id": t["transition_id"], "manifest_schema": 2,
                "metadata_manifest_digest": t["manifest_digest"], "limit": 1}
        if cursor:
            args["cursor"] = cursor
        r = client.get(ROOT + "/manifest", params=args, headers=s["headers"])
        assert r.status_code == 200, r.text
        page = r.json()
        assert page["metadata_context"] == t["metadata_context"]
        assert page["linked_counts"] == t["linked_counts"]
        for item in page["items"]:
            sets[item["set"]].append(item["entry"])
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert {k: len(v) for k, v in sets.items()} == t["set_counts"]
    assert digest(canonical({**t["metadata_context"], **sets}).encode()) == t["manifest_digest"]
    records, originals = [], {}
    common = {"schema_version": 1, **query(s, local), "transition_id": t["transition_id"]}
    for e in sets["entries"] + sets["null_slots"]:
        key = e["key"]
        args = {**query(s, local), "transition_id": t["transition_id"], "kind": key["kind"], "representation_id": key["id"],
            "slot": key["slot"], "source_schema": 2, "metadata_manifest_digest": t["manifest_digest"]}
        if e.get("source_etag"):
            args["source_etag"] = e["source_etag"]
        r = client.get(ROOT + "/source", params=args, headers=s["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["entry"] == e
        assert r.json()["metadata_context"] == t["metadata_context"]
        value = r.json()["value"]
        originals[canonical(key)] = value
        if e.get("is_null"):
            assert value is None
            continue
        binding = e["expected_binding"]
        if key["kind"] == "note_body":
            value = decrypt(value, b["crypto_epoch"]) if value.startswith("NOW_ENCRYPTED_V1:") else value
            raw = encrypt(value, b["target_epoch"]).encode()
        else:
            is_linked = e["output_kind"] == "linked_text_envelope_v1"
            if is_linked and e["source_kind"] == "linked_text_envelope_v1":
                value = json.loads(decrypt(json.loads(value)["ciphertext"], b["crypto_epoch"]))["value"]
            elif not is_linked:
                parsed = json.loads(value)
                if parsed.get("kind") == "history_envelope_v1":
                    inner_old = json.loads(decrypt(parsed["ciphertext"], b["crypto_epoch"]))
                    assert inner_old["origin"] == e["operation_origin"]
                    value = inner_old["snapshot"]
                else:
                    value = parsed
                    if value["note"]["content"].startswith("NOW_ENCRYPTED_V1:"):
                        value["note"]["content"] = decrypt(value["note"]["content"], b["crypto_epoch"])
            inner = {"schema_version": 1, "binding": binding, "value" if is_linked else "snapshot": value,
                     "content_origin_kind": "linked_text" if is_linked else "semantic",
                     "semantic_sha256": digest((value if is_linked else canonical(value)).encode())}
            if not is_linked:
                inner["origin"] = e["operation_origin"]
            raw = canonical({"schema_version": 1, "kind": e["output_kind"], "crypto_epoch": b["target_epoch"],
                             "binding": binding, "ciphertext": encrypt(canonical(inner), b["target_epoch"])}).encode()
        chunks = [raw[i:i + SIZE] for i in range(0, len(raw), SIZE)]
        base = {**common, "entry_key": key, "source_etag": e["source_etag"], "target_epoch": b["target_epoch"],
                "total_chunks": len(chunks), "total_bytes": len(raw)}
        for i, data in enumerate(chunks):
            r = client.put(ROOT + "/chunks", json={**base, "chunk_index": i,
                "chunk_sha256": digest(data), "data_base64": base64.b64encode(data).decode()}, headers=s["headers"])
            assert r.status_code == 200, r.text
        r = client.post(ROOT + "/entries/seal", json={**base, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
        assert r.status_code == 200, r.text
        downloaded = b""
        for i in range(len(chunks)):
            r = client.get(ROOT + "/staged", params={**query(s, local), "transition_id": t["transition_id"],
                "kind": key["kind"], "representation_id": key["id"], "slot": key["slot"], "source_etag": e["source_etag"],
                "chunk_index": i, "read_schema": 2, "metadata_manifest_digest": t["manifest_digest"]}, headers=s["headers"])
            assert r.status_code == 200, r.text
            assert r.json()["metadata_context"] == t["metadata_context"]
            downloaded += base64.b64decode(r.json()["data_base64"])
        assert downloaded == raw
        if key["kind"] == "note_body":
            assert decrypt(raw.decode(), b["target_epoch"]) == value
        else:
            assert json.loads(decrypt(json.loads(raw)["ciphertext"], b["target_epoch"]))["value" if e["output_kind"] == "linked_text_envelope_v1" else "snapshot"] == value
        records.append({"entry_key": key, "destination_key": key, "source_etag": e["source_etag"],
            "output_kind": e["output_kind"], "target_epoch": b["target_epoch"], "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    records.sort(key=lambda r: tuple(r["entry_key"][k].encode() for k in ("kind", "id", "slot")))
    cb = {**common, "schema_version": 2, "mutation_id": str(uuid4()), "server_instance_id": b["server_instance_id"],
        "from_epoch": b["crypto_epoch"], "target_epoch": b["target_epoch"], "base_head_version": b["base_head_version"],
        "base_revision_id": b["base_revision_id"], "expected_history_generation": b["expected_history_generation"],
        "expected_inventory_revision_ids": b["expected_inventory_revision_ids"], "metadata_manifest_digest": t["manifest_digest"],
        "client_verified_ciphertext_manifest_digest": digest(canonical(records).encode()),
        "drain_id": b["drain_id"], "drain_version": b["drain_version"], "linked_metadata_version": 1}
    return cb, sets, originals


@pytest.mark.parametrize("nulls", [False, True])
def test_linked_only_full_manifest_atomic_conversion_and_current_404(client, subject, nulls):
    s, local = subject, "linked"
    ident, original = related(client, s, local, nulls=nulls)
    assert context(client, s, local)["identity_state"] == "related_only"
    b, t, d = prepare(client, s, local)
    cb, sets, values = stage(client, s, local, b, t)
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["current_context"]["identity_state"] == "related_only"
    assert client.get("/api/v2/notes/current", params=query(s, local, representation_schema=2), headers=s["headers"]).status_code == 404
    assert client.get("/api/v1/analysis/jobs", params={"owner_id": s["owner"]}, headers=s["headers"]).status_code == 409
    from app.models.note import AnalysisJob
    s["db"].expire_all(); row = s["db"].get(AnalysisJob, ident)
    assert row.created_at.isoformat() == original["created_at"].rstrip("Z")
    assert row.updated_at.isoformat() == original["updated_at"].rstrip("Z")
    assert len(sets["linked_expectations"]) == 3
    assert len(sets["null_slots"]) == (3 if nulls else 0)


def test_queued_drain_blocks_new_work_and_preserves_existing_run(client, subject):
    s, local = subject, "queued"
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "note_local_id": local,
        "job_type": "memo_summary", "input_text": "synthetic queued"}, headers=s["headers"])
    assert r.status_code == 200
    d = drain(client, s, local)
    assert d["state"] == "draining" and d["pending_count"] == 1
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "note_local_id": local,
        "job_type": "memo_summary", "input_text": "must not add"}, headers=s["headers"])
    assert r.status_code == 423


def test_schema1_linked_null_only_never_silently_omits_slots(client, subject):
    from .test_note_crypto import prepare_body
    s, local = subject, "old-request"
    related(client, s, local, nulls=True)
    r = client.post(ROOT, json=prepare_body(client, s, local), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "related_representation_required", r.text


def test_real_worker_settles_drain_and_does_not_run_cipher_input(client, subject, monkeypatch):
    from sqlalchemy.orm import sessionmaker
    from app import worker
    s, local = subject, "worker"
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "note_local_id": local,
        "job_type": "memo_summary", "input_text": "original worker input"}, headers=s["headers"])
    ident = r.json()["id"]; d = drain(client, s, local)
    calls = []
    monkeypatch.setattr(worker, "SessionLocal", sessionmaker(bind=s["engine"], autoflush=False))
    monkeypatch.setattr(worker, "candidate_jobs", lambda db, limit: [ident])
    monkeypatch.setattr(worker, "process_analysis_job", lambda job: calls.append(job.input_text) or ' {"result":"synthetic"}\n')
    assert worker.run_once() == 1
    status = client.get(DRAIN + "/status", params={**query(s, local), "drain_id": d["drain_id"],
        "server_instance_id": d["server_instance_id"]}, headers=s["headers"])
    assert status.status_code == 200 and status.json()["state"] == "ready", status.text
    assert status.json()["current_runs"][0]["settled"] is True
    b, t, _ = prepare_after_drain(client, s, local, status.json())
    cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    assert worker.run_once() == 0 and calls == ["original worker input"]


def prepare_after_drain(client, s, local, d):
    c = d["ready_base"]
    b = {"schema_version": 2, **query(s, local), "mutation_id": str(uuid4()), "server_instance_id": d["server_instance_id"],
        "crypto_epoch": c["crypto_epoch"], "target_epoch": c["crypto_epoch"] + 1,
        "base_head_version": c["head_version"], "base_revision_id": c["head_revision_id"],
        "expected_history_generation": c["history_generation"], "expected_inventory_revision_ids": c["inventory_revision_ids"],
        "local_branches": [], "drain_id": d["drain_id"], "drain_version": d["drain_version"], "linked_metadata_version": 1}
    r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    return b, r.json(), d


def test_related_only_can_create_protected_current_and_preserve_linked_bytes(client, subject):
    from .test_note_protected_writes import qbody, quote, stage as write_stage, commit as write_commit
    from app.models.note import AnalysisJob
    s, local = subject, "after-linked"
    ident, _ = related(client, s, local)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    s["db"].expire_all(); old = s["db"].get(AnalysisJob, ident).result_json
    wb = qbody(client, s, local); wq = quote(client, s, wb)
    wc = write_stage(client, s, wb, wq)[0]; write_commit(client, s, wc)
    s["db"].expire_all()
    assert s["db"].get(AnalysisJob, ident).result_json == old
    assert context(client, s, local)["identity_state"] == "coherent"


def full_snapshot(s, local):
    from app.models.note import AnalysisJob, Recording
    from app.models.note_related import LinkedText, RelatedDrain, AnalysisRun
    from .test_note_crypto_review import snapshot
    result = snapshot(s, local)
    for model in (AnalysisJob, Recording, LinkedText, RelatedDrain):
        table = model.__table__
        field = table.c.note_local_id if "note_local_id" in table.c else table.c.local_id
        result[table.name] = [tuple(r) for r in s["db"].execute(select(table).where(table.c.owner_id == s["owner"], field == local).order_by(*table.primary_key.columns))]
    result[AnalysisRun.__tablename__] = [tuple(r) for r in s["db"].execute(select(AnalysisRun.__table__).where(
        AnalysisRun.owner_id == s["owner"], AnalysisRun.local_id == local).order_by(AnalysisRun.job_id))]
    return result


def test_mixed_all_four_slots_dates_file_and_full_live_reencryption(client, subject):
    from app.models.note import AnalysisJob, Recording
    from .test_note_crypto_conversion import seed, read_all
    s, local = subject, "mixed"
    seed(client, s, local)
    ident, original = related(client, s, local)
    rec = Recording(owner_id=s["owner"], note_local_id=local, device_id="actor", local_id=str(uuid4()),
        file_name="unchanged.wav", content_type="audio/wav", storage_path="synthetic-only.wav", transcript="\r\n원문\n")
    s["db"].add(rec); s["db"].commit()
    original_recording = {c.name: getattr(rec, c.name) for c in Recording.__table__.columns}
    b, t, _ = prepare(client, s, local); cb, sets, values = stage(client, s, local, b, t)
    assert len(sets["linked_expectations"]) == 4
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    s["db"].expire_all()
    rec = s["db"].get(Recording, rec.id)
    assert all(getattr(rec, k) == v for k, v in original_recording.items() if k != "transcript")
    c, items, raw = read_all(client, s, local)
    assert {"analysis_input", "analysis_result", "analysis_error", "recording_transcript"} <= {i["key"]["kind"] for i in items}
    assert c["crypto_epoch"] == 1
    b2, t2, _ = prepare(client, s, local); cb2, _, _ = stage(client, s, local, b2, t2)
    r = client.post(ROOT + "/commit", json=cb2, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["current_context"]["crypto_epoch"] == 2
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).json()["receipt_matches_current"] is False
    s["db"].expire_all()
    assert s["db"].get(AnalysisJob, ident).updated_at.isoformat() == original["updated_at"].rstrip("Z")


@pytest.mark.parametrize("damage", ["row", "slot_version", "operation", "receipt_version", "null_flag"])
def test_protected_slot_corruption_never_falls_back(client, subject, damage):
    from app.models.note_related import LinkedText
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "damage"
    related(client, s, local, nulls=True)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    m = s["db"].scalar(select(LinkedText).where(LinkedText.owner_id == s["owner"], LinkedText.local_id == local))
    if damage == "row":
        s["db"].delete(m)
    elif damage == "slot_version":
        m.slot_version += 1
    elif damage == "operation":
        m.storage_operation_id = str(uuid4())
    elif damage == "null_flag":
        m.is_null = False
    else:
        op = s["db"].get(NoteCryptoTransition, t["transition_id"])
        receipt = json.loads(op.receipt_json); receipt["linked_metadata_version"] = True; op.receipt_json = canonical(receipt)
    s["db"].commit()
    r = client.get("/api/v2/notes/representations", params=query(s, local, representation_schema=2), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_related_text", r.text


@pytest.mark.parametrize("field,value", [("linked_metadata_version", True), ("linked_metadata_version", 1.0), ("drain_version", True)])
def test_schema2_strict_metadata_versions(client, subject, field, value):
    s, local = subject, "strict"
    related(client, s, local)
    d = drain(client, s, local)
    b, t, _ = prepare_after_drain(client, s, local, d)
    assert client.post(ROOT + "/abort", json={"schema_version": 1, **query(s, local),
        "transition_id": t["transition_id"], "lease_version": 1}, headers=s["headers"]).status_code == 200
    r = client.post(ROOT, json={**b, field: value}, headers=s["headers"])
    assert r.status_code == 422, r.text


def test_two_actual_workers_dispatch_once_and_settle_existing_cohort(client, subject, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from sqlalchemy.orm import sessionmaker
    from app import worker
    s, local = subject, "two-workers"
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "note_local_id": local,
        "job_type": "memo_summary", "input_text": "one execution"}, headers=s["headers"])
    ident = r.json()["id"]; d = drain(client, s, local)
    calls, barrier = [], Event()
    monkeypatch.setattr(worker, "SessionLocal", sessionmaker(bind=s["engine"], autoflush=False))
    monkeypatch.setattr(worker, "candidate_jobs", lambda db, limit: [ident])
    def process(job):
        calls.append(job.input_text); barrier.wait(0.2)
        return '{"result":"once"}'
    monkeypatch.setattr(worker, "process_analysis_job", process)
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(lambda _: worker.run_once(), range(2)))
    assert sorted(results) == [0, 1] and calls == ["one execution"]
    r = client.get(DRAIN + "/status", params={**query(s, local), "drain_id": d["drain_id"],
        "server_instance_id": d["server_instance_id"]}, headers=s["headers"])
    assert r.json()["state"] == "ready" and r.json()["pending_count"] == 0


@pytest.mark.parametrize("boundary", ["text", "metadata", "head", "receipt"])
def test_schema2_publication_failure_rolls_back_all_slots_and_dates(client, subject, boundary):
    from sqlalchemy import event
    s, local = subject, "rollback"
    related(client, s, local)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    before = full_snapshot(s, local); fired = []
    patterns = {"text": "update analysis_jobs", "metadata": "update note_linked_texts",
        "head": "update note_heads", "receipt": "update note_crypto_transitions set receipt_json"}
    def fail(conn, cursor, statement, parameters, ctx, many):
        if patterns[boundary] in statement.lower():
            fired.append(True); raise RuntimeError("synthetic C1 publication failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
        assert fired and r.status_code == 500, r.text
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    assert full_snapshot(s, local) == before
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200


def test_future_client_execution_is_not_drain_ready(client, subject):
    from app.models.note import AnalysisJob
    s, local = subject, "future-client"
    ident, _ = related(client, s, local)
    s["db"].get(AnalysisJob, ident).status = "client_pending"; s["db"].commit()
    c = context(client, s, local)
    r = client.post(DRAIN, json={"schema_version": 1, **query(s, local), "mutation_id": str(uuid4()),
        "server_instance_id": c["server_instance_id"], "crypto_epoch": 0, "expected_history_generation": c["history_generation"]}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "related_jobs_unsettled", r.text


def test_old_new_deferred_recording_guard_precedes_file_write(client, subject, monkeypatch):
    from app.models.note import Recording
    from app.api import recordings
    from sqlalchemy.orm import Session, load_only
    from fastapi import HTTPException
    s, local = subject, "guard-target"
    related(client, s, local)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    rec = Recording(owner_id=s["owner"], device_id="actor", local_id="record-plain", note_local_id="plain",
        file_name="original.wav", content_type="audio/wav", storage_path="original-synthetic.wav", transcript=None)
    s["db"].add(rec); s["db"].commit(); ident = rec.id
    with Session(s["engine"], autoflush=False) as db:
        row = db.scalar(select(Recording).options(load_only(Recording.id)).where(Recording.id == ident))
        row.note_local_id = local
        with pytest.raises(HTTPException) as exc:
            db.commit()
        assert exc.value.status_code == 409
        db.rollback()
    calls = []
    async def saved(**kwargs):
        calls.append(True); return "new.wav", "new-synthetic.wav"
    monkeypatch.setattr(recordings, "save_recording_file", saved)
    r = client.post("/api/v1/recordings", data={"owner_id": s["owner"], "device_id": "actor",
        "local_id": "record-plain", "note_local_id": local}, files={"file": ("new.wav", b"synthetic", "audio/wav")}, headers=s["headers"])
    assert r.status_code == 409 and calls == []
    s["db"].expire_all()
    assert s["db"].get(Recording, ident).storage_path == "original-synthetic.wav"


def test_identity_is_rechecked_after_owner_lock_before_natural_write(client, subject, monkeypatch):
    from app.models.note import Recording
    from app.services import related_text as linked
    from fastapi import HTTPException
    s, local = subject, "locked-target"
    related(client, s, local)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    row = Recording(owner_id=s["owner"], device_id="actor", local_id=str(uuid4()), note_local_id="plain-origin",
        file_name="original.wav", content_type="audio/wav", storage_path="synthetic.wav", transcript=None)
    s["db"].add(row); s["db"].commit(); ident = row.id
    original_lock, fired = linked.lock_note_writes, []
    def interleaved(db, owners):
        if not fired:
            fired.append(True)
            db.connection().execute(Recording.__table__.update().where(Recording.id == ident).values(note_local_id=local))
        original_lock(db, owners)
    monkeypatch.setattr(linked, "lock_note_writes", interleaved)
    row.file_name = "must not change.wav"
    with pytest.raises(HTTPException) as exc:
        s["db"].commit()
    assert fired and exc.value.status_code == 409
    s["db"].rollback()
    assert s["db"].get(Recording, ident).file_name == "original.wav"


def test_new_history_slots_cannot_be_omitted_from_schema2_commit(client, subject):
    from app.models.note_history import NoteRevision
    from .test_note_crypto_conversion import seed
    s, local = subject, "late-history"
    seed(client, s, local); related(client, s, local)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    original = s["db"].scalar(select(NoteRevision).where(NoteRevision.owner_id == s["owner"], NoteRevision.local_id == local))
    s["db"].add(NoteRevision(id=str(uuid4()), owner_id=s["owner"], local_id=local, note_id=original.note_id,
        parent_revision_id=original.id, reason="synthetic-late", snapshot_json=original.snapshot_json,
        before_snapshot_json=original.snapshot_json, representation_epoch=0, representation_kind="snapshot_v1"))
    s["db"].commit(); before = full_snapshot(s, local)
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 409, r.text
    assert full_snapshot(s, local) == before


def test_recording_publish_failure_cleans_only_new_file(client, subject, monkeypatch):
    import asyncio
    import io
    from starlette.datastructures import UploadFile
    from sqlalchemy import event
    from app.api import recordings
    from app.models.note import Recording
    s = subject
    row = Recording(owner_id=s["owner"], device_id="actor", local_id="file-fail", note_local_id="plain-file",
        file_name="old.wav", content_type="audio/wav", storage_path="original-file.wav", transcript="preserve")
    s["db"].add(row); s["db"].commit(); ident = row.id
    deleted, fired = [], []
    async def saved(**kwargs):
        return "new.wav", "new-owned-file.wav"
    monkeypatch.setattr(recordings, "save_recording_file", saved)
    monkeypatch.setattr(recordings, "delete_recording_file", deleted.append)
    def fail(conn, cursor, statement, parameters, context, many):
        if statement.lower().startswith("update recordings"):
            fired.append(True); raise RuntimeError("synthetic recording publication failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        with pytest.raises(RuntimeError, match="synthetic recording publication"):
            asyncio.run(recordings.upload_recording(owner_id=s["owner"], device_id="actor", local_id="file-fail",
                note_local_id="plain-file", transcript="new", file=UploadFile(io.BytesIO(b"synthetic"), filename="new.wav"),
                user_token=s["headers"]["X-Now-User-Token"], web_session_token=None, db=s["db"]))
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail); s["db"].rollback()
    assert fired and deleted == ["new-owned-file.wav"]
    assert s["db"].get(Recording, ident).storage_path == "original-file.wav"


def test_partial_new_recording_upload_does_not_leave_file(tmp_path, monkeypatch):
    import asyncio
    from app.services import recording_storage
    monkeypatch.setattr(recording_storage.get_settings(), "storage_dir", str(tmp_path / "files"))
    class FailingUpload:
        filename = "synthetic.wav"
        calls = 0
        async def read(self, size):
            self.calls += 1
            if self.calls == 1:
                return b"partial"
            raise RuntimeError("synthetic interrupted upload")
    with pytest.raises(RuntimeError, match="synthetic interrupted upload"):
        asyncio.run(recording_storage.save_recording_file("synthetic", "actor", "rec", FailingUpload()))
    assert [p for p in (tmp_path / "files").rglob("*") if p.is_file()] == []


def test_legacy_mixed_list_requires_explicit_plain_scope(client, subject):
    from app.models.note import Recording
    s, local = subject, "protected-list"
    related(client, s, local); related(client, s, "ordinary-list")
    for scope in (local, "ordinary-list"):
        s["db"].add(Recording(owner_id=s["owner"], device_id="actor", local_id=str(uuid4()), note_local_id=scope,
            file_name="synthetic.wav", content_type="audio/wav", storage_path="synthetic.wav", transcript="raw"))
    s["db"].commit()
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    for path in ("/api/v1/analysis/jobs", "/api/v1/recordings"):
        assert client.get(path, params={"owner_id": s["owner"]}, headers=s["headers"]).status_code == 409
        r = client.get(path, params={"owner_id": s["owner"], "note_local_id": "ordinary-list"}, headers=s["headers"])
        assert r.status_code == 200 and len(r.json()) == 1, r.text
        assert r.json()[0]["note_local_id"] == "ordinary-list"


def test_drain_lease_actor_expiry_and_promoted_abort(client, subject):
    from datetime import datetime, timedelta
    from app.models.note_related import RelatedDrain
    s, local = subject, "drain-lifetime"
    related(client, s, local)
    d = drain(client, s, local)
    a = {"schema_version": 1, **query(s, local), **{k: d[k] for k in ("server_instance_id", "drain_id", "drain_version", "lease_version")}}
    r = client.post(DRAIN + "/renew", json=a, headers=s["headers"])
    assert r.status_code == 200 and r.json()["lease_version"] == 2
    assert client.post(DRAIN + "/abort", json=a, headers=s["headers"]).status_code == 409
    assert client.get(DRAIN + "/status", params={**query(s, local), "owner_id": s["other"], "drain_id": d["drain_id"],
        "server_instance_id": d["server_instance_id"]}, headers=s["headers"]).status_code in (401, 403)
    row = s["db"].get(RelatedDrain, d["drain_id"]); row.expires_at = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    assert client.post(DRAIN + "/renew", json={**a, "lease_version": 2}, headers=s["headers"]).status_code == 410
    b, t, promoted = prepare(client, s, local)
    a.update(drain_id=promoted["drain_id"], drain_version=promoted["drain_version"], lease_version=promoted["lease_version"])
    r = client.post(DRAIN + "/abort", json=a, headers=s["headers"])
    assert r.status_code == 409 and r.json()["transition_id"] == t["transition_id"]


def test_claim_lease_is_not_settlement_cancel_waits_and_finish_is_once(client, subject):
    from datetime import datetime, timedelta
    from app.models.note_related import AnalysisRun
    from app.services import related_drain as runs
    from fastapi import HTTPException
    s, local = subject, "cancel-worker"
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "note_local_id": local,
        "job_type": "memo_summary", "input_text": "synthetic input"}, headers=s["headers"])
    ident = r.json()["id"]
    task = runs.claim(s["db"], ident, "synthetic-worker")
    task = runs.dispatch(s["db"], task)
    with pytest.raises(HTTPException):
        runs.dispatch(s["db"], task)
    assert client.post(f"/api/v1/analysis/jobs/{ident}/cancel", headers=s["headers"]).status_code == 200
    d = drain(client, s, local)
    assert d["pending_count"] == 1
    run = s["db"].get(AnalysisRun, ident); run.claimed_until = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    r = client.get(DRAIN + "/status", params={**query(s, local), "drain_id": d["drain_id"],
        "server_instance_id": d["server_instance_id"]}, headers=s["headers"])
    assert r.json()["state"] == "draining" and r.json()["pending_count"] == 1
    receipt = runs.finish(s["db"], task, result_json="must not replace cancelled result")
    assert receipt["outcome"] == "cancelled" and receipt["settled"] is True
    assert runs.finish(s["db"], task, result_json="duplicate") == receipt
    r = client.get(DRAIN + "/status", params={**query(s, local), "drain_id": d["drain_id"],
        "server_instance_id": d["server_instance_id"]}, headers=s["headers"])
    assert r.json()["state"] == "ready"


def test_unknown_old_running_job_never_becomes_ready(client, subject):
    s, local = subject, "old-running"
    ident, _ = related(client, s, local)
    assert client.patch(f"/api/v1/analysis/jobs/{ident}", json={"status": "running"}, headers=s["headers"]).status_code == 200
    c = context(client, s, local)
    r = client.post(DRAIN, json={"schema_version": 1, **query(s, local), "mutation_id": str(uuid4()),
        "server_instance_id": c["server_instance_id"], "crypto_epoch": 0,
        "expected_history_generation": c["history_generation"]}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "worker_protocol_required"


def test_related_only_import_becomes_branch_only_without_losing_linked_slots(client, subject):
    from . import test_note_protected_import as imports
    from .test_note_crypto_conversion import read_all
    s, local = subject, "related-import"
    related(client, s, local)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    before = context(client, s, local)
    ib = imports.request(client, s, local, [imports.entry()]); iq = imports.prepare(client, s, ib)
    ic, _ = imports.stage(client, s, ib, iq)
    r = client.post(imports.COMMIT, json=ic, headers=s["headers"])
    assert r.status_code == 200, r.text
    c, items, raw = read_all(client, s, local)
    assert c["identity_state"] == "branch_only" and c["crypto_epoch"] == before["crypto_epoch"]
    assert c["head_version"] == before["head_version"] and c["history_generation"] == before["history_generation"] + 1
    assert sum(i["key"]["kind"].startswith("analysis_") for i in items) == 3


@pytest.mark.parametrize("boundary", ["missing_metadata", "fenced"])
def test_legacy_linked_reads_fail_closed_before_serialization(client, subject, boundary):
    from app.models.note_related import LinkedText
    s, local = subject, "legacy-read-guard"
    ident, _ = related(client, s, local)
    if boundary == "missing_metadata":
        row = s["db"].scalar(select(LinkedText).where(LinkedText.owner_id == s["owner"], LinkedText.local_id == local))
        s["db"].delete(row); s["db"].commit()
    else:
        prepare(client, s, local)
    for path in ("/api/v1/analysis/jobs", f"/api/v1/analysis/jobs/{ident}"):
        r = client.get(path, params={"owner_id": s["owner"]}, headers=s["headers"])
        assert r.status_code == (409 if boundary == "missing_metadata" else 423), r.text
        assert "original  value" not in r.text and "raw\\r" not in r.text


def test_schema2_read_flags_and_cross_scope_cursor_are_rejected(client, subject):
    s, local = subject, "explicit-read"
    related(client, s, local)
    b, t, _ = prepare(client, s, local)
    args = {**query(s, local), "transition_id": t["transition_id"], "limit": 1}
    assert client.get(ROOT + "/manifest", params=args, headers=s["headers"]).status_code == 409
    args.update(manifest_schema=2, metadata_manifest_digest=t["manifest_digest"])
    page = client.get(ROOT + "/manifest", params=args, headers=s["headers"]).json()
    cursor = json.loads(base64.urlsafe_b64decode(page["next_cursor"]))
    cursor["local_id"] = "another-scope"
    r = client.get(ROOT + "/manifest", params={**args, "cursor": base64.urlsafe_b64encode(canonical(cursor).encode()).decode()}, headers=s["headers"])
    assert r.status_code == 409
    e = page["items"][0]["entry"]; k = e["key"]
    src = {**query(s, local), "transition_id": t["transition_id"], "kind": k["kind"], "representation_id": k["id"],
        "slot": k["slot"], "source_etag": e["source_etag"]}
    assert client.get(ROOT + "/source", params=src, headers=s["headers"]).status_code == 409


def test_monitor_preview_cannot_bypass_fence_or_lost_metadata(client, subject):
    from app.api.monitor import _related_preview
    from app.models.note import AnalysisJob
    s, local = subject, "monitor-fenced"
    ident, _ = related(client, s, local)
    row = s["db"].get(AnalysisJob, ident)
    assert "raw" in _related_preview(row, "input_text")
    s["db"].rollback()
    prepare(client, s, local)
    s["db"].expire_all()
    assert _related_preview(row, "input_text") == "[보호된 텍스트]"
    s["db"].expunge(row)
    assert _related_preview(row, "input_text") == "[보호된 텍스트]"


def test_ready_requires_actual_terminal_slot_versions(client, subject):
    from app.services import related_drain as runs
    from app.models.note_related import LinkedText
    s, local = subject, "receipt-cas"
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "note_local_id": local,
        "job_type": "memo_summary", "input_text": "synthetic input"}, headers=s["headers"])
    ident = r.json()["id"]; d = drain(client, s, local)
    task = runs.dispatch(s["db"], runs.claim(s["db"], ident, "synthetic-worker"))
    runs.finish(s["db"], task, result_json="terminal")
    meta = s["db"].get(LinkedText, (s["owner"], local, canonical({"kind": "analysis_result", "id": str(ident), "slot": "result_json"})))
    meta.slot_version += 1; s["db"].commit()
    r = client.get(DRAIN + "/status", params={**query(s, local), "drain_id": d["drain_id"],
        "server_instance_id": d["server_instance_id"]}, headers=s["headers"])
    assert r.status_code == 409 or r.json()["state"] == "draining", r.text


@pytest.mark.parametrize("operation", ["update", "cancel", "retry", "upload"])
def test_write_response_rechecks_after_commit(client, subject, monkeypatch, operation):
    import asyncio
    import io
    from fastapi import HTTPException
    from starlette.datastructures import UploadFile
    from app.api import analysis, recordings
    from app.models.note import AnalysisJob, Recording
    from app.schemas.analysis import AnalysisJobUpdate
    from app.models.note_history import NoteHead
    s, local = subject, "response-race"
    ident, _ = related(client, s, local)
    if operation == "cancel":
        from app.services import related_drain as runs
        assert client.post(f"/api/v1/analysis/jobs/{ident}/retry", headers=s["headers"]).status_code == 200
        assert runs.claim(s["db"], ident, "response-worker") is not None
    original, fired = s["db"].refresh, []
    def after_commit(row, *args, **kwargs):
        if not fired and isinstance(row, (AnalysisJob, Recording)):
            fired.append(True)
            s["db"].connection().execute(NoteHead.__table__.update().where(NoteHead.owner_id == s["owner"], NoteHead.local_id == local)
                .values(crypto_epoch=1, protection_state="protected"))
            s["db"].expire_all()
        return original(row, *args, **kwargs)
    monkeypatch.setattr(s["db"], "refresh", after_commit)
    auth = {"user_token": s["headers"]["X-Now-User-Token"], "web_session_token": None, "db": s["db"]}
    async def saved(**kwargs):
        return "synthetic.wav", "synthetic-response.wav"
    monkeypatch.setattr(recordings, "save_recording_file", saved)
    try:
        with pytest.raises(HTTPException) as exc:
            if operation == "upload":
                asyncio.run(recordings.upload_recording(owner_id=s["owner"], device_id="actor", local_id="response-rec",
                    note_local_id=local, transcript="synthetic", file=UploadFile(io.BytesIO(b"synthetic"), filename="synthetic.wav"), **auth))
            elif operation == "update":
                analysis.update_job(ident, AnalysisJobUpdate(status="done", result_json="synthetic"), **auth)
            else:
                getattr(analysis, operation + "_job")(ident, **auth)
        assert fired and exc.value.status_code == 409
    finally:
        s["db"].rollback()


@pytest.mark.parametrize("damage", ["schema", "drain_id", "drain_version"])
def test_schema2_commit_must_match_exact_prepared_drain(client, subject, damage):
    s, local = subject, "commit-drain"
    related(client, s, local, nulls=True)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    if damage == "schema":
        cb["schema_version"] = 1
        for k in ("drain_id", "drain_version", "linked_metadata_version"):
            cb.pop(k)
    else:
        cb[damage] = str(uuid4()) if damage == "drain_id" else cb[damage] + 1
    before = full_snapshot(s, local)
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 409, r.text
    assert full_snapshot(s, local) == before
