"""Wiki publication reuses Note history and stores no text in its opaque index."""
import hashlib
import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, select

from app.models.library import LibraryMutation, LibraryResource
from app.models.note import Note, UserAccount
from app.models.note_history import NoteHead, NoteRevision
from app.models.note_v2 import NoteMutation, NoteOfflineBranch
from app.schemas.wiki import WikiArtifact, WikiLink, canonical
from app.services import note_v2 as notes
from app.services.library import resource_payload
from app.services.note_crypto_fence import error, require_unfenced
from app.services.note_history import inventories, lock_note_writes
from app.services.user_devices import require_active_user_device
from app.services.wiki_artifact import validate_append
from app.services import wiki_guards as guard


def parse_document(content, owner, ident):
    try:
        if len(content.encode("utf-8")) > 2097152:
            error("wiki_artifact_capacity", 413)
        value = WikiArtifact.model_validate(json.loads(content))
    except (ValueError, TypeError):
        error("wiki_invalid_document", 422)
    if value.wiki_id != ident or value.scope.owner != owner:
        error("wiki_identity_mismatch", 403)
    return value


def document(db, owner, local):
    head, rows = notes.scope(db, owner, local)
    if not rows:
        return head, rows, None
    if head is None or head.identity_state != "coherent" or len(rows) != 1:
        error("inconsistent_wiki_artifact")
    if head.crypto_epoch > 0 or head.protection_state != "legacy":
        return head, rows, None
    revision = db.get(NoteRevision, head.head_revision_id)
    if (revision is None or revision.note_id != rows[0].id
            or revision.representation_kind != "snapshot_v1" or revision.representation_epoch != 0):
        error("inconsistent_wiki_artifact")
    stored = json.loads(revision.snapshot_json)["note"]
    if stored["content"] != rows[0].content or stored["source"] != "wiki-artifact":
        error("inconsistent_wiki_artifact")
    return head, rows, parse_document(rows[0].content, owner, guard.wiki_id(local))


def dependencies(values):
    return sorted({(source.note_ref.owner_id, source.note_ref.local_id)
                   for value in values for draft in value.drafts for source in draft.source_manifest})


def require_plain_sources(db, owner, refs):
    from app.services.note_crypto_fence import active_fence
    for source_owner, local in refs:
        if source_owner != owner or guard.reserved(db, owner, local):
            error("wiki_source_unavailable")
        head = db.get(NoteHead, (owner, local))
        if head is None or head.crypto_epoch != 0 or head.protection_state != "legacy":
            error("wiki_source_unavailable")
        if active_fence(db, owner, local) is not None:
            error("crypto_transition_in_progress", 423)


def verify_sources(db, owner, values, *, current=False):
    require_plain_sources(db, owner, dependencies(values))
    cache = {}
    for value in values:
        for draft in value.drafts:
            bodies = {}
            for source in draft.source_manifest:
                if source.origin != "server":
                    error("wiki_local_source_requires_local_storage", 422)
                local, ident = source.note_ref.local_id, source.source_revision_id
                if (local, ident) not in cache:
                    row = db.get(NoteRevision, ident)
                    if (row is None or row.owner_id != owner or row.local_id != local
                            or row.representation_kind != "snapshot_v1" or row.representation_epoch != 0):
                        error("wiki_source_unavailable")
                    # History rows bind immutable IDs, not a separate head sequence.
                    cache[(local, ident)] = json.loads(row.snapshot_json)["note"]
                raw = cache[(local, ident)]
                if (raw.get("deleted_at")
                        or notes.encrypted(raw["content"])
                        or hashlib.sha256(raw["content"].encode("utf-8")).hexdigest() != source.content_hash):
                    error("wiki_source_changed")
                if current:
                    head = db.get(NoteHead, (owner, local))
                    if (head.version != source.head_version or head.head_revision_id != ident
                            or head.identity_state != "coherent"):
                        error("wiki_source_changed")
                bodies[source.id] = raw["content"]
            for citation in draft.citations:
                if citation.quote not in bodies[citation.source_id]:
                    error("wiki_quote_mismatch", 422)


def request_hash(body, operation, values):
    return hashlib.sha256(canonical({"kind": "wikis", "operation": operation,
        "conditions": notes.conditions(body, operation), "dependencies": dependencies(values)}).encode()).hexdigest()


def update_index(db, owner, ident, row, values):
    refs = set(dependencies(values))
    if row is None:
        count = db.scalar(select(func.count()).select_from(LibraryResource).where(
            LibraryResource.owner_id == owner, LibraryResource.kind == "wikis", LibraryResource.deleted_at.is_(None)))
        if count >= 100:
            error("resource_limit")
        row = LibraryResource(owner_id=owner, kind="wikis", id=ident, schema_version=1, version=0,
                              created_at=datetime.utcnow())
        db.add(row)
    else:
        if row.deleted_at is not None:
            error("resource_deleted")
        refs.update((ref.owner_id, ref.local_id) for ref in guard.link(row).dependencies)
    link = WikiLink(artifact_local_id="wiki:" + ident,
                   dependencies=[{"owner_id": source_owner, "local_id": local} for source_owner, local in sorted(refs)])
    row.payload_json = canonical(link.model_dump())
    row.version += 1
    row.updated_at = datetime.utcnow()
    return row


