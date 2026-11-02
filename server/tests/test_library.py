"""사용자 자원의 권한, 재시도, 충돌, 백업 경계."""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest


def request_body(kind, version=0, **extra):
    payload = ({"name": "양식", "content_template": "# {{title}}"}
               if kind == "templates" else {"name": "조건", "filter": {"favorite": True}})
    return {"owner_id": "sinsan", "schema_version": 1, "base_version": version,
            "mutation_id": str(uuid4()), "payload": payload, **extra}


@pytest.mark.parametrize("kind", ["templates", "saved-queries"])
def test_resource_roundtrip_replay_conflict_and_tombstone(client, user_sinsan, kind):
    headers = {"X-Now-Web-Session": user_sinsan[1]}
    path = f"/api/v1/{kind}/{uuid4()}"
    body = request_body(kind)
    created = client.put(path, json=body, headers=headers)
    assert created.status_code == 200, created.text
    assert created.json()["resource"]["version"] == 1
    assert client.put(path, json=body, headers=headers).json() == created.json()
    conflict = client.put(path, json=request_body(kind), headers=headers)
    assert conflict.status_code == 409
    changed = client.put(path, json=request_body(kind, 1), headers=headers)
    assert changed.json()["resource"]["version"] == 2
    delete = request_body(kind, 2)
    delete.pop("payload")
    deleted = client.request("DELETE", path, json=delete, headers=headers)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["resource"]["deleted_at"]
    assert deleted.json()["resource"]["payload"] is None
    assert client.request("DELETE", path, json=delete, headers=headers).json() == deleted.json()
    assert client.put(path, json=body, headers=headers).json() == created.json()
    assert client.put(path, json=request_body(kind, 3), headers=headers).status_code == 409
    listing = client.get(f"/api/v1/{kind}", params={"owner_id": "sinsan", "include_deleted": True},
                         headers=headers).json()["items"]
    assert any(x["id"] == path.rsplit("/", 1)[1] and x["version"] == 3 and x["deleted_at"]
               for x in listing)
    live = client.get(f"/api/v1/{kind}", params={"owner_id": "sinsan"}, headers=headers).json()["items"]
    assert all(x["id"] != path.rsplit("/", 1)[1] for x in live)


def test_owner_isolation_and_required_auth(client, user_sinsan, user_member):
    path = f"/api/v1/templates/{uuid4()}"
    headers = {"X-Now-Web-Session": user_sinsan[1]}
    assert client.put(path, json=request_body("templates"), headers=headers).status_code == 200
    assert client.get("/api/v1/templates", params={"owner_id": "sinsan"}).status_code == 401
    forged = client.put(path, json=request_body("templates", owner_id="member"), headers=headers)
    assert forged.status_code in (401, 403)
    other = {"X-Now-Web-Session": user_member[1]}
    rows = client.get("/api/v1/templates", params={"owner_id": "member"}, headers=other)
    assert rows.status_code == 200
    assert all(x["owner_id"] == "member" for x in rows.json()["items"])
    delete = request_body("templates", 1, owner_id="member")
    delete.pop("payload")
    assert client.request("DELETE", path, json=delete, headers=other).status_code == 404


@pytest.mark.parametrize("change", [
    {"schema_version": 2}, {"unknown": True},
    {"payload": {"name": "x", "content_template": "x", "unknown": 1}},
    {"payload": {"name": "x", "content_template": "NOW_ENCRYPTED_V1:abc"}},
])
def test_templates_reject_unsupported_schema_fields_and_ciphertext(client, user_sinsan, change):
    res = client.put(f"/api/v1/templates/{uuid4()}", json=request_body("templates", **change),
                     headers={"X-Now-Web-Session": user_sinsan[1]})
    assert res.status_code == 422


def test_query_rejects_executable_or_unknown_conditions(client, user_sinsan):
    res = client.put(f"/api/v1/saved-queries/{uuid4()}",
                     json=request_body("saved-queries", payload={"name": "x", "filter": {"sql": "select 1"}}),
                     headers={"X-Now-Web-Session": user_sinsan[1]})
    assert res.status_code == 422


