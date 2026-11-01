"""실제 앱 라우팅/인증과 합성 메모리 DB만 사용하는 I7b3 검사."""
import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import QueuePool

import test_wiki_operation_commit_standalone as publication
from test_wiki_operations_standalone import uid
from app.models.library import LibraryResource, LibraryMutation
from app.models.note import UserAccount, UserDevice, Note
from app.models.note_history import NoteHead, NoteRevision
from app.models.note_v2 import NoteMutation
from app.schemas.wiki import digest
from app.services import wiki_operations as service

PREFIX="/api/v1/wiki-operations"


class HttpTest(unittest.TestCase):
    bundle=publication.CommitTest.bundle
    engine_options=dict(poolclass=QueuePool)

    def setUp(self):
        from app.main import create_app
        from app.db import Base, get_db
        from app.core.config import get_settings
        from app.services.user_accounts import issue_user_device_access_token, issue_web_session
        self.app=create_app()
        publication.CommitTest.setUp(self)
        Base.metadata.create_all(self.engine)
        settings=get_settings()
        self.settings_patch=patch.multiple(settings,api_token="synthetic-server-token",user_token_required=True)
        self.settings_patch.start()
        _,token=issue_user_device_access_token(self.db,owner_id="alice",device_id="synthetic-device")
        _,web=issue_web_session(self.db,owner_id="alice")
        _,other=issue_user_device_access_token(self.db,owner_id="bob",device_id="other-device")
        self.db.commit()
        self.headers={"X-Now-User-Token":token}
        self.web={"X-Now-Web-Session":web}
        self.foreign={"X-Now-User-Token":other}
        def backend():
            with Session(self.engine,autoflush=False) as db:
                yield db
        self.app.dependency_overrides[get_db]=backend
        self.client=TestClient(self.app,raise_server_exceptions=False)

    def tearDown(self):
        self.client.close();self.app.dependency_overrides.clear();self.settings_patch.stop()
        publication.CommitTest.tearDown(self)

    def service(self):return service

    def post(self,path,body,headers=None):
        return self.client.post(PREFIX+path,json=body.model_dump() if hasattr(body,"model_dump") else body,
                                headers=self.headers if headers is None else headers)

    def status(self,p,headers=None,owner="alice"):
        return self.client.get(PREFIX+"/"+p.operation_id,params={"owner_id":owner},
                               headers=self.headers if headers is None else headers)

    def ok(self,response):
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.headers.get("cache-control"),"no-store")
        return response.json()

    def abort(self,p):
        return dict(schema_version=1,owner_id=p.owner_id,device_id=p.device_id,
                    mutation_id=p.abort_mutation_id,manifest_hash=p.manifest_hash)

    def test_two_page_commit_status_and_original_replay(self):
        p,c=self.bundle(2)
        self.assertEqual(self.ok(self.post("/prepare",p))["state"],"prepared")
        first=self.ok(self.post("/"+p.operation_id+"/commit",c))
        self.assertEqual(len(first["pages"]),2)
        self.assertEqual(self.ok(self.status(p))["receipt"],first)
        self.assertEqual(self.ok(self.post("/"+p.operation_id+"/commit",c)),first)
        self.assertEqual(self.ok(self.post("/prepare",p))["state"],"prepared")
        exposed=json.dumps(self.ok(self.status(p)))
        for secret in ("Exact quote","Synthetic","evidence_manifest","sections","access_token"):
            self.assertNotIn(secret,exposed)
        self.assertEqual(self.ok(self.status(p,headers=self.web))["state"],"committed")

    def test_phase_id_and_body_mismatch_are_conflicts(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p));self.ok(self.post("/"+p.operation_id+"/commit",c))
        wrong=c.model_dump();wrong["mutation_id"]=uid(999)
        self.assertEqual(self.post("/"+p.operation_id+"/commit",wrong).status_code,409)
        wrong=c.model_dump();wrong["documents"][0]["document"]["document_version"]+=1
        self.assertEqual(self.post("/"+p.operation_id+"/commit",wrong).status_code,409)
        self.assertEqual(self.post("/"+p.operation_id+"/abort",self.abort(p)).json()["detail"]["code"],"operation_already_committed")

    def test_abort_replay_and_aborted_commit(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p))
        result=self.ok(self.post("/"+p.operation_id+"/abort",self.abort(p)))
        self.assertEqual(result["state"],"aborted")
        self.assertEqual(self.ok(self.post("/"+p.operation_id+"/abort",self.abort(p))),result)
        response=self.post("/"+p.operation_id+"/commit",c)
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json()["detail"]["code"],"operation_aborted")
        self.assertEqual(self.ok(self.status(p))["receipt"],result)

    def test_unauthenticated_and_other_owner_cannot_use_any_route(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p))
        for path,body in [("/prepare",p),("/"+p.operation_id+"/commit",c),("/"+p.operation_id+"/abort",self.abort(p))]:
            with self.subTest(path=path):
                self.assertEqual(self.post(path,body,headers={}).status_code,401)
                self.assertEqual(self.post(path,body,headers=self.foreign).status_code,401)
        self.assertEqual(self.status(p,headers={}).status_code,401)
        self.assertEqual(self.status(p,owner="bob").status_code,401)

    def test_inactive_owner_or_token_device_is_denied(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p))
        device=self.db.scalar(select(UserDevice).where(UserDevice.owner_id=="alice"));device.is_active=0;self.db.commit()
        for response in (self.status(p),self.post("/prepare",p),self.post("/"+p.operation_id+"/commit",c),
                         self.post("/"+p.operation_id+"/abort",self.abort(p))):
            self.assertEqual(response.status_code,403,response.text)
        device.is_active=1;self.db.scalar(select(UserAccount).where(UserAccount.owner_id=="alice")).is_active=0;self.db.commit()
        self.assertEqual(self.status(p).status_code,403)
        self.assertEqual(self.status(p,headers=self.web).status_code,403)

    def test_web_session_cannot_write_as_inactive_body_device(self):
        p,c=self.bundle();device=self.db.scalar(select(UserDevice).where(UserDevice.owner_id=="alice"))
        device.is_active=0;self.db.commit()
        self.assertEqual(self.post("/prepare",p,headers=self.web).status_code,403)

    def test_web_writes_and_existing_server_token_policy(self):
        from app.core.config import get_settings
        p,c=self.bundle()
        with patch.object(get_settings(),"user_token_required",False):
            self.assertEqual(self.post("/prepare",p).status_code,401)
            self.ok(self.post("/prepare",p,headers={**self.headers,"X-Now-Token":"synthetic-server-token"}))
            self.assertEqual(self.ok(self.post("/"+p.operation_id+"/commit",c,headers=self.web))["state"],"committed")

    def test_malformed_json_and_abort_unknown_fields_are_safe(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p))
        response=self.client.post(PREFIX+"/prepare",content='{ "PRIVATE_BODY": ',
                                  headers={**self.headers,"Content-Type":"application/json"})
        self.assertEqual(response.status_code,422,response.text)
        self.assertEqual(response.json(),{"detail":{"code":"invalid_request"}})
        response=self.post("/"+p.operation_id+"/abort",{**self.abort(p),"extra":"PRIVATE_BODY"})
        self.assertEqual(response.status_code,422,response.text)
        self.assertNotIn("PRIVATE_BODY",response.text)

    def test_unknown_fields_numbers_local_input_and_ids_are_safe_422(self):
        p,c=self.bundle()
        for key,value in (("extra","PRIVATE_BODY"),("schema_version",1.0),("schema_version",2.0),("schema_version","2"),("schema_version",True),("operation_id","not-a-uuid")):
            body=p.model_dump();body[key]=value
            with self.subTest(key=key,value=value):
                response=self.post("/prepare",body)
                self.assertEqual(response.status_code,422,response.text)
                self.assertEqual(response.json(),{"detail":{"code":"invalid_request"}})
                self.assertEqual(response.headers.get("cache-control"),"no-store")
        body=p.model_dump();body["changes"][0]["base_head_version"]=False
        self.assertEqual(self.post("/prepare",body).status_code,422)
        body=p.model_dump();body["inputs"][0]["origin"]="local"
        self.assertEqual(self.post("/prepare",body).status_code,422)
        self.assertEqual(self.client.get(PREFIX+"/not-a-uuid",params={"owner_id":"alice"},headers=self.headers).status_code,422)
        self.assertEqual(self.post("/not-a-uuid/commit",c).status_code,422)
        self.assertEqual(self.status(p).status_code,404)

    def test_second_page_failure_is_safe_and_rolls_back_everything(self):
        p,c=self.bundle(2);self.ok(self.post("/prepare",p))
        target="wiki:"+p.changes[1].wiki_id
        self.db.execute(text("CREATE TRIGGER synthetic_abort BEFORE INSERT ON notes WHEN NEW.local_id='"+target+"' BEGIN SELECT RAISE(ABORT,'PRIVATE_SQL'); END"));self.db.commit()
        response=self.post("/"+p.operation_id+"/commit",c)
        self.assertEqual(response.status_code,500)
        self.assertEqual(response.json(),{"detail":{"code":"internal_error"}})
        self.assertEqual(response.headers.get("cache-control"),"no-store")
        self.db.expire_all()
        self.assertEqual(self.db.scalars(select(Note).where(Note.local_id.like("wiki:%"))).all(),[])
        self.assertEqual(self.db.scalars(select(LibraryResource).where(LibraryResource.kind=="wikis")).all(),[])
        self.assertEqual(self.ok(self.status(p))["state"],"prepared")
        self.assertIsNone(self.db.get(NoteMutation,("alice",p.changes[0].note_mutation_id)))

    def test_stale_source_keeps_prepared_and_never_partially_publishes(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p))
        current=self.client.get("/api/v2/notes/current",params={"owner_id":"alice","local_id":"source"},headers=self.headers).json()
        body=dict(schema_version=1,owner_id="alice",device_id=p.device_id,local_id="source",mutation_id=uid(999),crypto_epoch=0,
            base_head_version=current["head_version"],base_revision_id=current["head_revision_id"],
            expected_inventory_revision_ids=current["inventory_revision_ids"],note=dict(note_type="daily",title="QA",content="Changed"))
        self.assertEqual(self.client.put("/api/v2/notes/current",json=body,headers=self.headers).status_code,200)
        response=self.post("/"+p.operation_id+"/commit",c)
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json()["detail"]["code"],"wiki_source_changed")
        self.assertEqual(self.ok(self.status(p))["state"],"prepared")

    def test_reserved_id_cannot_be_consumed_by_normal_note_writer(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p))
        body=dict(schema_version=1,owner_id="alice",device_id=p.device_id,local_id="steal",mutation_id=p.commit_mutation_id,
            crypto_epoch=0,base_head_version=0,base_revision_id=None,expected_inventory_revision_ids=[],
            note=dict(note_type="daily",title="QA",content="Unrelated"))
        response=self.client.put("/api/v2/notes/current",json=body,headers=self.headers)
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json()["detail"]["code"],"idempotency_mismatch")

    def test_protected_history_is_rejected_at_prepare_and_commit(self):
        p,c=self.bundle();head=self.db.get(NoteHead,("alice","source"))
        revision=self.db.get(NoteRevision,head.head_revision_id);revision.representation_epoch=1;self.db.commit()
        response=self.post("/prepare",p)
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json()["detail"]["code"],"wiki_protected_batch_not_supported")
        revision.representation_epoch=0;self.db.commit();self.ok(self.post("/prepare",p))
        revision.representation_epoch=1;self.db.commit()
        response=self.post("/"+p.operation_id+"/commit",c)
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(self.ok(self.status(p))["state"],"prepared")

    def test_fenced_source_is_rejected_without_publication(self):
        from datetime import datetime
        from app.models.note_crypto import NoteCryptoFence, NoteCryptoTransition
        p,c=self.bundle()
        self.db.add(NoteCryptoTransition(id=uid(900),owner_id="alice",local_id="source",mutation_id=uid(901),
            actor_device_id=p.device_id,conditions_json="{}",manifest_digest="a"*64,state="prepared",lease_version=1,
            expires_at=datetime(2099,1,1),created_at=datetime(2026,11,1),purpose="conversion"))
        self.db.flush();self.db.add(NoteCryptoFence(owner_id="alice",local_id="source",transition_id=uid(900)));self.db.commit()
        self.assertEqual(self.post("/prepare",p).status_code,423)
        self.assertEqual(self.status(p).status_code,404)

    def test_target_cas_rejects_late_operation(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p));self.ok(self.post("/"+p.operation_id+"/commit",c))
        first,first_body=publication.CommitTest.approve(self,p,c)
        second,second_body=publication.CommitTest.approve(self,p,c,offset=3000)
        self.ok(self.post("/prepare",first));self.ok(self.post("/prepare",second))
        self.ok(self.post("/"+first.operation_id+"/commit",first_body))
        response=self.post("/"+second.operation_id+"/commit",second_body)
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json()["detail"]["code"],"wiki_target_changed")
        self.assertEqual(self.ok(self.status(second))["state"],"prepared")

    def test_active_quota_blocks_only_new_prepare(self):
        from app.schemas.wiki_operations import PrepareOperationV2 as PrepareOperation
        p,c=self.bundle();self.ok(self.post("/prepare",p))
        def pending(offset):
            value=p.model_dump();value.update(operation_id=uid(offset+1),mutation_id=uid(offset+2),
                commit_mutation_id=uid(offset+3),abort_mutation_id=uid(offset+4))
            value["changes"][0]["note_mutation_id"]=uid(offset+8)
            value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
            return PrepareOperation.model_validate(value)
        for index in range(1,100):service.prepare_operation(self.db,pending(10000+100*index))
        extra=pending(50000)
        response=self.post("/prepare",extra)
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json()["detail"]["code"],"wiki_operation_limit")
        self.assertEqual(self.ok(self.status(p))["state"],"prepared")
        self.assertEqual(self.ok(self.post("/"+p.operation_id+"/abort",self.abort(p)))["state"],"aborted")
        self.assertEqual(self.ok(self.post("/prepare",extra))["state"],"prepared")

    def test_invalid_commit_document_never_echoes_plaintext(self):
        p,c=self.bundle();self.ok(self.post("/prepare",p))
        body=c.model_dump();body["documents"][0]["document"]["drafts"][0]["sections"][0]["markdown"]="PRIVATE_BODY"
        response=self.post("/"+p.operation_id+"/commit",body)
        self.assertEqual(response.status_code,422,response.text)
        self.assertEqual(response.json(),{"detail":{"code":"invalid_request"}})
        self.assertEqual(self.ok(self.status(p))["state"],"prepared")

    def test_capabilities_are_registered_without_enabling_protection(self):
        result=self.client.get("/api/v1/server");self.assertEqual(result.status_code,200)
        capabilities=result.json()["capabilities"]
        self.assertEqual(capabilities.get("wiki_document_schema"),2)
        self.assertIs(capabilities.get("wiki_operations_v1"),True)
        self.assertEqual(capabilities.get("wiki_operation_manifest_schema"),2)
        from app.core import capabilities as C
        self.assertIs(C.MIXED_MUTATIONS_ENABLED,False)
        self.assertIs(capabilities["mixed_full_conversion_v1"],False)
        self.assertIs(capabilities["full_protection_complete"],False)
        paths={(route.path,method) for route in self.app.routes for method in getattr(route,"methods",[])}
        self.assertIn((PREFIX+"/prepare","POST"),paths)
        self.assertIn((PREFIX+"/{operation_id}/commit","POST"),paths)
        self.assertIn((PREFIX+"/{operation_id}/abort","POST"),paths)
        self.assertIn((PREFIX+"/{operation_id}","GET"),paths)
        self.assertNotIn((PREFIX+"/{resource_id}","PUT"),paths)
        self.assertNotIn((PREFIX+"/{resource_id}","DELETE"),paths)

    def test_new_prepare1_is_upgrade_conflict_not_a_legacy_write_fallback(self):
        p,c=self.bundle();value=p.model_dump();value["schema_version"]=1
        value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
        response=self.post("/prepare",value)
        self.assertEqual(response.status_code,409,response.text)
        self.assertEqual(response.json(),{"detail":{"code":"wiki_operation_upgrade_required"}})
        self.assertEqual(self.status(p).status_code,404)

    def test_legacy_replay_status_and_abort_use_the_original_transport(self):
        from pathlib import Path
        from uuid import uuid4
        from sqlalchemy import create_engine
        from app.db import get_db
        from app.services.note_backup import restore_empty
        from app.services.user_accounts import issue_user_device_access_token
        fixture=json.loads((Path(__file__).parent/"fixtures/wiki_operation_legacy_v1.json").read_text(encoding="utf-8"))
        for case in fixture["cases"]:
            with self.subTest(state=case["state"]):
                engine=create_engine("sqlite:///file:legacy-http-"+uuid4().hex+"?mode=memory&cache=shared&uri=true",
                    connect_args={"check_same_thread":False},poolclass=QueuePool)
                previous=self.app.dependency_overrides[get_db]
                try:
                    restore_empty(engine,case["backup"])
                    with Session(engine) as db:
                        _,token=issue_user_device_access_token(db,owner_id="alice",device_id="synthetic-device");db.commit()
                    headers={"X-Now-User-Token":token}
                    def backend():
                        with Session(engine,autoflush=False) as db:yield db
                    self.app.dependency_overrides[get_db]=backend
                    p=case["prepare"];ident=p["operation_id"]
                    response=self.client.get(PREFIX+"/"+ident,params={"owner_id":"alice"},headers=headers)
                    self.assertEqual(self.ok(response),case["status"])
                    self.assertEqual(self.ok(self.post("/prepare",p,headers=headers))["state"],"prepared")
                    response=self.post("/"+ident+"/commit",case["commit"],headers=headers)
                    if case["state"]=="committed":self.assertEqual(self.ok(response),case["status"]["receipt"])
                    else:
                        self.assertEqual(response.status_code,409)
                        expected="wiki_operation_upgrade_required" if case["state"]=="prepared" else "operation_aborted"
                        self.assertEqual(response.json()["detail"]["code"],expected)
                        abort=dict(schema_version=1,owner_id="alice",device_id=p["device_id"],mutation_id=p["abort_mutation_id"],manifest_hash=p["manifest_hash"])
                        self.assertEqual(self.ok(self.post("/"+ident+"/abort",abort,headers=headers))["state"],"aborted")
                finally:
                    self.app.dependency_overrides[get_db]=previous;engine.dispose()
