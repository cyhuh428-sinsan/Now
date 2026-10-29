from uuid import uuid4
import pytest

from .test_note_crypto import subject
from .test_note_mixed import enabled, mcontext
from .test_note_crypto_conversion import seed, convert

MI = "/api/v2/notes/mixed-imports"


@pytest.mark.parametrize("plain_source", [False, True])
def test_new_and_existing_batch_preserves_original_and_protects_plain_source(client, subject, enabled, plain_source):
    import copy
    from .test_note_protected_import import original
    from app.models.note_v2 import NoteOfflineBranch
    s, local = subject, "m2b-combined"
    b, snapshot, _ = import_one_cipher(client, s, local)
    b = existing_request(client, s, local, b["entries"][0])
    existing_id = b["entries"][0]["revision_id"]
    s["db"].expire_all()
    before = s["db"].get(NoteOfflineBranch, existing_id).snapshot_json
    s["db"].rollback()
    new = copy.deepcopy(b["entries"][0])
    new.update(revision_id=str(uuid4()), parent_ref={"kind": "offline_branch", "id": existing_id}, expected_existing=None)
    if plain_source:
        new.update(source_kind="snapshot_v1", source_epoch=0, provenance={"kind": "plain_branch",
            "origin_owner_id": s["owner"], "origin_server_instance_id": b["server_instance_id"], "origin_revision_ref": None})
    else:
        new["provenance"]["origin_storage_operation_id"] = None
    b["entries"] = sorted([*b["entries"], new], key=lambda e: e["revision_id"])
    snapshots = {existing_id: snapshot, new["revision_id"]: original(s, local, "" if plain_source else "X" * 270000)}
    a, op, m, request = ready_import(client, s, b, snapshots)
    r = client.post(MI + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    assert len(m["DSET"]) == len(m["verified_existing"]) == 1
    assert r.json()["receipt"]["result"]["base"]["head_version"] == b["base"]["base"]["head_version"] + 1
    s["db"].expire_all()
    assert s["db"].get(NoteOfflineBranch, existing_id).snapshot_json == before


@pytest.mark.parametrize("damage", ["origin", "receipt"])
def test_import_required_origin_loss_rejected_by_read_and_startup(client, subject, enabled, damage):
    from app.models.note_crypto import NoteCryptoTransition
    from app.models.note_mixed import MixedSlot
    from app.services.note_mixed_metadata import initialize, canonical
    from .test_note_mixed import MR, rq
    s, local = subject, "m2b-required-origin"
    b, _, op = import_one_cipher(client, s, local)
    s["db"].expire_all()
    if damage == "origin":
        row = s["db"].get(MixedSlot, (s["owner"], local, canonical({"kind": "offline_snapshot", "id": b["entries"][0]["revision_id"], "slot": "snapshot"})))
        old = row.semantic_origin_id
        row.semantic_origin_id = None
    else:
        row = s["db"].get(NoteCryptoTransition, op["operation_id"])
        old = row.receipt_json
        row.receipt_json = None
    s["db"].commit()
    try:
        r = client.get(MR + "/context", params={k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}, headers=s["headers"])
        assert r.status_code == 409, r.text
        with pytest.raises(Exception, match="inconsistent_history"):
            with s["engine"].begin() as conn:
                initialize(conn)
    finally:
        s["db"].expire_all()
        if damage == "origin":
            row = s["db"].get(MixedSlot, (s["owner"], local, canonical({"kind": "offline_snapshot", "id": b["entries"][0]["revision_id"], "slot": "snapshot"})))
            row.semantic_origin_id = old
        else:
            row = s["db"].get(NoteCryptoTransition, op["operation_id"])
            row.receipt_json = old
        s["db"].commit()


def test_import_lifecycle_and_purpose_isolation(client, subject, enabled):
    from .test_note_mixed import operation_query
    s, local = subject, "m2b-lifecycle"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    first = client.post(MI + "/prepare", json=b, headers=s["headers"])
    assert first.status_code == 201, first.text
    op = first.json()
    assert client.post(MI + "/prepare", json=b, headers=s["headers"]).status_code == 200
    a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    query = operation_query(a, op)
    assert client.get("/api/v2/notes/mixed-writes/status", params=query, headers=s["headers"]).status_code == 404
    assert client.get(MI + "/status", params=query).status_code == 401
    wrong = {**query, "owner_id": s["other"]}
    assert client.get(MI + "/status", params=wrong, headers=s["headers"]).status_code == 401
    action = {**query, "lease_version": op["lease_version"]}
    r = client.post(MI + "/renew", json=action, headers=s["headers"])
    assert r.status_code == 200 and r.json()["lease_version"] == op["lease_version"] + 1, r.text
    assert client.post(MI + "/abort", json=action, headers=s["headers"]).status_code == 409
    r = client.post(MI + "/abort", json={**action, "lease_version": r.json()["lease_version"]}, headers=s["headers"])
    assert r.status_code == 200 and r.json()["state"] == "aborted", r.text
    assert client.get(MI + "/status", params=query, headers=s["headers"]).json()["state"] == "aborted"


def test_import_gate_closed_without_side_effect(client, subject):
    from sqlalchemy import select, func
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "m2b-gate"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    count = s["db"].scalar(select(func.count()).select_from(NoteCryptoTransition))
    s["db"].rollback()
    r = client.post(MI + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 409, r.text
    assert s["db"].scalar(select(func.count()).select_from(NoteCryptoTransition)) == count
    caps = client.get("/api/v1/server").json()["capabilities"]
    assert not caps["mixed_offline_import_v1"] and not caps["full_protection_complete"]


@pytest.mark.parametrize("plain", [False, True])
def test_import_origin_survives_rc_startup_and_original_status(client, subject, enabled, plain):
    from .test_note_protected_import import original
    from .test_note_mixed import ready_rc, operation_query
    from app.services.note_mixed_metadata import initialize, canonical
    from app.models.note_crypto import NoteCryptoTransition
    from app.models.note_v2 import NoteOfflineBranch
    from app.services.note_operation_origin import operation
    s, local = subject, "m2b-rc-origin"
    if plain:
        b = plain_import_request(client, s, local)
    else:
        seed(client, s, local); convert(client, s, local)
        b = import_request(client, s, local)
    ident = b["entries"][0]["revision_id"]
    snapshot = original(s, local, "ORIGINAL_IMPORT_BEFORE_RC")
    a, op, m, request = ready_import(client, s, b, {ident: snapshot})
    r = client.post(MI + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    receipt = r.json()["receipt"]
    with s["engine"].begin() as conn:
        initialize(conn)
    s["db"].expire_all()
    origins = {row.id: operation(s["db"], row.id, s["owner"], local)
        for row in s["db"].query(NoteCryptoTransition).filter_by(owner_id=s["owner"], local_id=local, state="committed")
        if row.purpose in ("current_plain_transition", "mixed_offline_import")}
    s["db"].rollback()
    ra, rop, rm, rc, semantics = ready_rc(client, s, local, origins=origins)
    assert semantics[canonical({"kind": "offline_snapshot", "id": ident, "slot": "snapshot"})] == snapshot
    r = client.post("/api/v2/notes/mixed-conversions/commit", json=rc, headers=s["headers"])
    assert r.status_code == 200, r.text
    with s["engine"].begin() as conn:
        initialize(conn); initialize(conn)
    r = client.get(MI + "/status", params=operation_query(a, op), headers=s["headers"])
    assert r.status_code == 200 and r.json()["receipt"] == receipt, r.text
    assert r.json()["latest_context"]["base"]["crypto_epoch"] == b["base"]["base"]["crypto_epoch"] + 1
    replay = client.post(MI + "/commit", json=request, headers=s["headers"])
    if plain:
        assert replay.status_code == 409 and replay.json()["detail"]["code"] == "replay_payload_requires_status", replay.text
    else:
        assert replay.status_code == 200 and replay.json()["receipt"] == receipt, replay.text
    s["db"].expire_all()
    branch = s["db"].get(NoteOfflineBranch, ident)
    assert branch.origin_device_id == b["entries"][0]["origin_device_id"]
    assert branch.representation_epoch == b["base"]["base"]["crypto_epoch"] + 1


def import_request(client, s, local):
    a, c = mcontext(client, s, local)
    entry = {"revision_id": str(uuid4()), "parent_ref": None, "origin_device_id": "original-device",
        "source_kind": "history_envelope_v1", "source_epoch": 1, "target_kind": "history_envelope_v1",
        "target_epoch": c["context"]["base"]["crypto_epoch"], "expected_existing": None,
        "provenance": {"kind": "cipher_branch", "origin_server_instance_id": a["server_instance_id"],
            "origin_owner_id": s["owner"], "origin_storage_operation_id": None}}
    return {**a, "mutation_id": str(uuid4()), "base": c["context"], "expected_catalog_digest": c["catalog_digest"], "entries": [entry]}


def test_import_prepare_reserves_new_branch_without_touching_current(client, subject, enabled):
    s, local = subject, "m2b-prepare"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    r = client.post(MI + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 201, r.text
    q = r.json()
    assert q["purpose"] == "mixed_offline_import"
    assert q["counts"]["DSET"]["total"] == 1
    assert q["counts"]["existing"]["total"] == q["counts"]["verified_existing"]["total"] == 0
    assert q["latest_context"] == b["base"]
    assert q["metadata_header"]["control"] == {"entries": b["entries"]}


def test_cipher_history_import_never_targets_plain(client, subject, enabled):
    s, local = subject, "m2b-no-plain"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    b["entries"][0].update(target_kind="snapshot_v1", target_epoch=0)
    r = client.post(MI + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 422 and r.json()["detail"]["code"] == "historical_cipher_plain_forbidden", r.text


def test_import_commit_route_requires_complete_cipher_manifest(client, subject, enabled):
    from .test_note_crypto_conversion import canonical, digest
    s, local = subject, "m2b-incomplete"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    q = client.post(MI + "/prepare", json=b, headers=s["headers"]).json()
    r = client.post(MI + "/commit", json={**{k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")},
        "operation_id": q["operation_id"], "mutation_id": b["mutation_id"], "lease_version": q["lease_version"],
        "base": b["base"], "metadata_manifest_digest": q["metadata_manifest_digest"], "client_decryption_verified": True,
        "client_verified_ciphertext_manifest_digest": digest(canonical([]).encode()),
        "client_verified_existing_set_digest": digest(canonical([]).encode()), "plain_entries": [], "existing_ciphertexts": []}, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "incomplete_manifest", r.text


@pytest.mark.parametrize("damage", ["plain_output", "missing_output", "foreign_parent"])
def test_fixed_import_outputs_are_derived_from_control(client, subject, enabled, damage):
    import json
    from app.models.note_crypto import NoteCryptoTransition
    from app.services.note_mixed_metadata import canonical, h
    s, local = subject, "m2b-fixed"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    q = client.post(MI + "/prepare", json=b, headers=s["headers"]).json()
    row = s["db"].get(NoteCryptoTransition, q["operation_id"])
    original, digest = row.conditions_json, row.manifest_digest
    c = json.loads(original)
    if damage == "plain_output":
        c["M0"]["DSET"][0].update(output_kind="snapshot_v1", output_epoch=0, expected_binding=None)
    elif damage == "missing_output":
        c["M0"]["DSET"] = []
    else:
        parent = {"kind": "note_revision", "id": "00000000-0000-0000-0000-000000000001"}
        c["request"]["entries"][0]["parent_ref"] = parent
        c["M0"]["control"]["entries"][0]["parent_ref"] = parent
        c["M0"]["operation_origin"]["entries"][0]["parent_ref"] = parent
        c["M0"]["DSET"][0]["expected_binding"]["parent_ref"] = parent
    row.conditions_json, row.manifest_digest = canonical(c), h(c["M0"])
    s["db"].commit()
    try:
        r = client.get(MI + "/status", params={**{k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")},
            "operation_id": q["operation_id"]}, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    finally:
        s["db"].expire_all()
        row = s["db"].get(NoteCryptoTransition, q["operation_id"])
        row.conditions_json, row.manifest_digest = original, digest
        s["db"].commit()


def ready_import(client, s, b, snapshots):
    import base64, json
    from .test_note_crypto_conversion import canonical, digest, encrypt, decrypt
    q = client.post(MI + "/prepare", json=b, headers=s["headers"])
    assert q.status_code == 201, q.text
    op = q.json(); a = {k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")}
    common = {**a, "operation_id": op["operation_id"], "metadata_manifest_digest": op["metadata_manifest_digest"]}
    m = dict(op["metadata_header"])
    for section in ("S", "DSET", "P", "O", "existing", "verified_existing"):
        values, cursor = [], None
        while True:
            r = client.get(MI + "/manifest", params={**common, "section": section, "limit": 2,
                **({"cursor": cursor} if cursor else {})}, headers=s["headers"])
            assert r.status_code == 200, r.text
            values.extend(r.json()["entries"]); cursor = r.json()["next_cursor"]
            if cursor is None:
                break
        m[section] = values
    assert digest(canonical(m).encode()) == op["metadata_manifest_digest"]
    entries = {e["revision_id"]: e for e in b["entries"]}
    for v in m["verified_existing"]:
        key = v["key"]; source = next(e for e in m["S"] if e["descriptor"]["key"] == key)
        raw, i = b"", 0
        while True:
            r = client.get(MI + "/source", params={**common, "kind": key["kind"], "representation_id": key["id"], "slot": key["slot"],
                "source_etag": source["source_etag"], "chunk_index": i}, headers=s["headers"])
            assert r.status_code == 200, r.text
            raw += base64.b64decode(r.json()["data_base64"]); i += 1
            if i == r.json()["total_chunks"]:
                break
        decoded = json.loads(raw)
        if v["ciphertext_sha256"] is not None:
            assert len(raw) == v["total_bytes"] and i == v["total_chunks"] and digest(raw) == v["ciphertext_sha256"]
            inner = json.loads(decrypt(decoded["ciphertext"], v["descriptor"]["representation_epoch"]))
            assert inner["binding"] == decoded["binding"] == v["expected_binding"]
            decoded = inner["snapshot"]
            assert digest(canonical(decoded).encode()) == inner["semantic_sha256"]
        if key["id"] in snapshots:
            assert decoded == snapshots[key["id"]]
    records = []
    for d in m["DSET"]:
        if not d["output_epoch"]:
            continue
        key = d["destination_key"]; ident = key["id"]; snapshot = snapshots[ident]
        original = canonical(snapshot)
        if entries[ident]["source_epoch"]:
            original_cipher = encrypt(original, entries[ident]["source_epoch"])
            assert decrypt(original_cipher, entries[ident]["source_epoch"]) == original
        inner = {"schema_version": 1, "binding": d["expected_binding"], "origin": m["operation_origin"],
            "content_origin_kind": "semantic", "semantic_sha256": digest(original.encode()), "snapshot": snapshot}
        raw = canonical({"schema_version": 1, "kind": d["output_kind"], "crypto_epoch": d["output_epoch"],
            "binding": d["expected_binding"], "ciphertext": encrypt(canonical(inner), d["output_epoch"])}).encode()
        chunks = [raw[i:i+262144] for i in range(0, len(raw), 262144)]
        control = {**common, "entry_key": key, "source_etag": d["source_etag"], "target_epoch": d["output_epoch"],
            "total_chunks": len(chunks), "total_bytes": len(raw)}
        for i in reversed(range(len(chunks))):
            r = client.put(MI + "/chunks", json={**control, "chunk_index": i, "chunk_sha256": digest(chunks[i]),
                "data_base64": base64.b64encode(chunks[i]).decode()}, headers=s["headers"])
            assert r.status_code == 200, r.text
        r = client.post(MI + "/entries/seal", json={**control, "ciphertext_sha256": digest(raw)}, headers=s["headers"])
        assert r.status_code == 200, r.text
        downloaded = b""
        for i in range(len(chunks)):
            r = client.get(MI + "/staged", params={**common, "kind": key["kind"], "representation_id": ident, "slot": key["slot"],
                "source_etag": d["source_etag"], "target_epoch": d["output_epoch"], "chunk_index": i}, headers=s["headers"])
            assert r.status_code == 200, r.text
            downloaded += base64.b64decode(r.json()["data_base64"])
        assert downloaded == raw
        records.append({"entry_key": key, "destination_key": key, "source_etag": d["source_etag"], "output_kind": d["output_kind"],
            "target_epoch": d["output_epoch"], "total_bytes": len(raw), "ciphertext_sha256": digest(raw)})
    plain_ids = sorted([d["destination_key"]["id"] for d in m["DSET"] if d["output_epoch"] == 0] +
        [e["revision_id"] for e in m["existing"] if e["comparison"] == "plain_exact"])
    commit = {**common, "mutation_id": b["mutation_id"], "lease_version": op["lease_version"], "base": b["base"],
        "client_decryption_verified": True, "client_verified_ciphertext_manifest_digest": digest(canonical(records).encode()),
        "client_verified_existing_set_digest": digest(canonical(m["verified_existing"]).encode()),
        "plain_entries": [{"revision_id": ident, "snapshot": snapshots[ident]["note"]} for ident in plain_ids],
        "existing_ciphertexts": [{"revision_id": v["key"]["id"], "ciphertext_sha256": v["ciphertext_sha256"]}
            for v in m["verified_existing"] if v["ciphertext_sha256"] is not None]}
    return a, op, m, commit


def test_new_cipher_batch_preserves_current_and_increments_once(client, subject, enabled):
    from .test_note_protected_import import original
    from app.models.note import Note
    from app.models.note_history import NoteInventory, NoteRevision
    from app.models.note_v2 import NoteOfflineBranch
    from sqlalchemy import select
    s, local = subject, "m2b-batch"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    second = {**b["entries"][0], "revision_id": str(uuid4())}
    b["entries"] = sorted([b["entries"][0], second], key=lambda e: e["revision_id"])
    b["entries"][1]["parent_ref"] = {"kind": "offline_branch", "id": b["entries"][0]["revision_id"]}
    snapshots = {e["revision_id"]: original(s, local, "ORIGINAL_" + str(i)) for i, e in enumerate(b["entries"])}
    with s["engine"].connect() as conn:
        before = [[tuple(row) for row in conn.execute(select(model.__table__).where(model.owner_id==s["owner"], model.local_id==local).order_by(*model.__table__.primary_key.columns))]
            for model in (Note, NoteInventory, NoteRevision)]
    a, op, m, request = ready_import(client, s, b, snapshots)
    r = client.post(MI + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    result = r.json()["receipt"]["result"]["base"]
    assert result["history_generation"] == b["base"]["base"]["history_generation"] + 1
    assert result["head_version"] == b["base"]["base"]["head_version"] + 1
    for key in ("head_revision_id", "crypto_epoch", "inventory_revision_ids", "current_exists"):
        assert result[key] == b["base"]["base"][key]
    with s["engine"].connect() as conn:
        after = [[tuple(row) for row in conn.execute(select(model.__table__).where(model.owner_id==s["owner"], model.local_id==local).order_by(*model.__table__.primary_key.columns))]
            for model in (Note, NoteInventory, NoteRevision)]
    assert before == after
    assert client.post(MI + "/commit", json=request, headers=s["headers"]).json() == r.json()


def existing_request(client, s, local, entry):
    from .test_note_mixed import rq
    a, c = mcontext(client, s, local)
    catalog = client.get("/api/v2/notes/mixed-representations/catalog", params={**rq(a, c), "limit": 500}, headers=s["headers"])
    assert catalog.status_code == 200, catalog.text
    d = next(d for d in catalog.json()["entries"] if d["key"] == {"kind": "offline_snapshot", "id": entry["revision_id"], "slot": "snapshot"})
    source = {**entry, "source_kind": d["representation_kind"], "source_epoch": d["representation_epoch"],
        "target_kind": d["representation_kind"], "target_epoch": d["representation_epoch"], "expected_existing": d}
    return {**a, "mutation_id": str(uuid4()), "base": c["context"], "expected_catalog_digest": c["catalog_digest"], "entries": [source]}


def import_one_cipher(client, s, local):
    from .test_note_protected_import import original
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    snapshot = original(s, local, "EXACT_ORIGINAL")
    a, op, m, commit = ready_import(client, s, b, {b["entries"][0]["revision_id"]: snapshot})
    r = client.post(MI + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200, r.text
    return b, snapshot, op


def test_existing_cipher_v3_is_distinct_from_empty_c_and_does_not_bump(client, subject, enabled):
    from app.models.note_mixed import MixedSlot
    from sqlalchemy import select
    s, local = subject, "m2b-existing"
    first, snapshot, _ = import_one_cipher(client, s, local)
    b = existing_request(client, s, local, first["entries"][0])
    s["db"].expire_all()
    before = [(x.key_json, x.representation_version, x.representation_etag) for x in s["db"].scalars(
        select(MixedSlot).where(MixedSlot.owner_id==s["owner"], MixedSlot.local_id==local).order_by(MixedSlot.key_json))]
    s["db"].rollback()
    a, op, m, commit = ready_import(client, s, b, {first["entries"][0]["revision_id"]: snapshot})
    assert m["DSET"] == [] and len(m["existing"]) == len(m["verified_existing"]) == 1
    assert commit["client_verified_ciphertext_manifest_digest"] != commit["client_verified_existing_set_digest"]
    r = client.post(MI + "/commit", json=commit, headers=s["headers"])
    assert r.status_code == 200 and r.json()["receipt"]["result"] == b["base"], r.text
    s["db"].expire_all()
    after = [(x.key_json, x.representation_version, x.representation_etag) for x in s["db"].scalars(
        select(MixedSlot).where(MixedSlot.owner_id==s["owner"], MixedSlot.local_id==local).order_by(MixedSlot.key_json))]
    assert before == after


def test_existing_origin_storage_claim_must_match_actual_descriptor(client, subject, enabled):
    s, local = subject, "m2b-storage-origin"
    first, _, _ = import_one_cipher(client, s, local)
    b = existing_request(client, s, local, first["entries"][0])
    b["entries"][0]["provenance"]["origin_storage_operation_id"] = str(uuid4())
    r = client.post(MI + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 409 and r.json()["detail"]["code"] == "existing_representation_changed", r.text


def plain_import_request(client, s, local):
    from .test_note_mixed import ready_cp
    from app.services.note_mixed_metadata import h
    seed(client, s, local); convert(client, s, local)
    _, cp, _, request = ready_cp(client, s, local)
    r = client.post("/api/v2/notes/current-plain/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    b = import_request(client, s, local)
    b["entries"][0].update(source_kind="snapshot_v1", source_epoch=0, target_kind="snapshot_v1", target_epoch=0,
        provenance={"kind": "post_plain_draft", "origin_server_instance_id": b["server_instance_id"], "origin_owner_id": s["owner"],
            "mode_operation_id": cp["operation_id"], "mode_receipt_digest": h(r.json()["receipt"])})
    return b


def test_post_cp_plain_draft_is_final_only_exact_replay_and_existing_only(client, subject, enabled):
    import json
    from .test_note_protected_import import original
    from .test_note_crypto_conversion import canonical
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_crypto import NoteCryptoTransition
    s, local = subject, "m2b-plain"
    b = plain_import_request(client, s, local)
    ident = b["entries"][0]["revision_id"]
    snapshot = original(s, local, "POST_CP_NORMAL_PLAIN\r\n")
    a, op, m, request = ready_import(client, s, b, {ident: snapshot})
    assert m["DSET"][0]["output_epoch"] == 0 and m["verified_existing"] == []
    r = client.post(MI + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200 and r.json()["latest_context"]["current_mode"] == "plain", r.text
    s["db"].expire_all()
    branch = s["db"].get(NoteOfflineBranch, ident)
    assert branch.snapshot_json == canonical(snapshot) and branch.origin_device_id == "original-device"
    row = s["db"].get(NoteCryptoTransition, op["operation_id"])
    assert "POST_CP_NORMAL_PLAIN" not in row.conditions_json + row.commit_conditions_json + row.receipt_json
    s["db"].rollback()
    assert client.post(MI + "/commit", json=request, headers=s["headers"]).json() == r.json()
    changed = json.loads(json.dumps(request)); changed["plain_entries"][0]["snapshot"]["content"] = "DIFFERENT"
    invalid = client.post(MI + "/commit", json=changed, headers=s["headers"])
    assert invalid.status_code == 409 and invalid.json()["detail"]["code"] == "idempotency_mismatch", invalid.text
    existing = existing_request(client, s, local, b["entries"][0])
    _, _, m, request = ready_import(client, s, existing, {ident: snapshot})
    assert m["verified_existing"][0]["total_bytes"] is None and m["verified_existing"][0]["ciphertext_sha256"] is None
    r = client.post(MI + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200 and r.json()["receipt"]["result"] == existing["base"], r.text


@pytest.mark.parametrize("damage", ["owner", "instance", "mode_id", "mode_digest", "plain_branch"])
def test_plain_draft_provenance_is_bound_to_cp_receipt(client, subject, enabled, damage):
    s, local = subject, "m2b-plain-proof"
    b = plain_import_request(client, s, local)
    ip = b["entries"][0]["provenance"]
    if damage == "owner":
        ip["origin_owner_id"] = s["other"]
    elif damage == "instance":
        ip["origin_server_instance_id"] = str(uuid4())
    elif damage == "mode_id":
        ip["mode_operation_id"] = str(uuid4())
    elif damage == "mode_digest":
        ip["mode_receipt_digest"] = "0" * 64
    else:
        b["entries"][0]["provenance"] = {"kind": "plain_branch", "origin_server_instance_id": b["server_instance_id"],
            "origin_owner_id": s["owner"], "origin_revision_ref": None}
    r = client.post(MI + "/prepare", json=b, headers=s["headers"])
    assert r.status_code == 422, r.text


@pytest.mark.parametrize("scope", ["branch_only", "related_only"])
def test_import_into_absent_current_never_creates_note_or_native(client, subject, enabled, scope):
    from sqlalchemy import select, func
    from app.models.note import Note
    from app.models.note_history import NoteHead, NoteRevision, NoteInventory
    from app.models.note_v2 import NoteOfflineBranch
    from .test_note_protected_import import original
    from .test_note_crypto_conversion import canonical
    s, local = subject, "m2b-absent"
    if scope == "related_only":
        from .test_related_text import related, prepare, stage, ROOT
        related(client, s, local, nulls=True)
        b, t, _ = prepare(client, s, local); cb, _, _ = stage(client, s, local, b, t)
        assert client.post(ROOT + "/commit", json=cb, headers=s["headers"]).status_code == 200
    else:
        s["db"].add(NoteHead(owner_id=s["owner"], local_id=local, version=0, history_generation=1, identity_state="branch_only"))
        s["db"].add(NoteOfflineBranch(id=str(uuid4()), owner_id=s["owner"], local_id=local, origin_device_id="old-device",
            snapshot_json=canonical(original(s, local, "OLD_BRANCH"))))
        s["db"].commit(); convert(client, s, local)
    b = import_request(client, s, local)
    ident = b["entries"][0]["revision_id"]
    a, op, m, request = ready_import(client, s, b, {ident: original(s, local, "NEW_BRANCH")})
    r = client.post(MI + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text
    ctx = r.json()["receipt"]["result"]
    assert ctx["current_mode"] == "absent" and ctx["selected_physical_note_id"] is None
    assert ctx["base"]["head_revision_id"] is None and ctx["base"]["identity_state"] == "branch_only"
    for model in (Note, NoteRevision, NoteInventory):
        with s["engine"].connect() as conn:
            assert conn.scalar(select(func.count()).select_from(model).where(model.owner_id==s["owner"], model.local_id==local)) == 0


@pytest.mark.parametrize("damage", ["duplicate", "missing_parent", "self_cycle", "cycle", "foreign_owner", "foreign_instance"])
def test_invalid_batch_is_whole_failure_before_publication(client, subject, enabled, damage):
    from app.models.note_crypto import NoteCryptoTransition
    from app.models.note_v2 import NoteOfflineBranch
    from sqlalchemy import select, func
    s, local = subject, "m2b-invalid-batch"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    first = b["entries"][0]
    if damage == "duplicate":
        b["entries"].append(dict(first))
    elif damage == "missing_parent":
        first["parent_ref"] = {"kind": "note_revision", "id": str(uuid4())}
    elif damage == "self_cycle":
        first["parent_ref"] = {"kind": "offline_branch", "id": first["revision_id"]}
    elif damage == "cycle":
        other = {**first, "revision_id": str(uuid4()), "parent_ref": {"kind": "offline_branch", "id": first["revision_id"]}}
        first["parent_ref"] = {"kind": "offline_branch", "id": other["revision_id"]}
        b["entries"] = sorted([first, other], key=lambda e: e["revision_id"])
    elif damage == "foreign_owner":
        first["provenance"]["origin_owner_id"] = s["other"]
    else:
        first["provenance"]["origin_server_instance_id"] = str(uuid4())
    r = client.post(MI + "/prepare", json=b, headers=s["headers"])
    assert r.status_code in (404, 422), r.text
    with s["engine"].connect() as conn:
        assert conn.scalar(select(func.count()).select_from(NoteOfflineBranch).where(NoteOfflineBranch.owner_id==s["owner"], NoteOfflineBranch.local_id==local)) == 0
        assert conn.scalar(select(func.count()).select_from(NoteCryptoTransition).where(NoteCryptoTransition.owner_id==s["owner"], NoteCryptoTransition.mutation_id==b["mutation_id"])) == 0


def test_late_uuid_conflict_is_stale_without_reclassifying_new_output(client, subject, enabled):
    from .test_note_protected_import import original
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_crypto import NoteCryptoTransition, NoteCryptoFence, NoteCryptoUpload
    from sqlalchemy import select
    s, local = subject, "m2b-late-id"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local); ident = b["entries"][0]["revision_id"]
    a, op, m, request = ready_import(client, s, b, {ident: original(s, local, "KEEP_SEALED")})
    with s["engine"].begin() as conn:
        conn.execute(NoteOfflineBranch.__table__.insert().values(id=ident, owner_id=s["other"], local_id="occupied",
            origin_device_id="other", snapshot_json="{}", representation_kind="snapshot_v1", representation_epoch=0))
    try:
        r = client.post(MI + "/commit", json=request, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "revision_id_conflict", r.text
        s["db"].expire_all()
        assert s["db"].get(NoteCryptoTransition, op["operation_id"]).state == "stale"
        assert s["db"].get(NoteCryptoFence, (s["owner"], local)) is None
        assert s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id==op["operation_id"])) is not None
    finally:
        s["db"].rollback()
        with s["engine"].begin() as conn:
            conn.execute(NoteOfflineBranch.__table__.delete().where(NoteOfflineBranch.id==ident, NoteOfflineBranch.owner_id==s["other"]))


@pytest.mark.parametrize("damage", ["v_is_c", "cipher_set", "plain_payload", "parent_in_v"])
def test_existing_verification_sets_cannot_be_substituted(client, subject, enabled, damage):
    from .test_note_crypto_conversion import digest, canonical
    s, local = subject, "m2b-verified-sets"
    first, snapshot, _ = import_one_cipher(client, s, local)
    b = existing_request(client, s, local, first["entries"][0])
    a, op, m, request = ready_import(client, s, b, {first["entries"][0]["revision_id"]: snapshot})
    if damage == "v_is_c":
        request["client_verified_existing_set_digest"] = request["client_verified_ciphertext_manifest_digest"]
    elif damage == "cipher_set":
        request["existing_ciphertexts"][0]["ciphertext_sha256"] = "0"*64
    elif damage == "plain_payload":
        request["plain_entries"] = [{"revision_id": first["entries"][0]["revision_id"], "snapshot": snapshot["note"]}]
    else:
        request["client_verified_existing_set_digest"] = digest(canonical(m["verified_existing"] + [{"key": {"kind": "revision_snapshot", "id": b["base"]["base"]["head_revision_id"], "slot": "after"}}]).encode())
    r = client.post(MI + "/commit", json=request, headers=s["headers"])
    assert r.status_code == (422 if damage == "plain_payload" else 409), r.text


@pytest.mark.parametrize("boundary", ["insert into note_offline_branches", "insert into note_representation_origins",
    "insert into note_mixed_slots", "update note_heads", "update note_crypto_transitions"])
def test_import_sql_failure_rolls_back_batch_and_preserves_sealed_bytes(client, subject, enabled, boundary):
    from sqlalchemy import event, select
    from app.models.note_crypto import NoteCryptoUpload
    from app.services.note_crypto_storage import assembled
    from .test_note_protected_import import original
    from .test_note_mixed import live_rows
    s, local = subject, "m2b-sql"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local)
    ident = b["entries"][0]["revision_id"]
    a, op, m, request = ready_import(client, s, b, {ident: original(s, local, "SEALED_ORIGINAL")})
    before, fired = live_rows(s, local), []
    def fail(conn, cursor, statement, parameters, context, many):
        if statement.lower().startswith(boundary):
            fired.append(True)
            raise RuntimeError("synthetic MI SQL failure")
    event.listen(s["engine"], "before_cursor_execute", fail)
    try:
        r = client.post(MI + "/commit", json=request, headers=s["headers"])
    finally:
        event.remove(s["engine"], "before_cursor_execute", fail)
    assert fired and r.status_code == 500, r.text
    assert live_rows(s, local) == before
    s["db"].expire_all()
    upload = s["db"].scalar(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id==op["operation_id"]))
    assert assembled(s["db"], upload)
    s["db"].rollback()
    r = client.post(MI + "/commit", json=request, headers=s["headers"])
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("terminal", ["committed", "aborted"])
def test_import_rollback_gap_relocks_and_preserves_other_terminal(client, subject, enabled, terminal):
    from sqlalchemy import event
    from sqlalchemy.orm import Session
    from app.models.note_v2 import NoteOfflineBranch
    from app.models.note_crypto import NoteCryptoTransition
    from .test_note_protected_import import original
    s, local = subject, "m2b-gap"
    seed(client, s, local); convert(client, s, local)
    b = import_request(client, s, local); ident = b["entries"][0]["revision_id"]
    a, op, m, request = ready_import(client, s, b, {ident: original(s, local, "ORIGINAL")})
    with s["engine"].begin() as conn:
        conn.execute(NoteOfflineBranch.__table__.insert().values(id=ident, owner_id=s["other"], local_id="occupied",
            origin_device_id="other", snapshot_json="{}", representation_kind="snapshot_v1", representation_epoch=0))
    fired, other = [], []
    def interleave(db, previous):
        if fired or previous.parent is not None or db.get_bind() is not s["engine"]:
            return
        fired.append(True)
        with s["engine"].begin() as conn:
            conn.execute(NoteOfflineBranch.__table__.delete().where(NoteOfflineBranch.id==ident, NoteOfflineBranch.owner_id==s["other"]))
        if terminal == "committed":
            r = client.post(MI + "/commit", json=request, headers=s["headers"])
        else:
            r = client.post(MI + "/abort", json={**a, "operation_id": op["operation_id"], "lease_version": op["lease_version"]}, headers=s["headers"])
        assert r.status_code == 200, r.text
        other.append(r.json())
    event.listen(Session, "after_soft_rollback", interleave)
    try:
        r = client.post(MI + "/commit", json=request, headers=s["headers"])
    finally:
        event.remove(Session, "after_soft_rollback", interleave)
    assert fired and other
    s["db"].expire_all()
    assert s["db"].get(NoteCryptoTransition, op["operation_id"]).state == terminal
    if terminal == "committed":
        assert r.status_code == 200 and r.json()["receipt"] == other[0]["receipt"], r.text
    else:
        assert r.status_code == 409 and r.json()["operation"]["state"] == "aborted", r.text


@pytest.mark.parametrize("damage", ["plain_mode_id", "plain_digest", "cipher_variant", "new_storage_claim"])
def test_stored_import_provenance_is_revalidated_by_fixed(client, subject, enabled, damage):
    import json
    from app.models.note_crypto import NoteCryptoTransition
    from app.services.note_mixed_metadata import canonical, h
    s, local = subject, "m2b-provenance-fixed"
    if damage.startswith("plain"):
        b = plain_import_request(client, s, local)
    else:
        seed(client, s, local); convert(client, s, local)
        b = import_request(client, s, local)
    q = client.post(MI + "/prepare", json=b, headers=s["headers"]).json()
    row = s["db"].get(NoteCryptoTransition, q["operation_id"])
    original, digest = row.conditions_json, row.manifest_digest
    c = json.loads(original)
    for entries in (c["request"]["entries"], c["M0"]["control"]["entries"], c["M0"]["operation_origin"]["entries"]):
        ip = entries[0]["provenance"]
        if damage == "plain_mode_id":
            ip["mode_operation_id"] = "00000000-0000-0000-0000-000000000001"
        elif damage == "plain_digest":
            ip["mode_receipt_digest"] = "0"*64
        elif damage == "cipher_variant":
            entries[0]["provenance"] = {"kind": "post_plain_draft", "origin_server_instance_id": b["server_instance_id"],
                "origin_owner_id": s["owner"], "mode_operation_id": "00000000-0000-0000-0000-000000000001", "mode_receipt_digest": "0"*64}
        else:
            ip["origin_storage_operation_id"] = "00000000-0000-0000-0000-000000000001"
    row.conditions_json, row.manifest_digest = canonical(c), h(c["M0"])
    s["db"].commit()
    try:
        r = client.get(MI + "/status", params={**{k: b[k] for k in ("schema_version", "owner_id", "local_id", "device_id", "server_instance_id")},
            "operation_id": q["operation_id"]}, headers=s["headers"])
        assert r.status_code == 409 and r.json()["detail"]["code"] == "inconsistent_history", r.text
    finally:
        s["db"].expire_all()
        row = s["db"].get(NoteCryptoTransition, q["operation_id"])
        row.conditions_json, row.manifest_digest = original, digest
        s["db"].commit()
