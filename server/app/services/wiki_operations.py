"""Wiki transactions shared by dedicated API routes and backup validators."""
import json
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import select
from app.models.library import LibraryResource, LibraryMutation
from app.models.note import UserAccount, UserDevice
from app.models.note_v2 import NoteMutation
from app.models.note_crypto import NoteCryptoTransition
from app.models.note_related import RelatedDrain
from app.models.protected_analysis import ProtectedAnalysisClaim
from app.schemas.wiki import canonical, digest
from app.schemas.wiki_operations import parse_prepare, CommitOperation, AbortOperation, ReservedMutation, OperationRecord
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
    receipt = phase_receipt(body, "prepared")
    if any(len(ids)>1 for ids in inventory_ids.values()):error("wiki_operation_limit")
    # Wiki publication is single-physical-note only. Its inventory contains exactly the new head.
    pages = [page_receipt(body,c,"f"*36,2**63-1,["f"*36]) for c in body.changes]
    def size(value):return len(canonical(value).encode("utf-8"))
    resource_sizes=[]
    for state in ("prepared","committed","aborted"):
        payload=dict(state=state,manifest=body.model_dump(),reserved_bytes=RESERVED_BYTES,
                     verified_inputs={ref.id:"f"*36 for ref in body.inputs})
        resource_sizes.append(size(dict(owner_id=body.owner_id,kind=KIND,id=body.operation_id,schema_version=1,
            version=1 if state=="prepared" else 2,payload_json=canonical(payload),
            created_at="9999-12-31T23:59:59.999999",updated_at="9999-12-31T23:59:59.999999",deleted_at=None)))
    row_sizes=[max(resource_sizes)]
    for ident, phase, wiki in phases(body):
        if phase=="prepare":variants=[receipt]
        else:
            variants=[_reserved(body,phase,wiki)]
            if phase=="commit":variants.append(phase_receipt(body,"committed",pages))
            elif phase=="abort":variants.append(phase_receipt(body,"aborted"))
            else:variants.append(next(page for page in pages if page["wiki_id"]==wiki))
        row_sizes.append(max(size(dict(owner_id=body.owner_id,mutation_id=ident,
            request_hash=fingerprint(body,phase,wiki),response_json=canonical(result))) for result in variants))
    for change,page in zip(body.changes,pages):
        row_sizes.append(size(note_receipt_row(body,change,page)))
    # Match _measure's canonical row-array framing as well as every stored row.
    if 2+max(0,len(row_sizes)-1)+sum(row_sizes)>RESERVED_BYTES:
        error("wiki_operation_limit")
    return receipt


def _reserve_operation(db, body, *, inventory_ids=None, validate=None):
    """Non-committing kernel; only prepare_operation supplies live validation."""
    body = parse_prepare(body)
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
            if result!=phase_receipt(body,"prepared") or row.deleted_at is not None or row.version!=(1 if stored.state=="prepared" else 2):
                error("inconsistent_wiki_operation")
            return result
        if validate is not None and body.schema_version == 1:
            error("wiki_operation_upgrade_required")
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
        verified_inputs=validate() if validate is not None else {}
        result = _budget(body, inventory_ids)
        stamp = datetime.utcnow()
        db.add(LibraryResource(owner_id=body.owner_id, kind=KIND, id=body.operation_id, schema_version=1,
            version=1, created_at=stamp, updated_at=stamp, payload_json=canonical(dict(
                state="prepared", manifest=body.model_dump(), reserved_bytes=RESERVED_BYTES,verified_inputs=verified_inputs))))
        for ident, phase, wiki in phases(body):
            value = result if phase == "prepare" else ReservedMutation(status="reserved", operation_id=body.operation_id,
                phase=phase, wiki_id=wiki, manifest_hash=body.manifest_hash).model_dump(exclude_none=True)
            db.add(LibraryMutation(owner_id=body.owner_id, mutation_id=ident,
                request_hash=fingerprint(body, phase, wiki), response_json=canonical(value)))
        db.flush()
        return result
    except Exception:
        db.rollback()
        raise


def reserve_operation(db, body, *, inventory_ids=None):
    """Private b1 test kernel; deliberately not routed or capability-advertised."""
    try:
        result=_reserve_operation(db,body,inventory_ids=inventory_ids);db.commit();return result
    except Exception:
        db.rollback();raise


