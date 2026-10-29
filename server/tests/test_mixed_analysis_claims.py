"""Schema3 client execution metadata; synthetic client only, no Provider call."""
from uuid import uuid4
import pytest

from .test_note_crypto import subject
from .test_note_mixed import enabled, mcontext, rq, MR
from .test_note_crypto_conversion import seed, convert

MX = "/api/v2/notes/mixed-analysis-claims"


@pytest.mark.parametrize("damage", ["control_schema", "control_job", "binding_epoch", "dispatch_run", "terminal_schema", "terminal_reported", "terminal_run"])
def test_stored_exact_control_and_receipts_never_coerce_numeric_types(client, subject, enabled, damage):
    import json
    from app.models.protected_analysis import ProtectedAnalysisClaim
    from app.services.note_mixed_metadata import canonical, h
    s, local = subject, "m2c1-exact-types"
    if damage.startswith("control") or damage == "binding_epoch":
        b, c = claim_new(client, s, local)
    else:
        b, c = started(client, s, local); bm, _ = bundle(c)
        r = client.post(MX + "/settle", json=settle_body(b, c, bm), headers=s["headers"])
        assert r.status_code == 200, r.text
    s["db"].expire_all()
    row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
    original_c, original_p = row.conditions_json, row.progress_json
    if damage.startswith("control") or damage == "binding_epoch":
        fixed = json.loads(original_c)
        if damage == "control_schema":
            fixed["control"]["schema_version"] = 3.0
        elif damage == "control_job":
            fixed["control"]["job_id"] = float(row.job_id)
        else:
            fixed["control"]["output_slots"][0]["expected_binding"]["crypto_epoch"] = float(b["source_context"]["base"]["base"]["crypto_epoch"])
        fixed["claim_metadata_digest"] = h(fixed["control"])
        row.conditions_json = canonical(fixed)
    else:
        p = json.loads(original_p)
        if damage == "dispatch_run":
            p["dispatch_receipt"]["run_version"] = 2.0
        elif damage == "terminal_schema":
            p["terminal_receipt"]["schema_version"] = 3.0
        elif damage == "terminal_reported":
            p["terminal_receipt"]["client_reported"] = 1
        else:
            p["terminal_receipt"]["terminal_run_version"] = float(row.run_version)
        row.progress_json = canonical(p)
    s["db"].commit()
    try:
        r = client.get(MX + "/status", params=scope(b, c), headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_analysis_claim", r.text
    finally:
        s["db"].expire_all()
        row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
        row.conditions_json, row.progress_json = original_c, original_p; s["db"].commit()


@pytest.mark.parametrize("field", ["claim_instance", "claim_mutation", "settle_instance", "settle_execution", "settle_dispatch", "bundle_token"])
def test_schema3_rejects_noncanonical_uuid_without_legacy_normalization(client, subject, enabled, field):
    s, local = subject, "m2c1-canonical"
    if field.startswith("claim"):
        seed(client, s, local); convert(client, s, local)
        body = request(client, s, local)
        key = "server_instance_id" if field == "claim_instance" else "mutation_id"
        body[key] = body[key].replace("-", "")
        r = client.post(MX, json=body, headers=s["headers"])
    else:
        b, c = started(client, s, local); bm, _ = bundle(c)
        body = settle_body(b, c, bm)
        if field == "bundle_token":
            bm["ciphertext_manifest"][0]["source_etag"] = bm["ciphertext_manifest"][0]["source_etag"].replace("-", "")
        else:
            key = {"settle_instance": "server_instance_id", "settle_execution": "execution_id", "settle_dispatch": "dispatch_id"}[field]
            body[key] = body[key].replace("-", "")
        r = client.post(MX + "/settle", json=body, headers=s["headers"])
    assert r.status_code == 422, r.text


def request(client, s, local, kind="note_body"):
    a, c = mcontext(client, s, local)
    r = client.get(MR + "/catalog", params=rq(a, c), headers=s["headers"])
    assert r.status_code == 200, r.text
    d = next(d for d in r.json()["entries"] if d["key"]["kind"] == kind)
    return {**a, "mutation_id": str(uuid4()), "source_context": {"server_instance_id": a["server_instance_id"],
        "base": c["context"], "catalog_digest": c["catalog_digest"]}, "source_keys": [{"descriptor": d}],
        "job_type": "memo_summary", "prompt_version": "single_source_v1", "source_job_id": None,
        "execution_route": "client_provider", "client_execution_confirmed": True}


def test_claim_has_fixed_schema3_control_and_no_live_job(client, subject, enabled):
    from app.models.note import AnalysisJob
    from app.services.note_mixed_metadata import h
    s, local = subject, "m2c1-claim"
    seed(client, s, local); convert(client, s, local)
    b = request(client, s, local)
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["schema_version"] == 3 and c["state"] == "client_pending"
    assert c["source_digest"] == h({k: b[k] for k in ("source_context", "source_keys", "job_type", "prompt_version", "source_job_id")})
    control = {"schema_version": 3, **{k: b[k] for k in ("source_context", "source_keys", "job_type", "prompt_version", "source_job_id", "execution_route", "client_execution_confirmed")},
        **{k: c[k] for k in ("job_id", "job_id_mode", "output_slots")}}
    assert c["claim_metadata_digest"] == h(control)
    assert len(c["output_slots"]) == 3
    assert s["db"].get(AnalysisJob, c["job_id"]) is None
    assert client.post(MX, json=b, headers=s["headers"]).json() == c


def test_claim_product_gate_is_closed(client, subject):
    s, local = subject, "m2c1-gate"
    seed(client, s, local); convert(client, s, local)
    b = request(client, s, local)
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "mixed_mode_not_enabled", r.text


def claim_new(client, s, local):
    seed(client, s, local); convert(client, s, local)
    b = request(client, s, local)
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    return b, r.json()


def scope(b, c):
    return {**{k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}, "execution_id": c["execution_id"]}


def dispatch_body(b, c):
    return {**scope(b, c), **{k: c[k] for k in ("run_version", "lease_version", "source_digest", "claim_metadata_digest")}}


def started(client, s, local):
    b, c = claim_new(client, s, local)
    r = client.post(MX + "/dispatch", json=dispatch_body(b, c), headers=s["headers"])
    assert r.status_code == 200, r.text
    return b, r.json()


def bundle(c, outcome="done"):
    from .test_note_crypto_conversion import canonical, digest, encrypt, decrypt
    epoch = c["source_context"]["base"]["base"]["crypto_epoch"]
    nulls, records, durable = [], [], {}
    for s in c["output_slots"]:
        key, binding = s["key"], s["expected_binding"]
        value = {"input_text": "original input\r\n", "result_json": "{}" if outcome == "done" else None,
            "error_message": None if outcome == "done" else ""}[key["slot"]]
        nulls.append({"key": key, "is_null": value is None})
        if value is None:
            continue
        inner = {"schema_version": 1, "binding": binding, "value": value, "semantic_sha256": digest(value.encode())}
        raw = canonical({"schema_version": 1, "kind": "linked_text_envelope_v1", "crypto_epoch": epoch,
            "binding": binding, "ciphertext": encrypt(canonical(inner), epoch)}).encode()
        durable[canonical(key)] = raw
        assert decrypt(__import__("json").loads(raw)["ciphertext"], epoch) == canonical(inner)
        records.append({"entry_key": key, "destination_key": key, "source_etag": s["source_etag"],
            "output_kind": "linked_text_envelope_v1", "target_epoch": epoch, "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    bm = {"schema_version": 3, "source_digest": c["source_digest"], "original_job_id": c["job_id"], "original_epoch": epoch,
        "outcome": outcome, "error_code": None if outcome == "done" else "provider_error", "slot_nulls": nulls, "ciphertext_manifest": records}
    bm["bundle_digest"] = digest(canonical(bm).encode())
    return bm, durable


def settle_body(b, c, bm):
    return {**scope(b, c), **{k: c[k] for k in ("run_version", "lease_version", "claim_metadata_digest")},
        "dispatch_id": c["dispatch_receipt"]["dispatch_id"], "provider_terminal_observed": True,
        "outcome": bm["outcome"], "bundle_metadata": bm, "local_checkpoint_confirmed": True, "unavailable_reason": None}


@pytest.mark.parametrize("outcome", ["done", "failed"])
def test_exact_cipher_bundle_is_immutable_metadata_only(client, subject, enabled, outcome):
    import copy
    from app.models.note import AnalysisJob
    from app.models.protected_analysis import ProtectedAnalysisClaim
    s, local = subject, "m2c1-bundle"
    b, c = started(client, s, local)
    bm, durable = bundle(c, outcome)
    body = settle_body(b, c, bm)
    r = client.post(MX + "/settle", json=body, headers=s["headers"])
    assert r.status_code == 200, r.text
    tr = r.json()["terminal_receipt"]
    assert tr["schema_version"] == 3 and tr["outcome"] == outcome and tr["bundle_digest"] == bm["bundle_digest"]
    assert r.json()["bundle_metadata"] == bm and len(durable) == 2
    assert client.post(MX + "/settle", json=body, headers=s["headers"]).json() == r.json()
    different = copy.deepcopy(body); different["local_checkpoint_confirmed"] = False
    assert client.post(MX + "/settle", json=different, headers=s["headers"]).json()["detail"]["code"] == "terminal_mismatch"
    s["db"].expire_all()
    row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
    assert "original input" not in row.conditions_json + row.progress_json
    assert s["db"].get(AnalysisJob, c["job_id"]) is None


@pytest.mark.parametrize("damage", ["token", "epoch", "job", "missing_record", "wrong_null", "metadata_digest", "checkpoint", "observed"])
def test_incomplete_or_other_bundle_never_settles(client, subject, enabled, damage):
    from app.services.note_mixed_metadata import h
    s, local = subject, "m2c1-bad-bundle"
    b, c = started(client, s, local); bm, _ = bundle(c)
    body = settle_body(b, c, bm)
    if damage == "token":
        bm["ciphertext_manifest"][0]["source_etag"] = str(uuid4())
    elif damage == "epoch":
        bm["ciphertext_manifest"][0]["target_epoch"] += 1
    elif damage == "job":
        bm["original_job_id"] += 1
    elif damage == "missing_record":
        bm["ciphertext_manifest"].pop()
    elif damage == "wrong_null":
        bm["slot_nulls"][0]["is_null"] = not bm["slot_nulls"][0]["is_null"]
    elif damage == "metadata_digest":
        body["claim_metadata_digest"] = "0" * 64
    elif damage == "checkpoint":
        body["local_checkpoint_confirmed"] = False
    else:
        body["provider_terminal_observed"] = False
    bm["bundle_digest"] = h({k: v for k, v in bm.items() if k != "bundle_digest"})
    r = client.post(MX + "/settle", json=body, headers=s["headers"])
    assert r.status_code in (409, 422), r.text
    r = client.get(MX + "/status", params=scope(b, c), headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "client_running" and r.json()["terminal_receipt"] is None, r.text


def test_status_reader_device_does_not_reactivate_disabled_creator(client, subject, enabled):
    from sqlalchemy import select
    from app.models.note import UserDevice
    from app.services.user_accounts import issue_user_device_access_token
    s, local = subject, "m2c1-reader"
    b, c = claim_new(client, s, local)
    issue_user_device_access_token(s["db"], owner_id=s["owner"], device_id="reader", display_name="synthetic")
    actor = s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "actor"))
    actor.is_active = 0; s["db"].commit()
    r = client.get(MX + "/status", params={**scope(b, c), "device_id": "reader"}, headers=s["web"])
    assert r.status_code == 200, r.text
    r = client.post(MX + "/cancel", json={**scope(b, c), "device_id": "reader", "run_version": c["run_version"], "lease_version": c["lease_version"]}, headers=s["web"])
    assert r.status_code == 403, r.text


@pytest.mark.parametrize("damage", ["pending_run", "progress_json"])
def test_broken_execution_metadata_fails_closed(client, subject, enabled, damage):
    from app.models.protected_analysis import ProtectedAnalysisClaim
    s, local = subject, "m2c1-fixed-progress"
    b, c = claim_new(client, s, local)
    row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
    if damage == "pending_run":
        row.run_version += 1
    else:
        row.progress_json = "{broken"
    s["db"].commit()
    r = client.get(MX + "/status", params=scope(b, c), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_analysis_claim", r.text


def test_expired_pending_idempotence_is_not_new_execution(client, subject, enabled):
    from datetime import datetime, timedelta
    from app.models.protected_analysis import ProtectedAnalysisClaim
    s, local = subject, "m2c1-expired"
    b, c = claim_new(client, s, local)
    row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
    row.expires_at = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code == 200 and r.json()["execution_id"] == c["execution_id"] and r.json()["state"] == "expired", r.text
    assert r.json()["terminal_receipt"] is None
    r = client.post(MX + "/cancel", json={**scope(b, c), "run_version": c["run_version"], "lease_version": c["lease_version"]}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "cancelled" and r.json()["terminal_receipt"]["dispatch_id"] is None, r.text


@pytest.mark.parametrize("selection", ["plain_empty", "historical_cipher", "null_before"])
def test_source_actual_plain_cipher_null_and_empty_framing(client, subject, enabled, selection):
    import base64
    from .test_note_mixed import ready_cp
    s, local = subject, "m2c1-actual-source"
    seed(client, s, local, content="", second_content=""); convert(client, s, local)
    _, _, _, cp = ready_cp(client, s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"])
    assert r.status_code == 200, r.text
    a, ctx = mcontext(client, s, local)
    ds = client.get(MR + "/catalog", params=rq(a, ctx), headers=s["headers"]).json()["entries"]
    if selection == "plain_empty":
        d = next(d for d in ds if d["key"]["kind"] == "note_body")
        assert d["representation_epoch"] == 0
    elif selection == "historical_cipher":
        d = next(d for d in ds if d["key"]["kind"] == "revision_snapshot" and d["representation_epoch"] > 0)
    else:
        d = next(d for d in ds if d["is_null"])
    b = request(client, s, local); b["source_keys"] = [{"descriptor": d}]
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    c = r.json()
    assert all(o["expected_binding"]["crypto_epoch"] == ctx["context"]["base"]["crypto_epoch"] for o in c["output_slots"])
    q = {**scope(b, c), "source_digest": c["source_digest"], "kind": d["key"]["kind"], "representation_id": d["key"]["id"],
        "slot": d["key"]["slot"], "source_etag": d["representation_etag"], "chunk_index": 0}
    r = client.get(MX + "/source", params=q, headers=s["headers"])
    assert r.status_code == 200 and r.json()["descriptor"] == d, r.text
    if d["is_null"]:
        assert r.json()["data_base64"] is None and r.json()["total_chunks"] == 0
    elif selection == "plain_empty":
        assert base64.b64decode(r.json()["data_base64"]) == b"" and r.json()["total_chunks"] == 1
    else:
        assert base64.b64decode(r.json()["data_base64"]) and r.json()["total_chunks"] > 0


def test_cancel_after_dispatch_stays_pending_until_original_terminal(client, subject, enabled):
    s, local = subject, "m2c1-cancel-running"
    b, c = started(client, s, local)
    action = {**scope(b, c), "run_version": c["run_version"], "lease_version": c["lease_version"]}
    r = client.post(MX + "/renew", json=action, headers=s["headers"])
    assert r.status_code == 200 and r.json()["lease_version"] == c["lease_version"] + 1, r.text
    c = r.json(); action.update(lease_version=c["lease_version"])
    r = client.post(MX + "/cancel", json=action, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "cancel_requested" and r.json()["terminal_receipt"] is None, r.text
    assert client.post(MX + "/cancel", json=action, headers=s["headers"]).json() == r.json()
    cancelled = r.json()
    bm, _ = bundle(c)
    old = settle_body(b, c, bm)
    assert client.post(MX + "/settle", json=old, headers=s["headers"]).status_code == 409
    exact = settle_body(b, cancelled, bm)
    r = client.post(MX + "/settle", json=exact, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "client_settled", r.text
    assert r.json()["dispatch_receipt"] == c["dispatch_receipt"]


@pytest.mark.parametrize("damage", ["etag", "selected", "mode", "catalog", "descriptor", "binding", "instance", "foreign", "inactive", "confirmation", "unknown", "job_type", "duplicate"])
def test_claim_source_and_auth_are_exact(client, subject, enabled, damage):
    from sqlalchemy import select
    from app.models.note import UserDevice
    s, local = subject, "m2c1-claim-boundary"
    seed(client, s, local); convert(client, s, local)
    b = request(client, s, local)
    d = b["source_keys"][0]["descriptor"]
    if damage == "etag":
        d["representation_etag"] = str(uuid4())
    elif damage == "selected":
        b["source_context"]["base"]["selected_physical_note_id"] += 1
    elif damage == "mode":
        b["source_context"]["base"]["current_mode"] = "plain"
    elif damage == "catalog":
        b["source_context"]["catalog_digest"] = "0" * 64
    elif damage == "descriptor":
        d["representation_epoch"] = 0
    elif damage == "binding":
        d["expected_binding"] = {"foreign": "NO_RAW_REQUEST_ECHO"}
    elif damage == "instance":
        b["server_instance_id"] = str(uuid4())
    elif damage == "foreign":
        b["owner_id"] = s["other"]
    elif damage == "inactive":
        actor = s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "actor"))
        actor.is_active = 0; s["db"].commit()
    elif damage == "confirmation":
        b["client_execution_confirmed"] = False
    elif damage == "unknown":
        b["raw_provider_secret"] = "NO_RAW_REQUEST_ECHO"
    elif damage == "job_type":
        b["job_type"] = "not_registered"
    else:
        b["source_keys"] *= 2
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code in (401, 403, 409, 422), r.text
    assert "NO_RAW_REQUEST_ECHO" not in r.text and r.headers["cache-control"] == "no-store"


def test_opaque_etag_change_stales_dispatch_source_not_original_terminal(client, subject, enabled):
    from app.models.note_mixed import MixedSlot
    from app.services.note_mixed_metadata import canonical
    s, local = subject, "m2c1-stale-etag"
    b, c = claim_new(client, s, local)
    d = b["source_keys"][0]["descriptor"]
    row = s["db"].get(MixedSlot, (s["owner"], local, canonical(d["key"])))
    old = row.representation_etag
    row.representation_etag = str(uuid4()); s["db"].commit()
    r = client.get(MX + "/status", params=scope(b, c), headers=s["headers"])
    assert r.status_code == 200 and not r.json()["source_matches_current"], r.text
    assert client.post(MX + "/dispatch", json=dispatch_body(b, c), headers=s["headers"]).status_code == 409
    s["db"].expire_all(); row = s["db"].get(MixedSlot, (s["owner"], local, canonical(d["key"])))
    row.representation_etag = old; s["db"].commit()
    r = client.post(MX + "/dispatch", json=dispatch_body(b, c), headers=s["headers"])
    assert r.status_code == 200, r.text
    c = r.json(); bm, _ = bundle(c)
    s["db"].expire_all(); row = s["db"].get(MixedSlot, (s["owner"], local, canonical(d["key"])))
    row.representation_etag = str(uuid4()); s["db"].commit()
    r = client.post(MX + "/settle", json=settle_body(b, c, bm), headers=s["headers"])
    assert r.status_code == 200 and not r.json()["source_matches_current"] and r.json()["bundle_metadata"] == bm, r.text


def test_old_prefix_and_new_prefix_never_reinterpret_claim_schema(client, subject, enabled):
    from .test_protected_analysis import PA, claim_body
    s, local = subject, "m2c1-prefix"
    seed(client, s, local); convert(client, s, local)
    old = claim_body(client, s, local)
    r = client.post(PA + "/claims", json=old, headers=s["headers"])
    assert r.status_code == 201, r.text
    old_response = r.json()
    b = request(client, s, local)
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    c = r.json()
    r = client.get(MX + "/status", params={**scope(b, c), "execution_id": old_response["execution_id"]}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "execution_schema_mismatch", r.text
    q = {k: old[k] for k in ("owner_id", "local_id", "device_id", "server_instance_id")}
    assert client.get(PA + "/claims/status", params={**q, "execution_id": c["execution_id"]}, headers=s["headers"]).status_code == 409
    r = client.get(PA + "/claims/status", params={**q, "execution_id": old_response["execution_id"]}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["schema_version"] == 1 and r.json()["source_context"] == old_response["source_context"], r.text


@pytest.mark.parametrize("operation", ["claim", "dispatch", "renew", "cancel", "settle"])
def test_every_execution_sql_publication_rolls_back_and_retries(client, subject, enabled, operation):
    from sqlalchemy import event, select
    from app.models.protected_analysis import ProtectedAnalysisClaim
    from .test_note_mixed import live_rows
    s, local = subject, "m2c1-sql"
    if operation == "claim":
        seed(client, s, local); convert(client, s, local)
        b = request(client, s, local); c = None; url = MX; body = b
    else:
        b, c = claim_new(client, s, local)
        if operation == "settle":
            r = client.post(MX + "/dispatch", json=dispatch_body(b, c), headers=s["headers"])
            assert r.status_code == 200, r.text
            c = r.json(); bm, _ = bundle(c); body = settle_body(b, c, bm)
        elif operation == "dispatch":
            body = dispatch_body(b, c)
        else:
            body = {**scope(b, c), "run_version": c["run_version"], "lease_version": c["lease_version"]}
        url = MX + "/" + operation
    s["db"].rollback()
    before_live = live_rows(s, local)
    before = None
    if c:
        row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
        before = (row.state, row.run_version, row.lease_version, row.conditions_json, row.progress_json)
    s["db"].rollback()
    fired = []
    def fail(conn, cursor, statement, parameters, context, many):
        text = statement.lower()
        if not fired and ("insert into note_protected_analysis_claims" in text or "update note_protected_analysis_claims" in text):
            fired.append(True)
            raise RuntimeError("synthetic metadata publication failure")
    event.listen(s["engine"], "after_cursor_execute", fail)
    try:
        r = client.post(url, json=body, headers=s["headers"])
        assert r.status_code == 500 and r.json()["detail"]["code"] == "internal_error", r.text
        assert fired
    finally:
        event.remove(s["engine"], "after_cursor_execute", fail)
    s["db"].expire_all()
    assert live_rows(s, local) == before_live
    if c:
        row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
        assert (row.state, row.run_version, row.lease_version, row.conditions_json, row.progress_json) == before
    else:
        assert s["db"].scalar(select(ProtectedAnalysisClaim.id).where(ProtectedAnalysisClaim.owner_id == s["owner"], ProtectedAnalysisClaim.mutation_id == b["mutation_id"])) is None
    s["db"].rollback()
    assert client.post(url, json=body, headers=s["headers"]).status_code in (200, 201)


def test_original_settle_is_allowed_while_other_write_holds_fence(client, subject, enabled):
    from .test_note_mixed_writes import write_request, MW
    s, local = subject, "m2c1-fenced-terminal"
    b, c = started(client, s, local); bm, _ = bundle(c)
    q = client.post(MW + "/quote", json=write_request(client, s, local), headers=s["headers"])
    assert q.status_code == 201, q.text
    r = client.post(MX + "/settle", json=settle_body(b, c, bm), headers=s["headers"])
    assert r.status_code == 200 and r.json()["terminal_receipt"]["external_settled"], r.text
    a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    q = q.json()
    assert client.post(MW + "/abort", json={**a, "operation_id": q["operation_id"], "lease_version": q["lease_version"]}, headers=s["headers"]).status_code == 200


def test_mixed_and_legacy_execution_cohort_preserves_old_receipts(client, subject, enabled):
    from .test_protected_analysis import PA, claim_body
    s, local = subject, "m2c1-both-cohort"
    seed(client, s, local); convert(client, s, local)
    old = claim_body(client, s, local)
    r = client.post(PA + "/claims", json=old, headers=s["headers"])
    assert r.status_code == 201, r.text
    oc = r.json()
    b = request(client, s, local)
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    c = r.json()
    a, current = mcontext(client, s, local)
    r = client.post("/api/v2/notes/related-drains", json={**a, "schema_version": 2, "mutation_id": str(uuid4()),
        "crypto_epoch": current["context"]["base"]["crypto_epoch"], "expected_history_generation": current["context"]["base"]["history_generation"]}, headers=s["headers"])
    assert r.status_code == 201 and r.json()["pending_count"] == 2, r.text
    dr = r.json()
    r = client.post(MX + "/cancel", json={**scope(b, c), "run_version": c["run_version"], "lease_version": c["lease_version"]}, headers=s["headers"])
    assert r.status_code == 200, r.text
    q = {**{k: old[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")},
        **{k: oc[k] for k in ("execution_id", "run_version", "lease_version")}}
    r = client.post(PA + "/claims/abort", json=q, headers=s["headers"])
    assert r.status_code == 200 and "schema_version" not in r.json()["terminal_receipt"], r.text
    dq = {**{k: b[k] for k in ("owner_id", "local_id", "device_id", "server_instance_id")}, "drain_id": dr["drain_id"]}
    r = client.get("/api/v2/notes/related-drains/status", params=dq, headers=s["headers"])
    assert r.status_code == 200 and r.json()["pending_count"] == 0 and r.json()["state"] == "ready", r.text
    r = client.post("/api/v2/notes/related-drains/abort", json={**a, "schema_version": 1, "drain_id": dr["drain_id"],
        "drain_version": dr["drain_version"], "lease_version": dr["lease_version"]}, headers=s["headers"])
    assert r.status_code == 200, r.text
    from .test_note_mixed import ready_cp
    _, _, _, cp = ready_cp(client, s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"])
    assert r.status_code == 200, r.text
    r = client.get(MX + "/status", params=scope(b, c), headers=s["headers"])
    assert r.status_code == 200 and not r.json()["source_matches_current"] and r.json()["latest_context"]["current_mode"] == "plain", r.text
    assert r.json()["source_context"] == c["source_context"] and r.json()["terminal_receipt"]["outcome"] == "cancelled"


@pytest.mark.parametrize("operation", ["claim", "dispatch"])
def test_actual_concurrent_claim_and_dispatch_are_single_execution(client, subject, enabled, operation):
    from concurrent.futures import ThreadPoolExecutor
    s, local = subject, "m2c1-concurrency"
    seed(client, s, local); convert(client, s, local)
    b = request(client, s, local)
    if operation == "claim":
        url, body = MX, b
    else:
        r = client.post(MX, json=b, headers=s["headers"])
        assert r.status_code == 201, r.text
        url, body = MX + "/dispatch", dispatch_body(b, r.json())
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post(url, json=body, headers=s["headers"]), range(2)))
    assert sorted(r.status_code for r in responses) == ([200, 201] if operation == "claim" else [200, 409]), [r.text for r in responses]
    if operation == "claim":
        assert responses[0].json() == responses[1].json()
    else:
        success = next(r.json() for r in responses if r.status_code == 200)
        assert success["run_version"] == 2 and success["dispatch_receipt"]["run_version"] == 2


def test_source_chunk_continuation_rechecks_catalog_without_plain_fingerprint(client, subject, enabled):
    from app.models.note_mixed import MixedSlot
    from app.services.note_mixed_metadata import canonical
    s, local = subject, "m2c1-source-pages"
    seed(client, s, local, content="x" * 270000, second_content="x" * 270001); convert(client, s, local)
    b = request(client, s, local)
    c = client.post(MX, json=b, headers=s["headers"]).json()
    d = b["source_keys"][0]["descriptor"]
    q = {**scope(b, c), "source_digest": c["source_digest"], "kind": d["key"]["kind"], "representation_id": d["key"]["id"],
        "slot": d["key"]["slot"], "source_etag": d["representation_etag"], "chunk_index": 0}
    r = client.get(MX + "/source", params=q, headers=s["headers"])
    assert r.status_code == 200 and r.json()["total_chunks"] > 1, r.text
    row = s["db"].get(MixedSlot, (s["owner"], local, canonical(d["key"])))
    row.representation_etag = str(uuid4()); s["db"].commit()
    r = client.get(MX + "/source", params={**q, "chunk_index": 1}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "source_changed" and "data_base64" not in r.json(), r.text


@pytest.mark.parametrize("running", [False, True])
def test_natural_same_epoch_write_stales_source_but_preserves_dispatched_terminal(client, subject, enabled, running):
    from .test_note_mixed_writes import ready_write, MW
    s, local = subject, "m2c1-natural-change"
    b, c = started(client, s, local) if running else claim_new(client, s, local)
    bm, _ = bundle(c)
    _, _, _, write = ready_write(client, s, local)
    r = client.post(MW + "/commit", json=write, headers=s["headers"])
    assert r.status_code == 200, r.text
    r = client.get(MX + "/status", params=scope(b, c), headers=s["headers"])
    assert r.status_code == 200 and not r.json()["source_matches_current"], r.text
    assert r.json()["source_context"] == c["source_context"]
    assert r.json()["latest_context"]["base"]["crypto_epoch"] == c["source_context"]["base"]["base"]["crypto_epoch"]
    if running:
        r = client.post(MX + "/settle", json=settle_body(b, c, bm), headers=s["headers"])
        assert r.status_code == 200 and r.json()["bundle_metadata"] == bm and not r.json()["source_matches_current"], r.text
    else:
        assert client.post(MX + "/dispatch", json=dispatch_body(b, c), headers=s["headers"]).status_code == 409


def test_actual_linked_source_version_damage_never_returns_source_bytes(client, subject, enabled):
    from .test_related_text import related, prepare, stage, ROOT
    from app.models.note_related import LinkedText
    from app.services.note_mixed_metadata import canonical
    s, local = subject, "m2c1-linked-source"
    ident, _ = related(client, s, local)
    rb, transition, _ = prepare(client, s, local)
    commit, _, _ = stage(client, s, local, rb, transition)
    r = client.post(ROOT + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    b = request(client, s, local, kind="analysis_result"); b["source_job_id"] = ident
    r = client.post(MX, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    c = r.json(); d = b["source_keys"][0]["descriptor"]
    assert d["linked_slot_version"] > 0 and d["representation_epoch"] > 0
    row = s["db"].get(LinkedText, (s["owner"], local, canonical(d["key"])))
    original = row.slot_version; row.slot_version += 1; s["db"].commit()
    try:
        r = client.get(MX + "/source", params={**scope(b, c), "source_digest": c["source_digest"],
            "kind": d["key"]["kind"], "representation_id": d["key"]["id"], "slot": d["key"]["slot"],
            "source_etag": d["representation_etag"], "chunk_index": 0}, headers=s["headers"])
        assert r.status_code == 409 and "data_base64" not in r.json(), r.text
    finally:
        s["db"].expire_all()
        row = s["db"].get(LinkedText, (s["owner"], local, canonical(d["key"])))
        row.slot_version = original; s["db"].commit()


@pytest.mark.parametrize("damage", ["no_bundle", "wrong_outcome", "missing_dispatch"])
@pytest.mark.parametrize("endpoint", ["status", "source", "drain"])
def test_stored_terminal_and_dispatch_damage_rejected_every_consumer(client, subject, enabled, damage, endpoint):
    import json
    from app.models.protected_analysis import ProtectedAnalysisClaim
    from app.services.note_mixed_metadata import canonical
    s, local = subject, "m2c1-review"
    b, c = started(client, s, local); bm, _ = bundle(c)
    r = client.post(MX + "/settle", json=settle_body(b, c, bm), headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all()
    row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
    original = row.progress_json
    p = json.loads(original)
    if damage == "no_bundle":
        p["terminal_bundle"] = p["terminal_core"]["bundle_metadata"] = None
        p["terminal_core"].update(local_checkpoint_confirmed=False, unavailable_reason="response_lost")
        p["terminal_receipt"]["bundle_digest"] = None
    elif damage == "wrong_outcome":
        failed, _ = bundle(c, "failed")
        p["terminal_bundle"] = p["terminal_core"]["bundle_metadata"] = failed
        p["terminal_receipt"]["bundle_digest"] = failed["bundle_digest"]
    else:
        p["dispatch_receipt"] = None
    row.progress_json = canonical(p); s["db"].commit()
    try:
        if endpoint == "status":
            r = client.get(MX + "/status", params=scope(b, c), headers=s["headers"])
        elif endpoint == "source":
            d = b["source_keys"][0]["descriptor"]
            r = client.get(MX + "/source", params={**scope(b, c), "source_digest": c["source_digest"],
                "kind": d["key"]["kind"], "representation_id": d["key"]["id"], "slot": d["key"]["slot"],
                "source_etag": d["representation_etag"], "chunk_index": 0}, headers=s["headers"])
        else:
            a, current = mcontext(client, s, local)
            r = client.post("/api/v2/notes/related-drains", json={**a, "schema_version": 2, "mutation_id": str(uuid4()),
                "crypto_epoch": current["context"]["base"]["crypto_epoch"], "expected_history_generation": current["context"]["base"]["history_generation"]}, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_analysis_claim", r.text
    finally:
        s["db"].expire_all()
        row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
        row.progress_json = original; s["db"].commit()


def test_source_is_scoped_and_dispatch_is_once(client, subject, enabled):
    s, local = subject, "m2c1-dispatch"
    b, c = claim_new(client, s, local)
    d = b["source_keys"][0]["descriptor"]
    query = {**scope(b, c), "source_digest": c["source_digest"], "kind": d["key"]["kind"],
        "representation_id": d["key"]["id"], "slot": d["key"]["slot"], "source_etag": d["representation_etag"], "chunk_index": 0}
    r = client.get(MX + "/source", params=query, headers=s["headers"])
    assert r.status_code == 200 and r.json()["descriptor"] == d, r.text
    assert r.headers["cache-control"] == "no-store"
    q = {**query, "kind": "revision_before", "representation_id": str(uuid4()), "slot": "before"}
    assert client.get(MX + "/source", params=q, headers=s["headers"]).status_code == 404
    body = dispatch_body(b, c)
    r = client.post(MX + "/dispatch", json=body, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "client_running", r.text
    assert r.json()["dispatch_receipt"]["schema_version"] == 3
    assert client.post(MX + "/dispatch", json=body, headers=s["headers"]).status_code == 409


@pytest.mark.parametrize("reason", ["key_unavailable", "cipher_store_failed", "response_lost"])
def test_late_terminal_is_metadata_and_unblocks_fixed_drain(client, subject, enabled, reason):
    from datetime import datetime, timedelta
    from app.models.protected_analysis import ProtectedAnalysisClaim
    s, local = subject, "m2c1-late"
    b, c = claim_new(client, s, local)
    r = client.post(MX + "/dispatch", json=dispatch_body(b, c), headers=s["headers"])
    assert r.status_code == 200, r.text
    c = r.json()
    a, current = mcontext(client, s, local)
    drain = {**a, "schema_version": 2, "mutation_id": str(uuid4()), "crypto_epoch": current["context"]["base"]["crypto_epoch"],
        "expected_history_generation": current["context"]["base"]["history_generation"]}
    r = client.post("/api/v2/notes/related-drains", json=drain, headers=s["headers"])
    assert r.status_code == 201 and r.json()["pending_count"] == 1, r.text
    dr = r.json()
    row = s["db"].get(ProtectedAnalysisClaim, c["execution_id"])
    row.expires_at = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    body = {**scope(b, c), **{k: c[k] for k in ("run_version", "lease_version", "claim_metadata_digest")},
        "dispatch_id": c["dispatch_receipt"]["dispatch_id"], "provider_terminal_observed": True,
        "outcome": "result_unavailable", "bundle_metadata": None, "local_checkpoint_confirmed": False, "unavailable_reason": reason}
    r = client.post(MX + "/settle", json=body, headers=s["headers"])
    assert r.status_code == 200 and r.json()["terminal_receipt"]["outcome"] == "result_unavailable", r.text
    assert not r.json()["terminal_receipt"]["result_server_persisted"]
    assert client.post(MX + "/settle", json=body, headers=s["headers"]).json() == r.json()
    q = {**{k: drain[k] for k in ("owner_id", "local_id", "device_id", "server_instance_id")}, "drain_id": dr["drain_id"]}
    r = client.get("/api/v2/notes/related-drains/status", params=q, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "ready", r.text
