"""E2 opt-in Note API; actual auth and disposable database transactions."""
import copy
import json
import os
from datetime import datetime
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session


@pytest.fixture
def subject(client, tmp_path, monkeypatch):
    from app.core.config import get_settings
    from app.db import Base, get_db
    from app.main import app
    from app.models.note import UserAccount
    from app.services.user_accounts import issue_user_device_access_token, issue_web_session
    from sqlalchemy.engine import make_url

    url = os.environ.get("NOW_E2_TEST_POSTGRES_URL")
    if url:
        assert make_url(url).database == "nownote_e2_qa"
    else:
        url = f"sqlite:///{(tmp_path / 'v2.db').as_posix()}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    from app.services.note_mixed_metadata import initialize
    with engine.begin() as connection:
        initialize(connection)
    monkeypatch.setattr(get_settings(), "api_token", "")
    monkeypatch.setattr(get_settings(), "user_token_required", False)
    owner, other = "e2_a_" + uuid4().hex, "e2_b_" + uuid4().hex
    with Session(engine, autoflush=False) as db:
        db.add_all([UserAccount(owner_id=o, email=o + "@example.invalid", group_name="synthetic") for o in [owner, other]])
        db.commit()
        _, token = issue_user_device_access_token(db, owner_id=owner, device_id="actor", display_name="synthetic")
        _, web = issue_web_session(db, owner_id=owner)
        db.commit()
        def backend():
            with Session(engine, autoflush=False) as request_db:
                yield request_db
        app.dependency_overrides[get_db] = backend
        try:
            yield {"owner": owner, "other": other, "headers": {"X-Now-User-Token": token},
                   "web": {"X-Now-Web-Session": web}, "db": db, "engine": engine}
        finally:
            db.rollback()
            app.dependency_overrides.pop(get_db, None)
    engine.dispose()


def body(subject, local="daily:/한글 %?#/", content="first"):
    return {"schema_version": 1, "owner_id": subject["owner"], "local_id": local, "device_id": "actor",
            "mutation_id": str(uuid4()), "crypto_epoch": 0, "base_head_version": 0,
            "base_revision_id": None, "expected_inventory_revision_ids": [],
            "note": {"note_type": "daily", "title": "raw", "content": content,
                     "tags": "opaque,not-json", "source": None}}


def get_current(client, subject, local):
    response = client.get("/api/v2/notes/current", params={"owner_id": subject["owner"], "local_id": local}, headers=subject["headers"])
    assert response.status_code == 200, response.text
    assert response.headers.get("cache-control") == "no-store"
    return response.json()


def based(request, current):
    return {**copy.deepcopy(request), "mutation_id": str(uuid4()),
            "base_head_version": current["head_version"], "base_revision_id": current["head_revision_id"],
            "expected_inventory_revision_ids": current["inventory_revision_ids"]}


def test_create_cas_and_fixed_replay_without_body_ledger(client, subject):
    request = body(subject)
    created = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert created.status_code == 200, created.text
    receipt = created.json()
    current = get_current(client, subject, request["local_id"])
    assert current["snapshot"]["note"]["content"] == "first"
    assert receipt["result_inventory_revision_ids"] == current["inventory_revision_ids"]
    update = based(request, current)
    update["note"]["content"] = "second"
    assert client.put("/api/v2/notes/current", json=update, headers=subject["headers"]).status_code == 200
    replay = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert replay.json() == receipt
    mismatch = copy.deepcopy(request)
    mismatch["note"]["content"] = "different"
    assert client.put("/api/v2/notes/current", json=mismatch, headers=subject["headers"]).status_code == 409
    stale = based(request, current)
    assert client.put("/api/v2/notes/current", json=stale, headers=subject["headers"]).status_code == 409
    from app.models.note_v2 import NoteMutation
    subject["db"].expire_all()
    rows = list(subject["db"].scalars(select(NoteMutation).where(NoteMutation.owner_id == subject["owner"])))
    assert len(rows) == 2
    stored = " ".join(row.conditions_json + row.result_json for row in rows)
    assert '"content"' not in stored and '"note"' not in stored and '"hash"' not in stored


