"""Owner-only discovery metadata; existing auth and disposable SQLite storage."""
from uuid import uuid4

from sqlalchemy import event, select

from .test_note_crypto import subject, context

PATH = "/api/v2/notes/protection-targets"


def params(s, **extra):
    return {"schema_version": 3, "owner_id": s["owner"], "device_id": "actor", **extra}


def add_heads(s):
    from app.models.note_history import NoteHead
    rows = [NoteHead(owner_id=s["owner"], local_id=local, identity_state="related_only",
        protection_state="legacy", crypto_epoch=0, history_generation=0) for local in ("a", "b", "한글")]
    rows.append(NoteHead(owner_id=s["other"], local_id="foreign-hidden", identity_state="related_only"))
    s["db"].add_all(rows)
    s["db"].commit()


def test_owner_pages_metadata_only_and_no_writes(client, subject):
    s = subject
    identity = context(client, s)["server_instance_id"]
    add_heads(s)
    writes = []
    def capture(conn, cursor, statement, arguments, execution, many):
        if statement.lstrip().split()[0].upper() in {"INSERT", "UPDATE", "DELETE", "ALTER", "CREATE"}:
            writes.append(statement.split()[0])
    event.listen(s["engine"], "before_cursor_execute", capture)
    try:
        seen, cursor = [], None
        for _ in range(3):
            r = client.get(PATH, params=params(s, limit=1, **({"cursor": cursor} if cursor else {})), headers=s["headers"])
            assert r.status_code == 200, r.text
            assert r.headers["cache-control"] == "no-store"
            payload = r.json()
            assert set(payload) == {"schema_version", "server_instance_id", "items", "next_cursor"}
            assert payload["schema_version"] == 3 and payload["server_instance_id"] == identity
            assert len(payload["items"]) == 1
            row = payload["items"][0]
            assert set(row) == {"local_id", "identity_state", "protection_state", "crypto_epoch", "current_mode", "current_exists"}
            assert row["identity_state"] == "related_only" and row["current_mode"] == "absent" and row["current_exists"] is False
            assert "foreign-hidden" not in r.text
            seen.append(row["local_id"])
            cursor = payload["next_cursor"]
        assert seen == ["a", "b", "한글"] and cursor is None
        assert not writes
    finally:
        event.remove(s["engine"], "before_cursor_execute", capture)


def test_current_metadata_does_not_include_plain_or_cipher_body(client, subject):
    from .test_note_crypto_conversion import seed, convert
    s, local = subject, "metadata-only-current"
    seed(client, s, local, "QA-BODY-NEVER-IN-LIST")
    identity = context(client, s, local)["server_instance_id"]
    first = client.get(PATH, params=params(s), headers=s["headers"])
    assert first.status_code == 200 and first.json()["server_instance_id"] == identity
    row = next(item for item in first.json()["items"] if item["local_id"] == local)
    assert row["current_exists"] is True and row["current_mode"] == "plain" and row["crypto_epoch"] == 0
    convert(client, s, local)
    r = client.get(PATH, params=params(s), headers=s["headers"])
    assert r.status_code == 200, r.text
    row = next(item for item in r.json()["items"] if item["local_id"] == local)
    assert row["current_exists"] is True and row["current_mode"] == "protected" and row["crypto_epoch"] == 1
    assert "QA-BODY-NEVER-IN-LIST" not in r.text and "ciphertext" not in r.text and "title" not in row


def test_empty_authenticated_list_and_no_identity_creation(client, subject):
    from app.models.note_crypto import ServerIdentity
    s = subject
    r = client.get(PATH, params=params(s), headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "server_identity_unavailable"
    assert s["db"].scalar(select(ServerIdentity.id)) is None
    context(client, s)
    r = client.get(PATH, params=params(s), headers=s["headers"])
    assert r.status_code == 200 and r.json()["items"] == [] and r.json()["next_cursor"] is None


def test_foreign_owner_and_missing_auth_never_return_list(client, subject):
    s = subject
    context(client, s)
    add_heads(s)
    for headers, owner in [(s["headers"], s["other"]), ({}, s["owner"])]:
        r = client.get(PATH, params=params(s, owner_id=owner), headers=headers)
        assert r.status_code in (401, 403)
        assert "foreign-hidden" not in r.text and "items" not in r.json()


def test_unknown_or_inactive_device_never_registered_or_touched(client, subject):
    from app.models.note import UserDevice
    s = subject
    context(client, s)
    actor = s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "actor"))
    original = actor.last_seen_at
    r = client.get(PATH, params=params(s, device_id="never-registered"), headers=s["headers"])
    assert r.status_code == 403
    assert s["db"].scalar(select(UserDevice.id).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "never-registered")) is None
    actor.is_active = 0
    s["db"].commit()
    r = client.get(PATH, params=params(s), headers=s["web"])
    assert r.status_code == 403
    s["db"].expire_all()
    assert actor.last_seen_at == original


def test_strict_queries_and_cursor_scope(client, subject):
    import base64
    import json
    s = subject
    context(client, s)
    add_heads(s)
    first = client.get(PATH, params=params(s, limit=1), headers=s["headers"])
    assert first.status_code == 200, first.text
    cursor = first.json()["next_cursor"]
    decoded = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
    for field, value in [("owner_id", s["other"]), ("server_instance_id", str(uuid4()))]:
        bad = {**decoded, field: value}
        encoded = base64.urlsafe_b64encode(json.dumps(bad).encode()).decode().rstrip("=")
        r = client.get(PATH, params=params(s, cursor=encoded), headers=s["headers"])
        assert r.status_code == 422 and r.json()["detail"]["code"] == "invalid_cursor"
    for extra in [{"limit": 0}, {"limit": 101}, {"limit": "01"}, {"cursor": "broken"}, {"unknown": "field"}]:
        r = client.get(PATH, params=params(s, **extra), headers=s["headers"])
        assert r.status_code == 422
    r = client.get(PATH, params=list(params(s).items()) + [("owner_id", s["owner"])], headers=s["headers"])
    assert r.status_code == 422
