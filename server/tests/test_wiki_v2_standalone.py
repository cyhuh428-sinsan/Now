"""DB/HTTP 없이 승인된 Wiki v2 모델과 canonical 계약을 검사한다."""
import copy
import hashlib
import json
from pathlib import Path
import unittest
from uuid import UUID

from pydantic import ValidationError
from app.schemas import wiki as W


def uid(n):
    return str(UUID(int=n))


def draft():
    value = dict(schema_version=2, id=uid(1), generation_id=uid(2),
        base_approved_revision_id=None, scope=dict(url="https://qa.invalid", owner="alice"),
        title="Synthetic", topic="QA", page_type="concept", summary="Summary", aliases=["Alias"],
        sections=[dict(id="s", title="Section", markdown="Exact quote", citation_ids=["c"])],
        claims=[dict(id="claim", statement="Exact quote", citation_ids=["c"], assessment="supported")],
        relations=[], citations=[dict(id="c", evidence_id="n", section_id=None, quote="Exact quote")],
        evidence_manifest=[dict(id="n", kind="note", origin="server",
            note_ref=dict(owner_id="alice", local_id="source"), source_revision_id=uid(3),
            head_version=1, content_hash="a" * 64)],
        provider="synthetic", model="auto", generated_at="2026-11-01T00:00:00Z",
        validation_status="citations_checked")
    return seal(value)


def seal(value):
    value["draft_hash"] = W.digest({k: v for k, v in value.items() if k != "draft_hash"})
    return value


def artifact(value=None):
    value = value or draft()
    return dict(schema_version=2, wiki_id=uid(10), scope=copy.deepcopy(value["scope"]),
        document_version=1, drafts=[value], approvals=[], rejected_draft_ids=[])


def approval(value, n=20):
    return dict(schema_version=2, id=uid(n), parent_approved_revision_id=None,
        draft_id=value["id"], draft_hash=value["draft_hash"],
        evidence_manifest_hash=W.digest(value["evidence_manifest"]),
        approved_by="alice", approved_at="2026-11-01T00:00:01Z")