def test_strict_auth_exact_owner_and_no_store_errors(client, subject):
    request = body(subject)
    for headers in [{}, {"X-Now-User-Token": "invalid-synthetic"}]:
        response = client.put("/api/v2/notes/current", json=request, headers=headers)
        assert response.status_code == 401
        assert response.headers.get("cache-control") == "no-store"
    for invalid in [{**request, "extra": True}, {**request, "base_head_version": "0"}, {**request, "schema_version": True},
                    {**request, "note": {**request["note"], "extra": "no"}}]:
        assert client.put("/api/v2/notes/current", json=invalid, headers=subject["headers"]).status_code == 422
    for owner in [subject["other"], " " + subject["owner"]]:
        response = client.put("/api/v2/notes/current", json={**request, "owner_id": owner}, headers=subject["web"])
        assert response.status_code in [401, 403]
        assert "first" not in response.text


def test_legacy_baseline_and_selected_physical_device(client, subject):
    from app.models.note import Note
    db, owner = subject["db"], subject["owner"]
    for device, stamp, content in [("old", datetime(2099, 1, 1), "future head"),
                                    ("actor", datetime(2026, 1, 1), "keep replica")]:
        db.add(Note(owner_id=owner, device_id=device, local_id="prefix:replicas/", note_type="daily",
                    title="raw", content=content, client_updated_at=stamp))
    db.commit()
    request = body(subject, "prefix:replicas/", "adopted")
    response = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert response.status_code == 409 and response.json()["detail"]["code"] == "baseline_required"
    current = get_current(client, subject, request["local_id"])
    assert current["head_version"] == 0 and current["replica_count"] == 2
    request = based(request, current)
    assert client.put("/api/v2/notes/current", json=request, headers=subject["headers"]).status_code == 409
    request["replica_policy"] = "selected_head_only"
    accepted = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert accepted.status_code == 200, accepted.text
    after = get_current(client, subject, request["local_id"])
    assert after["snapshot"]["note"]["device_id"] == "old"
    assert after["snapshot"]["note"]["content"] == "adopted"
    db.expire_all()
    assert db.scalar(select(Note).where(Note.owner_id == owner, Note.device_id == "actor")).content == "keep replica"


def test_offline_branch_only_import_restore_and_parent_cycle(client, subject):
    request = body(subject, "branch:/only")
    stamp = "2026-10-29T01:02:03.123456Z"
    raw = {"id": None, "owner_id": subject["owner"], "device_id": "offline-origin", "local_id": request["local_id"],
           "note_type": "daily", "title": "branch", "content": "offline", "parent_local_id": None,
           "level": 1, "tags": None, "source": "raw", "client_updated_at": stamp,
           "deleted_at": None, "created_at": stamp, "updated_at": stamp}
    revision = str(uuid4())
    imported = {key: value for key, value in request.items() if key not in ["note", "base_head_version", "base_revision_id", "expected_inventory_revision_ids"]}
    imported["entries"] = [{"revision_id": revision, "parent_ref": None, "snapshot": {"schema_version": 1, "note": raw}}]
    response = client.post("/api/v2/notes/revisions/import", json=imported, headers=subject["headers"])
    assert response.status_code == 200, response.text
    assert client.post("/api/v2/notes/revisions/import", json=imported, headers=subject["headers"]).json() == response.json()
    restored = {key: value for key, value in request.items() if key != "note"}
    restored["mutation_id"] = str(uuid4())
    restored["target_ref"] = {"kind": "offline_branch", "id": revision}
    response = client.post("/api/v2/notes/restore", json=restored, headers=subject["headers"])
    assert response.status_code == 200, response.text
    current = get_current(client, subject, request["local_id"])
    assert current["snapshot"]["note"]["content"] == "offline"
    bad = copy.deepcopy(imported)
    bad["mutation_id"] = str(uuid4())
    other = str(uuid4())
    bad["entries"] = [{**bad["entries"][0], "revision_id": other, "parent_ref": {"kind": "offline_branch", "id": other}}]
    assert client.post("/api/v2/notes/revisions/import", json=bad, headers=subject["headers"]).status_code == 409


