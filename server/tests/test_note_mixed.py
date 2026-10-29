"""M1 actual auth/storage with synthetic ciphertext, never a Provider call."""
import json
import base64
import os
from contextlib import contextmanager
from uuid import uuid4

from sqlalchemy import inspect, text
from sqlalchemy import create_engine, select, event
from sqlalchemy.schema import CreateSchema, DropSchema
from sqlalchemy.engine import make_url
import pytest

from .test_note_crypto import subject, query
from .test_note_crypto_conversion import seed, convert, read_all

MR = "/api/v2/notes/mixed-representations"


def text_values(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from text_values(item)
    elif isinstance(value, list):
        for item in value:
            yield from text_values(item)


def mcontext(client, s, local):
    from .test_note_crypto import context
    old = context(client, s, local)
    a = query(s, local, schema_version=3, server_instance_id=old["server_instance_id"])
    r = client.get(MR + "/context", params=a, headers=s["headers"])
    assert r.status_code == 200, r.text
    return a, r.json()


def rq(a, c):
    from .test_note_crypto_conversion import canonical
    return {**a, "expected_context": base64.urlsafe_b64encode(canonical(c["context"]).encode()).decode().rstrip("="),
            "catalog_digest": c["catalog_digest"]}


def cp_request(client, s, local):
    a, c = mcontext(client, s, local)
    r = client.get(MR + "/current", params=rq(a, c), headers=s["headers"])
    assert r.status_code == 200, r.text
    current = r.json()
    drain = client.post("/api/v2/notes/related-drains", json={"schema_version": 2, **query(s, local),
        "server_instance_id": a["server_instance_id"], "mutation_id": str(uuid4()),
        "crypto_epoch": c["context"]["base"]["crypto_epoch"], "expected_history_generation": c["context"]["base"]["history_generation"]}, headers=s["headers"])
    assert drain.status_code == 201 and drain.json()["state"] == "ready", drain.text
    return {**a, "mutation_id": str(uuid4()), "base": c["context"], "expected_catalog_digest": c["catalog_digest"],
        "selection": {"physical_note_id": c["context"]["selected_physical_note_id"], "inventory_revision_ref": current["head_revision_ref"],
            "note_representation_etag": current["note_body_metadata"]["representation_etag"],
            "inventory_representation_etag": current["current_representation"]["descriptor"]["representation_etag"]},
        "replica_policy": "selected_head_only", "target_current_mode": "plain",
        "drain_ref": {"drain_id": drain.json()["drain_id"], "drain_version": drain.json()["drain_version"]}}


def operation_query(a, op):
    return {**a, "operation_id": op["operation_id"]}


def operation_manifest(client, s, a, op, prefix):
    m = dict(op["metadata_header"])
    for section in ("S", "DSET", "P", "O"):
        entries, cursor = [], None
        while True:
            r = client.get(prefix + "/manifest", params={**operation_query(a, op), "metadata_manifest_digest": op["metadata_manifest_digest"],
                "section": section, "limit": 2, **({"cursor": cursor} if cursor else {})}, headers=s["headers"])
            assert r.status_code == 200, r.text
            entries.extend(r.json()["entries"]); cursor = r.json()["next_cursor"]
            if cursor is None:
                break
        m[section] = entries
    from .test_note_crypto_conversion import digest, canonical
    assert digest(canonical(m).encode()) == op["metadata_manifest_digest"]
    return m


def test_cp_commit_preserves_old_cipher_and_exact_full15(client, subject, monkeypatch):
    from app.core import capabilities
    from .test_note_crypto_conversion import decrypt, encrypt, canonical, digest
    monkeypatch.setattr(capabilities, "MIXED_MUTATIONS_ENABLED", True, raising=False)
    s, local = subject, "m1-cp-commit"
    seed(client, s, local); convert(client, s, local)
    _, old_items, old_raw = read_all(client, s, local)
    body = cp_request(client, s, local)
    a = {k: body[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    prefix = "/api/v2/notes/current-plain"
    r = client.post(prefix + "/quote", json=body, headers=s["headers"])
    assert r.status_code == 201, r.text
    op = r.json(); m = operation_manifest(client, s, a, op, prefix)
    before = next(d for d in m["DSET"] if d["destination_key"]["kind"] == "revision_before")
    source = json.loads(old_raw[canonical(before["source_keys"][0])])
    inner = json.loads(decrypt(source["ciphertext"], 1))
    snapshot = inner["snapshot"]
    inner["binding"] = before["expected_binding"]
    raw = canonical({"schema_version": 1, "kind": "history_envelope_v1", "crypto_epoch": 1,
        "binding": before["expected_binding"], "ciphertext": encrypt(canonical(inner), 1)}).encode()
    b = {**operation_query(a, op), "metadata_manifest_digest": op["metadata_manifest_digest"], "entry_key": before["destination_key"],
        "source_etag": before["source_etag"], "target_epoch": 1, "total_chunks": 1, "total_bytes": len(raw)}
    r = client.put(prefix + "/chunks", json={**b, "chunk_index": 0, "chunk_sha256": digest(raw), "data_base64": base64.b64encode(raw).decode()}, headers=s["headers"])
    assert r.status_code == 200, r.text
    r = client.post(prefix + "/entries/seal", json={**b, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
    assert r.status_code == 200, r.text
    records = [{"entry_key": before["destination_key"], "destination_key": before["destination_key"], "source_etag": before["source_etag"],
        "output_kind": before["output_kind"], "target_epoch": 1, "total_bytes": len(raw), "ciphertext_sha256": digest(raw)}]
    commit = {**operation_query(a, op), "mutation_id": body["mutation_id"], "lease_version": op["lease_version"], "base": body["base"],
        "metadata_manifest_digest": op["metadata_manifest_digest"], "client_verified_ciphertext_manifest_digest": digest(canonical(records).encode()),
        "client_decryption_verified": True, "plain_current": snapshot["note"]}
    r = client.post(prefix + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    receipt = r.json()
    assert receipt["receipt"]["result"]["current_mode"] == "plain" and receipt["receipt"]["result"]["base"]["crypto_epoch"] == 1
    assert client.post(prefix + "/commit", json=commit, headers=s["headers"]).json() == receipt
    from app.models.note import Note
    from app.models.note_history import NoteRevision
    s["db"].expire_all()
    note = s["db"].get(Note, body["selection"]["physical_note_id"])
    assert note.content == snapshot["note"]["content"]
    new = s["db"].get(NoteRevision, m["revision_ref"]["id"])
    assert json.loads(new.snapshot_json) == snapshot and json.loads(new.before_snapshot_json)["ciphertext"] == json.loads(raw)["ciphertext"]
    for d in m["P"]:
        if d["key"]["kind"] in ("revision_snapshot", "revision_before"):
            row = s["db"].get(NoteRevision, d["key"]["id"])
            actual = row.snapshot_json if d["key"]["slot"] == "after" else row.before_snapshot_json
            assert actual is None if d["is_null"] else actual.encode() == old_raw[canonical(d["key"])]
    assert all(snapshot["note"]["content"] not in value for value in text_values(receipt))
    a, c = mcontext(client, s, local)
    r = client.get(MR + "/current", params=rq(a, c), headers=s["headers"])
    assert r.status_code == 200 and r.json()["current_representation"]["snapshot"] == snapshot, r.text
    assert r.json()["current_representation"]["operation_origin"]["purpose"] == "current_plain_transition"
    r = client.get("/api/v2/notes/current", params=query(s, local, representation_schema=2), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "mixed_representation_requires_upgrade", r.text
    # RC must accept mixed source epochs without weakening historical bindings.
    rc = cp_request_conversion(client, s, local)
    r = client.post("/api/v2/notes/mixed-conversions/prepare", json=rc, headers=s["headers"])
    assert r.status_code == 201, r.text
    rc_op = r.json()
    prefix_rc = "/api/v2/notes/mixed-conversions"
    rm = operation_manifest(client, s, a, rc_op, prefix_rc)
    # The plain mode revision retains its semantic operation when re-encrypted.
    origins = {op["operation_id"]: {"purpose": "current_plain_transition", "operation_id": op["operation_id"],
        "mutation_id": body["mutation_id"], "source_inventory_ref": body["selection"]["inventory_revision_ref"],
        "selected_physical_note_id": body["selection"]["physical_note_id"], "target_current_mode": "plain"}}
    verified, semantics = stage_mixed(client, s, a, rc_op, rm, prefix_rc, origins)
    rc_commit = {**operation_query(a, rc_op), "mutation_id": rc["mutation_id"], "lease_version": rc_op["lease_version"],
        "base": rc["base"], "target_epoch": 2, "metadata_manifest_digest": rc_op["metadata_manifest_digest"],
        "client_verified_ciphertext_manifest_digest": verified, "client_decryption_verified": True}
    r = client.post(prefix_rc + "/commit", json=rc_commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["receipt"]["result"]["base"]["crypto_epoch"] == 2
    a, c = mcontext(client, s, local)
    r = client.get(MR + "/current", params=rq(a, c), headers=s["headers"])
    assert r.status_code == 200, r.text
    assert decrypt(r.json()["note"]["content"], 2) == snapshot["note"]["content"]
    assert client.post(prefix + "/commit", json=commit, headers=s["headers"]).json()["detail"]["code"] == "replay_payload_requires_status"
    r = client.get(prefix + "/status", params=operation_query(a, op), headers=s["headers"])
    assert r.status_code == 200 and r.json()["receipt"] == receipt["receipt"] and not r.json()["receipt_matches_current"]


def stage_mixed(client, s, a, op, m, prefix, origins=None, pending=None):
    from .test_note_crypto_conversion import canonical, digest, decrypt, encrypt, SIZE
    origins = origins or {}
    pending = pending or {}
    source_by_key = {canonical(v["descriptor"]["key"]): v for v in m["S"]}
    records, semantics = [], {}
    for d in m["DSET"]:
        if d["is_null"] or d["output_epoch"] == 0:
            continue
        source_key = d["source_keys"][0]
        src = source_by_key.get(canonical(source_key))
        if src is None:
            assert source_key["kind"] == "reserved_offline_snapshot" and source_key["id"] in pending
            sd = {"key": source_key, "representation_epoch": 0, "semantic_origin_id": None}
            src = {"descriptor": sd, "source_etag": d["source_etag"]}
        sd = src["descriptor"]; k = sd["key"]
        downloaded, index = b"", 0
        while True:
            r = client.get(prefix + "/source", params={**operation_query(a, op), "metadata_manifest_digest": op["metadata_manifest_digest"],
                "kind": k["kind"], "representation_id": k["id"], "slot": k["slot"], "source_etag": src["source_etag"], "chunk_index": index}, headers=s["headers"])
            if k["kind"] == "reserved_offline_snapshot":
                assert r.status_code == 404 and r.json()["detail"]["code"] == "source_not_on_server", r.text
                downloaded = canonical(pending[k["id"]]).encode()
                break
            assert r.status_code == 200, r.text
            downloaded += base64.b64decode(r.json()["data_base64"])
            index += 1
            if index == r.json()["total_chunks"]:
                break
        origin = origins.get(sd["semantic_origin_id"])
        if k["kind"] == "note_body":
            value = decrypt(downloaded.decode(), sd["representation_epoch"]) if sd["representation_epoch"] else downloaded.decode()
            raw = encrypt(value, d["output_epoch"]).encode()
        else:
            old = json.loads(downloaded)
            if sd["representation_epoch"]:
                inner = json.loads(decrypt(old["ciphertext"], sd["representation_epoch"]))
                value, origin = inner.get("snapshot", inner.get("value")), inner.get("origin")
                assert old["binding"] == sd["expected_binding"] == inner["binding"]
                plain = value.encode() if sd["representation_kind"] == "linked_text_envelope_v1" else canonical(value).encode()
                assert inner["semantic_sha256"] == digest(plain)
            else:
                assert sd["semantic_origin_id"] is None or sd["semantic_origin_id"] in origins
                value = old
            inner = {"schema_version": 1, "binding": d["expected_binding"], "origin": origin,
                "semantic_sha256": digest(canonical(value).encode()), "content_origin_kind": "semantic", "snapshot": value}
            if d["output_kind"] == "linked_text_envelope_v1":
                inner = {"schema_version": 1, "binding": d["expected_binding"], "value": value,
                    "semantic_sha256": digest(value.encode())}
            raw = canonical({"schema_version": 1, "kind": d["output_kind"], "crypto_epoch": d["output_epoch"],
                "binding": d["expected_binding"], "ciphertext": encrypt(canonical(inner), d["output_epoch"])}).encode()
        semantics[canonical(d["destination_key"])] = value
        chunks = [raw[i:i + SIZE] for i in range(0, len(raw), SIZE)]
        b = {**operation_query(a, op), "metadata_manifest_digest": op["metadata_manifest_digest"], "entry_key": d["destination_key"],
            "source_etag": d["source_etag"], "target_epoch": d["output_epoch"], "total_chunks": len(chunks), "total_bytes": len(raw)}
        for i in reversed(range(len(chunks))):
            r = client.put(prefix + "/chunks", json={**b, "chunk_index": i, "chunk_sha256": digest(chunks[i]), "data_base64": base64.b64encode(chunks[i]).decode()}, headers=s["headers"])
            assert r.status_code == 200, r.text
        r = client.post(prefix + "/entries/seal", json={**b, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
        assert r.status_code == 200, r.text
        received = b""
        for i in range(len(chunks)):
            r = client.get(prefix + "/staged", params={**operation_query(a, op), "metadata_manifest_digest": op["metadata_manifest_digest"],
                "kind": d["destination_key"]["kind"], "representation_id": d["destination_key"]["id"], "slot": d["destination_key"]["slot"],
                "source_etag": d["source_etag"], "target_epoch": d["output_epoch"], "chunk_index": i}, headers=s["headers"])
            assert r.status_code == 200, r.text
            received += base64.b64decode(r.json()["data_base64"])
        assert received == raw
        records.append({"entry_key": d["destination_key"], "destination_key": d["destination_key"], "source_etag": d["source_etag"],
            "output_kind": d["output_kind"], "target_epoch": d["output_epoch"], "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    return digest(canonical(records).encode()), semantics


def ready_cp(client, s, local):
    from .test_note_crypto_conversion import canonical
    body = cp_request(client, s, local)
    a = {k: body[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    prefix = "/api/v2/notes/current-plain"
    r = client.post(prefix + "/quote", json=body, headers=s["headers"])
    assert r.status_code == 201, r.text
    op = r.json(); m = operation_manifest(client, s, a, op, prefix)
    verified, values = stage_mixed(client, s, a, op, m, prefix)
    before = next(d for d in m["DSET"] if d["destination_key"]["kind"] == "revision_before")
    commit = {**operation_query(a, op), "mutation_id": body["mutation_id"], "lease_version": op["lease_version"], "base": body["base"],
        "metadata_manifest_digest": op["metadata_manifest_digest"], "client_verified_ciphertext_manifest_digest": verified,
        "client_decryption_verified": True, "plain_current": values[canonical(before["destination_key"])]["note"]}
    return a, op, m, commit


def live_rows(s, local):
    from app.models.note import Note, AnalysisJob, Recording
    from app.models.note_history import NoteHead, NoteRevision, NoteInventory
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_mixed import MixedScope, MixedSlot
    from app.models.note_crypto import NoteRepresentationOrigin
    from app.models.note_related import LinkedText
    from app.models.protected_analysis import ProtectedAnalysisClaim
    result = []
    with s["engine"].connect() as conn:
        for model in (Note, NoteHead, NoteRevision, NoteInventory, NoteOfflineBranch, MixedScope, MixedSlot,
            NoteRepresentationOrigin, LinkedText, AnalysisJob, Recording, ProtectedAnalysisClaim):
            t = model.__table__
            lk = t.c.local_id if "local_id" in t.c and model not in (Recording,) else t.c.note_local_id
            rows = conn.execute(select(t).where(t.c.owner_id == s["owner"], lk == local).order_by(*t.primary_key.columns))
            result.append([tuple(row) for row in rows])
    return result


@pytest.fixture
def enabled(monkeypatch):
    from app.core import capabilities
    monkeypatch.setattr(capabilities, "MIXED_MUTATIONS_ENABLED", True)


@pytest.mark.parametrize("boundary", ["update notes", "insert into note_revisions", "update note_inventory",
    "insert into note_representation_origins", "update note_mixed_slots", "update note_heads", "update note_crypto_transitions"])
def test_cp_every_sql_boundary_rolls_back_live_and_keeps_stage(client, subject, enabled, boundary):
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoUpload
    from app.services.note_crypto_storage import assembled
    s, local = subject, "m1-rollback"
    seed(client, s, local); convert(client, s, local)
    a, op, m, commit = ready_cp(client, s, local)
    before, fired = live_rows(s, local), []
    def fail(conn, cursor, statement, parameters, context, many):
        if statement.lower().startswith(boundary):
            fired.append(True); raise RuntimeError("synthetic M1 publication failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post("/api/v2/notes/current-plain/commit", json=commit, headers=s["headers"])
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    assert r.status_code == 500 and fired, r.text
    assert live_rows(s, local) == before
    s["db"].expire_all()
    row = s["db"].get(NoteCryptoTransition, op["operation_id"])
    assert row.state == "ready" and row.receipt_json is None
    stage = s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == row.id))
    assert assembled(s["db"], stage)
    r = client.post("/api/v2/notes/current-plain/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text


def test_expired_commit_settles_only_own_fence_and_keeps_cipher(client, subject, enabled):
    from datetime import datetime, timedelta
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence, NoteCryptoUpload
    s, local = subject, "m1-expiry"
    seed(client, s, local); convert(client, s, local)
    a, op, m, commit = ready_cp(client, s, local)
    row = s["db"].get(NoteCryptoTransition, op["operation_id"])
    row.expires_at = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    before = live_rows(s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=commit, headers=s["headers"])
    assert r.status_code == 410, r.text
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, row.id).state == "expired"
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None
    assert s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == row.id)) is not None
    assert live_rows(s, local) == before


@pytest.mark.parametrize("nulls", [False, True])
def test_rc_related_only_preserves_exact_linked_values_and_nulls(client, subject, enabled, nulls):
    from .test_related_text import related, prepare, stage, ROOT
    from app.models.note import AnalysisJob
    from .test_note_crypto_conversion import decrypt
    s, local = subject, "m1-related-only"
    ident, original = related(client, s, local, nulls=nulls)
    b, t, _ = prepare(client, s, local)
    cb, _, values = stage(client, s, local, b, t)
    r = client.post(ROOT + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 200, r.text
    rc = cp_request_conversion(client, s, local)
    a = {k: rc[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    prefix = "/api/v2/notes/mixed-conversions"
    r = client.post(prefix + "/prepare", json=rc, headers=s["headers"])
    assert r.status_code == 201, r.text
    op = r.json(); m = operation_manifest(client, s, a, op, prefix)
    verified, semantics = stage_mixed(client, s, a, op, m, prefix)
    commit = {**operation_query(a, op), "mutation_id": rc["mutation_id"], "lease_version": op["lease_version"], "base": rc["base"],
        "target_epoch": 2, "metadata_manifest_digest": op["metadata_manifest_digest"],
        "client_verified_ciphertext_manifest_digest": verified, "client_decryption_verified": True}
    r = client.post(prefix + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all(); job = s["db"].get(AnalysisJob, ident)
    for field in ("input_text", "result_json", "error_message"):
        raw = getattr(job, field)
        assert raw is None if nulls else json.loads(decrypt(json.loads(raw)["ciphertext"], 2))["value"] == original[field]
    assert job.created_at.isoformat() == original["created_at"].rstrip("Z")
    assert job.updated_at.isoformat() == original["updated_at"].rstrip("Z")
    # A fresh drain and repeated startup must still validate the rotated linked metadata.
    a, c = mcontext(client, s, local)
    cp_request_conversion(client, s, local)
    from app.services.note_mixed_metadata import initialize
    with s["engine"].begin() as conn:
        initialize(conn)


@pytest.mark.parametrize("damage", ["scope", "schema", "origin", "slot"])
def test_positive_classification_loss_is_never_repaired(client, subject, damage):
    s, local = subject, "m1-loss"
    seed(client, s, local); convert(client, s, local)
    from app.models.note_mixed import MixedSchema, MixedScope, MixedSlot
    from app.models.note_crypto import NoteRepresentationOrigin
    model = {"scope": MixedScope, "schema": MixedSchema, "origin": NoteRepresentationOrigin, "slot": MixedSlot}[damage]
    child_rows = []
    with s["engine"].begin() as conn:
        table = model.__table__
        conditions = []
        if "owner_id" in table.c:
            conditions.append(table.c.owner_id == s["owner"])
        if damage in ("slot", "origin"):
            first = conn.execute(select(table).where(table.c.owner_id == s["owner"])).first()
            conditions.append(table.c.key_json == first._mapping["key_json"])
        saved = [dict(r) for r in conn.execute(select(table).where(*conditions)).mappings()]
        # PostgreSQL removes this fixture's children first; restore every removed QA row below.
        if damage == "scope" and s["engine"].dialect.name == "postgresql":
            child_rows = [dict(r) for r in conn.execute(select(MixedSlot.__table__).where(MixedSlot.owner_id == s["owner"])).mappings()]
            conn.execute(MixedSlot.__table__.delete().where(MixedSlot.owner_id == s["owner"]))
        conn.execute(table.delete().where(*conditions))
    from app.services.note_mixed_metadata import initialize
    try:
        with s["engine"].begin() as conn, pytest.raises(Exception, match="inconsistent_history"):
            initialize(conn)
    finally:
        with s["engine"].begin() as conn:
            conn.execute(table.insert(), saved)
            if child_rows:
                conn.execute(MixedSlot.__table__.insert(), child_rows)


@pytest.mark.parametrize("field", ["metadata", "cipher_digest", "base_mode", "base_generation", "projection", "flag", "unknown"])
def test_cp_invalid_commit_never_changes_live_or_cipher(client, subject, enabled, field):
    import copy
    s, local = subject, "m1-invalid"
    seed(client, s, local); convert(client, s, local)
    a, op, m, original = ready_cp(client, s, local)
    body = copy.deepcopy(original)
    if field == "metadata":
        body["metadata_manifest_digest"] = "0" * 64
    elif field == "cipher_digest":
        body["client_verified_ciphertext_manifest_digest"] = "0" * 64
    elif field == "base_mode":
        body["base"]["current_mode"] = "plain"
    elif field == "base_generation":
        body["base"]["base"]["history_generation"] += 1
    elif field == "projection":
        body["plain_current"]["title"] = "changed title"
    elif field == "flag":
        body["client_decryption_verified"] = 1
    else:
        body["unexpected"] = True
    before = live_rows(s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
    assert r.status_code in (409, 422), r.text
    assert live_rows(s, local) == before
    assert client.post("/api/v2/notes/current-plain/commit", json=original, headers=s["headers"]).status_code == 200


def test_cp_selected_physical_only_and_plain_etag_not_plain_hash(client, subject, enabled):
    from datetime import datetime
    from app.models.note import Note
    from .test_note_crypto_conversion import digest
    s, local = subject, "m1-physical"
    for i in range(2):
        s["db"].add(Note(owner_id=s["owner"], device_id="physical" + str(i), local_id=local, note_type="daily", title="raw",
            content="physical " + str(i), client_updated_at=datetime(2050 + i, 1, 1), created_at=datetime(2020, 1, 1), updated_at=datetime(2021, 1, 1)))
    s["db"].commit(); convert(client, s, local)
    s["db"].expire_all()
    notes = list(s["db"].scalars(select(Note).where(Note.owner_id == s["owner"]).order_by(Note.id)))
    untouched = tuple(getattr(notes[0], c.name) for c in Note.__table__.columns)
    times = (notes[1].created_at, notes[1].updated_at, notes[1].client_updated_at, notes[1].device_id)
    a, op, m, body = ready_cp(client, s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all()
    assert tuple(getattr(s["db"].get(Note, notes[0].id), c.name) for c in Note.__table__.columns) == untouched
    changed = s["db"].get(Note, notes[1].id)
    assert (changed.created_at, changed.updated_at, changed.client_updated_at, changed.device_id) == times
    a, c = mcontext(client, s, local)
    d = client.get(MR + "/current", params=rq(a, c), headers=s["headers"]).json()["note_body_metadata"]
    assert d["representation_epoch"] == 0 and d["ciphertext_sha256"] is None and len(d["representation_etag"]) == 36
    assert digest(body["plain_current"]["content"].encode()) not in json.dumps(c)


def test_cp_preserves_original_c2_status_terminal_bundle_and_storage_receipt(client, subject, enabled):
    from .test_protected_analysis import prepared, upload, PA
    from app.models.protected_analysis import ProtectedAnalysisClaim
    from app.models.note import AnalysisJob
    s, local = subject, "m1-c2"
    original, intent, bm, raws = prepared(client, s, local)
    stored_body = upload(client, s, local, PA, original, intent, raws)
    r = client.post(PA + "/commit", json=stored_body, headers=s["headers"])
    assert r.status_code == 200, r.text
    storage_receipt = r.json()["receipt"]
    s["db"].expire_all()
    claim = s["db"].get(ProtectedAnalysisClaim, original["execution_id"])
    terminal, conditions = claim.progress_json, claim.conditions_json
    job = s["db"].get(AnalysisJob, bm["original_job_id"])
    values = (job.input_text, job.result_json, job.error_message, job.created_at, job.updated_at)
    a, op, m, commit = ready_cp(client, s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    status_args = {**query(s, local), "server_instance_id": a["server_instance_id"], "execution_id": original["execution_id"]}
    r = client.get(PA + "/claims/status", params=status_args, headers=s["headers"])
    assert r.status_code == 200, r.text
    old_status = r.json()
    assert old_status["source_context"] == json.loads(conditions)["request"]["source_context"]
    assert not old_status["source_matches_current"] and old_status["terminal_receipt"] == json.loads(terminal)["terminal_receipt"]
    assert client.post(PA + "/commit", json=stored_body, headers=s["headers"]).json()["receipt"] == storage_receipt
    new_claim = {**json.loads(conditions)["request"], "mutation_id": str(uuid4())}
    r = client.post(PA + "/claims", json=new_claim, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "mixed_representation_requires_upgrade", r.text
    s["db"].expire_all()
    claim = s["db"].get(ProtectedAnalysisClaim, original["execution_id"])
    assert claim.progress_json == terminal and claim.conditions_json == conditions
    job = s["db"].get(AnalysisJob, bm["original_job_id"])
    assert (job.input_text, job.result_json, job.error_message, job.created_at, job.updated_at) == values


def test_late_revision_uuid_collision_is_terminal_without_partial_plain_publication(client, subject, enabled):
    from datetime import datetime
    from app.models.note_history import NoteRevision
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence, NoteCryptoUpload
    s, local = subject, "m1-late-id"
    seed(client, s, local); convert(client, s, local)
    a, op, m, body = ready_cp(client, s, local)
    with s["engine"].begin() as conn:
        conn.execute(NoteRevision.__table__.insert().values(id=m["revision_ref"]["id"], owner_id=s["other"], local_id="synthetic-occupier",
            note_id=999, parent_revision_id=None, reason="synthetic", captured_at=datetime(2000, 1, 1), snapshot_json='{"synthetic":true}', representation_kind="snapshot_v1", representation_epoch=0))
    before = live_rows(s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "revision_id_conflict", r.text
    assert live_rows(s, local) == before
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, op["operation_id"]).state == "stale"
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None
    assert s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == op["operation_id"])) is not None


@pytest.mark.parametrize("terminal", ["committed", "aborted"])
def test_unique_rollback_gap_preserves_other_transaction_terminal(client, subject, enabled, terminal):
    from datetime import datetime
    from sqlalchemy.orm import Session
    from app.models.note_history import NoteRevision
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "m1-rollback-gap"
    seed(client, s, local); convert(client, s, local)
    a, op, m, body = ready_cp(client, s, local)
    with s["engine"].begin() as conn:
        conn.execute(NoteRevision.__table__.insert().values(id=m["revision_ref"]["id"], owner_id=s["other"], local_id="gap-occupier",
            note_id=999, reason="synthetic", captured_at=datetime(2000, 1, 1), snapshot_json="{}", representation_kind="snapshot_v1", representation_epoch=0))
    fired, other = [], []
    def interleave(db, previous):
        if fired or previous.parent is not None or db.get_bind() is not s["engine"]:
            return
        fired.append(True)
        with s["engine"].begin() as conn:
            conn.execute(NoteRevision.__table__.delete().where(NoteRevision.id == m["revision_ref"]["id"], NoteRevision.owner_id == s["other"]))
        if terminal == "committed":
            r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
        else:
            r = client.post("/api/v2/notes/current-plain/abort", json={**operation_query(a, op), "lease_version": op["lease_version"]}, headers=s["headers"])
        assert r.status_code == 200, r.text
        other.append(r.json())
    event.listen(Session, "after_soft_rollback", interleave)
    try:
        r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
    finally:
        event.remove(Session, "after_soft_rollback", interleave)
    assert fired and other
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, op["operation_id"]).state == terminal
    if terminal == "committed":
        assert r.status_code == 200 and r.json()["receipt"] == other[0]["receipt"], r.text
    else:
        assert r.status_code == 409 and r.json()["operation"]["state"] == "aborted", r.text


def ready_rc(client, s, local, origins=None):
    request = cp_request_conversion(client, s, local)
    a = {k: request[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    prefix = "/api/v2/notes/mixed-conversions"
    r = client.post(prefix + "/prepare", json=request, headers=s["headers"])
    assert r.status_code == 201, r.text
    op = r.json(); m = operation_manifest(client, s, a, op, prefix)
    verified, semantics = stage_mixed(client, s, a, op, m, prefix, origins=origins)
    commit = {**operation_query(a, op), "mutation_id": request["mutation_id"], "lease_version": op["lease_version"], "base": request["base"],
        "target_epoch": request["target_epoch"], "metadata_manifest_digest": op["metadata_manifest_digest"],
        "client_verified_ciphertext_manifest_digest": verified, "client_decryption_verified": True}
    return a, op, m, commit, semantics


@pytest.mark.parametrize("boundary", ["update notes", "update note_revisions", "update recordings"])
def test_rc_full_four_linked_slots_file_and_sql_rollback(client, subject, enabled, boundary):
    from app.models.note import Recording, AnalysisJob
    from .test_related_text import related, prepare, stage, ROOT
    from .test_note_crypto_conversion import decrypt
    s, local = subject, "m1-rc-four"
    seed(client, s, local)
    ident, original = related(client, s, local)
    rec = Recording(owner_id=s["owner"], note_local_id=local, device_id="actor", local_id=str(uuid4()), file_name="original.wav",
        content_type="audio/wav", storage_path="synthetic-only.wav", transcript="\r\noriginal transcript\n")
    s["db"].add(rec); s["db"].commit()
    original_recording = {c.name: getattr(rec, c.name) for c in Recording.__table__.columns}
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    a, op, m, commit, _ = ready_rc(client, s, local)
    before, fired = live_rows(s, local), []
    def fail(conn, cursor, statement, parameters, context, many):
        if statement.lower().startswith(boundary):
            fired.append(True); raise RuntimeError("synthetic RC atomic failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post("/api/v2/notes/mixed-conversions/commit", json=commit, headers=s["headers"])
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    assert r.status_code == 500 and fired and live_rows(s, local) == before, r.text
    r = client.post("/api/v2/notes/mixed-conversions/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all()
    rec = s["db"].get(Recording, rec.id)
    assert all(getattr(rec, k) == v for k, v in original_recording.items() if k != "transcript")
    assert json.loads(decrypt(json.loads(rec.transcript)["ciphertext"], 2))["value"] == original_recording["transcript"]
    job = s["db"].get(AnalysisJob, ident)
    for field in ("input_text", "result_json", "error_message"):
        assert json.loads(decrypt(json.loads(getattr(job, field))["ciphertext"], 2))["value"] == original[field]


def test_mr_native_before_after_metadata_null_and_wrong_context(client, subject):
    s, local = subject, "m1-native-read"
    seed(client, s, local); convert(client, s, local)
    a, c = mcontext(client, s, local)
    items = client.get(MR + "/catalog", params=rq(a, c), headers=s["headers"]).json()["entries"]
    native = [d for d in items if d["key"]["kind"] == "revision_snapshot"]
    for d in native:
        r = client.get(MR + "/revision", params={**rq(a, c), "revision_kind": "note_revision", "revision_id": d["key"]["id"]}, headers=s["headers"])
        assert r.status_code == 200, r.text
        before = r.json()["before_representation"]
        assert before is not None and before["descriptor"]["key"]["slot"] == "before"
        if before["descriptor"]["is_null"]:
            assert before["snapshot"] is None and before["envelope"] is None and before["descriptor"]["expected_binding"] is not None
    bad = {**rq(a, c), "catalog_digest": "0" * 64}
    r = client.get(MR + "/catalog", params=bad, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "context_changed"
    r = client.get(MR + "/context", params={**a, "owner_id": s["other"]}, headers=s["headers"])
    assert r.status_code == 401 and "envelope" not in r.text


def test_cipher_stage_binding_and_frozen_destination_damage_are_rejected(client, subject, enabled):
    from app.models.note_crypto import NoteCryptoEntry
    s, local = subject, "m1-stage-damage"
    seed(client, s, local); convert(client, s, local)
    a, op, m, body = ready_cp(client, s, local)
    entry = s["db"].scalar(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == op["operation_id"]))
    before = live_rows(s, local)
    original = entry.binding_json
    binding = json.loads(original); binding["transition_id"] = str(uuid4())
    entry.binding_json = json.dumps(binding); s["db"].commit()
    r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "manifest_changed" and live_rows(s, local) == before
    entry.binding_json = original; s["db"].commit()
    assert client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"]).status_code == 200


@pytest.mark.parametrize("content", ["", "\uac00" * 100000], ids=["empty", "multichunk-utf8"])
def test_cp_actual_chunk_boundaries_empty_plain_and_wrong_key_preserve_source(client, subject, enabled, content):
    from cryptography.exceptions import InvalidTag
    from .test_note_crypto_conversion import decrypt, canonical
    s, local = subject, "m1-chunks"
    seed(client, s, local, second_content=content); convert(client, s, local)
    _, _, raw = read_all(client, s, local)
    before = live_rows(s, local)
    ciphertext = next(v.decode() for k, v in raw.items() if json.loads(k)["kind"] == "note_body")
    with pytest.raises(InvalidTag):
        decrypt(ciphertext, 999)
    assert live_rows(s, local) == before
    a, op, m, body = ready_cp(client, s, local)
    assert body["plain_current"]["content"] == content
    r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
    assert r.status_code == 200, r.text
    a, c = mcontext(client, s, local)
    current = client.get(MR + "/current", params=rq(a, c), headers=s["headers"]).json()
    d = current["note_body_metadata"]
    params = {**rq(a, c), "kind": d["key"]["kind"], "representation_id": d["key"]["id"], "slot": d["key"]["slot"], "representation_etag": d["representation_etag"]}
    value = b""
    for index in range(max(1, (len(content.encode()) + 262143) // 262144)):
        r = client.get(MR + "/representation", params={**params, "chunk_index": index}, headers=s["headers"])
        assert r.status_code == 200, r.text
        value += base64.b64decode(r.json()["data_base64"])
    assert value.decode() == content
    if content == "":
        assert r.json()["total_bytes"] == 0 and r.json()["total_chunks"] == 1 and r.json()["data_base64"] == ""
    else:
        assert r.json()["total_chunks"] == 2


def test_operation_lifecycle_strict_json_capability_and_non_cipher_stage(client, subject, enabled):
    s, local = subject, "m1-lifecycle"
    seed(client, s, local); convert(client, s, local)
    a, op, m, body = ready_cp(client, s, local)
    prefix = "/api/v2/notes/current-plain"
    request = {**operation_query(a, op), "lease_version": op["lease_version"]}
    r = client.post(prefix + "/renew", json=request, headers=s["headers"])
    assert r.status_code == 200 and r.json()["lease_version"] == op["lease_version"] + 1, r.text
    assert client.post(prefix + "/commit", json=body, headers=s["headers"]).json()["detail"]["code"] == "lease_changed"
    d = next(d for d in m["DSET"] if d["destination_key"]["kind"] == "note_body")
    r = client.post(prefix + "/entries/seal", json={**operation_query(a, op), "metadata_manifest_digest": op["metadata_manifest_digest"],
        "entry_key": d["destination_key"], "source_etag": d["source_etag"], "target_epoch": 1, "total_chunks": 1, "total_bytes": 1, "ciphertext_sha256": "0" * 64}, headers=s["headers"])
    assert r.status_code == 422 and r.json()["detail"]["code"] == "non_cipher_destination", r.text
    duplicate = json.dumps({**request, "lease_version": op["lease_version"] + 1})[:-1] + ',"lease_version":999}'
    r = client.post(prefix + "/abort", content=duplicate, headers={**s["headers"], "Content-Type": "application/json"})
    assert r.status_code == 422
    r = client.post(prefix + "/abort", json={**request, "lease_version": op["lease_version"] + 1}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "aborted", r.text
    assert client.post(prefix + "/commit", json=body, headers=s["headers"]).status_code == 409
    r = client.get("/api/v1/server")
    caps = r.json()["capabilities"]
    assert not any(caps[k] for k in ("mixed_current_plain_v1", "mixed_full_conversion_v1", "mixed_note_write_v1", "mixed_offline_import_v1", "mixed_analysis_source_v1", "full_protection_complete"))


def test_frozen_native_capture_time_change_rejects_without_plain_publication(client, subject, enabled):
    from datetime import datetime
    from app.models.note_history import NoteRevision
    s, local = subject, "m1-time-cas"
    seed(client, s, local); convert(client, s, local)
    a, op, m, body = ready_cp(client, s, local)
    old = next(d for d in m["P"] if d["key"]["kind"] == "revision_snapshot")
    row = s["db"].get(NoteRevision, old["key"]["id"])
    original = row.captured_at
    row.captured_at = datetime(2000, 1, 1); s["db"].commit()
    before = live_rows(s, local)
    try:
        r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "source_changed", r.text
        assert live_rows(s, local) == before
    finally:
        row.captured_at = original; s["db"].commit()


def test_invalid_root_schema_never_echoes_unpublished_plaintext(client, subject, enabled):
    s, local = subject, "m1-validation-redaction"
    seed(client, s, local); convert(client, s, local)
    a, op, m, body = ready_cp(client, s, local)
    before = live_rows(s, local)
    body["schema_version"] = True
    r = client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"])
    assert r.status_code == 422
    assert all(body["plain_current"]["content"] not in value for value in text_values(r.json()))
    assert live_rows(s, local) == before


def cp_request_conversion(client, s, local):
    a, c = mcontext(client, s, local)
    dr = client.post("/api/v2/notes/related-drains", json={"schema_version": 2, **query(s, local),
        "server_instance_id": a["server_instance_id"], "mutation_id": str(uuid4()),
        "crypto_epoch": c["context"]["base"]["crypto_epoch"], "expected_history_generation": c["context"]["base"]["history_generation"]}, headers=s["headers"])
    assert dr.status_code == 201 and dr.json()["state"] == "ready", dr.text
    return {**a, "base": c["context"], "expected_catalog_digest": c["catalog_digest"], "mutation_id": str(uuid4()),
        "target_epoch": c["context"]["base"]["crypto_epoch"] + 1,
        "target_current_mode": "protected" if c["context"]["base"]["current_exists"] else "absent",
        "drain_ref": {"drain_id": dr.json()["drain_id"], "drain_version": dr.json()["drain_version"]}, "reserved_branches": []}


def test_cp_normal_gate_is_closed_without_transition_side_effect(client, subject):
    from sqlalchemy import select
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "m1-gate"
    seed(client, s, local); convert(client, s, local)
    body = cp_request(client, s, local)
    before = list(s["db"].scalars(select(NoteCryptoTransition.id)))
    r = client.post("/api/v2/notes/current-plain/quote", json=body, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "mixed_mode_not_enabled", r.text
    assert list(s["db"].scalars(select(NoteCryptoTransition.id))) == before


def test_cp_quote_has_exact_change_and_preserve_sets(client, subject, monkeypatch):
    from app.core import capabilities
    monkeypatch.setattr(capabilities, "MIXED_MUTATIONS_ENABLED", True, raising=False)
    s, local = subject, "m1-cp-sets"
    seed(client, s, local); convert(client, s, local)
    body = cp_request(client, s, local)
    r = client.post("/api/v2/notes/current-plain/quote", json=body, headers=s["headers"])
    assert r.status_code == 201, r.text
    op = r.json()
    assert op["counts"]["DSET"]["total"] == 4
    assert op["counts"]["P"]["total"] == op["counts"]["S"]["total"] - 2
    repeated = client.post("/api/v2/notes/current-plain/quote", json=body, headers=s["web"])
    assert repeated.status_code == 200 and repeated.json() == op
    assert "SYNTHETIC" not in json.dumps(op)


def test_mr_complete_catalog_null_metadata_and_raw_reassembly(client, subject):
    s, local = subject, "m1-mr"
    seed(client, s, local); convert(client, s, local)
    a, c = mcontext(client, s, local)
    cursor, items = None, []
    while True:
        r = client.get(MR + "/catalog", params={**rq(a, c), "limit": 2, **({"cursor": cursor} if cursor else {})}, headers=s["headers"])
        assert r.status_code == 200, r.text
        items.extend(r.json()["entries"]); cursor = r.json()["next_cursor"]
        if cursor is None:
            break
    assert len(items) == c["counts"]["total"]
    _, _, original = read_all(client, s, local)
    for d in items:
        params = {**rq(a, c), "kind": d["key"]["kind"], "representation_id": d["key"]["id"], "slot": d["key"]["slot"],
                  "representation_etag": d["representation_etag"]}
        r = client.get(MR + "/metadata", params=params, headers=s["headers"])
        assert r.status_code == 200 and r.json()["descriptor"] == d, r.text
        r = client.get(MR + "/representation", params={**params, "chunk_index": 0}, headers=s["headers"])
        assert r.status_code == 200, r.text
        if d["is_null"]:
            assert r.json()["data_base64"] is None and r.json()["total_chunks"] == 0
        else:
            from .test_note_crypto_conversion import canonical
            assert base64.b64decode(r.json()["data_base64"]) == original[canonical(d["key"])]
    assert "SYNTHETIC" not in json.dumps(items)


def test_conversion_metadata_install_transaction(client, subject):
    from .test_note_crypto import prepare
    from .test_note_crypto_conversion import manifest, stage, commit_body
    from app.schemas.note_crypto import CommitTransition
    from app.services.note_crypto_storage import commit
    s, local = subject, "m1-install-transaction"
    seed(client, s, local)
    b, t = prepare(client, s, local)
    _, _, verified = stage(client, s, local, t, manifest(client, s, local, t))
    value = commit.__wrapped__(s["db"], CommitTransition.model_validate(commit_body(s, local, b, t, verified)))
    assert value["state"] == "committed"
    s["db"].rollback()


def test_homogeneous_conversion_registers_exact_slots_without_cipher_rewrite(client, subject):
    s, local = subject, "m1-register"
    seed(client, s, local)
    convert(client, s, local)
    before_context, before_items, before_raw = read_all(client, s, local)
    assert inspect(s["engine"]).has_table("note_mixed_slots")
    r = client.get(MR + "/context", params=query(s, local, schema_version=3,
        server_instance_id=before_context["server_instance_id"]), headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["context"]["current_mode"] == "protected"
    assert r.json()["counts"]["total"] == len(before_items)
    assert read_all(client, s, local) == (before_context, before_items, before_raw)


def test_missing_null_slot_is_not_reclassified_by_read_or_startup(client, subject):
    s, local = subject, "m1-missing-null"
    seed(client, s, local)
    convert(client, s, local)
    c, items, _ = read_all(client, s, local)
    assert inspect(s["engine"]).has_table("note_mixed_slots")
    from app.models.note_mixed import MixedSlot
    with s["engine"].connect() as conn:
        saved = [dict(r) for r in conn.execute(select(MixedSlot.__table__).where(MixedSlot.owner_id == s["owner"], MixedSlot.is_null.is_(True))).mappings()]
    with s["engine"].begin() as conn:
        removed = conn.execute(text("DELETE FROM note_mixed_slots WHERE owner_id=:o AND local_id=:l AND is_null=:n"),
            {"o": s["owner"], "l": local, "n": True}).rowcount
    assert removed == 1
    try:
        r = client.get(MR + "/context", params=query(s, local, schema_version=3,
            server_instance_id=c["server_instance_id"]), headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
        from app.services.note_mixed_metadata import initialize
        with s["engine"].begin() as conn, pytest.raises(Exception, match="inconsistent_history"):
            initialize(conn)
    finally:
        with s["engine"].begin() as conn:
            conn.execute(MixedSlot.__table__.insert(), saved)


@contextmanager
def old_database(s, tmp_path):
    from app.db import Base
    url = os.environ.get("NOW_E4A1_TEST_POSTGRES_URL")
    admin, schema = None, None
    if url:
        assert make_url(url).database == "nownote_e4a1_qa"
        schema = "m1_migration_" + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as conn:
            conn.execute(CreateSchema(schema))
        engine = create_engine(url, connect_args={"options": "-csearch_path=" + schema})
    else:
        engine = create_engine("sqlite:///" + (tmp_path / "before-m1.db").as_posix())
    excluded = {"note_mixed_schema", "note_mixed_scopes", "note_mixed_slots"}
    try:
        with engine.begin() as target, s["engine"].connect() as source:
            for table in Base.metadata.sorted_tables:
                if table.name in excluded:
                    continue
                table.create(target)
                statement = select(table)
                if "owner_id" in table.c:
                    statement = statement.where(table.c.owner_id == s["owner"])
                elif "transition_id" in table.c:
                    from app.models.note_crypto import NoteCryptoTransition
                    statement = statement.where(table.c.transition_id.in_(select(NoteCryptoTransition.id).where(NoteCryptoTransition.owner_id == s["owner"])))
                elif table.name not in ("server_identity", "note_linked_schema"):
                    continue
                rows = [dict(row) for row in source.execute(statement).mappings()]
                if rows:
                    target.execute(table.insert(), rows)
            target.exec_driver_sql("ALTER TABLE note_heads DROP COLUMN current_mode")
        yield engine
    finally:
        engine.dispose()
        if schema:
            with admin.begin() as conn:
                conn.execute(DropSchema(schema, cascade=True))
            admin.dispose()


def original_database_rows(engine):
    result = []
    with engine.connect() as conn:
        for name, columns in (("notes", "*"), ("note_revisions", "*"), ("note_inventory", "*"),
            ("note_heads", "owner_id,local_id,version,identity_state,head_revision_id,protection_state,crypto_epoch,history_generation"),
            ("note_crypto_transitions", "*"), ("note_representation_origins", "*")):
            result.append([tuple(row) for row in conn.exec_driver_sql("SELECT " + columns + " FROM " + name)])
    return result


def test_actual_initial_and_repeated_additive_migration_preserves_original_rows(client, subject, tmp_path, monkeypatch):
    import app.db as database
    s, local = subject, "m1-initial-migration"
    seed(client, s, local); convert(client, s, local)
    with old_database(s, tmp_path) as engine:
        before = original_database_rows(engine)
        assert "current_mode" not in {c["name"] for c in inspect(engine).get_columns("note_heads")}
        monkeypatch.setattr(database, "engine", engine)
        database.create_tables(); database.create_tables()
        assert original_database_rows(engine) == before
        with engine.connect() as conn:
            assert conn.exec_driver_sql("SELECT current_mode FROM note_heads").scalar_one() == "protected"
            assert conn.exec_driver_sql("SELECT count(*) FROM note_mixed_slots WHERE is_null").scalar_one() == 1
        with engine.begin() as conn:
            conn.exec_driver_sql("DELETE FROM note_mixed_slots WHERE is_null")
        with pytest.raises(Exception, match="inconsistent_history"):
            database.create_tables()
        assert original_database_rows(engine) == before


def test_initial_slot_sql_failure_rolls_back_additive_schema_and_all_originals(client, subject, tmp_path, monkeypatch):
    import app.db as database
    s, local = subject, "m1-initial-failure"
    seed(client, s, local); convert(client, s, local)
    with old_database(s, tmp_path) as engine:
        before, fired = original_database_rows(engine), []
        monkeypatch.setattr(database, "engine", engine)
        def fail(conn, cursor, statement, parameters, context, many):
            if statement.lower().startswith("insert into note_mixed_slots"):
                fired.append(True)
                raise RuntimeError("synthetic M1 classification failure")
        event.listen(engine, "before_cursor_execute", fail)
        try:
            with pytest.raises(RuntimeError, match="synthetic M1 classification"):
                database.create_tables()
        finally:
            event.remove(engine, "before_cursor_execute", fail)
        assert fired and original_database_rows(engine) == before
        assert not inspect(engine).has_table("note_mixed_schema")
        assert "current_mode" not in {c["name"] for c in inspect(engine).get_columns("note_heads")}
        database.create_tables()


def test_empty_old_protected_scope_is_not_positive_classification(client, subject, tmp_path, monkeypatch):
    import app.db as database
    from app.models.note import Note
    from app.models.note_history import NoteHead, NoteRevision, NoteInventory
    s, local = subject, "m1-empty-lost"
    seed(client, s, local); convert(client, s, local)
    with old_database(s, tmp_path) as engine:
        with engine.begin() as conn:
            for model in (NoteInventory, NoteRevision, Note):
                conn.execute(model.__table__.delete().where(model.owner_id == s["owner"], model.local_id == local))
            conn.execute(NoteHead.__table__.update().where(NoteHead.owner_id == s["owner"], NoteHead.local_id == local).values(
                head_revision_id=None, identity_state="branch_only"))
        monkeypatch.setattr(database, "engine", engine)
        with pytest.raises(Exception, match="inconsistent_history"):
            database.create_tables()


def test_rc_reserved_local_branch_preserves_original_snapshot_without_fake_current(client, subject, enabled):
    from .test_related_text import related, prepare, stage, ROOT
    from .test_note_protected_import import original
    from .test_note_crypto_conversion import decrypt
    from app.models.note import Note
    from app.models.note_v2 import NoteOfflineBranch
    s, local = subject, "m1-reserved"
    related(client, s, local, nulls=True)
    b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    request = cp_request_conversion(client, s, local)
    ident = str(uuid4())
    request["reserved_branches"] = [{"revision_id": ident, "parent_ref": None, "origin_device_id": "original-device",
        "source_representation_kind": "snapshot_v1", "source_representation_epoch": 0}]
    snapshot = original(s, local, "pending source\r\nexact original\n")
    a = {k: request[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    prefix = "/api/v2/notes/mixed-conversions"
    r = client.post(prefix + "/prepare", json=request, headers=s["headers"])
    assert r.status_code == 201, r.text
    op = r.json(); m = operation_manifest(client, s, a, op, prefix)
    verified, semantics = stage_mixed(client, s, a, op, m, prefix, pending={ident: snapshot})
    body = {**operation_query(a, op), "mutation_id": request["mutation_id"], "lease_version": op["lease_version"], "base": request["base"],
        "target_epoch": 2, "metadata_manifest_digest": op["metadata_manifest_digest"],
        "client_verified_ciphertext_manifest_digest": verified, "client_decryption_verified": True}
    r = client.post(prefix + "/commit", json=body, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["receipt"]["result"]["base"]["identity_state"] == "branch_only"
    assert not r.json()["receipt"]["result"]["base"]["current_exists"]
    s["db"].expire_all()
    row = s["db"].get(NoteOfflineBranch, ident)
    assert row.origin_device_id == "original-device" and row.parent_id is None
    assert json.loads(decrypt(json.loads(row.snapshot_json)["ciphertext"], 2))["snapshot"] == snapshot
    assert s["db"].scalar(select(Note.id).where(Note.owner_id == s["owner"], Note.local_id == local)) is None
    a, c = mcontext(client, s, local)
    r = client.get(MR + "/revision", params={**rq(a, c), "revision_kind": "offline_branch", "revision_id": ident}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["before_representation"] is None, r.text


@pytest.mark.parametrize("cohort", ["writer", "initial"])
def test_startup_never_skips_registered_scope_when_head_is_lost(client, subject, tmp_path, monkeypatch, cohort):
    import app.db as database
    from app.models.note_history import NoteHead
    from app.services.note_mixed_metadata import initialize
    s, local = subject, "m1-head-loss"
    seed(client, s, local); convert(client, s, local)
    def lose_and_check(engine):
        with engine.begin() as conn:
            saved = dict(conn.execute(select(NoteHead.__table__).where(NoteHead.owner_id == s["owner"], NoteHead.local_id == local)).mappings().one())
            conn.execute(NoteHead.__table__.delete().where(NoteHead.owner_id == s["owner"], NoteHead.local_id == local))
        try:
            with engine.begin() as conn, pytest.raises(Exception, match="inconsistent_history"):
                initialize(conn)
        finally:
            with engine.begin() as conn:
                conn.execute(NoteHead.__table__.insert(), saved)
    if cohort == "writer":
        lose_and_check(s["engine"])
    else:
        with old_database(s, tmp_path) as engine:
            monkeypatch.setattr(database, "engine", engine)
            database.create_tables()
            lose_and_check(engine)


def test_rc_requires_original_semantic_operation_receipt_even_in_catalog(client, subject, enabled):
    from app.models.note_crypto import NoteCryptoTransition
    from app.services.note_mixed_metadata import initialize
    s, local = subject, "m1-semantic-receipt"
    seed(client, s, local); convert(client, s, local)
    a, cp, m, body = ready_cp(client, s, local)
    assert client.post("/api/v2/notes/current-plain/commit", json=body, headers=s["headers"]).status_code == 200
    a, c = mcontext(client, s, local)
    r = client.get(MR + "/current", params=rq(a, c), headers=s["headers"])
    assert r.status_code == 200, r.text
    origin = r.json()["current_representation"]["operation_origin"]
    a, rc, m, rc_body, _ = ready_rc(client, s, local, origins={cp["operation_id"]: origin})
    r = client.post("/api/v2/notes/mixed-conversions/commit", json=rc_body, headers=s["headers"])
    assert r.status_code == 200, r.text
    row = s["db"].get(NoteCryptoTransition, cp["operation_id"])
    original = row.receipt_json
    row.receipt_json = None; s["db"].commit()
    try:
        r = client.get(MR + "/context", params=a, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
        with s["engine"].begin() as conn, pytest.raises(Exception, match="inconsistent_history"):
            initialize(conn)
    finally:
        row.receipt_json = original; s["db"].commit()


def test_initial_classification_checks_actual_body_against_original_sealed_cipher(client, subject, tmp_path, monkeypatch):
    import app.db as database
    from app.models.note import Note
    from .test_note_crypto_conversion import encrypt
    s, local = subject, "m1-original-body"
    seed(client, s, local); convert(client, s, local)
    with old_database(s, tmp_path) as engine:
        with engine.begin() as conn:
            conn.execute(Note.__table__.update().where(Note.owner_id == s["owner"], Note.local_id == local).values(
                content=encrypt("another valid body", 1), updated_at=Note.updated_at))
        before = original_database_rows(engine)
        monkeypatch.setattr(database, "engine", engine)
        with pytest.raises(Exception, match="inconsistent_history"):
            database.create_tables()
        assert original_database_rows(engine) == before