def test_mutation_id_cannot_be_reused_for_different_write(client, user_sinsan):
    body = request_body("templates")
    headers = {"X-Now-Web-Session": user_sinsan[1]}
    assert client.put(f"/api/v1/templates/{uuid4()}", json=body, headers=headers).status_code == 200
    res = client.put(f"/api/v1/templates/{uuid4()}", json=body, headers=headers)
    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "idempotency_mismatch"


@pytest.mark.parametrize("kind,size", [("templates", 1024 * 1024), ("saved-queries", 16 * 1024)])
def test_payload_limits_do_not_truncate(client, user_sinsan, kind, size):
    payload = ({"name": "x", "content_template": "가" * size} if kind == "templates"
               else {"name": "x", "filter": {"text": "가" * size}})
    res = client.put(f"/api/v1/{kind}/{uuid4()}", json=request_body(kind, payload=payload),
                     headers={"X-Now-Web-Session": user_sinsan[1]})
    assert res.status_code == 413


def test_parallel_update_delete_has_one_winner(client, user_sinsan):
    headers = {"X-Now-Web-Session": user_sinsan[1]}
    path = f"/api/v1/templates/{uuid4()}"
    assert client.put(path, json=request_body("templates"), headers=headers).status_code == 200
    update = request_body("templates", 1)
    delete = request_body("templates", 1)
    delete.pop("payload")
    with ThreadPoolExecutor(max_workers=2) as pool:
        calls = [pool.submit(client.put, path, json=update, headers=headers),
                 pool.submit(client.request, "DELETE", path, json=delete, headers=headers)]
        statuses = sorted(f.result().status_code for f in calls)
    assert statuses == [200, 409]


def test_library_backup_roundtrip_and_conflict_is_atomic(client, user_sinsan, tmp_path):
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from app.models.library import LibraryResource, LibraryMutation
    from app.services.library_backup import restore_library
    from app.api.admin import _verify_backup_payload

    headers = {"X-Now-Web-Session": user_sinsan[1]}
    assert client.put(f"/api/v1/templates/{uuid4()}", json=request_body("templates"),
                      headers=headers).status_code == 200
    exported = client.get("/api/v1/admin/export/all").json()
    assert exported["backup_schema_version"] == 2
    assert all(x["status"] == "ok" for x in _verify_backup_payload(exported))
    target = create_engine(f"sqlite:///{tmp_path / 'restore.db'}")
    LibraryResource.__table__.create(target)
    LibraryMutation.__table__.create(target)
    with Session(target) as session:
        restore_library(session, exported)
        before = session.scalars(select(LibraryResource)).all()
        assert len(before) == len(exported["items"]["library_resources"])
        assert session.scalars(select(LibraryMutation)).first() is not None
        with pytest.raises(ValueError):
            restore_library(session, exported)
        assert len(session.scalars(select(LibraryResource)).all()) == len(before)
    target.dispose()


def test_offline_restore_cli_preserves_existing_data_and_dry_run(client, user_sinsan, tmp_path):
    import json
    import os
    import sqlite3
    import subprocess
    import sys
    from pathlib import Path
    created = client.put(f"/api/v1/templates/{uuid4()}", json=request_body("templates"),
                         headers={"X-Now-Web-Session": user_sinsan[1]})
    assert created.status_code == 200
    backup_file = tmp_path / "backup.json"
    backup_file.write_text(json.dumps(client.get("/api/v1/admin/export/all").json()), encoding="utf-8")
    target_file = tmp_path / "offline.db"
    with sqlite3.connect(target_file) as connection:
        connection.execute("create table existing_notes (content text)")
        connection.execute("insert into existing_notes values ('preserved')")
    env = {**os.environ, "NOW_DATABASE_URL": f"sqlite:///{target_file.as_posix()}"}
    script = Path(__file__).resolve().parents[1] / "scripts" / "restore_library.py"
    command = [sys.executable, str(script), "--backup", str(backup_file)]
    dry = subprocess.run(command, env=env, capture_output=True)
    assert dry.returncode == 0, dry.stderr
    with sqlite3.connect(target_file) as connection:
        assert connection.execute("select name from sqlite_master where name='library_resources'").fetchall() == []
    applied = subprocess.run(command + ["--apply"], env=env, capture_output=True)
    assert applied.returncode == 0, applied.stderr
    with sqlite3.connect(target_file) as connection:
        assert connection.execute("select content from existing_notes").fetchone() == ("preserved",)
        assert connection.execute("select count(*) from library_resources").fetchone()[0] > 0