def test_epoch_precedes_replay_and_legacy_batch_protection(client, subject):
    from app.models.note_history import NoteHead
    request = body(subject)
    assert client.put("/api/v2/notes/current", json=request, headers=subject["headers"]).status_code == 200
    db = subject["db"]
    head = db.get(NoteHead, (subject["owner"], request["local_id"]))
    head.crypto_epoch = 1
    head.protection_state = "protected"
    db.commit()
    replay = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert replay.status_code == 409 and replay.json()["detail"]["code"] == "crypto_epoch_changed"
    notes = [{"owner_id": subject["owner"], "device_id": "actor", "local_id": "normal-new", "note_type": "daily", "title": "normal"},
             {"owner_id": subject["owner"], "device_id": "actor", "local_id": request["local_id"], "note_type": "daily", "title": "protected", "content": "NOW_ENCRYPTED_V1:old"}]
    response = client.post("/api/v1/sync", json={"owner_id": subject["owner"], "device_id": "actor", "notes": notes}, headers=subject["headers"])
    assert response.status_code == 409 and response.json()["detail"]["code"] == "protected_note_requires_upgrade"
    from app.models.note import Note
    db.expire_all()
    assert db.scalar(select(Note).where(Note.owner_id == subject["owner"], Note.local_id == "normal-new")) is None


def test_replay_checks_actor_activity_separate_from_token_device(client, subject):
    from app.models.note import UserDevice
    request = body(subject)
    request["device_id"] = "separate-writer"
    original = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert original.status_code == 200
    db = subject["db"]
    actor = db.scalar(select(UserDevice).where(UserDevice.owner_id == subject["owner"], UserDevice.device_id == "separate-writer"))
    actor.is_active = 0
    db.commit()
    replay = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert replay.status_code == 403
    assert replay.headers.get("cache-control") == "no-store"


def test_metadata_pages_revision_owner_and_invalid_cursor(client, subject):
    request = body(subject)
    for value in ["first", "second", "third"]:
        request["note"]["content"] = value
        response = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
        assert response.status_code == 200
        request = based(request, get_current(client, subject, request["local_id"]))
    params = {"owner_id": subject["owner"], "local_id": request["local_id"], "limit": 1}
    first = client.get("/api/v2/notes/revisions", params=params, headers=subject["headers"])
    assert first.status_code == 200
    page = first.json()
    assert len(page["items"]) == 1 and page["next_cursor"]
    assert '"content"' not in first.text and '"title"' not in first.text
    second = client.get("/api/v2/notes/revisions", params={**params, "cursor": page["next_cursor"]}, headers=subject["headers"])
    assert second.status_code == 200
    assert second.json()["items"][0]["revision_ref"] != page["items"][0]["revision_ref"]
    ref = page["items"][0]["revision_ref"]
    one = client.get("/api/v2/notes/revision", params={**params, "revision_id": ref["id"], "revision_kind": ref["kind"]}, headers=subject["headers"])
    assert one.status_code == 200 and one.json()["snapshot"]["note"]["content"] == "third"
    wrong = client.get("/api/v2/notes/revision", params={**params, "local_id": "another", "revision_id": ref["id"], "revision_kind": ref["kind"]}, headers=subject["headers"])
    assert wrong.status_code == 404 and "third" not in wrong.text
    for invalid in [{"cursor": "not-json"}, {"revision_id": "invalid", "revision_kind": "note_revision"}]:
        path = "/api/v2/notes/revision" if "revision_id" in invalid else "/api/v2/notes/revisions"
        response = client.get(path, params={**params, **invalid}, headers=subject["headers"])
        assert response.status_code == 422 and response.headers.get("cache-control") == "no-store"


