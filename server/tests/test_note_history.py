"""E1 history storage and v1 compatibility boundaries."""
from uuid import uuid4
from datetime import datetime
import json
import os

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError


@pytest.fixture
def history_db(tmp_path, client, monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import Session
    from app.db import Base, get_db
    from app.main import app
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "api_token", "")
    monkeypatch.setattr(get_settings(), "user_token_required", False)
    url = os.environ.get("NOW_E1_TEST_POSTGRES_URL")
    if url:
        assert make_url(url).database == "nownote_e1_qa"
    else:
        url = f"sqlite:///{(tmp_path / 'history.db').as_posix()}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    with Session(engine, autoflush=False) as session:
        def backend():
            with Session(engine, autoflush=False) as request_db:
                yield request_db
        app.dependency_overrides[get_db] = backend
        try:
            yield session
        finally:
            session.rollback()
            app.dependency_overrides.pop(get_db, None)
    engine.dispose()


def payload(owner, **changes):
    from app.schemas.note import NoteIn
    return NoteIn(owner_id=owner, device_id="one", local_id="daily:history",
                  note_type="daily", title="raw", content="first", **changes)


def history(db, owner):
    from sqlalchemy import select
    from app.models.note_history import NoteHead, NoteRevision, NoteInventory
    db.expire_all()
    head = db.get(NoteHead, (owner, "daily:history"))
    revisions = list(db.scalars(select(NoteRevision).where(NoteRevision.owner_id == owner)))
    inventory = list(db.scalars(select(NoteInventory).where(NoteInventory.owner_id == owner)))
    return head, revisions, inventory


def test_new_raw_snapshot_and_noop(history_db):
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    item = payload(owner, tags='[raw,not,json]\r\n', source=None,
                   client_updated_at=datetime(2026, 10, 29, 1, 2, 3, 123456))
    row = upsert_note(item, history_db)
    history_db.commit()
    head, revisions, inventory = history(history_db, owner)
    assert head.version == 1 and head.identity_state == "coherent"
    assert len(revisions) == len(inventory) == 1
    snapshot = json.loads(revisions[0].snapshot_json)
    assert snapshot["schema_version"] == 1 and len(snapshot["note"]) == 15
    assert snapshot["note"]["id"] == row.id
    assert snapshot["note"]["tags"] == item.tags
    assert snapshot["note"]["source"] is None
    assert snapshot["note"]["client_updated_at"].endswith(".123456Z")
    upsert_note(item, history_db)
    history_db.commit()
    head, revisions, _ = history(history_db, owner)
    assert head.version == 1 and len(revisions) == 1


def test_legacy_replicas_type_transitions_and_stale(history_db):
    from app.models.note import Note
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    old = datetime(2026, 10, 28)
    newer = datetime(2026, 10, 29)
    for device, content, stamp in [("one", "old", old), ("two", "NOW_ENCRYPTED_V1:opaque", newer)]:
        history_db.add(Note(owner_id=owner, device_id=device, local_id="daily:history", note_type="daily",
                            title="raw", content=content, client_updated_at=stamp))
    history_db.commit()
    item = payload(owner).model_copy(update={"content": "ignored", "client_updated_at": datetime(2026, 10, 27)})
    upsert_note(item, history_db)
    history_db.commit()
    head, revisions, inventory = history(history_db, owner)
    assert head.version == 0 and len(revisions) == 2
    assert all(r.parent_revision_id is None for r in revisions)
    assert {json.loads(r.snapshot_json)["note"]["content"] for r in revisions} == {"old", "NOW_ENCRYPTED_V1:opaque"}
    pointer = head.head_revision_id
    upsert_note(item.model_copy(update={"content": "nonhead", "client_updated_at": old}), history_db)
    history_db.commit()
    head, revisions, _ = history(history_db, owner)
    assert head.version == 1 and head.head_revision_id == pointer and len(revisions) == 3
    upsert_note(item.model_copy(update={"content": "changed type", "note_type": "worklog", "client_updated_at": newer}), history_db)
    history_db.commit()
    head, _, inventory = history(history_db, owner)
    assert head.version == 2 and head.identity_state == "ambiguous" and head.head_revision_id is None
    upsert_note(item.model_copy(update={"device_id": "two", "content": "both worklog", "note_type": "worklog", "client_updated_at": newer}), history_db)
    history_db.commit()
    head, _, _ = history(history_db, owner)
    assert head.version == 3 and head.identity_state == "coherent" and head.head_revision_id


