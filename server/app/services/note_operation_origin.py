"""Independent, metadata-only semantic origin presence and expectation checks."""
import json
import hashlib

from sqlalchemy import select

from app.models.note_crypto import NoteCryptoTransition, NoteRepresentationOrigin
from app.models.note_history import NoteHead, NoteRevision
from app.services.note_crypto_fence import error, ACTIVE_STATES
from app.services.note_v2 import canonical

LEGACY = "a2a_pre_origin_v0"


def classify_legacy(connection):
    # Called only by the initial purpose-column migration, never by absence on read.
    table = NoteCryptoTransition.__table__
    from app.schemas.note_crypto import PrepareTransition, RepresentationKey
    from app.models.note_crypto import NoteCryptoEntry
    for row in connection.execute(select(table)).mappings():
        try:
            conditions = json.loads(row["conditions_json"])
            receipt = json.loads(row["receipt_json"]) if row["receipt_json"] else None
            if (row["state"] not in ACTIVE_STATES + ("committed",) or row["purpose"] != "conversion"
                or "origin_metadata_version" in conditions or "origin_metadata_legacy" in conditions
                or not isinstance(conditions.get("request"), dict) or not isinstance(conditions.get("base"), dict)
                or "operation" in conditions["request"] or not isinstance(conditions["request"].get("local_branches"), list)
                or conditions["request"].get("owner_id") != row["owner_id"] or conditions["request"].get("local_id") != row["local_id"]
                or conditions["request"].get("target_epoch") != conditions["base"].get("crypto_epoch", -2) + 1
                or not isinstance(conditions.get("null_slots"), list)):
                continue
            request = PrepareTransition.model_validate(conditions["request"])
            base = conditions["base"]
            if (request.model_dump() != conditions["request"] or request.mutation_id != row["mutation_id"]
                or request.device_id != row["actor_device_id"] or request.server_instance_id != conditions.get("server_instance_id")
                or request.crypto_epoch != base.get("crypto_epoch") or request.base_head_version != base.get("head_version")
                or request.base_revision_id != base.get("head_revision_id")
                or request.expected_history_generation != base.get("history_generation")
                or request.expected_inventory_revision_ids != base.get("inventory_revision_ids")):
                continue
            entries = []
            for entry in connection.execute(select(NoteCryptoEntry.__table__).where(NoteCryptoEntry.transition_id == row["id"])).mappings():
                key = RepresentationKey.model_validate(json.loads(entry["key_json"])).model_dump()
                entries.append({"key": key, **{k: entry[k] for k in ("source_etag", "source_kind", "output_kind", "representation_epoch")}})
            entries.sort(key=lambda item: canonical(item["key"]))
            if not entries or hashlib.sha256(canonical(entries).encode("utf-8")).hexdigest() != row["manifest_digest"]:
                continue
            if row["state"] == "committed":
                if (not isinstance(receipt, dict) or receipt.get("owner_id") != row["owner_id"]
                    or receipt.get("local_id") != row["local_id"] or receipt.get("crypto_epoch") != conditions["request"].get("target_epoch")):
                    continue
                conditions["origin_metadata_legacy"] = LEGACY
            elif receipt is None:
                conditions["origin_metadata_pending_upgrade"] = True
            else:
                continue
            connection.execute(table.update().where(table.c.id == row["id"]).values(conditions_json=canonical(conditions)))
        except (ValueError, TypeError, KeyError):
            continue


def expectation(row, key):
    try:
        condition = json.loads(row.conditions_json)
        if type(condition.get("origin_metadata_version")) is not int or condition["origin_metadata_version"] != 1:
            error("inconsistent_history")
        items = condition["origin_expectations"]
        keys = [canonical(item["destination_key"]) for item in items]
        if len(keys) != len(set(keys)):
            error("inconsistent_history")
        result = next((item for item in items if item["destination_key"] == key), None)
        if result is None or set(result) != {"destination_key", "is_null", "origin_row_required", "semantic_origin_id"}:
            error("inconsistent_history")
        if type(result["is_null"]) is not bool or type(result["origin_row_required"]) is not bool:
            error("inconsistent_history")
        return result
    except (ValueError, KeyError, TypeError):
        error("inconsistent_history")


