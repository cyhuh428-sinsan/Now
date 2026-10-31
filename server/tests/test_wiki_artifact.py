"""Wiki contracts only: no routes, service DB, real sources or models."""
import hashlib
import json
from copy import deepcopy
from uuid import uuid4
from pathlib import Path
import subprocess

import pytest

from app.schemas.wiki import WikiArtifact, WikiLink
from app.services.wiki_artifact import validate_append


def digest(value):
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()).hexdigest()


def artifact():
    scope={"url":"https://example.invalid","owner":"wiki-fixture"}
    draft={"id":str(uuid4()),"generation_id":str(uuid4()),"base_approved_revision_id":None,"scope":scope,
           "title":"Private generated title","topic":"Private topic",
           "sections":[{"id":"section-1","title":"Overview","markdown":"Generated body","citation_ids":["cite-1"]}],
           "citations":[{"id":"cite-1","source_id":"source-1","quote":"Original quote"}],
           "source_manifest":[{"id":"source-1","origin":"server","note_ref":{"owner_id":"wiki-fixture","local_id":"source"},
                               "source_revision_id":str(uuid4()),"head_version":1,"content_hash":"a"*64}],
           "provider":"omniroute","model":"auto","generated_at":"2026-10-31T00:00:00Z","validation_status":"citations_checked"}
    draft["draft_hash"]=digest(draft)
    return {"schema_version":1,"wiki_id":str(uuid4()),"scope":scope,"drafts":[draft],"approvals":[],"rejected_draft_ids":[]}


def test_plain_wiki_document_and_metadata_have_separate_boundaries():
    value=artifact()
    parsed=WikiArtifact.model_validate(value)
    assert parsed.model_dump()==value
    link={"artifact_local_id":"wiki:"+value["wiki_id"],"dependencies":[{"owner_id":"wiki-fixture","local_id":"source"}]}
    assert WikiLink.model_validate(link).model_dump()==link
    for field in ("title","topic","content","quote","drafts"):
        with pytest.raises(ValueError):
            WikiLink.model_validate({**link,field:"must never be copied to library receipts"})
    validate_append(None,parsed,"create")


def test_real_client_draft_hash_and_unicode_are_accepted_without_rewriting():
    root=Path(__file__).resolve().parents[2]
    result=subprocess.run(["node",str(root/"web/scripts/wiki_contract_fixture.mjs")],
                          cwd=root,capture_output=True,text=True,encoding="utf-8",check=True,timeout=20)
    value=json.loads(result.stdout)
    assert WikiArtifact.model_validate(value).model_dump()==value


@pytest.mark.parametrize("change",["hash","citation","foreign","duplicate","parent","scope"])
def test_wiki_corrupt_or_cross_scope_drafts_are_rejected(change):
    value=artifact()
    if change=="hash":value["drafts"][0]["sections"][0]["markdown"]="changed without matching hash"
    if change=="citation":value["drafts"][0]["sections"][0]["citation_ids"]=["missing"]
    if change=="foreign":value["drafts"][0]["source_manifest"][0]["note_ref"]["owner_id"]="other"
    if change=="duplicate":value["drafts"].append(deepcopy(value["drafts"][0]))
    if change=="parent":value["drafts"][0]["base_approved_revision_id"]=str(uuid4())
    if change=="scope":value["drafts"][0]["scope"]={**value["scope"],"url":"https://other.invalid"}
    with pytest.raises(ValueError):
        WikiArtifact.model_validate(value)


def test_approval_binds_exact_draft_and_history_is_append_only():
    previous=artifact()
    old=WikiArtifact.model_validate(previous)
    approved=deepcopy(previous);draft=approved["drafts"][0]
    approved["approvals"].append({"id":str(uuid4()),"parent_approved_revision_id":None,"draft_id":draft["id"],
                                 "draft_hash":draft["draft_hash"],"source_manifest_hash":digest(draft["source_manifest"]),
                                 "approved_by":"wiki-fixture","approved_at":"2026-10-31T01:00:00Z"})
    new=WikiArtifact.model_validate(approved)
    validate_append(old,new,"approve")
    changed=deepcopy(approved)
    changed["drafts"][0]["title"]="rewrite"
    changed["drafts"][0]["draft_hash"]=digest({k:v for k,v in changed["drafts"][0].items() if k!="draft_hash"})
    changed["approvals"][0]["draft_hash"]=changed["drafts"][0]["draft_hash"]
    with pytest.raises(ValueError):
        validate_append(new,WikiArtifact.model_validate(changed),"draft")
    truncated=deepcopy(approved);truncated["approvals"]=[]
    with pytest.raises(ValueError):
        validate_append(new,WikiArtifact.model_validate(truncated),"draft")


def test_rejection_keeps_original_text_and_rejects_later_approval():
    previous=WikiArtifact.model_validate(artifact())
    value=previous.model_dump();value["rejected_draft_ids"]=[value["drafts"][0]["id"]]
    rejected=WikiArtifact.model_validate(value)
    validate_append(previous,rejected,"reject")
    assert rejected.drafts[0].sections[0].markdown=="Generated body"
    value["approvals"]=[{"id":str(uuid4()),"parent_approved_revision_id":None,"draft_id":value["drafts"][0]["id"],
                         "draft_hash":value["drafts"][0]["draft_hash"],"source_manifest_hash":digest(value["drafts"][0]["source_manifest"]),
                         "approved_by":"wiki-fixture","approved_at":"2026-10-31T01:00:00Z"}]
    with pytest.raises(ValueError):
        WikiArtifact.model_validate(value)
