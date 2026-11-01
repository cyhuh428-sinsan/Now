"""합성 메모리 SQLite만 사용하는 비공개 operation 예약 검사."""
import os
os.environ["NOW_DATABASE_URL"] = "sqlite:///:memory:"
import copy
import unittest
from uuid import UUID
from datetime import datetime
from types import SimpleNamespace
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from app.db import Base
from app.models.note import UserAccount
from app.models.library import LibraryMutation, LibraryResource
from app.models.note_v2 import NoteMutation
from app.schemas.wiki import digest
from app.services import related_text  # Register normal startup flush listeners before synthetic sessions.


def uid(n): return str(UUID(int=n))


def request(owner="alice", offset=0):
    value = dict(schema_version=1, owner_id=owner, device_id="synthetic-device",
        operation_id=uid(1+offset), mutation_id=uid(2+offset), commit_mutation_id=uid(3+offset),
        abort_mutation_id=uid(4+offset), kind="ingest",
        inputs=[dict(id="n", kind="note", origin="server", note_ref=dict(owner_id=owner, local_id="source"),
            source_revision_id=uid(5), head_version=1, content_hash="a"*64)],
        draft_bindings=[dict(wiki_id=uid(6+offset), draft_id=uid(7+offset), draft_hash="b"*64)],
        changes=[dict(wiki_id=uid(6+offset), action="create_draft", note_mutation_id=uid(8+offset),
            base_head_revision_id=None, base_head_version=0, base_index_version=0, base_document_version=0,
            result_document_hash="c"*64)])
    value["manifest_hash"] = digest(value)
    return value