def test_revision_reasons_across_native_and_offline_pages_without_body_queries(client, subject):
    from sqlalchemy import event
    from app.models.note import Note
    db = subject["db"]
    local = "reason:mixed"
    db.add(Note(owner_id=subject["owner"], device_id="original-device", local_id=local,
                note_type="daily", title="legacy title", content="legacy body"))
    db.commit()
    initial = get_current(client, subject, local)
    baseline_ref = {"kind": "note_revision", "id": initial["head_revision_id"]}
    expected = {("note_revision", initial["head_revision_id"]): "baseline"}
    request = based(body(subject, local, "saved body"), initial)
    saved = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert saved.status_code == 200
    expected[("note_revision", saved.json()["result_revision_id"])] = "write"
    deleted = client.delete("/api/v1/notes/" + local, params={"owner_id": subject["owner"]}, headers=subject["headers"])
    assert deleted.status_code == 200
    deleted_current = get_current(client, subject, local)
    expected[("note_revision", deleted_current["head_revision_id"])] = "delete"
    restore = based(request, deleted_current)
    restore.pop("note")
    restore["target_ref"] = baseline_ref
    restored = client.post("/api/v2/notes/restore", json=restore, headers=subject["headers"])
    assert restored.status_code == 200
    expected[("note_revision", restored.json()["result_revision_id"])] = "restore"
    current = get_current(client, subject, local)
    branch_id = str(uuid4())
    imported = {key: value for key, value in body(subject, local).items()
                if key not in ["note", "base_head_version", "base_revision_id", "expected_inventory_revision_ids"]}
    imported["entries"] = [{"revision_id": branch_id, "parent_ref": None, "snapshot": current["snapshot"]}]
    assert client.post("/api/v2/notes/revisions/import", json=imported, headers=subject["headers"]).status_code == 200
    expected[("offline_branch", branch_id)] = "offline_import"
    queries, seen = [], {}
    def observe(connection, cursor, statement, parameters, context, executemany):
        queries.append(statement)
    event.listen(subject["engine"], "before_cursor_execute", observe)
    try:
        cursor = None
        for _ in range(4):
            params = {"owner_id": subject["owner"], "local_id": local, "limit": 2}
            if cursor:
                params["cursor"] = cursor
            response = client.get("/api/v2/notes/revisions", params=params, headers=subject["headers"])
            assert response.status_code == 200 and response.headers.get("cache-control") == "no-store"
            for item in response.json()["items"]:
                ref = (item["revision_ref"]["kind"], item["revision_ref"]["id"])
                assert ref not in seen
                seen[ref] = item["reason"]
                assert set(item) == {"revision_ref", "parent_ref", "captured_at", "representation_epoch", "reason"}
            cursor = response.json()["next_cursor"]
            if not cursor:
                break
        assert cursor is None and seen == expected
        assert all("snapshot_json" not in statement and "FROM notes" not in statement for statement in queries)
    finally:
        event.remove(subject["engine"], "before_cursor_execute", observe)


def test_mutation_failure_and_missing_parent_leave_no_partial_state(client, subject):
    from sqlalchemy import event
    from app.models.note import Note
    from app.models.note_history import NoteHead, NoteRevision
    from app.models.note_v2 import NoteMutation
    request = body(subject)
    def fail(connection, cursor, statement, parameters, context, executemany):
        if statement.startswith("INSERT INTO note_mutations"):
            raise RuntimeError("synthetic receipt failure")
    event.listen(subject["engine"], "before_cursor_execute", fail)
    try:
        response = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
        assert response.status_code == 500 and response.headers.get("cache-control") == "no-store"
    finally:
        event.remove(subject["engine"], "before_cursor_execute", fail)
    db = subject["db"]
    db.expire_all()
    assert db.scalar(select(Note).where(Note.owner_id == subject["owner"])) is None
    assert db.get(NoteHead, (subject["owner"], request["local_id"])) is None
    assert db.scalar(select(NoteRevision).where(NoteRevision.owner_id == subject["owner"])) is None
    assert db.get(NoteMutation, (subject["owner"], request["mutation_id"])) is None
    request["mutation_id"] = str(uuid4())
    request["note"].update(note_type="tree", level=2, parent_local_id="missing")
    response = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert response.status_code == 409 and response.headers.get("cache-control") == "no-store"
    assert response.json()["detail"] == {"code": "invalid_note_parent"}
    assert db.scalar(select(Note).where(Note.owner_id == subject["owner"])) is None


def test_v1_timestamp_only_generation_and_fixed_noop_receipt(client, subject):
    from app.models.note_history import NoteHead
    request = body(subject)
    assert client.put("/api/v2/notes/current", json=request, headers=subject["headers"]).status_code == 200
    current = get_current(client, subject, request["local_id"])
    note = current["snapshot"]["note"]
    v1 = {key: value for key, value in note.items() if key not in ["id", "created_at", "updated_at"]}
    v1["client_updated_at"] = "2099-01-01T00:00:00.123456Z"
    response = client.post("/api/v1/notes", json=v1, headers=subject["headers"])
    assert response.status_code == 200, response.text
    after = get_current(client, subject, request["local_id"])
    assert after["head_version"] == current["head_version"]
    assert after["history_generation"] > current["history_generation"]
    retry = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert retry.status_code == 200
    assert get_current(client, subject, request["local_id"])["history_generation"] == after["history_generation"]


