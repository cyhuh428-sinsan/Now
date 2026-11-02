"""Protected offline import: real auth, synthetic client crypto, atomic storage."""
import base64
import json
from datetime import datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import event, select

from .test_note_crypto import subject, query, context
from .test_note_crypto_conversion import canonical, digest, encrypt, decrypt, convert, seed, SIZE, read_all
from .test_note_crypto_review import snapshot

ROOT = "/api/v2/notes/protected-imports"
COMMIT = "/api/v2/notes/revisions/import"


def ref(ident):
    return {"kind": "offline_branch", "id": ident}


def entry(ident=None, parent=None, existing=None):
    return {"revision_id": ident or str(uuid4()), "parent_ref": parent,
            "origin_device_id": "original-device", "expected_existing_ciphertext_sha256": existing}


def request(client, s, local, entries):
    c = context(client, s, local)
    return {"schema_version": 1, **query(s, local), "mutation_id": str(uuid4()),
            "server_instance_id": c["server_instance_id"], "crypto_epoch": c["crypto_epoch"],
            "target_epoch": c["crypto_epoch"] or 1, "base_head_version": c["head_version"],
            "base_revision_id": c["head_revision_id"], "expected_history_generation": c["history_generation"],
            "expected_inventory_revision_ids": c["inventory_revision_ids"], "entries": entries}


def prepare(client, s, b):
    r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    assert r.headers["cache-control"] == "no-store"
    return r.json()


def common(s, local, q):
    return {"schema_version": 1, **query(s, local), "import_id": q["import_id"]}


def original(s, local, text):
    return {"schema_version": 1, "note": {"id": None, "owner_id": s["owner"], "local_id": local,
        "device_id": "original-device", "note_type": "daily", "title": "past", "content": text,
        "parent_local_id": None, "level": 1, "tags": None, "source": None, "deleted_at": None,
        "client_updated_at": "2099-01-01T00:00:00.000000Z", "created_at": "2001-02-03T04:05:06.000000Z",
        "updated_at": "2002-02-03T04:05:06.000000Z"}}


