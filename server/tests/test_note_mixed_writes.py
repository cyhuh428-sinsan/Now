"""Mixed semantic writes: actual auth and disposable storage only."""
from .test_note_crypto import subject, query
from .test_note_v2 import body
from .test_note_mixed import enabled
from .test_note_crypto_conversion import seed, convert
from .test_note_mixed import mcontext, rq
from uuid import uuid4
import pytest

MW = "/api/v2/notes/mixed-writes"


def test_legacy_parent_context_never_requires_protection(client, subject, enabled):
    s = subject
    b = body(s, "m2-parent", "parent body stays plain")
    b["note"].update(note_type="tree", parent_local_id=None, level=1)
    r = client.put("/api/v2/notes/current", json=b, headers=s["headers"])
    assert r.status_code == 200, r.text
    from .test_note_crypto import context
    instance = context(client, s, "m2-parent")["server_instance_id"]
    r = client.get(MW + "/parent-context", params={**query(s, "m2-child"), "schema_version": 3,
        "server_instance_id": instance, "parent_local_id": "m2-parent", "child_level": 2,
        "child_deleted": "false"}, headers=s["headers"])
    assert r.status_code == 200, r.text
    p = r.json()["parent_context"]
    assert p["kind"] == "legacy" and p["parent_base"]["crypto_epoch"] == 0
    assert p["structure_signature"]["level"] == 1
    assert "parent body stays plain" not in r.text
    from app.models.note_mixed import MixedScope
    assert s["db"].get(MixedScope, (s["owner"], "m2-parent")) is None


def write_request(client, s, local, operation="put"):
    a, c = mcontext(client, s, local)
    r = client.get("/api/v2/notes/mixed-representations/current", params=rq(a, c), headers=s["headers"])
    assert r.status_code == 200, r.text
    current = r.json()
    return {**a, "mutation_id": str(uuid4()), "base": c["context"],
        "expected_catalog_digest": c["catalog_digest"], "operation": operation,
        "target_current_mode": c["context"]["current_mode"],
        "selection": {"physical_note_id": c["context"]["selected_physical_note_id"],
            "inventory_revision_ref": current["head_revision_ref"],
            "note_representation_etag": current["note_body_metadata"]["representation_etag"],
            "inventory_representation_etag": current["current_representation"]["descriptor"]["representation_etag"]},
        "replica_policy": "selected_head_only", "structure": {k: current["note"][k]
            for k in ("note_type", "parent_local_id", "level", "deleted_at")},
        "parent_context": None, "restore_source": None}


def test_write_quote_fixes_control_and_full_slot_sets(client, subject, enabled):
    s, local = subject, "m2-protected-put"
    seed(client, s, local); convert(client, s, local)
    b = write_request(client, s, local)
    r = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json()
    assert q["purpose"] == "mixed_note_write"
    control = q["metadata_header"]["control"]
    assert control == {k: b[k] for k in ("operation", "selection", "target_current_mode", "replica_policy",
        "structure", "parent_context", "restore_source")}
    assert q["counts"]["DSET"]["total"] == 4
    assert q["counts"]["existing"]["total"] == q["counts"]["verified_existing"]["total"] == 0
    repeated = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert repeated.status_code == 200 and repeated.json() == q


