"""A2b-R1 strict conversion version and active abort lease-CAS regressions."""
import base64
import json
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from .test_note_crypto import subject, ROOT as CONVERSION, prepare, query
from .test_note_crypto_conversion import seed, convert, manifest, stage as conversion_stage, commit_body, encrypt, digest
from .test_note_protected_writes import ROOT as QUOTE, qbody, quote, stage as quote_stage


def snapshot(s, local):
    from app.models.note import Note
    from app.models.note_history import NoteHead, NoteInventory, NoteRevision
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoEntry, NoteCryptoFence, NoteCryptoUpload, NoteCryptoChunk, NoteRepresentationOrigin
    s["db"].expire_all()
    ids = list(s["db"].scalars(select(NoteCryptoTransition.id).where(NoteCryptoTransition.owner_id == s["owner"], NoteCryptoTransition.local_id == local)))
    result = {}
    for model in (Note, NoteHead, NoteInventory, NoteRevision, NoteOfflineBranch, NoteCryptoTransition,
                  NoteCryptoFence, NoteRepresentationOrigin, NoteCryptoEntry, NoteCryptoUpload, NoteCryptoChunk):
        table = model.__table__
        statement = select(table).order_by(*table.primary_key.columns)
        if "owner_id" in table.c:
            statement = statement.where(table.c.owner_id == s["owner"], table.c.local_id == local)
        else:
            statement = statement.where(table.c.transition_id.in_(ids))
        result[table.name] = [tuple(row) for row in s["db"].execute(statement)]
    return result


def prepare_state(client, s, local, purpose, state):
    if purpose == "conversion":
        seed(client, s, local)
        b, t = prepare(client, s, local)
        items = manifest(client, s, local, t)
        root, ident, epoch = CONVERSION, t["transition_id"], t["target_epoch"]
        common = {"schema_version": 1, **query(s, local), "transition_id": ident}
        cb = None
        if state == "ready":
            _, _, verified = conversion_stage(client, s, local, t, items)
            cb = commit_body(s, local, b, t, verified)
    else:
        b = qbody(client, s, local)
        t = quote(client, s, b)
        items = t["required_entries"]
        root, ident, epoch = QUOTE, t["quote_id"], t["crypto_epoch"]
        common = {"schema_version": 1, **query(s, local), "quote_id": ident}
        cb = quote_stage(client, s, b, t)[0] if state == "ready" else None
    if state == "staging":
        item = next(i for i in items if i["key"]["kind"] == "note_body")
        raw = encrypt("synthetic staging", epoch).encode()
        response = client.put(root + "/chunks", json={**common, "entry_key": item["key"], "source_etag": item["source_etag"],
            "target_epoch": epoch, "chunk_index": 0, "total_chunks": 1, "total_bytes": len(raw),
            "chunk_sha256": digest(raw), "data_base64": base64.b64encode(raw).decode()}, headers=s["headers"])
        assert response.status_code == 200, response.text
    return root, ident, common, cb


@pytest.mark.parametrize("invalid_version", [True, 1.0], ids=["bool", "float"])
def test_r1_ready_conversion_rejects_non_integer_version_without_any_live_change(client, subject, invalid_version):
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "review-version"
    seed(client, s, local)
    first_cb, first_receipt, _, _ = convert(client, s, local)
    b, t = prepare(client, s, local)
    _, _, verified = conversion_stage(client, s, local, t, manifest(client, s, local, t))
    cb = commit_body(s, local, b, t, verified)
    s["db"].expire_all()
    row = s["db"].get(NoteCryptoTransition, t["transition_id"])
    assert row.state == "ready" and row.receipt_json is None
    c = json.loads(row.conditions_json); c["origin_metadata_version"] = invalid_version
    row.conditions_json = json.dumps(c, ensure_ascii=False, sort_keys=True, separators=(",", ":")); s["db"].commit()
    before = snapshot(s, local)
    r = client.post(CONVERSION + "/commit", json=cb, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    assert r.headers["cache-control"] == "no-store"
    assert snapshot(s, local) == before
    assert s["db"].get(NoteCryptoTransition, t["transition_id"]).receipt_json is None
    assert json.loads(s["db"].get(NoteCryptoTransition, first_cb["transition_id"]).receipt_json) == first_receipt["receipt"]


@pytest.mark.parametrize("purpose", ["conversion", "quote"])
@pytest.mark.parametrize("state", ["prepared", "staging", "ready"])
def test_active_abort_requires_current_lease_and_preserves_newer_work(client, subject, purpose, state):
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence
    s, local = subject, "review-abort"
    root, ident, common, _ = prepare_state(client, s, local, purpose, state)
    original_abort = {**common, "lease_version": 1}
    renewed = client.post(root + "/renew", json=original_abort, headers=s["headers"])
    assert renewed.status_code == 200 and renewed.json()["lease_version"] == 2
    before = snapshot(s, local)
    r = client.post(root + "/abort", json=original_abort, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "lease_changed", r.text
    assert r.headers["cache-control"] == "no-store"
    assert snapshot(s, local) == before
    assert s["db"].get(NoteCryptoTransition, ident).state == state
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)).transition_id == ident
    r = client.post(root + "/abort", json={**original_abort, "lease_version": 2}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "aborted"
    assert client.post(root + "/abort", json=original_abort, headers=s["headers"]).status_code == 200
    assert snapshot(s, local)["note_crypto_chunks"] == before["note_crypto_chunks"]


@pytest.mark.parametrize("purpose", ["conversion", "quote"])
@pytest.mark.parametrize("terminal", ["expired", "committed"])
def test_terminal_abort_semantics_unchanged(client, subject, purpose, terminal):
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "review-terminal"
    root, ident, common, cb = prepare_state(client, s, local, purpose, "ready")
    if terminal == "committed":
        assert client.post(root + "/commit", json=cb, headers=s["headers"]).status_code == 200
    else:
        s["db"].get(NoteCryptoTransition, ident).expires_at = datetime.utcnow() - timedelta(seconds=1)
        s["db"].commit()
        assert client.get(root + "/status", params={**query(s, local), "transition_id" if purpose == "conversion" else "quote_id": ident},
                          headers=s["headers"]).json()["state"] == "expired"
    before = snapshot(s, local)
    response = client.post(root + "/abort", json={**common, "lease_version": 1}, headers=s["headers"])
    assert response.status_code == (200 if terminal == "expired" else 409), response.text
    assert snapshot(s, local) == before


def test_stale_quote_abort_replay_preserves_other_active_fence(client, subject):
    from app.models.note import Note
    from app.models.note_crypto import NoteCryptoFence
    s, local = subject, "review-stale"
    b = qbody(client, s, local)
    q = quote(client, s, b)
    cb = quote_stage(client, s, b, q)[0]
    s["db"].add(Note(id=q["server_fields"]["id"], owner_id=s["other"], local_id="occupied", device_id="other",
                     note_type="daily", title="synthetic", content="preserve")); s["db"].commit()
    assert client.post(QUOTE + "/commit", json=cb, headers=s["headers"]).status_code == 409
    new_quote = quote(client, s, qbody(client, s, local))
    before = snapshot(s, local)
    r = client.post(QUOTE + "/abort", json={"schema_version": 1, **query(s, local), "quote_id": q["quote_id"], "lease_version": 99}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "stale", r.text
    assert snapshot(s, local) == before
    assert s["db"].get(NoteCryptoFence, (s["owner"], local)).transition_id == new_quote["quote_id"]
