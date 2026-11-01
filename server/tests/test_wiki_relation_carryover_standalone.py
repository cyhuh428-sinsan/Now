"""승인된 동일 관계 계승의 원 작업·판본 결합 검사."""
import copy
import unittest
from uuid import uuid4
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import test_wiki_comparisons_standalone as comparison
from test_wiki_v2_standalone import seal, approval
from app.schemas import wiki_operations as S
from app.schemas.wiki import digest
from app.services import wiki_operations as O
from app.services import note_backup, wiki_v2
from app.models.library import LibraryResource, LibraryMutation
from app.models.note_history import NoteHead, NoteRevision
from app.models.note_v2 import NoteMutation
from app.schemas.wiki import WikiArtifactV2


class RelationCarryTest(unittest.TestCase):
    setUp = comparison.ComparisonTest.setUp
    tearDown = comparison.ComparisonTest.tearDown
    service = comparison.ComparisonTest.service
    bundle = comparison.ComparisonTest.bundle
    build = comparison.ComparisonTest.build
    publish = comparison.ComparisonTest.publish
    initial = comparison.ComparisonTest.initial
    selected = comparison.ComparisonTest.selected
    generated = comparison.ComparisonTest.generated
    comparison = comparison.ComparisonTest.comparison

    def pair(self):
        original, commit = self.bundle(2)
        documents = [item.document.model_dump() for item in commit.documents]
        ident = str(uuid4())
        for index, document in enumerate(documents):
            other = documents[1-index]
            draft = document["drafts"][0]
            draft["relations"] = [dict(id="r", from_section_id="s", type="related_to",
                confidence="inferred", citation_ids=["c"], to_ref=dict(kind="proposal",
                operation_id=ident, wiki_id=other["wiki_id"], draft_id=other["drafts"][0]["id"], section_id="s"))]
            seal(draft)
        prepared, commit = self.build(documents, ["create_draft"]*2, [ref.model_dump() for ref in original.inputs])
        value = prepared.model_dump()
        value["operation_id"] = ident
        value["manifest_hash"] = digest({key: item for key, item in value.items() if key != "manifest_hash"})
        prepared = S.PrepareOperationV2.model_validate(value)
        commit = S.CommitOperation.model_validate({**commit.model_dump(), "manifest_hash": prepared.manifest_hash})
        receipt = self.publish(prepared, commit)
        return prepared, documents, receipt

    def approve(self, document):
        value = copy.deepcopy(document)
        value["document_version"] += 1
        approved = approval(value["drafts"][-1])
        approved["id"] = str(uuid4())
        approved["parent_approved_revision_id"] = value["approvals"][-1]["id"] if value["approvals"] else None
        value["approvals"].append(approved)
        p, c = self.build([value], ["approve_draft"], value["drafts"][-1]["evidence_manifest"])
        self.publish(p, c)
        return value

    def pair_with_retained_binding(self):
        alpha = self.initial()[0]
        inputs = [self.selected(), self.comparison(alpha)]
        documents = [self.generated(inputs, alpha), self.generated(inputs)]
        ident = str(uuid4())
        for n, document in enumerate(documents):
            other = documents[1-n]
            document["drafts"][-1]["relations"] = [dict(id="r", from_section_id="s", type="related_to", confidence="inferred", citation_ids=["c"],
                to_ref=dict(kind="proposal", operation_id=ident, wiki_id=other["wiki_id"], draft_id=other["drafts"][-1]["id"], section_id="s"))]
            seal(document["drafts"][-1])
        p, c = self.build(documents, ["append_draft", "create_draft"], inputs)
        value = p.model_dump()
        value["operation_id"] = ident
        old = alpha["drafts"][0]
        value["draft_bindings"].append(dict(wiki_id=alpha["wiki_id"], draft_id=old["id"], draft_hash=old["draft_hash"]))
        value["draft_bindings"].sort(key=lambda b: (b["wiki_id"], b["draft_id"]))
        value["manifest_hash"] = digest({key: item for key, item in value.items() if key != "manifest_hash"})
        p = S.PrepareOperationV2.model_validate(value)
        c = S.CommitOperation.model_validate({**c.model_dump(), "manifest_hash": p.manifest_hash})
        self.publish(p, c)
        return documents

    def carry(self, before, mutate=None):
        value = copy.deepcopy(before)
        newest = copy.deepcopy(value["drafts"][-1])
        newest.update(id=str(uuid4()), generation_id=str(uuid4()), base_approved_revision_id=value["approvals"][-1]["id"])
        if mutate:
            mutate(newest)
        seal(newest)
        value["document_version"] += 1
        value["drafts"].append(newest)
        p, c = self.build([value], ["append_draft"], [*newest["evidence_manifest"], self.comparison(before)])
        manifest = p.model_dump()
        manifest["kind"] = "integrate"
        manifest["manifest_hash"] = digest({key: item for key, item in manifest.items() if key != "manifest_hash"})
        p = S.PrepareOperationV2.model_validate(manifest)
        c = S.CommitOperation.model_validate({**c.model_dump(), "manifest_hash": p.manifest_hash})
        return p, c, value

    def rejected(self, p, c, change=None):
        head = self.db.get(NoteHead, ("alice", "wiki:"+p.changes[0].wiki_id))
        version = head.version
        O.prepare_operation(self.db, p)
        if change:
            change()
            self.db.commit()
        with self.assertRaises(HTTPException):
            O.commit_operation(self.db, p.operation_id, c)
        self.assertEqual(self.db.get(NoteHead, ("alice", "wiki:"+p.changes[0].wiki_id)).version, version)
        self.assertIsNone(self.db.get(NoteMutation, ("alice", p.changes[0].note_mutation_id)))
        self.assertEqual(O.get_operation(self.db, "alice", p.operation_id)["state"], "prepared")

    def test_exact_approved_relation_carries_without_rewriting_original(self):
        original, documents, receipt = self.pair()
        source = self.approve(documents[0])
        p, c, value = self.carry(source)
        self.assertEqual(self.publish(p, c)["state"], "committed")
        self.assertEqual(value["drafts"][-1]["relations"], documents[0]["drafts"][0]["relations"])
        self.assertEqual(value["drafts"][0], documents[0]["drafts"][0])
        self.assertEqual(O.get_operation(self.db, "alice", original.operation_id)["receipt"], receipt)

    def test_multiple_approved_generations_keep_the_first_binding(self):
        original, documents, receipt = self.pair()
        before = self.approve(documents[0])
        for _ in range(2):
            p, c, value = self.carry(before)
            self.publish(p, c)
            before = self.approve(value)
        self.assertEqual(before["drafts"][-1]["relations"], documents[0]["drafts"][0]["relations"])
        self.assertEqual(O.get_operation(self.db, "alice", original.operation_id)["receipt"], receipt)

    def test_source_binding_is_not_the_first_retained_binding(self):
        documents = self.pair_with_retained_binding()
        p, c, _ = self.carry(self.approve(documents[0]))
        self.assertEqual(self.publish(p, c)["state"], "committed")

    def test_target_binding_uses_the_exact_referenced_draft(self):
        documents = self.pair_with_retained_binding()
        before = self.approve(documents[1])
        _, _, value = self.carry(before)
        previous = WikiArtifactV2.model_validate(before)
        proposed = WikiArtifactV2.model_validate(value)
        newest = proposed.drafts[-1]
        chosen = wiki_v2._carried_relation_target(self.db, "alice", proposed, newest, newest.relations[0], previous, {})
        self.assertEqual(chosen.id, documents[0]["drafts"][-1]["id"])

    def test_changed_relation_cannot_claim_the_old_binding(self):
        _, documents, _ = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]), lambda d: d["relations"][0].update(confidence="uncertain"))
        self.rejected(p, c)

    def test_renamed_relation_cannot_claim_the_old_binding(self):
        _, documents, _ = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]), lambda d: d["relations"][0].update(id="renamed"))
        self.rejected(p, c)

    def test_unapproved_before_is_not_an_inheritance_source(self):
        _, documents, _ = self.pair()
        before = WikiArtifactV2.model_validate(documents[0])
        draft = before.drafts[0]
        with self.assertRaises(HTTPException):
            wiki_v2._carried_relation_target(self.db, "alice", before, draft, draft.relations[0], before, {})

    def test_deleted_target_rejects_without_partial_write(self):
        _, documents, _ = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]))
        def corrupt():
            self.db.get(LibraryResource, ("alice", "wikis", documents[1]["wiki_id"])).deleted_at = datetime.utcnow()
        self.rejected(p, c, corrupt)

    def test_protected_target_rejects_without_partial_write(self):
        _, documents, _ = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]))
        def corrupt():
            self.db.get(NoteHead, ("alice", "wiki:"+documents[1]["wiki_id"])).crypto_epoch = 1
        self.rejected(p, c, corrupt)

    def test_damaged_original_receipt_rejects_without_partial_write(self):
        original, documents, _ = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]))
        def corrupt():
            self.db.get(LibraryMutation, ("alice", original.commit_mutation_id)).response_json = '{}'
        self.rejected(p, c, corrupt)

    def test_changed_original_result_hash_is_not_a_proof(self):
        import json
        original, documents, receipt = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]))
        def corrupt():
            page = next(page for page in receipt["pages"] if page["wiki_id"] == documents[0]["wiki_id"])
            revision = self.db.get(NoteRevision, page["result_revision_id"])
            snapshot = json.loads(revision.snapshot_json)
            raw = json.loads(snapshot["note"]["content"])
            raw["drafts"][0]["summary"] = "Changed retained body"
            seal(raw["drafts"][0])
            snapshot["note"]["content"] = json.dumps(raw)
            revision.snapshot_json = json.dumps(snapshot)
        self.rejected(p, c, corrupt)

    def test_malformed_original_revision_is_a_controlled_rejection(self):
        _, documents, receipt = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]))
        def corrupt():
            page = next(page for page in receipt["pages"] if page["wiki_id"] == documents[0]["wiki_id"])
            self.db.get(NoteRevision, page["result_revision_id"]).snapshot_json = '{}'
        self.rejected(p, c, corrupt)

    def test_original_operation_must_remain_committed(self):
        import json
        original, documents, _ = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]))
        def corrupt():
            row = self.db.get(LibraryResource, ("alice", O.KIND, original.operation_id))
            value = json.loads(row.payload_json)
            value["state"] = "prepared"
            row.payload_json = json.dumps(value)
            row.version = 1
        self.rejected(p, c, corrupt)

    def test_original_operation_cannot_come_from_another_owner(self):
        original, documents, _ = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]))
        def corrupt():
            self.db.get(LibraryResource, ("alice", O.KIND, original.operation_id)).owner_id = "other"
        self.rejected(p, c, corrupt)

    def test_carry_backup_restores_original_operations_into_an_empty_db(self):
        original, documents, receipt = self.pair()
        p, c, _ = self.carry(self.approve(documents[0]))
        self.publish(p, c)
        snapshot = note_backup.export_snapshot(self.db)
        note_backup.validate_backup(snapshot)
        empty = create_engine("sqlite:///:memory:")
        try:
            note_backup.restore_empty(empty, snapshot)
            with Session(empty) as db:
                self.assertEqual(O.get_operation(db, "alice", original.operation_id)["receipt"], receipt)
                self.assertEqual(O.get_operation(db, "alice", p.operation_id)["state"], "committed")
        finally:
            empty.dispose()


if __name__ == "__main__":
    unittest.main()