def test_plain_put_commit_preserves_cipher_history_and_replays(client, subject, enabled):
    from .test_note_mixed import ready_cp
    from .test_note_crypto_conversion import digest, canonical
    s, local = subject, "m2-plain-put"
    seed(client, s, local); convert(client, s, local)
    _, _, _, cp = ready_cp(client, s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"])
    assert r.status_code == 200, r.text
    b = write_request(client, s, local)
    a, ctx = mcontext(client, s, local)
    current = client.get("/api/v2/notes/mixed-representations/current", params=rq(a, ctx), headers=s["headers"]).json()
    before = current["current_representation"]["snapshot"]["note"]
    r = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json()
    after = {**before, **q["metadata_header"]["server_fields"], "content": "NEW_PLAIN_CONTENT"}
    request = {**a, "operation_id": q["operation_id"], "mutation_id": b["mutation_id"],
        "lease_version": q["lease_version"], "base": b["base"], "metadata_manifest_digest": q["metadata_manifest_digest"],
        "client_verified_ciphertext_manifest_digest": digest(canonical([]).encode()), "client_decryption_verified": True,
        "projection": {k: after[k] for k in ("note_type", "parent_local_id", "level", "deleted_at", "title", "tags", "source")},
        "plain_after": after, "plain_before": before}
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["receipt"]["result"]["current_mode"] == "plain"
    assert client.post(MW + "/commit", json=request, headers=s["headers"]).json() == r.json()
    omitted = client.post(MW + "/commit", json={**request, "plain_after": None}, headers=s["headers"])
    assert omitted.status_code == 409, omitted.text


@pytest.mark.parametrize("field,value", [("level", True), ("unknown", "not_allowed")])
def test_quote_structure_is_strict_without_internal_error(client, subject, enabled, field, value):
    s, local = subject, "m2-strict-structure"
    seed(client, s, local); convert(client, s, local)
    b = write_request(client, s, local)
    b["structure"][field] = value
    r = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert r.status_code == 422, r.text


def ready_write(client, s, local, operation="put", restore_source=None, restored=None):
    import json, base64
    from .test_note_crypto_conversion import canonical, digest, encrypt, decrypt
    a, c = mcontext(client, s, local)
    if c["context"]["base"]["current_exists"]:
        b = write_request(client, s, local, operation)
        current = client.get("/api/v2/notes/mixed-representations/current", params=rq(a, c), headers=s["headers"]).json()
        rep = current["current_representation"]
        if rep["snapshot"] is None:
            inner = json.loads(decrypt(rep["envelope"]["ciphertext"], rep["descriptor"]["representation_epoch"]))
            before, old_origin = inner["snapshot"]["note"], inner["origin"]
        else:
            before, old_origin = rep["snapshot"]["note"], rep["operation_origin"]
    else:
        before, old_origin = None, None
        b = {**a, "mutation_id": str(uuid4()), "base": c["context"], "expected_catalog_digest": c["catalog_digest"],
            "operation": operation, "target_current_mode": "protected", "selection": None, "replica_policy": "selected_head_only",
            "structure": {"note_type": "daily", "parent_local_id": None, "level": 1, "deleted_at": None}, "parent_context": None}
    b["restore_source"] = restore_source
    if restored is not None:
        b["structure"] = {k: restored[k] for k in ("note_type", "parent_local_id", "level", "deleted_at")}
    if operation == "delete":
        b["structure"]["deleted_at"] = "2026-10-30T00:00:00.000000Z"
    q = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert q.status_code == 201, q.text
    op = q.json(); m = dict(op["metadata_header"])
    for section in ("S", "DSET", "P", "O", "existing", "verified_existing"):
        entries, cursor = [], None
        while True:
            page = client.get(MW + "/manifest", params={**a, "operation_id": op["operation_id"],
                "metadata_manifest_digest": op["metadata_manifest_digest"], "section": section, "limit": 2,
                **({"cursor": cursor} if cursor else {})}, headers=s["headers"])
            assert page.status_code == 200, page.text
            entries.extend(page.json()["entries"]); cursor = page.json()["next_cursor"]
            if cursor is None:
                break
        m[section] = entries
    assert digest(canonical(m).encode()) == op["metadata_manifest_digest"]
    after = {**(before or {"title": "NEW", "content": "", "tags": None, "source": None}), **m["server_fields"], **b["structure"]}
    if restored is not None:
        after.update({k: restored[k] for k in ("note_type", "parent_local_id", "level", "deleted_at", "title", "content", "tags", "source")})
    if operation == "put":
        after["content"] = "M2 NEW CIPHER VALUE"
    records = []
    for d in m["DSET"]:
        if d["is_null"] or d["output_epoch"] == 0:
            continue
        k = d["destination_key"]
        value = before if k["kind"] == "revision_before" else after
        if k["kind"] == "note_body":
            raw = encrypt(value["content"], d["output_epoch"]).encode()
        else:
            snapshot = {"schema_version": 1, "note": value}
            inner = {"schema_version": 1, "binding": d["expected_binding"],
                "origin": old_origin if k["kind"] == "revision_before" else m["operation_origin"],
                "semantic_sha256": digest(canonical(snapshot).encode()), "content_origin_kind": "semantic", "snapshot": snapshot}
            raw = canonical({"schema_version": 1, "kind": d["output_kind"], "crypto_epoch": d["output_epoch"],
                "binding": d["expected_binding"], "ciphertext": encrypt(canonical(inner), d["output_epoch"])}).encode()
        chunks = [raw[i:i + 262144] for i in range(0, len(raw), 262144)]
        control = {**a, "operation_id": op["operation_id"], "metadata_manifest_digest": op["metadata_manifest_digest"],
            "entry_key": k, "source_etag": d["source_etag"], "target_epoch": d["output_epoch"],
            "total_chunks": len(chunks), "total_bytes": len(raw)}
        for i in reversed(range(len(chunks))):
            r = client.put(MW + "/chunks", json={**control, "chunk_index": i, "chunk_sha256": digest(chunks[i]),
                "data_base64": base64.b64encode(chunks[i]).decode()}, headers=s["headers"])
            assert r.status_code == 200, r.text
        r = client.post(MW + "/entries/seal", json={**control, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
        assert r.status_code == 200, r.text
        downloaded = b""
        for i in range(len(chunks)):
            staged = client.get(MW + "/staged", params={**a, "operation_id": op["operation_id"],
                "metadata_manifest_digest": op["metadata_manifest_digest"], "kind": k["kind"], "representation_id": k["id"],
                "slot": k["slot"], "source_etag": d["source_etag"], "target_epoch": d["output_epoch"], "chunk_index": i}, headers=s["headers"])
            assert staged.status_code == 200, staged.text
            downloaded += base64.b64decode(staged.json()["data_base64"])
        assert downloaded == raw
        records.append({"entry_key": k, "destination_key": k, "source_etag": d["source_etag"], "output_kind": d["output_kind"],
            "target_epoch": d["output_epoch"], "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    after_plain = next(d for d in m["DSET"] if d["destination_key"]["kind"] == "revision_snapshot")["output_epoch"] == 0
    before_plain = next(d for d in m["DSET"] if d["destination_key"]["kind"] == "revision_before")["output_epoch"] == 0
    commit = {**a, "operation_id": op["operation_id"], "mutation_id": b["mutation_id"], "lease_version": op["lease_version"],
        "base": b["base"], "metadata_manifest_digest": op["metadata_manifest_digest"],
        "client_verified_ciphertext_manifest_digest": digest(canonical(records).encode()), "client_decryption_verified": True,
        "projection": {k: after[k] for k in ("note_type", "parent_local_id", "level", "deleted_at", "title", "tags", "source")},
        "plain_after": after if after_plain else None, "plain_before": before if before_plain else None}
    return a, op, m, commit


@pytest.mark.parametrize("operation", ["put", "delete"])
def test_protected_semantic_write_full_roundtrip(client, subject, enabled, operation):
    from .test_note_crypto_conversion import decrypt
    from app.models.note import Note
    s, local = subject, "m2-" + operation
    seed(client, s, local); convert(client, s, local)
    a, op, m, request = ready_write(client, s, local, operation)
    original = decrypt(s["db"].get(Note, m["server_fields"]["id"]).content, 1)
    s["db"].rollback()
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all()
    note = s["db"].get(Note, m["server_fields"]["id"])
    assert decrypt(note.content, 1) == ("M2 NEW CIPHER VALUE" if operation == "put" else original)
    assert (note.deleted_at is not None) == (operation == "delete")


@pytest.mark.parametrize("boundary", ["update notes", "insert into note_revisions", "update note_inventory",
    "insert into note_representation_origins", "update note_mixed_slots", "update note_heads", "update note_crypto_transitions"])
def test_write_sql_failure_rolls_back_and_keeps_sealed_cipher(client, subject, enabled, boundary):
    from sqlalchemy import event, select
    from .test_note_mixed import live_rows
    from app.models.note_crypto import NoteCryptoUpload
    from app.services.note_crypto_storage import assembled
    s, local = subject, "m2-sql-rollback"
    seed(client, s, local); convert(client, s, local)
    a, op, m, request = ready_write(client, s, local)
    before, fired = live_rows(s, local), []
    def fail(conn, cursor, statement, parameters, context, many):
        if statement.lower().startswith(boundary):
            fired.append(True)
            raise RuntimeError("synthetic MW SQL failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post(MW + "/commit", json=request, headers=s["headers"])
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    assert r.status_code == 500 and fired, r.text
    assert live_rows(s, local) == before
    s["db"].expire_all()
    upload = s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == op["operation_id"]))
    assert assembled(s["db"], upload)
    s["db"].rollback()
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("scope_kind", ["related_only", "branch_only"])
def test_related_only_create_has_null_before_and_preserves_linked_cipher(client, subject, enabled, scope_kind):
    from .test_related_text import related, prepare, stage, ROOT
    from .test_note_crypto_conversion import canonical, digest
    s, local = subject, "m2-create-related"
    if scope_kind == "related_only":
        related(client, s, local, nulls=True)
        b, t, _ = prepare(client, s, local)
        cb, _, _ = stage(client, s, local, b, t)
        assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    else:
        from app.models.note_history import NoteHead
        from app.models.note_v2 import NoteOfflineBranch
        from .test_note_protected_import import original
        s["db"].add(NoteHead(owner_id=s["owner"], local_id=local, version=0, identity_state="branch_only", history_generation=1))
        s["db"].add(NoteOfflineBranch(id=str(uuid4()), owner_id=s["owner"], local_id=local,
            origin_device_id="original-device", snapshot_json=canonical(original(s, local, "ORIGINAL_BRANCH"))))
        s["db"].commit()
        convert(client, s, local)
    a, c = mcontext(client, s, local)
    assert c["context"]["current_mode"] == "absent"
    structure = {"note_type": "daily", "parent_local_id": None, "level": 1, "deleted_at": None}
    b = {**a, "mutation_id": str(uuid4()), "base": c["context"], "expected_catalog_digest": c["catalog_digest"],
        "operation": "create", "target_current_mode": "plain", "selection": None, "replica_policy": "selected_head_only",
        "structure": structure, "parent_context": None, "restore_source": None}
    r = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json()
    after = {**q["metadata_header"]["server_fields"], **structure, "title": "NEW", "content": "", "tags": None, "source": None}
    request = {**a, "operation_id": q["operation_id"], "mutation_id": b["mutation_id"], "base": b["base"],
        "lease_version": q["lease_version"], "metadata_manifest_digest": q["metadata_manifest_digest"],
        "client_verified_ciphertext_manifest_digest": digest(canonical([]).encode()), "client_decryption_verified": True,
        "projection": {k: after[k] for k in ("note_type", "parent_local_id", "level", "deleted_at", "title", "tags", "source")},
        "plain_after": after, "plain_before": None}
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["receipt"]["result"]["base"]["crypto_epoch"] == 1
    a, c = mcontext(client, s, local)
    assert c["counts"]["total"] == (7 if scope_kind == "related_only" else 5)
    assert c["counts"]["nulls"] == (4 if scope_kind == "related_only" else 1)


def test_write_selected_physical_keeps_other_replica_and_original_device_times(client, subject, enabled):
    from datetime import datetime
    from app.models.note import Note
    from sqlalchemy import select
    s, local = subject, "m2-replicas"
    for index in range(2):
        s["db"].add(Note(owner_id=s["owner"], device_id=f"physical{index}", local_id=local, note_type="daily", title="raw",
            content=f"body{index}", client_updated_at=datetime(2050 + index, 1, 1), created_at=datetime(2020, 1, 1), updated_at=datetime(2021, 1, 1)))
    s["db"].commit()
    convert(client, s, local)
    s["db"].expire_all()
    rows = list(s["db"].scalars(select(Note).where(Note.owner_id == s["owner"]).order_by(Note.id)))
    untouched = {c.name: getattr(rows[0], c.name) for c in Note.__table__.columns}
    selected_id = rows[1].id
    s["db"].rollback()
    _, _, m, request = ready_write(client, s, local)
    assert m["server_fields"]["id"] == selected_id and m["server_fields"]["device_id"] == "physical1"
    assert m["server_fields"]["client_updated_at"] == "2051-01-01T00:00:00.000000Z"
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all()
    assert {c.name: getattr(s["db"].get(Note, untouched["id"]), c.name) for c in Note.__table__.columns} == untouched


@pytest.mark.parametrize("phase", ["quote", "commit"])
@pytest.mark.parametrize("parent_kind", ["legacy", "mixed", "upgrade"])
def test_legacy_parent_change_between_lookup_quote_commit_is_rejected(client, subject, enabled, phase, parent_kind):
    from .test_note_crypto import context
    from .test_note_v2 import based, get_current
    from .test_note_crypto_conversion import digest, canonical
    s, local, parent = subject, "m2-tree-child", "m2-tree-parent"
    initial = body(s, parent, "parent")
    initial["note"].update(note_type="tree", parent_local_id=None, level=1)
    assert client.put("/api/v2/notes/current", json=initial, headers=s["headers"]).status_code == 200
    if parent_kind == "mixed":
        convert(client, s, parent)
    seed(client, s, local); convert(client, s, local)
    b = write_request(client, s, local)
    p = client.get(MW + "/parent-context", params={**query(s, local), "schema_version": 3,
        "server_instance_id": b["server_instance_id"], "parent_local_id": parent, "child_level": 2,
        "child_deleted": "false"}, headers=s["headers"])
    assert p.status_code == 200, p.text
    b["structure"].update(note_type="tree", parent_local_id=parent, level=2)
    b["parent_context"] = p.json()["parent_context"]
    if phase == "commit":
        q = client.post(MW + "/quote", json=b, headers=s["headers"])
        assert q.status_code == 201, q.text
    if parent_kind == "legacy":
        update = based(initial, get_current(client, s, parent))
        update["note"]["content"] = "changed parent"
        r = client.put("/api/v2/notes/current", json=update, headers=s["headers"])
        assert r.status_code == 200, r.text
    elif parent_kind == "upgrade":
        convert(client, s, parent)
    else:
        from .test_note_mixed import ready_cp
        _, _, _, cp = ready_cp(client, s, parent)
        r = client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"])
        assert r.status_code == 200, r.text
    if phase == "quote":
        r = client.post(MW + "/quote", json=b, headers=s["headers"])
    else:
        op = q.json()
        r = client.post(MW + "/commit", json={**{k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")},
            "operation_id": op["operation_id"], "mutation_id": b["mutation_id"], "lease_version": op["lease_version"],
            "base": b["base"], "metadata_manifest_digest": op["metadata_manifest_digest"],
            "client_verified_ciphertext_manifest_digest": digest(canonical([]).encode()), "client_decryption_verified": True,
            "projection": {**b["structure"], "title": "child", "tags": None, "source": None},
            "plain_after": None, "plain_before": None}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "parent_changed", r.text


def test_mw_origin_is_consumed_by_rc_and_repeated_startup(client, subject, enabled):
    from .test_note_mixed import ready_cp, ready_rc
    from app.services.note_operation_origin import operation
    from app.services.note_mixed_metadata import initialize
    from app.models.note_mixed import MixedSlot
    from sqlalchemy import select
    s, local = subject, "m2-rc-lineage"
    seed(client, s, local); convert(client, s, local)
    _, _, _, cp = ready_cp(client, s, local)
    assert client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"]).status_code == 200
    _, op, _, request = ready_write(client, s, local)
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    origins = {ident: operation(s["db"], ident, s["owner"], local) for ident in s["db"].scalars(
        select(MixedSlot.semantic_origin_id).where(MixedSlot.owner_id == s["owner"], MixedSlot.local_id == local,
            MixedSlot.semantic_origin_id.is_not(None))).unique()}
    s["db"].rollback()
    _, _, _, rc, _ = ready_rc(client, s, local, origins=origins)
    r = client.post("/api/v2/notes/mixed-conversions/commit", json=rc, headers=s["headers"])
    assert r.status_code == 200, r.text
    with s["engine"].begin() as conn:
        initialize(conn); initialize(conn)
    a, c = mcontext(client, s, local)
    current = client.get("/api/v2/notes/mixed-representations/current", params=rq(a, c), headers=s["headers"])
    assert current.status_code == 200, current.text
    assert current.json()["current_representation"]["operation_origin"]["operation_id"] == op["operation_id"]
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "replay_payload_requires_status", r.text


def test_restore_rejects_body_descriptor_as_history_source(client, subject, enabled):
    s, local = subject, "m2-invalid-restore"
    seed(client, s, local); convert(client, s, local)
    b = write_request(client, s, local, "restore")
    a, c = mcontext(client, s, local)
    current = client.get("/api/v2/notes/mixed-representations/current", params=rq(a, c), headers=s["headers"]).json()
    b["restore_source"] = {"revision_ref": current["head_revision_ref"], "descriptor": current["note_body_metadata"]}
    r = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert r.status_code == 422 and r.json()["detail"]["code"] == "invalid_restore_target", r.text


@pytest.mark.parametrize("wrong_payload", [False, True])
def test_plain_restore_uses_target_meaning_and_new_server_fields(client, subject, enabled, wrong_payload):
    from .test_note_mixed import ready_cp
    s, local = subject, "m2-plain-restore"
    seed(client, s, local); convert(client, s, local)
    _, _, _, cp = ready_cp(client, s, local)
    assert client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"]).status_code == 200
    a, c = mcontext(client, s, local)
    current = client.get("/api/v2/notes/mixed-representations/current", params=rq(a, c), headers=s["headers"]).json()
    original = current["current_representation"]["snapshot"]["note"]
    catalog = client.get("/api/v2/notes/mixed-representations/catalog", params={**rq(a, c), "limit": 500}, headers=s["headers"])
    assert catalog.status_code == 200, catalog.text
    target = next(d for d in catalog.json()["entries"] if d["key"]["kind"] == "revision_snapshot" and d["revision_ref"] == current["head_revision_ref"])
    _, _, _, first = ready_write(client, s, local)
    assert client.post(MW + "/commit", json=first, headers=s["headers"]).status_code == 200
    _, op, m, restore = ready_write(client, s, local, "restore",
        restore_source={"revision_ref": current["head_revision_ref"], "descriptor": target}, restored=original)
    if wrong_payload:
        restore["plain_after"]["content"] = "NOT_THE_RESTORE_TARGET"
    r = client.post(MW + "/commit", json=restore, headers=s["headers"])
    if wrong_payload:
        assert r.status_code == 409 and r.json()["detail"]["code"] == "restore_target_mismatch", r.text
    else:
        assert r.status_code == 200, r.text
        assert restore["plain_after"]["created_at"] == original["created_at"]
        assert restore["plain_after"]["updated_at"] == m["server_fields"]["updated_at"]


@pytest.mark.parametrize("terminal", ["committed", "aborted"])
def test_write_unique_rollback_gap_preserves_concurrent_terminal(client, subject, enabled, terminal):
    from datetime import datetime
    from sqlalchemy import event
    from sqlalchemy.orm import Session
    from app.models.note_history import NoteRevision
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "m2-unique-gap"
    seed(client, s, local); convert(client, s, local)
    a, op, m, request = ready_write(client, s, local)
    with s["engine"].begin() as conn:
        conn.execute(NoteRevision.__table__.insert().values(id=m["revision_ref"]["id"], owner_id=s["other"],
            local_id="m2-occupier", note_id=999, reason="synthetic", captured_at=datetime(2000, 1, 1),
            snapshot_json="{}", representation_kind="snapshot_v1", representation_epoch=0))
    fired, other = [], []
    def interleave(db, previous):
        if fired or previous.parent is not None or db.get_bind() is not s["engine"]:
            return
        fired.append(True)
        with s["engine"].begin() as conn:
            conn.execute(NoteRevision.__table__.delete().where(NoteRevision.id == m["revision_ref"]["id"], NoteRevision.owner_id == s["other"]))
        if terminal == "committed":
            r = client.post(MW + "/commit", json=request, headers=s["headers"])
        else:
            r = client.post(MW + "/abort", json={**a, "operation_id": op["operation_id"], "lease_version": op["lease_version"]}, headers=s["headers"])
        assert r.status_code == 200, r.text
        other.append(r.json())
    event.listen(Session, "after_soft_rollback", interleave)
    try:
        r = client.post(MW + "/commit", json=request, headers=s["headers"])
    finally:
        event.remove(Session, "after_soft_rollback", interleave)
    assert fired and other
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, op["operation_id"]).state == terminal
    if terminal == "committed":
        assert r.status_code == 200 and r.json()["receipt"] == other[0]["receipt"], r.text
    else:
        assert r.status_code == 409 and r.json()["operation"]["state"] == "aborted", r.text


@pytest.mark.parametrize("field", ["device_id", "created_at", "updated_at", "client_updated_at"])
def test_fixed_server_origin_rejects_modified_header_and_digest(client, subject, enabled, field):
    import json
    from app.models.note_crypto import NoteCryptoTransition
    from app.services.note_mixed_metadata import canonical, h
    s, local = subject, "m2-fixed-origin"
    seed(client, s, local); convert(client, s, local)
    b = write_request(client, s, local)
    q = client.post(MW + "/quote", json=b, headers=s["headers"]).json()
    row = s["db"].get(NoteCryptoTransition, q["operation_id"])
    original, old_digest = row.conditions_json, row.manifest_digest
    c = json.loads(original)
    c["M0"]["server_fields"][field] = "other-device" if field == "device_id" else "2000-01-01T00:00:00.000000Z"
    row.conditions_json, row.manifest_digest = canonical(c), h(c["M0"])
    s["db"].commit()
    try:
        r = client.get(MW + "/status", params={**{k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")},
            "operation_id": q["operation_id"]}, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    finally:
        s["db"].expire_all()
        row = s["db"].get(NoteCryptoTransition, q["operation_id"])
        row.conditions_json, row.manifest_digest = original, old_digest
        s["db"].commit()


def test_write_sealed_state_is_uploading_not_old_ready(client, subject, enabled):
    s, local = subject, "m2-state-wire"
    seed(client, s, local); convert(client, s, local)
    a, op, _, _ = ready_write(client, s, local)
    r = client.get(MW + "/status", params={**a, "operation_id": op["operation_id"]}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "uploading", r.text


def test_protected_create_null_before_has_no_binding(client, subject, enabled):
    from .test_related_text import related, prepare, stage, ROOT
    s, local = subject, "m2-protected-create-null"
    related(client, s, local, nulls=True)
    b, t, _ = prepare(client, s, local)
    cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    a, c = mcontext(client, s, local)
    b = {**a, "mutation_id": str(uuid4()), "base": c["context"], "expected_catalog_digest": c["catalog_digest"],
        "operation": "create", "target_current_mode": "protected", "selection": None, "replica_policy": "selected_head_only",
        "structure": {"note_type": "daily", "parent_local_id": None, "level": 1, "deleted_at": None}, "parent_context": None, "restore_source": None}
    r = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json()
    page = client.get(MW + "/manifest", params={**a, "operation_id": q["operation_id"],
        "metadata_manifest_digest": q["metadata_manifest_digest"], "section": "DSET"}, headers=s["headers"])
    assert page.status_code == 200, page.text
    before = next(d for d in page.json()["entries"] if d["destination_key"]["kind"] == "revision_before")
    assert before["is_null"] and before["expected_binding"] is None


def test_same_epoch_mode_change_stales_old_write_context(client, subject, enabled):
    from .test_note_mixed import ready_cp
    s, local = subject, "m2-same-k"
    seed(client, s, local); convert(client, s, local)
    stale = write_request(client, s, local)
    _, _, _, cp = ready_cp(client, s, local)
    assert client.post("/api/v2/notes/current-plain/commit", json=cp, headers=s["headers"]).status_code == 200
    _, c = mcontext(client, s, local)
    assert stale["base"]["base"]["crypto_epoch"] == c["context"]["base"]["crypto_epoch"]
    r = client.post(MW + "/quote", json=stale, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "context_changed", r.text


def test_write_expiry_renew_abort_and_purpose_isolation(client, subject, enabled):
    from datetime import datetime, timedelta
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence, NoteCryptoUpload
    from sqlalchemy import select
    s, local = subject, "m2-lifecycle"
    seed(client, s, local); convert(client, s, local)
    a, op, m, request = ready_write(client, s, local)
    args = {**a, "operation_id": op["operation_id"]}
    wrong = client.get("/api/v2/notes/current-plain/status", params=args, headers=s["headers"])
    assert wrong.status_code == 404, wrong.text
    renewed = client.post(MW + "/renew", json={**args, "lease_version": op["lease_version"]}, headers=s["headers"])
    assert renewed.status_code == 200 and renewed.json()["lease_version"] == op["lease_version"] + 1, renewed.text
    request["lease_version"] = renewed.json()["lease_version"]
    s["db"].expire_all()
    row = s["db"].get(NoteCryptoTransition, op["operation_id"])
    row.expires_at = datetime.utcnow() - timedelta(seconds=1)
    s["db"].commit()
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 410 and r.json()["operation"]["state"] == "expired", r.text
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None
    assert s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == op["operation_id"])) is not None
    s["db"].rollback()
    a, op, _, request = ready_write(client, s, local)
    r = client.post(MW + "/abort", json={**a, "operation_id": op["operation_id"], "lease_version": op["lease_version"]}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "aborted", r.text
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "operation_not_active", r.text


def test_multichunk_source_stage_and_original_utf8_before(client, subject, enabled):
    import base64, json
    from .test_note_crypto_conversion import digest, decrypt
    s, local = subject, "m2-large"
    text = "\ud55c\uae00\r\n" * 70000
    seed(client, s, local, content=text, second_content=text)
    convert(client, s, local)
    a, op, m, request = ready_write(client, s, local)
    source = next(s for s in m["S"] if s["descriptor"]["key"]["kind"] == "inventory_snapshot")
    raw, i = b"", 0
    while True:
        k = source["descriptor"]["key"]
        r = client.get(MW + "/source", params={**a, "operation_id": op["operation_id"],
            "metadata_manifest_digest": op["metadata_manifest_digest"], "kind": k["kind"], "representation_id": k["id"],
            "slot": k["slot"], "source_etag": source["source_etag"], "chunk_index": i}, headers=s["headers"])
        assert r.status_code == 200, r.text
        raw += base64.b64decode(r.json()["data_base64"]); i += 1
        if i == r.json()["total_chunks"]:
            break
    assert i > 1 and digest(raw) == source["descriptor"]["ciphertext_sha256"]
    assert json.loads(decrypt(json.loads(raw)["ciphertext"], 1))["snapshot"]["note"]["content"] == text
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text


def test_pristine_legacy_parent_first_lookup_initializes_only_normal_baseline(client, subject, enabled):
    from app.models.note import Note
    from app.models.note_history import NoteHead
    from app.models.note_mixed import MixedScope
    from .test_note_crypto import context
    from sqlalchemy import select
    from datetime import datetime
    s, local = subject, "m2-pristine-parent"
    with s["engine"].begin() as conn:
        conn.execute(Note.__table__.insert().values(owner_id=s["owner"], local_id=local, device_id="old-device",
            note_type="tree", title="old title", content="OLD_UNCHANGED_BODY", level=1, parent_local_id=None,
            created_at=datetime(2020, 1, 1), updated_at=datetime(2021, 1, 1), client_updated_at=datetime(2050, 1, 1)))
        before = dict(conn.execute(select(Note.__table__).where(Note.owner_id == s["owner"], Note.local_id == local)).mappings().one())
    instance = context(client, s, "different-empty-local")["server_instance_id"]
    args = {**query(s, "future-child"), "schema_version": 3, "server_instance_id": instance,
        "parent_local_id": local, "child_level": 2, "child_deleted": "false"}
    r = client.get(MW + "/parent-context", params=args, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.json()["parent_context"]["kind"] == "legacy"
    assert client.get(MW + "/parent-context", params=args, headers=s["headers"]).json() == r.json()
    with s["engine"].connect() as conn:
        after = dict(conn.execute(select(Note.__table__).where(Note.id == before["id"])).mappings().one())
    assert after == before
    s["db"].expire_all()
    assert s["db"].get(NoteHead, (s["owner"], local)).crypto_epoch == 0
    assert s["db"].get(MixedScope, (s["owner"], local)) is None


@pytest.mark.parametrize("child_level,deleted,expected", [(2, False, 409), (3, False, 200), (2, True, 409)])
def test_mixed_parent_checks_exact_selected_physical(client, subject, enabled, child_level, deleted, expected):
    from app.models.note import Note
    from .test_note_crypto import context
    from sqlalchemy import select
    from datetime import datetime
    s, local = subject, "m2-parent-physical"
    root = body(s, "m2-ancestor", "ancestor")
    root["note"].update(note_type="tree", parent_local_id=None, level=1)
    assert client.put("/api/v2/notes/current", json=root, headers=s["headers"]).status_code == 200
    with s["engine"].begin() as conn:
        for index in range(2):
            conn.execute(Note.__table__.insert().values(owner_id=s["owner"], local_id=local, device_id=f"physical{index}",
                note_type="tree", title="parent", content=f"PARENT{index}", level=index+1,
                parent_local_id="m2-ancestor" if index else None, created_at=datetime(2020, 1, 1),
                updated_at=datetime(2025-index, 1, 1), client_updated_at=datetime(2050+index, 1, 1),
                deleted_at=datetime(2026, 1, 1) if index and deleted else None))
    convert(client, s, local)
    with s["engine"].connect() as conn:
        before = [dict(r) for r in conn.execute(select(Note.__table__).where(Note.owner_id==s["owner"], Note.local_id==local).order_by(Note.id)).mappings()]
    instance = context(client, s, local)["server_instance_id"]
    r = client.get(MW + "/parent-context", params={**query(s, "future-child"), "schema_version": 3,
        "server_instance_id": instance, "parent_local_id": local, "child_level": child_level, "child_deleted": "false"}, headers=s["headers"])
    assert r.status_code == expected, r.text
    if expected == 200:
        assert r.json()["parent_context"]["context"]["selected_physical_note_id"] == before[1]["id"]
        from .test_note_crypto_conversion import digest, canonical
        child = "m2-exact-parent-child"
        seed(client, s, child); convert(client, s, child)
        b = write_request(client, s, child)
        b["structure"].update(note_type="tree", parent_local_id=local, level=child_level)
        b["parent_context"] = r.json()["parent_context"]
        quoted = client.post(MW + "/quote", json=b, headers=s["headers"])
        assert quoted.status_code == 201, quoted.text
        op = quoted.json()
        with s["engine"].begin() as conn:
            conn.execute(Note.__table__.update().where(Note.id == before[1]["id"]).values(level=1, updated_at=before[1]["updated_at"]))
        try:
            changed = client.post(MW + "/commit", json={**{k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")},
                "operation_id": op["operation_id"], "mutation_id": b["mutation_id"], "lease_version": op["lease_version"],
                "base": b["base"], "metadata_manifest_digest": op["metadata_manifest_digest"],
                "client_verified_ciphertext_manifest_digest": digest(canonical([]).encode()), "client_decryption_verified": True,
                "projection": {**b["structure"], "title": "child", "tags": None, "source": None},
                "plain_after": None, "plain_before": None}, headers=s["headers"])
            assert changed.status_code == 409 and changed.json()["detail"]["code"] == "parent_changed", changed.text
        finally:
            with s["engine"].begin() as conn:
                conn.execute(Note.__table__.update().where(Note.id == before[1]["id"]).values(level=2, updated_at=before[1]["updated_at"]))
    with s["engine"].connect() as conn:
        assert [dict(row) for row in conn.execute(select(Note.__table__).where(Note.owner_id==s["owner"], Note.local_id==local).order_by(Note.id)).mappings()] == before


@pytest.mark.parametrize("damage", ["head", "inventory", "revision"])
def test_partial_legacy_parent_history_loss_never_bootstraps(client, subject, enabled, damage):
    from sqlalchemy import select
    from app.models.note_history import NoteHead, NoteInventory, NoteRevision
    from .test_note_crypto import context
    s, local = subject, "m2-partial-parent"
    initial = body(s, local, "KEEP_ORIGINAL")
    initial["note"].update(note_type="tree", parent_local_id=None, level=1)
    assert client.put("/api/v2/notes/current", json=initial, headers=s["headers"]).status_code == 200
    instance = context(client, s, local)["server_instance_id"]
    model = {"head": NoteHead, "inventory": NoteInventory, "revision": NoteRevision}[damage]
    table = model.__table__
    with s["engine"].begin() as conn:
        rows = [dict(row) for row in conn.execute(select(table).where(table.c.owner_id==s["owner"], table.c.local_id==local)).mappings()]
        conn.execute(table.delete().where(table.c.owner_id==s["owner"], table.c.local_id==local))
    try:
        r = client.get(MW + "/parent-context", params={**query(s, "child"), "schema_version": 3,
            "server_instance_id": instance, "parent_local_id": local, "child_level": 2, "child_deleted": "false"}, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
        with s["engine"].connect() as conn:
            assert not conn.execute(select(table).where(table.c.owner_id==s["owner"], table.c.local_id==local)).first()
    finally:
        with s["engine"].begin() as conn:
            conn.execute(table.insert(), rows)


@pytest.mark.parametrize("field", ["owner_id", "local_id", "mutation_id", "device_id", "schema_version"])
def test_fixed_request_identity_must_match_original_record(client, subject, enabled, field):
    import json
    from app.models.note_crypto import NoteCryptoTransition
    from app.services.note_mixed_metadata import canonical, h
    s, local = subject, "m2-fixed-identity"
    seed(client, s, local); convert(client, s, local)
    b = write_request(client, s, local)
    q = client.post(MW + "/quote", json=b, headers=s["headers"]).json()
    row = s["db"].get(NoteCryptoTransition, q["operation_id"])
    original, old_digest = row.conditions_json, row.manifest_digest
    c = json.loads(original)
    if field == "schema_version":
        c["M0"]["schema_version"] = 4
    elif field == "device_id":
        c["request"][field] = c["M0"]["actor_device_id"] = "different-actor"
    else:
        c["request"][field] = s["other"] if field == "owner_id" else "other-local" if field == "local_id" else str(uuid4())
    row.conditions_json, row.manifest_digest = canonical(c), h(c["M0"])
    s["db"].commit()
    try:
        r = client.get(MW + "/status", params={**{k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")},
            "operation_id": q["operation_id"]}, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    finally:
        s["db"].expire_all()
        row = s["db"].get(NoteCryptoTransition, q["operation_id"])
        row.conditions_json, row.manifest_digest = original, old_digest
        s["db"].commit()


def test_protected_create_roundtrip_null_origin_and_startup(client, subject, enabled):
    from .test_related_text import related, prepare, stage, ROOT
    from app.services.note_mixed_metadata import initialize
    s, local = subject, "m2-protected-new"
    related(client, s, local, nulls=True)
    b, t, _ = prepare(client, s, local)
    cb, _, _ = stage(client, s, local, b, t)
    assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    a, op, m, request = ready_write(client, s, local, "create")
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    with s["engine"].begin() as conn:
        initialize(conn)
    a, c = mcontext(client, s, local)
    assert c["context"]["current_mode"] == "protected"
    assert c["counts"]["nulls"] == 4


@pytest.mark.parametrize("damage", ["slot", "origin"])
@pytest.mark.parametrize("source", ["existing", "absent"])
def test_required_null_before_metadata_loss_is_not_reconstructed(client, subject, enabled, damage, source):
    from sqlalchemy import select
    from app.models.note_mixed import MixedSlot
    from app.models.note_crypto import NoteRepresentationOrigin
    from app.services.note_mixed_metadata import initialize, canonical
    s, local = subject, "m2-null-loss"
    if source == "existing":
        seed(client, s, local); convert(client, s, local)
    else:
        from .test_related_text import related, prepare, stage, ROOT
        related(client, s, local, nulls=True)
        b, t, _ = prepare(client, s, local)
        cb, _, _ = stage(client, s, local, b, t)
        assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    a, op, m, request = ready_write(client, s, local, "put" if source == "existing" else "create")
    assert client.post(MW + "/commit", json=request, headers=s["headers"]).status_code == 200
    key = canonical({"kind": "revision_before", "id": m["revision_ref"]["id"], "slot": "before"})
    model = MixedSlot if damage == "slot" else NoteRepresentationOrigin
    table = model.__table__
    with s["engine"].begin() as conn:
        saved = dict(conn.execute(select(table).where(table.c.owner_id == s["owner"], table.c.local_id == local, table.c.key_json == key)).mappings().one())
        conn.execute(table.delete().where(table.c.owner_id == s["owner"], table.c.local_id == local, table.c.key_json == key))
    try:
        r = client.get("/api/v2/notes/mixed-representations/context", params=a, headers=s["headers"])
        assert r.status_code == 409, r.text
        with s["engine"].begin() as conn, pytest.raises(Exception, match="inconsistent_history"):
            initialize(conn)
    finally:
        with s["engine"].begin() as conn:
            conn.execute(table.insert(), saved)


def test_product_gate_false_and_auth_owner_boundaries(client, subject):
    s, local = subject, "m2-gates"
    seed(client, s, local); convert(client, s, local)
    b = write_request(client, s, local)
    r = client.post(MW + "/quote", json=b, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "mixed_mode_not_enabled", r.text
    r = client.post(MW + "/quote", json=b)
    assert r.status_code == 401, r.text
    r = client.post(MW + "/quote", json={**b, "owner_id": s["other"]}, headers=s["headers"])
    assert r.status_code in (401, 403), r.text


def test_branch_only_restore_keeps_original_branch_and_uses_new_server_fields(client, subject, enabled):
    from app.models.note_history import NoteHead
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note import Note
    from .test_note_protected_import import original
    from .test_note_crypto_conversion import canonical
    s, local = subject, "m2-branch-restore"
    ident = str(uuid4()); snapshot = original(s, local, "SOURCE_BRANCH_MEANING")
    s["db"].add(NoteHead(owner_id=s["owner"], local_id=local, version=0, identity_state="branch_only", history_generation=1))
    s["db"].add(NoteOfflineBranch(id=ident, owner_id=s["owner"], local_id=local, origin_device_id="old-device",
        snapshot_json=canonical(snapshot)))
    s["db"].commit()
    convert(client, s, local)
    a, c = mcontext(client, s, local)
    catalog = client.get("/api/v2/notes/mixed-representations/catalog", params={**rq(a, c), "limit": 500}, headers=s["headers"])
    d = next(d for d in catalog.json()["entries"] if d["key"]["id"] == ident)
    s["db"].expire_all()
    original_raw = s["db"].get(NoteOfflineBranch, ident).snapshot_json
    s["db"].rollback()
    a, op, m, request = ready_write(client, s, local, "restore", {"revision_ref": d["revision_ref"], "descriptor": d}, snapshot["note"])
    r = client.post(MW + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    s["db"].expire_all()
    assert s["db"].get(NoteOfflineBranch, ident).snapshot_json == original_raw
    note = s["db"].get(Note, m["server_fields"]["id"])
    assert note.device_id == "actor" and note.created_at.isoformat(timespec="microseconds") + "Z" == m["server_fields"]["created_at"]