def test_v1_backup_verification_and_restore_preserves_new_resources(client, user_sinsan):
    from app.api.admin import _backup_content_sha256, _verify_backup_payload
    assert client.put(f"/api/v1/templates/{uuid4()}", json=request_body("templates"),
                      headers={"X-Now-Web-Session": user_sinsan[1]}).status_code == 200
    backup = client.get("/api/v1/admin/export/all").json()
    backup["backup_schema_version"] = 1
    backup["items"].pop("library_resources")
    backup["items"].pop("library_mutations")
    backup.pop("content_sha256")
    backup["content_sha256"] = _backup_content_sha256(backup)
    assert all(check["status"] == "ok" for check in _verify_backup_payload(backup))
    from app.db import SessionLocal
    from app.services.library_backup import restore_library
    from app.models.library import LibraryResource
    from sqlalchemy import select
    with SessionLocal() as db:
        ids = list(db.scalars(select(LibraryResource.id)))
        assert restore_library(db, backup) == {"library_resources": 0, "library_mutations": 0}
        assert list(db.scalars(select(LibraryResource.id))) == ids


def test_restore_quota_failure_has_no_partial_insert(client, user_member, tmp_path):
    from datetime import datetime
    from sqlalchemy import create_engine, func, select
    from sqlalchemy.orm import Session
    from app.models.library import LibraryResource, LibraryMutation
    from app.services.library_backup import restore_library
    assert client.put(f"/api/v1/templates/{uuid4()}",
                      json=request_body("templates", owner_id="member"),
                      headers={"X-Now-Web-Session": user_member[1]}).status_code == 200
    backup = client.get("/api/v1/admin/export/all").json()
    engine = create_engine(f"sqlite:///{tmp_path / 'quota.db'}")
    LibraryResource.__table__.create(engine)
    LibraryMutation.__table__.create(engine)
    with Session(engine) as db:
        for _ in range(100):
            db.add(LibraryResource(owner_id="member", kind="templates", id=str(uuid4()),
                   schema_version=1, version=1, payload_json='{"name":"x","content_template":""}',
                   created_at=datetime(2026, 10, 29), updated_at=datetime(2026, 10, 29)))
        db.commit()
        with pytest.raises(ValueError, match="resource limit"):
            restore_library(db, backup)
        assert db.scalar(select(func.count()).select_from(LibraryResource)) == 100
        assert db.scalar(select(func.count()).select_from(LibraryMutation)) == 0
    engine.dispose()


def test_mutation_backup_cannot_claim_another_owner(client, user_sinsan):
    from app.api.admin import _backup_content_sha256, _verify_backup_payload
    assert client.put(f"/api/v1/templates/{uuid4()}", json=request_body("templates"),
                      headers={"X-Now-Web-Session": user_sinsan[1]}).status_code == 200
    backup = client.get("/api/v1/admin/export/all").json()
    backup["items"]["library_mutations"][0]["owner_id"] = "outsider"
    backup.pop("content_sha256")
    backup["content_sha256"] = _backup_content_sha256(backup)
    assert any(check["status"] == "bad" for check in _verify_backup_payload(backup))


