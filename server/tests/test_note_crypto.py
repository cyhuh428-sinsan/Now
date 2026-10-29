"""E4a1 preparation only; real auth and disposable SQLite/PostgreSQL."""
import json
import os
from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from .test_note_v2 import subject as e2_subject, body, get_current


@pytest.fixture
def subject(client, tmp_path, monkeypatch):
    url = os.environ.get("NOW_E4A1_TEST_POSTGRES_URL")
    if url:
        from sqlalchemy.engine import make_url
        assert make_url(url).database == "nownote_e4a1_qa"
        # Reuse the real E2 authentication fixture without its PG name override.
        monkeypatch.delenv("NOW_E2_TEST_POSTGRES_URL", raising=False)
    fixture = e2_subject.__wrapped__(client, tmp_path, monkeypatch)
    value = next(fixture)
    if url:
        from app.db import Base, get_db
        from app.main import app
        from app.models.note import UserAccount, UserDevice, WebSession
        engine = create_engine(url)
        Base.metadata.create_all(engine)
        # Only copy this fixture's freshly generated synthetic auth rows.
        with Session(engine) as target:
            for model in (UserAccount, UserDevice, WebSession):
                for row in value["db"].scalars(select(model).where(model.owner_id.in_([value["owner"], value["other"]]))):
                    fields = {c.name: getattr(row, c.name) for c in model.__table__.columns if c.name != "id"}
                    target.add(model(**fields))
            target.commit()
        def backend():
            with Session(engine, autoflush=False) as db:
                yield db
        app.dependency_overrides[get_db] = backend
        value["db"].close()
        value.update(db=Session(engine, autoflush=False), engine=engine)
    try:
        yield value
    finally:
        value["db"].close()
        value["engine"].dispose()
        try:
            next(fixture)
        except StopIteration:
            pass


ROOT = "/api/v2/notes/crypto-transitions"


def query(s, local="note:/raw %?#", **extra):
    return {"owner_id": s["owner"], "local_id": local, "device_id": "actor", **extra}


def context(client, s, local="note:/raw %?#"):
    r = client.get(ROOT + "/status", params=query(s, local), headers=s["headers"])
    assert r.status_code == 200, r.text
    assert r.headers["cache-control"] == "no-store"
    return r.json()


def prepare_body(client, s, local="note:/raw %?#", **extra):
    state = context(client, s, local)
    return {"schema_version": 1, **query(s, local), "mutation_id": str(uuid4()),
            "server_instance_id": state["server_instance_id"], "crypto_epoch": state["crypto_epoch"],
            "target_epoch": state["crypto_epoch"] + 1,
            "base_head_version": state["head_version"], "base_revision_id": state["head_revision_id"],
            "expected_history_generation": state["history_generation"],
            "expected_inventory_revision_ids": state["inventory_revision_ids"], "local_branches": [], **extra}


def prepare(client, s, local="note:/raw %?#", **extra):
    b = prepare_body(client, s, local, **extra)
    r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    return b, r.json()


