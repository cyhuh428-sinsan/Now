"""Real auth and disposable SQLite for wiki publication/branch boundaries."""
import json
import pytest
from copy import deepcopy
from uuid import uuid4
from sqlalchemy import select
from .test_note_v2 import subject, body, based, get_current
from .test_wiki_artifact import artifact, digest

def text_hash(value):
    import hashlib
    return hashlib.sha256(value.encode()).hexdigest()

def make(client,s):
    source=body(s,"wiki-source","Original quote")
    assert client.put("/api/v2/notes/current",json=source,headers=s["headers"]).status_code==200
    current=get_current(client,s,"wiki-source")
    doc=artifact();doc["scope"]["owner"]=s["owner"]
    draft=doc["drafts"][0];draft["scope"]=deepcopy(doc["scope"])
    draft["source_manifest"][0].update(note_ref={"owner_id":s["owner"],"local_id":"wiki-source"},
        source_revision_id=current["head_revision_id"],head_version=current["head_version"],content_hash=text_hash("Original quote"))
    draft["draft_hash"]=digest({k:v for k,v in draft.items() if k!="draft_hash"})
    request=body(s,"wiki:"+doc["wiki_id"],json.dumps(doc,ensure_ascii=False))
    request["note"].update(note_type="tree",title="AI Wiki "+doc["wiki_id"],parent_local_id=None,level=1,
        tags=None,source="wiki-artifact",deleted_at=None)
    return source,doc,request,f'/api/v1/wikis/{doc["wiki_id"]}'

def approved(doc,owner):
    value=deepcopy(doc);value["document_version"]+=1;draft=value["drafts"][0]
    value["approvals"].append({"id":str(uuid4()),"parent_approved_revision_id":None,"draft_id":draft["id"],
        "draft_hash":draft["draft_hash"],"source_manifest_hash":digest(draft["source_manifest"]),
        "approved_by":owner,"approved_at":"2026-10-31T01:00:00Z"})
    return value

def put(client,s,path,request):
    return client.put(path+"/current",json=request,headers=s["headers"])

def test_wiki_creation_and_approval_are_atomic_and_receipts_contain_no_text(client,subject):
    s=subject
    _,doc,request,path=make(client,s)
    first=put(client,s,path,request);assert first.status_code==200,first.text
    update=based(request,get_current(client,s,request["local_id"]))
    update["note"]["content"]=json.dumps(approved(doc,s["owner"]),ensure_ascii=False)
    second=put(client,s,path,update);assert second.status_code==200,second.text
    assert put(client,s,path,request).json()==first.json()
    result=client.get(path,params={"owner_id":s["owner"]},headers=s["headers"])
    assert result.status_code==200,result.text
    assert result.json()["artifact"]["document"]["approvals"][0]["draft_id"]==doc["drafts"][0]["id"]
    assert set(result.json()["resource"]["payload"])=={"artifact_local_id","dependencies"}
    from app.models.library import LibraryMutation,LibraryResource
    from app.models.note_v2 import NoteMutation
    s["db"].expire_all()
    rows=list(s["db"].scalars(select(LibraryResource).where(LibraryResource.owner_id==s["owner"],LibraryResource.kind=="wikis")))
    assert len(rows)==1
    ledger=" ".join(row.conditions_json+row.result_json for row in s["db"].scalars(select(NoteMutation).where(NoteMutation.owner_id==s["owner"])))
    ledger+=" ".join(row.response_json for row in s["db"].scalars(select(LibraryMutation).where(LibraryMutation.owner_id==s["owner"])))
    assert "Generated body" not in rows[0].payload_json+ledger
    assert "Original quote" not in rows[0].payload_json+ledger

def test_current_approval_rechecks_sources_and_preserves_previous_wiki(client,subject):
    s=subject
    source,doc,request,path=make(client,s)
    assert put(client,s,path,request).status_code==200
    old=get_current(client,s,request["local_id"])
    source=based(source,get_current(client,s,"wiki-source"));source["note"]["content"]="Changed source"
    assert client.put("/api/v2/notes/current",json=source,headers=s["headers"]).status_code==200
    update=based(request,old);update["note"]["content"]=json.dumps(approved(doc,s["owner"]),ensure_ascii=False)
    response=put(client,s,path,update)
    assert response.status_code==409,response.text
    assert response.json()["detail"]["code"]=="wiki_source_changed"
    assert get_current(client,s,request["local_id"])["snapshot"]["note"]["content"]==request["note"]["content"]

def test_new_wiki_draft_rejects_invented_quote_and_foreign_scope(client,subject):
    s=subject
    _,doc,request,path=make(client,s)
    doc["drafts"][0]["citations"][0]["quote"]="Not in original"
    doc["drafts"][0]["draft_hash"]=digest({k:v for k,v in doc["drafts"][0].items() if k!="draft_hash"})
    request["note"]["content"]=json.dumps(doc)
    response=put(client,s,path,request)
    assert response.status_code==422,response.text
    assert "Not in original" not in response.text
    assert client.get(path,params={"owner_id":s["owner"]},headers=s["headers"]).status_code==404
    request["owner_id"]=s["other"]
    assert put(client,s,path,request).status_code in (401,403)

