"""E0: batch owner checks must precede device registration and all Note writes."""
from datetime import datetime
import os
from uuid import uuid4

import pytest
from sqlalchemy import select


@pytest.fixture
def db(db):
    """Optional disposable PostgreSQL backend; never connect to a normal database."""
    url = os.environ.get("NOW_E0_TEST_POSTGRES_URL")
    if not url:
        yield db
        return
    from sqlalchemy import create_engine
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import Session
    from app.db import Base, get_db
    from app.main import app
    from app.models.note import UserAccount

    assert make_url(url).database == "nownote_e0_qa"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for owner in ["sinsan", "member"]:
            if session.scalar(select(UserAccount).where(UserAccount.owner_id == owner)) is None:
                session.add(UserAccount(owner_id=owner, email=owner + "@example.invalid"))
        session.commit()

        def backend():
            with Session(engine) as request_db:
                yield request_db

        previous = app.dependency_overrides.get(get_db)
        app.dependency_overrides[get_db] = backend
        try:
            yield session
        finally:
            if previous is None:
                app.dependency_overrides.pop(get_db, None)
            else:
                app.dependency_overrides[get_db] = previous
    engine.dispose()


@pytest.fixture
def auth(db, monkeypatch):
    from app.core.config import get_settings
    from app.services.user_accounts import issue_user_device_access_token, issue_web_session

    monkeypatch.setattr(get_settings(), "api_token", "")
    device, token = issue_user_device_access_token(
        db, owner_id="sinsan", device_id="e0-token-" + uuid4().hex,
        display_name="synthetic E0",
    )
    _, session = issue_web_session(db, owner_id="sinsan")
    db.commit()
    return {"token": {"X-Now-User-Token": token},
            "web": {"X-Now-Web-Session": session}, "legacy": {}}


def note(owner="sinsan", **changes):
    return {"owner_id": owner, "device_id": "e0-nested-" + uuid4().hex,
            "local_id": "e0-note-" + uuid4().hex, "note_type": "daily",
            "title": "synthetic", "content": "attempt", **changes}


def snapshot(db):
    from app.models.note import Note, UserDevice
    db.expire_all()
    return (
        [(n.id, n.owner_id, n.content, n.client_updated_at, n.deleted_at)
         for n in db.scalars(select(Note).order_by(Note.id))],
        [(d.id, d.owner_id, d.device_id, d.is_active)
         for d in db.scalars(select(UserDevice).order_by(UserDevice.id))],
    )


@pytest.mark.parametrize("required,mode", [(True, "token"), (True, "web"),
                                           (False, "token"), (False, "web"),
                                           (False, "legacy")])
@pytest.mark.parametrize("state", ["existing", "new", "stale"])
@pytest.mark.parametrize("position", [0, 1, 2])
def test_cross_owner_entire_batch_rejected(client, db, monkeypatch, auth, required, mode, state, position):
    from app.core.config import get_settings
    from app.models.note import Note

    monkeypatch.setattr(get_settings(), "user_token_required", required)
    foreign = note("member", client_updated_at="2026-10-29T13:00:00")
    if state != "new":
        db.add(Note(owner_id="member", device_id=foreign["device_id"],
                    local_id=foreign["local_id"], note_type="daily", title="private",
                    content="E0_PRIVATE_ORIGINAL", client_updated_at=datetime(2026, 10, 29, 12)))
        db.commit()
    if state == "stale":
        foreign["client_updated_at"] = "2026-10-28T12:00:00"
    notes = [note(), note()]
    notes.insert(position, foreign)
    before = snapshot(db)
    response = client.post("/api/v1/sync", headers=auth[mode], json={
        "owner_id": "sinsan", "device_id": "e0-unregistered-" + uuid4().hex, "notes": notes})
    assert response.status_code == 403, response.text
    assert response.json() == {"detail": "owner_mismatch"}
    assert snapshot(db) == before


@pytest.mark.parametrize("nested", [" sinsan", "sinsan ", "SINSAN", ""])
def test_owner_comparison_is_exact_not_normalized(client, db, monkeypatch, auth, nested):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "user_token_required", True)
    before = snapshot(db)
    response = client.post("/api/v1/sync", headers=auth["token"], json={
        "owner_id": "sinsan", "device_id": "e0-unregistered-" + uuid4().hex,
        "notes": [note(nested)]})
    assert response.status_code == 403
    assert response.json() == {"detail": "owner_mismatch"}
    assert snapshot(db) == before


