"""Wiki trash is metadata-only; actual auth and disposable Note history remain intact."""
import json
from copy import deepcopy
from uuid import uuid4

import pytest
from sqlalchemy import select

from .test_note_v2 import subject, based, get_current
from .test_wikis import make, put, approved


def state(client, s, path):
    result = client.get(path, params={"owner_id": s["owner"]}, headers=s["headers"])
    assert result.status_code == 200, result.text
    return result.json()


def command(s, version):
    return {"owner_id": s["owner"], "schema_version": 1, "base_version": version,
            "mutation_id": str(uuid4()), "device_id": "actor"}


def history(s):
    from app.models.note import Note
    from app.models.note_history import NoteHead, NoteRevision
    from app.models.note_v2 import NoteMutation, NoteOfflineBranch
    db = s["db"]
    db.expire_all()
    result = []
    for model in (Note, NoteHead, NoteRevision, NoteOfflineBranch, NoteMutation):
        result.append(sorted((tuple(getattr(row, col.name) for col in model.__table__.columns)
                              for row in db.scalars(select(model).where(model.owner_id == s["owner"]))), key=repr))
    db.rollback()
    return result


def test_trash_restore_preserves_all_content_history_dependencies_and_fixed_receipts(client, subject):
    s = subject
    _, doc, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    update = based(request, get_current(client, s, request["local_id"]))
    update["note"]["content"] = json.dumps(approved(doc, s["owner"]))
    assert put(client, s, path, update).status_code == 200
    before, graph = state(client, s, path), history(s)
    trash = command(s, before["resource"]["version"])
    response = client.post(path + "/trash", json=trash, headers=s["headers"])
    assert response.status_code == 200, response.text
    receipt = response.json()
    assert receipt["resource"]["deleted_at"]
    assert receipt["resource"]["payload"] == before["resource"]["payload"]
    assert receipt["resource"]["version"] == trash["base_version"] + 1
    assert client.get("/api/v1/wikis", params={"owner_id": s["owner"]}, headers=s["headers"]).json()["items"] == []
    assert len(client.get("/api/v1/wikis", params={"owner_id": s["owner"], "include_deleted": True}, headers=s["headers"]).json()["items"]) == 1
    assert state(client, s, path)["artifact"]["document"] is None
    assert history(s) == graph
    from .test_note_crypto import ROOT, prepare_body
    denied = client.post(ROOT, json=prepare_body(client, s, "wiki-source"), headers=s["headers"])
    assert denied.status_code == 409
    assert denied.json()["detail"]["code"] == "wiki_protection_required"
    restore = command(s, receipt["resource"]["version"])
    restored = client.post(path + "/restore", json=restore, headers=s["web"])
    assert restored.status_code == 200, restored.text
    assert restored.json()["resource"]["deleted_at"] is None
    assert state(client, s, path)["artifact"]["document"] == before["artifact"]["document"]
    assert client.post(path + "/trash", json=trash, headers=s["headers"]).json() == receipt
    assert state(client, s, path)["resource"]["deleted_at"] is None
    assert history(s) == graph
    from app.models.library import LibraryMutation
    ledger = " ".join(s["db"].scalars(select(LibraryMutation.response_json).where(LibraryMutation.owner_id == s["owner"])))
    assert all(text not in ledger for text in ("Original quote", "Generated body", "Private topic", "Private generated title"))


def test_lifecycle_cas_actor_auth_and_uuid_reuse_cannot_change_or_reveal_other_accounts(client, subject):
    s = subject
    _, _, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    initial = state(client, s, path)["resource"]
    from app.models.note import UserDevice
    s["db"].add(UserDevice(owner_id=s["owner"], device_id="inactive", is_active=0))
    s["db"].commit()
    for changes, expected in (({"base_version": 0}, (409,)), ({"device_id": "inactive"}, (403,)),
                              ({"owner_id": s["other"]}, (401, 403)), ({"content": "not allowed"}, (422,))):
        payload = {**command(s, initial["version"]), **changes}
        response = client.post(path + "/trash", json=payload, headers=s["headers"])
        assert response.status_code in expected, response.text
        assert "Generated body" not in response.text
        assert state(client, s, path)["resource"] == initial
    payload = command(s, initial["version"])
    payload["mutation_id"] = request["mutation_id"]
    mismatch = client.post(path + "/trash", json=payload, headers=s["headers"])
    assert mismatch.status_code == 409
    assert mismatch.json()["detail"]["code"] == "idempotency_mismatch"
    assert client.post(path + "/restore", json=command(s, initial["version"]), headers=s["headers"]).status_code == 409
    assert client.post(path + "/trash", json=command(s, initial["version"])).status_code in (401, 403)
    assert state(client, s, path)["resource"] == initial