def test_identity_and_metadata_only_complete_manifest(client, subject):
    s = subject
    request = body(s, "note:/raw %?#", "SYNTHETIC_BODY_SENTINEL")
    assert client.put("/api/v2/notes/current", json=request, headers=s["headers"]).status_code == 200
    current = get_current(client, s, request["local_id"])
    request.update(mutation_id=str(uuid4()), base_head_version=current["head_version"],
                   base_revision_id=current["head_revision_id"], expected_inventory_revision_ids=current["inventory_revision_ids"])
    request["note"]["content"] = "SECOND_SENTINEL"
    assert client.put("/api/v2/notes/current", json=request, headers=s["headers"]).status_code == 200
    b, transition = prepare(client, s)
    repeated = client.post(ROOT, json=b, headers=s["web"])
    assert repeated.status_code == 200 and repeated.json() == transition
    items, cursor = [], None
    while True:
        r = client.get(ROOT + "/manifest", params=query(s, transition_id=transition["transition_id"], limit=2,
                                                       **({"cursor": cursor} if cursor else {})), headers=s["headers"])
        assert r.status_code == 200, r.text
        page = r.json(); items.extend(page["items"]); cursor = page["next_cursor"]
        if not cursor:
            break
    assert len(items) == 5  # Note + two after + one before + inventory.
    assert len({json.dumps(i["key"], sort_keys=True) for i in items}) == 5
    assert "SENTINEL" not in json.dumps(items)
    for item in items:
        r = client.get(ROOT + "/source", params=query(s, transition_id=transition["transition_id"],
            kind=item["key"]["kind"], representation_id=item["key"]["id"], slot=item["key"]["slot"],
            source_etag=item["source_etag"]), headers=s["headers"])
        assert r.status_code == 200 and r.headers["cache-control"] == "no-store", r.text
        assert "SENTINEL" in r.json()["value"]
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry
    s["db"].expire_all()
    stored = s["db"].get(NoteCryptoTransition, transition["transition_id"])
    assert "SENTINEL" not in stored.conditions_json
    for entry in s["db"].scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == stored.id)):
        assert "SENTINEL" not in json.dumps({c.name: getattr(entry, c.name) for c in entry.__table__.columns})
    assert context(client, s)["server_instance_id"] == b["server_instance_id"]
    assert client.post(ROOT + "/commit", json=b, headers=s["headers"]).status_code in (404, 405)


def test_fence_batch_direct_capture_renew_abort_and_expiry(client, subject):
    s = subject
    assert client.put("/api/v2/notes/current", json=body(s, content="original"), headers=s["headers"]).status_code == 200
    local = body(s)["local_id"]
    b, t = prepare(client, s, local)
    assert client.put("/api/v2/notes/current", json=body(s, local), headers=s["headers"]).status_code == 423
    ordinary = {**body(s, "unaffected")["note"], **query(s, "unaffected")}
    blocked = {**ordinary, "local_id": local}
    r = client.post("/api/v1/sync", json={"owner_id": s["owner"], "device_id": "brand-new",
            "notes": [ordinary, blocked]}, headers=s["headers"])
    assert r.status_code == 423, r.text
    from app.models.note import Note, UserDevice
    assert s["db"].scalar(select(Note).where(Note.owner_id == s["owner"], Note.local_id == "unaffected")) is None
    assert s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "brand-new")) is None
    with Session(s["engine"], autoflush=False) as db:
        row = db.scalar(select(Note).where(Note.owner_id == s["owner"], Note.local_id == local))
        row.content = "must rollback"
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as raised:
            db.commit()
        assert raised.value.status_code == 423
        db.rollback()
    action = {"schema_version": 1, **query(s, local), "transition_id": t["transition_id"], "lease_version": t["lease_version"]}
    r = client.post(ROOT + "/renew", json=action, headers=s["headers"])
    assert r.status_code == 200 and r.json()["lease_version"] == t["lease_version"] + 1
    assert client.post(ROOT + "/renew", json=action, headers=s["headers"]).status_code == 409
    r = client.post(ROOT + "/abort", json=action, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "aborted"
    assert client.post(ROOT + "/abort", json=action, headers=s["headers"]).status_code == 200
    b, t = prepare(client, s, local)
    from app.models.note_crypto import NoteCryptoTransition
    s["db"].expire_all(); row = s["db"].get(NoteCryptoTransition, t["transition_id"])
    row.expires_at = datetime.utcnow() - timedelta(seconds=1); s["db"].commit()
    assert client.get(ROOT + "/status", params=query(s, local, transition_id=t["transition_id"]), headers=s["headers"]).json()["state"] == "expired"
    assert client.post(ROOT + "/renew", json={**action, "transition_id": t["transition_id"]}, headers=s["headers"]).status_code == 410
    assert client.post("/api/v1/sync", json={"owner_id": s["owner"], "device_id": "actor", "notes": [blocked]}, headers=s["headers"]).status_code == 200


@pytest.mark.parametrize("identity", ["branch_only", "ambiguous"])
def test_noncoherent_complete_preparation_without_fake_current(client, subject, identity):
    from app.models.note import Note
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_history import NoteHead
    s, local = subject, ""
    if identity == "branch_only":
        s["db"].add(NoteHead(owner_id=s["owner"], local_id=local, version=0, identity_state=identity,
                            crypto_epoch=0, history_generation=1))
        s["db"].add(NoteOfflineBranch(id=str(uuid4()), owner_id=s["owner"], local_id=local,
            origin_device_id="actor", snapshot_json='{"synthetic":"branch"}'))
    else:
        for kind in ["daily", "tree"]:
            s["db"].add(Note(owner_id=s["owner"], device_id=kind, local_id=local, note_type=kind, title="raw", content=kind))
    s["db"].commit()
    _, t = prepare(client, s, local)
    state = context(client, s, local)
    assert state["identity_state"] == identity and state["head_revision_id"] is None
    s["db"].expire_all()
    assert len(list(s["db"].scalars(select(Note).where(Note.owner_id == s["owner"], Note.local_id == local)))) == (0 if identity == "branch_only" else 2)
    assert t["expected_count"] == (1 if identity == "branch_only" else 6)


def test_related_text_and_strict_owner_actor_cas(client, subject):
    from app.models.note import AnalysisJob, UserDevice
    s = subject
    b = prepare_body(client, s)
    for invalid, code in [({**b, "target_epoch": 3}, 409), ({**b, "base_head_version": 42}, 409),
                          ({**b, "server_instance_id": str(uuid4())}, 409), ({**b, "schema_version": True}, 422),
                          ({**b, "extra": "forbidden"}, 422)]:
        r = client.post(ROOT, json=invalid, headers=s["headers"])
        assert r.status_code == code and r.headers["cache-control"] == "no-store", r.text
    assert client.post(ROOT, json=b).status_code == 401
    assert client.post(ROOT, json={**b, "owner_id": s["other"]}, headers=s["headers"]).status_code in (401, 403)
    s["db"].add(AnalysisJob(owner_id=s["owner"], note_local_id=b["local_id"], job_type="memo_summary", input_text="private"))
    s["db"].commit()
    r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "related_plaintext_unresolved"
    b, t = prepare(client, s, "safe")
    actor = s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "actor"))
    actor.is_active = 0; s["db"].commit()
    assert client.post(ROOT, json=b, headers=s["web"]).status_code == 403
    assert client.get(ROOT + "/status", params=query(s, "safe", transition_id=t["transition_id"]), headers=s["web"]).status_code == 403


