"""A2a real HTTP/auth/storage, synthetic client-side encryption only."""
import base64
import hashlib
import json
import os
import subprocess
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from .test_note_crypto import ROOT, subject, query, prepare, context
from .test_note_v2 import body, get_current, based

LIVE = "/api/v2/notes/representations"
READ = "/api/v2/notes/representation"
SIZE = 262144


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value):
    return hashlib.sha256(value).hexdigest()


def encrypt(value, epoch):
    salt, iv = b"s" * 16, os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=1000).derive(f"fixture-key-{epoch}".encode())
    data = AESGCM(key).encrypt(iv, value.encode(), None)
    enc = lambda b: base64.b64encode(b).decode()
    return "NOW_ENCRYPTED_V1:" + enc(canonical({"v": 1, "alg": "AES-GCM", "kdf": "PBKDF2-SHA256",
        "iterations": 1000, "salt": enc(salt), "iv": enc(iv), "data": enc(data)}).encode())


def decrypt(value, epoch):
    dec = base64.b64decode
    obj = json.loads(dec(value.split(":", 1)[1]))
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=dec(obj["salt"]), iterations=obj["iterations"]).derive(f"fixture-key-{epoch}".encode())
    return AESGCM(key).decrypt(dec(obj["iv"]), dec(obj["data"]), None).decode()


def seed(client, s, local="conversion", content="SYNTHETIC\r\n본문  \n", second_content=None):
    req = body(s, local, content)
    r = client.put("/api/v2/notes/current", json=req, headers=s["headers"])
    assert r.status_code == 200, r.text
    update = based(req, get_current(client, s, local))
    update["note"]["content"] = content + "second\n" if second_content is None else second_content
    assert client.put("/api/v2/notes/current", json=update, headers=s["headers"]).status_code == 200
    return update


def manifest(client, s, local, t):
    r = client.get(ROOT + "/manifest", params=query(s, local, transition_id=t["transition_id"], limit=500), headers=s["headers"])
    assert r.status_code == 200, r.text
    return r.json()["items"]


def common(s, local, t):
    return {"schema_version": 1, **query(s, local), "transition_id": t["transition_id"]}