def phase_receipt(body, state, pages=None):
    return dict(status="ok",wiki_operation=True,operation_id=body.operation_id,
                manifest_hash=body.manifest_hash,state=state,pages=pages or [])


def page_receipt(body, change, revision, generation, inventory):
    return dict(status="ok",wiki_operation=True,operation_id=body.operation_id,manifest_hash=body.manifest_hash,
        wiki_id=change.wiki_id,mutation_id=change.note_mutation_id,result_revision_id=revision,
        result_head_version=change.base_head_version+1,result_inventory_revision_ids=sorted(inventory),
        crypto_epoch=0,history_generation=generation,document_version=change.base_document_version+1,
        index_version=change.base_index_version+1,document_schema_floor=2,result_document_hash=change.result_document_hash)


def note_receipt_row(body, change, page):
    return dict(owner_id=body.owner_id,mutation_id=change.note_mutation_id,local_id="wiki:"+change.wiki_id,
        operation="wiki_operation",actor_device_id=body.device_id,crypto_epoch=0,
        conditions_json=canonical(dict(operation_id=body.operation_id,manifest_hash=body.manifest_hash,
            result_document_hash=change.result_document_hash)),result_json=canonical(page))


def _authenticate(db, owner, device):
    lock_note_writes(db,[owner])
    require_active_user_device(db,owner_id=owner,device_id=device)
    account=db.scalar(select(UserAccount).where(UserAccount.owner_id==owner).with_for_update())
    if account is None or not account.is_active:error("owner_unavailable",403)


def _load(db, owner, operation_id):
    row=db.get(LibraryResource,(owner,KIND,operation_id),populate_existing=True)
    if row is None:error("wiki_operation_not_found",404)
    record=OperationRecord.model_validate_json(row.payload_json)
    if row.schema_version!=1 or row.version!=(1 if record.state=="prepared" else 2) or row.deleted_at is not None or record.manifest.operation_id!=operation_id or record.manifest.owner_id!=owner:
        error("inconsistent_wiki_operation")
    return row,record


def _validate_live(db, body, *, visited=None, memo=None, verified_inputs=None):
    from app.services import wiki_v2, note_v2 as notes
    from app.models.note_history import NoteHead
    from app.services.note_crypto_fence import require_unfenced
    visited=set() if visited is None else visited
    memo={} if memo is None else memo
    if verified_inputs is not None and set(verified_inputs)!={ref.id for ref in body.inputs}:error("inconsistent_wiki_operation")
    pins={}
    wiki_v2.validate_evidence(db,body.owner_id,body.inputs,current=True,visited=visited,memo=memo,
                             policy=body.schema_version,pinned=verified_inputs,pins=pins)
    for change in body.changes:
        local="wiki:"+change.wiki_id
        require_unfenced(db,[(body.owner_id,local)])
        head,rows=notes.scope(db,body.owner_id,local)
        index=db.get(LibraryResource,(body.owner_id,"wikis",change.wiki_id))
        if change.action=="create_draft":
            if head is not None or rows or index is not None:error("wiki_target_changed")
        else:
            wiki_v2.plain(db,body.owner_id,local)
            from app.services.wikis import document
            _,_,doc=document(db,body.owner_id,local)
            if (index is None or index.deleted_at is not None or doc is None or len(rows)!=1
                or (head.head_revision_id,head.version,index.version,doc.document_version)!=(
                    change.base_head_revision_id,change.base_head_version,change.base_index_version,change.base_document_version)):
                error("wiki_target_changed")
            from app.services.wiki_guards import link
            from app.schemas.wiki import WikiArtifactV2
            link(index)
            if isinstance(doc,WikiArtifactV2) and index.schema_version!=2:error("inconsistent_wiki_index")
            wiki_v2.validate_retained_inputs(db,body.owner_id,doc,index,visited=visited,memo=memo)
            if head.history_generation>=2**63-1 or head.version>=2**63-1 or index.version>=2**63-1:
                error("wiki_operation_limit")
            from app.services.note_history import inventories
            inventory=inventories(db,body.owner_id,local)
            if len(inventory)!=1 or inventory[0].note_id!=rows[0].id or inventory[0].revision_id!=head.head_revision_id:
                error("inconsistent_wiki_artifact")
    additions=sum(c.action=="create_draft" for c in body.changes)
    existing=len(list(db.scalars(select(LibraryResource).where(LibraryResource.owner_id==body.owner_id,
        LibraryResource.kind=="wikis",LibraryResource.deleted_at.is_(None)))))
    if existing+additions>100:error("resource_limit")
    if body.schema_version==2:
        graph={}
        for change in body.changes:
            if change.action not in ("create_draft","append_draft"):continue
            expected=wiki_v2.expected_inputs(db,body,change,pins)
            _,refs,_=wiki_v2.validate_evidence(db,body.owner_id,expected,visited=visited,memo=memo,policy=2)
            graph[change.wiki_id]={ref["wiki_id"] for ref in refs.values()}
        for ref in body.inputs:
            if ref.kind=="wiki":graph.setdefault(ref.wiki_id,set())
        wiki_v2.validate_protection_graph(db,body.owner_id,graph)
    return pins


