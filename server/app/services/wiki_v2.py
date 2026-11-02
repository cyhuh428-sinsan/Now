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


def pinned_wiki(db, owner, ref, *, allow_deleted=False, revision_id=None):
    local = "wiki:" + ref.wiki_id
    head = plain(db, owner, local)
    index = db.get(LibraryResource, (owner, "wikis", ref.wiki_id))
    if index is None or (index.deleted_at is not None and not allow_deleted):
        error("wiki_source_unavailable")
    guard.link(index)
    stmt=select(NoteRevision).where(NoteRevision.owner_id == owner, NoteRevision.local_id == local)
    if revision_id is not None:stmt=stmt.where(NoteRevision.id==revision_id)
    for row in db.scalars(stmt):
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


def validate_evidence(db, owner, refs, *, current=False, stack=(), visited=None, archive=False, memo=None,
                      policy=1, pinned=None, pins=None):
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
            if not stack and pinned is not None and pinned.get(ref.id)!=ref.source_revision_id:
                error("wiki_source_unavailable")
            if revision is None or revision.owner_id != owner or revision.local_id != local:
                error("wiki_source_unavailable")
            raw = json.loads(revision.snapshot_json)["note"]
            if raw["deleted_at"] is not None or notes.encrypted(raw["content"]) or hashlib.sha256(raw["content"].encode()).hexdigest() != ref.content_hash:
                error("wiki_source_changed")
            if current and (head.identity_state!="coherent" or head.head_revision_id != ref.source_revision_id or head.version != ref.head_version):
                error("wiki_source_changed")
            leaves.add((owner, local)); bodies[ref.id] = raw["content"]
            if not stack and pins is not None:pins[ref.id]=revision.id
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
            doc, draft, revision_id = pinned_wiki(db, owner, ref, allow_deleted=archive,
                revision_id=pinned.get(ref.id) if pinned is not None and not stack else None)
            if not stack and pins is not None:pins[ref.id]=revision_id
            if current:
                head = db.get(NoteHead, (owner, "wiki:"+ref.wiki_id))
                current_note = db.get(NoteRevision, head.head_revision_id)
                if head.identity_state!="coherent" or current_note is None:error("wiki_source_unavailable")
                latest = parse(json.loads(current_note.snapshot_json)["note"]["content"], owner, ref.wiki_id)
                approved=latest.approvals[-1] if latest.approvals else None
                chosen=next((d for d in latest.drafts if approved is not None and d.id==approved.draft_id),None)
                version_ok=latest.document_version>=ref.document_version if policy==2 else latest.document_version==ref.document_version
                if (not version_ok or approved is None or approved.id!=ref.approval_id
                        or approved.draft_id!=ref.draft_id or chosen is None or chosen.draft_hash!=ref.content_hash):
                    error("wiki_source_changed")
            children, ancestors, _ = validate_evidence(db, owner, evidence(draft), current=False,
                                                      stack=(*stack, key), visited=visited, archive=archive,memo=memo,policy=policy)
            leaves.update(children);wiki_refs.update(ancestors)
            wiki_refs[key] = dict(owner_id=owner, wiki_id=ref.wiki_id, draft_id=ref.draft_id,
                approval_id=ref.approval_id, document_version=ref.document_version, content_hash=ref.content_hash)
            bodies[ref.id] = draft
            memo[key]=(set(children),{**ancestors,key:wiki_refs[key]},draft)
        if len(leaves) > 1000 or len(wiki_refs) > 1000:
            error("wiki_dependency_limit")
    return leaves, wiki_refs, bodies