@pytest.mark.parametrize("database", ["sqlite", "postgresql"])
def test_real_database_race_quota_token_and_additive_schema(client, tmp_path, database):
    import os
    from datetime import datetime
    from sqlalchemy import create_engine, select, inspect
    from sqlalchemy.orm import Session
    from app.db import Base, get_db
    from app.main import app
    from app.models.library import LibraryResource, LibraryMutation
    from app.models.note import UserAccount
    from app.services.user_accounts import issue_user_device_access_token
    if database == "postgresql":
        url = os.environ.get("NOW_LIBRARY_TEST_POSTGRES_URL")
        if not url:
            pytest.skip("explicit disposable PostgreSQL URL required")
        from sqlalchemy.engine import make_url
        assert make_url(url).database == "nownote_stage_d_qa"
    else:
        url = f"sqlite:///{tmp_path / 'race.db'}"
    engine = create_engine(url)
    # 기존 계정 테이블/자료를 먼저 만든 뒤 additive 테이블 생성과 재실행을 검증한다.
    UserAccount.__table__.create(engine, checkfirst=True)
    owner = "stage_d_" + uuid4().hex[:10]
    with Session(engine) as db:
        db.add(UserAccount(owner_id=owner, email=owner + "@example.com"))
        db.commit()
    Base.metadata.create_all(engine)
    Base.metadata.create_all(engine)
    assert "library_resources" in inspect(engine).get_table_names()
    with Session(engine) as db:
        assert db.scalar(select(UserAccount).where(UserAccount.owner_id == owner))
        device, token = issue_user_device_access_token(db, owner_id=owner, device_id="stage-d",
                                                       display_name="합성 기기")
        db.commit()
    def test_db():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = test_db
    headers = {"X-Now-User-Token": token}
    try:
        path = f"/api/v1/templates/{uuid4()}"
        body = request_body("templates", owner_id=owner)
        created = client.put(path, json=body, headers=headers)
        assert created.status_code == 200, created.text
        update = request_body("templates", 1, owner_id=owner)
        deletion = request_body("templates", 1, owner_id=owner)
        deletion.pop("payload")
        with ThreadPoolExecutor(max_workers=2) as pool:
            calls = [pool.submit(client.put, path, json=update, headers=headers),
                     pool.submit(client.request, "DELETE", path, json=deletion, headers=headers)]
            assert sorted(f.result().status_code for f in calls) == [200, 409]
        # 같은 요청을 동시에 재전송해도 version/원장이 한 번만 증가해야 한다.
        path2 = f"/api/v1/templates/{uuid4()}"
        body2 = request_body("templates", owner_id=owner)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: client.put(path2, json=body2, headers=headers), range(2)))
        assert all(result.status_code == 200 for result in results)
        assert results[0].json() == results[1].json()
        with Session(engine) as db:
            active = list(db.scalars(select(LibraryResource).where(
                LibraryResource.owner_id == owner, LibraryResource.deleted_at.is_(None))))
            for _ in range(100 - len(active)):
                db.add(LibraryResource(owner_id=owner, kind="templates", id=str(uuid4()),
                       schema_version=1, version=1, payload_json='{"name":"x","content_template":""}',
                       created_at=datetime(2026, 10, 29), updated_at=datetime(2026, 10, 29)))
            db.commit()
        over = client.put(f"/api/v1/templates/{uuid4()}",
                          json=request_body("templates", owner_id=owner), headers=headers)
        assert over.status_code == 409
        assert over.json()["detail"]["code"] == "resource_limit"
        # 두 신규 테이블과 tombstone/원장을 새 대상에 복구한다.
        from app.services.library_backup import restore_library
        backup = client.get("/api/v1/admin/export/all").json()
        if database == "postgresql":
            from sqlalchemy import text
            schema = "restore_" + uuid4().hex
            with engine.begin() as connection:
                connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            target = engine.execution_options(schema_translate_map={None: schema})
        else:
            target = create_engine(f"sqlite:///{tmp_path / 'recovered.db'}")
        try:
            LibraryResource.__table__.create(target)
            LibraryMutation.__table__.create(target)
            with Session(target) as restored:
                counts = restore_library(restored, backup)
                assert counts["library_resources"] == len(backup["items"]["library_resources"])
                assert counts["library_mutations"] == len(backup["items"]["library_mutations"])
        finally:
            if database == "postgresql":
                with engine.begin() as connection:
                    connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
            else:
                target.dispose()
        assert client.get("/api/v1/templates", params={"owner_id": owner},
                          headers={"X-Now-User-Token": "wrong"}).status_code == 401
        with Session(engine) as db:
            from app.models.note import UserDevice
            db.scalar(select(UserDevice).where(UserDevice.owner_id == owner)).is_active = 0
            db.commit()
        assert client.get("/api/v1/templates", params={"owner_id": owner},
                          headers=headers).status_code == 403
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()