def test_request_size_limit_without_body_echo(client, subject):
    b = prepare_body(client, subject)
    r = client.post(ROOT, content=json.dumps({**b, "untrusted": "X" * (1024 * 1024)}),
                    headers={**subject["headers"], "Content-Type": "application/json"})
    assert r.status_code == 413
    assert r.headers["cache-control"] == "no-store" and len(r.content) < 500


@pytest.mark.parametrize("corruption", ["identity", "epoch"])
def test_inconsistent_identity_and_representation_fail_closed(client, subject, corruption):
    from app.models.note_history import NoteHead, NoteRevision
    s, local = subject, "corrupt"
    assert client.put("/api/v2/notes/current", json=body(s, local), headers=s["headers"]).status_code == 200
    b = prepare_body(client, s, local)
    s["db"].expire_all()
    head = s["db"].get(NoteHead, (s["owner"], local))
    if corruption == "identity":
        head.identity_state = "branch_only"
    else:
        s["db"].get(NoteRevision, head.head_revision_id).representation_epoch = 9
    s["db"].commit()
    r = client.post(ROOT, json=b, headers=s["headers"])
    assert r.status_code == 409, r.text
    from app.models.note_crypto import NoteCryptoFence
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None


def test_reserved_branches_dag_cursor_owner_and_source_isolation(client, subject):
    s = subject
    first, second = str(uuid4()), str(uuid4())
    reserved = [{"revision_id": first, "parent_ref": None, "origin_device_id": "offline"},
                {"revision_id": second, "parent_ref": {"kind": "offline_branch", "id": first}, "origin_device_id": "offline"}]
    b, t = prepare(client, s, "reserved", local_branches=reserved)
    assert t["expected_count"] == 2 and t["base"]["current_exists"] is False
    page = client.get(ROOT + "/manifest", params=query(s, "reserved", transition_id=t["transition_id"], limit=1), headers=s["headers"]).json()
    item = page["items"][0]
    params = query(s, "reserved", transition_id=t["transition_id"], kind=item["key"]["kind"],
                   representation_id=item["key"]["id"], slot=item["key"]["slot"], source_etag=item["source_etag"])
    assert client.get(ROOT + "/source", params=params, headers=s["headers"]).status_code == 409
    assert client.get(ROOT + "/manifest", params=query(s, "different", transition_id=t["transition_id"]), headers=s["headers"]).status_code == 404
    _, other = prepare(client, s, "second-reserved")
    assert client.get(ROOT + "/manifest", params=query(s, "second-reserved", transition_id=other["transition_id"], cursor=page["next_cursor"]), headers=s["headers"]).status_code == 409
    assert client.get(ROOT + "/manifest", params=query(s, "reserved", transition_id=t["transition_id"], cursor="not base64!"), headers=s["headers"]).status_code == 422
    s["db"].expire_all()
    from app.models.note_v2 import NoteOfflineBranch
    assert s["db"].get(NoteOfflineBranch, first) is None
    cycle = [{**reserved[0], "parent_ref": {"kind": "offline_branch", "id": first}}]
    r = client.post(ROOT, json=prepare_body(client, s, "cycle", local_branches=cycle), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "invalid_revision_parent"
    altered = {**b, "local_branches": []}
    assert client.post(ROOT, json=altered, headers=s["headers"]).status_code == 409


def test_preparation_failure_rolls_back_manifest_and_fence(client, subject):
    from sqlalchemy import event
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence, NoteCryptoEntry
    s = subject
    assert client.put("/api/v2/notes/current", json=body(s, "failure"), headers=s["headers"]).status_code == 200
    b = prepare_body(client, s, "failure")
    def fail(conn, cursor, statement, parameters, context, executemany):
        if statement.lower().startswith("insert into note_crypto_entries"):
            raise RuntimeError("synthetic metadata failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post(ROOT, json=b, headers=s["headers"])
        assert r.status_code == 500 and r.headers["cache-control"] == "no-store"
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoFence, (s["owner"], "failure")) is None
    assert s["db"].scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == s["owner"])) is None
    assert list(s["db"].scalars(select(NoteCryptoEntry).join(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == s["owner"]))) == []
    assert get_current(client, s, "failure")["snapshot"]["note"]["content"] == "first"