def test_duplicate_import_atomic_failure_and_group_history_denial(client, subject):
    from app.models.note import Note, UserDevice
    from app.models.note_history import NoteHead
    from app.models.note_v2 import NoteOfflineBranch
    from app.schemas.note import NoteIn
    from app.services.note_sync import upsert_note
    request = body(subject)
    assert client.put("/api/v2/notes/current", json=request, headers=subject["headers"]).status_code == 200
    current = get_current(client, subject, request["local_id"])
    imported = {key: value for key, value in request.items() if key not in ["note", "base_head_version", "base_revision_id", "expected_inventory_revision_ids"]}
    imported["mutation_id"] = str(uuid4())
    branch = str(uuid4())
    imported["entries"] = [{"revision_id": branch, "parent_ref": {"kind": "note_revision", "id": current["head_revision_id"]}, "snapshot": current["snapshot"]}]
    first = client.post("/api/v2/notes/revisions/import", json=imported, headers=subject["headers"])
    assert first.status_code == 200
    generation = first.json()["history_generation"]
    imported["mutation_id"] = str(uuid4())
    duplicate = client.post("/api/v2/notes/revisions/import", json=imported, headers=subject["headers"])
    assert duplicate.status_code == 200 and duplicate.json()["history_generation"] == generation
    broken = copy.deepcopy(imported)
    broken["mutation_id"], broken["device_id"] = str(uuid4()), "failed-new-actor"
    new_id = str(uuid4())
    broken["entries"] = [{**broken["entries"][0], "revision_id": new_id},
                         {**broken["entries"][0], "revision_id": str(uuid4()), "parent_ref": {"kind": "note_revision", "id": str(uuid4())}}]
    bad = client.post("/api/v2/notes/revisions/import", json=broken, headers=subject["headers"])
    assert bad.status_code == 409 and bad.json()["detail"]["code"] == "invalid_revision_parent"
    db = subject["db"]
    db.expire_all()
    assert db.get(NoteOfflineBranch, new_id) is None
    assert db.scalar(select(UserDevice).where(UserDevice.owner_id == subject["owner"], UserDevice.device_id == "failed-new-actor")) is None
    assert db.get(NoteHead, (subject["owner"], request["local_id"])).history_generation == generation
    upsert_note(NoteIn(owner_id=subject["other"], device_id="other", local_id="other-private", note_type="tree", title="private", content="OTHER_PRIVATE_BODY"), db)
    db.commit()
    other_head = db.get(NoteHead, (subject["other"], "other-private"))
    response = client.get("/api/v2/notes/revision", params={"owner_id": subject["owner"], "local_id": "other-private", "revision_kind": "note_revision", "revision_id": other_head.head_revision_id}, headers=subject["web"])
    assert response.status_code == 404 and "OTHER_PRIVATE_BODY" not in response.text


@pytest.mark.parametrize("local", ["", " /raw:%?#漢字/ "])
def test_existing_local_string_rules_are_not_tightened(client, subject, local):
    request = body(subject, local)
    response = client.put("/api/v2/notes/current", json=request, headers=subject["headers"])
    assert response.status_code == 200, response.text
    assert get_current(client, subject, local)["snapshot"]["note"]["local_id"] == local


def test_protected_all_v1_writes_and_unsupported_history(client, subject):
    from app.models.note_history import NoteHead, NoteRevision
    request = body(subject, "protected-one")
    assert client.put("/api/v2/notes/current", json=request, headers=subject["headers"]).status_code == 200
    current = get_current(client, subject, request["local_id"])
    db = subject["db"]
    head = db.get(NoteHead, (subject["owner"], request["local_id"]))
    head.crypto_epoch, head.protection_state = 1, "protected"
    db.commit()
    v1 = {key: value for key, value in current["snapshot"]["note"].items() if key not in ["id", "created_at", "updated_at"]}
    for content in ["plaintext", "NOW_ENCRYPTED_V1:old-epoch"]:
        single = client.post("/api/v1/notes", json={**v1, "content": content}, headers=subject["headers"])
        assert single.status_code == 409
        normal = {**v1, "local_id": "unwritten-normal", "content": "normal"}
        batch = client.post("/api/v1/notes/sync", json={"notes": [normal, {**v1, "content": content}]}, headers=subject["headers"])
        assert batch.status_code == 409
    deleted = client.delete("/api/v1/notes/protected-one", params={"owner_id": subject["owner"]}, headers=subject["headers"])
    assert deleted.status_code == 409 and deleted.headers.get("cache-control") == "no-store"
    from app.models.note import Note
    db.expire_all()
    assert db.scalar(select(Note).where(Note.owner_id == subject["owner"], Note.local_id == "unwritten-normal")) is None
    revision = db.get(NoteRevision, current["head_revision_id"])
    revision.representation_epoch = 1
    revision.representation_kind = "encrypted_snapshot_future"
    db.commit()
    response = client.get("/api/v2/notes/revision", params={"owner_id": subject["owner"], "local_id": "protected-one",
        "revision_kind": "note_revision", "revision_id": revision.id}, headers=subject["headers"])
    assert response.status_code == 409 and response.json()["detail"]["code"] == "unsupported_representation"
    assert "first" not in response.text
    normal = client.put("/api/v2/notes/current", json=body(subject, "legacy-still-works", "NOW_ENCRYPTED_V1:legacy"), headers=subject["headers"])
    assert normal.status_code == 200


