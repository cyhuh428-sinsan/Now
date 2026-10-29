"""E4a1: stable identity, immutable metadata manifest, lease and source reads."""
import base64
import hashlib
import json
from datetime import timedelta
from functools import wraps
from uuid import UUID, uuid4

from sqlalchemy import delete, select

from app.models.note import AnalysisJob, Note, Recording
from app.models.note_crypto import NoteCryptoEntry, NoteCryptoFence, NoteCryptoTransition, ServerIdentity
from app.models.note_history import NoteHead, NoteInventory, NoteRevision
from app.models.note_v2 import NoteOfflineBranch
from app.services.note_crypto_fence import ACTIVE_STATES, active_fence, database_now, error, expire, require_unfenced
from app.services.note_history import finalize_history, inventories, lock_note_writes, prepare_history
from app.services.note_v2 import canonical
from app.services.note_sync import _note_sort_key
from app.services.user_devices import require_active_user_device


def initialize_identity(connection):
    existing = connection.scalar(select(ServerIdentity.instance_id).where(ServerIdentity.id == 1))
    if existing is not None:
        return existing
    if connection.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    connection.execute(insert(ServerIdentity).values(id=1, instance_id=str(uuid4())).on_conflict_do_nothing(index_elements=["id"]))
    return connection.scalar(select(ServerIdentity.instance_id).where(ServerIdentity.id == 1))


def transactional(fn):
    @wraps(fn)
    def operation(db, *args, **kwargs):
        try:
            result = fn(db, *args, **kwargs)
            db.commit()
            return result
        except Exception:
            db.rollback()
            raise
    return operation


def authenticate_actor(db, owner, device):
    lock_note_writes(db, [owner])
    require_active_user_device(db, owner_id=owner, device_id=device)


def base_state(db, owner, local, *, baseline=True):
    rows = list(db.scalars(select(Note).where(Note.owner_id == owner, Note.local_id == local)))
    fence = active_fence(db, owner, local)
    head = db.get(NoteHead, (owner, local))
    inventory = inventories(db, owner, local)
    native = list(db.scalars(select(NoteRevision).where(NoteRevision.owner_id == owner, NoteRevision.local_id == local)))
    branches = list(db.scalars(select(NoteOfflineBranch).where(NoteOfflineBranch.owner_id == owner, NoteOfflineBranch.local_id == local)))
    pristine = head is None and not inventory and not native and not branches
    if baseline and rows and fence is None and pristine:
        prepare_history(db, owner, local)
        finalize_history(db, None)
        head = db.get(NoteHead, (owner, local))
        inventory = inventories(db, owner, local)
        native = list(db.scalars(select(NoteRevision).where(NoteRevision.owner_id == owner, NoteRevision.local_id == local)))
    if head is None and (inventory or native or branches):
        error("inconsistent_history")
    validate_existing_graph(rows, inventory, native, branches, head)
    if rows:
        indexed = {item.note_id: item for item in inventory}
        ambiguous = len({row.note_type for row in rows}) > 1
        expected_pointer = None if ambiguous else indexed.get(max(rows, key=_note_sort_key).id)
        expected_pointer = expected_pointer.revision_id if expected_pointer else None
        if (head is None or set(indexed) != {row.id for row in rows}
            or head.identity_state != ("ambiguous" if ambiguous else "coherent")
            or head.head_revision_id != expected_pointer):
            error("inconsistent_history")
    elif inventory or (head and (head.head_revision_id is not None or head.identity_state != "branch_only")):
        error("inconsistent_history")
    return {"head_version": head.version if head else 0, "head_revision_id": head.head_revision_id if head else None,
            "crypto_epoch": head.crypto_epoch if head else 0, "history_generation": head.history_generation if head else 0,
            "protection_state": head.protection_state if head else "legacy",
            "inventory_revision_ids": sorted(item.revision_id for item in inventory),
            "identity_state": head.identity_state if head else "empty", "current_exists": bool(rows)}