def test_concurrent_prepare_and_renew_abort(client, subject):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import HTTPException
    from app.services import note_crypto as service
    from app.schemas.note_crypto import PrepareTransition, TransitionAction
    s = subject
    b = prepare_body(client, s, "race")
    def run_prepare(i):
        with Session(s["engine"], autoflush=False) as db:
            try:
                return service.prepare(db, PrepareTransition.model_validate({**b, "mutation_id": str(uuid4())}))["transition_id"]
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(run_prepare, range(2)))
    assert results.count(423) == 1
    ident = next(v for v in results if isinstance(v, str))
    action = TransitionAction(schema_version=1, **query(s, "race"), transition_id=ident, lease_version=1)
    def run_action(op):
        with Session(s["engine"], autoflush=False) as db:
            try:
                return service.action(db, action, op)["state"]
            except HTTPException as exc:
                return exc.status_code
    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(run_action, ["renew", "abort"]))
    assert "aborted" in results and all(v in ("prepared", "aborted", 409) for v in results)
    assert client.get(ROOT + "/status", params=query(s, "race", transition_id=ident), headers=s["headers"]).json()["state"] == "aborted"


def test_fence_other_legacy_routes_read_and_backup(client, subject):
    from app.api.admin import export_all
    from fastapi import HTTPException
    s, local = subject, "simple-local"
    assert client.put("/api/v2/notes/current", json=body(s, local), headers=s["headers"]).status_code == 200
    _, t = prepare(client, s, local)
    value = {**body(s, local)["note"], **query(s, local)}
    assert client.post("/api/v1/notes", json=value, headers=s["headers"]).status_code == 423
    assert client.post("/api/v1/notes/sync", json={"notes": [value]}, headers=s["headers"]).status_code == 423
    assert client.delete("/api/v1/notes/" + local, params={"owner_id": s["owner"]}, headers=s["headers"]).status_code == 423
    current = get_current(client, s, local)
    assert current["crypto_transition"]["transition_id"] == t["transition_id"]
    with Session(s["engine"], autoflush=False) as db:
        with pytest.raises(HTTPException) as raised:
            export_all(db)
        assert raised.value.status_code == 423
        db.rollback()
    assert client.put("/api/v2/notes/current", json=body(s, "unrelated"), headers=s["headers"]).status_code == 200