def prepare_operation(db,body):
    try:
        body=parse_prepare(body)
        result=_reserve_operation(db,body,validate=lambda:_validate_live(db,body))
        db.commit();return result
    except Exception:
        db.rollback();raise


def _check_phase(db, original, body, phase):
    ident=original.commit_mutation_id if phase=="commit" else original.abort_mutation_id
    if body.mutation_id!=ident or body.manifest_hash!=original.manifest_hash or body.device_id!=original.device_id:
        error("idempotency_mismatch")
    row=db.get(LibraryMutation,(original.owner_id,ident))
    if row is None or row.request_hash!=fingerprint(original,phase,None):error("inconsistent_wiki_operation")
    return row


def _reserved(original,phase,wiki=None):
    return ReservedMutation(status="reserved",operation_id=original.operation_id,phase=phase,
        wiki_id=wiki,manifest_hash=original.manifest_hash).model_dump(exclude_none=True)


def _success(db,original,state):
    pages=[]
    if state=="committed":
        for change in original.changes:
            row=db.get(LibraryMutation,(original.owner_id,change.note_mutation_id))
            note=db.get(NoteMutation,(original.owner_id,change.note_mutation_id))
            if row is None or note is None or row.request_hash!=fingerprint(original,"page",change.wiki_id):error("inconsistent_wiki_operation")
            page=json.loads(row.response_json)
            try:_validate_page(db,original,change,page,note)
            except (ValueError,KeyError,TypeError):error("inconsistent_wiki_operation")
            pages.append(page)
    return phase_receipt(original,state,pages)


def _validate_page(db,body,change,value,note):
    from app.models.note_history import NoteRevision
    from app.schemas.wiki import uuid_text
    revision_id=value["result_revision_id"]
    uuid_text(revision_id)
    generation=value["history_generation"]
    if type(generation) is not int or not 0<=generation<2**63 or value["result_inventory_revision_ids"]!=[revision_id]:
        raise ValueError("backup_wiki_operation_page")
    expected=page_receipt(body,change,revision_id,generation,[revision_id])
    if value!=expected or any(type(value[k]) is not int for k in ("result_head_version","crypto_epoch","document_schema_floor","index_version","document_version")):
        raise ValueError("backup_wiki_operation_page")
    expected_note=note_receipt_row(body,change,value)
    if note is None or any(getattr(note,key)!=item for key,item in expected_note.items()):
        raise ValueError("backup_wiki_operation_page")
    revision=db.get(NoteRevision,revision_id)
    index=db.get(LibraryResource,(body.owner_id,"wikis",change.wiki_id))
    if revision is None or revision.owner_id!=body.owner_id or revision.local_id!="wiki:"+change.wiki_id or index is None or index.schema_version!=2:
        raise ValueError("backup_wiki_operation_page")
    return revision