@pytest.mark.parametrize("count", [0, 1, 3])
@pytest.mark.parametrize("required,mode", [(True, "token"), (True, "web"), (False, "legacy")])
def test_matching_owner_success(client, db, monkeypatch, auth, count, required, mode):
    from app.core.config import get_settings
    monkeypatch.setattr(get_settings(), "user_token_required", required)
    notes = [note() for _ in range(count)]
    response = client.post("/api/v1/sync", headers=auth[mode], json={
        "owner_id": "sinsan", "device_id": "e0-outer-" + uuid4().hex, "notes": notes})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["server_time"]
    assert len(result["pushed_notes"]) == count
    pulled = {n["local_id"] for n in result["pulled_notes"]}
    assert {n["local_id"] for n in notes} <= pulled


def test_timestamp_delete_and_parent_rollback(client, db, monkeypatch, auth):
    from app.core.config import get_settings
    from app.models.note import Note
    monkeypatch.setattr(get_settings(), "user_token_required", True)
    item = note(client_updated_at="2026-10-29T12:00:00")
    body = {"owner_id": "sinsan", "device_id": "e0-outer-" + uuid4().hex}

    def send(notes):
        return client.post("/api/v1/sync", headers=auth["token"], json={**body, "notes": notes})

    assert send([item]).status_code == 200
    stale = {**item, "content": "stale", "client_updated_at": "2026-10-28T12:00:00"}
    result = send([stale])
    assert result.status_code == 200
    assert result.json()["pushed_notes"][0]["content"] == "attempt"
    deleted = {**item, "deleted_at": "2026-10-29T13:00:00", "client_updated_at": "2026-10-29T13:00:00"}
    assert send([deleted]).json()["pushed_notes"][0]["deleted_at"]
    before = [(n.id, n.content) for n in db.scalars(select(Note).order_by(Note.id))]
    bad = note(note_type="tree", level=2, parent_local_id="e0-missing-" + uuid4().hex)
    assert send([note(), bad]).status_code == 400
    db.expire_all()
    assert [(n.id, n.content) for n in db.scalars(select(Note).order_by(Note.id))] == before


def test_auth_and_notes_sync_control(client, db, monkeypatch, auth):
    from app.core.config import get_settings
    from app.models.note import UserDevice
    monkeypatch.setattr(get_settings(), "user_token_required", True)
    body = {"owner_id": "sinsan", "device_id": "e0-outer-" + uuid4().hex, "notes": [note()]}
    before = snapshot(db)
    for headers in [{}, {"X-Now-User-Token": "invalid-synthetic-token"}]:
        assert client.post("/api/v1/sync", headers=headers, json=body).status_code == 401
    assert snapshot(db) == before
    device = UserDevice(owner_id="sinsan", device_id=body["device_id"], is_active=0)
    db.add(device)
    db.commit()
    assert client.post("/api/v1/sync", headers=auth["token"], json=body).status_code == 403
    before = snapshot(db)
    response = client.post("/api/v1/notes/sync", headers=auth["token"], json={"notes": [note("member")]})
    assert response.status_code == 401
    assert snapshot(db) == before


def test_legacy_api_token_policy_preserved(client, db, monkeypatch, auth):
    from app.core.config import get_settings
    settings = get_settings()
    monkeypatch.setattr(settings, "user_token_required", False)
    monkeypatch.setattr(settings, "api_token", "synthetic-e0-api-only")
    body = {"owner_id": "sinsan", "device_id": "e0-outer-" + uuid4().hex,
            "notes": [note("member")]}
    before = snapshot(db)
    assert client.post("/api/v1/sync", json=body).status_code == 401
    headers = {"Authorization": "Bearer synthetic-e0-api-only"}
    response = client.post("/api/v1/sync", headers=headers, json=body)
    assert response.status_code == 403
    assert response.json() == {"detail": "owner_mismatch"}
    assert snapshot(db) == before
    response = client.post("/api/v1/sync", headers=headers, json={**body, "notes": [note()]})
    assert response.status_code == 200