class WikiV2Test(unittest.TestCase):
    def test_models_are_separate_and_strict(self):
        value = artifact()
        self.assertEqual(W.WikiArtifactV2.model_validate(value).model_dump(), value)
        with self.assertRaises(ValidationError):
            W.WikiArtifact.model_validate(value)
        for field, replacement in [("schema_version", True), ("document_version", True), ("extra", "x")]:
            bad = copy.deepcopy(value); bad[field] = replacement
            with self.subTest(field=field), self.assertRaises(ValidationError):
                W.WikiArtifactV2.model_validate(bad)

    def test_hash_covers_every_new_field(self):
        for field, value in [("summary", "Changed"), ("aliases", ["Changed"]), ("page_type", "entity"),
                             ("provider", "changed"), ("model", "changed")]:
            bad = draft(); bad[field] = value
            with self.subTest(field=field), self.assertRaises(ValidationError):
                W.WikiDraftV2.model_validate(bad)

    def test_claim_and_evidence_coherence(self):
        cases = []
        bad = draft(); bad["claims"][0]["citation_ids"] = []; cases.append(bad)
        bad = draft(); bad["claims"][0]["citation_ids"] = ["missing"]; cases.append(bad)
        bad = draft(); bad["claims"][0]["citation_ids"] = ["c", "c"]; cases.append(bad)
        bad = draft(); bad["evidence_manifest"][0]["note_ref"]["owner_id"] = "bob"; cases.append(bad)
        bad = draft(); bad["evidence_manifest"][0]["source_revision_id"] = None; cases.append(bad)
        bad = draft(); bad["evidence_manifest"][0]["head_version"] = True; cases.append(bad)
        bad = draft(); bad["citations"][0]["evidence_id"] = "missing"; cases.append(bad)
        bad = draft(); bad["sections"][0]["citation_ids"] = ["c", "c"]; cases.append(bad)
        bad = draft(); bad["evidence_manifest"] *= 2; cases.append(bad)
        bad = draft(); bad["aliases"] = ["same", "same"]; cases.append(bad)
        for index, bad in enumerate(cases):
            with self.subTest(index=index), self.assertRaises(ValidationError):
                W.WikiDraftV2.model_validate(seal(bad))

    def test_wiki_evidence_and_citation(self):
        value = draft()
        value["evidence_manifest"] = [dict(id="n", kind="wiki", origin="server", owner_id="alice",
            wiki_id=uid(40), draft_id=uid(41), approval_id=uid(42), document_version=2, content_hash="b"*64)]
        value["citations"][0]["section_id"] = "s"
        W.WikiDraftV2.model_validate(seal(value))
        for field, replacement in [("owner_id", "bob"), ("approval_id", None), ("document_version", 0)]:
            bad = copy.deepcopy(value); bad["evidence_manifest"][0][field] = replacement
            with self.subTest(field=field), self.assertRaises(ValidationError):
                W.WikiDraftV2.model_validate(seal(bad))
        value["citations"][0]["section_id"] = None
        with self.assertRaises(ValidationError):
            W.WikiDraftV2.model_validate(seal(value))

    def test_relation_types_and_local_section(self):
        value = draft()
        target = dict(kind="proposal", operation_id=uid(50), wiki_id=uid(51), draft_id=uid(52), section_id="s")
        value["relations"] = [dict(id="r", from_section_id="s", to_ref=target,
            type="related_to", confidence="inferred", citation_ids=["c"])]
        W.WikiDraftV2.model_validate(seal(value))
        for field, replacement in [("draft_hash", "b"*64), ("kind", "unknown")]:
            bad = copy.deepcopy(value); bad["relations"][0]["to_ref"][field] = replacement
            with self.subTest(field=field), self.assertRaises(ValidationError):
                W.WikiDraftV2.model_validate(seal(bad))
        bad = copy.deepcopy(value); bad["relations"][0]["from_section_id"] = "missing"
        with self.assertRaises(ValidationError): W.WikiDraftV2.model_validate(seal(bad))
        value["relations"][0]["to_ref"] = dict(kind="approved", wiki_id=uid(51), draft_id=uid(52),
            approval_id=uid(53), draft_hash="b"*64, section_id=None)
        W.WikiDraftV2.model_validate(seal(value))

    def test_approval_chain_and_binding(self):
        value = artifact(); value["approvals"] = [approval(value["drafts"][0])]
        W.WikiArtifactV2.model_validate(value)
        for field, replacement in [("draft_hash", "0"*64), ("evidence_manifest_hash", "0"*64),
                                   ("approved_by", "bob"), ("parent_approved_revision_id", uid(99))]:
            bad = copy.deepcopy(value); bad["approvals"][0][field] = replacement
            with self.subTest(field=field), self.assertRaises(ValidationError): W.WikiArtifactV2.model_validate(bad)
        bad = copy.deepcopy(value); bad["rejected_draft_ids"] = [uid(1)]
        with self.assertRaises(ValidationError): W.WikiArtifactV2.model_validate(bad)
        bad = copy.deepcopy(value); bad["approvals"] *= 2
        with self.assertRaises(ValidationError): W.WikiArtifactV2.model_validate(bad)

    def test_v1_objects_remain_exact_in_v2(self):
        old = draft(); old.pop("schema_version")
        for key in ("page_type", "summary", "aliases", "claims", "relations", "evidence_manifest"):
            old.pop(key)
        old["citations"] = [dict(id="c", source_id="n", quote="Exact quote")]
        old["source_manifest"] = [dict(id="n", origin="server", note_ref=dict(owner_id="alice", local_id="source"),
            source_revision_id=uid(3), head_version=1, content_hash="a"*64)]
        seal(old)
        old_doc = artifact(old); old_doc["schema_version"] = 1
        old_approval = approval(draft()); old_approval.pop("schema_version")
        old_approval.pop("evidence_manifest_hash"); old_approval["draft_hash"] = old["draft_hash"]
        old_approval["source_manifest_hash"] = W.digest(old["source_manifest"])
        old_doc["approvals"] = [old_approval]
        before = W.canonical(old_doc)
        self.assertEqual(W.canonical(W.WikiArtifact.model_validate(old_doc).model_dump()), before)
        migrated = copy.deepcopy(old_doc); migrated["schema_version"] = 2
        parsed = W.WikiArtifactV2.model_validate(migrated).model_dump()
        self.assertEqual(parsed["drafts"], old_doc["drafts"])
        self.assertEqual(parsed["approvals"], old_doc["approvals"])
        bad = copy.deepcopy(migrated); bad["drafts"][0]["schema_version"] = 1
        with self.assertRaises(ValidationError): W.WikiArtifactV2.model_validate(bad)

    def test_link_v2_is_opaque_and_bounded(self):
        ref = dict(owner_id="alice", wiki_id=uid(40), draft_id=uid(41), approval_id=uid(42),
            document_version=1, content_hash="b"*64)
        value = dict(artifact_local_id="wiki:"+uid(10), dependencies=[dict(owner_id="alice", local_id="source")],
            wiki_dependencies=[ref], document_schema_floor=2, lineage_manifest_hash="a"*64)
        W.WikiLinkV2.model_validate(value)
        for field, replacement in [("document_schema_floor", 1), ("title", "Secret"),
                                   ("wiki_dependencies", [ref, ref]), ("dependencies", [])]:
            bad = copy.deepcopy(value); bad[field] = replacement
            with self.subTest(field=field), self.assertRaises(ValidationError): W.WikiLinkV2.model_validate(bad)

    def test_limits_and_self_dependency(self):
        for field, replacement in [("summary", "x"*501), ("aliases", [str(i) for i in range(21)]),
                                   ("evidence_manifest", []), ("claims", [draft()["claims"][0]]*501)]:
            bad = draft(); bad[field] = replacement
            with self.subTest(field=field), self.assertRaises(ValidationError): W.WikiDraftV2.model_validate(seal(bad))
        bad = artifact(); bad["drafts"][0]["evidence_manifest"] = [dict(id="n", kind="wiki", origin="server",
            owner_id="alice", wiki_id=bad["wiki_id"], draft_id=uid(90), approval_id=uid(91),
            document_version=1, content_hash="b"*64)]
        bad["drafts"][0]["citations"][0]["section_id"] = "s"; seal(bad["drafts"][0])
        with self.assertRaises(ValidationError): W.WikiArtifactV2.model_validate(bad)

    def test_canonical_golden(self):
        fixture = json.loads((Path(__file__).parent / "fixtures/wiki_v2_canonical.json").read_text(encoding="utf-8"))
        for case in fixture["cases"]:
            with self.subTest(name=case["name"]):
                actual = W.canonical(case["value"])
                self.assertEqual(actual, case["canonical"])
                self.assertEqual(hashlib.sha256(actual.encode("utf-8")).hexdigest(), case["sha256"])

    def test_two_approvals_and_mixed_generations(self):
        value = artifact(); first = value["drafts"][0]
        value["approvals"] = [approval(first)]
        second = copy.deepcopy(first)
        second.update(id=uid(101), generation_id=uid(102), base_approved_revision_id=uid(20))
        value["drafts"].append(seal(second))
        next_approval = approval(second, 103); next_approval["parent_approved_revision_id"] = uid(20)
        value["approvals"].append(next_approval)
        W.WikiArtifactV2.model_validate(value)
        value["approvals"].reverse()
        with self.assertRaises(ValidationError): W.WikiArtifactV2.model_validate(value)

    def test_mutual_proposal_hashes_are_independent(self):
        a, b = artifact(), artifact()
        b["wiki_id"] = uid(110); b["drafts"][0].update(id=uid(111), generation_id=uid(112))
        for source, target in ((a, b), (b, a)):
            source["drafts"][0]["relations"] = [dict(id="r", from_section_id="s", to_ref=dict(
                kind="proposal", operation_id=uid(120), wiki_id=target["wiki_id"],
                draft_id=target["drafts"][0]["id"], section_id="s"), type="related_to",
                confidence="inferred", citation_ids=["c"])]
            seal(source["drafts"][0])
        for value in (a, b): W.WikiArtifactV2.model_validate(value)
        old = a["drafts"][0]["draft_hash"]
        b["drafts"][0]["summary"] = "Target changed"; seal(b["drafts"][0])
        self.assertEqual(seal(a["drafts"][0])["draft_hash"], old)

    def test_nested_unknown_fields_and_cross_owner_index(self):
        for field in ("claims", "relations", "evidence_manifest", "citations", "sections"):
            bad = draft()
            if field == "relations":
                bad[field] = [dict(id="r", from_section_id=None, to_ref=dict(kind="proposal", operation_id=uid(50),
                    wiki_id=uid(51), draft_id=uid(52), section_id=None), type="related_to", confidence="uncertain", citation_ids=[])]
            bad[field][0]["unknown"] = "not allowed"
            with self.subTest(field=field), self.assertRaises(ValidationError): W.WikiDraftV2.model_validate(seal(bad))
        link = dict(artifact_local_id="wiki:"+uid(10), dependencies=[dict(owner_id="alice", local_id="source")],
            wiki_dependencies=[dict(owner_id="bob", wiki_id=uid(40), draft_id=uid(41), approval_id=uid(42),
                document_version=1, content_hash="a"*64)], document_schema_floor=2, lineage_manifest_hash="b"*64)
        with self.assertRaises(ValidationError): W.WikiLinkV2.model_validate(link)


if __name__ == "__main__": unittest.main()