def validate_existing_graph(rows, inventory, native, branches, head):
    physical = {row.id: row for row in rows}
    revisions = {row.id: row for row in native}
    graph = {}
    for row in native + branches:
        try:
            UUID(row.id)
        except (ValueError, TypeError, AttributeError):
            error("inconsistent_history")
    for item in inventory:
        revision = revisions.get(item.revision_id)
        if item.note_id not in physical or revision is None or revision.note_id != item.note_id:
            error("inconsistent_history")
        if head and item.representation_epoch != head.crypto_epoch:
            error("inconsistent_history")
    for row in native:
        if row.note_id not in physical or (head and row.representation_epoch != head.crypto_epoch):
            error("inconsistent_history")
        parent = revisions.get(row.parent_revision_id) if row.parent_revision_id is not None else None
        if row.parent_revision_id is not None and (parent is None or parent.note_id != row.note_id):
            error("inconsistent_history")
        graph[("note_revision", row.id)] = ("note_revision", row.parent_revision_id) if parent else None
    for row in branches:
        if head and row.representation_epoch != head.crypto_epoch:
            error("inconsistent_history")
        if (row.parent_id is None) != (row.parent_kind is None):
            error("inconsistent_history")
        if row.parent_id is not None and row.parent_kind not in ("note_revision", "offline_branch"):
            error("inconsistent_history")
        graph[("offline_branch", row.id)] = (row.parent_kind, row.parent_id) if row.parent_id is not None else None
    if head and head.head_revision_id is not None and head.head_revision_id not in revisions:
        error("inconsistent_history")
    completed = set()
    for start in graph:
        seen, node = set(), start
        while node is not None and node not in completed:
            if node not in graph or node in seen:
                error("inconsistent_history")
            seen.add(node)
            node = graph[node]
        completed.update(seen)


def result(db, row):
    expire(db, row)
    from app.services.note_operation_origin import upgrade_pending
    upgrade_pending(db, row)
    if row.state == "committed":
        from app.services.note_crypto_storage import committed_result
        return committed_result(db, row)
    condition = json.loads(row.conditions_json)
    from app.models.note_crypto import NoteCryptoUpload, NoteCryptoChunk
    uploads = list(db.scalars(select(NoteCryptoUpload).where(NoteCryptoUpload.transition_id == row.id)))
    chunks = list(db.scalars(select(NoteCryptoChunk.chunk_index).where(NoteCryptoChunk.transition_id == row.id)))
    return {"transition_id": row.id, "state": row.state, "lease_version": row.lease_version,
            "expires_at": row.expires_at.isoformat(timespec="microseconds") + "Z",
            "server_instance_id": condition["server_instance_id"], "manifest_digest": row.manifest_digest,
            "expected_count": len(list(db.scalars(select(NoteCryptoEntry.key_json).where(NoteCryptoEntry.transition_id == row.id)))),
            "preparation_only": True, "base": condition["base"], "target_epoch": condition["request"]["target_epoch"],
            "uploaded_chunks": len(chunks), "sealed_entries": sum(u.ciphertext_sha256 is not None for u in uploads)}


def owned(db, owner, local, device, transition_id, purpose="conversion"):
    authenticate_actor(db, owner, device)
    row = db.get(NoteCryptoTransition, transition_id)
    if row is None or row.owner_id != owner or row.local_id != local:
        error("transition_not_found", 404)
    if row.purpose != purpose:
        error("operation_mismatch")
    return expire(db, row)


@transactional
def status(db, owner, local, device, transition_id=None):
    authenticate_actor(db, owner, device)
    identity = initialize_identity(db.connection())
    if transition_id:
        base_state(db, owner, local, baseline=False)
        return result(db, owned(db, owner, local, device, transition_id))
    return {"server_instance_id": identity, "preparation_only": True, **base_state(db, owner, local)}


def related_plaintext(db, owner, local):
    jobs = select(AnalysisJob.id).where(AnalysisJob.owner_id == owner, AnalysisJob.note_local_id == local,
        (AnalysisJob.input_text.is_not(None)
         | AnalysisJob.result_json.is_not(None)
         | AnalysisJob.error_message.is_not(None)
         | AnalysisJob.status.in_(["queued", "running"]))).limit(1)
    transcripts = select(Recording.id).where(Recording.owner_id == owner, Recording.note_local_id == local,
        Recording.transcript.is_not(None)).limit(1)
    return db.scalar(jobs) is not None or db.scalar(transcripts) is not None


def catalog(db, owner, local, epoch):
    items = []
    def add(kind, ident, slot, source="snapshot_v1"):
        items.append({"key": {"kind": kind, "id": str(ident), "slot": slot}, "source_etag": str(uuid4()),
                      "source_kind": source, "output_kind": "content_encrypted_v1" if kind == "note_body" else "history_envelope_v1",
                      "representation_epoch": epoch})
    for row in db.scalars(select(Note).where(Note.owner_id == owner, Note.local_id == local)):
        add("note_body", row.id, "content", "content_v1")
    for row in db.scalars(select(NoteRevision).where(NoteRevision.owner_id == owner, NoteRevision.local_id == local)):
        if row.representation_epoch != epoch:
            error("crypto_epoch_changed")
        add("revision_snapshot", row.id, "after", row.representation_kind)
        if row.before_snapshot_json is not None:
            add("revision_before", row.id, "before", row.representation_kind)
    for row in inventories(db, owner, local):
        add("inventory_snapshot", row.note_id, "current", row.representation_kind)
    for row in db.scalars(select(NoteOfflineBranch).where(NoteOfflineBranch.owner_id == owner, NoteOfflineBranch.local_id == local)):
        if row.representation_epoch != epoch:
            error("crypto_epoch_changed")
        add("offline_snapshot", row.id, "snapshot", row.representation_kind)
    return items


