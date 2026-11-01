"""합성 메모리 DB의 I7c 계정 생성/잔존 소유 자료 경계."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import QueuePool

import test_wiki_operations_http_standalone as http
from app.db import Base
from app.models.note import UserAccount
from app.models.note_history import NoteRevision
from app.models.library import LibraryResource, LibraryMutation
from app.services import user_accounts as users


class OwnerReuseTest(unittest.TestCase):
    def setUp(self):
        self.fixture=http.HttpTest()
        if self._testMethodName=="test_concurrent_registration_requests_have_one_winner":
            # HTTP 경합만 검사하며 실제 PG의 독립 connection 경합과 구별한다.
            self.fixture.engine_options=dict(poolclass=QueuePool,pool_size=1,max_overflow=0,pool_timeout=10)
        self.fixture.setUp()
        self.client=self.fixture.client;self.engine=self.fixture.engine;self.db=self.fixture.db
        from app.core.config import get_settings
        self.settings=patch.multiple(get_settings(),self_registration_enabled=True,self_account_delete_enabled=True)
        self.settings.start()

    def tearDown(self):
        self.settings.stop();self.fixture.tearDown()

    def registration(self,owner,password="Synthetic!123",email="first@example.invalid"):
        return dict(owner_id=owner,password=password,email=email,device_id="owner-reuse-device")

    def register(self,owner,**values):
        return self.client.post("/api/v1/auth/register",json=self.registration(owner,**values))

    def state(self):
        with self.engine.connect() as connection:
            return {table.name:sorted((tuple(row) for row in connection.execute(select(table))),key=repr)
                    for table in Base.metadata.sorted_tables}

    def retired(self):
        owner="retired-"+uuid4().hex
        response=self.register(owner);self.assertEqual(response.status_code,200)
        token=response.json()["access_token"]
        body=dict(schema_version=1,owner_id=owner,device_id="owner-reuse-device",local_id="old-source",mutation_id=str(uuid4()),
            crypto_epoch=0,base_head_version=0,base_revision_id=None,expected_inventory_revision_ids=[],
            note=dict(note_type="daily",title="Synthetic",content="OLD_SYNTHETIC_PRIVATE_TEXT"))
        response=self.client.put("/api/v2/notes/current",json=body,headers={"X-Now-User-Token":token})
        self.assertEqual(response.status_code,200);revision=response.json()["result_revision_id"]
        response=self.client.post("/api/v1/auth/delete-account",json=dict(owner_id=owner,password="Synthetic!123"))
        self.assertEqual(response.status_code,200)
        return owner,revision,token

    def test_deleted_owner_cannot_register_new_credentials_and_read_old_revision(self):
        owner,revision,old_token=self.retired();before=self.state()
        response=self.register(owner,password="Different!456",email="second@example.invalid")
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json(),dict(detail="user already exists"))
        self.assertEqual(self.state(),before)
        with Session(self.engine) as db:
            self.assertIsNone(db.scalar(select(UserAccount).where(UserAccount.owner_id==owner)))
            self.assertIsNotNone(db.get(NoteRevision,revision))
        response=self.client.get("/api/v2/notes/revision",params=dict(owner_id=owner,local_id="old-source",
            revision_kind="note_revision",revision_id=revision),headers={"X-Now-User-Token":old_token})
        self.assertEqual(response.status_code,401)

    def test_history_only_owner_is_unavailable_without_mutating_history(self):
        owner="history-only"
        with Session(self.engine) as db:
            db.add(NoteRevision(id=str(uuid4()),owner_id=owner,local_id="gone",note_id=100,
                reason="write",snapshot_json='{"private":"synthetic"}'));db.commit()
        before=self.state()
        self.assertEqual(self.register(owner).status_code,409)
        self.assertEqual(self.state(),before)

    def test_library_wiki_operation_or_receipt_only_owner_is_unavailable(self):
        for index,kind in enumerate(("templates","wikis","wiki-operations","receipt")):
            with self.subTest(kind=kind):
                owner="library-only-"+str(index)
                with Session(self.engine) as db:
                    if kind=="receipt":
                        db.add(LibraryMutation(owner_id=owner,mutation_id=str(uuid4()),request_hash="a"*64,response_json='{"private":"synthetic"}'))
                    else:
                        db.add(LibraryResource(owner_id=owner,kind=kind,id=str(uuid4()),version=1,schema_version=1,
                            payload_json='{"private":"synthetic"}',created_at=datetime(2026,11,1),updated_at=datetime(2026,11,1)))
                    db.commit()
                before=self.state()
                response=self.register(owner)
                self.assertEqual(response.status_code,409)
                self.assertEqual(response.json(),dict(detail="user already exists"))
                self.assertEqual(self.state(),before)

    def test_implicit_legacy_creation_cannot_reclaim_retired_owner(self):
        owner,_,_=self.retired();before=self.state()
        with Session(self.engine,autoflush=False) as db:
            with self.assertRaises(HTTPException) as caught:users.touch_user_activity(db,owner_id=owner)
            self.assertEqual(caught.exception.status_code,409)
        from app.core.config import get_settings
        with patch.object(get_settings(),"user_token_required",False),Session(self.engine,autoflush=False) as db:
            with self.assertRaises(HTTPException) as caught:users.require_user_api_access(db,owner_id=owner)
            self.assertEqual(caught.exception.status_code,409)
        self.assertEqual(self.state(),before)

    def test_legacy_http_guard_preserves_existing_and_new_owner_policy(self):
        from app.core.config import get_settings
        owner,_,_=self.retired();before=self.state()
        with patch.object(get_settings(),"user_token_required",False):
            headers={"X-Now-Token":"synthetic-server-token"}
            response=self.client.get("/api/v1/notes",params=dict(owner_id=owner),headers=headers)
            self.assertEqual(response.status_code,409)
            self.assertEqual(response.json(),dict(detail="user already exists"))
            self.assertEqual(self.state(),before)
            self.assertEqual(self.client.get("/api/v1/notes",params=dict(owner_id="fresh-legacy-http"),headers=headers).status_code,200)
            self.fixture.bundle()
            self.assertEqual(self.client.get("/api/v1/notes",params=dict(owner_id="alice"),headers=headers).status_code,200)
            with Session(self.engine) as db:
                self.assertEqual(users.require_active_user(db,owner_id="alice").owner_id,"alice")

    def test_service_admin_and_monitor_share_the_same_creation_guard(self):
        from app.api import monitor
        owner,_,_=self.retired();before=self.state()
        with Session(self.engine,autoflush=False) as db:
            self.assertIsNone(users.create_user_account(db,owner_id="  "+owner+"  ",password="Different!456"))
        response=self.client.post("/api/v1/admin/users",json=self.registration(owner),headers={"X-Now-Token":"synthetic-server-token"})
        self.assertEqual(response.status_code,409)
        self.assertEqual(response.json(),dict(detail="user already exists or owner_id is empty"))
        with patch.object(monitor,"SessionLocal",lambda:Session(self.engine,autoflush=False)):
            response=self.client.post("/admin/users/new",data=self.registration(owner),auth=("qa","synthetic-server-token"),follow_redirects=False)
        self.assertEqual(response.status_code,303)
        self.assertEqual(self.state(),before)

    def test_new_registration_login_and_existing_touch_stay_available(self):
        owner="new-"+uuid4().hex
        self.assertEqual(self.register(owner).status_code,200)
        login=self.client.post("/api/v1/auth/web-login",json=dict(owner_id=owner,password="Synthetic!123"))
        self.assertEqual(login.status_code,200)
        response=self.client.get("/api/v1/auth/web-session",params=dict(owner_id=owner),
            headers={"X-Now-Web-Session":login.json()["session_token"]})
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.register(owner).json(),dict(detail="user already exists"))
        with Session(self.engine,autoflush=False) as db:
            self.assertEqual(users.touch_user_activity(db,owner_id=owner).owner_id,owner)
            db.commit()
            self.assertEqual(users.touch_user_activity(db,owner_id="fresh-legacy").owner_id,"fresh-legacy")
            db.commit()

    def test_same_transaction_pending_account_cannot_be_created_twice(self):
        with Session(self.engine,autoflush=False) as db:
            first=users.create_user_account(db,owner_id="pending-owner",password="Synthetic!123")
            second=users.create_user_account(db,owner_id="pending-owner",password="Different!456")
            self.assertIsNotNone(first);self.assertIsNone(second)
            db.commit()

    def test_existing_touch_preserves_unflushed_profile_changes(self):
        with Session(self.engine,autoflush=False) as db:
            user=db.scalar(select(UserAccount).where(UserAccount.owner_id=="alice"))
            user.display_name="Pending synthetic name";user.is_active=0
            touched=users.touch_user_activity(db,owner_id="alice")
            self.assertEqual(touched.display_name,"Pending synthetic name")
            self.assertEqual(touched.is_active,0)

    def test_pending_owner_data_prevents_creation_without_flush(self):
        with Session(self.engine,autoflush=False) as db:
            db.add(NoteRevision(id=str(uuid4()),owner_id="pending-history",local_id="old",note_id=1,
                                reason="write",snapshot_json="{}"))
            self.assertIsNone(users.create_user_account(db,owner_id="pending-history"))

    def test_id_without_any_retained_owner_data_can_be_registered_again(self):
        owner="empty-"+uuid4().hex
        self.assertEqual(self.register(owner).status_code,200)
        self.assertEqual(self.client.post("/api/v1/auth/delete-account",json=dict(owner_id=owner,password="Synthetic!123")).status_code,200)
        self.assertEqual(self.register(owner,password="Different!456",email="new@example.invalid").status_code,200)

    def test_concurrent_registration_requests_have_one_winner(self):
        barrier=Barrier(2);owner="race-"+uuid4().hex
        def attempt(index):
            barrier.wait(timeout=10)
            return self.register(owner,email="race"+str(index)+"@example.invalid").status_code
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(attempt,(1,2)))
        self.assertEqual(sorted(results),[200,409])

    def test_verified_wiki_backup_restores_accounts_and_data_to_empty_database(self):
        from app.services import wiki_operations,note_backup
        p,c=self.fixture.bundle();wiki_operations.prepare_operation(self.db,p)
        wiki_operations.commit_operation(self.db,p.operation_id,c)
        backup=note_backup.export_snapshot(self.db)
        empty=create_engine("sqlite:///:memory:")
        try:
            note_backup.restore_empty(empty,backup)
            with Session(empty) as db:
                self.assertIsNotNone(db.scalar(select(UserAccount).where(UserAccount.owner_id=="alice")))
                self.assertEqual(wiki_operations.get_operation(db,"alice",p.operation_id)["state"],"committed")
        finally:empty.dispose()

    def test_each_owner_bearing_table_independently_reserves_the_id(self):
        # 존재만 검사하는 경계이므로 본문 해석이나 보호 상태의 유효성과 구별한다.
        for table in Base.metadata.sorted_tables:
            if table.name=="user_accounts":continue
            owner_key=next((key for key in ("owner_id","sender_owner_id","created_by") if key in table.c),None)
            if owner_key is None:continue
            with self.subTest(table=table.name):
                owner="reserved-"+table.name
                values={owner_key:owner}
                for col in table.c:
                    if col.name in values or col.nullable or col.default is not None or col.server_default is not None:continue
                    if col.primary_key and isinstance(col.type,Integer) and len(table.primary_key.columns)==1:continue
                    values[col.name]=(datetime(2026,11,1) if isinstance(col.type,DateTime) else b"synthetic" if isinstance(col.type,LargeBinary)
                        else False if isinstance(col.type,Boolean) else 1 if isinstance(col.type,Integer) else "a"*64 if getattr(col.type,"length",0)==64 else str(uuid4()) if getattr(col.type,"length",0)==36 else "synthetic")
                with self.engine.begin() as connection:connection.execute(table.insert().values(**values))
                before=self.state()
                with Session(self.engine,autoflush=False) as db:
                    self.assertIsNone(users.create_user_account(db,owner_id=owner))
                self.assertEqual(self.state(),before)