def test_future_approval_branch_reserves_dependencies_but_does_not_publish(client,subject):
    s=subject
    _,doc,request,path=make(client,s)
    entries=[];previous=None
    for candidate in (doc,approved(doc,s["owner"])):
        ident=str(uuid4())
        note={"id":None,"owner_id":s["owner"],"local_id":request["local_id"],"device_id":"actor",
            **request["note"],"content":json.dumps(candidate),"created_at":"2026-10-31T00:00:00Z",
            "updated_at":"2026-10-31T00:00:00Z","client_updated_at":None}
        entries.append({"revision_id":ident,"parent_ref":{"kind":"offline_branch","id":previous} if previous else None,
            "snapshot":{"schema_version":1,"note":note}})
        previous=ident
    imported={k:request[k] for k in ("schema_version","owner_id","local_id","device_id","mutation_id","crypto_epoch")}
    imported["entries"]=entries
    response=client.post(path+"/revisions/import",json=imported,headers=s["headers"])
    assert response.status_code==200,response.text
    view=client.get(path,params={"owner_id":s["owner"]},headers=s["headers"]).json()
    assert view["artifact"]["current_exists"] is False
    assert view["artifact"]["document"] is None
    assert view["resource"]["payload"]["dependencies"]==[{"owner_id":s["owner"],"local_id":"wiki-source"}]
    from .test_note_crypto import prepare_body,ROOT
    protection=client.post(ROOT,json=prepare_body(client,s,"wiki-source"),headers=s["headers"])
    assert protection.status_code==409,protection.text
    assert protection.json()["detail"]["code"]=="wiki_protection_required"
    from app.services.note_backup import export_snapshot,validate_backup
    from app.api.admin import _backup_content_sha256
    backup=export_snapshot(s["db"])
    backup["items"]["library_resources"]=[]
    backup["items"]["library_mutations"]=[]
    for section in ("library_resources","library_mutations"):
        backup["summary"][section]=backup["section_counts"][section]=0
    backup["content_sha256"]=_backup_content_sha256({k:v for k,v in backup.items() if k!="content_sha256"})
    with pytest.raises(ValueError,match="backup_wiki_index"):
        validate_backup(backup)

def test_generic_note_writes_cannot_bypass_wiki_review(client,subject):
    s=subject
    _,_,request,path=make(client,s)
    assert put(client,s,path,request).status_code==200
    replacement=based(request,get_current(client,s,request["local_id"]))
    replacement["note"]["content"]="Bypass review"
    response=client.put("/api/v2/notes/current",json=replacement,headers=s["headers"])
    assert response.status_code==409,response.text
    assert response.json()["detail"]["code"]=="wiki_review_required"
    assert get_current(client,s,request["local_id"])["snapshot"]["note"]["content"]==request["note"]["content"]


def test_protecting_all_wiki_history_allows_source_protection(client,subject):
    from .test_note_crypto import ROOT, prepare_body
    from .test_note_crypto_conversion import convert, read_all
    from app.services.wiki_guards import fully_protected
    s=subject
    _,doc,request,path=make(client,s)
    assert put(client,s,path,request).status_code==200
    update=based(request,get_current(client,s,request["local_id"]))
    update["note"]["content"]=json.dumps(approved(doc,s["owner"]),ensure_ascii=False)
    assert put(client,s,path,update).status_code==200
    denied=client.post(ROOT,json=prepare_body(client,s,"wiki-source"),headers=s["headers"])
    assert denied.status_code==409,denied.text
    assert denied.json()["detail"]["code"]=="wiki_protection_required"
    convert(client,s,request["local_id"])
    s["db"].expire_all()
    assert fully_protected(s["db"],s["owner"],request["local_id"])
    _,items,_=read_all(client,s,request["local_id"])
    assert items
    convert(client,s,"wiki-source")
    s["db"].expire_all()
    assert fully_protected(s["db"],s["owner"],"wiki-source")
    from app.services.note_backup import export_snapshot,validate_backup
    s["db"].rollback()
    backup=export_snapshot(s["db"])
    validate_backup(backup)
    assert "Original quote" not in json.dumps(backup)
    assert "Generated body" not in json.dumps(backup)
    result=client.get(path,params={"owner_id":s["owner"]},headers=s["headers"])
    assert result.status_code==200,result.text
    assert result.json()["artifact"]["document"] is None