def validate_reservations(db, body):
    entries = {entry.revision_id: entry for entry in body.local_branches}
    if len(entries) != len(body.local_branches):
        error("revision_id_conflict")
    for entry in body.local_branches:
        if db.get(NoteOfflineBranch, entry.revision_id) is not None:
            error("revision_id_conflict")
        parent = entry.parent_ref
        if parent and not (parent.kind == "offline_branch" and parent.id in entries):
            model = NoteRevision if parent.kind == "note_revision" else NoteOfflineBranch
            row = db.get(model, parent.id)
            if row is None or row.owner_id != body.owner_id or row.local_id != body.local_id:
                error("invalid_revision_parent")
    completed = set()
    for ident in entries:
        seen, node = set(), ident
        while node in entries and node not in completed:
            if node in seen:
                error("invalid_revision_parent")
            seen.add(node)
            parent = entries[node].parent_ref
            node = parent.id if parent and parent.kind == "offline_branch" else None
        completed.update(seen)


def null_slots(db, owner, local):
    ids = db.scalars(select(NoteRevision.id).where(NoteRevision.owner_id == owner, NoteRevision.local_id == local,
                                                  NoteRevision.before_snapshot_json.is_(None)))
    return [{"kind": "revision_before", "id": ident, "slot": "before"} for ident in sorted(ids)]


@transactional
def prepare(db, body):
    authenticate_actor(db, body.owner_id, body.device_id)
    identity = initialize_identity(db.connection())
    if body.server_instance_id != identity:
        error("server_instance_changed")
    previous = db.scalar(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == body.owner_id,
                                                           NoteCryptoTransition.mutation_id == body.mutation_id))
    if previous:
        if previous.purpose != "conversion":
            error("idempotency_mismatch")
        if json.loads(previous.conditions_json)["request"] != body.model_dump():
            error("idempotency_mismatch")
        base_state(db, body.owner_id, body.local_id, baseline=False)
        return {"created": False, **result(db, previous)}
    require_unfenced(db, [(body.owner_id, body.local_id)])
    if related_plaintext(db, body.owner_id, body.local_id):
        error("related_plaintext_unresolved")
    base = base_state(db, body.owner_id, body.local_id)
    if body.crypto_epoch != base["crypto_epoch"] or body.target_epoch != base["crypto_epoch"] + 1:
        error("crypto_epoch_changed")
    if (body.base_head_version != base["head_version"] or body.base_revision_id != base["head_revision_id"]
        or body.expected_history_generation != base["history_generation"]
        or body.expected_inventory_revision_ids != base["inventory_revision_ids"]):
        error("version_conflict")
    validate_reservations(db, body)
    entries = catalog(db, body.owner_id, body.local_id, base["crypto_epoch"])
    for entry in body.local_branches:
        entries.append({"key": {"kind": "reserved_offline_snapshot", "id": entry.revision_id, "slot": "snapshot"},
                        "source_etag": str(uuid4()), "source_kind": "client_pending", "output_kind": "history_envelope_v1",
                        "representation_epoch": base["crypto_epoch"]})
    entries.sort(key=lambda item: canonical(item["key"]))
    if not entries:
        error("no_transition_representations")
    stamp, ident = database_now(db), str(uuid4())
    from app.services.note_operation_origin import conversion_expectations
    nullable = null_slots(db, body.owner_id, body.local_id)
    origin_expectations = conversion_expectations(db, body.owner_id, body.local_id, entries, nullable)
    row = NoteCryptoTransition(id=ident, owner_id=body.owner_id, local_id=body.local_id,
        mutation_id=body.mutation_id, actor_device_id=body.device_id,
        conditions_json=canonical({"request": body.model_dump(), "server_instance_id": identity, "base": base,
                                   "null_slots": nullable, "origin_metadata_version": 1,
                                   "origin_expectations": origin_expectations}),
        manifest_digest=hashlib.sha256(canonical(entries).encode()).hexdigest(), state="prepared", lease_version=1,
        created_at=stamp, expires_at=stamp + timedelta(minutes=30))
    db.add(row)
    db.flush()
    from app.services.note_crypto_storage import expected_binding
    for item in entries:
        db.add(NoteCryptoEntry(transition_id=ident, key_json=canonical(item["key"]),
                              binding_json=canonical(expected_binding(db, row, item["key"])),
                              **{k: v for k, v in item.items() if k != "key"}))
    db.add(NoteCryptoFence(owner_id=body.owner_id, local_id=body.local_id, transition_id=ident))
    db.flush()
    return {"created": True, **result(db, row)}