def test_repeated_existing_writes_and_rollback_session_reuse(history_db):
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    item = payload(owner)
    upsert_note(item, history_db)
    history_db.commit()
    upsert_note(item.model_copy(update={"content": "second"}), history_db)
    upsert_note(item.model_copy(update={"content": "third"}), history_db)
    history_db.commit()
    head, revisions, _ = history(history_db, owner)
    assert head.version == 3
    assert {json.loads(r.snapshot_json)["note"]["content"] for r in revisions} == {"first", "second", "third"}
    upsert_note(item.model_copy(update={"content": "discard"}), history_db)
    history_db.flush()
    history_db.rollback()
    history_db.commit()  # A subsequent unrelated commit must not resurrect the queue.
    head, revisions, _ = history(history_db, owner)
    assert head.version == 3 and len(revisions) == 3


def test_parent_error_after_natural_flush_has_no_ghost_history(client, history_db):
    from app.models.note import Note, SyncLog
    from sqlalchemy import select
    owner = "e1_" + uuid4().hex
    original = Note(owner_id=owner, device_id="one", local_id="daily:history",
                    note_type="daily", title="raw", content="legacy")
    history_db.add(original)
    history_db.commit()
    item = payload(owner).model_dump(mode="json")
    bad = {**item, "local_id": "zz-child", "note_type": "tree", "level": 2,
           "parent_local_id": "missing-parent"}
    response = client.post("/api/v1/sync", json={"owner_id": owner, "device_id": "outer", "notes": [item, bad]})
    assert response.status_code == 400
    head, revisions, inventory = history(history_db, owner)
    assert head is None and revisions == inventory == []
    assert history_db.get(Note, original.id).content == "legacy"
    log = history_db.scalar(select(SyncLog).where(SyncLog.owner_id == owner))
    assert log is not None and not log.succeeded


def test_history_insert_failure_rolls_back_note_and_session_queue(history_db):
    from sqlalchemy import event
    from app.models.note_history import NoteRevision
    from app.models.note import Note, SyncLog
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    item = payload(owner)
    row = upsert_note(item, history_db)
    history_db.commit()

    def fail(mapper, connection, target):
        if target.owner_id == owner:
            raise RuntimeError("synthetic revision insert failure")

    event.listen(NoteRevision, "before_insert", fail)
    try:
        upsert_note(item.model_copy(update={"content": "must rollback"}), history_db)
        with pytest.raises(RuntimeError, match="synthetic revision"):
            history_db.commit()
        history_db.rollback()
    finally:
        event.remove(NoteRevision, "before_insert", fail)
    history_db.add(SyncLog(owner_id=owner, device_id="after-failure", pushed_count=0,
                           pulled_count=0, include_deleted=0, succeeded=0))
    history_db.commit()
    assert history_db.get(Note, row.id).content == "first"
    head, revisions, _ = history(history_db, owner)
    assert head.version == 1 and len(revisions) == 1


def test_soft_delete_and_single_type_change(client, history_db):
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    item = payload(owner)
    upsert_note(item, history_db)
    history_db.commit()
    upsert_note(item.model_copy(update={"note_type": "worklog", "content": "converted"}), history_db)
    history_db.commit()
    response = client.delete("/api/v1/notes/daily:history", params={"owner_id": owner, "device_id": "one"})
    assert response.status_code == 200 and response.json()["deleted_at"]
    head, revisions, _ = history(history_db, owner)
    assert head.version == 3 and head.identity_state == "coherent"
    assert len(revisions) == 3
    deleted = next(r for r in revisions if r.reason == "delete")
    assert json.loads(deleted.before_snapshot_json)["note"]["deleted_at"] is None
    assert json.loads(deleted.snapshot_json)["note"]["deleted_at"]


def test_nested_rollback_preserves_outer_session(history_db):
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    item = payload(owner)
    upsert_note(item, history_db)
    history_db.commit()
    with pytest.raises(ValueError):
        with history_db.begin_nested():
            upsert_note(item.model_copy(update={"content": "nested discard"}), history_db)
            history_db.flush()
            raise ValueError("synthetic nested rollback")
    upsert_note(item.model_copy(update={"content": "outer accepted"}), history_db)
    history_db.commit()
    head, revisions, _ = history(history_db, owner)
    assert head.version == 2 and len(revisions) == 2
    assert {json.loads(r.snapshot_json)["note"]["content"] for r in revisions} == {"first", "outer accepted"}


