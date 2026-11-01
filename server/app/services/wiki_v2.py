"""Wiki v2 content validation; storage and transaction ownership stay with the caller."""
import hashlib
import json
from sqlalchemy import select
from app.models.library import LibraryResource
from app.models.note_history import NoteHead, NoteRevision, NoteInventory
from app.models.note_v2 import NoteOfflineBranch
from app.schemas.wiki import WikiArtifact, WikiArtifactV2, WikiDraftV2, WikiLinkV2, canonical, digest
from app.services import note_v2 as notes, wiki_guards as guard
from app.services.note_crypto_fence import require_unfenced, error


def evidence(draft):
    return draft.evidence_manifest if isinstance(draft, WikiDraftV2) else draft.source_manifest


def parse(content, owner, ident):
    raw = json.loads(content)
    value = (WikiArtifactV2 if raw.get("schema_version") == 2 else WikiArtifact).model_validate(raw)
    if value.wiki_id != ident or value.scope.owner != owner:
        error("wiki_identity_mismatch", 403)
    return value


def plain(db, owner, local):
    require_unfenced(db, [(owner, local)])
    head = db.get(NoteHead, (owner, local))
    if head is None:
        error("wiki_source_unavailable")
    # Epoch can return to a plain current representation, but lineage remains protected.
    if head.crypto_epoch != 0 or head.protection_state != "legacy":
        error("wiki_protected_batch_not_supported")
    for model in (NoteRevision, NoteInventory, NoteOfflineBranch):
        for row in db.scalars(select(model).where(model.owner_id == owner, model.local_id == local)):
            if row.representation_epoch != 0 or row.representation_kind != "snapshot_v1":
                error("wiki_protected_batch_not_supported")
    return head


def pinned_wiki(db, owner, ref, *, allow_deleted=False):
    local = "wiki:" + ref.wiki_id
    head = plain(db, owner, local)
    index = db.get(LibraryResource, (owner, "wikis", ref.wiki_id))
    if index is None or (index.deleted_at is not None and not allow_deleted):
        error("wiki_source_unavailable")
    guard.link(index)
    for row in db.scalars(select(NoteRevision).where(NoteRevision.owner_id == owner, NoteRevision.local_id == local)):
        raw = json.loads(row.snapshot_json)["note"]
        if json.loads(raw["content"]).get("document_version") != ref.document_version:
            continue
        doc=parse(raw["content"],owner,ref.wiki_id)
        if isinstance(doc,WikiArtifactV2) and index.schema_version!=2:error("inconsistent_wiki_index")
        approval = next((a for a in doc.approvals if a.id == ref.approval_id and a.draft_id == ref.draft_id), None)
        draft = next((d for d in doc.drafts if d.id == ref.draft_id), None)
        if approval is not None and draft is not None and draft.draft_hash == ref.content_hash:
            return doc, draft, row.id
    error("wiki_source_unavailable")


def validate_evidence(db, owner, refs, *, current=False, stack=(), visited=None, archive=False, memo=None):
    visited = set() if visited is None else visited
    memo={} if memo is None else memo
    leaves, wiki_refs, bodies = set(), {}, {}
    if len(stack) > 32:
        error("wiki_dependency_limit")
    for ref in refs:
        kind = getattr(ref, "kind", "note")
        actual_owner = ref.note_ref.owner_id if kind == "note" else ref.owner_id
        if actual_owner != owner or ref.origin != "server":
            error("wiki_server_input_required")
        if kind == "note":
            local = ref.note_ref.local_id
            if guard.wiki_id(local) is not None:
                error("wiki_input_kind")
            head = plain(db, owner, local)
            revision = db.get(NoteRevision, ref.source_revision_id)
            if revision is None or revision.owner_id != owner or revision.local_id != local:
                error("wiki_source_unavailable")
            raw = json.loads(revision.snapshot_json)["note"]
            if raw["deleted_at"] is not None or notes.encrypted(raw["content"]) or hashlib.sha256(raw["content"].encode()).hexdigest() != ref.content_hash:
                error("wiki_source_changed")
            if current and (head.identity_state!="coherent" or head.head_revision_id != ref.source_revision_id or head.version != ref.head_version):
                error("wiki_source_changed")
            leaves.add((owner, local)); bodies[ref.id] = raw["content"]
        else:
            key = (ref.wiki_id, ref.draft_id, ref.approval_id, ref.document_version, ref.content_hash)
            if key in stack:
                error("wiki_dependency_cycle")
            visited.add(key)
            if len(visited) > 2000:
                error("wiki_dependency_limit")
            if key in memo and not current:
                children,ancestors,draft=memo[key]
                leaves.update(children);wiki_refs.update(ancestors);bodies[ref.id]=draft
                if len(leaves)>1000 or len(wiki_refs)>1000:error("wiki_dependency_limit")
                continue
            doc, draft, _ = pinned_wiki(db, owner, ref, allow_deleted=archive)
            if current:
                head = db.get(NoteHead, (owner, "wiki:"+ref.wiki_id))
                current_note = db.get(NoteRevision, head.head_revision_id)
                latest = parse(json.loads(current_note.snapshot_json)["note"]["content"], owner, ref.wiki_id)
                if latest.document_version != ref.document_version or not latest.approvals or latest.approvals[-1].id != ref.approval_id:
                    error("wiki_source_changed")
            children, ancestors, _ = validate_evidence(db, owner, evidence(draft), current=False,
                                                      stack=(*stack, key), visited=visited, archive=archive,memo=memo)
            leaves.update(children);wiki_refs.update(ancestors)
            wiki_refs[key] = dict(owner_id=owner, wiki_id=ref.wiki_id, draft_id=ref.draft_id,
                approval_id=ref.approval_id, document_version=ref.document_version, content_hash=ref.content_hash)
            bodies[ref.id] = draft
            memo[key]=(set(children),{**ancestors,key:wiki_refs[key]},draft)
        if len(leaves) > 1000 or len(wiki_refs) > 1000:
            error("wiki_dependency_limit")
    return leaves, wiki_refs, bodies


