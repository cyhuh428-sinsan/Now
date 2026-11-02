"""A2b real authenticated API and synthetic client encryption/DB races."""
import base64
import json
import os
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from .test_note_crypto import subject, query, context
from .test_note_crypto_conversion import canonical, digest, encrypt, decrypt, seed, convert, read_all, SIZE

ROOT = "/api/v2/notes/protected-writes"


def qbody(client, s, local="protected", operation="create", **changes):
    base = context(client, s, local)
    return {"schema_version": 1, **query(s, local), "mutation_id": str(uuid4()),
            "server_instance_id": base["server_instance_id"], "operation": operation,
            "crypto_epoch": base["crypto_epoch"], "target_epoch": base["crypto_epoch"] or 1,
            "base_head_version": base["head_version"], "base_revision_id": base["head_revision_id"],
            "expected_history_generation": base["history_generation"], "expected_inventory_revision_ids": base["inventory_revision_ids"],
            "replica_policy": None, "structure": {"note_type": "daily", "parent_local_id": None, "level": 1, "deleted_at": None},
            "parent_base": None, "target_ref": None, "target_ciphertext_sha256": None, **changes}


def quote(client, s, b):
    r = client.post(ROOT + "/quote", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    return r.json()


def common(s, b, q):
    return {"schema_version": 1, **query(s, b["local_id"]), "quote_id": q["quote_id"]}


def read_source(client, s, b, q, descriptor):
    raw = b""
    key = descriptor["key"]
    for index in range(descriptor["total_chunks"]):
        r = client.get(ROOT + "/source", params={**query(s, b["local_id"]), "quote_id": q["quote_id"],
            "kind": key["kind"], "representation_id": key["id"], "slot": key["slot"],
            "representation_etag": descriptor["representation_etag"], "chunk_index": index}, headers=s["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["operation_origin"] == descriptor["operation_origin"]
        raw += base64.b64decode(r.json()["data_base64"])
    assert digest(raw) == descriptor["ciphertext_sha256"]
    return raw


def stage(client, s, b, q, text="new meaning\r\n끝 \n"):
    projection = {**b["structure"], "title": "raw title", "tags": " raw,,tags\r\n", "source": None}
    after = {"schema_version": 1, "note": {**q["server_fields"], **projection, "content": text}}
    before = None
    if q["before_source"]:
        wrapper = json.loads(read_source(client, s, b, q, q["before_source"]["inventory"]))
        before = json.loads(decrypt(wrapper["ciphertext"], q["crypto_epoch"]))["snapshot"]
        public = q["before_public_fields"]
        assert {k: v for k, v in before["note"].items() if k != "content"} == public
        body = read_source(client, s, b, q, q["before_source"]["note_body"]).decode()
        assert decrypt(body, q["crypto_epoch"]) == before["note"]["content"]
    records, outputs = [], {}
    for entry in q["required_entries"]:
        key = entry["key"]
        if key["kind"] == "note_body":
            raw = encrypt(text, q["crypto_epoch"]).encode()
        else:
            snapshot = before if key["kind"] == "revision_before" else after
            inner = {"schema_version": 1, "binding": entry["expected_binding"], "snapshot": snapshot,
                     "origin": entry["operation_origin"], "content_origin_kind": "semantic",
                     "semantic_sha256": digest(canonical(snapshot).encode())}
            raw = canonical({"schema_version": 1, "kind": "history_envelope_v1", "crypto_epoch": q["crypto_epoch"],
                "binding": entry["expected_binding"], "ciphertext": encrypt(canonical(inner), q["crypto_epoch"])}).encode()
        chunks = [raw[i:i + SIZE] for i in range(0, len(raw), SIZE)]
        outputs[canonical(key)] = raw
        for index, data in enumerate(chunks):
            cb = {**common(s, b, q), "entry_key": key, "source_etag": entry["source_etag"], "target_epoch": q["crypto_epoch"],
                  "chunk_index": index, "total_chunks": len(chunks), "total_bytes": len(raw),
                  "chunk_sha256": digest(data), "data_base64": base64.b64encode(data).decode()}
            r = client.put(ROOT + "/chunks", json=cb, headers=s["headers"])
            assert r.status_code == 200, r.text
        sb = {**common(s, b, q), "entry_key": key, "source_etag": entry["source_etag"], "target_epoch": q["crypto_epoch"],
              "total_chunks": len(chunks), "total_bytes": len(raw), "ciphertext_sha256": digest(raw)}
        r = client.post(ROOT + "/entries/seal", json=sb, headers=s["headers"])
        assert r.status_code == 200, r.text
        downloaded = b""
        for index in range(len(chunks)):
            r = client.get(ROOT + "/staged", params={**query(s, b["local_id"]), "quote_id": q["quote_id"],
                "kind": key["kind"], "representation_id": key["id"], "slot": key["slot"],
                "source_etag": entry["source_etag"], "chunk_index": index}, headers=s["headers"])
            assert r.status_code == 200, r.text
            assert r.json()["operation_origin"] == entry["operation_origin"]
            downloaded += base64.b64decode(r.json()["data_base64"])
        assert downloaded == raw
        records.append({"entry_key": key, "destination_key": key, "source_etag": entry["source_etag"],
                        "output_kind": entry["output_kind"], "target_epoch": q["crypto_epoch"], "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    records.sort(key=lambda r: tuple(r["entry_key"][k].encode() for k in ("kind", "id", "slot")))
    commit = {**common(s, b, q), "mutation_id": b["mutation_id"], "server_instance_id": b["server_instance_id"],
              "crypto_epoch": q["crypto_epoch"], "base_head_version": b["base_head_version"], "base_revision_id": b["base_revision_id"],
              "expected_history_generation": b["expected_history_generation"], "expected_inventory_revision_ids": b["expected_inventory_revision_ids"],
              "metadata_manifest_digest": q["manifest_digest"], "client_verified_ciphertext_manifest_digest": digest(canonical(records).encode()),
              "projection": projection}
    return commit, after, before, outputs


def commit(client, s, cb):
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 200, r.text
    return r.json()


def test_create_edit_origin_before_and_reconversion_recovery(client, subject):
    s, local = subject, "protected"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    again = client.post(ROOT + "/quote", json=b, headers=s["headers"])
    assert again.status_code == 200 and again.json()["server_fields"] == q["server_fields"]
    assert client.get("/api/v2/notes/current", params=query(s, local, representation_schema=2), headers=s["headers"]).status_code == 404
    cb, after, before, _ = stage(client, s, b, q)
    assert before is None and len(q["required_entries"]) == 3
    first = commit(client, s, cb)
    assert first["receipt_matches_current"] is True
    current = client.get("/api/v2/notes/current", params=query(s, local, representation_schema=2), headers=s["headers"]).json()
    assert current["note"]["id"] == after["note"]["id"]
    assert current["current_representation_metadata"]["operation_origin"] == q["quote_operation_origin"]
    b2 = qbody(client, s, local, "put")
    q2 = quote(client, s, b2)
    cb2, after2, before2, _ = stage(client, s, b2, q2, "second")
    assert before2 == after and q2["server_fields"]["id"] == q["server_fields"]["id"]
    second = commit(client, s, cb2)
    r = client.get("/api/v2/notes/revision", params=query(s, local, representation_schema=2,
        revision_kind="note_revision", revision_id=second["receipt"]["result_revision_id"]), headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["before_representation"]["operation_origin"] == q["quote_operation_origin"]
    assert r.json()["representation"]["operation_origin"] == q2["quote_operation_origin"]
    cb3, receipt3, _, _ = convert(client, s, local)
    _, items, raw = read_all(client, s, local)
    assert all("operation_origin" in item for item in items)
    for item in items:
        if item["is_null"] or item["key"]["kind"] == "note_body":
            assert item["operation_origin"] is None
        else:
            wrapper = json.loads(raw[canonical(item["key"])])
            inner = json.loads(decrypt(wrapper["ciphertext"], 2))
            assert inner.get("origin") == item["operation_origin"]
            assert wrapper["binding"]["transition_id"] == receipt3["transition_id"]
    replay = commit(client, s, cb)
    assert replay["receipt"] == first["receipt"] and replay["receipt_matches_current"] is False
    assert replay["current_context"]["crypto_epoch"] == 2


def test_sqlite_or_pg_candidate_conflict_stale_and_new_mutation(client, subject):
    from app.models.note import Note
    from app.models.note_crypto import NoteCryptoTransition
    s = subject
    b = qbody(client, s, "conflict")
    q = quote(client, s, b)
    cb, _, _, _ = stage(client, s, b, q)
    s["db"].add(Note(id=q["server_fields"]["id"], owner_id=s["other"], device_id="actor", local_id="other",
                     note_type="daily", title="unrelated", content="must preserve"))
    s["db"].commit()
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "provisional_note_id_conflict", r.text
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, q["quote_id"]).state == "stale"
    assert s["db"].get(Note, q["server_fields"]["id"]).content == "must preserve"
    b2 = qbody(client, s, "conflict")
    q2 = quote(client, s, b2)
    assert q2["quote_id"] != q["quote_id"]
    assert commit(client, s, stage(client, s, b2, q2)[0])["receipt"]["note_id"] != q["server_fields"]["id"]


@pytest.mark.parametrize("damage", ["origin_row", "expectations", "version", "receipt_version", "ref"])
def test_origin_required_absence_fails_closed(client, subject, damage):
    from app.models.note_crypto import NoteCryptoTransition, NoteRepresentationOrigin
    s, local = subject, "originloss"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    commit(client, s, stage(client, s, b, q)[0])
    s["db"].expire_all()
    row = s["db"].get(NoteCryptoTransition, q["quote_id"])
    origin = s["db"].scalar(select(NoteRepresentationOrigin).where(NoteRepresentationOrigin.owner_id == s["owner"]))
    if damage == "origin_row":
        s["db"].delete(origin)
    elif damage == "ref":
        origin.semantic_origin_id = str(uuid4())
    else:
        field = "receipt_json" if damage == "receipt_version" else "conditions_json"
        value = json.loads(getattr(row, field))
        value.pop("origin_expectations" if damage == "expectations" else "origin_metadata_version")
        setattr(row, field, canonical(value))
    s["db"].commit()
    r = client.get("/api/v2/notes/representations", params=query(s, local, representation_schema=2), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text


@pytest.mark.parametrize("failure", ["incomplete", "digest", "sql", "actor", "expiry", "purpose"])
def test_quote_failure_guards_and_atomicity(client, subject, failure):
    from app.models.note import Note, UserDevice
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "failure"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    cb, _, _, _ = stage(client, s, b, q)
    expected = 409
    if failure == "digest":
        cb["client_verified_ciphertext_manifest_digest"] = "0" * 64
    elif failure == "incomplete":
        from app.models.note_crypto import NoteCryptoUpload
        u = s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == q["quote_id"]))
        u.ciphertext_sha256 = None
        s["db"].commit()
    elif failure == "expiry":
        s["db"].get(NoteCryptoTransition, q["quote_id"]).expires_at = datetime.utcnow() - timedelta(seconds=1)
        s["db"].commit()
        expected = 410
    elif failure == "actor":
        s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "actor")).is_active = 0
        s["db"].commit()
        expected = 403
    elif failure == "purpose":
        r = client.post("/api/v2/notes/crypto-transitions/abort", json={"schema_version": 1, **query(s, local),
            "transition_id": q["quote_id"], "lease_version": 1}, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "operation_mismatch", r.text
        return
    def fail(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("INSERT INTO NOTE_INVENTORY"):
            raise RuntimeError("synthetic storage failure")
    if failure == "sql":
        event.listen(s["engine"], "before_cursor_execute", fail)
        expected = 500
    try:
        r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
        assert r.status_code == expected and r.headers["cache-control"] == "no-store", r.text
    finally:
        if failure == "sql":
            event.remove(s["engine"], "before_cursor_execute", fail)
    s["db"].expire_all()
    assert s["db"].scalar(select(Note).where(Note.owner_id == s["owner"], Note.local_id == local)) is None


@pytest.mark.parametrize("invalid", [{"title": "not quote metadata"}, {"target_epoch": 2}, {"schema_version": True},
                                    {"structure": {"note_type": "daily", "parent_local_id": None, "level": 4, "deleted_at": None}}])
def test_strict_quote_and_current_auth(client, subject, invalid):
    s = subject
    b = qbody(client, s)
    assert client.post(ROOT + "/quote", json=b).status_code == 401
    assert client.post(ROOT + "/quote", json={**b, **invalid}, headers=s["headers"]).status_code in (409, 422)


@pytest.mark.parametrize("source_kind", ["native", "branch_only"])
def test_restore_uses_new_provenance_and_preserves_source(client, subject, source_kind):
    from app.models.note import Note
    from app.models.note_history import NoteHead
    from app.models.note_v2 import NoteOfflineBranch
    s, local = subject, "restore"
    if source_kind == "native":
        b = qbody(client, s, local)
        q = quote(client, s, b)
        c1, after1, _, _ = stage(client, s, b, q, "target text")
        result1 = commit(client, s, c1)
        target = {"kind": "note_revision", "id": result1["receipt"]["result_revision_id"]}
        b2 = qbody(client, s, local, "put")
        q2 = quote(client, s, b2)
        commit(client, s, stage(client, s, b2, q2, "other text")[0])
    else:
        ident = str(uuid4())
        raw = {"id": None, "owner_id": s["owner"], "device_id": "historical", "local_id": local,
               "note_type": "daily", "title": "raw title", "content": "target text", "parent_local_id": None,
               "level": 1, "tags": " raw,,tags\r\n", "source": None, "deleted_at": None,
               "created_at": "2000-01-01T00:00:00.000000Z", "updated_at": "2000-01-02T00:00:00.000000Z", "client_updated_at": None}
        s["db"].add(NoteHead(owner_id=s["owner"], local_id=local, version=0, history_generation=1, identity_state="branch_only"))
        s["db"].add(NoteOfflineBranch(id=ident, owner_id=s["owner"], local_id=local, origin_device_id="historical",
                                     snapshot_json=canonical({"schema_version": 1, "note": raw})))
        s["db"].commit()
        convert(client, s, local)
        target = {"kind": "offline_branch", "id": ident}
    _, items, raw = read_all(client, s, local)
    key = {"kind": "revision_snapshot" if target["kind"] == "note_revision" else "offline_snapshot", "id": target["id"],
           "slot": "after" if target["kind"] == "note_revision" else "snapshot"}
    descriptor = next(i for i in items if i["key"] == key)
    original_bytes = raw[canonical(key)]
    b = qbody(client, s, local, "restore", target_ref=target, target_ciphertext_sha256=descriptor["ciphertext_sha256"])
    q = quote(client, s, b)
    assert read_source(client, s, b, q, q["restore_source"]) == original_bytes
    cb, after, before, _ = stage(client, s, b, q, "target text")
    result = commit(client, s, cb)
    assert result["receipt"]["result_revision_id"] != target["id"]
    assert (before is None) == (source_kind == "branch_only")
    if source_kind == "branch_only":
        assert q["parent_ref"] is None and q["server_fields"]["created_at"] != "2000-01-01T00:00:00.000000Z"
    assert read_all(client, s, local)[2][canonical(key)] == original_bytes
    current = client.get("/api/v2/notes/current", params=query(s, local, representation_schema=2), headers=s["headers"]).json()
    assert decrypt(current["note"]["content"], 1) == "target text"
    assert {k: v for k, v in current["note"].items() if k != "content"} == {k: v for k, v in after["note"].items() if k != "content"}


def test_parent_cas_change_stales_only_child_quote(client, subject):
    from .test_note_v2 import body, get_current, based
    from app.models.note import Note
    s, parent, child = subject, "parent", "child"
    request = body(s, parent, "ordinary parent")
    request["note"]["note_type"] = "tree"
    assert client.put("/api/v2/notes/current", json=request, headers=s["headers"]).status_code == 200
    pc = context(client, s, parent)
    parent_row = s["db"].scalar(select(Note).where(Note.owner_id == s["owner"], Note.local_id == parent))
    parent_base = {k: pc[k] for k in ("head_version", "head_revision_id", "crypto_epoch", "history_generation", "inventory_revision_ids")}
    parent_base.update(local_id=parent, physical_note_id=parent_row.id)
    b = qbody(client, s, child, structure={"note_type": "tree", "parent_local_id": parent, "level": 2, "deleted_at": None}, parent_base=parent_base)
    q = quote(client, s, b)
    cb = stage(client, s, b, q)[0]
    update = based(request, get_current(client, s, parent))
    update["note"]["title"] = "changed ordinary parent"
    assert client.put("/api/v2/notes/current", json=update, headers=s["headers"]).status_code == 200
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "parent_changed", r.text
    assert client.get(ROOT + "/status", params={**query(s, child), "quote_id": q["quote_id"]}, headers=s["headers"]).json()["state"] == "stale"
    pc2 = context(client, s, parent)
    parent_base.update({k: pc2[k] for k in ("head_version", "head_revision_id", "crypto_epoch", "history_generation", "inventory_revision_ids")})
    b2 = qbody(client, s, child, structure=b["structure"], parent_base=parent_base)
    q2 = quote(client, s, b2)
    commit(client, s, stage(client, s, b2, q2)[0])


def test_null_origin_row_required_and_legacy_marker_no_absence_fallback(client, subject):
    from app.models.note_crypto import NoteCryptoTransition, NoteRepresentationOrigin
    s, local = subject, "legacy"
    seed(client, s, local)
    cb, t, _, _ = convert(client, s, local)
    s["db"].expire_all()
    maps = list(s["db"].scalars(select(NoteRepresentationOrigin).where(NoteRepresentationOrigin.owner_id == s["owner"])))
    for mapping in maps:
        s["db"].delete(mapping)
    row = s["db"].get(NoteCryptoTransition, cb["transition_id"])
    c, receipt = json.loads(row.conditions_json), json.loads(row.receipt_json)
    c.pop("origin_metadata_version"); c.pop("origin_expectations")
    receipt.pop("origin_metadata_version"); receipt.pop("origin_expectations_digest")
    row.conditions_json, row.receipt_json = canonical(c), canonical(receipt)
    s["db"].commit()
    r = client.get("/api/v2/notes/representations", params=query(s, local, representation_schema=2), headers=s["headers"])
    assert r.status_code == 409  # Missing version is not proof of legacy.
    c["origin_metadata_legacy"] = "a2a_pre_origin_v0"
    row.conditions_json = canonical(c); s["db"].commit()
    assert all(i["operation_origin"] is None for i in read_all(client, s, local)[1])
    convert(client, s, local)
    s["db"].expire_all()
    null_before = next(m for m in s["db"].scalars(select(NoteRepresentationOrigin).where(NoteRepresentationOrigin.owner_id == s["owner"]))
                       if json.loads(m.key_json)["kind"] == "revision_before" and m.semantic_origin_id is None)
    s["db"].delete(null_before); s["db"].commit()
    assert client.get("/api/v2/notes/representations", params=query(s, local, representation_schema=2), headers=s["headers"]).status_code == 409


def test_fixed_projection_replay_lease_abort_and_quote_scope(client, subject):
    s, local = subject, "replay"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    cb = stage(client, s, b, q)[0]
    first = commit(client, s, cb)
    altered = {**cb, "projection": {**cb["projection"], "title": "not a second metadata write"}}
    assert commit(client, s, altered)["receipt"] == first["receipt"]
    current = client.get("/api/v2/notes/current", params=query(s, local, representation_schema=2), headers=s["headers"]).json()
    assert current["note"]["title"] == cb["projection"]["title"]
    assert client.post(ROOT + "/commit", json={**cb, "mutation_id": str(uuid4())}, headers=s["headers"]).status_code == 409
    b2 = qbody(client, s, local, "put")
    q2 = quote(client, s, b2)
    act = {**common(s, b2, q2), "lease_version": 1}
    assert client.post(ROOT + "/renew", json=act, headers=s["headers"]).json()["lease_version"] == 2
    assert client.post(ROOT + "/renew", json=act, headers=s["headers"]).status_code == 409
    assert client.post(ROOT + "/abort", json={**act, "lease_version": 2}, headers=s["headers"]).json()["state"] == "aborted"
    assert client.post(ROOT + "/quote", json=b2, headers=s["headers"]).json()["quote_id"] == q2["quote_id"]
    terminal_manifest = client.get(ROOT + "/manifest", params={**query(s, local), "quote_id": q2["quote_id"]}, headers=s["headers"])
    assert terminal_manifest.status_code == 200 and terminal_manifest.json()["state"] == "aborted", terminal_manifest.text


def test_selected_replica_exact_times_and_other_physical_unchanged(client, subject):
    from app.models.note import Note
    s, local = subject, "replicas"
    for index in range(2):
        s["db"].add(Note(owner_id=s["owner"], device_id=f"physical{index}", local_id=local, note_type="daily", title="raw",
            content=f"body{index}", client_updated_at=datetime(2050 + index, 1, 1), created_at=datetime(2020, 1, 1), updated_at=datetime(2021, 1, 1)))
    s["db"].commit()
    convert(client, s, local)
    s["db"].expire_all()
    rows = list(s["db"].scalars(select(Note).where(Note.owner_id == s["owner"]).order_by(Note.id)))
    untouched = {c.name: getattr(rows[0], c.name) for c in Note.__table__.columns}
    b = qbody(client, s, local, "put", replica_policy="selected_head_only")
    q = quote(client, s, b)
    assert q["server_fields"]["id"] == rows[1].id and q["server_fields"]["device_id"] == "physical1"
    assert q["server_fields"]["client_updated_at"] == "2051-01-01T00:00:00.000000Z"
    cb, after, before, _ = stage(client, s, b, q, "new selected")
    assert before["note"]["device_id"] == "physical1" and before["note"]["created_at"] == "2020-01-01T00:00:00.000000Z"
    commit(client, s, cb)
    s["db"].expire_all()
    assert {c.name: getattr(s["db"].get(Note, rows[0].id), c.name) for c in Note.__table__.columns} == untouched
    n = s["db"].get(Note, q["server_fields"]["id"])
    for field in ("created_at", "updated_at", "client_updated_at"):
        assert getattr(n, field).isoformat(timespec="microseconds") + "Z" == after["note"][field]


def test_real_concurrent_quote_single_winner_and_no_half_current(client, subject):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import HTTPException
    from app.schemas.note_protected_write import Quote
    from app.services.note_protected_write import quote as make_quote
    from app.models.note import Note
    s, local = subject, "race"
    b = qbody(client, s, local)
    def run(index):
        with Session(s["engine"], autoflush=False) as db:
            try:
                return make_quote(db, Quote.model_validate({**b, "mutation_id": str(uuid4())}))["quote_id"]
            except HTTPException as e:
                return e.status_code
    with ThreadPoolExecutor(2) as pool:
        outcomes = list(pool.map(run, range(2)))
    assert sum(isinstance(x, str) for x in outcomes) == 1 and 423 in outcomes
    assert s["db"].scalar(select(Note).where(Note.owner_id == s["owner"], Note.local_id == local)) is None


@pytest.mark.parametrize("phase", ["committed", "ready", "malformed"])
def test_origin_purpose_migration_positive_marker_is_one_time(client, subject, tmp_path, monkeypatch, phase):
    from fastapi import HTTPException
    from sqlalchemy import create_engine, text
    from sqlalchemy.schema import CreateSchema, DropSchema
    from app import db as database
    from app.models.note import Note
    from app.models.note_history import NoteHead, NoteInventory, NoteRevision
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoUpload, NoteCryptoChunk, ServerIdentity
    from app.services.note_crypto_storage import live_entries
    s, local = subject, "old-schema"
    seed(client, s, local)
    if phase != "ready":
        cb, _, _, _ = convert(client, s, local)
    else:
        from .test_note_crypto import prepare as prepare_conversion
        from .test_note_crypto_conversion import manifest as conversion_manifest, stage as conversion_stage
        old_body, transition = prepare_conversion(client, s, local)
        conversion_stage(client, s, local, transition, conversion_manifest(client, s, local, transition))
        cb = {"transition_id": transition["transition_id"]}
    url = os.environ.get("NOW_E4A1_TEST_POSTGRES_URL")
    admin, schema = None, None
    if url:
        schema = "a2b_origin_" + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as conn:
            conn.execute(CreateSchema(schema))
        engine = create_engine(url, connect_args={"options": "-c search_path=" + schema})
    else:
        engine = create_engine(f"sqlite:///{(tmp_path / 'origin-migration.db').as_posix()}")
    try:
        database.Base.metadata.create_all(engine)
        with engine.begin() as conn:
            for model in (ServerIdentity, Note, NoteHead, NoteInventory, NoteRevision, NoteOfflineBranch, NoteCryptoTransition, NoteCryptoEntry, NoteCryptoUpload, NoteCryptoChunk):
                query = select(model.__table__)
                if model in (NoteCryptoEntry, NoteCryptoUpload, NoteCryptoChunk):
                    query = query.where(model.transition_id == cb["transition_id"])
                elif model is not ServerIdentity:
                    query = query.where(model.owner_id == s["owner"])
                for raw in s["db"].execute(query).mappings():
                    value = dict(raw)
                    if model is NoteHead:
                        # A pre-M1 database has no current-mode classification.
                        value.pop("current_mode", None)
                    if model is NoteCryptoTransition:
                        c = json.loads(value["conditions_json"])
                        receipt = json.loads(value["receipt_json"]) if value["receipt_json"] else None
                        c.pop("origin_metadata_version"); c.pop("origin_expectations")
                        if phase == "malformed":
                            c["request"].pop("schema_version")
                        if receipt:
                            receipt.pop("origin_metadata_version"); receipt.pop("origin_expectations_digest")
                        value.update(conditions_json=canonical(c), receipt_json=canonical(receipt) if receipt else None)
                    conn.execute(model.__table__.insert().values(**value))
            conn.execute(text("ALTER TABLE note_crypto_transitions DROP COLUMN purpose"))
        monkeypatch.setattr(database, "engine", engine)
        if phase == "malformed":
            # M1 now rejects unproven protected provenance during startup itself.
            with pytest.raises(HTTPException) as raised:
                database.create_tables()
            assert raised.value.status_code == 409
            with engine.connect() as conn:
                stored = conn.scalar(text("SELECT conditions_json FROM note_crypto_transitions WHERE id=:id"), {"id": cb["transition_id"]})
                assert "origin_metadata_legacy" not in json.loads(stored)
            return
        database.create_tables()
        with Session(engine) as db:
            row = db.get(NoteCryptoTransition, cb["transition_id"])
            c = json.loads(row.conditions_json)
            if phase == "committed":
                assert c.pop("origin_metadata_legacy") == "a2a_pre_origin_v0"
                assert all(item["operation_origin"] is None for item, _ in live_entries(db, s["owner"], local))
            elif phase == "ready":
                assert c.get("origin_metadata_pending_upgrade") is True
                from app.services.note_crypto import result as conversion_result
                assert conversion_result(db, row)["state"] == "ready"
                c = json.loads(row.conditions_json)
                assert c["origin_metadata_version"] == 1 and "origin_metadata_pending_upgrade" not in c
                c.pop("origin_metadata_version"); c.pop("origin_expectations")
            else:
                assert "origin_metadata_legacy" not in c, "Unproven old request must not gain legacy admission"
            row.conditions_json = canonical(c); db.commit()
        if phase == "committed":
            with pytest.raises(HTTPException) as raised:
                database.create_tables()
            assert raised.value.status_code == 409
        else:
            database.create_tables()
        with Session(engine) as db:
            assert "origin_metadata_legacy" not in json.loads(db.get(NoteCryptoTransition, cb["transition_id"]).conditions_json)
            with pytest.raises(HTTPException) as raised:
                if phase != "ready":
                    live_entries(db, s["owner"], local)
                else:
                    from app.services.note_crypto_storage import entry_metadata
                    row = db.get(NoteCryptoTransition, cb["transition_id"])
                    entry_metadata(db, row, db.scalar(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id)))
            assert raised.value.status_code == 409
    finally:
        engine.dispose()
        if admin:
            with admin.begin() as conn:
                conn.execute(DropSchema(schema, cascade=True))
            admin.dispose()


@pytest.mark.parametrize("damage", ["version", "expectations", "receipt"])
def test_reconverted_semantic_ledger_damage_fails_closed(client, subject, damage):
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "semantic-ledger"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    commit(client, s, stage(client, s, b, q)[0])
    convert(client, s, local)
    s["db"].expire_all()
    row = s["db"].get(NoteCryptoTransition, q["quote_id"])
    field = "receipt_json" if damage == "receipt" else "conditions_json"
    value = json.loads(getattr(row, field))
    value.pop("origin_expectations" if damage == "expectations" else "origin_metadata_version")
    setattr(row, field, canonical(value)); s["db"].commit()
    r = client.get("/api/v2/notes/representations", params=query(s, local, representation_schema=2), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text


@pytest.mark.parametrize("boundary", ["note", "native", "inventory", "origin", "receipt"])
def test_existing_put_every_write_boundary_rolls_back(client, subject, boundary):
    s, local = subject, "rollback-existing"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    commit(client, s, stage(client, s, b, q)[0])
    old_context, old_items, old_bytes = read_all(client, s, local)
    b2 = qbody(client, s, local, "put")
    q2 = quote(client, s, b2)
    cb = stage(client, s, b2, q2, "must not survive failure")[0]
    prefixes = {"note": "UPDATE NOTES", "native": "INSERT INTO NOTE_REVISIONS", "inventory": "UPDATE NOTE_INVENTORY",
                "origin": "INSERT INTO NOTE_REPRESENTATION_ORIGINS", "receipt": "UPDATE NOTE_CRYPTO_TRANSITIONS"}
    fired = []
    def fail(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith(prefixes[boundary]):
            fired.append(True)
            raise RuntimeError("synthetic atomic boundary")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
        assert fired and r.status_code == 500, r.text
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    assert client.post(ROOT + "/abort", json={**common(s, b2, q2), "lease_version": 1}, headers=s["headers"]).status_code == 200
    current_context, current_items, current_bytes = read_all(client, s, local)
    assert current_context == old_context and current_items == old_items and current_bytes == old_bytes


def test_expired_commit_persists_expiry_and_releases_only_own_fence(client, subject):
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence
    s, local = subject, "expired-ledger"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    cb, _, _, outputs = stage(client, s, b, q)
    other_b = qbody(client, s, "other-active")
    other_q = quote(client, s, other_b)
    row = s["db"].get(NoteCryptoTransition, q["quote_id"])
    row.expires_at = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    entry = q["required_entries"][0]
    raw = outputs[canonical(entry["key"])]
    expired_chunk = {**common(s, b, q), "entry_key": entry["key"], "source_etag": entry["source_etag"], "target_epoch": 1,
                     "chunk_index": 0, "total_chunks": (len(raw) + SIZE - 1) // SIZE, "total_bytes": len(raw),
                     "chunk_sha256": digest(raw[:SIZE]), "data_base64": base64.b64encode(raw[:SIZE]).decode()}
    rejected = client.put(ROOT + "/chunks", json=expired_chunk, headers=s["headers"])
    assert rejected.status_code == 410 and rejected.json()["detail"]["code"] == "quote_expired", rejected.text
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 410
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, q["quote_id"]).state == "expired"
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None
    assert s["db"].get(NoteCryptoFence, (s["owner"], "other-active")).transition_id == other_q["quote_id"]


@pytest.mark.parametrize("damage", ["source_kind", "binding"])
def test_frozen_quote_entry_metadata_is_rechecked_before_commit(client, subject, damage):
    from app.models.note_crypto import NoteCryptoEntry
    s, local = subject, "frozen-entry"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    cb = stage(client, s, b, q)[0]
    entry = next(e for e in s["db"].scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == q["quote_id"]))
                 if json.loads(e.key_json)["kind"] == "revision_snapshot")
    if damage == "source_kind":
        entry.source_kind = "unsupported_changed_kind"
    else:
        value = json.loads(entry.binding_json); value["local_id"] = "different"
        entry.binding_json = canonical(value)
    s["db"].commit()
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] in ("manifest_changed", "inconsistent_history"), r.text


def test_v1_auto_insert_interleaves_with_quote_db_allocation(client, subject):
    s, local = subject, "allocation-race"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    cb = stage(client, s, b, q)[0]
    ordinary = {**query(s, "ordinary-v1"), "note_type": "daily", "title": "ordinary", "content": "preserve ordinary"}
    r = client.post("/api/v1/notes", json=ordinary, headers=s["headers"])
    assert r.status_code in (200, 201), r.text
    if s["engine"].dialect.name == "postgresql":
        assert r.json()["id"] != q["server_fields"]["id"]
        commit(client, s, cb)
    else:
        assert r.json()["id"] == q["server_fields"]["id"]
        conflict = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
        assert conflict.status_code == 409 and conflict.json()["detail"]["code"] == "provisional_note_id_conflict"
        b2 = qbody(client, s, local)
        q2 = quote(client, s, b2)
        commit(client, s, stage(client, s, b2, q2)[0])
    ordinary_read = client.get("/api/v1/notes", params={"owner_id": s["owner"]}, headers=s["headers"])
    assert any(n["local_id"] == "ordinary-v1" and n["content"] == "preserve ordinary" for n in ordinary_read.json())