def stage(client, s, local, t, items, *, alter=None):
    outputs, semantics, records = {}, {}, []
    for item in items:
        key = item["key"]
        source = client.get(ROOT + "/source", params=query(s, local, transition_id=t["transition_id"],
            kind=key["kind"], representation_id=key["id"], slot=key["slot"], source_etag=item["source_etag"]), headers=s["headers"])
        if key["kind"] == "reserved_offline_snapshot":
            assert source.status_code == 409
            value = {"schema_version": 1, "note": {"content": "local branch synthetic"}}
        else:
            assert source.status_code == 200, source.text
            assert source.json()["source_kind"] == item["source_kind"]
            raw = source.json()["value"]
            if key["kind"] == "note_body":
                value = decrypt(raw, t["target_epoch"] - 1) if raw.startswith("NOW_ENCRYPTED_V1:") else raw
            else:
                value = json.loads(raw)
                if value.get("kind") == "history_envelope_v1":
                    assert item["source_kind"] == "history_envelope_v1", "manifest must declare the actual encrypted source kind"
                    value = json.loads(decrypt(value["ciphertext"], t["target_epoch"] - 1))["snapshot"]
                else:
                    assert item["source_kind"] == "snapshot_v1"
                    if value["note"]["content"].startswith("NOW_ENCRYPTED_V1:"):
                        value["note"]["content"] = decrypt(value["note"]["content"], t["target_epoch"] - 1)
        semantics[canonical(key)] = value
        if key["kind"] == "note_body":
            output = encrypt(value, t["target_epoch"]).encode()
        else:
            assert "expected_binding" in item, "A2a manifest must specify expected binding"
            binding = item["expected_binding"]
            inner = {"schema_version": 1, "binding": binding, "snapshot": value,
                     "content_origin_kind": "semantic", "semantic_sha256": digest(canonical(value).encode())}
            wrapper = {"schema_version": 1, "kind": "history_envelope_v1", "crypto_epoch": t["target_epoch"],
                       "binding": binding, "ciphertext": encrypt(canonical(inner), t["target_epoch"])}
            if alter:
                alter(wrapper)
            output = json.dumps(wrapper, ensure_ascii=False, indent=1).encode()
        outputs[canonical(key)] = output
        chunks = [output[i:i + SIZE] for i in range(0, len(output), SIZE)]
        for i in reversed(range(len(chunks))):
            b = {**common(s, local, t), "entry_key": key, "source_etag": item["source_etag"], "target_epoch": t["target_epoch"],
                 "chunk_index": i, "total_chunks": len(chunks), "total_bytes": len(output),
                 "chunk_sha256": digest(chunks[i]), "data_base64": base64.b64encode(chunks[i]).decode()}
            r = client.put(ROOT + "/chunks", json=b, headers=s["headers"])
            assert r.status_code == 200, r.text
            assert client.put(ROOT + "/chunks", json=b, headers=s["headers"]).status_code == 200
        seal = {**common(s, local, t), "entry_key": key, "source_etag": item["source_etag"], "target_epoch": t["target_epoch"],
                "total_chunks": len(chunks), "total_bytes": len(output), "ciphertext_sha256": digest(output)}
        r = client.post(ROOT + "/entries/seal", json=seal, headers=s["headers"])
        assert r.status_code == 200, r.text
        assert client.post(ROOT + "/entries/seal", json=seal, headers=s["headers"]).status_code == 200
        downloaded = b""
        for i in range(len(chunks)):
            r = client.get(ROOT + "/staged", params=query(s, local, transition_id=t["transition_id"], kind=key["kind"],
                representation_id=key["id"], slot=key["slot"], source_etag=item["source_etag"], chunk_index=i), headers=s["headers"])
            assert r.status_code == 200, r.text
            assert r.headers["cache-control"] == "no-store"
            downloaded += base64.b64decode(r.json()["data_base64"])
        assert downloaded == output
        records.append({"entry_key": key, "destination_key": item["destination_key"], "source_etag": item["source_etag"],
                        "output_kind": item["output_kind"], "target_epoch": t["target_epoch"],
                        "total_bytes": len(output), "ciphertext_sha256": digest(output)})
    records.sort(key=lambda x: tuple(x["entry_key"][v].encode() for v in ("kind", "id", "slot")))
    return outputs, semantics, digest(canonical(records).encode())


def commit_body(s, local, b, t, verified):
    return {**common(s, local, t), "mutation_id": str(uuid4()), "server_instance_id": b["server_instance_id"],
            "base_head_version": b["base_head_version"], "base_revision_id": b["base_revision_id"],
            "expected_inventory_revision_ids": b["expected_inventory_revision_ids"],
            "expected_history_generation": b["expected_history_generation"], "from_epoch": b["crypto_epoch"],
            "target_epoch": b["target_epoch"], "metadata_manifest_digest": t["manifest_digest"],
            "client_verified_ciphertext_manifest_digest": verified}


def convert(client, s, local, **extra):
    b, t = prepare(client, s, local, **extra)
    items = manifest(client, s, local, t)
    outputs, semantics, verified = stage(client, s, local, t, items)
    cb = commit_body(s, local, b, t, verified)
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 200, r.text
    return cb, r.json(), outputs, semantics


def read_all(client, s, local):
    items, cursor, ctx = [], None, None
    while True:
        params = query(s, local, representation_schema=2, limit=2)
        if cursor:
            params.update({k: v for k, v in ctx.items() if v is not None}, cursor=cursor)
        r = client.get(LIVE, params=params, headers=s["headers"])
        assert r.status_code == 200, r.text
        page = r.json()
        assert page["coverage"]["scope"] == "note_history"
        ctx = page["context"]; items.extend(page["items"]); cursor = page["next_cursor"]
        if not cursor:
            break
    outputs = {}
    for item in items:
        if item["is_null"]:
            assert item["ciphertext_sha256"] is None and item["total_chunks"] == 0
            continue
        data = b""
        key = item["key"]
        for i in range(item["total_chunks"]):
            r = client.get(READ, params=query(s, local, representation_schema=2, **{k: v for k, v in ctx.items() if v is not None}, kind=key["kind"],
                representation_id=key["id"], slot=key["slot"], representation_etag=item["representation_etag"], chunk_index=i), headers=s["headers"])
            assert r.status_code == 200, r.text
            data += base64.b64decode(r.json()["data_base64"])
        assert digest(data) == item["ciphertext_sha256"]
        outputs[canonical(key)] = data
    return ctx, items, outputs