def test_native_and_offline_same_uuid_remain_typed(client, subject):
    request = body(subject)
    assert client.put("/api/v2/notes/current", json=request, headers=subject["headers"]).status_code == 200
    current = get_current(client, subject, request["local_id"])
    snapshot = copy.deepcopy(current["snapshot"])
    snapshot["note"]["content"] = "typed offline branch"
    imported = {key: value for key, value in request.items() if key not in ["note", "base_head_version", "base_revision_id", "expected_inventory_revision_ids"]}
    imported["mutation_id"] = str(uuid4())
    imported["entries"] = [{"revision_id": current["head_revision_id"],
        "parent_ref": {"kind": "note_revision", "id": current["head_revision_id"]}, "snapshot": snapshot}]
    response = client.post("/api/v2/notes/revisions/import", json=imported, headers=subject["headers"])
    assert response.status_code == 200, response.text
    for kind, expected in [("note_revision", "first"), ("offline_branch", "typed offline branch")]:
        response = client.get("/api/v2/notes/revision", params={"owner_id": subject["owner"], "local_id": request["local_id"],
            "revision_kind": kind, "revision_id": current["head_revision_id"]}, headers=subject["headers"])
        assert response.status_code == 200 and response.json()["snapshot"]["note"]["content"] == expected
    restore = based(request, current)
    restore.pop("note")
    restore["target_ref"] = {"kind": "offline_branch", "id": current["head_revision_id"]}
    result = client.post("/api/v2/notes/restore", json=restore, headers=subject["headers"])
    assert result.status_code == 200, result.text
    assert get_current(client, subject, request["local_id"])["snapshot"]["note"]["content"] == "typed offline branch"


@pytest.mark.parametrize("race_v1", [False, True])
def test_actual_two_session_cas_race(client, subject, race_v1):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from app.schemas.note_v2 import PutNote
    from app.services.note_v2 import mutate
    from app.services.note_sync import upsert_note
    from app.schemas.note import NoteIn
    from fastapi import HTTPException
    request = body(subject)
    assert client.put("/api/v2/notes/current", json=request, headers=subject["headers"]).status_code == 200
    current = get_current(client, subject, request["local_id"])
    first, second = based(request, current), based(request, current)
    first["note"]["content"], second["note"]["content"] = "race-one", "race-two"
    gate = Barrier(2)
    def write(value, legacy):
        with Session(subject["engine"], autoflush=False) as db:
            gate.wait(timeout=10)
            try:
                if legacy:
                    upsert_note(NoteIn(owner_id=subject["owner"], device_id="actor", local_id=request["local_id"],
                                       note_type="daily", title="raw", content="v1-race"), db)
                    db.commit()
                    return 200
                mutate(db, PutNote.model_validate(value), "put")
                return 200
            except HTTPException as exc:
                db.rollback()
                return exc.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        a, b = pool.submit(write, first, False), pool.submit(write, second, race_v1)
        statuses = [a.result(timeout=20), b.result(timeout=20)]
    if not race_v1:
        assert sorted(statuses) == [200, 409]
    else:
        assert statuses[1] == 200 and statuses[0] in [200, 409]
    after = get_current(client, subject, request["local_id"])
    assert after["head_version"] == (2 if statuses.count(200) == 1 else 3)