def validate_document(db, owner, value, operation, documents, previous=None, *, visited=None, memo=None):
    leaves, wiki_refs = set(), {}
    visited=set() if visited is None else visited
    memo={} if memo is None else memo
    bindings = {(b.wiki_id, b.draft_id): b.draft_hash for b in operation.draft_bindings}
    old_ids={d.id for d in previous.drafts} if previous else set()
    for draft in value.drafts:
        refs = evidence(draft)
        found, inherited, bodies = validate_evidence(db, owner, refs,visited=visited,memo=memo)
        leaves.update(found);wiki_refs.update(inherited)
        for citation in draft.citations:
            target = bodies.get(getattr(citation, "evidence_id", getattr(citation, "source_id", None)))
            if isinstance(target, str):
                text = target
            else:
                section = next((s for s in target.sections if s.id == citation.section_id), None) if target else None
                if section is None:
                    error("wiki_quote_mismatch", 422)
                text = section.markdown
            if citation.quote not in text:
                error("wiki_quote_mismatch", 422)
        for relation in (getattr(draft, "relations", []) if draft.id not in old_ids else []):
            target = relation.to_ref
            if target.wiki_id == value.wiki_id:
                error("wiki_self_relation")
            if target.kind == "proposal":
                other = documents.get(target.wiki_id)
                chosen = next((d for d in other.drafts if d.id == target.draft_id), None) if other else None
                if target.operation_id != operation.operation_id or chosen is None or bindings.get((target.wiki_id, target.draft_id)) != chosen.draft_hash:
                    error("wiki_relation_target")
            else:
                index = db.get(LibraryResource, (owner, "wikis", target.wiki_id))
                if index is None or index.deleted_at:
                    error("wiki_relation_target")
                head = plain(db, owner, "wiki:"+target.wiki_id)
                raw = db.get(NoteRevision, head.head_revision_id)
                other = parse(json.loads(raw.snapshot_json)["note"]["content"], owner, target.wiki_id)
                chosen = next((d for d in other.drafts if d.id == target.draft_id), None)
                if chosen is None or chosen.draft_hash != target.draft_hash or not any(a.id == target.approval_id and a.draft_id == target.draft_id for a in other.approvals):
                    error("wiki_relation_target")
            if target.section_id is not None and not any(s.id == target.section_id for s in chosen.sections):
                error("wiki_relation_section")
    if len(leaves) > 1000 or len(wiki_refs) > 1000:
        error("wiki_dependency_limit")
    return leaves, wiki_refs


def validate_retained_inputs(db,owner,value,index,*,visited,memo):
    link=guard.link(index)
    for ref in link.dependencies:plain(db,ref.owner_id,ref.local_id)
    from app.schemas.wiki import WikiEvidenceV2
    retained=[WikiEvidenceV2(**ref.model_dump(),id="retained_"+str(i),kind="wiki",origin="server")
              for i,ref in enumerate(getattr(link,"wiki_dependencies",[]))]
    leaves,ancestors,_=validate_evidence(db,owner,retained,visited=visited,memo=memo)
    for draft in value.drafts:
        found,refs,_=validate_evidence(db,owner,evidence(draft),visited=visited,memo=memo)
        leaves.update(found);ancestors.update(refs)
    for branch in db.scalars(select(NoteOfflineBranch).where(NoteOfflineBranch.owner_id==owner,NoteOfflineBranch.local_id=="wiki:"+value.wiki_id)):
        retained_doc=parse(json.loads(branch.snapshot_json)["note"]["content"],owner,value.wiki_id)
        for draft in retained_doc.drafts:
            found,refs,_=validate_evidence(db,owner,evidence(draft),visited=visited,memo=memo)
            leaves.update(found);ancestors.update(refs)
    declared={(r.owner_id,r.local_id) for r in link.dependencies}
    declared_wikis={canonical(r.model_dump()) for r in getattr(link,"wiki_dependencies",[])}
    if not leaves.issubset(declared) or not {canonical(r) for r in ancestors.values()}.issubset(declared_wikis):
        error("inconsistent_wiki_index")
    if len(leaves)>1000 or len(ancestors)>1000:error("wiki_dependency_limit")