@pytest.mark.parametrize("shape", ["2.3.9", "E1", "E2", "E3"])
def test_concurrent_additive_startup_identity_survives(client, tmp_path, monkeypatch, shape):
    from concurrent.futures import ThreadPoolExecutor
    from sqlalchemy import inspect, text
    from sqlalchemy.schema import CreateSchema, DropSchema
    from app import db as database
    from app.models.note import Note, UserAccount
    from app.models.note_crypto import ServerIdentity
    from app.models.note_history import NoteHead, NoteRevision, NoteInventory
    from app.models.note_v2 import NoteMutation, NoteOfflineBranch
    url = os.environ.get("NOW_E4A1_TEST_POSTGRES_URL")
    admin, schema = None, None
    if url:
        from sqlalchemy.engine import make_url
        assert make_url(url).database == "nownote_e4a1_qa"
        admin = create_engine(url); schema = "e4a1_migration_" + uuid4().hex
        with admin.begin() as c:
            c.execute(CreateSchema(schema))
        engine = create_engine(url, connect_args={"options": "-c search_path=" + schema})
    else:
        engine = create_engine(f"sqlite:///{(tmp_path / 'startup.db').as_posix()}")
    try:
        database.Base.metadata.create_all(engine, tables=[Note.__table__, UserAccount.__table__])
        with engine.begin() as c:
            c.execute(Note.__table__.insert().values(id=17, owner_id="migration", device_id="original", local_id="raw:/",
                note_type="daily", title="raw", content="unchanged", tags=" raw,,tags\r\n", source=None,
                client_updated_at=datetime(2026, 1, 1, 1, 2, 3, 123456), created_at=datetime(2026, 1, 1), updated_at=datetime(2026, 1, 2)))
        if shape != "2.3.9":
            tables = [NoteHead.__table__, NoteRevision.__table__, NoteInventory.__table__]
            if shape in ("E2", "E3"):
                tables += [NoteMutation.__table__, NoteOfflineBranch.__table__]
            database.Base.metadata.create_all(engine, tables=tables)
            with engine.begin() as c:
                c.execute(NoteHead.__table__.insert().values(owner_id="migration", local_id="raw:/", version=4, identity_state="coherent"))
                if shape == "E1":
                    for name in ("protection_state", "crypto_epoch", "history_generation"):
                        c.execute(text("ALTER TABLE note_heads DROP COLUMN " + name))
                    for name in ("representation_epoch", "representation_kind"):
                        c.execute(text("ALTER TABLE note_revisions DROP COLUMN " + name))
        monkeypatch.setattr(database, "engine", engine)
        with ThreadPoolExecutor(2) as pool:
            list(pool.map(lambda _: database.create_tables(), range(2)))
        with Session(engine) as db:
            ident = db.get(ServerIdentity, 1).instance_id
            row = db.get(Note, 17)
            assert row.device_id == "original" and row.content == "unchanged" and row.tags == " raw,,tags\r\n"
            assert row.client_updated_at.microsecond == 123456
        database.create_tables()
        with Session(engine) as db:
            assert db.get(ServerIdentity, 1).instance_id == ident
            assert len(list(db.scalars(select(ServerIdentity)))) == 1
        assert inspect(engine).get_columns("note_revisions")[3]["name"] == "note_id"
        assert next(c for c in inspect(engine).get_columns("note_revisions") if c["name"] == "note_id")["nullable"] is False
    finally:
        engine.dispose()
        if admin:
            with admin.begin() as c:
                c.execute(DropSchema(schema, cascade=True))
            admin.dispose()