def _measure(db, original):
    resource=db.get(LibraryResource,(original.owner_id,KIND,original.operation_id))
    values=[{col.name:(getattr(resource,col.name).isoformat() if isinstance(getattr(resource,col.name),datetime) else getattr(resource,col.name))
             for col in LibraryResource.__table__.columns}]
    for ident,_,_ in phases(original):
        row=db.get(LibraryMutation,(original.owner_id,ident))
        values.append(dict(owner_id=row.owner_id,mutation_id=row.mutation_id,request_hash=row.request_hash,response_json=row.response_json))
    for change in original.changes:
        row=db.get(NoteMutation,(original.owner_id,change.note_mutation_id))
        if row:values.append({col.name:getattr(row,col.name) for col in NoteMutation.__table__.columns})
    if len(canonical(values).encode("utf-8"))>RESERVED_BYTES:error("wiki_operation_limit")


def _terminal(db,row,record,state,receipt_row,result):
    row.payload_json=canonical({**record.model_dump(),"state":state})
    row.version+=1;row.updated_at=datetime.utcnow();receipt_row.response_json=canonical(result)
    db.flush();_measure(db,record.manifest)


def commit_operation(db,operation_id,body):
    from app.services import wiki_v2, wikis, note_v2 as notes, wiki_guards as guard
    from app.services.wiki_artifact import validate_append
    from app.schemas.note_v2 import PutNote
    from app.schemas.wiki import WikiDraftV2,WikiApprovalV2
    from app.services.note_history import inventories
    try:
        body=CommitOperation.model_validate(body.model_dump());_authenticate(db,body.owner_id,body.device_id)
        row,record=_load(db,body.owner_id,operation_id);original=record.manifest
        receipt_row=_check_phase(db,original,body,"commit")
        docs={item.wiki_id:item.document for item in body.documents}
        if set(docs)!={c.wiki_id for c in original.changes} or any(digest(docs[c.wiki_id].model_dump())!=c.result_document_hash for c in original.changes):
            error("idempotency_mismatch")
        for binding in original.draft_bindings:
            chosen=next((d for d in docs[binding.wiki_id].drafts if d.id==binding.draft_id),None)
            if chosen is None or chosen.draft_hash!=binding.draft_hash:error("idempotency_mismatch")
        if record.state=="committed":
            result=json.loads(receipt_row.response_json)
            if result!=_success(db,original,"committed"):error("inconsistent_wiki_operation")
            db.commit();return result
        if record.state=="aborted":error("operation_aborted")
        if original.schema_version==1:error("wiki_operation_upgrade_required")
        if json.loads(receipt_row.response_json)!=_reserved(original,"commit"):error("inconsistent_wiki_operation")
        visited,memo=set(),{}
        pins=_validate_live(db,original,visited=visited,memo=memo,verified_inputs=record.verified_inputs)
        if pins!=record.verified_inputs:error("wiki_source_changed")
        pages=[]
        for change in original.changes:
            doc=docs[change.wiki_id];local="wiki:"+change.wiki_id
            head,rows=notes.scope(db,body.owner_id,local)
            before=wikis.document(db,body.owner_id,local)[2] if head else None
            action={"create_draft":"create","append_draft":"draft","approve_draft":"approve","reject_draft":"reject"}[change.action]
            if action in ("create","draft") and doc.drafts and not isinstance(doc.drafts[-1],WikiDraftV2):
                error("wiki_v2_draft_required")
            if action=="approve" and doc.approvals and not isinstance(doc.approvals[-1],WikiApprovalV2):
                error("wiki_v2_approval_required")
            try:validate_append(before,doc,action)
            except ValueError:error("wiki_document_conflict")
            if action in ("create","draft"):
                newest=doc.drafts[-1]
                if not any(b.wiki_id==change.wiki_id and b.draft_id==newest.id and b.draft_hash==newest.draft_hash
                           for b in original.draft_bindings):
                    error("wiki_draft_binding_required")
            leaves,refs=wiki_v2.validate_document(db,body.owner_id,doc,original,docs,before,visited=visited,memo=memo)
            from app.models.note_v2 import NoteOfflineBranch
            for branch in db.scalars(select(NoteOfflineBranch).where(NoteOfflineBranch.owner_id==body.owner_id,NoteOfflineBranch.local_id==local)):
                raw=json.loads(branch.snapshot_json)["note"]
                retained=wiki_v2.parse(raw["content"],body.owner_id,change.wiki_id)
                branch_leaves,branch_refs=wiki_v2.validate_document(db,body.owner_id,retained,original,docs,retained,visited=visited,memo=memo)
                leaves.update(branch_leaves);refs.update(branch_refs)
            if action in ("create","draft"):
                newest=doc.drafts[-1]
                expected=wiki_v2.expected_inputs(db,original,change,record.verified_inputs)
                if not isinstance(newest,WikiDraftV2) or sorted(canonical(ref.model_dump()) for ref in expected)!=sorted(canonical(ref.model_dump()) for ref in wiki_v2.evidence(newest)):
                    error("wiki_input_manifest_missing")
            if action=="approve":
                chosen=next(d for d in doc.drafts if d.id==doc.approvals[-1].draft_id)
                wiki_v2.validate_evidence(db,body.owner_id,wiki_v2.evidence(chosen),current=True,visited=visited,memo=memo,policy=original.schema_version)
            payload=wiki_v2.index_payload(db,body.owner_id,change.wiki_id,leaves,refs,visited=visited,memo=memo)
            index=db.get(LibraryResource,(body.owner_id,"wikis",change.wiki_id))
            if index is None:
                index=LibraryResource(owner_id=body.owner_id,kind="wikis",id=change.wiki_id,schema_version=2,
                    version=0,created_at=datetime.utcnow());db.add(index)
            index.schema_version=2;index.version+=1;index.updated_at=datetime.utcnow();index.payload_json=canonical(payload)
            put=PutNote(schema_version=1,owner_id=body.owner_id,local_id=local,device_id=body.device_id,
                mutation_id=change.note_mutation_id,crypto_epoch=0,base_head_version=change.base_head_version,
                base_revision_id=change.base_head_revision_id,expected_inventory_revision_ids=sorted(r.revision_id for r in inventories(db,body.owner_id,local)),
                note=dict(note_type="tree",title="AI Wiki "+change.wiki_id,content=canonical(doc.model_dump()),
                    parent_local_id=None,level=1,tags=rows[0].tags if rows else None,source="wiki-artifact",deleted_at=None))
            page_row=db.get(LibraryMutation,(body.owner_id,change.note_mutation_id))
            if page_row is None or page_row.request_hash!=fingerprint(original,"page",change.wiki_id):error("inconsistent_wiki_operation")
            if json.loads(page_row.response_json)!=_reserved(original,"page",change.wiki_id):error("inconsistent_wiki_operation")
            with guard.internal_write(db,body.owner_id,local):head=notes.adopt(db,put,put.note,head,rows,"write")
            page=page_receipt(original,change,head.head_revision_id,head.history_generation,[r.revision_id for r in inventories(db,body.owner_id,local)])
            db.add(NoteMutation(**note_receipt_row(original,change,page)))
            page_row.response_json=canonical(page);pages.append(page)
        result=phase_receipt(original,"committed",pages)
        _terminal(db,row,record,"committed",receipt_row,result);db.commit();return result
    except Exception:
        db.rollback();raise


