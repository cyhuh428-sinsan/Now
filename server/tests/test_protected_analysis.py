"""C2 real auth with a synthetic cipher client, never a Provider request."""
from uuid import uuid4
import json
import base64
from datetime import datetime, timedelta
import pytest

from sqlalchemy import select

from .test_note_crypto import subject, query, context
from .test_note_crypto_conversion import convert, read_all, seed
from .test_note_crypto_conversion import canonical, digest, encrypt, decrypt, SIZE

PA = "/api/v2/notes/protected-analysis"
PT = "/api/v2/notes/protected-transcripts"
ROOT = "/api/v2/notes/crypto-transitions"
BASE = ("head_version", "head_revision_id", "crypto_epoch", "history_generation", "protection_state",
        "inventory_revision_ids", "identity_state", "current_exists")


def source(client, s, local):
    b = context(client, s, local)
    c, items, _ = read_all(client, s, local)
    selected = next(i for i in items if i["key"]["kind"] == "note_body")
    return {"server_instance_id": c["server_instance_id"], "base": {k: b[k] for k in BASE}, "catalog_digest": c["catalog_digest"]}, [
        {k: selected.get(k) for k in ("key", "representation_etag", "slot_version", "ciphertext_sha256", "is_null")}]


def claim_body(client, s, local):
    sc, keys = source(client, s, local)
    return {"schema_version": 1, **query(s, local), "server_instance_id": sc["server_instance_id"],
        "mutation_id": str(uuid4()), "source_context": sc, "source_keys": keys, "job_type": "memo_summary",
        "prompt_version": "single_source_v1", "source_job_id": None, "execution_route": "client_provider",
        "client_execution_confirmed": True}