def mutate(db, ident, body, operation):
    local = "wiki:" + ident
    if body.local_id != local:
        error("wiki_identity_mismatch", 422)
    try:
        lock_note_writes(db, [body.owner_id])
        require_active_user_device(db, owner_id=body.owner_id, device_id=body.device_id)
        db.scalar(select(UserAccount).where(UserAccount.owner_id == body.owner_id).with_for_update())
        head, rows = notes.scope(db, body.owner_id, local)
        values = [parse_document(body.note.content, body.owner_id, ident)] if operation == "put" else [
            parse_document(entry.snapshot.note.content, body.owner_id, ident) for entry in body.entries]
        incoming = [body.note] if operation == "put" else [entry.snapshot.note for entry in body.entries]
        if any(value.note_type != "tree" or value.source != "wiki-artifact" or value.deleted_at is not None
               or value.parent_local_id is not None or value.level != 1 or value.title != "AI Wiki " + ident for value in incoming):
            error("wiki_invalid_artifact_projection", 422)
        notes.check_epoch(head, body.crypto_epoch)
        if notes.protected(head):
            error("history_envelope_required")
        previous_note = db.get(NoteMutation, (body.owner_id, body.mutation_id))
        previous_index = db.get(LibraryMutation, (body.owner_id, body.mutation_id))
        hashed = request_hash(body, operation, values)
        if previous_note is not None or previous_index is not None:
            if previous_note is None or previous_index is None or previous_index.request_hash != hashed:
                error("idempotency_mismatch")
            replay = notes.replay(db, body, operation, head)
            db.commit()
            return replay
        require_unfenced(db, [(body.owner_id, local)])
        row = db.get(LibraryResource, (body.owner_id, "wikis", ident))
        if row is None and (head is not None or rows):
            error("wiki_artifact_id_occupied")
        if row is not None:
            guard.link(row)
        if any(value.scope != values[0].scope for value in values):
            error("wiki_identity_mismatch")
        saved_scope = None
        if row is not None:
            _, _, current_doc = document(db, body.owner_id, local)
            if current_doc is not None:
                saved_scope = current_doc.scope
            else:
                prior_branch = db.scalar(select(NoteOfflineBranch).where(NoteOfflineBranch.owner_id == body.owner_id,
                    NoteOfflineBranch.local_id == local).order_by(NoteOfflineBranch.id))
                if prior_branch is not None:
                    old_raw = json.loads(prior_branch.snapshot_json)["note"]
                    saved_scope = parse_document(old_raw["content"], body.owner_id, ident).scope
        if saved_scope is not None and saved_scope != values[0].scope:
            error("wiki_identity_mismatch")
        verify_sources(db, body.owner_id, values)
        imported = None
        if operation == "put":
            notes.validate_cas(db, body, head, rows)
            _, _, before = document(db, body.owner_id, local)
            value = values[0]
            if before is None:
                action = "create"
            else:
                delta = (len(value.drafts)-len(before.drafts), len(value.approvals)-len(before.approvals),
                         len(value.rejected_draft_ids)-len(before.rejected_draft_ids))
                action = {(1, 0, 0): "draft", (0, 1, 0): "approve", (0, 0, 1): "reject"}.get(delta)
            try:
                validate_append(before, value, action)
            except ValueError:
                error("wiki_document_conflict")
            if action == "approve":
                chosen = next(draft for draft in value.drafts if draft.id == value.approvals[-1].draft_id)
                verified = value.model_copy(update={"drafts": [chosen]})
                verify_sources(db, body.owner_id, [verified], current=True)
            row = update_index(db, body.owner_id, ident, row, values)
            with guard.internal_write(db, body.owner_id, local):
                head = notes.adopt(db, body, body.note, head, rows, "write")
        else:
            row = update_index(db, body.owner_id, ident, row, values)
            with guard.internal_write(db, body.owner_id, local):
                head, imported = notes.import_branches(db, body, head)
        result = {"status": "ok", "mutation_id": body.mutation_id, "result_revision_id": head.head_revision_id,
                  "result_head_version": head.version,
                  "result_inventory_revision_ids": sorted(item.revision_id for item in inventories(db, body.owner_id, local)),
                  "crypto_epoch": head.crypto_epoch, "history_generation": head.history_generation}
        if imported is not None:
            result["imported_refs"] = imported
        db.add(NoteMutation(owner_id=body.owner_id, mutation_id=body.mutation_id, local_id=local, operation=operation,
                            actor_device_id=body.device_id, crypto_epoch=body.crypto_epoch,
                            conditions_json=notes.canonical(notes.conditions(body, operation)), result_json=notes.canonical(result)))
        db.add(LibraryMutation(owner_id=body.owner_id, mutation_id=body.mutation_id, request_hash=hashed,
                               response_json=canonical({"status": "ok", "resource": resource_payload(row), "mutation_id": body.mutation_id})))
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


def get(db, owner, ident):
    try:
        lock_note_writes(db, [owner])
        row = db.get(LibraryResource, (owner, "wikis", ident))
        if row is None:
            error("resource_not_found", 404)
        value = guard.link(row)
        head, rows, stored = document(db, owner, value.artifact_local_id)
        if head is None:
            error("inconsistent_wiki_artifact")
        status = {"stale": False, "available": True}
        if stored:
            try:
                verify_sources(db, owner, [stored])
            except HTTPException:
                status = {"stale": True, "available": False}
            if status["available"]:
                try:
                    selected = next((draft for draft in stored.drafts if stored.approvals and
                        draft.id == stored.approvals[-1].draft_id), stored.drafts[-1])
                    verify_sources(db, owner, [stored.model_copy(update={"drafts": [selected]})], current=True)
                except HTTPException:
                    status["stale"] = True
        result = {"status": "ok", "resource": resource_payload(row), "source_status": status,
                  "artifact": {"local_id": value.artifact_local_id, "current_exists": bool(rows),
                               "head_version": head.version, "head_revision_id": head.head_revision_id,
                               "protected": head.crypto_epoch > 0,
                               "document": stored.model_dump() if stored and status["available"] else None}}
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