def abort_operation(db,operation_id,body):
    try:
        body=AbortOperation.model_validate(body.model_dump());_authenticate(db,body.owner_id,body.device_id)
        row,record=_load(db,body.owner_id,operation_id);receipt=_check_phase(db,record.manifest,body,"abort")
        if record.state=="committed":error("operation_already_committed")
        if record.state=="aborted":
            result=json.loads(receipt.response_json)
            if result!=phase_receipt(record.manifest,"aborted"):error("inconsistent_wiki_operation")
        else:
            if json.loads(receipt.response_json)!=_reserved(record.manifest,"abort"):error("inconsistent_wiki_operation")
            result=phase_receipt(record.manifest,"aborted");_terminal(db,row,record,"aborted",receipt,result)
        db.commit();return result
    except Exception:
        db.rollback();raise


def get_operation(db,owner,operation_id):
    row,record=_load(db,owner,operation_id)
    ident={"prepared":record.manifest.mutation_id,"committed":record.manifest.commit_mutation_id,"aborted":record.manifest.abort_mutation_id}[record.state]
    receipt=db.get(LibraryMutation,(owner,ident))
    phase={"prepared":"prepare","committed":"commit","aborted":"abort"}[record.state]
    if receipt is None or receipt.request_hash!=fingerprint(record.manifest,phase,None) or json.loads(receipt.response_json)!=_success(db,record.manifest,record.state):error("inconsistent_wiki_operation")
    return dict(status="ok",operation_id=operation_id,state=record.state,manifest_hash=record.manifest.manifest_hash,
                manifest=record.manifest.model_dump(),
                receipt=json.loads(receipt.response_json))