def test_claim_has_three_reserved_slots_without_live_job(client, subject):
    from app.models.note import AnalysisJob
    s, local = subject, "c2-claim"
    seed(client, s, local); convert(client, s, local)
    b = claim_body(client, s, local)
    r = client.post(PA + "/claims", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["execution_state"] == "client_pending" and len(c["output_slots"]) == 3
    assert s["db"].get(AnalysisJob, c["original_job_id"]) is None
    assert client.post(PA + "/claims", json=b, headers=s["headers"]).json() == c
    assert set(c) == {"schema_version", "execution_id", "original_job_id", "job_id_mode", "execution_state", "run_version",
        "lease_version", "expires_at", "source_context", "source_keys", "source_digest", "output_slots", "current_context"}


def test_dispatch_is_once_and_expiry_does_not_settle_external_execution(client, subject):
    s, local = subject, "c2-dispatch"
    seed(client, s, local); convert(client, s, local)
    b = claim_body(client, s, local)
    r = client.post(PA + "/claims", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    c = r.json()
    action = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"],
        **{k: c[k] for k in ("execution_id", "run_version", "lease_version")}, "source_digest": c["source_digest"]}
    r = client.post(PA + "/claims/dispatch", json=action, headers=s["headers"])
    assert r.status_code == 200 and r.json()["execution_state"] == "client_running", r.text
    assert client.post(PA + "/claims/dispatch", json=action, headers=s["headers"]).status_code == 409


def started(client, s, local):
    seed(client, s, local); convert(client, s, local)
    b = claim_body(client, s, local)
    r = client.post(PA + "/claims", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    c = r.json(); a = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"],
        **{k: c[k] for k in ("execution_id", "run_version", "lease_version")}, "source_digest": c["source_digest"]}
    r = client.post(PA + "/claims/dispatch", json=a, headers=s["headers"])
    assert r.status_code == 200, r.text
    return b, r.json()


def make_bundle(c, *, outcome="done", error_value="synthetic error"):
    raws, records, nulls = {}, [], []
    epoch = c["source_context"]["base"]["crypto_epoch"]
    for slot in c["output_slots"]:
        k, binding = slot["key"], slot["expected_binding"]
        value = {"input_text": "original input\r\n", "result_json": ' {"answer":"raw  result"}\n' if outcome == "done" else None,
            "error_message": None if outcome == "done" else error_value}[k["slot"]]
        nulls.append({"key": k, "is_null": value is None})
        if value is None:
            continue
        inner = {"schema_version": 1, "binding": binding, "value": value, "content_origin_kind": "linked_text",
            "semantic_sha256": digest(value.encode())}
        raw = canonical({"schema_version": 1, "kind": "linked_text_envelope_v1", "crypto_epoch": epoch,
            "binding": binding, "ciphertext": encrypt(canonical(inner), epoch)}).encode()
        raws[canonical(k)] = raw
        records.append({"entry_key": k, "destination_key": k, "source_etag": str(uuid4()), "output_kind": "linked_text_envelope_v1",
            "target_epoch": epoch, "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    bm = {"source_digest": c["source_digest"], "original_job_id": c["original_job_id"], "original_epoch": epoch,
        "outcome": outcome, "error_code": None if outcome == "done" else "provider_error", "slot_nulls": nulls, "ciphertext_manifest": records}
    bm["bundle_digest"] = digest(canonical(bm).encode())
    return bm, raws


def settle_body(s, local, c, bm):
    return {"schema_version": 1, **query(s, local), "server_instance_id": c["source_context"]["server_instance_id"],
        **{k: c[k] for k in ("execution_id", "run_version", "lease_version")}, "dispatch_id": c["dispatch_receipt"]["dispatch_id"],
        "provider_terminal_observed": True, "outcome": bm["outcome"], "bundle_metadata": bm,
        "local_checkpoint_confirmed": True, "unavailable_reason": None}


def test_terminal_metadata_after_lease_expiry_is_not_server_result(client, subject):
    from app.models.protected_analysis import ProtectedAnalysisClaim
    from app.models.note import AnalysisJob
    s, local = subject, "c2-late"
    b, c = started(client, s, local); bm, raw = make_bundle(c)
    row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
    row.expires_at = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    body = settle_body(s, local, c, bm)
    r = client.post(PA + "/claims/settle", json=body, headers=s["headers"])
    assert r.status_code == 200, r.text
    tr = r.json()["terminal_receipt"]
    assert tr["external_settled"] is True and tr["result_server_persisted"] is False
    assert client.post(PA + "/claims/settle", json=body, headers=s["headers"]).json()["terminal_receipt"] == tr
    assert s["db"].get(AnalysisJob, c["original_job_id"]) is None


def test_pending_abort_is_terminal_but_dispatched_abort_is_not(client, subject):
    s, local = subject, "c2-abort"
    seed(client, s, local); convert(client, s, local)
    b = claim_body(client, s, local); c = client.post(PA + "/claims", json=b, headers=s["headers"]).json()
    body = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"],
        **{k: c[k] for k in ("execution_id", "run_version", "lease_version")}}
    r = client.post(PA + "/claims/abort", json=body, headers=s["headers"])
    assert r.status_code == 200 and r.json()["terminal_receipt"]["outcome"] == "cancelled", r.text


def test_settled_result_can_prepare_complete_cipher_intent(client, subject):
    s, local = subject, "c2-prepare"
    b, c = started(client, s, local); bm, raws = make_bundle(c)
    r = client.post(PA + "/claims/settle", json=settle_body(s, local, c, bm), headers=s["headers"])
    assert r.status_code == 200, r.text
    tr = r.json()["terminal_receipt"]
    body = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"], "mutation_id": str(uuid4()),
        "execution_id": c["execution_id"], "terminal_run_version": tr["terminal_run_version"],
        "terminal_receipt_digest": digest(canonical(tr).encode()), "base": b["source_context"]["base"], "bundle_metadata": bm}
    r = client.post(PA + "/result-prepare", json=body, headers=s["headers"])
    assert r.status_code == 201, r.text
    assert len(r.json()["slots"]) == 3 and r.json()["write_id"] == c["execution_id"]
    assert set(r.json()) == {"schema_version", "state", "write_id", "purpose", "lease_version", "expires_at",
        "metadata_context", "origin", "slots", "metadata_manifest_digest", "current_context"}


def prepared(client, s, local):
    b, c = started(client, s, local); bm, raws = make_bundle(c)
    r = client.post(PA + "/claims/settle", json=settle_body(s, local, c, bm), headers=s["headers"])
    assert r.status_code == 200, r.text
    tr = r.json()["terminal_receipt"]
    body = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"], "mutation_id": str(uuid4()),
        "execution_id": c["execution_id"], "terminal_run_version": tr["terminal_run_version"],
        "terminal_receipt_digest": digest(canonical(tr).encode()), "base": b["source_context"]["base"], "bundle_metadata": bm}
    r = client.post(PA + "/result-prepare", json=body, headers=s["headers"])
    assert r.status_code == 201, r.text
    return body, r.json(), bm, raws


