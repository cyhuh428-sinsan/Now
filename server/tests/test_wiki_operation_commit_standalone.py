"""Wiki b2의 실제 서비스/메모리 SQLite transaction 검사."""
import copy
import hashlib
import unittest
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from sqlalchemy import select, text
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, OperationalError
from fastapi import HTTPException
import test_wiki_operations_standalone as foundation
from test_wiki_operations_standalone import request as legacy_request, uid
from test_wiki_v2_standalone import draft, artifact, seal, approval
from app.models.note import Note
from app.models.note_history import NoteHead
from app.models.library import LibraryResource, LibraryMutation
from app.models.note_v2 import NoteMutation
from app.schemas.wiki import digest
from app.schemas.wiki_operations import PrepareOperationV2 as PrepareOperation, CommitOperation, AbortOperation
from app.schemas.note_v2 import PutNote
from app.services import note_v2, wiki_operations as O


def request(*args,**kwargs):
    """신규 쓰기 fixture만 명시 정책2로 생성하며 legacy request bytes는 유지한다."""
    value=legacy_request(*args,**kwargs);value["schema_version"]=2
    value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
    return value


class CommitTest(unittest.TestCase):
    def setUp(self):
        from app.services import note_backup
        self.engine_url="sqlite:///file:wiki-commit-"+uuid4().hex+"?mode=memory&cache=shared&uri=true"
        foundation.OperationTest.setUp(self)
        from app.services.note_crypto import initialize_identity
        from app.services.note_mixed_metadata import initialize
        from app.services.related_text import initialize as initialize_linked
        with self.engine.begin() as connection:
            initialize_identity(connection);initialize_linked(connection);initialize(connection)
    tearDown = foundation.OperationTest.tearDown
    service = foundation.OperationTest.service

    def bundle(self, count=1):
        source=PutNote(schema_version=1,owner_id="alice",local_id="source",device_id="synthetic-device",
            mutation_id=uid(800),crypto_epoch=0,base_head_version=0,base_revision_id=None,
            expected_inventory_revision_ids=[],note=dict(note_type="daily",title="Synthetic",content="Exact quote",tags=None,source=None))
        note_v2.mutate(self.db,source,"put")
        head=self.db.get(NoteHead,("alice","source"))
        value=request();value["inputs"][0].update(source_revision_id=head.head_revision_id,head_version=head.version,
            content_hash=hashlib.sha256(b"Exact quote").hexdigest())
        value["changes"]=[];value["draft_bindings"]=[];documents=[]
        for index in range(count):
            wiki=uid(6+10*index);d=draft();d.update(id=uid(7+10*index),generation_id=uid(20+10*index))
            d["evidence_manifest"]=copy.deepcopy(value["inputs"]);seal(d)
            doc=artifact(d);doc["wiki_id"]=wiki
            value["changes"].append(dict(wiki_id=wiki,action="create_draft",note_mutation_id=uid(8+10*index),
                base_head_revision_id=None,base_head_version=0,base_index_version=0,base_document_version=0,
                result_document_hash=digest(doc)))
            value["draft_bindings"].append(dict(wiki_id=wiki,draft_id=d["id"],draft_hash=d["draft_hash"]))
            documents.append(dict(wiki_id=wiki,document=doc))
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
        prepared=PrepareOperation.model_validate(value)
        commit=CommitOperation(schema_version=1,owner_id="alice",device_id=prepared.device_id,
            mutation_id=prepared.commit_mutation_id,manifest_hash=prepared.manifest_hash,documents=documents)
        return prepared,commit

    def test_atomic_commit_and_original_receipt(self):
        prepared,commit=self.bundle(2);O.prepare_operation(self.db,prepared)
        first=O.commit_operation(self.db,prepared.operation_id,commit)
        self.assertEqual(first["state"],"committed")
        self.assertEqual(len(first["pages"]),2)
        self.assertEqual(O.commit_operation(self.db,prepared.operation_id,commit),first)
        for page in first["pages"]:
            row=self.db.get(LibraryResource,("alice","wikis",page["wiki_id"]))
            self.assertEqual(row.schema_version,2)
        wrong=commit.model_copy(update={"mutation_id":uid(999)})
        with self.assertRaises(HTTPException):O.commit_operation(self.db,prepared.operation_id,wrong)

    def assert_unbound_draft_rejected(self,prepared,commit,bindings):
        value=prepared.model_dump();value["draft_bindings"]=bindings
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
        prepared=PrepareOperation.model_validate(value)
        commit=CommitOperation.model_validate({**commit.model_dump(),"manifest_hash":prepared.manifest_hash})
        O.prepare_operation(self.db,prepared)
        with self.assertRaises(HTTPException) as caught:O.commit_operation(self.db,prepared.operation_id,commit)
        self.assertEqual(caught.exception.detail,{"code":"wiki_draft_binding_required"})
        self.assertEqual(O.get_operation(self.db,"alice",prepared.operation_id)["state"],"prepared")
        self.assertIsNone(self.db.get(NoteMutation,("alice",prepared.changes[0].note_mutation_id)))

    def test_create_requires_new_draft_binding(self):
        p,c=self.bundle();self.assert_unbound_draft_rejected(p,c,[])

    def append_bundle(self):
        p,c=self.bundle();O.prepare_operation(self.db,p);O.commit_operation(self.db,p.operation_id,c)
        value=p.model_dump();doc=c.documents[0].document.model_dump()
        newest=copy.deepcopy(doc["drafts"][0]);newest.update(id=uid(7007),generation_id=uid(7020));seal(newest)
        doc["drafts"].append(newest);doc["document_version"]+=1
        head=self.db.get(NoteHead,("alice","wiki:"+doc["wiki_id"]))
        value.update(operation_id=uid(7001),mutation_id=uid(7002),commit_mutation_id=uid(7003),abort_mutation_id=uid(7004))
        value["changes"][0].update(action="append_draft",note_mutation_id=uid(7008),base_head_revision_id=head.head_revision_id,
            base_head_version=head.version,base_index_version=1,base_document_version=1,result_document_hash=digest(doc))
        value["draft_bindings"]=[dict(wiki_id=doc["wiki_id"],draft_id=newest["id"],draft_hash=newest["draft_hash"])]
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
        prepared=PrepareOperation.model_validate(value)
        commit=CommitOperation(schema_version=1,owner_id="alice",device_id=p.device_id,mutation_id=prepared.commit_mutation_id,
            manifest_hash=prepared.manifest_hash,documents=[dict(wiki_id=doc["wiki_id"],document=doc)])
        return prepared,commit

    def test_append_requires_new_draft_binding(self):
        p,c=self.append_bundle();self.assert_unbound_draft_rejected(p,c,[])

    def test_past_draft_binding_cannot_replace_new_append_binding(self):
        p,c=self.append_bundle();old=c.documents[0].document.drafts[0]
        self.assert_unbound_draft_rejected(p,c,[dict(wiki_id=p.changes[0].wiki_id,draft_id=old.id,draft_hash=old.draft_hash)])

    def test_reject_existing_draft_needs_no_new_draft_binding(self):
        p,c=self.bundle();O.prepare_operation(self.db,p);O.commit_operation(self.db,p.operation_id,c)
        prepared,body=self.approve(p,c)
        doc=body.documents[0].document.model_dump();doc["approvals"]=[]
        doc["rejected_draft_ids"]=[doc["drafts"][0]["id"]]
        value=prepared.model_dump();value["changes"][0].update(action="reject_draft",result_document_hash=digest(doc))
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
        prepared=PrepareOperation.model_validate(value)
        body=CommitOperation.model_validate({**body.model_dump(),"manifest_hash":prepared.manifest_hash,
            "documents":[dict(wiki_id=doc["wiki_id"],document=doc)]})
        self.assertEqual(prepared.draft_bindings,[])
        O.prepare_operation(self.db,prepared)
        self.assertEqual(O.commit_operation(self.db,prepared.operation_id,body)["state"],"committed")

    def test_second_page_sql_failure_rolls_back_every_publication(self):
        prepared,commit=self.bundle(2);O.prepare_operation(self.db,prepared)
        target="wiki:"+prepared.changes[1].wiki_id
        self.db.execute(text("CREATE TRIGGER synthetic_abort BEFORE INSERT ON notes WHEN NEW.local_id='"+target+"' BEGIN SELECT RAISE(ABORT,'synthetic'); END"));self.db.commit()
        with self.assertRaises(IntegrityError) as caught:O.commit_operation(self.db,prepared.operation_id,commit)
        self.assertIn("synthetic",str(caught.exception.orig))
        self.assertEqual(self.db.scalars(select(Note).where(Note.local_id.like("wiki:%"))).all(),[])
        self.assertEqual(self.db.scalars(select(LibraryResource).where(LibraryResource.kind=="wikis")).all(),[])
        self.assertEqual(O.get_operation(self.db,"alice",prepared.operation_id)["state"],"prepared")

    def test_abort_terminal_and_state_validation(self):
        prepared,commit=self.bundle();O.prepare_operation(self.db,prepared)
        O.validate_operation_rows(self.db)
        abort=AbortOperation(schema_version=1,owner_id="alice",device_id=prepared.device_id,
            mutation_id=prepared.abort_mutation_id,manifest_hash=prepared.manifest_hash)
        result=O.abort_operation(self.db,prepared.operation_id,abort)
        self.assertEqual(O.abort_operation(self.db,prepared.operation_id,abort),result)
        self.assertEqual(result["state"],"aborted")
        O.validate_operation_rows(self.db)
        with self.assertRaises(HTTPException):O.commit_operation(self.db,prepared.operation_id,commit)

    def test_committed_missing_page_receipt_is_invalid(self):
        prepared,commit=self.bundle();O.prepare_operation(self.db,prepared)
        O.commit_operation(self.db,prepared.operation_id,commit);O.validate_operation_rows(self.db)
        row=self.db.get(NoteMutation,("alice",prepared.changes[0].note_mutation_id));self.db.delete(row);self.db.commit()
        with self.assertRaises(ValueError):O.validate_operation_rows(self.db)

    def test_source_stale_and_success_replay_after_source_change(self):
        prepared,commit=self.bundle();O.prepare_operation(self.db,prepared)
        first=O.commit_operation(self.db,prepared.operation_id,commit)
        current=note_v2.current(self.db,"alice","source")
        update=PutNote(schema_version=1,owner_id="alice",local_id="source",device_id=prepared.device_id,
            mutation_id=uid(888),crypto_epoch=0,base_head_version=current["head_version"],
            base_revision_id=current["head_revision_id"],expected_inventory_revision_ids=current["inventory_revision_ids"],
            note=dict(note_type="daily",title="Synthetic",content="Changed",tags=None,source=None))
        note_v2.mutate(self.db,update,"put")
        self.assertEqual(O.commit_operation(self.db,prepared.operation_id,commit),first)
        stale=copy.deepcopy(prepared.model_dump());stale.update(operation_id=uid(200),mutation_id=uid(201),
            commit_mutation_id=uid(202),abort_mutation_id=uid(203))
        stale["changes"][0].update(wiki_id=uid(204),note_mutation_id=uid(205))
        stale["draft_bindings"][0]["wiki_id"]=uid(204)
        stale["manifest_hash"]=digest({k:v for k,v in stale.items() if k!="manifest_hash"})
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,PrepareOperation.model_validate(stale))
        self.assertEqual(caught.exception.detail,{"code":"wiki_source_changed"})

    def roundtrip(self,state):
        from app.services.note_backup import export_snapshot,restore_empty,validate_backup
        prepared,commit=self.bundle();O.prepare_operation(self.db,prepared)
        if state=="committed":O.commit_operation(self.db,prepared.operation_id,commit)
        if state=="aborted":O.abort_operation(self.db,prepared.operation_id,AbortOperation(schema_version=1,
            owner_id="alice",device_id=prepared.device_id,mutation_id=prepared.abort_mutation_id,manifest_hash=prepared.manifest_hash))
        snapshot=export_snapshot(self.db)
        self.assertEqual(snapshot["recovery"]["requires_reconciliation"],state=="prepared")
        empty=create_engine("sqlite:///:memory:")
        try:
            restore_empty(empty,snapshot)
            with Session(empty) as restored:
                self.assertEqual(O.get_operation(restored,"alice",prepared.operation_id)["state"],state)
        finally:empty.dispose()
        return snapshot

    def test_prepared_new_target_absence_backup_roundtrip(self):self.roundtrip("prepared")
    def test_aborted_backup_roundtrip(self):self.roundtrip("aborted")
    def test_committed_backup_roundtrip(self):self.roundtrip("committed")

    def test_commit_abort_race_has_one_terminal(self):
        prepared,commit=self.bundle();O.prepare_operation(self.db,prepared);barrier=Barrier(2)
        abort=AbortOperation(schema_version=1,owner_id="alice",device_id=prepared.device_id,
            mutation_id=prepared.abort_mutation_id,manifest_hash=prepared.manifest_hash)
        def run(action):
            with Session(self.engine,autoflush=False) as db:
                barrier.wait(timeout=10)
                try:return (O.commit_operation(db,prepared.operation_id,commit) if action=="commit" else O.abort_operation(db,prepared.operation_id,abort))["state"]
                except HTTPException as exc:
                    self.assertEqual(exc.status_code,409);return "conflict"
                except OperationalError as exc:
                    self.assertIn("locked",str(exc.orig));return "sqlite_busy"
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,("commit","abort")))
        terminals=[value for value in results if value in ("committed","aborted")]
        self.assertEqual(len(terminals),1)
        self.assertEqual(O.get_operation(self.db,"alice",prepared.operation_id)["state"],terminals[0])
        O.validate_operation_rows(self.db)

    def approve(self,prepared,commit,offset=1000):
        import json
        old=commit.documents[0].document.model_dump();new=copy.deepcopy(old)
        new["document_version"]+=1;new["approvals"].append(approval(new["drafts"][0],offset+50))
        wiki=old["wiki_id"];head=self.db.get(NoteHead,("alice","wiki:"+wiki))
        index=self.db.get(LibraryResource,("alice","wikis",wiki))
        p=request(offset=offset);p["inputs"]=copy.deepcopy(prepared.inputs[0:1]);p["inputs"]=[ref.model_dump() for ref in p["inputs"]]
        p["changes"]=[dict(wiki_id=wiki,action="approve_draft",note_mutation_id=uid(offset+8),
            base_head_revision_id=head.head_revision_id,base_head_version=head.version,base_index_version=index.version,
            base_document_version=old["document_version"],result_document_hash=digest(new))]
        p["draft_bindings"]=[];p["manifest_hash"]=digest({k:v for k,v in p.items() if k!="manifest_hash"})
        p=PrepareOperation.model_validate(p)
        c=CommitOperation(schema_version=1,owner_id="alice",device_id=p.device_id,mutation_id=p.commit_mutation_id,
            manifest_hash=p.manifest_hash,documents=[dict(wiki_id=wiki,document=new)])
        return p,c

    def test_transitive_wiki_evidence_approval_union_and_backup(self):
        import json
        from app.services.note_backup import export_snapshot
        p,c=self.bundle();O.prepare_operation(self.db,p);O.commit_operation(self.db,p.operation_id,c)
        ap,ac=self.approve(p,c);O.prepare_operation(self.db,ap);O.commit_operation(self.db,ap.operation_id,ac)
        upper=ac.documents[0].document;source=upper.drafts[0];approved=upper.approvals[0]
        value=request(offset=2000);ref=dict(id="n",kind="wiki",origin="server",owner_id="alice",wiki_id=upper.wiki_id,
            draft_id=source.id,approval_id=approved.id,document_version=upper.document_version,content_hash=source.draft_hash)
        value["inputs"]=[ref];d=draft();d.update(id=uid(2007),generation_id=uid(2010));d["evidence_manifest"]=[ref]
        d["citations"][0]["section_id"]="s";seal(d);doc=artifact(d);doc["wiki_id"]=uid(2006)
        value["changes"][0]["result_document_hash"]=digest(doc)
        value["draft_bindings"][0]["draft_hash"]=d["draft_hash"]
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"});value=PrepareOperation.model_validate(value)
        body=CommitOperation(schema_version=1,owner_id="alice",device_id=value.device_id,mutation_id=value.commit_mutation_id,
            manifest_hash=value.manifest_hash,documents=[dict(wiki_id=uid(2006),document=doc)])
        O.prepare_operation(self.db,value);O.commit_operation(self.db,value.operation_id,body)
        row=self.db.get(LibraryResource,("alice","wikis",uid(2006)));payload=json.loads(row.payload_json)
        self.assertEqual(payload["dependencies"],[dict(owner_id="alice",local_id="source")])
        self.assertEqual(payload["wiki_dependencies"][0]["wiki_id"],upper.wiki_id)
        export_snapshot(self.db)

    def test_target_stale_blocks_new_commit(self):
        p,c=self.bundle();O.prepare_operation(self.db,p);O.commit_operation(self.db,p.operation_id,c)
        first,first_commit=self.approve(p,c);O.prepare_operation(self.db,first)
        second,second_commit=self.approve(p,c,offset=3000);O.prepare_operation(self.db,second)
        O.commit_operation(self.db,first.operation_id,first_commit)
        with self.assertRaises(HTTPException) as caught:O.commit_operation(self.db,second.operation_id,second_commit)
        self.assertEqual(caught.exception.detail,{"code":"wiki_target_changed"})

    def test_quote_and_proposal_binding_tamper_rejected(self):
        p,c=self.bundle();value=c.model_dump();doc=value["documents"][0]["document"]
        doc["drafts"][0]["citations"][0]["quote"]="Not in source";seal(doc["drafts"][0])
        request_value=p.model_dump();request_value["changes"][0]["result_document_hash"]=digest(doc)
        request_value["draft_bindings"][0]["draft_hash"]=doc["drafts"][0]["draft_hash"]
        request_value["manifest_hash"]=digest({k:v for k,v in request_value.items() if k!="manifest_hash"})
        p=PrepareOperation.model_validate(request_value);O.prepare_operation(self.db,p)
        value["manifest_hash"]=p.manifest_hash
        with self.assertRaises(HTTPException) as caught:O.commit_operation(self.db,p.operation_id,CommitOperation.model_validate(value))
        self.assertEqual(caught.exception.detail,{"code":"wiki_quote_mismatch"})

    def test_ten_page_exact_receipt_budget(self):
        p,c=self.bundle(10);O.prepare_operation(self.db,p)
        result=O.commit_operation(self.db,p.operation_id,c)
        self.assertEqual(len(result["pages"]),10);O.validate_operation_rows(self.db)
        O._measure(self.db,p)

    def test_protection_lineage_and_fence_fail_closed(self):
        from app.models.note_crypto import NoteCryptoFence,NoteCryptoTransition
        from app.models.note_history import NoteRevision
        from datetime import datetime
        p,c=self.bundle();head=self.db.get(NoteHead,("alice","source"))
        revision=self.db.get(NoteRevision,head.head_revision_id)
        revision.representation_epoch=1;self.db.commit()
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,p)
        self.assertEqual(caught.exception.detail,{"code":"wiki_protected_batch_not_supported"})
        revision=self.db.get(NoteRevision,head.head_revision_id);revision.representation_epoch=0;self.db.commit()
        self.db.add(NoteCryptoTransition(id=uid(900),owner_id="alice",local_id="source",mutation_id=uid(901),
            actor_device_id=p.device_id,conditions_json="{}",manifest_digest="a"*64,state="prepared",lease_version=1,
            expires_at=datetime(2099,1,1),created_at=datetime(2026,11,1),purpose="conversion"))
        self.db.flush();self.db.add(NoteCryptoFence(owner_id="alice",local_id="source",transition_id=uid(900)));self.db.commit()
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,p)
        self.assertEqual(caught.exception.status_code,423)

    def test_floor_survives_trash_restore_and_blocks_old_writes(self):
        from app.services import wikis
        from app.schemas.wiki import WikiLifecycle
        from test_wiki_artifact import artifact as old_artifact
        p,c=self.bundle();O.prepare_operation(self.db,p);O.commit_operation(self.db,p.operation_id,c)
        for restoring,version in ((False,1),(True,2)):
            wikis.lifecycle(self.db,p.changes[0].wiki_id,WikiLifecycle(owner_id="alice",device_id=p.device_id,
                schema_version=1,base_version=version,mutation_id=uid(900+version)),restoring=restoring)
        row=self.db.get(LibraryResource,("alice","wikis",p.changes[0].wiki_id));self.assertEqual(row.schema_version,2)
        old=old_artifact();old["wiki_id"]=p.changes[0].wiki_id;old["scope"]=dict(url="https://qa.invalid",owner="alice")
        old["drafts"][0]["scope"]=copy.deepcopy(old["scope"])
        old["drafts"][0]["source_manifest"][0]["note_ref"]["owner_id"]="alice";seal(old["drafts"][0])
        import json
        head=self.db.get(NoteHead,("alice","wiki:"+old["wiki_id"]))
        body=PutNote(schema_version=1,owner_id="alice",local_id="wiki:"+old["wiki_id"],device_id=p.device_id,
            mutation_id=uid(999),crypto_epoch=0,base_head_version=head.version,base_revision_id=head.head_revision_id,
            expected_inventory_revision_ids=[head.head_revision_id],note=dict(note_type="tree",title="AI Wiki "+old["wiki_id"],
                content=json.dumps(old),parent_local_id=None,level=1,tags=None,source="wiki-artifact",deleted_at=None))
        with self.assertRaises(HTTPException) as caught:wikis.mutate(self.db,old["wiki_id"],body,"put")
        self.assertEqual(caught.exception.detail,{"code":"wiki_operation_required"})
        with self.assertRaises(HTTPException):note_v2.mutate(self.db,body,"put")

    def test_v3_committed_missing_receipt_or_floor_rejected(self):
        import json
        from app.services.note_backup import export_snapshot,validate_backup
        from app.api.admin import _backup_content_sha256
        p,c=self.bundle();O.prepare_operation(self.db,p);O.commit_operation(self.db,p.operation_id,c)
        snapshot=export_snapshot(self.db)
        bad=copy.deepcopy(snapshot);bad["items"]["note_mutations"]=[r for r in bad["items"]["note_mutations"] if r["mutation_id"]!=p.changes[0].note_mutation_id]
        for key in ("summary","section_counts"):bad[key]["note_mutations"]-=1
        bad["content_sha256"]=_backup_content_sha256({k:v for k,v in bad.items() if k!="content_sha256"})
        with self.assertRaises(ValueError):validate_backup(bad)

        bad=copy.deepcopy(snapshot);row=next(r for r in bad["items"]["library_resources"] if r["kind"]=="wikis")
        payload=json.loads(row["payload_json"]);payload["document_schema_floor"]=1;row["payload_json"]=json.dumps(payload)
        bad["content_sha256"]=_backup_content_sha256({k:v for k,v in bad.items() if k!="content_sha256"})
        with self.assertRaises(ValueError):validate_backup(bad)

    def legacy(self):
        from test_wiki_artifact import artifact as old_artifact
        from app.services import wikis
        import json
        p,c=self.bundle();old=old_artifact();old["wiki_id"]=p.changes[0].wiki_id
        old["scope"]=dict(url="https://qa.invalid",owner="alice");d=old["drafts"][0];d["scope"]=copy.deepcopy(old["scope"])
        head=self.db.get(NoteHead,("alice","source"));ref=d["source_manifest"][0]
        ref.update(note_ref=dict(owner_id="alice",local_id="source"),source_revision_id=head.head_revision_id,
            head_version=head.version,content_hash=hashlib.sha256(b"Exact quote").hexdigest())
        d["citations"][0]["quote"]="Exact quote";seal(d)
        body=PutNote(schema_version=1,owner_id="alice",local_id="wiki:"+old["wiki_id"],device_id=p.device_id,
            mutation_id=uid(50000),crypto_epoch=0,base_head_version=0,base_revision_id=None,
            expected_inventory_revision_ids=[],note=dict(note_type="tree",title="AI Wiki "+old["wiki_id"],content=json.dumps(old),
            parent_local_id=None,level=1,tags=None,source="wiki-artifact",deleted_at=None))
        result=wikis.mutate(self.db,old["wiki_id"],body,"put")
        return p,old,result

    def test_new_legacy_approval_inside_v2_operation_is_rejected(self):
        p,old,result=self.legacy();doc=copy.deepcopy(old);doc.update(schema_version=2,document_version=2)
        d=doc["drafts"][0]
        doc["approvals"].append(dict(id=uid(50002),parent_approved_revision_id=None,draft_id=d["id"],
            draft_hash=d["draft_hash"],source_manifest_hash=digest(d["source_manifest"]),approved_by="alice",
            approved_at="2026-11-01T00:00:01Z"))
        value=p.model_dump();value.update(operation_id=uid(4001),mutation_id=uid(4002),commit_mutation_id=uid(4003),abort_mutation_id=uid(4004))
        value["draft_bindings"]=[];value["changes"][0].update(action="approve_draft",note_mutation_id=uid(4008),
            base_head_revision_id=result["result_revision_id"],base_head_version=result["result_head_version"],
            base_index_version=1,base_document_version=1,result_document_hash=digest(doc))
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"});prepared=PrepareOperation.model_validate(value)
        body=CommitOperation(schema_version=1,owner_id="alice",device_id=p.device_id,mutation_id=prepared.commit_mutation_id,
            manifest_hash=prepared.manifest_hash,documents=[dict(wiki_id=old["wiki_id"],document=doc)])
        O.prepare_operation(self.db,prepared)
        with self.assertRaises(HTTPException) as caught:O.commit_operation(self.db,prepared.operation_id,body)
        self.assertEqual(caught.exception.detail,{"code":"wiki_v2_approval_required"})

    def test_existing_v1_approval_and_bytes_survive_explicit_v2_append(self):
        import json
        from app.services import wikis
        from app.models.note_history import NoteRevision
        p,old,created=self.legacy();approved=copy.deepcopy(old);approved["document_version"]=2;d=approved["drafts"][0]
        approved["approvals"]=[dict(id=uid(50002),parent_approved_revision_id=None,draft_id=d["id"],draft_hash=d["draft_hash"],
            source_manifest_hash=digest(d["source_manifest"]),approved_by="alice",approved_at="2026-11-01T00:00:01Z")]
        old_body=PutNote(schema_version=1,owner_id="alice",local_id="wiki:"+old["wiki_id"],device_id=p.device_id,
            mutation_id=uid(50001),crypto_epoch=0,base_head_version=created["result_head_version"],base_revision_id=created["result_revision_id"],
            expected_inventory_revision_ids=created["result_inventory_revision_ids"],note=dict(note_type="tree",title="AI Wiki "+old["wiki_id"],
                content=json.dumps(approved),parent_local_id=None,level=1,tags=None,source="wiki-artifact",deleted_at=None))
        result=wikis.mutate(self.db,old["wiki_id"],old_body,"put")
        before={r.id:r.snapshot_json for r in self.db.scalars(select(NoteRevision).where(NoteRevision.local_id==old_body.local_id))}
        self.db.commit()
        doc=copy.deepcopy(approved);doc.update(schema_version=2,document_version=3)
        newest=draft();newest.update(id=uid(60001),generation_id=uid(60002),base_approved_revision_id=uid(50002))
        newest["evidence_manifest"]=[ref.model_dump() for ref in p.inputs];seal(newest);doc["drafts"].append(newest)
        value=p.model_dump();value.update(operation_id=uid(6001),mutation_id=uid(6002),commit_mutation_id=uid(6003),abort_mutation_id=uid(6004))
        value["changes"][0].update(action="append_draft",note_mutation_id=uid(6008),base_head_revision_id=result["result_revision_id"],
            base_head_version=result["result_head_version"],base_index_version=2,base_document_version=2,result_document_hash=digest(doc))
        value["draft_bindings"]=[dict(wiki_id=old["wiki_id"],draft_id=newest["id"],draft_hash=newest["draft_hash"])]
        value["inputs"].append(dict(id="before",kind="wiki",origin="server",owner_id="alice",wiki_id=old["wiki_id"],
            draft_id=d["id"],approval_id=uid(50002),document_version=2,content_hash=d["draft_hash"]))
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"});prepared=PrepareOperation.model_validate(value)
        body=CommitOperation(schema_version=1,owner_id="alice",device_id=p.device_id,mutation_id=prepared.commit_mutation_id,
            manifest_hash=prepared.manifest_hash,documents=[dict(wiki_id=old["wiki_id"],document=doc)])
        O.prepare_operation(self.db,prepared);O.commit_operation(self.db,prepared.operation_id,body)
        for ident,raw in before.items():self.assertEqual(self.db.get(NoteRevision,ident).snapshot_json,raw)
        self.assertEqual(wikis.mutate(self.db,old["wiki_id"],old_body,"put"),result)
        current=wikis.get(self.db,"alice",old["wiki_id"])["artifact"]["document"]
        self.assertEqual(current["approvals"],approved["approvals"])
        self.assertEqual(current["drafts"][0],approved["drafts"][0])

    def test_source_change_between_prepare_commit_keeps_prepared_backup(self):
        from app.services.note_backup import export_snapshot
        p,c=self.bundle();O.prepare_operation(self.db,p)
        current=note_v2.current(self.db,"alice","source")
        update=PutNote(schema_version=1,owner_id="alice",local_id="source",device_id=p.device_id,
            mutation_id=uid(50010),crypto_epoch=0,base_head_version=current["head_version"],
            base_revision_id=current["head_revision_id"],expected_inventory_revision_ids=current["inventory_revision_ids"],
            note=dict(note_type="daily",title="Synthetic",content="Changed",tags=None,source=None))
        note_v2.mutate(self.db,update,"put")
        with self.assertRaises(HTTPException) as caught:O.commit_operation(self.db,p.operation_id,c)
        self.assertEqual(caught.exception.detail,{"code":"wiki_source_changed"})
        self.assertEqual(O.get_operation(self.db,"alice",p.operation_id)["state"],"prepared")
        self.assertTrue(export_snapshot(self.db)["recovery"]["requires_reconciliation"])

    def test_metadata_union_caps_depth_and_cycle(self):
        from app.schemas.wiki import WikiEvidenceV2
        from app.services import wiki_v2
        p,c=self.bundle()
        with self.assertRaises(HTTPException) as caught:wiki_v2.validate_evidence(self.db,"alice",[],stack=tuple(range(33)))
        self.assertEqual(caught.exception.detail,{"code":"wiki_dependency_limit"})
        ref=WikiEvidenceV2(id="n",kind="wiki",origin="server",owner_id="alice",wiki_id=uid(90),draft_id=uid(91),
            approval_id=uid(92),document_version=1,content_hash="a"*64)
        key=(ref.wiki_id,ref.draft_id,ref.approval_id,ref.document_version,ref.content_hash)
        with self.assertRaises(HTTPException) as caught:wiki_v2.validate_evidence(self.db,"alice",[ref],stack=(key,))
        self.assertEqual(caught.exception.detail,{"code":"wiki_dependency_cycle"})
        with self.assertRaises(HTTPException) as caught:wiki_v2.validate_evidence(self.db,"alice",[ref],visited=set(range(2000)))
        self.assertEqual(caught.exception.detail,{"code":"wiki_dependency_limit"})
        with self.assertRaises(HTTPException) as caught:wiki_v2.index_payload(self.db,"alice",uid(999),{("alice","source_"+str(i)) for i in range(1001)},{})
        self.assertEqual(caught.exception.detail,{"code":"wiki_dependency_limit"})
        with self.assertRaises(HTTPException) as caught:wiki_v2.index_payload(self.db,"alice",uid(999),set(),{i:{} for i in range(1001)})
        self.assertEqual(caught.exception.detail,{"code":"wiki_dependency_limit"})

    def test_proposal_cycle_and_binding_survive_v3_roundtrip(self):
        from app.services.note_backup import export_snapshot,restore_empty
        p,c=self.bundle(2);value=p.model_dump();docs=[item.model_dump() for item in c.documents]
        for index,item in enumerate(docs):
            target=docs[1-index];d=item["document"]["drafts"][0]
            d["relations"]=[dict(id="r",from_section_id="s",to_ref=dict(kind="proposal",operation_id=p.operation_id,
                wiki_id=target["wiki_id"],draft_id=target["document"]["drafts"][0]["id"],section_id="s"),
                type="related_to",confidence="inferred",citation_ids=["c"])];seal(d)
        for index,item in enumerate(docs):
            value["draft_bindings"][index]["draft_hash"]=item["document"]["drafts"][0]["draft_hash"]
            value["changes"][index]["result_document_hash"]=digest(item["document"])
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"});p=PrepareOperation.model_validate(value)
        body=CommitOperation(schema_version=1,owner_id="alice",device_id=p.device_id,mutation_id=p.commit_mutation_id,
            manifest_hash=p.manifest_hash,documents=docs)
        O.prepare_operation(self.db,p);O.commit_operation(self.db,p.operation_id,body)
        self.assertEqual(O.get_operation(self.db,"alice",p.operation_id)["manifest"]["draft_bindings"],value["draft_bindings"])
        snapshot=export_snapshot(self.db);empty=create_engine("sqlite:///:memory:")
        try:restore_empty(empty,snapshot)
        finally:empty.dispose()

    def test_legacy_offline_branch_union_is_preserved_on_v2_append(self):
        import json
        from app.services import wikis
        from app.models.note_v2 import NoteOfflineBranch
        from app.schemas.note_v2 import ImportBranches
        from app.services.note_backup import export_snapshot
        p,old,result=self.legacy()
        second=PutNote(schema_version=1,owner_id="alice",local_id="branch-source",device_id=p.device_id,
            mutation_id=uid(51000),crypto_epoch=0,base_head_version=0,base_revision_id=None,expected_inventory_revision_ids=[],
            note=dict(note_type="daily",title="Synthetic branch source",content="Branch quote",tags=None,source=None))
        note_v2.mutate(self.db,second,"put");head=self.db.get(NoteHead,("alice","branch-source"))
        candidate=copy.deepcopy(old);candidate["document_version"]=2;branched=copy.deepcopy(old["drafts"][0])
        branched.update(id=uid(51100),generation_id=uid(51101));ref=branched["source_manifest"][0]
        ref.update(note_ref=dict(owner_id="alice",local_id="branch-source"),source_revision_id=head.head_revision_id,
            head_version=head.version,content_hash=hashlib.sha256(b"Branch quote").hexdigest())
        branched["citations"][0]["quote"]="Branch quote";seal(branched);candidate["drafts"].append(branched)
        candidate["document_version"]=3;candidate["rejected_draft_ids"]=[branched["id"]]
        snapshot=copy.deepcopy(note_v2.current(self.db,"alice","wiki:"+old["wiki_id"])["snapshot"])
        snapshot["note"]["content"]=json.dumps(candidate)
        branch=ImportBranches(schema_version=1,owner_id="alice",local_id="wiki:"+old["wiki_id"],device_id=p.device_id,
            mutation_id=uid(51102),crypto_epoch=0,entries=[dict(revision_id=uid(51103),
                parent_ref=dict(kind="note_revision",id=result["result_revision_id"]),snapshot=snapshot)])
        wikis.mutate(self.db,old["wiki_id"],branch,"import")
        retained=self.db.get(NoteOfflineBranch,uid(51103)).snapshot_json
        doc=copy.deepcopy(old);doc.update(schema_version=2,document_version=2);d=draft()
        d.update(id=uid(60001),generation_id=uid(60002));d["evidence_manifest"]=[ref.model_dump() for ref in p.inputs];seal(d)
        doc["drafts"].append(d);value=p.model_dump()
        value.update(operation_id=uid(6001),mutation_id=uid(6002),commit_mutation_id=uid(6003),abort_mutation_id=uid(6004))
        value["changes"][0].update(action="append_draft",note_mutation_id=uid(6008),base_head_revision_id=result["result_revision_id"],
            base_head_version=1,base_index_version=2,base_document_version=1,result_document_hash=digest(doc))
        value["draft_bindings"]=[dict(wiki_id=old["wiki_id"],draft_id=d["id"],draft_hash=d["draft_hash"])]
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"});prepared=PrepareOperation.model_validate(value)
        body=CommitOperation(schema_version=1,owner_id="alice",device_id=p.device_id,mutation_id=prepared.commit_mutation_id,
            manifest_hash=prepared.manifest_hash,documents=[dict(wiki_id=old["wiki_id"],document=doc)])
        O.prepare_operation(self.db,prepared);O.commit_operation(self.db,prepared.operation_id,body)
        index=self.db.get(LibraryResource,("alice","wikis",old["wiki_id"]))
        self.assertEqual({r["local_id"] for r in json.loads(index.payload_json)["dependencies"]},{"source","branch-source"})
        self.assertEqual(self.db.get(NoteOfflineBranch,uid(51103)).snapshot_json,retained)
        export_snapshot(self.db)

    def test_legacy_v2_export_does_not_silently_include_new_operations(self):
        from app.services.library_backup import export_library,validate_library_backup
        from app.services.note_backup import export_snapshot
        p,c=self.bundle();O.prepare_operation(self.db,p)
        with self.assertRaises(HTTPException) as caught:export_library(self.db)
        self.assertEqual(caught.exception.detail,{"code":"wiki_requires_v3_backup"})
        snapshot=export_snapshot(self.db);snapshot["backup_schema_version"]=2
        with self.assertRaises(ValueError):validate_library_backup(snapshot)

    def test_prepared_space_reservation_survives_active_operation_limit(self):
        p,c=self.bundle();O.prepare_operation(self.db,p)
        def pending(offset):
            value=p.model_dump();doc=c.documents[0].document.model_dump();doc["wiki_id"]=uid(offset+6)
            doc["drafts"][0].update(id=uid(offset+7),generation_id=uid(offset+9));seal(doc["drafts"][0])
            value.update(operation_id=uid(offset+1),mutation_id=uid(offset+2),commit_mutation_id=uid(offset+3),abort_mutation_id=uid(offset+4))
            value["changes"][0].update(wiki_id=uid(offset+6),note_mutation_id=uid(offset+8),result_document_hash=digest(doc))
            value["draft_bindings"]=[dict(wiki_id=uid(offset+6),draft_id=uid(offset+7),draft_hash=doc["drafts"][0]["draft_hash"])]
            value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
            return PrepareOperation.model_validate(value)
        for index in range(1,100):O.prepare_operation(self.db,pending(10000+100*index))
        extra=pending(50000)
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,extra)
        self.assertEqual(caught.exception.detail,{"code":"wiki_operation_limit"})
        original=O.commit_operation(self.db,p.operation_id,c)
        self.assertEqual(original["state"],"committed")
        self.assertEqual(O.get_operation(self.db,"alice",p.operation_id)["receipt"],original)
        O.prepare_operation(self.db,extra)

    def test_generic_library_cannot_downgrade_wiki_or_delete_operation(self):
        from app.services import library
        from app.schemas.library import ResourceWrite,Mutation
        p,c=self.bundle();O.prepare_operation(self.db,p);O.commit_operation(self.db,p.operation_id,c)
        downgrade=ResourceWrite(owner_id="alice",schema_version=1,base_version=1,mutation_id=uid(53000),
            payload=dict(artifact_local_id="wiki:"+p.changes[0].wiki_id,dependencies=[dict(owner_id="alice",local_id="source")]))
        with self.subTest(kind="wikis"),self.assertRaises(HTTPException):
            library.mutate(self.db,owner_id="alice",kind="wikis",resource_id=p.changes[0].wiki_id,body=downgrade)
        deletion=Mutation(owner_id="alice",schema_version=1,base_version=2,mutation_id=uid(53001))
        with self.subTest(kind="wiki-operations"),self.assertRaises(HTTPException):
            library.mutate(self.db,owner_id="alice",kind="wiki-operations",resource_id=p.operation_id,body=deletion,deleting=True)


if __name__=="__main__":unittest.main()