def upgrade_pending(db, row):
    c = json.loads(row.conditions_json)
    if c.get("origin_metadata_pending_upgrade") is not True or row.state not in ACTIVE_STATES:
        return
    from app.services import note_crypto as prep
    from app.services.note_history import lock_note_writes
    from app.models.note_crypto import NoteCryptoEntry
    lock_note_writes(db, [row.owner_id])
    if (row.purpose != "conversion" or "origin_metadata_version" in c or "origin_metadata_legacy" in c
        or prep.base_state(db, row.owner_id, row.local_id, baseline=False) != c["base"]):
        error("inconsistent_history")
    entries = [prep.entry_result(e) for e in db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id))]
    c["origin_expectations"] = conversion_expectations(db, row.owner_id, row.local_id, entries, c["null_slots"])
    c["origin_metadata_version"] = 1
    c.pop("origin_metadata_pending_upgrade")
    row.conditions_json = canonical(c)


def expectations_digest(row):
    from app.services.note_crypto_storage import sha, canonical_bytes
    return sha(canonical_bytes(json.loads(row.conditions_json)["origin_expectations"]))


def operation(db, ident, owner, local, *, active_id=None):
    row = db.get(NoteCryptoTransition, ident)
    if (row is None or row.owner_id != owner or row.local_id != local or row.purpose != "protected_write"
        or not (row.state == "committed" or row.id == active_id and row.state in ACTIVE_STATES + ("aborted", "expired", "stale"))):
        error("inconsistent_history")
    # Only own intent metadata opts in. Live representation readers require committed.
    try:
        c = json.loads(row.conditions_json)
        if type(c.get("origin_metadata_version")) is not int or c["origin_metadata_version"] != 1 or not isinstance(c.get("origin_expectations"), list):
            error("inconsistent_history")
        if row.state == "committed":
            receipt = json.loads(row.receipt_json)
            if (type(receipt.get("origin_metadata_version")) is not int or receipt["origin_metadata_version"] != 1
                or receipt.get("origin_expectations_digest") != expectations_digest(row)):
                error("inconsistent_history")
        request = c["request"]
        value = {"purpose": "protected_write", "quote_id": row.id, "mutation_id": row.mutation_id,
                 "operation": request["operation"], "restore_source_ref": request["target_ref"],
                 "target_ciphertext_sha256": request["target_ciphertext_sha256"]}
        if value != c["quote_operation_origin"] or value["operation"] not in ("put", "create", "restore"):
            error("inconsistent_history")
        return value
    except (ValueError, TypeError, KeyError):
        error("inconsistent_history")


def expected_origin(db, row, key):
    item = expectation(row, key)
    ident = item["semantic_origin_id"]
    return operation(db, ident, row.owner_id, row.local_id, active_id=row.id) if ident else None


def storage_row(db, owner, local, key, raw):
    if raw is None:
        revision = db.get(NoteRevision, key["id"])
        if revision is None or revision.owner_id != owner or revision.local_id != local:
            error("inconsistent_history")
        raw = revision.snapshot_json
    try:
        wrapper = json.loads(raw)
        ident = wrapper["binding"]["transition_id"]
        if raw is not None and key["kind"] == "revision_before":
            revision = db.get(NoteRevision, key["id"])
            after = json.loads(revision.snapshot_json)
            if after["binding"]["transition_id"] != ident:
                error("inconsistent_history")
    except (ValueError, TypeError, KeyError, AttributeError):
        error("inconsistent_history")
    row = db.get(NoteCryptoTransition, ident)
    if row is None or row.owner_id != owner or row.local_id != local or row.state != "committed":
        error("inconsistent_history")
    return row


