"""Mixed linked writes preserve execution receipts and original note/file data."""
import pytest
from uuid import uuid4

from .test_note_crypto import subject
from .test_note_mixed import enabled, mcontext
from .test_mixed_analysis_claims import started, bundle, settle_body, MX

MA = "/api/v2/notes/mixed-analysis-writes"
MT = "/api/v2/notes/mixed-transcript-writes"


def rotated_and_restarted(client, s, local, q):
    from .test_note_mixed import ready_rc, MR, rq
    from app.services.note_mixed_metadata import initialize, canonical
    from app.models.note_mixed import MixedSlot
    a, ctx = mcontext(client, s, local)
    page = client.get(MR + "/catalog", params=rq(a, ctx), headers=s["headers"])
    assert page.status_code == 200, page.text
    for d in page.json()["entries"]:
        if d["origin_validator"] == "linked_mixed_v1" and d["is_null"]:
            assert d["expected_binding"] is None
            key = d["key"]
            params = {**rq(a, ctx), "kind": key["kind"], "representation_id": key["id"], "slot": key["slot"],
                "representation_etag": d["representation_etag"]}
            metadata = client.get(MR + "/metadata", params=params, headers=s["headers"])
            raw = client.get(MR + "/representation", params={**params, "chunk_index": 0}, headers=s["headers"])
            assert metadata.status_code == raw.status_code == 200
            assert metadata.json()["descriptor"] == raw.json()["descriptor"] == d
            assert raw.json()["total_bytes"] == raw.json()["total_chunks"] == 0
            assert raw.json()["data_base64"] is raw.json()["chunk_index"] is None
    a, op, m, commit, _ = ready_rc(client, s, local, origins={q["operation_id"]: q["metadata_header"]["operation_origin"]})
    assert any(o["origin_validator"] == "linked_mixed_v1" and o["semantic_origin_id"] == q["operation_id"] for o in m["O"])
    for d in m["DSET"]:
        o = next(o for o in m["O"] if o["destination_key"] == d["destination_key"])
        if o["origin_validator"] == "linked_mixed_v1" and d["is_null"]:
            assert d["expected_binding"] is None
    r = client.post("/api/v2/notes/mixed-conversions/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert mcontext(client, s, local)[1]["context"] == r.json()["receipt"]["result"]
    s["db"].rollback()
    with s["engine"].begin() as connection:
        initialize(connection)
        initialize(connection)
    mcontext(client, s, local)


@pytest.mark.parametrize("value", [None, "", "new transcript\r\n"])
def test_transcript_only_publish_preserves_file_identity_and_times(client, subject, enabled, value):
    import json
    from sqlalchemy import select
    from app.models.note import Recording, Note
    from .test_note_crypto_conversion import seed, canonical, digest, encrypt
    from .test_related_text import prepare, stage, ROOT
    from .test_note_mixed import MR, rq
    s, local = subject, "m2c2-transcript"
    seed(client, s, local)
    rec = Recording(owner_id=s["owner"], note_local_id=local, device_id="actor", local_id=str(uuid4()),
        file_name="original.wav", content_type="audio/wav", storage_path="synthetic.wav", transcript="old transcript")
    s["db"].add(rec); s["db"].commit(); rid = rec.id
    b0, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b0, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    s["db"].expire_all()
    old = dict(s["db"].execute(select(Recording.__table__).where(Recording.id == rid)).mappings().one())
    notes = list(s["db"].execute(select(Note.__table__)))
    s["db"].rollback()
    a, ctx = mcontext(client, s, local)
    r = client.get(MR + "/catalog", params=rq(a, ctx), headers=s["headers"])
    assert r.status_code == 200, r.text
    descriptors = r.json()["entries"]
    d = next(d for d in descriptors if d["key"]["kind"] == "recording_transcript")
    b = {**a, "mutation_id": str(uuid4()), "base": ctx["context"], "expected_catalog_digest": ctx["catalog_digest"],
        "recording_id": rid, "expected_descriptor": d, "is_null": value is None}
    r = client.post(MT + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json(); header = q["metadata_header"]
    assert header["control"] == {"recording_id": rid, "expected_descriptor": d, "is_null": value is None}
    assert q["counts"]["S"]["total"] == 1
    assert q["counts"]["P"]["total"] == len(descriptors) - 1
    r = client.get(MT + "/manifest", params={**a, "operation_id": q["operation_id"],
        "metadata_manifest_digest": q["metadata_manifest_digest"], "section": "DSET"}, headers=s["headers"])
    assert r.status_code == 200, r.text
    output = r.json()["entries"][0]; raws = {}
    if value is not None:
        inner = {"schema_version": 1, "binding": output["expected_binding"], "value": value, "semantic_sha256": digest(value.encode())}
        raws[canonical(output["destination_key"])] = canonical({"schema_version": 1, "kind": output["output_kind"],
            "crypto_epoch": output["output_epoch"], "binding": output["expected_binding"],
            "ciphertext": encrypt(canonical(inner), output["output_epoch"])}).encode()
    _, commit = staged(client, s, b, q, MT, raws)
    r = client.post(MT + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["receipt"]["result"]["base"]["history_generation"] == b["base"]["base"]["history_generation"] + 1
    s["db"].expire_all()
    now = dict(s["db"].execute(select(Recording.__table__).where(Recording.id == rid)).mappings().one())
    assert {k: v for k, v in now.items() if k != "transcript"} == {k: v for k, v in old.items() if k != "transcript"}
    assert list(s["db"].execute(select(Note.__table__))) == notes
    assert now["transcript"] is None if value is None else now["transcript"].encode() == raws[canonical(output["destination_key"])]
    s["db"].rollback()
    assert client.post(MT + "/commit", json=commit, headers=s["headers"]).status_code == 200
    assert mcontext(client, s, local)[1]["context"] == r.json()["receipt"]["result"]
    rotated_and_restarted(client, s, local, q)


@pytest.mark.parametrize("damage", ["file_name", "storage_path", "content_type", "device_id", "local_id", "created_at", "updated_at",
    "descriptor_etag", "descriptor_version", "recording_owner", "null_metadata_loss", "sql"])
def test_transcript_signature_descriptor_and_publication_fail_closed(client, subject, enabled, damage):
    from sqlalchemy import event, select
    from datetime import timedelta
    from app.models.note import Recording
    from app.models.note_related import LinkedText
    from app.models.note_crypto import NoteCryptoTransition
    from .test_note_crypto_conversion import seed
    from .test_related_text import prepare, stage, ROOT
    from .test_note_mixed import MR, rq, live_rows
    s, local = subject, "m2c2-mt-failure"
    seed(client, s, local)
    rec = Recording(owner_id=s["owner"], note_local_id=local, device_id="actor", local_id=str(uuid4()),
        file_name="original.wav", content_type="audio/wav", storage_path="synthetic.wav", transcript=None)
    s["db"].add(rec); s["db"].commit(); rid = rec.id
    b0, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b0, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    a, ctx = mcontext(client, s, local)
    r = client.get(MR + "/catalog", params=rq(a, ctx), headers=s["headers"])
    d = next(d for d in r.json()["entries"] if d["key"]["kind"] == "recording_transcript")
    b = {**a, "mutation_id": str(uuid4()), "base": ctx["context"], "expected_catalog_digest": ctx["catalog_digest"],
        "recording_id": rid, "expected_descriptor": d, "is_null": True}
    if damage.startswith("descriptor_"):
        d["representation_etag" if damage.endswith("etag") else "linked_slot_version"] = str(uuid4()) if damage.endswith("etag") else d["linked_slot_version"] + 1
        r = client.post(MT + "/prepare", json=b, headers=s["headers"])
        assert r.status_code == 409, r.text
        return
    if damage == "recording_owner":
        b["recording_id"] = rid + 1000000
        r = client.post(MT + "/prepare", json=b, headers=s["headers"])
        assert r.status_code == 404, r.text
        return
    r = client.post(MT + "/prepare", json=b, headers=s["headers"]); assert r.status_code == 201, r.text
    q = r.json(); _, commit = staged(client, s, b, q, MT, {})
    if damage == "null_metadata_loss":
        with s["engine"].begin() as connection:
            original_linked = [dict(row) for row in connection.execute(select(LinkedText.__table__).where(
                LinkedText.owner_id == s["owner"], LinkedText.local_id == local)).mappings()]
            connection.execute(LinkedText.__table__.delete().where(LinkedText.owner_id == s["owner"], LinkedText.local_id == local))
    elif damage != "sql":
        s["db"].expire_all(); rec = s["db"].get(Recording, rid)
        old = getattr(rec, damage)
        original_updated_at = rec.updated_at
        s["db"].rollback()
        changed = old + timedelta(seconds=1) if damage.endswith("_at") else "changed"
        with s["engine"].begin() as connection:
            connection.execute(Recording.__table__.update().where(Recording.id == rid).values(
                **{"updated_at": original_updated_at, damage: changed}))
    before = live_rows(s, local) if damage != "null_metadata_loss" else None
    fired = []
    def fail(connection, cursor, statement, parameters, context, executemany):
        if not fired and statement.lower().startswith("update recordings"):
            fired.append(True); raise RuntimeError("synthetic transcript publication failure")
    if damage == "sql":
        event.listen(s["engine"], "after_cursor_execute", fail)
    try:
        r = client.post(MT + "/commit", json=commit, headers=s["headers"])
    finally:
        if damage == "sql":
            event.remove(s["engine"], "after_cursor_execute", fail)
    assert r.status_code == (500 if damage == "sql" else 409), r.text
    if before is not None:
        assert live_rows(s, local) == before
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, q["operation_id"]).receipt_json is None
    s["db"].rollback()
    if damage == "null_metadata_loss":
        with s["engine"].begin() as connection:
            connection.execute(LinkedText.__table__.insert(), original_linked)
    elif damage != "sql":
        with s["engine"].begin() as connection:
            connection.execute(Recording.__table__.update().where(Recording.id == rid).values(
                **{"updated_at": original_updated_at, damage: old}))


def test_historical_transcript_status_revalidates_receipt_after_next_write(client, subject, enabled):
    import json
    from app.models.note import Recording
    from app.models.note_crypto import NoteCryptoTransition
    from app.services import note_mixed_read as read
    from app.services.note_mixed_metadata import canonical
    from .test_note_crypto_conversion import seed
    from .test_related_text import prepare, stage, ROOT
    s, local = subject, "m2c2-old-mt-status"
    seed(client, s, local)
    rec = Recording(owner_id=s["owner"], note_local_id=local, device_id="actor", local_id=str(uuid4()),
        file_name="fixture.wav", content_type="audio/wav", storage_path="synthetic.wav", transcript=None)
    s["db"].add(rec); s["db"].commit(); rid = rec.id
    b0, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b0, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    stored = []
    for _ in range(2):
        a, ctx = mcontext(client, s, local)
        d = next(d for d in read.descriptors(s["db"], s["owner"], local) if d["key"]["kind"] == "recording_transcript")
        s["db"].rollback()
        b = {**a, "mutation_id": str(uuid4()), "base": ctx["context"], "expected_catalog_digest": ctx["catalog_digest"],
            "recording_id": rid, "expected_descriptor": d, "is_null": True}
        r = client.post(MT + "/prepare", json=b, headers=s["headers"]); assert r.status_code == 201, r.text
        q = r.json(); _, commit = staged(client, s, b, q, MT, {})
        r = client.post(MT + "/commit", json=commit, headers=s["headers"]); assert r.status_code == 200, r.text
        stored.append(q)
    row = s["db"].get(NoteCryptoTransition, stored[0]["operation_id"])
    original_receipt = row.receipt_json
    broken = json.loads(original_receipt); broken["ciphertext_manifest_digest"] = "0" * 64
    s["db"].rollback()
    with s["engine"].begin() as connection:
        connection.execute(NoteCryptoTransition.__table__.update().where(NoteCryptoTransition.id == stored[0]["operation_id"]).values(receipt_json=canonical(broken)))
    r = client.get(MT + "/status", params={**a, "operation_id": stored[0]["operation_id"]}, headers=s["headers"])
    assert r.status_code == 409, r.text
    with s["engine"].begin() as connection:
        connection.execute(NoteCryptoTransition.__table__.update().where(NoteCryptoTransition.id == stored[0]["operation_id"]).values(receipt_json=original_receipt))


def replan_request(client, s, old, previous=None, state="none"):
    a, ctx = mcontext(client, s, old["local_id"])
    return {**a, "mutation_id": str(uuid4()), "base": ctx["context"], "expected_catalog_digest": ctx["catalog_digest"],
        "execution_ref": old["execution_ref"], "previous_write_id": previous, "previous_write_state": state,
        "target_epoch": ctx["context"]["base"]["crypto_epoch"], "confirmed_reuse_original_result": True}


@pytest.mark.parametrize("boundary", ["insert into analysis_jobs", "insert into note_linked_texts", "insert into note_mixed_slots",
    "update note_heads", "update note_crypto_transitions", "delete from note_crypto_fences"])
def test_analysis_publication_sql_failure_is_atomic_and_retryable(client, subject, enabled, boundary):
    from sqlalchemy import event, select
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoUpload
    from .test_note_mixed import live_rows
    s, local = subject, "m2c2-sql-failure"
    b, bm, raws, original = settled(client, s, local)
    r = client.post(MA + "/prepare", json=b, headers=s["headers"]); assert r.status_code == 201, r.text
    q = r.json(); _, request = staged(client, s, b, q, MA, raws)
    before = live_rows(s, local); fired = []
    def fail(connection, cursor, statement, parameters, context, executemany):
        if not fired and statement.lower().startswith(boundary):
            fired.append(True); raise RuntimeError("synthetic publication failure")
    event.listen(s["engine"], "after_cursor_execute", fail)
    try:
        r = client.post(MA + "/commit", json=request, headers=s["headers"])
    finally:
        event.remove(s["engine"], "after_cursor_execute", fail)
    assert fired and r.status_code == 500, r.text
    assert live_rows(s, local) == before
    s["db"].expire_all()
    op = s["db"].get(NoteCryptoTransition, q["operation_id"])
    assert op.state == "ready" and op.receipt_json is None
    assert s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == op.id)) is not None
    s["db"].rollback()
    r = client.post(MA + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text


def test_initial_different_valid_cipher_is_not_original_bundle(client, subject, enabled):
    import json
    from .test_note_crypto_conversion import encrypt, decrypt, canonical
    from .test_note_mixed import live_rows
    s, local = subject, "m2c2-cipher-mismatch"
    b, bm, raws, _ = settled(client, s, local)
    r = client.post(MA + "/prepare", json=b, headers=s["headers"]); assert r.status_code == 201, r.text
    q = r.json(); altered = dict(raws)
    for k, raw in altered.items():
        outer = json.loads(raw); outer["ciphertext"] = encrypt(decrypt(outer["ciphertext"], outer["crypto_epoch"]), outer["crypto_epoch"])
        altered[k] = canonical(outer).encode()
    _, request = staged(client, s, b, q, MA, altered)
    before = live_rows(s, local)
    r = client.post(MA + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "original_cipher_bundle_mismatch", r.text
    assert live_rows(s, local) == before


@pytest.mark.parametrize("damage", ["status", "job_type", "created_at", "updated_at"])
def test_published_analysis_immutable_job_metadata_loss_is_rejected(client, subject, enabled, damage):
    from datetime import timedelta
    from app.models.note import AnalysisJob
    from .test_note_mixed import MR
    s, local = subject, "m2c2-job-integrity"
    b, bm, raws, _ = settled(client, s, local)
    q = client.post(MA + "/prepare", json=b, headers=s["headers"]).json()
    _, commit = staged(client, s, b, q, MA, raws)
    r = client.post(MA + "/commit", json=commit, headers=s["headers"]); assert r.status_code == 200, r.text
    s["db"].expire_all(); job = s["db"].get(AnalysisJob, bm["original_job_id"])
    value = getattr(job, damage)
    updated = job.updated_at
    s["db"].rollback()
    with s["engine"].begin() as connection:
        connection.execute(AnalysisJob.__table__.update().where(AnalysisJob.id == bm["original_job_id"]).values(
            **{"updated_at": updated, damage: value + timedelta(seconds=1) if damage.endswith("_at") else "changed"}))
    a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    r = client.get(MR + "/context", params=a, headers=s["headers"])
    assert r.status_code == 409, r.text
    with s["engine"].begin() as connection:
        connection.execute(AnalysisJob.__table__.update().where(AnalysisJob.id == bm["original_job_id"]).values(
            **{"updated_at": updated, damage: value}))


@pytest.mark.parametrize("damage", ["schema", "terminal_digest", "bundle_digest", "source_context", "bm_null", "bm_cipher"])
def test_initial_wrong_reference_or_bundle_cannot_prepare(client, subject, enabled, damage):
    from copy import deepcopy
    from .test_note_mixed import live_rows
    s, local = subject, "m2c2-reference"
    b, _, _, _ = settled(client, s, local)
    b = deepcopy(b)
    if damage == "schema":
        b["execution_ref"]["schema_version"] = 1
    elif damage in ("terminal_digest", "bundle_digest"):
        b["execution_ref"]["terminal_receipt_digest" if damage == "terminal_digest" else "original_bundle_digest"] = "0" * 64
    elif damage == "source_context":
        b["expected_catalog_digest"] = "0" * 64
    elif damage == "bm_null":
        b["bundle_metadata"]["slot_nulls"].pop()
    else:
        b["bundle_metadata"]["ciphertext_manifest"].pop()
    before = live_rows(s, local)
    r = client.post(MA + "/prepare", json=b, headers=s["headers"])
    assert r.status_code in (409, 422), r.text
    assert live_rows(s, local) == before


@pytest.mark.parametrize("damage", ["lease", "target_epoch", "mutation", "generation", "cipher_digest", "decryption"])
def test_commit_requires_exact_frozen_conditions(client, subject, enabled, damage):
    from .test_note_mixed import live_rows
    s, local = subject, "m2c2-commit-cas"
    b, _, raws, _ = settled(client, s, local)
    q = client.post(MA + "/prepare", json=b, headers=s["headers"]).json()
    _, request = staged(client, s, b, q, MA, raws)
    if damage == "lease":
        request["lease_version"] += 1
    elif damage == "target_epoch":
        request["target_epoch"] += 1
    elif damage == "mutation":
        request["mutation_id"] = str(uuid4())
    elif damage == "generation":
        request["base"]["base"]["history_generation"] += 1
    elif damage == "cipher_digest":
        request["client_verified_ciphertext_manifest_digest"] = "0" * 64
    else:
        request["client_decryption_verified"] = False
    before = live_rows(s, local)
    r = client.post(MA + "/commit", json=request, headers=s["headers"])
    assert r.status_code in (409, 422), r.text
    assert live_rows(s, local) == before


def test_purpose_actor_owner_and_disabled_gate_are_not_bypassed(client, subject, enabled, monkeypatch):
    from .test_note_mixed import live_rows
    from app.core import capabilities
    s, local = subject, "m2c2-access"
    b, _, _, _ = settled(client, s, local)
    before = live_rows(s, local)
    monkeypatch.setattr(capabilities, "MIXED_MUTATIONS_ENABLED", False)
    r = client.post(MA + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "mixed_mode_not_enabled", r.text
    assert live_rows(s, local) == before
    monkeypatch.setattr(capabilities, "MIXED_MUTATIONS_ENABLED", True)
    q = client.post(MA + "/prepare", json=b, headers=s["headers"]).json()
    a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    params = {**a, "operation_id": q["operation_id"]}
    assert client.get(MT + "/status", params=params, headers=s["headers"]).status_code == 404
    assert client.get(MA + "/status", params={**params, "owner_id": s["other"]}, headers=s["headers"]).status_code == 401
    assert client.get(MA + "/status", params={**params, "device_id": "missing-device"}, headers=s["headers"]).status_code == 403


def test_replan_late_operation_uuid_collision_never_overwrites_other_intent(client, subject, enabled, monkeypatch):
    from uuid import UUID
    from sqlalchemy import select
    from app.models.note_crypto import NoteCryptoTransition
    from app.services import note_mixed_related as service
    from .test_note_mixed import ready_cp
    s, local = subject, "m2c2-prepare-collision"
    b, _, _, _ = settled(client, s, local)
    _, cp, _, commit = ready_cp(client, s, local)
    assert client.post("/api/v2/notes/current-plain/commit", json=commit, headers=s["headers"]).status_code == 200
    request = replan_request(client, s, b)
    before = list(s["db"].execute(select(NoteCryptoTransition.__table__)))
    s["db"].rollback()
    monkeypatch.setattr(service, "uuid4", lambda: UUID(cp["operation_id"]))
    r = client.post(MA + "/replan", json=request, headers=s["headers"])
    assert r.status_code == 409, r.text
    assert list(s["db"].execute(select(NoteCryptoTransition.__table__))) == before


@pytest.mark.parametrize("damage", ["control", "null", "origin", "output", "source", "verified", "purpose", "binding"])
def test_frozen_manifest_rehashed_forgery_is_not_validated_by_hash_alone(client, subject, enabled, damage):
    import json
    from app.models.note_crypto import NoteCryptoTransition
    from app.services.note_mixed_metadata import canonical, h
    s, local = subject, "m2c2-frozen"
    b, _, _, _ = settled(client, s, local)
    q = client.post(MA + "/prepare", json=b, headers=s["headers"]).json()
    row = s["db"].get(NoteCryptoTransition, q["operation_id"])
    original_conditions, original_digest = row.conditions_json, row.manifest_digest
    c = json.loads(original_conditions); m = c["M0"]
    if damage == "control":
        m["control"]["confirmed_reuse_original_result"] = 0
    elif damage == "null":
        m["DSET"][0]["is_null"] = not m["DSET"][0]["is_null"]
    elif damage == "origin":
        m["O"][0]["semantic_origin_id"] = None
    elif damage == "output":
        m["DSET"].pop()
    elif damage == "source":
        m["S"][0]["descriptor"]["representation_etag"] = str(uuid4())
    elif damage == "verified":
        m["verified_existing"] = [m["S"][0]]
    elif damage == "purpose":
        m["purpose"] = "mixed_transcript_write"
    else:
        next(d for d in m["DSET"] if not d["is_null"])["expected_binding"]["crypto_epoch"] = 1.0
    s["db"].rollback()
    with s["engine"].begin() as connection:
        connection.execute(NoteCryptoTransition.__table__.update().where(NoteCryptoTransition.id == q["operation_id"]).values(
            conditions_json=canonical(c), manifest_digest=h(m)))
    a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    r = client.get(MA + "/status", params={**a, "operation_id": q["operation_id"]}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    with s["engine"].begin() as connection:
        connection.execute(NoteCryptoTransition.__table__.update().where(NoteCryptoTransition.id == q["operation_id"]).values(
            conditions_json=original_conditions, manifest_digest=original_digest))


@pytest.mark.parametrize("terminal", ["stale", "committed", "aborted", "expired"])
def test_analysis_job_collision_rollback_preserves_fresh_terminal(client, subject, enabled, terminal):
    from sqlalchemy import event
    from sqlalchemy.orm import Session
    from datetime import datetime, timedelta
    from app.models.note import AnalysisJob
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoUpload, NoteCryptoFence
    from sqlalchemy import select
    s, local = subject, "m2c2-collision"
    b, bm, raws, original = settled(client, s, local)
    r = client.post(MA + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json(); _, request = staged(client, s, b, q, MA, raws)
    ident = bm["original_job_id"]
    with s["engine"].begin() as connection:
        connection.execute(AnalysisJob.__table__.insert().values(id=ident, owner_id=s["other"], note_local_id="occupied",
            job_type="memo_summary", status="done", input_text="foreign fixture"))
    fired, other = [], []
    def interleave(db, previous):
        if fired or previous.parent is not None or db.get_bind() is not s["engine"]:
            return
        fired.append(True)
        if terminal == "stale":
            return
        with s["engine"].begin() as connection:
            connection.execute(AnalysisJob.__table__.delete().where(AnalysisJob.id == ident, AnalysisJob.owner_id == s["other"]))
            if terminal == "expired":
                connection.execute(NoteCryptoTransition.__table__.update().where(NoteCryptoTransition.id == q["operation_id"]).values(
                    expires_at=datetime.utcnow() - timedelta(seconds=5)))
        a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
        if terminal == "committed":
            r = client.post(MA + "/commit", json=request, headers=s["headers"])
            assert r.status_code == 200, r.text
            other.append(r.json()["receipt"])
        elif terminal == "aborted":
            r = client.post(MA + "/abort", json={**a, "operation_id": q["operation_id"], "lease_version": q["lease_version"]}, headers=s["headers"])
            assert r.status_code == 200, r.text
    event.listen(Session, "after_soft_rollback", interleave)
    try:
        r = client.post(MA + "/commit", json=request, headers=s["headers"])
    finally:
        event.remove(Session, "after_soft_rollback", interleave)
    assert fired
    assert r.status_code == (200 if terminal == "committed" else 410 if terminal == "expired" else 409), r.text
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, q["operation_id"]).state == terminal
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None
    assert s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == q["operation_id"])) is not None
    if terminal == "committed":
        assert r.json()["receipt"] == other[0]
    if terminal == "stale":
        assert s["db"].get(AnalysisJob, ident).owner_id == s["other"]
    s["db"].rollback()


def reencrypted(client, s, b, q, original_raws, original_epoch):
    import json
    from .test_note_crypto_conversion import canonical, digest, encrypt, decrypt
    a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    r = client.get(MA + "/manifest", params={**a, "operation_id": q["operation_id"], "metadata_manifest_digest": q["metadata_manifest_digest"], "section": "DSET"}, headers=s["headers"])
    assert r.status_code == 200, r.text
    original = {json.loads(k)["kind"]: json.loads(decrypt(json.loads(raw)["ciphertext"], original_epoch))["value"] for k, raw in original_raws.items()}
    result = {}
    for d in r.json()["entries"]:
        if d["is_null"]:
            continue
        key = d["destination_key"]; value = original[key["kind"]]
        inner = {"schema_version": 1, "binding": d["expected_binding"], "value": value, "semantic_sha256": digest(value.encode())}
        result[canonical(key)] = canonical({"schema_version": 1, "kind": d["output_kind"], "crypto_epoch": d["output_epoch"],
            "binding": d["expected_binding"], "ciphertext": encrypt(canonical(inner), d["output_epoch"])}).encode()
    return result


@pytest.mark.parametrize("mode", ["cp", "rc"])
def test_e3_replan_after_plain_mode_keeps_original_and_already_stored_is_reference_only(client, subject, enabled, mode):
    from .test_note_mixed import ready_cp
    s, local = subject, "m2c2-replan"
    initial, bm, raws, original = settled(client, s, local)
    if mode == "cp":
        _, _, _, cp = ready_cp(client, s, local)
        assert client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"]).status_code == 200
    else:
        from .test_note_mixed import ready_rc
        _, _, _, rc, _ = ready_rc(client, s, local)
        assert client.post("/api/v2/notes/mixed-conversions/commit", json=rc, headers=s["headers"]).status_code == 200
    b = replan_request(client, s, initial)
    r = client.post(MA + "/replan", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    prepared = r.json()
    assert set(prepared) == {"schema_version", "status", "operation", "original_execution"}
    assert prepared["status"] == "prepared" and prepared["original_execution"]["terminal_receipt"] == original["terminal_receipt"]
    q = prepared["operation"]
    assert q["operation_id"] != initial["execution_ref"]["execution_id"]
    assert q["metadata_header"]["operation_origin"]["original_source_context"] == original["source_context"]
    new_raws = reencrypted(client, s, b, q, raws, bm["original_epoch"])
    _, commit = staged(client, s, b, q, MA, new_raws)
    r = client.post(MA + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    receipt = r.json()["receipt"]
    again = replan_request(client, s, initial)
    r = client.post(MA + "/replan", json=again, headers=s["headers"])
    assert r.status_code == 200 and set(r.json()) == {"schema_version", "status", "stored_result", "original_execution", "latest_context"}, r.text
    assert r.json()["status"] == "already_stored" and r.json()["stored_result"] == {
        "schema_version": 3, "operation_id": q["operation_id"], "status_path": MA + "/status", "receipt": receipt}


@pytest.mark.parametrize("mode", ["cp", "rc"])
@pytest.mark.parametrize("outcome", ["done", "failed"])
def test_e1_result_replan_after_cp_does_not_rewrite_original_schema(client, subject, enabled, outcome, mode):
    from . import test_protected_analysis as old
    from .test_note_mixed import ready_cp
    from app.services.note_mixed_metadata import h
    s, local = subject, "m2c2-e1-replan"
    old_body, c = old.started(client, s, local)
    bm, raws = old.make_bundle(c, outcome=outcome)
    r = client.post(old.PA + "/claims/settle", json=old.settle_body(s, local, c, bm), headers=s["headers"])
    assert r.status_code == 200, r.text
    original = r.json()
    ref = {"schema_version": 1, "execution_id": c["execution_id"], "terminal_run_version": original["terminal_receipt"]["terminal_run_version"],
        "terminal_receipt_digest": h(original["terminal_receipt"]), "original_bundle_digest": bm["bundle_digest"]}
    if mode == "cp":
        _, _, _, cp = ready_cp(client, s, local)
        assert client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"]).status_code == 200
    else:
        from .test_note_mixed import ready_rc
        _, _, _, rc, _ = ready_rc(client, s, local)
        assert client.post("/api/v2/notes/mixed-conversions/commit", json=rc, headers=s["headers"]).status_code == 200
    b = replan_request(client, s, {"local_id": local, "execution_ref": ref})
    r = client.post(MA + "/replan", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    result = r.json(); q = result["operation"]
    assert result["original_execution"] == {"reference": ref, "source_schema_version": 1, "source_context": original["source_context"],
        "terminal_receipt": original["terminal_receipt"], "bundle_metadata": bm}
    assert "schema_version" not in result["original_execution"]["terminal_receipt"]
    new_raws = reencrypted(client, s, b, q, raws, bm["original_epoch"])
    _, commit = staged(client, s, b, q, MA, new_raws)
    r = client.post(MA + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200 and r.json()["receipt"]["result"]["current_mode"] == ("plain" if mode == "cp" else "protected"), r.text
    params = {k: old_body[k] for k in ("owner_id", "local_id", "device_id", "server_instance_id")}
    after = client.get(old.PA + "/claims/status", params={**params, "execution_id": c["execution_id"]}, headers=s["headers"])
    assert after.status_code == 200 and after.json()["terminal_receipt"] == original["terminal_receipt"], after.text
    assert after.json()["source_context"] == original["source_context"]


@pytest.mark.parametrize("damage", [None, "execution_id", "write_id", "job_id", "purpose", "ciphertext_manifest_digest"])
def test_e1_already_stored_returns_original_receipt_even_with_stale_w(client, subject, enabled, damage):
    from . import test_protected_analysis as old
    from .test_note_mixed import ready_cp
    from app.models.note_crypto import NoteCryptoTransition
    from sqlalchemy import select, func
    from app.services.note_mixed_metadata import h
    s, local = subject, "m2c2-e1-stored"
    request, intent, bm, raws = old.prepared(client, s, local)
    commit = old.upload(client, s, local, old.PA, request, intent, raws)
    r = client.post(old.PA + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    receipt = r.json()["receipt"]
    params = {k: request[k] for k in ("owner_id", "local_id", "device_id", "server_instance_id")}
    original = client.get(old.PA + "/claims/status", params={**params, "execution_id": request["execution_id"]}, headers=s["headers"]).json()
    ref = {"schema_version": 1, "execution_id": request["execution_id"], "terminal_run_version": original["terminal_receipt"]["terminal_run_version"],
        "terminal_receipt_digest": h(original["terminal_receipt"]), "original_bundle_digest": bm["bundle_digest"]}
    stale = replan_request(client, s, {"local_id": local, "execution_ref": ref})
    _, _, _, cp = ready_cp(client, s, local)
    assert client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"]).status_code == 200
    if damage:
        import json
        from app.services.note_mixed_metadata import canonical
        broken = dict(receipt)
        broken[damage] = 999999 if damage == "job_id" else "0" * 64 if damage.endswith("digest") else str(uuid4())
        with s["engine"].begin() as connection:
            connection.execute(NoteCryptoTransition.__table__.update().where(NoteCryptoTransition.id == intent["write_id"]).values(receipt_json=canonical(broken)))
    count = s["db"].scalar(select(func.count()).select_from(NoteCryptoTransition)); s["db"].rollback()
    r = client.post(MA + "/replan", json=stale, headers=s["headers"])
    if damage:
        assert r.status_code == 409, r.text
        assert s["db"].scalar(select(func.count()).select_from(NoteCryptoTransition)) == count
        s["db"].rollback()
        with s["engine"].begin() as connection:
            connection.execute(NoteCryptoTransition.__table__.update().where(NoteCryptoTransition.id == intent["write_id"]).values(receipt_json=canonical(receipt)))
        return
    assert r.status_code == 200 and r.json()["status"] == "already_stored", r.text
    assert r.json()["stored_result"] == {"schema_version": 1, "operation_id": intent["write_id"], "status_path": old.PA + "/status", "receipt": receipt}
    assert s["db"].scalar(select(func.count()).select_from(NoteCryptoTransition)) == count


def settled(client, s, local, outcome="done"):
    from app.services.note_mixed_metadata import h
    b, c = started(client, s, local)
    bm, raws = bundle(c, outcome)
    r = client.post(MX + "/settle", json=settle_body(b, c, bm), headers=s["headers"])
    assert r.status_code == 200, r.text
    terminal = r.json()
    ref = {"schema_version": 3, "execution_id": c["execution_id"], "terminal_run_version": terminal["terminal_receipt"]["terminal_run_version"],
        "terminal_receipt_digest": h(terminal["terminal_receipt"]), "original_bundle_digest": bm["bundle_digest"]}
    a, ctx = mcontext(client, s, local)
    request = {**a, "mutation_id": str(uuid4()), "base": ctx["context"], "expected_catalog_digest": ctx["catalog_digest"],
        "execution_ref": ref, "bundle_metadata": bm}
    return request, bm, raws, terminal


@pytest.mark.parametrize("outcome", ["done", "failed"])
def test_initial_prepare_reserves_original_job_tokens_and_full_origin(client, subject, enabled, outcome):
    from app.models.note import AnalysisJob
    s, local = subject, "m2c2-initial"
    b, bm, raws, terminal = settled(client, s, local, outcome)
    r = client.post(MA + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json()
    assert q["operation_id"] == b["execution_ref"]["execution_id"] and q["purpose"] == "mixed_analysis_write"
    assert q["counts"]["DSET"]["total"] == 3 and q["counts"]["DSET"]["nulls"] == 1
    assert q["counts"]["existing"]["total"] == q["counts"]["verified_existing"]["total"] == 0
    assert q["latest_context"] == b["base"]
    assert q["metadata_header"]["control"]["execution_ref"] == b["execution_ref"]
    assert s["db"].get(AnalysisJob, bm["original_job_id"]) is None
    assert client.post(MA + "/prepare", json=b, headers=s["headers"]).json() == q


def staged(client, s, b, q, prefix, raws):
    import base64, json
    from .test_note_crypto_conversion import canonical, digest, decrypt, SIZE
    a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    common = {**a, "operation_id": q["operation_id"], "metadata_manifest_digest": q["metadata_manifest_digest"]}
    m = dict(q["metadata_header"])
    for name in ("S", "DSET", "P", "O", "existing", "verified_existing"):
        values, cursor = [], None
        while True:
            r = client.get(prefix + "/manifest", params={**common, "section": name, "limit": 1,
                **({"cursor": cursor} if cursor else {})}, headers=s["headers"])
            assert r.status_code == 200, r.text
            assert r.headers["cache-control"] == "no-store"
            values.extend(r.json()["entries"]); cursor = r.json()["next_cursor"]
            if cursor is None:
                break
        m[name] = values
    assert digest(canonical(m).encode()) == q["metadata_manifest_digest"]
    records = []
    for d in m["DSET"]:
        if d["is_null"]:
            assert d["expected_binding"] is None
            continue
        key = d["destination_key"]; raw = raws[canonical(key)]
        outer = json.loads(raw)
        inner = json.loads(decrypt(outer["ciphertext"], d["output_epoch"]))
        assert inner["binding"] == outer["binding"] == d["expected_binding"]
        assert digest(inner["value"].encode()) == inner["semantic_sha256"]
        chunks = [raw[i:i+SIZE] for i in range(0, len(raw), SIZE)]
        control = {**common, "entry_key": key, "source_etag": d["source_etag"], "target_epoch": d["output_epoch"],
            "total_chunks": len(chunks), "total_bytes": len(raw)}
        for i in reversed(range(len(chunks))):
            r = client.put(prefix + "/chunks", json={**control, "chunk_index": i, "chunk_sha256": digest(chunks[i]),
                "data_base64": base64.b64encode(chunks[i]).decode()}, headers=s["headers"])
            assert r.status_code == 200, r.text
        r = client.post(prefix + "/entries/seal", json={**control, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
        assert r.status_code == 200, r.text
        received = b""
        for i in range(len(chunks)):
            r = client.get(prefix + "/staged", params={**common, "kind": key["kind"], "representation_id": key["id"],
                "slot": key["slot"], "source_etag": d["source_etag"], "target_epoch": d["output_epoch"], "chunk_index": i}, headers=s["headers"])
            assert r.status_code == 200, r.text
            received += base64.b64decode(r.json()["data_base64"])
        assert received == raw
        records.append({"entry_key": key, "destination_key": key, "source_etag": d["source_etag"], "output_kind": d["output_kind"],
            "target_epoch": d["output_epoch"], "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    return m, {**common, "mutation_id": b["mutation_id"], "lease_version": q["lease_version"], "base": b["base"],
        "target_epoch": m["target_epoch"], "client_decryption_verified": True,
        "client_verified_ciphertext_manifest_digest": digest(canonical(records).encode())}


@pytest.mark.parametrize("outcome", ["done", "failed"])
def test_initial_exact_original_cipher_commit_preserves_note_and_old_terminal(client, subject, enabled, outcome):
    from sqlalchemy import select
    from app.models.note import Note, AnalysisJob
    from app.models.note_related import LinkedText
    from app.models.note_mixed import MixedSlot
    from app.services.note_mixed_metadata import canonical
    s, local = subject, "m2c2-commit"
    b, bm, raws, terminal = settled(client, s, local, outcome)
    before = [tuple(r) for r in s["db"].execute(select(Note.__table__).where(Note.owner_id == s["owner"], Note.local_id == local))]
    s["db"].rollback()
    r = client.post(MA + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json(); m, commit = staged(client, s, b, q, MA, raws)
    r = client.post(MA + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    result = r.json()
    expected = {**b["base"], "base": {**b["base"]["base"], "history_generation": b["base"]["base"]["history_generation"] + 1}}
    assert result["receipt"]["result"] == result["latest_context"] == expected
    assert client.post(MA + "/commit", json=commit, headers=s["headers"]).json() == result
    s["db"].expire_all()
    assert [tuple(r) for r in s["db"].execute(select(Note.__table__).where(Note.owner_id == s["owner"], Note.local_id == local))] == before
    job = s["db"].get(AnalysisJob, bm["original_job_id"])
    assert job.status == outcome
    for d in m["DSET"]:
        key = d["destination_key"]
        side = s["db"].get(MixedSlot, (s["owner"], local, canonical(key)))
        linked = s["db"].get(LinkedText, (s["owner"], local, canonical(key)))
        assert side.origin_validator == "linked_mixed_v1" and side.semantic_origin_id == q["operation_id"]
        assert linked.slot_version == 1 and linked.is_null == d["is_null"]
        assert getattr(job, key["slot"]) is None if d["is_null"] else getattr(job, key["slot"]).encode() == raws[canonical(key)]
    s["db"].rollback()
    a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    original = client.get(MX + "/status", params={**a, "execution_id": q["operation_id"]}, headers=s["headers"])
    assert original.status_code == 200 and original.json()["terminal_receipt"] == terminal["terminal_receipt"], original.text
    status = client.get(MA + "/status", params={**a, "operation_id": q["operation_id"]}, headers=s["headers"])
    assert status.status_code == 200 and status.json()["status"] == "operation", status.text
    assert status.json()["operation"]["receipt"] == result["receipt"]
    rotated_and_restarted(client, s, local, q)