class OperationTest(unittest.TestCase):
    def models(self):
        from app.schemas import wiki_operations as S
        return S

    def service(self):
        from app.services import wiki_operations as O
        return O

    def setUp(self):
        self.engine = create_engine(getattr(self,"engine_url","sqlite:///:memory:"),connect_args={"check_same_thread":False})
        # Models are loaded by the reservation service before creating the disposable schema.
        try: self.service()
        except ImportError: pass
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, autoflush=False)
        self.db.add_all([UserAccount(owner_id="alice"), UserAccount(owner_id="bob")]); self.db.commit()

    def tearDown(self):
        self.db.close(); self.engine.dispose()

    def test_schema_hash_sort_ids_and_strict_numbers(self):
        S = self.models(); good = request()
        self.assertEqual(S.PrepareOperation.model_validate(good).model_dump(), good)
        for key, value in [("schema_version", 1.0), ("schema_version", True), ("commit_mutation_id", good["mutation_id"]),
                           ("manifest_hash", "0"*64)]:
            bad=copy.deepcopy(good); bad[key]=value
            with self.subTest(key=key, value=value), self.assertRaises(ValidationError): S.PrepareOperation.model_validate(bad)
        for key in ("base_head_version", "base_index_version", "base_document_version"):
            bad=copy.deepcopy(good); bad["changes"][0][key]=True
            bad["manifest_hash"]=digest({k:v for k,v in bad.items() if k!="manifest_hash"})
            with self.subTest(key=key), self.assertRaises(ValidationError): S.PrepareOperation.model_validate(bad)
        bad=copy.deepcopy(good); bad["inputs"][0]["origin"]="local"
        bad["manifest_hash"]=digest({k:v for k,v in bad.items() if k!="manifest_hash"})
        with self.assertRaises(ValidationError): S.PrepareOperation.model_validate(bad)

    def test_reservations_are_not_success_and_owner_scoped(self):
        O=self.service(); body=self.models().PrepareOperation.model_validate(request())
        result=O.reserve_operation(self.db,body)
        self.assertEqual(result["state"],"prepared")
        self.assertEqual(O.reserve_operation(self.db,body),result)
        for ident in (body.mutation_id,body.commit_mutation_id,body.abort_mutation_id,body.changes[0].note_mutation_id):
            with self.assertRaises(HTTPException) as caught: O.require_unreserved(self.db,"alice",ident)
            self.assertEqual(caught.exception.status_code,409); self.db.rollback()
            O.require_unreserved(self.db,"bob",ident); self.db.rollback()
        rows=self.db.scalars(select(LibraryMutation)).all()
        self.assertEqual(len(rows),4)
        self.assertNotIn('Exact quote',str([r.response_json for r in rows]))
        other=self.models().PrepareOperation.model_validate(request(owner="bob"))
        self.assertEqual(O.reserve_operation(self.db,other)["state"],"prepared")

    def test_conflict_rolls_back_all_and_keeps_old_receipt(self):
        O=self.service(); value=request()
        old=LibraryMutation(owner_id="alice",mutation_id=value["changes"][0]["note_mutation_id"],
            request_hash="d"*64,response_json='{"status":"ok","synthetic":true}')
        self.db.add(old);self.db.commit()
        with self.assertRaises(HTTPException): O.reserve_operation(self.db,self.models().PrepareOperation.model_validate(value))
        self.assertEqual(len(self.db.scalars(select(LibraryResource)).all()),0)
        self.assertEqual(self.db.get(LibraryMutation,("alice",old.mutation_id)).response_json,'{"status":"ok","synthetic":true}')

    def test_note_and_protection_writers_cannot_replay_reserved_id(self):
        O=self.service(); body=self.models().PrepareOperation.model_validate(request());O.reserve_operation(self.db,body)
        from app.services import note_v2, note_crypto, note_crypto_storage, library, wikis
        stolen=SimpleNamespace(owner_id="alice",device_id=body.device_id,mutation_id=body.commit_mutation_id,local_id="unused")
        for call in [lambda:note_v2.mutate(self.db,stolen,"put"),lambda:note_crypto.prepare(self.db,stolen),
                     lambda:note_crypto_storage.commit(self.db,stolen),lambda:wikis.mutate(self.db,"unused",stolen,"put")]:
            with self.subTest(call=call),self.assertRaises(HTTPException) as caught: call()
            self.assertEqual(caught.exception.detail,{"code":"idempotency_mismatch"});self.db.rollback()
        from app.schemas.library import ResourceWrite
        mutation=ResourceWrite(owner_id="alice",schema_version=1,base_version=0,mutation_id=body.commit_mutation_id,
            payload=dict(name="synthetic",content_template=""))
        with self.assertRaises(HTTPException):library.mutate(self.db,owner_id="alice",kind="templates",resource_id=uid(99),body=mutation)

    def test_protected_and_mixed_entrypoints_block_before_replay(self):
        O=self.service(); body=self.models().PrepareOperation.model_validate(request());O.reserve_operation(self.db,body)
        from app.services import (note_protected_write as pw,note_protected_import as pi,note_mixed_operations as mo,
            note_mixed_write as mw,note_mixed_import as mi,note_mixed_related as mr,protected_analysis as pa,
            mixed_analysis as ma,related_drain as rd,wikis)
        stolen=SimpleNamespace(owner_id="alice",device_id=body.device_id,mutation_id=body.commit_mutation_id)
        calls=[(pw.quote,()),(pw.commit,()),(pi.prepare,()),(pi.commit,()),(mo.prepare,(mo.CP,)),
            (mo.commit,(mo.CP,)),(mw.prepare,()),(mw.commit,()),(mi.prepare,()),(mi.commit,()),
            (mr.prepare,()),(mr.prepare_transcript,()),(mr.commit,("mixed_analysis_write",)),
            (pa.claim,()),(ma.claim,()),(rd.prepare,())]
        for function,args in calls:
            with self.subTest(function=function.__module__+"."+function.__name__),self.assertRaises(HTTPException) as caught:
                function(self.db,stolen,*args)
            self.assertEqual(caught.exception.detail,{"code":"idempotency_mismatch"});self.db.rollback()
        from app.schemas.wiki import WikiLifecycle
        lifecycle=WikiLifecycle(owner_id="alice",device_id=body.device_id,schema_version=1,
            base_version=0,mutation_id=body.commit_mutation_id)
        with self.assertRaises(HTTPException) as caught:wikis.lifecycle(self.db,uid(99),lifecycle,restoring=False)
        self.assertEqual(caught.exception.detail,{"code":"idempotency_mismatch"})

    def test_completed_ids_stay_owned_and_manifest_cannot_change(self):
        O=self.service(); S=self.models(); value=request();body=S.PrepareOperation.model_validate(value)
        O.reserve_operation(self.db,body)
        row=self.db.get(LibraryMutation,("alice",body.commit_mutation_id))
        row.response_json='{"status":"ok","wiki_operation":true,"state":"committed"}'
        self.db.commit()
        with self.assertRaises(HTTPException):O.require_unreserved(self.db,"alice",body.commit_mutation_id)
        self.db.rollback()
        changed=copy.deepcopy(value);changed["kind"]="integrate"
        changed["manifest_hash"]=digest({k:v for k,v in changed.items() if k!="manifest_hash"})
        with self.assertRaises(HTTPException):O.reserve_operation(self.db,S.PrepareOperation.model_validate(changed))

    def test_duplicate_order_local_and_unknown_request_fields(self):
        S=self.models()
        for key in ("inputs","changes","draft_bindings"):
            bad=request();bad[key]*=2
            bad["manifest_hash"]=digest({k:v for k,v in bad.items() if k!="manifest_hash"})
            with self.subTest(key=key),self.assertRaises(ValidationError):S.PrepareOperation.model_validate(bad)
        for key in ("commit_mutation_id","abort_mutation_id"):
            bad=request();bad[key]=bad["changes"][0]["note_mutation_id"]
            bad["manifest_hash"]=digest({k:v for k,v in bad.items() if k!="manifest_hash"})
            with self.subTest(key=key),self.assertRaises(ValidationError):S.PrepareOperation.model_validate(bad)
        bad=request();bad["inputs"][0]["note_ref"]["owner_id"]="bob"
        bad["manifest_hash"]=digest({k:v for k,v in bad.items() if k!="manifest_hash"})
        with self.assertRaises(ValidationError):S.PrepareOperation.model_validate(bad)
        bad=request();bad["changes"][0]["base_head_version"]=1
        bad["manifest_hash"]=digest({k:v for k,v in bad.items() if k!="manifest_hash"})
        with self.assertRaises(ValidationError):S.PrepareOperation.model_validate(bad)
        bad=request();bad["unknown"]="not allowed"
        with self.assertRaises(ValidationError):S.PrepareOperation.model_validate(bad)
        bad=request();second=copy.deepcopy(bad["changes"][0]);second.update(wiki_id=uid(100),note_mutation_id=uid(101))
        bad["changes"]=[second,*bad["changes"]]
        bad["manifest_hash"]=digest({k:v for k,v in bad.items() if k!="manifest_hash"})
        with self.assertRaises(ValidationError):S.PrepareOperation.model_validate(bad)
        for model in (S.AbortOperation,S.CommitOperation):
            for invalid in (True,1.0,"1"):
                envelope=dict(schema_version=invalid,owner_id="alice",device_id="synthetic-device",
                    mutation_id=uid(3),manifest_hash="a"*64)
                if model is S.CommitOperation:envelope["documents"]=[]
                with self.subTest(model=model.__name__,invalid=invalid),self.assertRaises(ValidationError):model.model_validate(envelope)

    def test_other_note_mutation_collision_and_two_session_visibility(self):
        O=self.service(); S=self.models(); value=request()
        self.db.add(NoteMutation(owner_id="alice",mutation_id=value["commit_mutation_id"],local_id="other",
            operation="put",actor_device_id="synthetic-device",crypto_epoch=0,conditions_json="{}",result_json='{"status":"ok"}'))
        self.db.commit()
        with self.assertRaises(HTTPException):O.reserve_operation(self.db,S.PrepareOperation.model_validate(value))
        self.assertEqual(self.db.scalars(select(LibraryResource)).all(),[]);self.db.rollback()
        body=S.PrepareOperation.model_validate(request(offset=100))
        original=O.reserve_operation(self.db,body)
        with Session(self.engine,autoflush=False) as second:
            self.assertEqual(O.reserve_operation(second,body),original)
            changed=request(offset=200);changed["commit_mutation_id"]=body.commit_mutation_id
            changed["manifest_hash"]=digest({k:v for k,v in changed.items() if k!="manifest_hash"})
            with self.assertRaises(HTTPException):O.reserve_operation(second,S.PrepareOperation.model_validate(changed))

    def test_budget_and_active_limit(self):
        O=self.service(); S=self.models()
        with self.assertRaises(HTTPException): O.reserve_operation(self.db,S.PrepareOperation.model_validate(request()),
            inventory_ids={uid(6):[uid(n) for n in range(10000)]})
        self.assertEqual(self.db.scalars(select(LibraryResource)).all(),[])
        for n in range(100): O.reserve_operation(self.db,S.PrepareOperation.model_validate(request(offset=100*n)))
        with self.assertRaises(HTTPException) as caught:O.reserve_operation(self.db,S.PrepareOperation.model_validate(request(offset=20000)))
        self.assertEqual(caught.exception.detail,{"code":"wiki_operation_limit"})

    def test_existing_library_and_note_success_replay_unchanged(self):
        from app.schemas.library import ResourceWrite
        from app.services import library,note_v2
        from app.schemas.note_v2 import PutNote
        value=ResourceWrite(owner_id="alice",schema_version=1,base_version=0,mutation_id=uid(900),
            payload=dict(name="synthetic",content_template="Synthetic body"))
        first=library.mutate(self.db,owner_id="alice",kind="templates",resource_id=uid(901),body=value)
        self.assertEqual(library.mutate(self.db,owner_id="alice",kind="templates",resource_id=uid(901),body=value),first)
        note=PutNote(schema_version=1,owner_id="alice",local_id="synthetic-daily",device_id="synthetic-device",
            mutation_id=uid(902),crypto_epoch=0,base_head_version=0,base_revision_id=None,
            expected_inventory_revision_ids=[],note=dict(note_type="daily",title="Synthetic",content="Original",tags=None,source=None))
        result=note_v2.mutate(self.db,note,"put")
        self.assertEqual(note_v2.mutate(self.db,note,"put"),result)

    def test_two_concurrent_sessions_cannot_steal_the_same_ids(self):
        O=self.service(); S=self.models(); barrier=Barrier(2)
        engine=create_engine("sqlite:///file:wiki-op-"+uuid4().hex+"?mode=memory&cache=shared&uri=true",
                             connect_args={"check_same_thread":False})
        anchor=engine.connect()
        try:
            Base.metadata.create_all(engine)
            with Session(engine,autoflush=False) as db:
                db.add(UserAccount(owner_id="alice"));db.commit()
            a=request();b=copy.deepcopy(a);b["operation_id"]=uid(200)
            b["manifest_hash"]=digest({k:v for k,v in b.items() if k!="manifest_hash"})
            def reserve(value):
                with Session(engine,autoflush=False) as db:
                    barrier.wait(timeout=10)
                    try:O.reserve_operation(db,S.PrepareOperation.model_validate(value));return "prepared"
                    except HTTPException as exc:
                        self.assertEqual(exc.status_code,409);return "collision"
                    except OperationalError as exc:
                        # Shared-memory SQLite reports contention instead of waiting for a writer.
                        self.assertIn("locked",str(exc.orig));return "sqlite_busy"
            with ThreadPoolExecutor(max_workers=2) as pool:
                outcomes=list(pool.map(reserve,(a,b)))
            self.assertEqual(outcomes.count("prepared"),1)
            with Session(engine) as db:
                self.assertEqual(len(db.scalars(select(LibraryResource)).all()),1)
                self.assertEqual(len(db.scalars(select(LibraryMutation)).all()),4)
        finally:
            anchor.close();engine.dispose()


if __name__=="__main__":unittest.main()