@transactional
def action(db, body, operation):
    row = owned(db, body.owner_id, body.local_id, body.device_id, body.transition_id)
    if row.actor_device_id != body.device_id:
        error("transition_actor_mismatch", 403)
    if operation == "abort":
        if row.state not in ACTIVE_STATES + ("aborted", "expired"):
            error("transition_not_active")
        if row.state in ACTIVE_STATES:
            row.state = "aborted"
            db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == row.id))
    else:
        if row.state == "expired":
            error("transition_expired", 410)
        if row.state not in ACTIVE_STATES:
            error("transition_not_active")
        if row.lease_version != body.lease_version:
            error("lease_changed")
        row.expires_at = database_now(db) + timedelta(minutes=30)
        row.lease_version += 1
    return result(db, row)


def entry_result(row):
    return {"key": json.loads(row.key_json), "source_etag": row.source_etag, "source_kind": row.source_kind,
            "output_kind": row.output_kind, "representation_epoch": row.representation_epoch}


@transactional
def manifest(db, owner, local, device, transition_id, limit, cursor, purpose="conversion"):
    row = owned(db, owner, local, device, transition_id, purpose)
    current = base_state(db, owner, local, baseline=False)
    condition = json.loads(row.conditions_json)
    if "null_slots" not in condition:
        if current != condition["base"]:
            error("binding_metadata_unavailable")
        condition["null_slots"] = null_slots(db, owner, local)
        row.conditions_json = canonical(condition)
    after = ""
    binding = [transition_id, owner, local, row.manifest_digest]
    if cursor:
        try:
            value = json.loads(base64.urlsafe_b64decode(cursor))
            if not isinstance(value, list) or len(value) != 5 or value[:4] != binding or not isinstance(value[4], str):
                error("manifest_changed")
            after = value[4]
        except (ValueError, TypeError):
            error("invalid_cursor", 422)
    rows = list(db.scalars(select(NoteCryptoEntry).where(NoteCryptoEntry.transition_id == row.id,
        NoteCryptoEntry.key_json > after).order_by(NoteCryptoEntry.key_json).limit(limit + 1)))
    next_cursor = base64.urlsafe_b64encode(canonical(binding + [rows[limit - 1].key_json]).encode()).decode() if len(rows) > limit else None
    from app.services.note_crypto_storage import entry_metadata
    after_ids = {json.loads(e.key_json)["id"] for e in rows[:limit] if json.loads(e.key_json)["kind"] == "revision_snapshot"}
    return {"items": [entry_metadata(db, row, e) for e in rows[:limit]], "next_cursor": next_cursor,
            "manifest_digest": row.manifest_digest, "state": row.state,
            "null_count": len(condition["null_slots"]),
            "null_slots": [{"key": key, "is_null": True} for key in condition["null_slots"] if key["id"] in after_ids]}


@transactional
def source(db, owner, local, device, transition_id, key, etag):
    row = owned(db, owner, local, device, transition_id)
    if row.state == "expired":
        error("transition_expired", 410)
    if row.state not in ACTIVE_STATES:
        error("source_unavailable")
    entry = db.get(NoteCryptoEntry, (row.id, canonical(key)))
    if entry is None or entry.source_etag != etag:
        error("source_not_found", 404)
    base = json.loads(row.conditions_json)["base"]
    if base_state(db, owner, local, baseline=False) != base:
        error("manifest_changed")
    kind, ident = key["kind"], key["id"]
    if kind == "reserved_offline_snapshot":
        error("client_source_only")
    if kind == "note_body":
        original = db.get(Note, int(ident)); value = original.content if original else None
    elif kind in ("revision_snapshot", "revision_before"):
        original = db.get(NoteRevision, ident)
        value = (original.before_snapshot_json if kind == "revision_before" else original.snapshot_json) if original else None
    elif kind == "inventory_snapshot":
        original = db.get(NoteInventory, (owner, local, int(ident))); value = original.snapshot_json if original else None
    else:
        original = db.get(NoteOfflineBranch, ident); value = original.snapshot_json if original else None
    if original is None or original.owner_id != owner or original.local_id != local or value is None:
        error("manifest_changed")
    from app.services.note_crypto_storage import entry_metadata
    return {**entry_metadata(db, row, entry), "value": value}
