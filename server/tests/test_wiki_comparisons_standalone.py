"""정책2 비교 입력/PIN/보호 순환과 고정 legacy 백업 회귀."""
import copy
import hashlib
import json
from pathlib import Path
import unittest
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from datetime import datetime

import test_wiki_operation_commit_standalone as base
from test_wiki_v2_standalone import draft,artifact,seal,approval
from app.schemas import wiki_operations as S
from app.schemas.note_v2 import PutNote
from app.schemas.wiki import digest
from app.models.library import LibraryResource
from app.models.note_history import NoteHead
from app.services import wiki_operations as O,note_v2,wikis,note_backup


class ComparisonTest(unittest.TestCase):
    setUp=base.CommitTest.setUp
    tearDown=base.CommitTest.tearDown
    service=base.CommitTest.service
    bundle=base.CommitTest.bundle

    def build(self,documents,actions,inputs):
        values=dict(schema_version=2,owner_id="alice",device_id="synthetic-device",operation_id=str(uuid4()),
            mutation_id=str(uuid4()),commit_mutation_id=str(uuid4()),abort_mutation_id=str(uuid4()),kind="ingest",
            inputs=sorted(copy.deepcopy(inputs),key=lambda x:("wiki",x["owner_id"],x["wiki_id"],x["draft_id"],x["approval_id"]) if x["kind"]=="wiki" else ("note",x["note_ref"]["owner_id"],x["note_ref"]["local_id"],x["source_revision_id"])),
            changes=[],draft_bindings=[])
        for doc,action in zip(documents,actions):
            head=self.db.get(NoteHead,("alice","wiki:"+doc["wiki_id"]))
            index=self.db.get(LibraryResource,("alice","wikis",doc["wiki_id"]))
            values["changes"].append(dict(wiki_id=doc["wiki_id"],action=action,note_mutation_id=str(uuid4()),
                base_head_revision_id=head.head_revision_id if head else None,base_head_version=head.version if head else 0,
                base_index_version=index.version if index else 0,base_document_version=doc["document_version"]-1,result_document_hash=digest(doc)))
            if action in ("create_draft","append_draft"):
                d=doc["drafts"][-1];values["draft_bindings"].append(dict(wiki_id=doc["wiki_id"],draft_id=d["id"],draft_hash=d["draft_hash"]))
        values["changes"].sort(key=lambda x:x["wiki_id"]);values["draft_bindings"].sort(key=lambda x:(x["wiki_id"],x["draft_id"]))
        values["manifest_hash"]=digest(values)
        prepared=getattr(S,"PrepareOperationV2").model_validate(values)
        commit=S.CommitOperation(schema_version=1,owner_id="alice",device_id=prepared.device_id,mutation_id=prepared.commit_mutation_id,
            manifest_hash=prepared.manifest_hash,documents=sorted([dict(wiki_id=d["wiki_id"],document=d) for d in documents],key=lambda x:x["wiki_id"]))
        return prepared,commit

    def publish(self,p,c):
        O.prepare_operation(self.db,p)
        return O.commit_operation(self.db,p.operation_id,c)

    def initial(self,count=1):
        p,c=self.bundle(count);value=p.model_dump();value["schema_version"]=2
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
        p=getattr(S,"PrepareOperationV2").model_validate(value)
        c=S.CommitOperation.model_validate({**c.model_dump(),"manifest_hash":p.manifest_hash})
        self.publish(p,c)
        result=[]
        for item in c.documents:
            doc=item.document.model_dump();doc["document_version"]+=1
            a=approval(doc["drafts"][0]);a["id"]=str(uuid4());doc["approvals"].append(a)
            ap,ac=self.build([doc],["approve_draft"],[r.model_dump() for r in p.inputs]);self.publish(ap,ac)
            result.append(doc)
        return result

    def selected(self):
        body=PutNote(schema_version=1,owner_id="alice",device_id="synthetic-device",local_id="selected",mutation_id=str(uuid4()),
            crypto_epoch=0,base_head_version=0,base_revision_id=None,expected_inventory_revision_ids=[],
            note=dict(note_type="daily",title="Selected",content="Exact quote"))
        result=note_v2.mutate(self.db,body,"put")
        return dict(id="n",kind="note",origin="server",note_ref=dict(owner_id="alice",local_id="selected"),
            source_revision_id=result["result_revision_id"],head_version=result["result_head_version"],content_hash=hashlib.sha256(b"Exact quote").hexdigest())

    def comparison(self,doc):
        a=doc["approvals"][-1];d=next(d for d in doc["drafts"] if d["id"]==a["draft_id"])
        return dict(id="cmp-"+doc["wiki_id"],kind="wiki",origin="server",owner_id="alice",wiki_id=doc["wiki_id"],
            draft_id=d["id"],approval_id=a["id"],document_version=doc["document_version"],content_hash=d["draft_hash"])

    def generated(self,inputs,before=None,wiki=None):
        d=draft();d.update(id=str(uuid4()),generation_id=str(uuid4()),
            base_approved_revision_id=before["approvals"][-1]["id"] if before and before["approvals"] else None)
        wiki=before["wiki_id"] if before else wiki or str(uuid4())
        d["evidence_manifest"]=[copy.deepcopy(r) for r in inputs if not(r["kind"]=="wiki" and r["wiki_id"]==wiki)]
        seal(d)
        if before:
            doc=copy.deepcopy(before);doc["document_version"]+=1;doc["drafts"].append(d)
        else:doc=artifact(d);doc["wiki_id"]=wiki
        return doc

    def cross(self,beta_first=False):
        alpha=self.initial()[0];inputs=[self.selected(),self.comparison(alpha)]
        a=self.generated(inputs,alpha)
        beta=self.generated(inputs,wiki=base.uid(1) if beta_first else base.uid(99999))
        p,c=self.build([a,beta],["append_draft","create_draft"],inputs)
        return p,c,alpha,beta

    def test_old_comparison_leaf_is_kept_for_beta_and_self_before_is_excluded(self):
        p,c,alpha,beta=self.cross();result=self.publish(p,c)
        self.assertEqual(len(result["pages"]),2)
        payload=json.loads(self.db.get(LibraryResource,("alice","wikis",beta["wiki_id"])).payload_json)
        self.assertEqual({r["local_id"] for r in payload["dependencies"]},{"source","selected"})
        self.assertEqual(payload["wiki_dependencies"][0]["wiki_id"],alpha["wiki_id"])
        own=next(d.document for d in c.documents if d.wiki_id==alpha["wiki_id"])
        self.assertEqual([r.id for r in own.drafts[-1].evidence_manifest],["n"])

    def test_old_pin_survives_reverse_publication_order(self):
        p,c,alpha,beta=self.cross(beta_first=True);self.publish(p,c)
        self.assertEqual(O.get_operation(self.db,"alice",p.operation_id)["state"],"committed")
        note_backup.validate_backup(note_backup.export_snapshot(self.db))

    def test_missing_mandatory_comparison_is_rejected_before_reservation(self):
        alpha=self.initial()[0];inputs=[self.selected()];doc=self.generated(inputs,alpha)
        p,c=self.build([doc],["append_draft"],inputs)
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,p)
        self.assertEqual(caught.exception.detail,{"code":"wiki_input_manifest_missing"})
        self.assertIsNone(self.db.get(LibraryResource,("alice",O.KIND,p.operation_id)))

    def test_same_approval_after_container_advance_can_be_used_to_approve_beta(self):
        p,c,alpha,beta=self.cross();self.publish(p,c)
        beta["document_version"]+=1;a=approval(beta["drafts"][-1]);a["id"]=str(uuid4());beta["approvals"].append(a)
        ap,ac=self.build([beta],["approve_draft"],[r.model_dump() for r in p.inputs])
        self.assertEqual(self.publish(ap,ac)["state"],"committed")
        self.assertFalse(wikis.get(self.db,"alice",beta["wiki_id"])["source_status"]["stale"])

    def test_actual_approval_change_is_stale(self):
        p,c,alpha,beta=self.cross();self.publish(p,c)
        updated=next(d.document.model_dump() for d in c.documents if d.wiki_id==alpha["wiki_id"])
        updated["document_version"]+=1;a=approval(updated["drafts"][-1]);a.update(id=str(uuid4()),parent_approved_revision_id=alpha["approvals"][-1]["id"]);updated["approvals"].append(a)
        ap,ac=self.build([updated],["approve_draft"],[p.inputs[0].model_dump()]);self.publish(ap,ac)
        beta["document_version"]+=1;a=approval(beta["drafts"][-1]);a["id"]=str(uuid4());beta["approvals"].append(a)
        ap,ac=self.build([beta],["approve_draft"],[r.model_dump() for r in p.inputs])
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,ap)
        self.assertEqual(caught.exception.detail,{"code":"wiki_source_changed"})

    def test_whole_wiki_cycle_is_rejected_even_when_old_version_dag_is_acyclic(self):
        docs=self.initial(2);inputs=[self.selected(),*[self.comparison(d) for d in docs]]
        outputs=[self.generated(inputs,d) for d in docs]
        p,c=self.build(outputs,["append_draft"]*2,inputs)
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,p)
        self.assertEqual(caught.exception.detail,{"code":"wiki_protection_cycle"})

    def test_legacy_states_and_new_legacy_execution_barrier(self):
        path=Path(__file__).parent/"fixtures/wiki_operation_legacy_v1.json"
        self.assertEqual(hashlib.sha256(path.read_bytes().replace(b"\r\n",b"\n")).hexdigest(),"e04cac4db5ff814110451a53df0fd506d2cb0c67ac061e1ae35d01a215b80a04")
        fixture=json.loads(path.read_text(encoding="utf-8"))
        for case in fixture["cases"]:
            with self.subTest(state=case["state"]):
                empty=create_engine("sqlite:///:memory:")
                try:
                    note_backup.restore_empty(empty,case["backup"])
                    with Session(empty,autoflush=False) as db:
                        p=S.PrepareOperation.model_validate(case["prepare"]);c=S.CommitOperation.model_validate(case["commit"])
                        self.assertEqual(p.model_dump(),case["prepare"])
                        self.assertEqual(O.get_operation(db,"alice",p.operation_id),case["status"])
                        self.assertEqual(O.prepare_operation(db,p),case["status"]["receipt"] if case["state"]=="prepared" else O.phase_receipt(p,"prepared"))
                        if case["state"]=="committed":self.assertEqual(O.commit_operation(db,p.operation_id,c),case["status"]["receipt"])
                        else:
                            with self.assertRaises(HTTPException) as caught:O.commit_operation(db,p.operation_id,c)
                            self.assertEqual(caught.exception.detail,{"code":"wiki_operation_upgrade_required" if case["state"]=="prepared" else "operation_aborted"})
                        if case["state"]!="committed":
                            result=O.abort_operation(db,p.operation_id,S.AbortOperation(schema_version=1,owner_id="alice",device_id=p.device_id,
                                mutation_id=p.abort_mutation_id,manifest_hash=p.manifest_hash))
                            self.assertEqual(result["state"],"aborted")
                finally:empty.dispose()

    def test_strict_new_schema_and_old_hash_are_distinct(self):
        from test_wiki_operations_standalone import request
        old=request();self.assertEqual(S.PrepareOperation.model_validate(old).model_dump(),old)
        for version in (2.0,True,"2"):
            value=copy.deepcopy(old);value["schema_version"]=version
            with self.assertRaises(ValidationError):getattr(S,"PrepareOperationV2").model_validate(value)
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,S.PrepareOperation.model_validate(old))
        self.assertEqual(caught.exception.detail,{"code":"wiki_operation_upgrade_required"})

    def test_wrong_comparison_approval_cannot_use_the_self_exception(self):
        alpha=self.initial()[0];inputs=[self.selected(),self.comparison(alpha)]
        inputs[1]["approval_id"]=str(uuid4());doc=self.generated(inputs,alpha)
        p,c=self.build([doc],["append_draft"],inputs)
        with self.assertRaises(HTTPException):O.prepare_operation(self.db,p)
        self.assertIsNone(self.db.get(LibraryResource,("alice",O.KIND,p.operation_id)))

    def test_pinned_revision_cannot_be_rebound_at_commit(self):
        p,c,alpha,beta=self.cross();O.prepare_operation(self.db,p)
        row=self.db.get(LibraryResource,("alice",O.KIND,p.operation_id));record=json.loads(row.payload_json)
        ref=next(ref for ref in p.inputs if ref.kind=="wiki")
        record["verified_inputs"][ref.id]=p.inputs[0].source_revision_id
        row.payload_json=O.canonical(record);self.db.commit()
        with self.assertRaises(HTTPException) as caught:O.commit_operation(self.db,p.operation_id,c)
        self.assertEqual(caught.exception.detail,{"code":"wiki_source_unavailable"})
        self.assertIsNone(self.db.get(NoteHead,("alice","wiki:"+beta["wiki_id"])))
        self.assertEqual(O.get_operation(self.db,"alice",p.operation_id)["state"],"prepared")

    def test_second_page_comparison_omission_rolls_back_the_first_page(self):
        p,c,alpha,beta=self.cross();broken=copy.deepcopy(beta)
        broken["drafts"][-1]["evidence_manifest"]=[p.inputs[0].model_dump()];seal(broken["drafts"][-1])
        own=next(d.document.model_dump() for d in c.documents if d.wiki_id==alpha["wiki_id"])
        p,c=self.build([own,broken],["append_draft","create_draft"],[r.model_dump() for r in p.inputs])
        O.prepare_operation(self.db,p);head=self.db.get(NoteHead,("alice","wiki:"+alpha["wiki_id"]))
        old=(head.head_revision_id,head.version,head.history_generation)
        with self.assertRaises(HTTPException) as caught:O.commit_operation(self.db,p.operation_id,c)
        self.assertEqual(caught.exception.detail,{"code":"wiki_input_manifest_missing"})
        head=self.db.get(NoteHead,("alice","wiki:"+alpha["wiki_id"]))
        self.assertEqual((head.head_revision_id,head.version,head.history_generation),old)
        self.assertIsNone(self.db.get(NoteHead,("alice","wiki:"+beta["wiki_id"])))

    def comparison_roundtrip(self,state):
        p,c,alpha,beta=self.cross();O.prepare_operation(self.db,p)
        if state=="committed":O.commit_operation(self.db,p.operation_id,c)
        if state=="aborted":O.abort_operation(self.db,p.operation_id,S.AbortOperation(schema_version=1,owner_id="alice",device_id=p.device_id,
            mutation_id=p.abort_mutation_id,manifest_hash=p.manifest_hash))
        snapshot=note_backup.export_snapshot(self.db);empty=create_engine("sqlite:///:memory:")
        try:
            note_backup.restore_empty(empty,snapshot)
            with Session(empty) as db:
                result=O.get_operation(db,"alice",p.operation_id)
                self.assertEqual(result["state"],state);self.assertEqual(result["manifest"],p.model_dump())
        finally:empty.dispose()

    def test_policy2_prepared_comparison_backup_roundtrip(self):self.comparison_roundtrip("prepared")
    def test_policy2_committed_comparison_backup_roundtrip(self):self.comparison_roundtrip("committed")
    def test_policy2_aborted_comparison_backup_roundtrip(self):self.comparison_roundtrip("aborted")

    def test_identity_graph_depth_and_vertex_limits_are_not_truncated(self):
        from app.services.wiki_v2 import validate_protection_graph
        graph={base.uid(90000+i):{base.uid(90001+i)} if i<33 else set() for i in range(34)}
        with self.assertRaises(HTTPException) as caught:validate_protection_graph(self.db,"alice",graph)
        self.assertEqual(caught.exception.detail,{"code":"wiki_dependency_limit"})
        with self.assertRaises(HTTPException) as caught:validate_protection_graph(self.db,"alice",{base.uid(90000+i):set() for i in range(2001)})
        self.assertEqual(caught.exception.detail,{"code":"wiki_dependency_limit"})

    def test_comparison_counts_toward_the_existing_thirty_input_limit(self):
        p,c,alpha,beta=self.cross();value=p.model_dump()
        for index in range(29):
            ref=copy.deepcopy(value["inputs"][0]);ref["id"]="extra-"+str(index)
            ref["note_ref"]["local_id"]="extra-"+str(index)
            value["inputs"].append(ref)
        value["inputs"].sort(key=lambda ref:("wiki",ref["owner_id"],ref["wiki_id"],ref["draft_id"],ref["approval_id"])
            if ref["kind"]=="wiki" else ("note",ref["note_ref"]["owner_id"],ref["note_ref"]["local_id"],ref["source_revision_id"]))
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
        with self.assertRaises(ValidationError):S.PrepareOperationV2.model_validate(value)
        value["inputs"].pop(0)
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
        self.assertEqual(len(S.PrepareOperationV2.model_validate(value).inputs),30)

    def test_archive_rejects_rebound_self_comparison_pin(self):
        p,c,alpha,beta=self.cross();O.prepare_operation(self.db,p)
        row=self.db.get(LibraryResource,("alice",O.KIND,p.operation_id));record=json.loads(row.payload_json)
        ref=next(ref for ref in p.inputs if ref.kind=="wiki")
        record["verified_inputs"][ref.id]=p.inputs[0].source_revision_id
        row.payload_json=O.canonical(record);self.db.commit()
        with self.assertRaises(ValueError):O.validate_operation_rows(self.db)

    def test_retained_trashed_index_cycle_is_still_a_protection_cycle(self):
        from app.services.wiki_v2 import validate_protection_graph
        docs=self.initial(2)
        for before,other in ((docs[0],docs[1]),(docs[1],docs[0])):
            row=self.db.get(LibraryResource,("alice","wikis",before["wiki_id"]))
            payload=json.loads(row.payload_json);ref=self.comparison(other)
            payload["wiki_dependencies"]=[{k:v for k,v in ref.items() if k not in ("id","kind","origin")}]
            payload["lineage_manifest_hash"]=digest({k:v for k,v in payload.items() if k!="lineage_manifest_hash"})
            row.payload_json=O.canonical(payload)
        row.deleted_at=datetime(2026,11,1);self.db.commit()
        with self.assertRaises(HTTPException) as caught:validate_protection_graph(self.db,"alice",{docs[0]["wiki_id"]:set()})
        self.assertEqual(caught.exception.detail,{"code":"wiki_protection_cycle"})

    def test_unverified_legacy_multi_output_is_not_a_new_comparison_proof(self):
        alpha=self.initial()[0];inputs=[self.selected(),self.comparison(alpha)]
        own=self.generated(inputs,alpha);beta=self.generated(inputs)
        p,c=self.build([own,beta],["append_draft","create_draft"],inputs)
        old=p.model_dump();old["schema_version"]=1;old["inputs"]=[old["inputs"][0]]
        old["manifest_hash"]=digest({k:v for k,v in old.items() if k!="manifest_hash"})
        # 옛 게시 증거를 조작하지 않고 증명 불가 metadata만으로 비교를 거부한다.
        self.db.add(LibraryResource(owner_id="alice",kind=O.KIND,id=p.operation_id,schema_version=1,version=2,
            payload_json=O.canonical(dict(state="committed",manifest=old,reserved_bytes=131072,verified_inputs={"n":p.inputs[0].source_revision_id})),
            created_at=datetime(2026,11,1),updated_at=datetime(2026,11,1)))
        self.db.commit()
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,p)
        self.assertEqual(caught.exception.detail,{"code":"idempotency_mismatch"})
        value=p.model_dump();value.update(operation_id=str(uuid4()),mutation_id=str(uuid4()),commit_mutation_id=str(uuid4()),abort_mutation_id=str(uuid4()))
        for change in value["changes"]:change["note_mutation_id"]=str(uuid4())
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"});p=S.PrepareOperationV2.model_validate(value)
        with self.assertRaises(HTTPException) as caught:O.prepare_operation(self.db,p)
        self.assertEqual(caught.exception.detail,{"code":"wiki_dependency_unverified"})
        # 계정 전체 차단이 아니라 이 비교 조합만 차단한다.
        note=inputs[0];doc=self.generated([note]);fresh,body=self.build([doc],["create_draft"],[note])
        self.assertEqual(self.publish(fresh,body)["state"],"committed")