def _carried_relation_target(db, owner, value, draft, relation, previous, cache):
    from app.services import wiki_operations
    target = relation.to_ref
    approved = previous.approvals[-1] if previous and previous.approvals else None
    parent = next((d for d in previous.drafts if approved and d.id == approved.draft_id), None) if previous else None
    if (parent is None or draft.base_approved_revision_id != approved.id
            or not any(r.model_dump() == relation.model_dump() for r in getattr(parent, "relations", []))):
        error("wiki_relation_target")
    key = ("operation", target.operation_id)
    if key not in cache:
        cache[key] = wiki_operations.get_operation(db, owner, target.operation_id)
    original = cache[key]
    if original["state"] != "committed" or original["manifest"]["owner_id"] != owner:
        error("wiki_relation_target")
    manifest = original["manifest"]
    retained = {}
    for wiki in (value.wiki_id, target.wiki_id):
        page = next((p for p in original["receipt"]["pages"] if p["wiki_id"] == wiki), None)
        change = next((c for c in manifest["changes"] if c["wiki_id"] == wiki), None)
        if page is None or change is None:
            error("wiki_relation_target")
        revision = db.get(NoteRevision, page["result_revision_id"])
        if (revision is None or revision.owner_id != owner or revision.local_id != "wiki:"+wiki
                or revision.representation_kind != "snapshot_v1" or revision.representation_epoch != 0):
            error("wiki_relation_target")
        try:
            document = parse(json.loads(revision.snapshot_json)["note"]["content"], owner, wiki)
        except (ValueError, KeyError, TypeError):
            error("wiki_relation_target")
        ident = target.draft_id if wiki == target.wiki_id else document.drafts[-1].id
        binding = next((b for b in manifest["draft_bindings"] if b["wiki_id"] == wiki and b["draft_id"] == ident), None)
        chosen = next((d for d in document.drafts if d.id == ident), None)
        if (digest(document.model_dump()) != change["result_document_hash"] or chosen is None
                or binding is None or chosen.draft_hash != binding["draft_hash"] or document.scope != value.scope):
            error("wiki_relation_target")
        retained[wiki] = chosen
    source = retained[value.wiki_id]
    if (not any(a.draft_id == source.id and a.draft_hash == source.draft_hash for a in previous.approvals)
            or not any(r.model_dump() == relation.model_dump() for r in getattr(source, "relations", []))):
        error("wiki_relation_target")
    index = db.get(LibraryResource, (owner, "wikis", target.wiki_id))
    if index is None or index.deleted_at:
        error("wiki_relation_target")
    head = plain(db, owner, "wiki:"+target.wiki_id)
    current = db.get(NoteRevision, head.head_revision_id)
    if current is None:
        error("wiki_relation_target")
    try:
        document = parse(json.loads(current.snapshot_json)["note"]["content"], owner, target.wiki_id)
    except (ValueError, KeyError, TypeError):
        error("wiki_relation_target")
    chosen = next((d for d in document.drafts if d.id == target.draft_id), None)
    if chosen is None or chosen.draft_hash != retained[target.wiki_id].draft_hash or chosen.id != retained[target.wiki_id].id:
        error("wiki_relation_target")
    return chosen


def validate_document(db, owner, value, operation, documents, previous=None, *, visited=None, memo=None):
    leaves, wiki_refs = set(), {}
    visited=set() if visited is None else visited
    memo={} if memo is None else memo
    bindings = {(b.wiki_id, b.draft_id): b.draft_hash for b in operation.draft_bindings}
    old_ids={d.id for d in previous.drafts} if previous else set()
    relation_records = {}
    for draft in value.drafts:
        refs = evidence(draft)
        found, inherited, bodies = validate_evidence(db, owner, refs,visited=visited,memo=memo,policy=operation.schema_version)
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
                if target.operation_id != operation.operation_id:
                    chosen = _carried_relation_target(db, owner, value, draft, relation, previous, relation_records)
                else:
                    other = documents.get(target.wiki_id)
                    chosen = next((d for d in other.drafts if d.id == target.draft_id), None) if other else None
                    if chosen is None or bindings.get((target.wiki_id, target.draft_id)) != chosen.draft_hash:
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


