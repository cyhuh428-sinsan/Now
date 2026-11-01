"""명시 실행 전용 I7 PG QA. 자동 pytest 수집/기본 DB 접속은 하지 않는다."""
import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from uuid import uuid4

CONFIRM="CREATE_AND_DROP_I7_QA_SCHEMA"
URL_ENV="NOW_I7_QA_POSTGRES_URL"
PREFIX="nownote_i7_qa_"


def require(condition,code):
    if not condition:
        raise RuntimeError(code)


def main(argv=None):
    parser=argparse.ArgumentParser(description="I7 전용 PG schema 생성·검사·정리. URL은 NOW_I7_QA_POSTGRES_URL 환경변수만 사용합니다.")
    parser.add_argument("--confirm",help=CONFIRM)
    args=parser.parse_args(argv)
    if args.confirm!=CONFIRM or not os.environ.get(URL_ENV):
        print(json.dumps(dict(status="REFUSED",code="explicit_qa_url_and_confirmation_required")))
        return 2

    # 제품의 기본 DB는 이 명시 fixture에서 절대 연결하지 않는다.
    os.environ["NOW_DATABASE_URL"]="sqlite:///:memory:"
    sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
    try:
        from sqlalchemy import CheckConstraint, create_engine, event, func, inspect, select
        from sqlalchemy.engine import make_url
        from sqlalchemy.schema import CreateSchema, DropSchema, AddConstraint, DropConstraint
        url=make_url(os.environ[URL_ENV])
        require(url.get_backend_name()=="postgresql" and bool(url.database) and bool(url.host),"postgresql_url_required")
        url=url.set(drivername="postgresql+psycopg")
    except Exception:
        print(json.dumps(dict(status="REFUSED",code="postgresql_url_required")))
        return 2

    schema=PREFIX+uuid4().hex
    require(re.fullmatch(PREFIX+r"[0-9a-f]{32}",schema) is not None,"invalid_qa_schema")
    admin=None;engine=None;client=None;app=None;created=False;cleaned=False;checks=[]
    failed=False;step="initialize"
    try:
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        from fastapi.testclient import TestClient
        from sqlalchemy.orm import Session
        from app.db import Base,get_db,engine as default_engine
        from app.main import create_app
        from app.core.config import get_settings
        from app.models.note import UserAccount,Note
        from app.models.note_history import NoteHead,NoteRevision,NoteInventory
        from app.models.note_v2 import NoteMutation
        from app.models.library import LibraryResource,LibraryMutation
        from app.schemas.note_v2 import PutNote
        from app.schemas.wiki import digest
        from app.schemas.wiki_operations import PrepareOperationV2 as PrepareOperation,CommitOperation
        from app.services.note_crypto import initialize_identity
        from app.services.note_mixed_metadata import initialize
        from app.services.related_text import initialize as initialize_linked
        from app.services.user_accounts import issue_user_device_access_token
        from test_wiki_operations_standalone import request
        from test_wiki_v2_standalone import draft,artifact,seal,approval

        options="-c lock_timeout=10000 -c statement_timeout=30000"
        admin=create_engine(url,connect_args=dict(options=options,connect_timeout=10))
        step="create_schema"
        with admin.begin() as connection:
            require(connection.dialect.name=="postgresql","postgresql_required")
            require(not inspect(connection).has_schema(schema),"schema_already_exists")
            connection.execute(CreateSchema(schema));created=True
        engine=create_engine(url,connect_args=dict(options=options+" -c search_path="+schema,connect_timeout=10),
                             execution_options=dict(schema_translate_map={None:schema}))
        with engine.begin() as connection:
            require(connection.exec_driver_sql("SELECT current_schema()").scalar()==schema,"schema_scope_mismatch")
            require(all(table.schema is None for table in Base.metadata.tables.values()),"explicit_model_schema_forbidden")
            Base.metadata.create_all(connection)
            initialize_identity(connection);initialize_linked(connection);initialize(connection)

        owner=schema;device="i7-pg-device"
        with Session(engine,autoflush=False) as db:
            db.add(UserAccount(owner_id=owner,group_name="synthetic"));db.commit()
            _,token=issue_user_device_access_token(db,owner_id=owner,device_id=device);db.commit()
        settings=get_settings()
        headers={"X-Now-User-Token":token}
        if settings.api_token:
            headers["X-Now-Token"]=settings.api_token
        app=create_app()
        connection_barrier=None;race_connections=[]
        def backend():
            with Session(engine,autoflush=False) as db:
                if connection_barrier is not None:
                    race_connections.append(db.scalar(select(func.pg_backend_pid())))
                    connection_barrier.wait(timeout=10)
                yield db
        app.dependency_overrides[get_db]=backend
        # Startup의 기본 DB 초기화 대신 위에서 자기 schema만 초기화한다.
        client=TestClient(app,raise_server_exceptions=False)
        root="/api/v1/wiki-operations"

        def post(path,body,status=200):
            response=client.post(root+path,json=body.model_dump() if hasattr(body,"model_dump") else body,headers=headers)
            require(response.status_code==status,"unexpected_http_status")
            require(response.headers.get("cache-control")=="no-store","missing_no_store")
            return response.json()
        def status(p):
            response=client.get(root+"/"+p.operation_id,params=dict(owner_id=owner),headers=headers)
            require(response.status_code==200,"status_failed")
            require(response.headers.get("cache-control")=="no-store","missing_no_store")
            return response.json()
        def abort(p):
            return dict(schema_version=1,owner_id=owner,device_id=device,mutation_id=p.abort_mutation_id,manifest_hash=p.manifest_hash)
        def fresh(value):
            value["schema_version"]=2
            value.update(operation_id=str(uuid4()),mutation_id=str(uuid4()),commit_mutation_id=str(uuid4()),abort_mutation_id=str(uuid4()))
            for change in value["changes"]:change["note_mutation_id"]=str(uuid4())
            value["manifest_hash"]=digest({k:v for k,v in value.items() if k!="manifest_hash"})
            return PrepareOperation.model_validate(value)
        def envelope(p,documents):
            return CommitOperation(schema_version=1,owner_id=owner,device_id=device,mutation_id=p.commit_mutation_id,
                                   manifest_hash=p.manifest_hash,documents=documents)
        def bundle(count=1):
            local="i7-source-"+uuid4().hex
            body=PutNote(schema_version=1,owner_id=owner,device_id=device,local_id=local,mutation_id=str(uuid4()),
                crypto_epoch=0,base_head_version=0,base_revision_id=None,expected_inventory_revision_ids=[],
                note=dict(note_type="daily",title="Synthetic",content="Exact quote",tags=None,source=None))
            response=client.put("/api/v2/notes/current",json=body.model_dump(),headers=headers)
            require(response.status_code==200,"source_create_failed")
            current=response.json()
            value=request(owner=owner);value["device_id"]=device
            value["inputs"][0].update(note_ref=dict(owner_id=owner,local_id=local),source_revision_id=current["result_revision_id"],
                                      head_version=current["result_head_version"],content_hash=hashlib.sha256(b"Exact quote").hexdigest())
            value["changes"]=[];value["draft_bindings"]=[];documents=[]
            for _ in range(count):
                wiki=str(uuid4());d=draft();d.update(id=str(uuid4()),generation_id=str(uuid4()),scope=dict(url="https://qa.invalid",owner=owner))
                d["evidence_manifest"]=value["inputs"];seal(d)
                doc=artifact(d);doc["wiki_id"]=wiki
                value["changes"].append(dict(wiki_id=wiki,action="create_draft",note_mutation_id=str(uuid4()),base_head_revision_id=None,
                    base_head_version=0,base_index_version=0,base_document_version=0,result_document_hash=digest(doc)))
                value["draft_bindings"].append(dict(wiki_id=wiki,draft_id=d["id"],draft_hash=d["draft_hash"]))
                documents.append(dict(wiki_id=wiki,document=doc))
            value["changes"].sort(key=lambda x:x["wiki_id"]);value["draft_bindings"].sort(key=lambda x:(x["wiki_id"],x["draft_id"]))
            documents.sort(key=lambda x:x["wiki_id"])
            p=fresh(value)
            return p,envelope(p,documents)
        def commit(p,c,status_code=200):return post("/"+p.operation_id+"/commit",c,status_code)
        def state():
            with engine.connect() as connection:
                return {m.__tablename__:sorted((tuple(row) for row in connection.execute(select(m.__table__))),key=repr)
                    for m in (Note,NoteHead,NoteRevision,NoteInventory,LibraryResource,LibraryMutation,NoteMutation)}

        step="two_page_commit_replay"
        p,c=bundle(2);post("/prepare",p);first=commit(p,c)
        require(first["state"]=="committed" and len(first["pages"])==2,"two_page_commit_failed")
        before=state()
        require(status(p)["receipt"]==first and commit(p,c)==first,"original_receipt_mismatch")
        require(state()==before,"replay_reapplied_publication")
        require("Exact quote" not in json.dumps(status(p)),"status_contains_plaintext")
        post("/"+p.operation_id+"/abort",abort(p),409)
        checks.append(step)

        step="second_page_constraint_rollback"
        p,c=bundle(2);post("/prepare",p)
        constraint=CheckConstraint(Note.__table__.c.local_id!="wiki:"+p.changes[1].wiki_id,name="i7_qa_second_page_failure")
        inserted=[];violations=[]
        def observe_insert(connection,cursor,statement,parameters,context,executemany):
            compiled=getattr(context,"compiled",None)
            sql=getattr(compiled,"statement",None)
            if getattr(sql,"is_insert",False) and sql.table.name==Note.__tablename__:
                inserted.extend(item.get("local_id") for item in context.compiled_parameters)
        def observe_error(context):
            original=context.original_exception
            if getattr(original,"sqlstate",None)=="23514" and getattr(getattr(original,"diag",None),"constraint_name",None)==constraint.name:
                violations.append(True)
        event.listen(engine,"after_cursor_execute",observe_insert)
        event.listen(engine,"handle_error",observe_error)
        try:
            with engine.begin() as connection:connection.execute(AddConstraint(constraint))
            before=state();result=commit(p,c,500)
            require(result==dict(detail=dict(code="internal_error")),"unsafe_execution_error")
            require("wiki:"+p.changes[0].wiki_id in inserted and bool(violations),"second_page_constraint_not_observed")
            require(state()==before and status(p)["state"]=="prepared","partial_publication")
        finally:
            event.remove(engine,"after_cursor_execute",observe_insert)
            event.remove(engine,"handle_error",observe_error)
            with engine.begin() as connection:connection.execute(DropConstraint(constraint))
            Note.__table__.constraints.remove(constraint)
        checks.append(step)

        step="source_stale"
        p,c=bundle();post("/prepare",p);ref=p.inputs[0]
        response=client.put("/api/v2/notes/current",headers=headers,json=dict(schema_version=1,owner_id=owner,device_id=device,
            local_id=ref.note_ref.local_id,mutation_id=str(uuid4()),crypto_epoch=0,base_head_version=ref.head_version,
            base_revision_id=ref.source_revision_id,expected_inventory_revision_ids=[ref.source_revision_id],
            note=dict(note_type="daily",title="Synthetic",content="Changed")))
        require(response.status_code==200,"source_update_failed")
        require(commit(p,c,409)["detail"]["code"]=="wiki_source_changed" and status(p)["state"]=="prepared","stale_source_accepted")
        checks.append(step)

        step="target_stale"
        p,c=bundle();post("/prepare",p);result=commit(p,c)["pages"][0]
        plans=[]
        for _ in range(2):
            doc=c.documents[0].document.model_dump();doc["document_version"]+=1
            approved=approval(doc["drafts"][0]);approved.update(id=str(uuid4()),approved_by=owner);doc["approvals"].append(approved)
            value=p.model_dump();value["draft_bindings"]=[]
            value["changes"][0].update(action="approve_draft",base_head_revision_id=result["result_revision_id"],
                base_head_version=result["result_head_version"],base_index_version=result["index_version"],
                base_document_version=result["document_version"],result_document_hash=digest(doc))
            prepared=fresh(value);plans.append((prepared,envelope(prepared,[dict(wiki_id=doc["wiki_id"],document=doc)])))
            post("/prepare",prepared)
        commit(*plans[0])
        require(commit(*plans[1],status_code=409)["detail"]["code"]=="wiki_target_changed","stale_target_accepted")
        require(status(plans[1][0])["state"]=="prepared","stale_target_state_changed")
        checks.append(step)

        step="explicit_abort"
        p,c=bundle();post("/prepare",p);result=post("/"+p.operation_id+"/abort",abort(p))
        require(result["state"]=="aborted" and post("/"+p.operation_id+"/abort",abort(p))==result,"abort_replay_failed")
        require(commit(p,c,409)["detail"]["code"]=="operation_aborted","aborted_commit_accepted")
        checks.append(step)

        step="commit_abort_race"
        p,c=bundle();post("/prepare",p);barrier=Barrier(2)
        def race(action):
            barrier.wait(timeout=10)
            path="/"+p.operation_id+"/"+action
            body=c.model_dump() if action=="commit" else abort(p)
            response=client.post(root+path,json=body,headers=headers)
            require(response.status_code in (200,409),"race_request_failed")
            return response.status_code,response.json()
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(race,("commit","abort")))
        require(sorted(code for code,_ in results)==[200,409],"multiple_terminal_results")
        winner=next(body for code,body in results if code==200)
        loser=next(body for code,body in results if code==409)
        require(loser["detail"]["code"]==("operation_already_committed" if winner["state"]=="committed" else "operation_aborted"),"incorrect_terminal_conflict")
        require(status(p)["state"]==winner["state"] and status(p)["receipt"]==winner,"race_receipt_mismatch")
        checks.append(step)

        step="retired_owner_registration_guard"
        retired=schema+"-retired";password="Synthetic!123"
        registration=dict(owner_id=retired,password=password,email="first@example.invalid",device_id=device)
        registered=client.post("/api/v1/auth/register",json=registration)
        require(registered.status_code==200,"registration_failed")
        login=client.post("/api/v1/auth/web-login",json=dict(owner_id=retired,password=password))
        require(login.status_code==200,"normal_login_failed")
        retired_headers={**headers,"X-Now-User-Token":registered.json()["access_token"]}
        note=PutNote(schema_version=1,owner_id=retired,device_id=device,local_id="retired-source",mutation_id=str(uuid4()),
            crypto_epoch=0,base_head_version=0,base_revision_id=None,expected_inventory_revision_ids=[],
            note=dict(note_type="daily",title="Synthetic",content="I7_OWNER_REUSE_SYNTHETIC"))
        written=client.put("/api/v2/notes/current",json=note.model_dump(),headers=retired_headers)
        require(written.status_code==200,"retired_source_write_failed")
        revision_id=written.json()["result_revision_id"]
        deleted=client.post("/api/v1/auth/delete-account",json=dict(owner_id=retired,password=password))
        require(deleted.status_code==200,"account_deletion_failed")
        before=state()
        denied=client.post("/api/v1/auth/register",json={**registration,"password":"Different!456","email":"second@example.invalid"})
        require(denied.status_code==409 and denied.json()==dict(detail="user already exists"),"retired_owner_reassigned")
        require(state()==before,"retained_owner_data_changed")
        with Session(engine) as db:
            require(db.scalar(select(UserAccount).where(UserAccount.owner_id==retired)) is None,"retired_account_recreated")
            require(db.get(NoteRevision,revision_id) is not None,"retired_revision_lost")
        denied=client.get("/api/v2/notes/revision",headers=retired_headers,params=dict(owner_id=retired,local_id="retired-source",
            revision_kind="note_revision",revision_id=revision_id))
        require(denied.status_code==401,"old_token_still_reads_retired_history")
        checks.append(step)

        step="same_owner_registration_race"
        race_owner=schema+"-race";connection_barrier=Barrier(2)
        def register(index):
            return client.post("/api/v1/auth/register",json=dict(owner_id=race_owner,password=password,
                email="race"+str(index)+"@example.invalid",device_id=device+str(index)))
        try:
            with ThreadPoolExecutor(max_workers=2) as pool:responses=list(pool.map(register,(1,2)))
        finally:
            connection_barrier=None
        require(len(set(race_connections))==2,"registration_race_needs_independent_connections")
        require(sorted(response.status_code for response in responses)==[200,409],"registration_race_not_serialized")
        require(next(response for response in responses if response.status_code==409).json()==dict(detail="user already exists"),"unsafe_registration_conflict")
        with Session(engine) as db:
            require(len(db.scalars(select(UserAccount).where(UserAccount.owner_id==race_owner)).all())==1,"duplicate_registered_owner")
        checks.append(step)
    except Exception:
        failed=True
    finally:
        for cleanup in (client.close if client is not None else None,
                        app.dependency_overrides.clear if app is not None else None,
                        engine.dispose if engine is not None else None):
            try:
                if cleanup is not None:cleanup()
            except Exception:
                failed=True
        if created and admin is not None:
            try:
                with admin.begin() as connection:
                    if inspect(connection).has_schema(schema):connection.execute(DropSchema(schema,cascade=True))
                with admin.connect() as connection:require(not inspect(connection).has_schema(schema),"schema_remains")
                cleaned=True
            except Exception:
                failed=True
        for resource in (admin,locals().get("default_engine")):
            try:
                if resource is not None:resource.dispose()
            except Exception:
                failed=True
    result=dict(status="FAIL" if failed else "PASS",step=step,checks=checks,schema=schema,
                schema_created=created,cleanup="removed" if cleaned else "not_created" if not created else "FAILED")
    print(json.dumps(result,sort_keys=True))
    return int(failed)


if __name__=="__main__":
    raise SystemExit(main())