def semantic_id(db, owner, local, key, raw):
    if key["kind"] == "note_body":
        return None
    head = db.get(NoteHead, (owner, local))
    if head is None or head.crypto_epoch == 0:
        if db.get(NoteRepresentationOrigin, (owner, local, canonical(key))) is not None:
            error("inconsistent_history")
        return None
    row = storage_row(db, owner, local, key, raw)
    c = json.loads(row.conditions_json)
    receipt = json.loads(row.receipt_json) if row.receipt_json else {}
    if c.get("origin_metadata_legacy") == LEGACY:
        if row.purpose != "conversion" or "origin_metadata_version" in c or "origin_metadata_version" in receipt:
            error("inconsistent_history")
        from app.models.note_crypto import NoteCryptoEntry
        from app.services.note_crypto_storage import destination
        known = [destination(json.loads(e)) for e in db.scalars(select(NoteCryptoEntry.key_json).where(NoteCryptoEntry.transition_id == row.id))]
        if key not in known + c.get("null_slots", []):
            error("inconsistent_history")
        existing = db.get(NoteRepresentationOrigin, (owner, local, canonical(key)))
        if existing and existing.semantic_origin_id is not None:
            error("inconsistent_history")
        return None
    item = expectation(row, key)
    if (row.purpose not in ("conversion", "protected_write") or receipt.get("origin_metadata_version") != 1
        or type(receipt.get("origin_metadata_version")) is not int
        or receipt.get("origin_expectations_digest") != expectations_digest(row)
        or item["is_null"] != (raw is None) or not item["origin_row_required"]):
        error("inconsistent_history")
    value = db.get(NoteRepresentationOrigin, (owner, local, canonical(key)))
    if value is None or value.semantic_origin_id != item["semantic_origin_id"]:
        error("inconsistent_history")
    ident = value.semantic_origin_id
    if ident is not None:
        operation(db, ident, owner, local)
    return ident


def read(db, owner, local, key, raw):
    ident = semantic_id(db, owner, local, key, raw)
    return operation(db, ident, owner, local) if ident else None


def conversion_expectations(db, owner, local, items, null_slots):
    from app.models.note import Note
    from app.models.note_history import NoteInventory
    from app.models.note_v2 import NoteOfflineBranch
    from app.services.note_crypto_storage import destination
    result = []
    for key in [i["key"] for i in items] + list(null_slots):
        kind, ident = key["kind"], key["id"]
        raw = None
        if kind in ("revision_snapshot", "revision_before"):
            target = db.get(NoteRevision, ident)
            raw = target.snapshot_json if kind == "revision_snapshot" else target.before_snapshot_json
        elif kind == "inventory_snapshot":
            raw = db.get(NoteInventory, (owner, local, int(ident))).snapshot_json
        elif kind == "offline_snapshot":
            raw = db.get(NoteOfflineBranch, ident).snapshot_json
        elif kind == "note_body":
            raw = db.get(Note, int(ident)).content
        ref = None if kind == "reserved_offline_snapshot" else semantic_id(db, owner, local, key, raw)
        result.append({"destination_key": destination(key), "is_null": key in null_slots,
                       "origin_row_required": kind != "note_body", "semantic_origin_id": ref})
    return sorted(result, key=lambda item: canonical(item["destination_key"]))


def install(db, row):
    for item in json.loads(row.conditions_json)["origin_expectations"]:
        key = canonical(item["destination_key"])
        if not item["origin_row_required"]:
            continue
        target = db.get(NoteRepresentationOrigin, (row.owner_id, row.local_id, key))
        if target is None:
            target = NoteRepresentationOrigin(owner_id=row.owner_id, local_id=row.local_id, key_json=key)
            db.add(target)
        target.semantic_origin_id = item["semantic_origin_id"]