def expected_inputs(db,body,change,verified):
    if body.schema_version==1 or change.action!="append_draft":return list(body.inputs)
    revision=db.get(NoteRevision,change.base_head_revision_id)
    if revision is None or revision.owner_id!=body.owner_id or revision.local_id!="wiki:"+change.wiki_id:
        error("wiki_source_unavailable")
    own=[ref for ref in body.inputs if ref.kind=="wiki" and ref.wiki_id==change.wiki_id]
    if revision.representation_kind=="snapshot_v1" and revision.representation_epoch==0:
        before=parse(json.loads(revision.snapshot_json)["note"]["content"],body.owner_id,change.wiki_id)
        if before.document_version!=change.base_document_version:error("wiki_target_changed")
        approved=before.approvals[-1] if before.approvals else None
        if approved is None:
            if own:error("wiki_input_manifest_missing")
            return list(body.inputs)
        chosen=next(d for d in before.drafts if d.id==approved.draft_id)
        if (len(own)!=1 or own[0].approval_id!=approved.id or own[0].draft_id!=chosen.id
                or own[0].content_hash!=chosen.draft_hash):error("wiki_input_manifest_missing")
    elif revision.representation_kind=="history_envelope_v1" and revision.representation_epoch>0:
        # Archive content semantics are key-holder checks; live batches reject this lineage.
        if not own:return list(body.inputs)
    else:error("wiki_source_unavailable")
    if (len(own)!=1 or own[0].document_version!=change.base_document_version
            or verified.get(own[0].id)!=change.base_head_revision_id):error("wiki_input_manifest_missing")
    return [ref for ref in body.inputs if ref.id!=own[0].id]


def _unverified_legacy_outputs(db,owner):
    from app.schemas.wiki_operations import OperationRecord
    unknown=set();count=0
    for row in db.scalars(select(LibraryResource).where(LibraryResource.owner_id==owner,LibraryResource.kind=="wiki-operations")):
        count+=1
        if count>2000:error("wiki_dependency_limit")
        try:record=OperationRecord.model_validate_json(row.payload_json)
        except ValueError:error("inconsistent_wiki_operation")
        if (record.manifest.owner_id!=owner or record.manifest.operation_id!=row.id or row.schema_version!=1
                or row.deleted_at is not None or row.version!=(1 if record.state=="prepared" else 2)):
            error("inconsistent_wiki_operation")
        if record.manifest.schema_version!=1 or record.state!="committed":continue
        outputs=[c for c in record.manifest.changes if c.action in ("create_draft","append_draft")]
        if len(outputs)<2:continue
        for change in outputs:
            if change.action!="append_draft":continue
            revision=db.get(NoteRevision,change.base_head_revision_id)
            if revision is None or revision.owner_id!=owner or revision.local_id!="wiki:"+change.wiki_id:
                unknown.update(c.wiki_id for c in outputs);break
            if revision.representation_kind!="snapshot_v1" or revision.representation_epoch!=0:
                unknown.update(c.wiki_id for c in outputs);break
            try:before=parse(json.loads(revision.snapshot_json)["note"]["content"],owner,change.wiki_id)
            except (ValueError,TypeError,KeyError):error("wiki_dependency_unverified")
            if before.document_version!=change.base_document_version or before.approvals:
                unknown.update(c.wiki_id for c in outputs);break
    return unknown


def validate_protection_graph(db,owner,proposed):
    colors={};unknown=None
    def visit(wiki,depth):
        nonlocal unknown
        if depth>32:error("wiki_dependency_limit")
        if colors.get(wiki)==1:error("wiki_protection_cycle")
        if colors.get(wiki)==2:return
        if len(colors)>=2000:error("wiki_dependency_limit")
        colors[wiki]=1
        row=db.get(LibraryResource,(owner,"wikis",wiki))
        if row is None and wiki not in proposed:error("wiki_source_unavailable")
        targets=set(proposed.get(wiki,()))
        if row is not None:
            if unknown is None:unknown=_unverified_legacy_outputs(db,owner)
            if wiki in unknown:error("wiki_dependency_unverified")
            plain(db,owner,"wiki:"+wiki)
            value=guard.link(row)
            targets.update(ref.wiki_id for ref in getattr(value,"wiki_dependencies",[]))
        for target in sorted(targets):visit(target,depth+1)
        colors[wiki]=2
    for root in sorted(proposed):visit(root,0)


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