def test_complete_conversion_reconversion_and_current_catalog_recovery(client, subject):
    s, local = subject, "conversion"
    old = seed(client, s, local)
    from app.models.note import Note
    from app.models.note_history import NoteRevision
    before = [(r.id, r.device_id, r.created_at, r.updated_at) for r in s["db"].scalars(select(Note).where(Note.owner_id == s["owner"]))]
    cb1, t1, outputs1, meanings1 = convert(client, s, local)
    assert t1["receipt_matches_current"] is True
    s["db"].expire_all()
    assert [(r.id, r.device_id, r.created_at, r.updated_at) for r in s["db"].scalars(select(Note).where(Note.owner_id == s["owner"]))] == before
    assert len(list(s["db"].scalars(select(NoteRevision).where(NoteRevision.owner_id == s["owner"])))) == 2
    assert client.get("/api/v2/notes/current", params={"owner_id": s["owner"], "local_id": local}, headers=s["headers"]).status_code == 409
    current = client.get("/api/v2/notes/current", params=query(s, local, representation_schema=2), headers=s["headers"])
    assert current.status_code == 200, current.text
    assert decrypt(current.json()["note"]["content"], 1).endswith("second\n")
    protected_write = {**old, "crypto_epoch": 1, "mutation_id": str(uuid4())}
    assert client.put("/api/v2/notes/current", json=protected_write, headers=s["headers"]).status_code == 409
    cb2, t2, outputs2, meanings2 = convert(client, s, local)
    assert meanings1 == meanings2
    replay = client.post(ROOT + "/commit", json=cb1, headers=s["headers"])
    assert replay.status_code == 200, replay.text
    assert replay.json()["receipt"] == t1["receipt"]
    assert replay.json()["current_context"]["crypto_epoch"] == 2
    assert replay.json()["receipt_matches_current"] is False
    state = client.get(ROOT + "/status", params=query(s, local, transition_id=cb1["transition_id"]), headers=s["headers"]).json()
    assert state["receipt"] == t1["receipt"] and state["receipt_matches_current"] is False
    ctx, items, live = read_all(client, s, local)
    assert ctx["crypto_epoch"] == 2 and live == outputs2
    assert any(i["is_null"] and i["key"]["kind"] == "revision_before" for i in items)
    for key, raw in live.items():
        if json.loads(key)["kind"] == "note_body":
            assert decrypt(raw.decode(), 2).endswith("second\n")
        else:
            wrapper = json.loads(raw)
            inner = json.loads(decrypt(wrapper["ciphertext"], 2))
            assert inner["binding"] == wrapper["binding"]
            assert inner["snapshot"] == meanings2[key]
    assert client.post(ROOT + "/commit", json={**cb2, "mutation_id": str(uuid4())}, headers=s["headers"]).status_code == 409


@pytest.mark.parametrize("identity", ["branch_only", "ambiguous", "replicas"])
def test_complete_nonrepresentative_and_reserved_slots(client, subject, identity):
    from app.models.note import Note
    from app.models.note_history import NoteHead
    from app.models.note_v2 import NoteOfflineBranch
    s, local, branch = subject, "all", str(uuid4())
    if identity == "branch_only":
        s["db"].add(NoteHead(owner_id=s["owner"], local_id=local, version=0, identity_state=identity, history_generation=1))
        s["db"].add(NoteOfflineBranch(id=branch, owner_id=s["owner"], local_id=local, origin_device_id="actor",
            snapshot_json=canonical({"schema_version": 1, "note": {"content": "branch"}})))
    else:
        for index in range(2):
            s["db"].add(Note(owner_id=s["owner"], local_id=local, device_id=f"physical{index}",
                note_type="tree" if identity == "ambiguous" and index else "daily", title="raw", content=f"body{index}"))
    s["db"].commit()
    reserved = str(uuid4())
    cb, t, output, _ = convert(client, s, local, local_branches=[{"revision_id": reserved, "parent_ref": None, "origin_device_id": "actor"}])
    ctx, items, live = read_all(client, s, local)
    assert {i["key"]["kind"] for i in items} <= {"note_body", "revision_snapshot", "revision_before", "inventory_snapshot", "offline_snapshot"}
    assert any(i["key"]["id"] == reserved and i["key"]["kind"] == "offline_snapshot" for i in items)
    expected = {canonical({**json.loads(k), "kind": "offline_snapshot"}) if json.loads(k)["kind"] == "reserved_offline_snapshot" else k: v for k, v in output.items()}
    assert expected == live
    r = client.get("/api/v2/notes/current", params=query(s, local, representation_schema=2), headers=s["headers"])
    assert r.status_code == (404 if identity == "branch_only" else 409 if identity == "ambiguous" else 200), r.text


