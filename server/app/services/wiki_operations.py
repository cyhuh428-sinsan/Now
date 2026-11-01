"""Private reservation kernel. No routes, publication, or successful commit replay yet."""
import json
from datetime import datetime
from sqlalchemy import select
from app.models.library import LibraryResource, LibraryMutation
from app.models.note import UserAccount, UserDevice
from app.models.note_v2 import NoteMutation
from app.models.note_crypto import NoteCryptoTransition
from app.models.note_related import RelatedDrain
from app.models.protected_analysis import ProtectedAnalysisClaim
from app.schemas.wiki import canonical, digest
from app.schemas.wiki_operations import PrepareOperation, ReservedMutation, OperationRecord
from app.services.note_history import lock_note_writes
from app.services.note_crypto_fence import error
from app.services.user_devices import require_active_user_device

KIND = "wiki-operations"
RESERVED_BYTES = 128 * 1024
TOTAL_BYTES = 256 * 1024 * 1024


def phases(body):
    return [(body.mutation_id, "prepare", None), (body.commit_mutation_id, "commit", None),
            (body.abort_mutation_id, "abort", None),
            *[(item.note_mutation_id, "page", item.wiki_id) for item in body.changes]]


def fingerprint(body, phase, wiki_id):
    return digest(dict(operation_id=body.operation_id, manifest_hash=body.manifest_hash, phase=phase, wiki_id=wiki_id))


def require_unreserved(db, owner, mutation_id):
    """Guard before every existing writer/replay; no client-supplied bypass flag."""
    lock_note_writes(db, [owner])
    row = db.get(LibraryMutation, (owner, mutation_id))
    if row is None:
        return
    try:
        value = json.loads(row.response_json)
    except (ValueError, TypeError):
        error("idempotency_mismatch")
    if value.get("status") == "reserved":
        # Malformed reservations are also fail-closed.
        error("idempotency_mismatch")
    # The immutable prepare receipt also owns its UUID. Terminal receipts will retain this marker.
    if value.get("wiki_operation") is True:
        error("idempotency_mismatch")


def guard_request(db, args, kwargs):
    body = kwargs.get("body", args[0] if args else None)
    if getattr(body, "mutation_id", None) is not None and getattr(body, "owner_id", None) is not None:
        lock_note_writes(db, [body.owner_id])
        # Existing handlers register a new device themselves with autoflush disabled.
        # Only recheck persisted devices here; a second registration would duplicate it.
        if getattr(body, "device_id", None) is not None and db.scalar(select(UserDevice).where(
                UserDevice.owner_id == body.owner_id, UserDevice.device_id == body.device_id)) is not None:
            require_active_user_device(db, owner_id=body.owner_id, device_id=body.device_id)
        require_unreserved(db, body.owner_id, body.mutation_id)


def _check_collision(db, owner, ident):
    for model in (LibraryMutation, NoteMutation, NoteCryptoTransition, RelatedDrain, ProtectedAnalysisClaim):
        if db.scalar(select(model).where(model.owner_id == owner, model.mutation_id == ident).limit(1)) is not None:
            error("idempotency_mismatch")
    # Legacy conversion commits have a second UUID held in their fixed commit body.
    for row in db.scalars(select(NoteCryptoTransition).where(NoteCryptoTransition.owner_id == owner,
                         NoteCryptoTransition.commit_conditions_json.is_not(None))):
        if json.loads(row.commit_conditions_json).get("mutation_id") == ident:
            error("idempotency_mismatch")


def _budget(body, inventory_ids):
    receipt = dict(status="ok", wiki_operation=True, operation_id=body.operation_id,
                   manifest_hash=body.manifest_hash, state="prepared")
    estimated = dict(manifest=body.model_dump(), prepare=receipt, reserved_bytes=RESERVED_BYTES,
        reservations=[dict(mutation_id=ident, fingerprint=fingerprint(body, phase, wiki)) for ident, phase, wiki in phases(body)],
        # Overestimate fixed metadata; bodies/quotes are never placed here.
        terminal_receipts=[dict(mutation_id=ident, result_revision_id="f"*36, result_head_version=2**63-1,
            result_inventory_revision_ids=[*inventory_ids.get(wiki, []), "f"*36],
            metadata_padding="x"*512) for ident, phase, wiki in phases(body)])
    if len(canonical(estimated).encode("utf-8")) > RESERVED_BYTES:
        error("wiki_operation_limit")
    return receipt


def reserve_operation(db, body, *, inventory_ids=None):
    """Internal only: b2 must validate live sources/targets before using this kernel."""
    body = PrepareOperation.model_validate(body.model_dump())
    try:
        lock_note_writes(db, [body.owner_id])
        require_active_user_device(db, owner_id=body.owner_id, device_id=body.device_id)
        account = db.scalar(select(UserAccount).where(UserAccount.owner_id == body.owner_id).with_for_update())
        if account is None or not account.is_active:
            error("owner_unavailable", 403)
        row = db.get(LibraryResource, (body.owner_id, KIND, body.operation_id))
        if row is not None:
            stored = OperationRecord.model_validate_json(row.payload_json)
            if row.schema_version != 1 or stored.manifest != body:
                error("idempotency_mismatch")
            receipt = db.get(LibraryMutation, (body.owner_id, body.mutation_id))
            if receipt is None or receipt.request_hash != fingerprint(body, "prepare", None):
                error("inconsistent_wiki_operation")
            result = json.loads(receipt.response_json)
            db.commit()
            return result
        for ident, _, _ in phases(body):
            _check_collision(db, body.owner_id, ident)
        rows = list(db.scalars(select(LibraryResource).where(LibraryResource.owner_id == body.owner_id,
                                                            LibraryResource.kind == KIND)))
        states = [OperationRecord.model_validate_json(item.payload_json) for item in rows]
        if len(rows) >= 2000 or sum(s.state == "prepared" for s in states) >= 100 or sum(s.reserved_bytes for s in states)+RESERVED_BYTES > TOTAL_BYTES:
            error("wiki_operation_limit")
        if inventory_ids is None:
            from app.services.note_history import inventories
            inventory_ids = {item.wiki_id: [row.revision_id for row in inventories(db, body.owner_id, "wiki:"+item.wiki_id)]
                             for item in body.changes}
        result = _budget(body, inventory_ids)
        stamp = datetime.utcnow()
        db.add(LibraryResource(owner_id=body.owner_id, kind=KIND, id=body.operation_id, schema_version=1,
            version=1, created_at=stamp, updated_at=stamp, payload_json=canonical(dict(
                state="prepared", manifest=body.model_dump(), reserved_bytes=RESERVED_BYTES))))
        for ident, phase, wiki in phases(body):
            value = result if phase == "prepare" else ReservedMutation(status="reserved", operation_id=body.operation_id,
                phase=phase, wiki_id=wiki, manifest_hash=body.manifest_hash).model_dump(exclude_none=True)
            db.add(LibraryMutation(owner_id=body.owner_id, mutation_id=ident,
                request_hash=fingerprint(body, phase, wiki), response_json=canonical(value)))
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
