"""Wiki indexes contain IDs only; all material remains in the Note protection scope."""
import json
from contextlib import contextmanager
from uuid import UUID

from sqlalchemy import select

from app.models.library import LibraryResource
from app.models.note_history import NoteHead
from app.schemas.wiki import WikiLink
from app.services.note_crypto_fence import error

INTERNAL = "nownote_wiki_internal_write"


def wiki_id(local):
    if not isinstance(local, str) or not local.startswith("wiki:"):
        return None
    try:
        value = str(UUID(local[5:]))
    except ValueError:
        return None
    return value if "wiki:" + value == local else None


def link(row):
    try:
        value = WikiLink.model_validate(json.loads(row.payload_json))
    except (ValueError, TypeError):
        error("inconsistent_wiki_index")
    if (value.artifact_local_id != "wiki:" + row.id
            or any(ref.owner_id != row.owner_id for ref in value.dependencies)):
        error("inconsistent_wiki_index")
    return value


def reserved(db, owner, local):
    ident = wiki_id(local)
    if ident is None:
        return False
    row = db.get(LibraryResource, (owner, "wikis", ident))
    return row is not None and link(row).artifact_local_id == local


@contextmanager
def internal_write(db, owner, local):
    previous = db.info.get(INTERNAL)
    db.info[INTERNAL] = (owner, local)
    try:
        yield
    finally:
        if previous is None:
            db.info.pop(INTERNAL, None)
        else:
            db.info[INTERNAL] = previous


def require_review(db, refs):
    for owner, local in sorted(set(refs)):
        if db.info.get(INTERNAL) != (owner, local) and reserved(db, owner, local):
            error("wiki_review_required")


def fully_protected(db, owner, local):
    from app.services import note_mixed_metadata as mixed
    from app.services.note_crypto_fence import active_fence
    head = db.get(NoteHead, (owner, local))
    if head is None or head.protection_state != "protected" or head.crypto_epoch <= 0:
        return False
    if active_fence(db, owner, local) is not None:
        return False
    mixed.validate(db, owner, local)
    slots = mixed.slots(db, owner, local)
    encrypted = {"content_encrypted_v1", "history_envelope_v1", "linked_text_envelope_v1"}
    return bool(slots) and all(raw is None or (kind in encrypted and epoch > 0)
                               for _, _, raw, kind, epoch in slots)


def require_source_protection(db, owner, local):
    rows = db.scalars(select(LibraryResource).where(
        LibraryResource.owner_id == owner, LibraryResource.kind == "wikis"))
    pending = []
    for row in rows:
        value = link(row)
        if any(ref.owner_id == owner and ref.local_id == local for ref in value.dependencies):
            if not fully_protected(db, owner, value.artifact_local_id):
                pending.append(row.id)
    if pending:
        error("wiki_protection_required")