def index_payload(db, owner, wiki_id, leaves, wiki_refs, *, visited=None, memo=None):
    row = db.get(LibraryResource, (owner, "wikis", wiki_id))
    if row is not None:
        old = guard.link(row)
        leaves.update((ref.owner_id, ref.local_id) for ref in old.dependencies)
        for ref in getattr(old, "wiki_dependencies", []):
            key = (ref.wiki_id, ref.draft_id, ref.approval_id, ref.document_version, ref.content_hash)
            wiki_refs[key] = ref.model_dump()
    if len(leaves)>1000 or len(wiki_refs)>1000:error("wiki_dependency_limit")
    for source_owner,local in sorted(leaves):plain(db,source_owner,local)
    from app.schemas.wiki import WikiEvidenceV2
    retained=[WikiEvidenceV2(**ref,id="retained_"+str(i),kind="wiki",origin="server") for i,ref in enumerate(wiki_refs.values())]
    extra,ancestors,_=validate_evidence(db,owner,retained,visited=visited,memo=memo)
    leaves.update(extra);wiki_refs.update(ancestors)
    if len(leaves)>1000 or len(wiki_refs)>1000:error("wiki_dependency_limit")
    refs = [dict(owner_id=o, local_id=l) for o,l in sorted(leaves)]
    value = dict(artifact_local_id="wiki:"+wiki_id, dependencies=refs,
                 wiki_dependencies=[wiki_refs[k] for k in sorted(wiki_refs)], document_schema_floor=2)
    value["lineage_manifest_hash"] = digest(value)
    result=WikiLinkV2.model_validate(value).model_dump()
    if len(canonical(result).encode("utf-8"))>256*1024:error("payload_too_large",413)
    return result


def validate_archived_relations(db,owner,value,cache):
    """Check retained relation identity without treating encrypted targets as plaintext."""
    for draft in value.drafts:
        for relation in getattr(draft,"relations",[]):
            target=relation.to_ref
            if target.wiki_id==value.wiki_id:raise ValueError("backup_wiki_relation")
            cache_key=(owner,canonical(target.model_dump()))
            if cache_key in cache:continue
            index=db.get(LibraryResource,(owner,"wikis",target.wiki_id))
            if index is None:raise ValueError("backup_wiki_relation")
            guard.link(index)
            chosen=None;has_cipher=False
            if target.kind=="proposal":
                from app.services.wiki_operations import _load
                _,record=_load(db,owner,target.operation_id)
                if record.state!="committed":raise ValueError("backup_wiki_relation")
                binding=next((b for b in record.manifest.draft_bindings if b.wiki_id==target.wiki_id and b.draft_id==target.draft_id),None)
                change=next((c for c in record.manifest.changes if c.wiki_id==target.wiki_id),None)
                if binding is None or change is None:raise ValueError("backup_wiki_relation")
                from app.models.library import LibraryMutation
                receipt=db.get(LibraryMutation,(owner,change.note_mutation_id))
                if receipt is None:raise ValueError("backup_wiki_relation")
                revision=db.get(NoteRevision,json.loads(receipt.response_json)["result_revision_id"])
                if revision is None or revision.owner_id!=owner or revision.local_id!="wiki:"+target.wiki_id:raise ValueError("backup_wiki_relation")
                rows=[revision];expected_hash=binding.draft_hash
            else:
                rows=db.scalars(select(NoteRevision).where(NoteRevision.owner_id==owner,NoteRevision.local_id=="wiki:"+target.wiki_id))
                expected_hash=target.draft_hash
            for row in rows:
                if row.representation_kind=="history_envelope_v1" and row.representation_epoch>0:
                    has_cipher=True;continue
                if row.representation_kind!="snapshot_v1":raise ValueError("backup_wiki_relation")
                other=parse(json.loads(row.snapshot_json)["note"]["content"],owner,target.wiki_id)
                candidate=next((d for d in other.drafts if d.id==target.draft_id and d.draft_hash==expected_hash),None)
                if candidate is not None and (target.kind=="proposal" or any(a.id==target.approval_id and a.draft_id==target.draft_id for a in other.approvals)):
                    chosen=candidate;break
            if chosen is None and not has_cipher:raise ValueError("backup_wiki_relation")
            if chosen is not None and target.section_id is not None and not any(s.id==target.section_id for s in chosen.sections):
                raise ValueError("backup_wiki_relation")
            # Cipher rows are validated by the existing native/mixed origin and graph checks;
            # approval/section semantics remain key-holder checks, never server decryption.
            cache.add(cache_key)