def test_wiki_backup_validates_index_dependencies_and_roundtrips_empty_database(client,subject,tmp_path):
    from app.services.note_backup import export_snapshot,validate_backup,restore_empty
    from app.api.admin import _backup_content_sha256
    from app.db import Base
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.models.library import LibraryResource
    s=subject
    _,_,request,path=make(client,s)
    assert put(client,s,path,request).status_code==200
    from app.services.note_crypto import initialize_identity
    initialize_identity(s["db"].connection());s["db"].commit()
    backup=export_snapshot(s["db"])
    validate_backup(backup)
    damaged=deepcopy(backup)
    index=next(row for row in damaged["items"]["library_resources"] if row["kind"]=="wikis")
    value=json.loads(index["payload_json"])
    value["dependencies"]=[{"owner_id":s["owner"],"local_id":"unrelated-source"}]
    index["payload_json"]=json.dumps(value)
    damaged["content_sha256"]=_backup_content_sha256({k:v for k,v in damaged.items() if k!="content_sha256"})
    with pytest.raises(ValueError):
        validate_backup(damaged)
    target=create_engine(f"sqlite:///{tmp_path / 'wiki-restore.db'}")
    try:
        Base.metadata.create_all(target)
        restore_empty(target,backup)
        with Session(target) as restored:
            row=restored.get(LibraryResource,(s["owner"],"wikis",path.rsplit("/",1)[1]))
            assert json.loads(row.payload_json)["dependencies"]==[{"owner_id":s["owner"],"local_id":"wiki-source"}]
            from app.services.wikis import get
            view=get(restored,s["owner"],row.id)
            assert view["artifact"]["document"]["drafts"][0]["sections"]
    finally:
        target.dispose()


def test_wiki_index_cannot_be_restored_without_its_note_history(client,subject):
    from app.services.library_backup import export_library,restore_library
    s=subject
    _,_,request,path=make(client,s)
    assert put(client,s,path,request).status_code==200
    backup={"backup_schema_version":2,"items":export_library(s["db"])}
    with pytest.raises(ValueError,match="wiki_requires_v3_backup"):
        restore_library(s["db"],backup)


def test_wiki_artifact_is_not_a_legacy_tree_or_group_search_result(client,subject):
    from app.services.user_accounts import issue_web_session
    s=subject
    _,_,request,path=make(client,s)
    assert put(client,s,path,request).status_code==200
    _,peer=issue_web_session(s["db"],owner_id=s["other"]);s["db"].commit()
    for owner,headers in ((s["owner"],s["headers"]),(s["owner"],s["web"]),
                           (s["other"],{"X-Now-Web-Session":peer})):
        notes=client.get("/api/v1/notes",params={"owner_id":owner},headers=headers)
        assert notes.status_code==200,notes.text
        assert request["local_id"] not in [row["local_id"] for row in notes.json()]
        search=client.get("/api/v1/notes/search",params={"owner_id":owner,"q":"Original quote"},headers=headers)
        assert search.status_code==200,search.text
        assert request["local_id"] not in [row["local_id"] for row in search.json()]
    response=client.post("/api/v1/sync",json={"owner_id":s["owner"],"device_id":"actor","notes":[]},
                         headers=s["headers"])
    assert response.status_code==200,response.text
    assert request["local_id"] not in [row["local_id"] for row in response.json()["pulled_notes"]]
    legacy={"owner_id":s["owner"],"local_id":request["local_id"],"device_id":"actor",**request["note"]}
    response=client.post("/api/v1/notes",json=legacy,headers=s["headers"])
    assert response.status_code==409,response.text
    assert response.json()["detail"]["code"]=="wiki_review_required"


def test_wiki_whole_mixed_conversion_and_key_rotation_are_allowed(client,subject,monkeypatch):
    from app.core import capabilities
    from .test_note_mixed import ready_rc,cp_request
    from .test_note_crypto_conversion import convert
    from app.services.wiki_guards import fully_protected
    monkeypatch.setattr(capabilities,"MIXED_MUTATIONS_ENABLED",True)
    s=subject
    _,_,request,path=make(client,s)
    assert put(client,s,path,request).status_code==200
    convert(client,s,request["local_id"])
    for epoch in (2,3):
        _,_,_,commit,_=ready_rc(client,s,request["local_id"])
        response=client.post("/api/v2/notes/mixed-conversions/commit",json=commit,headers=s["headers"])
        assert response.status_code==200,response.text
        assert response.json()["receipt"]["result"]["base"]["crypto_epoch"]==epoch
        s["db"].expire_all()
        assert fully_protected(s["db"],s["owner"],request["local_id"])
    cp=cp_request(client,s,request["local_id"])
    denied=client.post("/api/v2/notes/current-plain/quote",json=cp,headers=s["headers"])
    assert denied.status_code==409,denied.text
    assert denied.json()["detail"]["code"]=="wiki_review_required"


def test_source_commit_original_receipt_survives_later_wiki_rotation(client,subject):
    from .test_note_crypto import ROOT,prepare
    from .test_note_crypto_conversion import convert
    s=subject
    _,_,request,path=make(client,s)
    assert put(client,s,path,request).status_code==200
    convert(client,s,request["local_id"])
    commit,original,_,_=convert(client,s,"wiki-source")
    prepare(client,s,request["local_id"])
    response=client.post(ROOT+"/commit",json=commit,headers=s["headers"])
    assert response.status_code==200,response.text
    assert response.json()["receipt"]==original["receipt"]
    changed={**commit,"target_epoch":commit["target_epoch"]+1}
    refused=client.post(ROOT+"/commit",json=changed,headers=s["headers"])
    assert refused.status_code==409,refused.text
    assert refused.json()["detail"]["code"]=="idempotency_mismatch"