def generation_provenance(db, owner, document):
    from app.models.note_history import NoteRevision
    from app.services.wikis import parse_document
    from app.schemas.wiki import uuid_text

    wanted = {(d.id, d.draft_hash) for d in document.drafts if getattr(d, "schema_version", None) == 2}
    entries, ambiguous, operations = {}, set(), {}
    rows = db.scalars(select(NoteMutation).where(NoteMutation.owner_id == owner,
        NoteMutation.local_id == "wiki:" + document.wiki_id, NoteMutation.operation == "wiki_operation"))
    for row in rows:
        try:
            conditions = json.loads(row.conditions_json)
            if set(conditions) != {"operation_id", "manifest_hash", "result_document_hash"}:
                continue
            ident = uuid_text(conditions["operation_id"])
            if ident not in operations:
                try:
                    operations[ident] = get_operation(db, owner, ident)
                except (HTTPException, ValueError, KeyError, TypeError):
                    operations[ident] = None
            original = operations[ident]
            if not original or original["state"] != "committed" or original["manifest_hash"] != conditions["manifest_hash"]:
                continue
            manifest = original["manifest"]
            change = next((c for c in manifest["changes"] if c["wiki_id"] == document.wiki_id
                and c["note_mutation_id"] == row.mutation_id and c["action"] in {"create_draft", "append_draft"}), None)
            if not change or change["result_document_hash"] != conditions["result_document_hash"]:
                continue
            page = next(p for p in original["receipt"]["pages"] if p["wiki_id"] == document.wiki_id)
            revision = db.get(NoteRevision, page["result_revision_id"])
            if revision is None or revision.owner_id != owner or revision.local_id != "wiki:" + document.wiki_id \
                    or revision.representation_epoch != 0 or revision.representation_kind != "snapshot_v1":
                continue
            note = json.loads(revision.snapshot_json)["note"]
            if note.get("source") != "wiki-artifact":
                continue
            result = parse_document(note["content"], owner, document.wiki_id)
            if digest(result.model_dump()) != change["result_document_hash"]:
                continue
            draft = result.drafts[-1]
            key = (draft.id, draft.draft_hash)
            if key not in wanted or not any(b["wiki_id"] == document.wiki_id and b["draft_id"] == draft.id
                    and b["draft_hash"] == draft.draft_hash for b in manifest["draft_bindings"]):
                continue
            entry = dict(draft_id=draft.id, draft_hash=draft.draft_hash, operation_id=ident,
                manifest_hash=manifest["manifest_hash"], result_revision_id=page["result_revision_id"],
                result_document_hash=change["result_document_hash"])
            if key in entries and entries[key] != entry:
                ambiguous.add(key)
            entries[key] = entry
        except (HTTPException, ValueError, KeyError, TypeError, StopIteration):
            continue
    return dict(schema_version=1, entries=[entries[key] for key in sorted(entries) if key not in ambiguous])