def upload(client, s, local, prefix, request, intent, raws):
    metadata, cursor = [], None
    while True:
        args = {**query(s, local), "server_instance_id": request["server_instance_id"], "write_id": intent["write_id"],
            "metadata_manifest_digest": intent["metadata_manifest_digest"], "limit": 1}
        if cursor:
            args["cursor"] = cursor
        r = client.get(prefix + "/manifest", params=args, headers=s["headers"])
        assert r.status_code == 200, r.text
        page = r.json(); metadata += page["slots"]
        assert page["metadata_context"] == intent["metadata_context"] and page["origin"] == intent["origin"]
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert digest(canonical({**intent["metadata_context"], "slots": metadata, "origin": intent["origin"]}).encode()) == intent["metadata_manifest_digest"]
    records = []
    for slot in metadata:
        if slot["is_null"]:
            continue
        k = slot["key"]; raw = raws[canonical(k)]
        chunks = [raw[i:i + SIZE] for i in range(0, len(raw), SIZE)]
        common = {"schema_version": 1, **query(s, local), "transition_id": intent["write_id"], "entry_key": k,
            "source_etag": slot["source_etag"], "target_epoch": intent["metadata_context"]["target_epoch"],
            "total_chunks": len(chunks), "total_bytes": len(raw)}
        for index, data in enumerate(chunks):
            r = client.put(prefix + "/chunks", json={**common, "chunk_index": index, "chunk_sha256": digest(data),
                "data_base64": base64.b64encode(data).decode()}, headers=s["headers"])
            assert r.status_code == 200, r.text
        r = client.post(prefix + "/entries/seal", json={**common, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
        assert r.status_code == 200, r.text
        downloaded = b""
        for index in range(len(chunks)):
            r = client.get(prefix + "/staged", params={**query(s, local), "server_instance_id": request["server_instance_id"],
                "write_id": intent["write_id"], "metadata_manifest_digest": intent["metadata_manifest_digest"],
                "kind": k["kind"], "representation_id": k["id"], "slot": k["slot"], "source_etag": slot["source_etag"], "chunk_index": index}, headers=s["headers"])
            assert r.status_code == 200, r.text
            assert r.json()["metadata_context"] == intent["metadata_context"]
            downloaded += base64.b64decode(r.json()["data_base64"])
        assert downloaded == raw
        records.append({"entry_key": k, "destination_key": k, "source_etag": slot["source_etag"],
            "output_kind": "linked_text_envelope_v1", "target_epoch": common["target_epoch"], "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    return {"schema_version": 1, **query(s, local), "server_instance_id": request["server_instance_id"], "write_id": intent["write_id"],
        "mutation_id": request["mutation_id"], "target_epoch": intent["metadata_context"]["target_epoch"],
        "metadata_manifest_digest": intent["metadata_manifest_digest"], "client_verified_ciphertext_manifest_digest": digest(canonical(records).encode())}


def test_cipher_result_commit_live_read_and_receipt_replay(client, subject):
    from app.models.note import AnalysisJob
    s, local = subject, "c2-store"
    b, intent, bm, raws = prepared(client, s, local)
    commit = upload(client, s, local, PA, b, intent, raws)
    r = client.post(PA + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    receipt = r.json()["receipt"]
    assert set(r.json()) == {"schema_version", "state", "receipt", "current_context", "receipt_matches_current", "source_matches_current"}
    assert len(receipt["slot_receipts"]) == 3
    assert receipt["history_generation"] == b["base"]["history_generation"] + 1
    assert client.post(PA + "/commit", json=commit, headers=s["headers"]).json()["receipt"] == receipt
    s["db"].expire_all(); job = s["db"].get(AnalysisJob, receipt["job_id"])
    assert job.status == "done" and "original input" not in job.input_text and job.error_message is None
    c, items, raw = read_all(client, s, local)
    assert sum(i["key"]["kind"].startswith("analysis_") for i in items) == 3
    r = client.get("/api/v2/analysis/jobs", params={**query(s, local), "representation_schema": 2}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["protected_analysis_execution_v1"] is True, r.text
    assert r.json()["items"][0]["execution_id"] == b["execution_id"]


def test_drain_schema1_cannot_omit_unsettled_client_claim(client, subject):
    s, local = subject, "c2-drain"
    b, c = started(client, s, local)
    request = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"], "mutation_id": str(uuid4()),
        "crypto_epoch": b["source_context"]["base"]["crypto_epoch"], "expected_history_generation": b["source_context"]["base"]["history_generation"]}
    r = client.post("/api/v2/notes/related-drains", json=request, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "client_claims_require_drain_v2", r.text
    request["schema_version"] = 2
    r = client.post("/api/v2/notes/related-drains", json=request, headers=s["headers"])
    assert r.status_code == 201 and r.json()["pending_count"] == 1, r.text
    d = r.json(); assert len(d["accepted_claims"]) == 1
    bm, raws = make_bundle(c)
    r = client.post(PA + "/claims/settle", json=settle_body(s, local, c, bm), headers=s["headers"])
    assert r.status_code == 200, r.text
    r = client.get("/api/v2/notes/related-drains/status", params={**query(s, local), "server_instance_id": b["server_instance_id"],
        "drain_id": d["drain_id"]}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "ready" and r.json()["pending_count"] == 0, r.text
    from .test_note_crypto import prepare_body
    assert client.post(ROOT, json=prepare_body(client, s, local), headers=s["headers"]).status_code == 423


def test_conversion_cannot_bypass_pending_client_execution(client, subject):
    from .test_note_crypto import prepare_body
    s, local = subject, "c2-conversion-gate"
    b, c = started(client, s, local)
    r = client.post(ROOT, json=prepare_body(client, s, local), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "client_claims_require_drain_v2", r.text


def test_aborted_drain_status_does_not_adopt_later_claims(client, subject):
    s, local = subject, "c2-old-drain"
    seed(client, s, local); convert(client, s, local)
    b = claim_body(client, s, local)
    r = client.post("/api/v2/notes/related-drains", json={"schema_version": 2, **query(s, local),
        "server_instance_id": b["server_instance_id"], "mutation_id": str(uuid4()), "crypto_epoch": b["source_context"]["base"]["crypto_epoch"],
        "expected_history_generation": b["source_context"]["base"]["history_generation"]}, headers=s["headers"])
    assert r.status_code == 201, r.text
    d = r.json()
    r = client.post("/api/v2/notes/related-drains/abort", json={"schema_version": 1, **query(s, local),
        "server_instance_id": b["server_instance_id"], **{k: d[k] for k in ("drain_id", "drain_version", "lease_version")}}, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert client.post(PA + "/claims", json=b, headers=s["headers"]).status_code == 201
    r = client.get("/api/v2/notes/related-drains/status", params={**query(s, local), "server_instance_id": b["server_instance_id"],
        "drain_id": d["drain_id"]}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "aborted", r.text


def replan_body(client, s, local, original, intent, bm, previous_state="stale"):
    from app.models.protected_analysis import ProtectedAnalysisClaim
    s["db"].expire_all()
    tr = json.loads(s["db"].get(ProtectedAnalysisClaim, original["execution_id"]).progress_json)["terminal_receipt"]
    b = context(client, s, local)
    return {"schema_version": 1, **query(s, local), "server_instance_id": original["server_instance_id"], "mutation_id": str(uuid4()),
        "execution_id": original["execution_id"], "terminal_receipt_digest": digest(canonical(tr).encode()), "original_bundle_digest": bm["bundle_digest"],
        "previous_write_id": intent["write_id"] if intent else None, "previous_write_state": previous_state if intent else "none",
        "base": {k: b[k] for k in BASE}, "target_epoch": b["crypto_epoch"], "confirmed_reuse_original_result": True}


def reencrypt(intent, originals, old_epoch):
    values = {json.loads(k)["slot"]: json.loads(decrypt(json.loads(raw)["ciphertext"], old_epoch))["value"] for k, raw in originals.items()}
    result = {}
    for s in intent["slots"]:
        if s["is_null"]:
            continue
        value, binding = values[s["key"]["slot"]], s["expected_binding"]
        inner = {"schema_version": 1, "binding": binding, "value": value, "content_origin_kind": "linked_text", "semantic_sha256": digest(value.encode())}
        epoch = intent["metadata_context"]["target_epoch"]
        result[canonical(s["key"])] = canonical({"schema_version": 1, "kind": "linked_text_envelope_v1", "crypto_epoch": epoch,
            "binding": binding, "ciphertext": encrypt(canonical(inner), epoch)}).encode()
    return result


def test_pk_conflict_rolls_back_preserves_bundle_and_explicit_replan_only(client, subject):
    from app.models.note import AnalysisJob
    from app.models.protected_analysis import ProtectedAnalysisClaim
    from app.models.note_crypto import NoteCryptoFence
    s, local = subject, "c2-collision"
    b, intent, bm, raws = prepared(client, s, local)
    cb = upload(client, s, local, PA, b, intent, raws)
    candidate = int(intent["slots"][0]["key"]["id"])
    with s["engine"].begin() as conn:
        conn.execute(AnalysisJob.__table__.insert().values(id=candidate, owner_id=s["other"], job_type="memo_summary",
            status="done", input_text="ordinary must remain"))
    r = client.post(PA + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "provisional_job_id_conflict", r.text
    assert client.post(PA + "/commit", json=cb, headers=s["headers"]).json()["receipt"] == r.json()["receipt"]
    s["db"].expire_all()
    assert s["db"].get(AnalysisJob, candidate).input_text == "ordinary must remain"
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None
    progress = json.loads(s["db"].get(ProtectedAnalysisClaim, b["execution_id"]).progress_json)
    assert progress["terminal_bundle"] == bm
    rp = replan_body(client, s, local, b, intent, bm)
    r = client.post(PA + "/replans", json=rp, headers=s["headers"])
    assert r.status_code == 201, r.text
    fresh = r.json(); assert fresh["write_id"] != intent["write_id"] and fresh["origin"]["original_bundle_digest"] == bm["bundle_digest"]
    new_raws = reencrypt(fresh, raws, bm["original_epoch"])
    cp = upload(client, s, local, PA, rp, fresh, new_raws)
    r = client.post(PA + "/commit", json=cp, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["receipt"]["job_id"] != candidate
    again = {**rp, "mutation_id": str(uuid4())}
    assert client.post(PA + "/replans", json=again, headers=s["headers"]).status_code == 409


def test_legacy_automatic_insert_interleaves_without_overwrite(client, subject):
    from app.models.note import AnalysisJob
    s, local = subject, "c2-legacy-insert"
    b, intent, bm, raws = prepared(client, s, local)
    cb = upload(client, s, local, PA, b, intent, raws)
    r = client.post("/api/v1/analysis/jobs", json={"owner_id": s["owner"], "job_type": "memo_summary", "input_text": "legacy independent"}, headers=s["headers"])
    assert r.status_code == 200, r.text
    legacy_id = r.json()["id"]
    r = client.post(PA + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == (409 if s["engine"].dialect.name == "sqlite" else 200), r.text
    s["db"].expire_all(); assert s["db"].get(AnalysisJob, legacy_id).input_text == "legacy independent"


@pytest.mark.parametrize("same", [True, False])
def test_two_claim_transactions_distinguish_execution_and_provisional_id(client, subject, same):
    from concurrent.futures import ThreadPoolExecutor
    from sqlalchemy.orm import Session
    from app.schemas.protected_analysis import Claim
    from app.services import protected_analysis as svc
    s, local = subject, "c2-two-claims"
    seed(client, s, local); convert(client, s, local)
    a = claim_body(client, s, local); b = a if same else {**a, "mutation_id": str(uuid4())}
    def run(body):
        with Session(s["engine"], autoflush=False) as db:
            return svc.claim(db, Claim.model_validate(body))
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(run, [a, b]))
    if same:
        assert results[0]["execution_id"] == results[1]["execution_id"]
    else:
        assert results[0]["execution_id"] != results[1]["execution_id"]
        assert (results[0]["original_job_id"] == results[1]["original_job_id"]) == (s["engine"].dialect.name == "sqlite")


def transcript_request(client, s, local, *, is_null=False):
    from app.models.note import Recording
    from .test_related_text import prepare, stage
    seed(client, s, local)
    rec = Recording(owner_id=s["owner"], device_id="actor", local_id=str(uuid4()), note_local_id=local,
        file_name="preserved.wav", content_type="audio/wav", storage_path="synthetic-preserved.wav", transcript="before\r\n")
    s["db"].add(rec); s["db"].commit(); ident = rec.id
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    c, items, _ = read_all(client, s, local)
    d = next(d for d in items if d["key"]["kind"] == "recording_transcript")
    base = context(client, s, local)
    return {"schema_version": 1, **query(s, local), "server_instance_id": c["server_instance_id"], "mutation_id": str(uuid4()),
        "base": {k: base[k] for k in BASE}, "recording_id": ident, "expected_slot_version": d["slot_version"],
        "expected_representation_etag": d["representation_etag"], "is_null": is_null}


@pytest.mark.parametrize("null", [True, False])
def test_single_transcript_cas_preserves_file_and_created_at(client, subject, null):
    from app.models.note import Recording
    s, local = subject, "c2-transcript"
    body = transcript_request(client, s, local, is_null=null)
    s["db"].expire_all(); old = s["db"].get(Recording, body["recording_id"])
    created, path = old.created_at, old.storage_path
    r = client.post(PT + "/prepare", json=body, headers=s["headers"])
    assert r.status_code == 201, r.text
    intent = r.json(); raws = {}
    if not null:
        k, binding = intent["slots"][0]["key"], intent["slots"][0]["expected_binding"]
        inner = {"schema_version": 1, "binding": binding, "value": "", "content_origin_kind": "linked_text", "semantic_sha256": digest(b"")}
        raws[canonical(k)] = canonical({"schema_version": 1, "kind": "linked_text_envelope_v1", "crypto_epoch": body["base"]["crypto_epoch"],
            "binding": binding, "ciphertext": encrypt(canonical(inner), body["base"]["crypto_epoch"])}).encode()
    cb = upload(client, s, local, PT, body, intent, raws)
    r = client.post(PT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["receipt"]["slot_receipts"][0]["slot_version"] == body["expected_slot_version"] + 1
    s["db"].expire_all(); saved = s["db"].get(Recording, body["recording_id"])
    assert saved.created_at == created and saved.storage_path == path and (saved.transcript is None) == null
    _, items, _ = read_all(client, s, local)
    d = next(d for d in items if d["key"]["kind"] == "recording_transcript")
    assert d["is_null"] == null


@pytest.mark.parametrize("sql", ["insert into analysis_jobs", "insert into note_linked_texts", "update note_heads", "update note_crypto_transitions"])
def test_analysis_sql_failure_has_no_partial_job_or_generation(client, subject, sql):
    from sqlalchemy import event
    from app.models.note import AnalysisJob
    from app.models.note_history import NoteHead
    s, local = subject, "c2-rollback"
    b, intent, bm, raws = prepared(client, s, local); cb = upload(client, s, local, PA, b, intent, raws)
    candidate = int(intent["slots"][0]["key"]["id"]); fired = []
    def fail(conn, cursor, statement, params, ctx, many):
        if statement.lower().startswith(sql):
            fired.append(True); raise RuntimeError("synthetic atomic failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post(PA + "/commit", json=cb, headers=s["headers"])
        assert fired and r.status_code == 500, r.text
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    s["db"].expire_all()
    assert s["db"].get(AnalysisJob, candidate) is None
    assert s["db"].get(NoteHead, (s["owner"], local)).history_generation == b["base"]["history_generation"]
    assert client.post(PA + "/commit", json=cb, headers=s["headers"]).status_code == 200


@pytest.mark.parametrize("damage", ["flag", "scope", "instance", "duplicate_source", "source_version"])
def test_claim_rejects_ambiguous_or_wrong_source_metadata(client, subject, damage):
    s, local = subject, "c2-reject-claim"
    seed(client, s, local); convert(client, s, local)
    b = claim_body(client, s, local)
    expected = 409
    if damage == "flag":
        b["client_execution_confirmed"] = 1; expected = 422
    elif damage == "scope":
        b["local_id"] = "another scope"
    elif damage == "instance":
        b["server_instance_id"] = str(uuid4())
    elif damage == "duplicate_source":
        b["source_keys"] += b["source_keys"]
    else:
        b["source_keys"][0]["slot_version"] = 123
    r = client.post(PA + "/claims", json=b, headers=s["headers"])
    assert r.status_code == expected, r.text


@pytest.mark.parametrize("damage", ["bundle_hash", "missing_null", "wrong_key", "checkpoint"])
def test_terminal_rejects_incomplete_bundle_without_settling(client, subject, damage):
    s, local = subject, "c2-reject-settle"
    b, c = started(client, s, local); bm, raws = make_bundle(c)
    body = settle_body(s, local, c, bm)
    if damage == "bundle_hash":
        bm["bundle_digest"] = "0" * 64
    elif damage == "missing_null":
        bm["slot_nulls"] = bm["slot_nulls"][:-1]
    elif damage == "wrong_key":
        bm["original_job_id"] += 100
    else:
        body["local_checkpoint_confirmed"] = False
    r = client.post(PA + "/claims/settle", json=body, headers=s["headers"])
    assert r.status_code == 409, r.text
    r = client.get(PA + "/claims/status", params={**query(s, local), "server_instance_id": b["server_instance_id"], "execution_id": c["execution_id"]}, headers=s["headers"])
    assert r.json()["terminal_receipt"] is None and r.json()["execution_state"] == "client_running"


def test_stale_epoch_result_retains_original_source_and_explicit_reencrypt(client, subject):
    s, local = subject, "c2-old-epoch"
    b, c = started(client, s, local); bm, raws = make_bundle(c)
    r = client.post(PA + "/claims/settle", json=settle_body(s, local, c, bm), headers=s["headers"])
    assert r.status_code == 200, r.text
    tr = r.json()["terminal_receipt"]
    convert(client, s, local)
    current = context(client, s, local)
    assert current["crypto_epoch"] == bm["original_epoch"] + 1
    initial = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"], "mutation_id": str(uuid4()),
        "execution_id": c["execution_id"], "terminal_run_version": tr["terminal_run_version"], "terminal_receipt_digest": digest(canonical(tr).encode()),
        "base": {k: current[k] for k in BASE}, "bundle_metadata": bm}
    assert client.post(PA + "/result-prepare", json=initial, headers=s["headers"]).status_code == 409
    rp = replan_body(client, s, local, initial, None, bm)
    r = client.post(PA + "/replans", json=rp, headers=s["headers"])
    assert r.status_code == 201, r.text
    intent = r.json(); assert intent["origin"]["source_context"] == b["source_context"]
    assert intent["metadata_context"]["target_epoch"] == current["crypto_epoch"]
    cb = upload(client, s, local, PA, rp, intent, reencrypt(intent, raws, bm["original_epoch"]))
    assert client.post(PA + "/commit", json=cb, headers=s["headers"]).status_code == 200


def test_raw_response_unavailable_is_not_cipher_or_server_storage(client, subject):
    s, local = subject, "c2-unavailable"
    b, c = started(client, s, local)
    body = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"],
        **{k: c[k] for k in ("execution_id", "run_version", "lease_version")}, "dispatch_id": c["dispatch_receipt"]["dispatch_id"],
        "provider_terminal_observed": True, "outcome": "result_unavailable", "bundle_metadata": None,
        "local_checkpoint_confirmed": False, "unavailable_reason": "key_unavailable"}
    r = client.post(PA + "/claims/settle", json=body, headers=s["headers"])
    assert r.status_code == 200, r.text
    result = r.json()
    assert result["execution_state"] == "result_unavailable" and result["storage_receipts"] == []
    assert result["terminal_receipt"]["bundle_digest"] is None and result["terminal_receipt"]["result_server_persisted"] is False


@pytest.mark.parametrize("damage", ["slot_version", "etag", "owner", "local"])
def test_transcript_prepare_requires_exact_live_ref(client, subject, damage):
    s, local = subject, "c2-transcript-cas"
    body = transcript_request(client, s, local)
    if damage == "slot_version":
        body["expected_slot_version"] += 1
    elif damage == "etag":
        body["expected_representation_etag"] = "0" * 64
    elif damage == "owner":
        body["owner_id"] = s["other"]
    else:
        body["local_id"] = "another"
    r = client.post(PT + "/prepare", json=body, headers=s["headers"])
    assert r.status_code in (401, 403, 404, 409), r.text


@pytest.mark.parametrize("error_value", [None, "", "original raw error\r\n"])
def test_failed_result_preserves_nullable_error_without_plaintext(client, subject, error_value):
    from app.models.note import AnalysisJob
    s, local = subject, "c2-failed"
    b, c = started(client, s, local); bm, raws = make_bundle(c, outcome="failed", error_value=error_value)
    r = client.post(PA + "/claims/settle", json=settle_body(s, local, c, bm), headers=s["headers"])
    assert r.status_code == 200, r.text
    tr = r.json()["terminal_receipt"]
    request = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"], "mutation_id": str(uuid4()),
        "execution_id": c["execution_id"], "terminal_run_version": tr["terminal_run_version"], "terminal_receipt_digest": digest(canonical(tr).encode()),
        "base": b["source_context"]["base"], "bundle_metadata": bm}
    r = client.post(PA + "/result-prepare", json=request, headers=s["headers"])
    assert r.status_code == 201, r.text
    intent = r.json(); cb = upload(client, s, local, PA, request, intent, raws)
    r = client.post(PA + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all(); job = s["db"].get(AnalysisJob, r.json()["receipt"]["job_id"])
    assert job.status == "failed" and job.result_json is None
    if error_value is None:
        assert job.error_message is None
    else:
        inner = json.loads(decrypt(json.loads(job.error_message)["ciphertext"], bm["original_epoch"]))
        assert inner["value"] == error_value


@pytest.mark.parametrize("sql", ["update recordings", "update note_linked_texts", "update note_heads", "update note_crypto_transitions"])
def test_transcript_sql_failure_preserves_all_original_metadata(client, subject, sql):
    from sqlalchemy import event
    from app.models.note import Recording
    from app.models.note_related import LinkedText
    from app.models.note_history import NoteHead
    s, local = subject, "c2-transcript-rollback"
    b = transcript_request(client, s, local, is_null=True)
    s["db"].expire_all(); old = s["db"].get(Recording, b["recording_id"])
    before = tuple(getattr(old, c.name) for c in Recording.__table__.columns)
    r = client.post(PT + "/prepare", json=b, headers=s["headers"]); assert r.status_code == 201, r.text
    intent = r.json(); cb = upload(client, s, local, PT, b, intent, {})
    fired = []
    def fail(conn, cursor, statement, params, ctx, many):
        if statement.lower().startswith(sql):
            fired.append(True); raise RuntimeError("synthetic transcript rollback")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post(PT + "/commit", json=cb, headers=s["headers"])
        assert fired and r.status_code == 500, r.text
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    s["db"].expire_all(); saved = s["db"].get(Recording, b["recording_id"])
    assert tuple(getattr(saved, c.name) for c in Recording.__table__.columns) == before
    meta = s["db"].get(LinkedText, (s["owner"], local, canonical(intent["slots"][0]["key"])))
    assert meta.slot_version == b["expected_slot_version"]
    assert s["db"].get(NoteHead, (s["owner"], local)).history_generation == b["base"]["history_generation"]
    assert client.post(PT + "/commit", json=cb, headers=s["headers"]).status_code == 200


def test_renew_stale_abort_cas_and_dispatched_abort_waits_for_terminal(client, subject):
    s, local = subject, "c2-renew"
    b, c = started(client, s, local)
    a = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"],
        **{k: c[k] for k in ("execution_id", "run_version", "lease_version")}}
    r = client.post(PA + "/claims/renew", json=a, headers=s["headers"])
    assert r.status_code == 200 and r.json()["lease_version"] == a["lease_version"] + 1
    assert client.post(PA + "/claims/abort", json=a, headers=s["headers"]).status_code == 409
    a["lease_version"] += 1
    r = client.post(PA + "/claims/abort", json=a, headers=s["headers"])
    assert r.status_code == 200 and r.json()["execution_state"] == "cancel_requested" and r.json()["terminal_receipt"] is None
    c = r.json(); bm, raws = make_bundle(c)
    assert client.post(PA + "/claims/settle", json=settle_body(s, local, c, bm), headers=s["headers"]).status_code == 200


def test_c1_reencryption_keeps_c2_provenance(client, subject):
    from .test_related_text import prepare, stage
    s, local = subject, "c2-to-c1"
    b, intent, bm, raws = prepared(client, s, local)
    cb = upload(client, s, local, PA, b, intent, raws)
    assert client.post(PA + "/commit", json=cb, headers=s["headers"]).status_code == 200
    p, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, p, t)
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 200, r.text
    r = client.get("/api/v2/analysis/jobs", params={**query(s, local), "representation_schema": 2}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["items"][0]["execution_id"] == b["execution_id"], r.text


@pytest.mark.parametrize("winner", ["commit", "abort"])
def test_pk_rollback_gap_preserves_latest_terminal_under_owner_lock(client, subject, monkeypatch, winner):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from sqlalchemy.orm import Session
    from app.models.note import AnalysisJob
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence
    from app.schemas.protected_analysis import Commit, WriteAction
    from app.services import related_writes as writes
    s, local = subject, "c2-rollback-gap"
    b, intent, bm, raws = prepared(client, s, local)
    cb = upload(client, s, local, PA, b, intent, raws)
    candidate = int(intent["slots"][0]["key"]["id"])
    with s["engine"].begin() as conn:
        conn.execute(AnalysisJob.__table__.insert().values(id=candidate, owner_id=s["other"], job_type="memo_summary",
            status="done", input_text="owned synthetic occupier"))
    released, finished = Event(), Event()
    sessions = []
    original_rollback = Session.rollback
    def gap(db):
        original_rollback(db)
        if sessions and db is sessions[0] and not released.is_set():
            released.set()
            assert finished.wait(15)
    monkeypatch.setattr(Session, "rollback", gap)
    def losing():
        with Session(s["engine"], autoflush=False) as db:
            sessions.append(db)
            return writes.commit(db, Commit.model_validate(cb), writes.ANALYSIS)
    def winning():
        assert released.wait(15)
        try:
            if winner == "commit":
                # The occupying ordinary QA row disappears before the second INSERT.
                with s["engine"].begin() as conn:
                    conn.execute(AnalysisJob.__table__.delete().where(AnalysisJob.id == candidate, AnalysisJob.owner_id == s["other"]))
                with Session(s["engine"], autoflush=False) as db:
                    return writes.commit(db, Commit.model_validate(cb), writes.ANALYSIS)
            with Session(s["engine"], autoflush=False) as db:
                a = {"schema_version": 1, **query(s, local), "server_instance_id": b["server_instance_id"],
                    "write_id": intent["write_id"], "lease_version": intent["lease_version"]}
                return writes.action(db, WriteAction.model_validate(a), writes.ANALYSIS, "abort")
        finally:
            finished.set()
    with ThreadPoolExecutor(2) as pool:
        a, other = pool.submit(losing), pool.submit(winning)
        first, second = a.result(timeout=25), other.result(timeout=25)
    s["db"].expire_all(); row = s["db"].get(NoteCryptoTransition, intent["write_id"])
    assert row.state == ("committed" if winner == "commit" else "aborted")
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None
    if winner == "commit":
        assert first["receipt"] == second["receipt"] and json.loads(row.receipt_json) == second["receipt"]
    else:
        assert first["http_status"] == 409 and row.receipt_json is None and second["state"] == "aborted"
        assert s["db"].get(AnalysisJob, candidate).input_text == "owned synthetic occupier"