@pytest.mark.parametrize("version", ["2.3.9", "E1"])
def test_additive_startup_from_existing_schema(tmp_path, client, monkeypatch, version):
    from sqlalchemy import inspect, text
    from sqlalchemy.engine import make_url
    from sqlalchemy.schema import CreateSchema, DropSchema
    from app import db as database
    from app.models.note import Note, UserAccount
    url = os.environ.get("NOW_E2_TEST_POSTGRES_URL")
    schema, admin = None, None
    if url:
        assert make_url(url).database == "nownote_e2_qa"
        admin = create_engine(url)
        schema = "e2_migration_" + uuid4().hex
        with admin.begin() as connection:
            connection.execute(CreateSchema(schema))
        engine = create_engine(url, connect_args={"options": "-c search_path=" + schema})
    else:
        engine = create_engine(f"sqlite:///{(tmp_path / 'legacy.db').as_posix()}")
    revision_id = str(uuid4())
    try:
        Note.__table__.create(engine)
        UserAccount.__table__.create(engine)
        with engine.begin() as connection:
            connection.execute(Note.__table__.insert().values(id=17, owner_id="legacy", device_id="physical",
                local_id="worklog:/raw", note_type="worklog", title="keep", content="legacy-plaintext",
                tags="not-json\r\n", source=None, level=1,
                client_updated_at=datetime(2026, 10, 29, 1, 2, 3, 123456),
                created_at=datetime(2026, 10, 28), updated_at=datetime(2026, 10, 29)))
            if version == "E1":
                connection.execute(text("CREATE TABLE note_heads (owner_id VARCHAR(80) NOT NULL, local_id VARCHAR(120) NOT NULL, version INTEGER NOT NULL, identity_state VARCHAR(20) NOT NULL, head_revision_id VARCHAR(36), PRIMARY KEY(owner_id,local_id))"))
                connection.execute(text("CREATE TABLE note_revisions (id VARCHAR(36) PRIMARY KEY, owner_id VARCHAR(80) NOT NULL, local_id VARCHAR(120) NOT NULL, note_id INTEGER NOT NULL, parent_revision_id VARCHAR(36), reason VARCHAR(24) NOT NULL, captured_at TIMESTAMP NOT NULL, snapshot_json TEXT NOT NULL, before_snapshot_json TEXT)"))
                connection.execute(text("CREATE TABLE note_inventory (owner_id VARCHAR(80) NOT NULL, local_id VARCHAR(120) NOT NULL, note_id INTEGER NOT NULL, revision_id VARCHAR(36) NOT NULL, snapshot_json TEXT NOT NULL, PRIMARY KEY(owner_id,local_id,note_id))"))
                connection.execute(text("INSERT INTO note_heads VALUES ('legacy','worklog:/raw',6,'coherent',:id)"), {"id": revision_id})
                connection.execute(text("INSERT INTO note_revisions VALUES (:id,'legacy','worklog:/raw',17,NULL,'baseline',:stamp,:snapshot,NULL)"),
                                   {"id": revision_id, "stamp": datetime(2026, 10, 29), "snapshot": '{"raw":"unchanged synthetic E1 bytes"}'})
                connection.execute(text("INSERT INTO note_inventory VALUES ('legacy','worklog:/raw',17,:id,:snapshot)"),
                                   {"id": revision_id, "snapshot": '{"raw":"unchanged inventory bytes"}'})
        monkeypatch.setattr(database, "engine", engine)
        database.create_tables()
        database.create_tables()
        columns = {column["name"]: column for column in inspect(engine).get_columns("note_revisions")}
        assert columns["note_id"]["nullable"] is False
        assert {"note_offline_branches", "note_mutations"} <= set(inspect(engine).get_table_names())
        with Session(engine) as session:
            row = session.get(Note, 17)
            assert row.content == "legacy-plaintext" and row.tags == "not-json\r\n" and row.source is None
            assert row.client_updated_at.microsecond == 123456
            if version == "E1":
                from app.models.note_history import NoteHead, NoteRevision, NoteInventory
                head = session.get(NoteHead, ("legacy", "worklog:/raw"))
                assert head.version == 6 and head.head_revision_id == revision_id
                assert (head.crypto_epoch, head.protection_state, head.history_generation) == (0, "legacy", 0)
                revision = session.get(NoteRevision, revision_id)
                assert revision.snapshot_json == '{"raw":"unchanged synthetic E1 bytes"}'
                assert revision.note_id == 17 and revision.representation_epoch == 0
                inventory = session.get(NoteInventory, ("legacy", "worklog:/raw", 17))
                assert inventory.snapshot_json == '{"raw":"unchanged inventory bytes"}'
    finally:
        engine.dispose()
        if admin:
            with admin.begin() as connection:
                connection.execute(DropSchema(schema, cascade=True))
            admin.dispose()