def validate_operation_rows(db):
    from app.models.note_history import NoteRevision
    for row in db.scalars(select(LibraryResource).where(LibraryResource.kind==KIND)):
        _,record=_load(db,row.owner_id,row.id);body=record.manifest
        if set(record.verified_inputs)!={ref.id for ref in body.inputs}:raise ValueError("backup_wiki_operation_input")
        for ref in body.inputs:
            revision=db.get(NoteRevision,record.verified_inputs[ref.id])
            local=ref.note_ref.local_id if ref.kind=="note" else "wiki:"+ref.wiki_id
            if revision is None or revision.owner_id!=row.owner_id or revision.local_id!=local:raise ValueError("backup_wiki_operation_input")
            if revision.representation_kind=="snapshot_v1" and revision.representation_epoch==0:
                raw=json.loads(revision.snapshot_json)["note"]["content"]
                if ref.kind=="note":
                    import hashlib
                    if hashlib.sha256(raw.encode()).hexdigest()!=ref.content_hash:raise ValueError("backup_wiki_operation_input")
                else:
                    from app.services.wiki_v2 import parse
                    doc=parse(raw,row.owner_id,ref.wiki_id)
                    if doc.document_version!=ref.document_version or not any(d.id==ref.draft_id and d.draft_hash==ref.content_hash for d in doc.drafts) or not any(a.id==ref.approval_id and a.draft_id==ref.draft_id for a in doc.approvals):
                        raise ValueError("backup_wiki_operation_input")
            elif revision.representation_epoch<=0 or revision.representation_kind!="history_envelope_v1":raise ValueError("backup_wiki_operation_input")
        for change in body.changes:
            if change.base_head_revision_id is not None:
                previous=db.get(NoteRevision,change.base_head_revision_id)
                if previous is None or previous.owner_id!=row.owner_id or previous.local_id!="wiki:"+change.wiki_id:
                    raise ValueError("backup_wiki_operation_base")
            if body.schema_version==2 and change.action in ("create_draft","append_draft"):
                from app.services.wiki_v2 import expected_inputs
                try:expected_inputs(db,body,change,record.verified_inputs)
                except (HTTPException,ValueError,TypeError,KeyError) as exc:raise ValueError("backup_wiki_operation_comparison") from exc
        all_receipts={ident:db.get(LibraryMutation,(row.owner_id,ident)) for ident,_,_ in phases(body)}
        if any(value is None for value in all_receipts.values()):raise ValueError("backup_wiki_operation_receipt")
        for ident,phase,wiki in phases(body):
            receipt=db.get(LibraryMutation,(row.owner_id,ident))
            if receipt is None or receipt.request_hash!=fingerprint(body,phase,wiki):raise ValueError("backup_wiki_operation_receipt")
            value=json.loads(receipt.response_json)
            note=db.get(NoteMutation,(row.owner_id,ident))
            if note is not None and not (record.state=="committed" and phase=="page"):
                raise ValueError("backup_wiki_operation_state")
            for model in (NoteCryptoTransition,RelatedDrain,ProtectedAnalysisClaim):
                if db.scalar(select(model).where(model.owner_id==row.owner_id,model.mutation_id==ident).limit(1)) is not None:
                    raise ValueError("backup_wiki_operation_namespace")
            success=phase=="prepare" or (record.state=="committed" and phase in ("commit","page")) or (record.state=="aborted" and phase=="abort")
            if not success:
                expected=ReservedMutation(status="reserved",operation_id=body.operation_id,phase=phase,wiki_id=wiki,manifest_hash=body.manifest_hash).model_dump(exclude_none=True)
                if value!=expected:raise ValueError("backup_wiki_operation_state")
            elif phase=="page":
                change=next(c for c in body.changes if c.wiki_id==wiki)
                revision=_validate_page(db,body,change,value,note)
                if revision.representation_kind=="snapshot_v1" and revision.representation_epoch==0:
                    content=json.loads(revision.snapshot_json)["note"]["content"]
                    if digest(json.loads(content))!=change.result_document_hash:raise ValueError("backup_wiki_operation_document")
                    if body.schema_version==2 and change.action in ("create_draft","append_draft"):
                        from app.services.wiki_v2 import parse,expected_inputs,evidence
                        document=parse(content,row.owner_id,change.wiki_id)
                        expected=expected_inputs(db,body,change,record.verified_inputs)
                        if sorted(canonical(ref.model_dump()) for ref in evidence(document.drafts[-1]))!=sorted(canonical(ref.model_dump()) for ref in expected):
                            raise ValueError("backup_wiki_operation_comparison")
                else:
                    index=db.get(LibraryResource,(row.owner_id,"wikis",wiki))
                    if revision.representation_kind!="history_envelope_v1" or revision.representation_epoch<=0 or index is None or index.schema_version!=2:
                        raise ValueError("backup_wiki_operation_document")
            elif value!=phase_receipt(body,"prepared" if phase=="prepare" else record.state,
                    [json.loads(db.get(LibraryMutation,(row.owner_id,c.note_mutation_id)).response_json) for c in body.changes] if phase=="commit" else []):
                raise ValueError("backup_wiki_operation_state")
        _measure(db,body)