def source(client, s, b, q, d):
    raw = b""
    for index in range(d["total_chunks"]):
        r = client.get(ROOT + "/source", params={**query(s, b["local_id"]), "import_id": q["import_id"],
            "kind": d["key"]["kind"], "representation_id": d["key"]["id"], "slot": d["key"]["slot"],
            "representation_etag": d["representation_etag"], "chunk_index": index}, headers=s["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["operation_origin"] == d["operation_origin"]
        data = base64.b64decode(r.json()["data_base64"])
        assert digest(data) == r.json()["chunk_sha256"]
        raw += data
    assert digest(raw) == d["ciphertext_sha256"]
    inner = json.loads(decrypt(json.loads(raw)["ciphertext"], d["representation_epoch"]))
    assert inner["origin"] == d["operation_origin"]
    return raw, inner


def stage(client, s, b, q, text="past\r\nraw\n"):
    records, outputs = [], {}
    for n in q["new_entries"]:
        key, epoch = n["key"], q["target_epoch"]
        value = original(s, b["local_id"], text)
        inner = {"schema_version": 1, "binding": n["expected_binding"], "snapshot": value,
                 "origin": n["operation_origin"], "content_origin_kind": "semantic",
                 "semantic_sha256": digest(canonical(value).encode())}
        raw = canonical({"schema_version": 1, "kind": "history_envelope_v1", "crypto_epoch": epoch,
            "binding": n["expected_binding"], "ciphertext": encrypt(canonical(inner), epoch)}).encode()
        chunks = [raw[i:i + SIZE] for i in range(0, len(raw), SIZE)]
        base = {**common(s, b["local_id"], q), "entry_key": key, "source_etag": n["source_etag"],
                "target_epoch": epoch, "total_chunks": len(chunks), "total_bytes": len(raw)}
        for i, data in enumerate(chunks):
            cb = {**base, "chunk_index": i, "chunk_sha256": digest(data), "data_base64": base64.b64encode(data).decode()}
            r = client.put(ROOT + "/chunks", json=cb, headers=s["headers"])
            assert r.status_code == 200, r.text
            assert client.put(ROOT + "/chunks", json=cb, headers=s["headers"]).status_code == 200
        r = client.post(ROOT + "/entries/seal", json={**base, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
        assert r.status_code == 200, r.text
        downloaded = b""
        for i in range(len(chunks)):
            r = client.get(ROOT + "/staged", params={**query(s, b["local_id"]), "import_id": q["import_id"],
                "kind": key["kind"], "representation_id": key["id"], "slot": key["slot"],
                "source_etag": n["source_etag"], "chunk_index": i}, headers=s["headers"])
            assert r.status_code == 200, r.text
            assert r.json()["operation_origin"] == inner["origin"]
            downloaded += base64.b64decode(r.json()["data_base64"])
        assert downloaded == raw
        assert json.loads(decrypt(json.loads(downloaded)["ciphertext"], epoch))["snapshot"] == value
        records.append({"entry_key": key, "destination_key": key, "source_etag": n["source_etag"],
            "output_kind": n["output_kind"], "target_epoch": epoch, "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
        outputs[key["id"]] = raw
    verified = []
    for e in q["existing_entries"]:
        d = e["source"]
        source(client, s, b, q, d)
        verified.append({"key": e["key"], "revision_ref": e["revision_ref"], "parent_ref": e["parent_ref"],
            "origin_device_id": e["origin_device_id"], "crypto_epoch": q["target_epoch"],
            **{k: d[k] for k in ("representation_etag", "total_bytes", "total_chunks", "ciphertext_sha256", "expected_binding")},
            "origin_expectation": e["origin_expectation"]})
    for p in q["parent_sources"]:
        source(client, s, b, q, p["source"])
    order = lambda key: tuple(key[k].encode() for k in ("kind", "id", "slot"))
    records.sort(key=lambda r: order(r["entry_key"]))
    verified.sort(key=lambda r: order(r["key"]))
    cb = {"schema_version": 2, **query(s, b["local_id"]), "import_id": q["import_id"],
          "mutation_id": b["mutation_id"], "server_instance_id": b["server_instance_id"], "crypto_epoch": q["target_epoch"],
          "metadata_manifest_digest": q["manifest_digest"], "client_verified_ciphertext_manifest_digest": digest(canonical(records).encode()),
          "client_verified_existing_set_digest": digest(canonical(verified).encode())}
    return cb, outputs


def commit(client, s, cb):
    r = client.post(COMMIT, json=cb, headers=s["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def test_new_dag_full15_empty_scope_and_fixed_receipt(client, subject):
    s, local = subject, "import-new"
    a = entry(); z = entry(parent=ref(a["revision_id"]))
    b = request(client, s, local, [z, a]); q = prepare(client, s, b)
    assert q["base"]["crypto_epoch"] == 0 and q["target_epoch"] == 1
    assert client.post(ROOT, json=b, headers=s["headers"]).json()["import_id"] == q["import_id"]
    cb, outputs = stage(client, s, b, q)
    result = commit(client, s, cb)
    r = result["receipt"]
    assert r["result_head_version"] == 0 and r["result_revision_id"] is None
    assert r["result_inventory_revision_ids"] == [] and r["history_generation"] == 2
    assert r["identity_state"] == "branch_only" and r["current_exists"] is False
    assert result["receipt_matches_current"] is True
    assert commit(client, s, cb)["receipt"] == r
    from app.models.note import Note
    from app.models.note_v2 import NoteOfflineBranch
    assert s["db"].scalar(select(Note).where(Note.owner_id == s["owner"])) is None
    for e in (a, z):
        row = s["db"].get(NoteOfflineBranch, e["revision_id"])
        assert row.snapshot_json.encode() == outputs[row.id] and row.origin_device_id == "original-device"
        response = client.get("/api/v2/notes/revision", params={**query(s, local), "representation_schema": 2,
            "revision_kind": "offline_branch", "revision_id": row.id}, headers=s["headers"])
        assert response.status_code == 200, response.text
        assert response.json()["representation"]["operation_origin"]["import_id"] == q["import_id"]


def test_mixed_and_existing_only_zero_upload_preserve_origins(client, subject):
    s, local = subject, "import-mixed"
    a = entry(); b = request(client, s, local, [a]); q = prepare(client, s, b)
    cb, outputs = stage(client, s, b, q); commit(client, s, cb)
    old = entry(a["revision_id"], existing=digest(outputs[a["revision_id"]]))
    z = entry(parent=ref(a["revision_id"]))
    b2 = request(client, s, local, [old, z]); q2 = prepare(client, s, b2)
    assert len(q2["new_entries"]) == len(q2["existing_entries"]) == 1
    assert client.get("/api/v2/notes/representations", params={**query(s, local), "representation_schema": 2}, headers=s["headers"]).status_code == 423
    cb2, _ = stage(client, s, b2, q2); result = commit(client, s, cb2)
    assert result["receipt"]["history_generation"] == 2
    b3 = request(client, s, local, [old]); q3 = prepare(client, s, b3)
    assert q3["new_entries"] == [] and q3["state"] == "ready"
    cb3, _ = stage(client, s, b3, q3)
    assert cb3["client_verified_ciphertext_manifest_digest"] == digest(b"[]")
    r3 = commit(client, s, cb3)
    assert r3["receipt"]["history_generation"] == 2
    assert r3["receipt"]["imported_refs"][0]["status"] == "already_present"
    assert q3["existing_entries"][0]["source"]["operation_origin"]["import_id"] == q["import_id"]
    convert(client, s, local)
    assert commit(client, s, cb3)["receipt"] == r3["receipt"]
    assert commit(client, s, cb3)["receipt_matches_current"] is False
    _, items, _ = read_all(client, s, local)
    assert next(i for i in items if i["key"]["id"] == a["revision_id"])["operation_origin"]["import_id"] == q["import_id"]


@pytest.mark.parametrize("kind", ["cycle", "missing", "duplicate"])
def test_invalid_dag_rejected_without_partial_metadata(client, subject, kind):
    s, local = subject, "import-invalid"
    a = entry()
    if kind == "cycle":
        a["parent_ref"] = ref(a["revision_id"])
    if kind == "missing":
        a["parent_ref"] = ref(str(uuid4()))
    b = request(client, s, local, [a, a] if kind == "duplicate" else [a])
    before = snapshot(s, local)
    r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 409, r.text
    assert snapshot(s, local) == before


@pytest.mark.parametrize("bad", [True, 1.0])
def test_ready_corrupt_version_cannot_publish(client, subject, bad):
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "import-corrupt"
    b = request(client, s, local, [entry()]); q = prepare(client, s, b)
    cb, _ = stage(client, s, b, q)
    row = s["db"].get(NoteCryptoTransition, q["import_id"])
    c = json.loads(row.conditions_json); c["origin_metadata_version"] = bad
    row.conditions_json = canonical(c); s["db"].commit()
    before = snapshot(s, local)
    r = client.post(COMMIT, json=cb, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    assert snapshot(s, local) == before


def test_manifest_pagination_digest_and_current_unchanged_then_restore(client, subject):
    from .test_note_protected_writes import qbody, quote, stage as write_stage, commit as write_commit
    s, local = subject, "import-current"
    wb = qbody(client, s, local); wq = quote(client, s, wb)
    wc = write_stage(client, s, wb, wq)[0]; write_commit(client, s, wc)
    before = snapshot(s, local)
    b = request(client, s, local, [entry(parent={"kind": "note_revision", "id": wq["revision_ref"]["id"]}), entry()])
    q = prepare(client, s, b)
    manifest_value = {"schema_version": 1, "purpose": "protected_import", "import_id": q["import_id"],
        "mutation_id": b["mutation_id"], "server_instance_id": b["server_instance_id"], "owner_id": s["owner"],
        "local_id": local, "actor_device_id": "actor", **{k: q[k] for k in ("base", "target_epoch", "new_entries",
            "existing_entries", "parent_sources", "origin_metadata_version", "origin_expectations")}}
    assert digest(canonical(manifest_value).encode()) == q["manifest_digest"]
    items, cursor = [], None
    while True:
        args = {**query(s, local), "import_id": q["import_id"], "limit": 1}
        if cursor:
            args["cursor"] = cursor
        r = client.get(ROOT + "/manifest", params=args, headers=s["headers"])
        assert r.status_code == 200 and r.json()["manifest_digest"] == q["manifest_digest"]
        items.extend(r.json()["items"]); cursor = r.json()["next_cursor"]
        if not cursor:
            break
    assert len(items) == 3
    cb, outputs = stage(client, s, b, q, "x" * 270000 + "\r\nlarge")
    result = commit(client, s, cb)
    after = snapshot(s, local)
    for table in ("notes", "note_revisions", "note_inventory"):
        assert after[table] == before[table]
    assert result["receipt"]["result_head_version"] == wq["base"]["head_version"] + 1
    target = q["new_entries"][0]["key"]["id"]
    rb = qbody(client, s, local, "restore", target_ref=ref(target), target_ciphertext_sha256=digest(outputs[target]))
    rq = quote(client, s, rb)
    assert rq["restore_source"]["operation_origin"]["import_id"] == q["import_id"]
    rc = write_stage(client, s, rb, rq, "adopted")[0]; write_commit(client, s, rc)
    convert(client, s, local)
    _, catalog, _ = read_all(client, s, local)
    assert next(i for i in catalog if i["key"]["id"] == target)["operation_origin"]["import_id"] == q["import_id"]


@pytest.mark.parametrize("field,value", [("crypto_epoch", True), ("schema_version", 1.0), ("extra", 1), ("entries", [])])
def test_strict_prepare_and_plain_scope_rejection(client, subject, field, value):
    s, local = subject, "import-strict"
    b = request(client, s, local, [entry()]); b[field] = value
    r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 422, r.text
    seed(client, s, local)
    r = client.post(ROOT, json=request(client, s, local, [entry()]), headers=s["headers"])
    assert r.status_code == 409, r.text


@pytest.mark.parametrize("field", ["client_verified_ciphertext_manifest_digest", "client_verified_existing_set_digest", "metadata_manifest_digest"])
def test_commit_digest_mismatch_all_live_unchanged(client, subject, field):
    s, local = subject, "import-digest"
    b = request(client, s, local, [entry()]); q = prepare(client, s, b)
    cb, _ = stage(client, s, b, q)
    before = snapshot(s, local)
    r = client.post(COMMIT, json={**cb, field: "0" * 64}, headers=s["headers"])
    assert r.status_code == 409, r.text
    assert snapshot(s, local) == before
    commit(client, s, cb)


@pytest.mark.parametrize("boundary", ["branch", "origin", "head", "fence", "receipt"])
def test_publication_sql_failure_rolls_back_everything(client, subject, boundary):
    s, local = subject, "import-rollback"
    b = request(client, s, local, [entry(), entry()]); q = prepare(client, s, b)
    cb, _ = stage(client, s, b, q); before = snapshot(s, local)
    patterns = {"branch": "insert into note_offline_branches", "origin": "insert into note_representation_origins",
        "head": "insert into note_heads", "fence": "delete from note_crypto_fences", "receipt": "update note_crypto_transitions set receipt_json"}
    fired = []
    def fail(conn, cursor, statement, parameters, context, executemany):
        if patterns[boundary] in statement.lower():
            fired.append(True)
            raise RuntimeError("synthetic import publication failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post(COMMIT, json=cb, headers=s["headers"])
        assert fired and r.status_code == 500, r.text
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    assert snapshot(s, local) == before
    commit(client, s, cb)


def test_lifecycle_authority_purpose_crossing_and_expiry(client, subject):
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence
    s, local = subject, "import-lifecycle"
    b = request(client, s, local, [entry()]); q = prepare(client, s, b)
    params = {**query(s, local), "import_id": q["import_id"]}
    assert client.get(ROOT + "/status", params=params, headers={}).status_code in (401, 403)
    assert client.get(ROOT + "/status", params={**params, "owner_id": s["other"]}, headers=s["headers"]).status_code == 401
    act = {**common(s, local, q), "lease_version": 1}
    assert client.post(ROOT + "/renew", json=act, headers=s["headers"]).json()["lease_version"] == 2
    before = snapshot(s, local)
    assert client.post(ROOT + "/abort", json=act, headers=s["headers"]).json()["detail"]["code"] == "lease_changed"
    assert snapshot(s, local) == before
    assert client.post("/api/v2/notes/protected-writes/abort", json={**query(s, local), "schema_version": 1,
        "quote_id": q["import_id"], "lease_version": 2}, headers=s["headers"]).status_code == 409
    assert client.get("/api/v2/notes/crypto-transitions/status", params={**query(s, local), "transition_id": q["import_id"]}, headers=s["headers"]).status_code == 409
    assert client.post(ROOT + "/abort", json={**act, "lease_version": 2}, headers=s["headers"]).json()["state"] == "aborted"
    assert client.post(ROOT + "/abort", json=act, headers=s["headers"]).status_code == 200
    b2 = request(client, s, local, [entry()]); q2 = prepare(client, s, b2)
    cb, _ = stage(client, s, b2, q2)
    s["db"].get(NoteCryptoTransition, q2["import_id"]).expires_at = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    n = q2["new_entries"][0]
    expired_source = client.get(ROOT + "/source", params={**query(s, local), "import_id": q2["import_id"],
        "kind": n["key"]["kind"], "representation_id": n["key"]["id"], "slot": n["key"]["slot"],
        "representation_etag": "0" * 64, "chunk_index": 0}, headers=s["headers"])
    assert expired_source.status_code == 410 and expired_source.json()["detail"]["code"] == "import_expired"
    r = client.post(COMMIT, json=cb, headers=s["headers"])
    assert r.status_code == 410 and r.json()["detail"]["code"] == "import_expired"
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, q2["import_id"]).state == "expired"
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None


@pytest.mark.parametrize("damage", ["origin_row", "condition_version", "receipt_version", "reference"])
def test_existing_origin_damage_never_downgrades_to_null(client, subject, damage):
    from app.models.note_crypto import NoteCryptoTransition, NoteRepresentationOrigin
    s, local = subject, "import-origin-loss"
    a = entry(); b = request(client, s, local, [a]); q = prepare(client, s, b)
    cb, outputs = stage(client, s, b, q); commit(client, s, cb)
    row = s["db"].get(NoteCryptoTransition, q["import_id"])
    value = s["db"].get(NoteRepresentationOrigin, (s["owner"], local, canonical(q["new_entries"][0]["key"])))
    if damage == "origin_row":
        s["db"].delete(value)
    elif damage == "reference":
        value.semantic_origin_id = str(uuid4())
    elif damage == "condition_version":
        c = json.loads(row.conditions_json); c.pop("origin_metadata_version"); row.conditions_json = canonical(c)
    else:
        c = json.loads(row.receipt_json); c["origin_metadata_version"] = True; row.receipt_json = canonical(c)
    s["db"].commit()
    b2 = {**b, "mutation_id": str(uuid4()), "crypto_epoch": 1, "expected_history_generation": 1,
          "entries": [entry(a["revision_id"], existing=digest(outputs[a["revision_id"]]))]}
    before = snapshot(s, local)
    r = client.post(ROOT, json=b2, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    assert snapshot(s, local) == before


@pytest.mark.parametrize("damage", ["orphan_origin", "protected_zero_epoch", "unknown_state"])
def test_unknown_or_nonempty_metadata_is_not_a_pristine_import_scope(client, subject, damage):
    from app.models.note_crypto import NoteRepresentationOrigin, NoteCryptoTransition
    from app.models.note_history import NoteHead
    s, local = subject, "import-invalid-scope"
    b = request(client, s, local, [entry()])
    if damage == "unknown_state":
        q = prepare(client, s, b)
        s["db"].get(NoteCryptoTransition, q["import_id"]).state = "unknown"
    elif damage == "orphan_origin":
        s["db"].add(NoteRepresentationOrigin(owner_id=s["owner"], local_id=local,
            key_json=canonical({"kind": "offline_snapshot", "id": str(uuid4()), "slot": "snapshot"}), semantic_origin_id=None))
    else:
        s["db"].add(NoteHead(owner_id=s["owner"], local_id=local, identity_state="branch_only", version=0,
            history_generation=0, crypto_epoch=0, protection_state="protected"))
    s["db"].commit()
    before = snapshot(s, local)
    if damage == "unknown_state":
        r = client.get(ROOT + "/status", params={**query(s, local), "import_id": q["import_id"]}, headers=s["headers"])
    else:
        r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    assert snapshot(s, local) == before


def test_parent_manifest_sort_is_typed_not_uuid_first(client, subject):
    from .test_note_protected_writes import qbody, quote, stage as write_stage, commit as write_commit
    s, local = subject, "import-parent-sort"
    wb = qbody(client, s, local); wq = quote(client, s, wb)
    write_commit(client, s, write_stage(client, s, wb, wq)[0])
    a = entry(ident=str(UUID(int=UUID(wq["revision_ref"]["id"]).int // 2)))
    b = request(client, s, local, [a]); q = prepare(client, s, b)
    commit(client, s, stage(client, s, b, q)[0])
    b2 = request(client, s, local, [entry(parent=ref(a["revision_id"])), entry(parent=wq["revision_ref"])])
    q2 = prepare(client, s, b2)
    assert [p["ref"]["kind"] for p in q2["parent_sources"]] == ["note_revision", "offline_branch"]


@pytest.mark.parametrize("change", ["cipher", "device", "parent", "missing_digest"])
def test_existing_uuid_conflicts_do_not_rewrite_previous_bytes(client, subject, change):
    s, local = subject, "import-conflict"
    a = entry(); b = request(client, s, local, [a]); q = prepare(client, s, b)
    cb, outputs = stage(client, s, b, q); commit(client, s, cb)
    old = entry(a["revision_id"], existing=digest(outputs[a["revision_id"]]))
    if change == "cipher":
        old["expected_existing_ciphertext_sha256"] = "0" * 64
    elif change == "device":
        old["origin_device_id"] = "different"
    elif change == "parent":
        old["parent_ref"] = ref(str(uuid4()))
    else:
        old["expected_existing_ciphertext_sha256"] = None
    b2 = request(client, s, local, [old]); before = snapshot(s, local)
    r = client.post(ROOT, json=b2, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "revision_id_conflict", r.text
    assert snapshot(s, local) == before


def test_reserved_existing_null_origin_zero_upload_and_closed_stage(client, subject):
    s, local = subject, "import-reserved"
    a = entry(); a["origin_device_id"] = "actor"
    seed(client, s, local)
    convert(client, s, local, local_branches=[{k: a[k] for k in ("revision_id", "parent_ref", "origin_device_id")}])
    _, items, raw = read_all(client, s, local)
    d = next(i for i in items if i["key"]["kind"] == "offline_snapshot")
    a["expected_existing_ciphertext_sha256"] = d["ciphertext_sha256"]
    b = request(client, s, local, [a]); q = prepare(client, s, b)
    e = q["existing_entries"][0]
    assert e["source"]["operation_origin"] is None and e["origin_expectation"]["semantic_origin_id"] is None
    assert source(client, s, b, q, e["source"])[0] == raw[canonical(d["key"])]
    r = client.get(ROOT + "/staged", params={**query(s, local), "import_id": q["import_id"],
        "kind": "offline_snapshot", "representation_id": a["revision_id"], "slot": "snapshot", "source_etag": str(uuid4()), "chunk_index": 0}, headers=s["headers"])
    assert r.status_code == 404
    cb = {"schema_version": 2, **query(s, local), "import_id": q["import_id"], "mutation_id": b["mutation_id"],
        "server_instance_id": b["server_instance_id"], "crypto_epoch": 1, "metadata_manifest_digest": q["manifest_digest"],
        "client_verified_ciphertext_manifest_digest": digest(b"[]")}
    e = q["existing_entries"][0]; d = e["source"]
    v = {"key": e["key"], "revision_ref": e["revision_ref"], "parent_ref": e["parent_ref"], "origin_device_id": e["origin_device_id"],
         "crypto_epoch": 1, **{k: d[k] for k in ("representation_etag", "total_bytes", "total_chunks", "ciphertext_sha256", "expected_binding")},
         "origin_expectation": e["origin_expectation"]}
    cb["client_verified_existing_set_digest"] = digest(canonical([v]).encode())
    before = snapshot(s, local); result = commit(client, s, cb)
    assert result["receipt"]["history_generation"] == q["base"]["history_generation"]
    after = snapshot(s, local)
    for table in ("note_offline_branches", "note_representation_origins", "note_heads"):
        assert after[table] == before[table]
    args = {**query(s, local), "import_id": q["import_id"], "kind": d["key"]["kind"], "representation_id": d["key"]["id"],
            "slot": d["key"]["slot"], "representation_etag": d["representation_etag"], "chunk_index": 0}
    assert client.get(ROOT + "/source", params=args, headers=s["headers"]).status_code == 409


def test_concurrent_prepare_uses_existing_owner_lock(client, subject):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import HTTPException
    from sqlalchemy.orm import Session
    from app.schemas.note_protected_import import PrepareImport
    from app.services.note_protected_import import prepare as prepare_service
    s, local = subject, "import-race"
    b = request(client, s, local, [entry()])
    def run(_):
        with Session(s["engine"], autoflush=False) as db:
            try:
                return prepare_service(db, PrepareImport.model_validate({**b, "mutation_id": str(uuid4())}))["import_id"]
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(2) as pool:
        result = list(pool.map(run, range(2)))
    assert result.count(423) == 1 and sum(isinstance(r, str) for r in result) == 1


def test_late_uuid_collision_and_inactive_actor_never_partially_publish(client, subject):
    from app.models.note import UserDevice
    from app.models.note_v2 import NoteOfflineBranch
    s, local = subject, "import-late"
    a = entry(); b = request(client, s, local, [a]); q = prepare(client, s, b)
    cb, _ = stage(client, s, b, q)
    s["db"].add(NoteOfflineBranch(id=a["revision_id"], owner_id=s["other"], local_id="other-local",
        origin_device_id="actor", snapshot_json=canonical(original(s, "other-local", "synthetic"))))
    s["db"].commit(); before = snapshot(s, local)
    r = client.post(COMMIT, json=cb, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "revision_id_conflict", r.text
    assert snapshot(s, local) == before
    actor = s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "actor"))
    actor.is_active = 0; s["db"].commit()
    assert client.post(COMMIT, json=cb, headers=s["web"]).status_code == 403
    assert snapshot(s, local) == before


def test_sealed_byte_mutation_and_commit_core_reuse_are_rejected(client, subject):
    s, local = subject, "import-sealed"
    b = request(client, s, local, [entry()]); q = prepare(client, s, b)
    cb, outputs = stage(client, s, b, q)
    n = q["new_entries"][0]; raw = outputs[n["key"]["id"]]
    altered = bytes([raw[0] ^ 1]) + raw[1:]
    chunk = {**common(s, local, q), "entry_key": n["key"], "source_etag": n["source_etag"], "target_epoch": 1,
        "total_chunks": 1, "total_bytes": len(altered), "chunk_index": 0, "chunk_sha256": digest(altered),
        "data_base64": base64.b64encode(altered).decode()}
    before = snapshot(s, local)
    assert client.put(ROOT + "/chunks", json=chunk, headers=s["headers"]).status_code == 409
    assert snapshot(s, local) == before
    commit(client, s, cb)
    r = client.post(COMMIT, json={**cb, "client_verified_ciphertext_manifest_digest": "0" * 64}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "idempotency_mismatch", r.text


@pytest.mark.parametrize("field", ["base_head_version", "crypto_epoch", "entries"])
def test_persisted_request_cannot_diverge_from_fixed_manifest(client, subject, field):
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "import-request-loss"
    b = request(client, s, local, [entry(), entry()]); q = prepare(client, s, b)
    cb, _ = stage(client, s, b, q)
    row = s["db"].get(NoteCryptoTransition, q["import_id"])
    c = json.loads(row.conditions_json)
    c["request"][field] = c["request"][field][1:] if field == "entries" else c["request"][field] + 1
    row.conditions_json = canonical(c); s["db"].commit(); before = snapshot(s, local)
    r = client.post(COMMIT, json=cb, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    assert snapshot(s, local) == before


def test_uuid_competing_insert_at_publication_maps_to_conflict_and_rolls_back(client, subject):
    from app.models.note_v2 import NoteOfflineBranch
    from sqlalchemy.orm import Session
    s, local = subject, "import-publish-race"
    a = entry(); b = request(client, s, local, [a]); q = prepare(client, s, b)
    cb, _ = stage(client, s, b, q); before = snapshot(s, local)
    fired = []
    def occupy(conn, cursor, statement, parameters, context, executemany):
        if not fired and statement.lower().startswith("insert into note_offline_branches"):
            fired.append(True)
            values = {"id": a["revision_id"], "owner_id": s["other"], "local_id": "competing-synthetic",
                      "origin_device_id": "actor", "snapshot_json": canonical(original(s, local, "competing"))}
            if s["engine"].dialect.name == "postgresql":
                with Session(s["engine"]) as other:
                    other.execute(NoteOfflineBranch.__table__.insert().values(**values)); other.commit()
            else:
                conn.execute(NoteOfflineBranch.__table__.insert().values(**values))
    event.listen(s["engine"], "before_cursor_execute", occupy)
    try:
        r = client.post(COMMIT, json=cb, headers=s["headers"])
        assert fired and r.status_code == 409 and r.json()["detail"]["code"] == "revision_id_conflict", r.text
    finally:
        event.remove(s["engine"], "before_cursor_execute", occupy)
    assert snapshot(s, local) == before