def test_large_entry_chunks_and_staging_fence(client, subject):
    s, local = subject, "large"
    seed(client, s, local, "한\r\n" * 70000)
    b, t = prepare(client, s, local)
    items = manifest(client, s, local, t)
    outputs, _, verified = stage(client, s, local, t, items)
    assert max(map(len, outputs.values())) > SIZE * 2
    assert context(client, s, local)["crypto_epoch"] == 0
    assert client.put("/api/v2/notes/current", json=body(s, local), headers=s["headers"]).status_code == 423
    cb = commit_body(s, local, b, t, verified)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    assert read_all(client, s, local)[2] == outputs


@pytest.mark.parametrize("damage", ["digest", "binding", "incomplete", "sql"])
def test_failure_never_partially_replaces_live(client, subject, damage):
    from app.models.note import Note
    s, local = subject, "rollback"
    seed(client, s, local)
    b, t = prepare(client, s, local)
    items = manifest(client, s, local, t)
    if damage == "binding":
        with pytest.raises(AssertionError, match="422"):
            stage(client, s, local, t, items, alter=lambda w: w["binding"].update(owner_id=s["other"]))
    else:
        outputs, _, verified = stage(client, s, local, t, items[:-1] if damage == "incomplete" else items)
        cb = commit_body(s, local, b, t, "0" * 64 if damage == "digest" else verified)
        def fail(conn, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith("UPDATE NOTE_INVENTORY"):
                raise RuntimeError("synthetic storage failure")
        if damage == "sql":
            event.listen(s["engine"], "before_cursor_execute", fail)
        try:
            r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
            assert r.status_code == (500 if damage == "sql" else 409), r.text
            assert r.headers["cache-control"] == "no-store"
        finally:
            if damage == "sql":
                event.remove(s["engine"], "before_cursor_execute", fail)
    s["db"].expire_all()
    assert all(not r.content.startswith("NOW_ENCRYPTED_V1:") for r in s["db"].scalars(select(Note).where(Note.owner_id == s["owner"])))
    assert context(client, s, local)["crypto_epoch"] == 0


def test_catalog_stale_generation_epoch_and_terminal_stage(client, subject):
    s, local = subject, "stale"
    seed(client, s, local)
    cb, _, _, _ = convert(client, s, local)
    ctx, items, _ = read_all(client, s, local)
    convert(client, s, local)
    item = next(i for i in items if not i["is_null"])
    key = item["key"]
    r = client.get(READ, params=query(s, local, representation_schema=2, **ctx, kind=key["kind"], representation_id=key["id"],
        slot=key["slot"], representation_etag=item["representation_etag"], chunk_index=0), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "crypto_epoch_changed"
    assert client.get(ROOT + "/staged", params=query(s, local, transition_id=cb["transition_id"], kind=key["kind"],
        representation_id=key["id"], slot=key["slot"], source_etag=str(uuid4()), chunk_index=0), headers=s["headers"]).status_code == 409


def test_canonical_js_python_golden_bytes(client, subject):
    # No floats/surrogates: exact UTF-8 and key ordering shared with Web.
    from app.services.note_crypto_storage import canonical_bytes
    value = {"z": "한글\r\n/ 끝\n", "a": [{"slot": "before", "id": "3", "kind": "revision_before"}], "n": 3}
    script = "const v=JSON.parse(process.argv[1]);function c(x){if(Array.isArray(x))return x.map(c);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,c(x[k])]));return x;}process.stdout.write(Buffer.from(JSON.stringify(c(v)),'utf8').toString('hex'));"
    js = subprocess.run(["node", "-e", script, json.dumps(value, ensure_ascii=True)], capture_output=True, text=True, check=True)
    assert canonical_bytes(value).hex() == js.stdout == canonical(value).encode().hex()


def first_chunk(client, s, local, t):
    item = manifest(client, s, local, t)[0]
    raw = b"x" * SIZE
    return {**common(s, local, t), "entry_key": item["key"], "source_etag": item["source_etag"],
            "target_epoch": t["target_epoch"], "chunk_index": 0, "total_chunks": 2, "total_bytes": SIZE + 1,
            "chunk_sha256": digest(raw), "data_base64": base64.b64encode(raw).decode()}


@pytest.mark.parametrize("invalid,status", [
    ({"data_base64": "not base64!"}, 422), ({"chunk_sha256": "0" * 64}, 422),
    ({"chunk_index": 2}, 422), ({"total_chunks": 3}, 422), ({"total_bytes": True}, 422),
    ({"target_epoch": 2}, 409), ({"source_etag": str(uuid4())}, 404),
    ({"entry_key": {"kind": "revision_before", "id": str(uuid4()), "slot": "after"}}, 422),
])
def test_strict_chunk_validation(client, subject, invalid, status):
    s, local = subject, "invalid"
    seed(client, s, local)
    _, t = prepare(client, s, local)
    b = first_chunk(client, s, local, t)
    r = client.put(ROOT + "/chunks", json={**b, **invalid}, headers=s["headers"])
    assert r.status_code == status, r.text
    assert r.headers["cache-control"] == "no-store"


def test_immutable_chunks_incomplete_seal_auth_and_abort(client, subject):
    from app.models.note import UserDevice
    from app.models.note_crypto import NoteCryptoTransition
    from app.services.user_accounts import issue_user_device_access_token
    s, local = subject, "immutable"
    seed(client, s, local)
    _, t = prepare(client, s, local)
    b = first_chunk(client, s, local, t)
    assert client.put(ROOT + "/chunks", json=b, headers=s["headers"]).status_code == 200
    altered = b"z" * SIZE
    r = client.put(ROOT + "/chunks", json={**b, "data_base64": base64.b64encode(altered).decode(), "chunk_sha256": digest(altered)}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "stage_mismatch"
    seal_body = {k: v for k, v in b.items() if k not in ("data_base64", "chunk_index", "chunk_sha256")}
    assert client.post(ROOT + "/entries/seal", json={**seal_body, "ciphertext_sha256": "0" * 64}, headers=s["headers"]).json()["detail"]["code"] == "incomplete_entry"
    assert client.put(ROOT + "/chunks", json=b).status_code == 401
    _, token = issue_user_device_access_token(s["db"], owner_id=s["owner"], device_id="actor2", display_name="synthetic")
    s["db"].commit()
    assert client.put(ROOT + "/chunks", json={**b, "device_id": "actor2"}, headers={"X-Now-User-Token": token}).status_code == 403
    assert client.put(ROOT + "/chunks", json={**b, "owner_id": s["other"]}, headers=s["headers"]).status_code in (401, 403)
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, t["transition_id"]).state == "staging"
    action = {**common(s, local, t), "lease_version": 1}
    assert client.post(ROOT + "/renew", json=action, headers=s["headers"]).status_code == 200
    assert client.post(ROOT + "/abort", json={**action, "lease_version": 2}, headers=s["headers"]).status_code == 200
    assert client.put(ROOT + "/chunks", json=b, headers=s["headers"]).status_code == 409


@pytest.mark.parametrize("state", ["staging", "ready"])
def test_active_states_expire_fence_and_protected_natural_flush(client, subject, state):
    from app.models.note_crypto import NoteCryptoTransition
    from app.models.note import Note
    from fastapi import HTTPException
    s, local = subject, "expire"
    seed(client, s, local)
    b, t = prepare(client, s, local)
    if state == "staging":
        assert client.put(ROOT + "/chunks", json=first_chunk(client, s, local, t), headers=s["headers"]).status_code == 200
    else:
        stage(client, s, local, t, manifest(client, s, local, t))
    with Session(s["engine"]) as db:
        n = db.scalar(select(Note).where(Note.owner_id == s["owner"], Note.local_id == local))
        n.content = "forbidden"
        with pytest.raises(HTTPException) as raised:
            db.commit()
        assert raised.value.status_code == 423
        db.rollback()
    s["db"].expire_all()
    transition = s["db"].get(NoteCryptoTransition, t["transition_id"])
    assert transition.state == state
    transition.expires_at = datetime.utcnow() - timedelta(seconds=1)
    s["db"].commit()
    assert client.put(ROOT + "/chunks", json=first_chunk(client, s, local, t), headers=s["headers"]).status_code == 410
    assert client.get(ROOT + "/status", params=query(s, local, transition_id=t["transition_id"]), headers=s["headers"]).json()["state"] == "expired"
    convert(client, s, local)
    with Session(s["engine"]) as db:
        n = db.scalar(select(Note).where(Note.owner_id == s["owner"], Note.local_id == local))
        n.title = "would make protected history plaintext"
        with pytest.raises(HTTPException) as raised:
            db.commit()
        assert raised.value.status_code == 409
        db.rollback()


def test_current_catalog_generation_cursor_null_and_auth_failures(client, subject):
    from app.models.note_history import NoteHead
    s, local = subject, "catalog"
    seed(client, s, local)
    cb, _, _, _ = convert(client, s, local)
    page = client.get(LIVE, params=query(s, local, representation_schema=2, limit=1), headers=s["headers"]).json()
    ctx = page["context"]
    assert client.get(LIVE, params=query(s, local, representation_schema=2)).status_code == 401
    assert client.get(LIVE, params=query(s, local, representation_schema=2), headers=s["web"]).status_code == 200
    assert client.get(LIVE, params={**query(s, local, representation_schema=2), "owner_id": s["other"]}, headers=s["headers"]).status_code in (401, 403)
    s["db"].expire_all()
    h = s["db"].get(NoteHead, (s["owner"], local))
    h.history_generation += 1
    s["db"].commit()
    r = client.get(LIVE, params=query(s, local, representation_schema=2, cursor=page["next_cursor"], **ctx), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "catalog_changed"
    _, items, _ = read_all(client, s, local)
    null = next(i for i in items if i["is_null"])
    now = client.get(LIVE, params=query(s, local, representation_schema=2), headers=s["headers"]).json()["context"]
    key = null["key"]
    r = client.get(READ, params=query(s, local, representation_schema=2, **now, kind=key["kind"], representation_id=key["id"],
        slot=key["slot"], representation_etag=null["representation_etag"], chunk_index=0), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "null_representation"


@pytest.mark.parametrize("damage", ["bool_epoch", "extra", "plaintext", "duplicate"])
def test_wrapper_strictness_and_live_read_fail_closed(client, subject, damage):
    s, local = subject, "wrapper"
    seed(client, s, local)
    _, t = prepare(client, s, local)
    item = next(i for i in manifest(client, s, local, t) if i["key"]["kind"] != "note_body")
    wrapper = {"schema_version": 1, "kind": "history_envelope_v1", "crypto_epoch": 1,
               "binding": item["expected_binding"], "ciphertext": encrypt("synthetic", 1)}
    if damage == "bool_epoch":
        wrapper["binding"]["crypto_epoch"] = True
    elif damage == "extra":
        wrapper["plaintext"] = "must not accept"
    elif damage == "plaintext":
        wrapper["ciphertext"] = "not encrypted"
    raw = canonical(wrapper).encode()
    if damage == "duplicate":
        raw = b'{"schema_version":0,' + raw[1:]
    b = {**common(s, local, t), "entry_key": item["key"], "source_etag": item["source_etag"], "target_epoch": 1,
         "chunk_index": 0, "total_chunks": 1, "total_bytes": len(raw), "chunk_sha256": digest(raw), "data_base64": base64.b64encode(raw).decode()}
    assert client.put(ROOT + "/chunks", json=b, headers=s["headers"]).status_code == 200
    seal = {k: v for k, v in b.items() if k not in ("data_base64", "chunk_index", "chunk_sha256")}
    r = client.post(ROOT + "/entries/seal", json={**seal, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
    assert r.status_code == 422, r.text


def test_old_cipher_semantic_rule_a_and_typed_revision_reads(client, subject):
    s, local = subject, "oldcipher"
    original = "CRLF\r\n한글  \n"
    seed(client, s, local, encrypt(original, 0), second_content=encrypt(original + "second\n", 0))
    # Both current expressions and history snapshot content start as old ciphers.
    cb, result, outputs, meanings = convert(client, s, local)
    ref = result["receipt"]["head_revision_id"]
    r = client.get("/api/v2/notes/revision", params=query(s, local, representation_schema=2,
        revision_kind="note_revision", revision_id=ref), headers=s["headers"])
    assert r.status_code == 200, r.text
    assert "snapshot" not in r.json()
    wrapper = r.json()["representation"]["envelope"]
    inner = json.loads(decrypt(wrapper["ciphertext"], 1))
    assert original in inner["snapshot"]["note"]["content"]
    assert not inner["snapshot"]["note"]["content"].startswith("NOW_ENCRYPTED_V1:")
    legacy = client.get("/api/v2/notes/revision", params={"owner_id": s["owner"], "local_id": local,
        "revision_kind": "note_revision", "revision_id": ref}, headers=s["headers"])
    assert legacy.status_code == 409


def test_additive_old_inventory_and_transition_schema(client, subject, tmp_path, monkeypatch):
    from sqlalchemy import create_engine, text, inspect
    from sqlalchemy.schema import CreateSchema, DropSchema
    from app import db as database
    from app.models.note import Note
    from app.models.note_history import NoteInventory
    from app.models.note_crypto import NoteCryptoTransition, ServerIdentity
    url = os.environ.get("NOW_E4A1_TEST_POSTGRES_URL")
    schema, admin = None, None
    if url:
        schema = "a2a_schema_" + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as conn:
            conn.execute(CreateSchema(schema))
        engine = create_engine(url, connect_args={"options": "-c search_path=" + schema})
    else:
        engine = create_engine(f"sqlite:///{(tmp_path / 'old_a2a.db').as_posix()}")
    try:
        database.Base.metadata.create_all(engine)
        with engine.begin() as conn:
            conn.execute(Note.__table__.insert().values(id=42, owner_id="synthetic", device_id="physical",
                local_id="raw", note_type="daily", title="raw", content="preserve source", created_at=datetime(2026, 1, 1),
                updated_at=datetime(2026, 1, 2)))
            conn.execute(NoteInventory.__table__.insert().values(owner_id="synthetic", local_id="raw", note_id=42,
                revision_id=str(uuid4()), snapshot_json="exact original bytes\r\n"))
            conn.execute(NoteCryptoTransition.__table__.insert().values(id=str(uuid4()), owner_id="synthetic", local_id="raw",
                mutation_id=str(uuid4()), actor_device_id="actor", conditions_json="{}", manifest_digest="a" * 64,
                state="prepared", lease_version=1, expires_at=datetime(2026, 1, 1), created_at=datetime(2026, 1, 1)))
            for column in ("representation_kind", "representation_epoch"):
                conn.execute(text("ALTER TABLE note_inventory DROP COLUMN " + column))
            for column in ("commit_conditions_json", "receipt_json"):
                conn.execute(text("ALTER TABLE note_crypto_transitions DROP COLUMN " + column))
            conn.execute(text("ALTER TABLE note_crypto_entries DROP COLUMN binding_json"))
        monkeypatch.setattr(database, "engine", engine)
        database.create_tables()
        database.create_tables()
        with Session(engine) as db:
            n = db.get(Note, 42)
            assert n.content == "preserve source" and n.device_id == "physical" and n.updated_at == datetime(2026, 1, 2)
            inv = db.get(NoteInventory, ("synthetic", "raw", 42))
            assert inv.snapshot_json == "exact original bytes\r\n" and inv.representation_epoch == 0
            assert inv.representation_kind == "snapshot_v1"
            row = db.scalar(select(NoteCryptoTransition))
            assert row.conditions_json == "{}" and row.commit_conditions_json is None and row.receipt_json is None
            assert db.get(ServerIdentity, 1).instance_id
        assert set(inspect(engine).get_table_names()) >= {"note_crypto_uploads", "note_crypto_chunks"}
    finally:
        engine.dispose()
        if admin:
            with admin.begin() as conn:
                conn.execute(DropSchema(schema, cascade=True))
            admin.dispose()


def test_terminal_manifest_binding_is_frozen_metadata(client, subject):
    from app.models.note_history import NoteHead, NoteInventory, NoteRevision
    s, local = subject, "metadata"
    seed(client, s, local)
    b, t = prepare(client, s, local)
    original = manifest(client, s, local, t)
    inv_key = next(i for i in original if i["key"]["kind"] == "inventory_snapshot")["key"]
    expected = next(i for i in original if i["key"] == inv_key)["expected_binding"]
    assert client.post(ROOT + "/abort", json={**common(s, local, t), "lease_version": 1}, headers=s["headers"]).status_code == 200
    s["db"].expire_all()
    inv = s["db"].get(NoteInventory, (s["owner"], local, int(inv_key["id"])))
    revisions = list(s["db"].scalars(select(NoteRevision).where(NoteRevision.owner_id == s["owner"], NoteRevision.local_id == local)))
    other = next(r for r in revisions if r.id != inv.revision_id)
    inv.revision_id = other.id
    s["db"].get(NoteHead, (s["owner"], local)).head_revision_id = other.id
    s["db"].commit()
    again = manifest(client, s, local, t)
    assert next(i for i in again if i["key"] == inv_key)["expected_binding"] == expected


def test_storage_full_is_safe_507(client, subject):
    import sqlite3
    from sqlalchemy.exc import OperationalError
    s, local = subject, "full"
    seed(client, s, local)
    _, t = prepare(client, s, local)
    b = first_chunk(client, s, local, t)
    def fail(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("INSERT INTO NOTE_CRYPTO_CHUNKS"):
            err = sqlite3.OperationalError("synthetic storage full")
            err.sqlite_errorcode = 13
            raise OperationalError("synthetic", {}, err)
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.put(ROOT + "/chunks", json=b, headers=s["headers"])
        assert r.status_code == 507 and r.json()["detail"]["code"] == "storage_full", r.text
        assert "synthetic" not in r.text and r.headers["cache-control"] == "no-store"
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)


def test_prepare_manifest_explicit_null_before_metadata(client, subject):
    s, local = subject, "nullbefore"
    seed(client, s, local, content="", second_content="")
    b, t = prepare(client, s, local)
    r = client.get(ROOT + "/manifest", params=query(s, local, transition_id=t["transition_id"], limit=500), headers=s["headers"])
    page = r.json()
    assert page["null_count"] == 1
    assert len(page["null_slots"]) == 1
    item = page["null_slots"][0]
    assert item["key"]["kind"] == "revision_before" and item["key"]["slot"] == "before" and item["is_null"] is True
    assert item["key"] not in [i["key"] for i in page["items"]]
    assert t["expected_count"] == len(page["items"])
    core_items = [{k: i[k] for k in ("key", "source_etag", "source_kind", "output_kind", "representation_epoch")} for i in page["items"]]
    core_items.sort(key=lambda i: canonical(i["key"]))
    assert digest(canonical(core_items).encode()) == page["manifest_digest"] == t["manifest_digest"]
    outputs, meanings, verified = stage(client, s, local, t, page["items"])
    assert all((v if isinstance(v, str) else v["note"]["content"]) == "" for v in meanings.values())
    ready = client.get(ROOT + "/status", params=query(s, local, transition_id=t["transition_id"]), headers=s["headers"]).json()
    assert ready["state"] == "ready" and ready["sealed_entries"] == len(page["items"])
    cb = commit_body(s, local, b, t, verified)
    result = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert result.status_code == 200, result.text
    assert sum(result.json()["receipt"]["expected_counts"].values()) == len(page["items"])
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).json()["receipt"] == result.json()["receipt"]
    _, live_items, live_bytes = read_all(client, s, local)
    assert sum(i["is_null"] for i in live_items) == 1 and live_bytes == outputs