def test_protected_wiki_trash_restore_needs_no_key_and_v3_retains_tombstone_and_cipher_graph(client, subject, tmp_path):
    from .test_note_crypto_conversion import convert
    from app.services.note_backup import export_snapshot, validate_backup
    s = subject
    _, _, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    convert(client, s, request["local_id"])
    before, graph = state(client, s, path), history(s)
    assert before["artifact"]["protected"] is True
    trashed = client.post(path + "/trash", json=command(s, before["resource"]["version"]), headers=s["headers"])
    assert trashed.status_code == 200, trashed.text
    assert history(s) == graph
    s["db"].rollback()
    backup = export_snapshot(s["db"])
    validate_backup(backup)
    assert "Generated body" not in json.dumps(backup)
    resources = [r for r in backup["items"]["library_resources"] if r["owner_id"] == s["owner"] and r["kind"] == "wikis"]
    assert len(resources) == 1 and resources[0]["deleted_at"]
    s["db"].rollback()
    from app.db import Base
    from app.services.note_backup import restore_empty
    from app.services.wikis import lifecycle, get
    from app.schemas.wiki import WikiLifecycle
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    target = create_engine(f"sqlite:///{tmp_path / 'trashed-wiki-restore.db'}")
    try:
        Base.metadata.create_all(target)
        restore_empty(target, backup)
        with Session(target) as restored_db:
            view = get(restored_db, s["owner"], path.rsplit("/", 1)[1])
            assert view["resource"] == trashed.json()["resource"]
            assert view["artifact"]["protected"] is True and view["artifact"]["document"] is None
            restored = lifecycle(restored_db, path.rsplit("/", 1)[1],
                                 WikiLifecycle.model_validate(command(s, view["resource"]["version"])), restoring=True)
            assert restored["resource"]["deleted_at"] is None
            roundtrip = export_snapshot(restored_db)
            validate_backup(roundtrip)
            assert "Generated body" not in json.dumps(roundtrip)
    finally:
        target.dispose()
    restored = client.post(path + "/restore", json=command(s, trashed.json()["resource"]["version"]), headers=s["headers"])
    assert restored.status_code == 200, restored.text
    assert restored.json()["resource"]["payload"] == before["resource"]["payload"]
    assert history(s) == graph


def test_trash_cannot_be_reversed_by_late_ordinary_wiki_put_or_branch_import(client, subject):
    s = subject
    _, doc, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    original = get_current(client, s, request["local_id"])
    first = state(client, s, path)["resource"]
    trashed = client.post(path + "/trash", json=command(s, first["version"]), headers=s["headers"])
    assert trashed.status_code == 200
    graph = history(s)
    update = based(request, original)
    update["note"]["content"] = json.dumps(approved(doc, s["owner"]))
    denied = put(client, s, path, update)
    assert denied.status_code == 409 and denied.json()["detail"]["code"] == "resource_deleted"
    imported = {k: update[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "crypto_epoch")}
    imported.update(mutation_id=str(uuid4()), entries=[{"revision_id": str(uuid4()), "parent_ref": None,
                     "snapshot": {"schema_version": 1, "note": original["snapshot"]["note"]}}])
    denied = client.post(path + "/revisions/import", json=imported, headers=s["headers"])
    assert denied.status_code == 409 and denied.json()["detail"]["code"] == "resource_deleted"
    assert state(client, s, path)["resource"] == trashed.json()["resource"]
    assert history(s) == graph


def test_original_receipt_replay_precedes_new_crypto_fence_and_stale_cas_checks(client, subject):
    from .test_note_crypto import ROOT, prepare_body
    s = subject
    _, _, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    initial = state(client, s, path)["resource"]
    trash = command(s, initial["version"])
    receipt = client.post(path + "/trash", json=trash, headers=s["headers"])
    assert receipt.status_code == 200
    restored = client.post(path + "/restore", json=command(s, receipt.json()["resource"]["version"]), headers=s["headers"])
    assert restored.status_code == 200
    fence = client.post(ROOT, json=prepare_body(client, s, request["local_id"]), headers=s["headers"])
    assert fence.status_code == 201, fence.text
    assert client.post(path + "/trash", json=trash, headers=s["headers"]).json() == receipt.json()
    denied = client.post(path + "/trash", json=command(s, restored.json()["resource"]["version"]), headers=s["headers"])
    assert denied.status_code == 423, denied.text
    assert state(client, s, path)["resource"] == restored.json()["resource"]


def test_lifecycle_receipt_insert_failure_rolls_back_index_and_leaves_history_untouched(client, subject):
    from sqlalchemy import event
    from app.models.library import LibraryMutation
    s = subject
    _, _, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    initial, graph = state(client, s, path)["resource"], history(s)
    payload = command(s, initial["version"])
    def fail_receipt(_mapper, _connection, row):
        if row.owner_id == s["owner"] and row.mutation_id == payload["mutation_id"]:
            raise RuntimeError("synthetic_lifecycle_receipt_failure")
    event.listen(LibraryMutation, "before_insert", fail_receipt)
    try:
        response = client.post(path + "/trash", json=payload, headers=s["headers"])
        assert response.status_code == 500
    finally:
        event.remove(LibraryMutation, "before_insert", fail_receipt)
    assert state(client, s, path)["resource"] == initial
    assert history(s) == graph
    assert client.post(path + "/trash", json=payload, headers=s["headers"]).status_code == 200


def test_restore_obeys_active_wiki_capacity_without_losing_the_trashed_resource(client, subject):
    s = subject
    _, doc, request, path = make(client, s)
    assert put(client, s, path, request).status_code == 200
    initial = state(client, s, path)["resource"]
    trashed = client.post(path + "/trash", json=command(s, initial["version"]), headers=s["headers"])
    assert trashed.status_code == 200
    last = None
    for _ in range(100):
        value = deepcopy(doc)
        value["wiki_id"] = str(uuid4())
        payload = deepcopy(request)
        payload.update(local_id="wiki:" + value["wiki_id"], mutation_id=str(uuid4()))
        payload["note"].update(title="AI Wiki " + value["wiki_id"], content=json.dumps(value))
        last = "/api/v1/wikis/" + value["wiki_id"]
        response = put(client, s, last, payload)
        assert response.status_code == 200, response.text
    restore = command(s, trashed.json()["resource"]["version"])
    denied = client.post(path + "/restore", json=restore, headers=s["headers"])
    assert denied.status_code == 409 and denied.json()["detail"]["code"] == "resource_limit"
    assert state(client, s, path)["resource"] == trashed.json()["resource"]
    assert client.post(last + "/trash", json=command(s, 1), headers=s["headers"]).status_code == 200
    # The rejected request never committed and can safely use the same fixed mutation.
    assert client.post(path + "/restore", json=restore, headers=s["headers"]).status_code == 200