def test_fallback_and_timestamp_only_representative_change(history_db):
    from app.models.note import Note
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    older, newer = datetime(2026, 10, 28), datetime(2026, 10, 29)
    first = Note(owner_id=owner, device_id="one", local_id="daily:history", note_type="daily",
                 title="raw", content="first", client_updated_at=newer, updated_at=older)
    second = Note(owner_id=owner, device_id="two", local_id="daily:history", note_type="daily",
                  title="raw", content="second", client_updated_at=older, updated_at=newer)
    history_db.add_all([first, second])
    history_db.commit()
    # Fallback chooses updated_at, not the client-time pull representative.
    row = upsert_note(payload(owner).model_copy(update={"device_id": "third", "content": "accepted", "client_updated_at": older}), history_db)
    assert row.id == second.id
    history_db.commit()
    head, revisions, _ = history(history_db, owner)
    baseline_leader = next(r for r in revisions if r.note_id == first.id and r.reason == "baseline")
    assert head.head_revision_id == baseline_leader.id and head.version == 1
    # The same meaning at a newer client timestamp moves the representative only.
    row = upsert_note(payload(owner).model_copy(update={"device_id": "third", "content": "accepted", "client_updated_at": datetime(2026, 10, 30)}), history_db)
    history_db.commit()
    head, revisions, _ = history(history_db, owner)
    assert head.version == 2 and len(revisions) == 3
    assert head.head_revision_id != baseline_leader.id


def test_ambiguous_baseline_and_natural_parent_flush(client, history_db):
    from app.models.note import Note
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    for device, kind in [("one", "daily"), ("two", "worklog")]:
        history_db.add(Note(owner_id=owner, device_id=device, local_id="daily:history", note_type=kind,
                            title="raw", content="old", client_updated_at=datetime(2026, 10, 29)))
    history_db.commit()
    upsert_note(payload(owner).model_copy(update={"client_updated_at": datetime(2026, 10, 28)}), history_db)
    history_db.commit()
    head, revisions, _ = history(history_db, owner)
    assert head.version == 0 and head.identity_state == "ambiguous" and head.head_revision_id is None
    assert len(revisions) == 2
    parent = payload(owner).model_copy(update={"local_id": "topic:parent", "note_type": "tree"})
    child = parent.model_copy(update={"local_id": "child:string", "level": 2, "parent_local_id": "topic:parent"})
    from app.models.note import UserDevice
    history_db.add(UserDevice(owner_id=owner, device_id="one", is_active=1))
    history_db.commit()
    response = client.post("/api/v1/notes/sync", json={"notes": [child.model_dump(mode="json"), parent.model_dump(mode="json")]})
    assert response.status_code == 200
    from app.models.note_history import NoteHead
    assert history_db.get(NoteHead, (owner, "topic:parent")).version == 1
    assert history_db.get(NoteHead, (owner, "child:string")).version == 1


@pytest.mark.parametrize("legacy", [False, True])
def test_two_writers_first_baseline_and_changes_are_serialized(history_db, legacy):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy.orm import Session
    from app.models.note import Note
    from app.services.note_sync import upsert_note
    owner = "e1_" + uuid4().hex
    if legacy:
        for device in ["one", "two"]:
            history_db.add(Note(owner_id=owner, device_id=device, local_id="daily:history",
                                note_type="daily", title="raw", content="legacy " + device))
        history_db.commit()
    gate = Barrier(2)
    def write(device):
        with Session(history_db.bind, autoflush=False) as session:
            gate.wait(timeout=10)
            upsert_note(payload(owner).model_copy(update={"device_id": device, "content": device}), session)
            session.commit()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(write, device) for device in ["one", "two"]]
        for future in futures:
            future.result(timeout=20)
    head, revisions, inventory = history(history_db, owner)
    assert head.version == 2 and head.head_revision_id
    assert len(revisions) == (4 if legacy else 2)
    assert len(inventory) == (2 if legacy else 1)
    bodies = [json.loads(r.snapshot_json)["note"]["content"] for r in revisions]
    assert "one" in bodies and "two" in bodies


def test_history_schema_is_additive(history_db):
    db = history_db
    from app.db import Base
    from app.models.note import Note
    owner = "e1_additive_" + uuid4().hex
    row = Note(owner_id=owner, device_id="one", local_id="legacy:string", note_type="daily", title="raw", content="keep")
    db.add(row)
    db.commit()
    Base.metadata.create_all(db.bind)
    Base.metadata.create_all(db.bind)
    db.expire_all()
    assert db.get(Note, row.id).content == "keep"
    tables = set(inspect(db.bind).get_table_names())
    assert {"note_heads", "note_revisions", "note_inventory"} <= tables


def test_existing_duplicate_new_daily_batch_behavior(history_db):
    """Keep the existing deferred-flush boundary visible during E1 design."""
    from app.schemas.note import NoteIn
    from app.services.note_sync import upsert_note
    db = history_db

    owner = "e1_probe_" + uuid4().hex
    item = NoteIn(owner_id=owner, device_id="same", local_id="daily:2026-10-29",
                  note_type="daily", title="synthetic", content="first")
    first = upsert_note(item, db)
    second = upsert_note(item.model_copy(update={"content": "second"}), db)
    assert first is not second
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
