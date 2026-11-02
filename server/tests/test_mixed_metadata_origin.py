"""Read-only validated provenance is independent from creator-only controls."""
import json
from uuid import uuid4

import pytest
from sqlalchemy import select

from .test_note_crypto import subject
from .test_note_mixed import enabled, mcontext, rq, MR, ready_rc
from .test_note_mixed_related import settled, staged, MA, MT


def reader(s):
    from app.services.user_accounts import issue_user_device_access_token
    _, token = issue_user_device_access_token(s["db"], owner_id=s["owner"], device_id="reader", display_name="synthetic")
    s["db"].commit()
    return {"X-Now-User-Token": token}


def published(client, s, local, kind="analysis"):
    if kind == "analysis":
        b, _, raws, _ = settled(client, s, local)
        prefix = MA
    else:
        from app.models.note import Recording
        from .test_note_crypto_conversion import seed
        from .test_related_text import prepare, stage, ROOT
        seed(client, s, local)
        rec = Recording(owner_id=s["owner"], note_local_id=local, device_id="actor", local_id=str(uuid4()),
            file_name="fixture.wav", content_type="audio/wav", storage_path="synthetic.wav", transcript=None)
        s["db"].add(rec); s["db"].commit(); rid = rec.id
        b0, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b0, t)
        assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
        a, c = mcontext(client, s, local)
        ds = client.get(MR + "/catalog", params=rq(a, c), headers=s["headers"]).json()["entries"]
        d = next(d for d in ds if d["key"]["kind"] == "recording_transcript")
        b = {**a, "mutation_id": str(uuid4()), "base": c["context"], "expected_catalog_digest": c["catalog_digest"],
            "recording_id": rid, "expected_descriptor": d, "is_null": True}
        raws, prefix = {}, MT
    r = client.post(prefix + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json(); _, commit = staged(client, s, b, q, prefix, raws)
    r = client.post(prefix + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    return q, prefix


def metadata_args(client, s, local, headers, *, kind="analysis_error"):
    a, c = mcontext(client, s, local)
    a = {**a, "device_id": "reader"}
    r = client.get(MR + "/catalog", params=rq(a, c), headers=headers)
    assert r.status_code == 200, r.text
    d = next(d for d in r.json()["entries"] if d["key"]["kind"] == kind)
    k = d["key"]
    return {**rq(a, c), "kind": k["kind"], "representation_id": k["id"], "slot": k["slot"],
        "representation_etag": d["representation_etag"]}, d


@pytest.mark.parametrize("kind", ["analysis", "transcript"])
@pytest.mark.parametrize("rotate", [False, True])
@pytest.mark.parametrize("disabled_creator", [False, True])
def test_other_active_device_reads_original_origin_but_not_creator_status(client, subject, enabled, record_property, kind, rotate, disabled_creator):
    from app.models.note import UserDevice
    s, local = subject, "s1-reader"
    q, prefix = published(client, s, local, kind)
    expected = q["metadata_header"]["operation_origin"]
    if rotate:
        _, _, _, commit, _ = ready_rc(client, s, local, origins={q["operation_id"]: expected})
        r = client.post("/api/v2/notes/mixed-conversions/commit", json=commit, headers=s["headers"])
        assert r.status_code == 200, r.text
    headers = reader(s)
    params, d = metadata_args(client, s, local, headers, kind="analysis_error" if kind == "analysis" else "recording_transcript")
    if kind == "analysis":
        other, _ = metadata_args(client, s, local, headers, kind="analysis_input")
        nonnull = client.get(MR + "/metadata", params=other, headers=headers)
        assert nonnull.status_code == 200 and nonnull.json()["operation_origin"] == expected, nonnull.text
    if disabled_creator:
        actor = s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "actor"))
        actor.is_active = 0; s["db"].commit()
    r = client.get(MR + "/metadata", params=params, headers=headers)
    assert r.status_code == 200, r.text
    assert set(r.json()) == {"schema_version", "context", "catalog_digest", "descriptor", "operation_origin"}
    assert r.json()["operation_origin"] == expected
    assert r.json()["descriptor"] == d and d["is_null"]
    assert r.headers["cache-control"] == "no-store"
    if kind == "transcript" and not rotate and not disabled_creator:
        record_property("mr_metadata_example", json.dumps(r.json(), ensure_ascii=True, sort_keys=True))
    chunks = client.get(MR + "/representation", params={**params, "chunk_index": 0}, headers=headers)
    assert chunks.status_code == 200 and "operation_origin" not in chunks.json(), chunks.text
    assert chunks.json()["data_base64"] is None
    a = {k: params[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    control = client.get(prefix + "/status", params={**a, "operation_id": q["operation_id"]}, headers=headers)
    assert control.status_code == 403 and control.json()["detail"]["code"] == "transition_actor_mismatch", control.text


@pytest.mark.parametrize("damage", ["owner", "device", "inactive", "instance", "context", "catalog", "etag"])
def test_metadata_scope_and_frozen_query_are_still_required(client, subject, enabled, damage):
    from app.models.note import UserDevice
    s, local = subject, "s1-guard"
    published(client, s, local)
    headers = reader(s); params, _ = metadata_args(client, s, local, headers)
    if damage == "owner":
        params["owner_id"] = s["other"]
    elif damage == "device":
        params["device_id"] = "unregistered"
    elif damage == "inactive":
        row = s["db"].scalar(select(UserDevice).where(UserDevice.owner_id == s["owner"], UserDevice.device_id == "reader"))
        row.is_active = 0; s["db"].commit()
    elif damage == "instance":
        params["server_instance_id"] = str(uuid4())
    elif damage == "context":
        from app.services.note_mixed_read import decode, encode
        c = decode(params["expected_context"]); c["base"]["history_generation"] += 1
        params["expected_context"] = encode(c)
    elif damage == "catalog":
        params["catalog_digest"] = "0" * 64
    else:
        params["representation_etag"] = str(uuid4())
    r = client.get(MR + "/metadata", params=params, headers=headers)
    expected = 200 if damage == "device" else 401 if damage == "owner" else 403 if damage == "inactive" else 409
    assert r.status_code == expected, r.text
    if damage == "device":
        assert r.json()["operation_origin"]["purpose"] == "mixed_analysis_write"
        baseline = client.get(MR + "/representation", params={**params, "chunk_index": 0}, headers=headers)
        assert baseline.status_code == r.status_code, baseline.text
    else:
        assert "operation_origin" not in r.json()


@pytest.mark.parametrize("damage", ["missing", "unpublished", "receipt", "foreign_scope"])
def test_invalid_origin_is_not_returned_as_normal_null(client, subject, enabled, damage):
    from app.models.note_crypto import NoteCryptoTransition
    from app.db import Base
    from app.services.note_mixed_metadata import canonical
    s, local = subject, "s1-damage"
    q, _ = published(client, s, local)
    headers = reader(s); params, _ = metadata_args(client, s, local, headers)
    table = NoteCryptoTransition.__table__
    dependent_rows = []
    with s["engine"].begin() as conn:
        original = dict(conn.execute(select(table).where(table.c.id == q["operation_id"])).mappings().one())
        if damage == "missing":
            for child in reversed(Base.metadata.sorted_tables):
                refs = [fk.parent for fk in child.foreign_keys if fk.column.table is table]
                if refs:
                    assert len(refs) == 1
                    rows = list(conn.execute(select(child).where(refs[0] == q["operation_id"])).mappings())
                    dependent_rows.append((child, [dict(row) for row in rows]))
                    conn.execute(child.delete().where(refs[0] == q["operation_id"]))
            conn.execute(table.delete().where(table.c.id == q["operation_id"]))
        else:
            values = {"state": "prepared"} if damage == "unpublished" else {"local_id": "foreign"} if damage == "foreign_scope" else {}
            if damage == "receipt":
                r = json.loads(original["receipt_json"]); r["origin_expectations_digest"] = "0" * 64
                values["receipt_json"] = canonical(r)
            conn.execute(table.update().where(table.c.id == q["operation_id"]).values(**values))
    try:
        r = client.get(MR + "/metadata", params=params, headers=headers)
        assert r.status_code == 409 and "operation_origin" not in r.json(), r.text
    finally:
        with s["engine"].begin() as conn:
            if damage == "missing":
                conn.execute(table.insert().values(**original))
                for child, rows in reversed(dependent_rows):
                    if rows:
                        conn.execute(child.insert(), rows)
            else:
                conn.execute(table.update().where(table.c.id == q["operation_id"]).values(**original))


def test_body_legacy_null_and_new_native_origin_keep_existing_chunk_wire(client, subject, enabled):
    from .test_note_crypto_conversion import seed, convert
    from .test_note_mixed import ready_cp
    s, local = subject, "s1-native"
    seed(client, s, local); convert(client, s, local)
    headers = reader(s)
    for kind in ("note_body", "revision_before", "inventory_snapshot"):
        params, _ = metadata_args(client, s, local, headers, kind=kind)
        r = client.get(MR + "/metadata", params=params, headers=headers)
        assert r.status_code == 200 and r.json()["operation_origin"] is None, r.text
    _, q, _, commit = ready_cp(client, s, local)
    assert client.post("/api/v2/notes/current-plain/commit", json=commit, headers=s["headers"]).status_code == 200
    params, d = metadata_args(client, s, local, headers, kind="inventory_snapshot")
    r = client.get(MR + "/metadata", params=params, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["operation_origin"] == {"purpose": "current_plain_transition", "operation_id": q["operation_id"],
        "mutation_id": q["mutation_id"], "source_inventory_ref": q["metadata_header"]["selection"]["inventory_revision_ref"],
        "selected_physical_note_id": q["metadata_header"]["selection"]["physical_note_id"], "target_current_mode": "plain"}


def homogeneous(client, s, local, source, nulls):
    from .test_related_text import related, prepare, stage, ROOT
    from .test_note_crypto_conversion import seed
    from . import test_protected_analysis as old
    if source == "conversion":
        seed(client, s, local); related(client, s, local, nulls=nulls)
        b, t, _ = prepare(client, s, local); commit, _, _ = stage(client, s, local, b, t)
        assert client.post(ROOT + "/commit", json=commit, headers=s["headers"]).status_code == 200
    elif source == "old_analysis":
        b, q, _, raws = old.prepared(client, s, local)
        commit = old.upload(client, s, local, old.PA, b, q, raws)
        assert client.post(old.PA + "/commit", json=commit, headers=s["headers"]).status_code == 200
    else:
        from .test_note_crypto_conversion import canonical, digest, encrypt
        b = old.transcript_request(client, s, local, is_null=nulls)
        r = client.post(old.PT + "/prepare", json=b, headers=s["headers"]); assert r.status_code == 201, r.text
        q = r.json(); raws = {}
        if not nulls:
            key, binding = q["slots"][0]["key"], q["slots"][0]["expected_binding"]
            inner = {"schema_version": 1, "binding": binding, "value": "", "content_origin_kind": "linked_text", "semantic_sha256": digest(b"")}
            raws[canonical(key)] = canonical({"schema_version": 1, "kind": "linked_text_envelope_v1", "crypto_epoch": b["base"]["crypto_epoch"],
                "binding": binding, "ciphertext": encrypt(canonical(inner), b["base"]["crypto_epoch"])}).encode()
        commit = old.upload(client, s, local, old.PT, b, q, raws)
        assert client.post(old.PT + "/commit", json=commit, headers=s["headers"]).status_code == 200


@pytest.mark.parametrize("source,nulls", [("conversion", False), ("conversion", True), ("old_analysis", False), ("old_transcript", False), ("old_transcript", True)])
def test_homogeneous_linked_origin_remains_validated_null(client, subject, enabled, source, nulls):
    s, local = subject, "s1-homogeneous"
    homogeneous(client, s, local, source, nulls)
    headers = reader(s)
    for kind in (("recording_transcript",) if source == "old_transcript" else ("analysis_input", "analysis_result", "analysis_error")):
        params, d = metadata_args(client, s, local, headers, kind=kind)
        assert d["origin_validator"] == "linked_v1" and d["semantic_origin_id"] is None
        r = client.get(MR + "/metadata", params=params, headers=headers)
        assert r.status_code == 200 and r.json()["operation_origin"] is None, r.text


@pytest.mark.parametrize("damage", ["semantic", "linked_missing", "receipt"])
def test_legacy_linked_corruption_is_not_hidden_by_null_origin(client, subject, enabled, damage):
    from app.models.note_mixed import MixedSlot
    from app.models.note_related import LinkedText
    from app.models.note_crypto import NoteCryptoTransition
    from app.services.note_mixed_metadata import canonical
    s, local = subject, "s1-legacy-damage"
    homogeneous(client, s, local, "conversion", True)
    headers = reader(s); params, d = metadata_args(client, s, local, headers)
    model = MixedSlot if damage == "semantic" else LinkedText if damage == "linked_missing" else NoteCryptoTransition
    table = model.__table__
    where = table.c.id == d["storage_operation_id"] if damage == "receipt" else (
        (table.c.owner_id == s["owner"]) & (table.c.local_id == local) & (table.c.key_json == canonical(d["key"])))
    with s["engine"].begin() as conn:
        original = dict(conn.execute(select(table).where(where)).mappings().one())
        if damage == "linked_missing":
            conn.execute(table.delete().where(where))
        elif damage == "semantic":
            conn.execute(table.update().where(where).values(semantic_origin_id=str(uuid4())))
        else:
            r = json.loads(original["receipt_json"]); r["metadata_manifest_digest"] = "0" * 64
            conn.execute(table.update().where(where).values(receipt_json=canonical(r)))
    try:
        r = client.get(MR + "/metadata", params=params, headers=headers)
        assert r.status_code == 409 and "operation_origin" not in r.json(), r.text
    finally:
        with s["engine"].begin() as conn:
            if damage == "linked_missing":
                conn.execute(table.insert().values(**original))
            else:
                conn.execute(table.update().where(where).values(**original))
