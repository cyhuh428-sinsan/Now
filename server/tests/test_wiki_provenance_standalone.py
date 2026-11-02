"""기존 위키 조회의 읽기 전용 생성 기록 결합 검사."""
import copy
import json
import unittest
from uuid import uuid4

from sqlalchemy import event

import test_wiki_comparisons_standalone as base
from app.models.library import LibraryResource, LibraryMutation
from app.models.note_history import NoteHead, NoteRevision
from app.models.note_v2 import NoteMutation
from app.schemas import wiki_operations as S
from app.schemas.wiki import digest
from app.services import wikis
from test_wiki_v2_standalone import seal


class ProvenanceTest(unittest.TestCase):
    setUp = base.ComparisonTest.setUp
    tearDown = base.ComparisonTest.tearDown
    service = base.ComparisonTest.service
    bundle = base.ComparisonTest.bundle
    build = base.ComparisonTest.build
    publish = base.ComparisonTest.publish
    generated = base.ComparisonTest.generated
    comparison = base.ComparisonTest.comparison
    initial = base.ComparisonTest.initial

    def made(self):
        prepared, commit = self.bundle()
        receipt = self.publish(prepared, commit)
        return prepared, commit.documents[0].document.model_dump(), receipt

    def entries(self, document):
        value = wikis.get(self.db, "alice", document["wiki_id"])
        proof = value["artifact"].get("generation_provenance")
        self.assertIsNotNone(proof, "표시 가능한 평문 위키에 검증된 생성 기록 조회가 필요하다")
        self.assertEqual(set(proof), {"schema_version", "entries"})
        self.assertEqual(proof["schema_version"], 1)
        return proof["entries"]

    def test_original_result_binding_and_read_only(self):
        p, doc, receipt = self.made()
        statements = []
        def capture(_c, _cursor, statement, _parameters, _context, _many):
            if statement.split()[0].upper() in {"INSERT", "UPDATE", "DELETE"}:
                statements.append(statement)
        event.listen(self.engine, "before_cursor_execute", capture)
        try:
            entries = self.entries(doc)
        finally:
            event.remove(self.engine, "before_cursor_execute", capture)
        self.assertEqual(statements, [])
        self.assertEqual(entries, [dict(draft_id=doc["drafts"][0]["id"], draft_hash=doc["drafts"][0]["draft_hash"],
            operation_id=p.operation_id, manifest_hash=p.manifest_hash, result_revision_id=receipt["pages"][0]["result_revision_id"], result_document_hash=digest(doc))])

    def test_approval_is_not_a_new_generator(self):
        doc = self.initial()[0]
        entries = self.entries(doc)
        self.assertEqual(len(entries), 1)
        self.assertNotEqual(entries[0]["result_document_hash"], digest(doc))

    def test_integrate_append_preserves_both_original_generators(self):
        before = self.initial()[0]
        inputs = copy.deepcopy(before["drafts"][0]["evidence_manifest"])
        inputs.append(self.comparison(before))
        doc = self.generated(inputs, before)
        p, c = self.build([doc], ["append_draft"], inputs)
        value = p.model_dump(); value["kind"] = "integrate"
        value["manifest_hash"] = digest({k: v for k, v in value.items() if k != "manifest_hash"})
        p = S.PrepareOperationV2.model_validate(value)
        c = S.CommitOperation.model_validate({**c.model_dump(), "manifest_hash": p.manifest_hash})
        self.publish(p, c)
        entries = self.entries(doc)
        self.assertEqual({e["draft_id"] for e in entries}, {d["id"] for d in doc["drafts"]})
        self.assertEqual(next(e for e in entries if e["draft_id"] == doc["drafts"][-1]["id"])["operation_id"], p.operation_id)

    def test_missing_original_mutation_is_not_inferred_from_body(self):
        p, doc, _ = self.made()
        self.db.delete(self.db.get(NoteMutation, ("alice", p.changes[0].note_mutation_id))); self.db.commit()
        self.assertEqual(self.entries(doc), [])

    def test_broken_phase_receipt_is_not_exposed(self):
        p, doc, _ = self.made()
        self.db.get(LibraryMutation, ("alice", p.commit_mutation_id)).response_json = "{}"; self.db.commit()
        self.assertEqual(self.entries(doc), [])

    def test_uncommitted_or_foreign_operation_is_not_exposed(self):
        p, doc, _ = self.made()
        row = self.db.get(NoteMutation, ("alice", p.changes[0].note_mutation_id))
        conditions = json.loads(row.conditions_json); conditions["operation_id"] = str(uuid4())
        row.conditions_json = json.dumps(conditions); self.db.commit()
        self.assertEqual(self.entries(doc), [])

    def test_hidden_wiki_omits_metadata(self):
        _, doc, _ = self.made()
        self.db.get(NoteHead, ("alice", "wiki:" + doc["wiki_id"])).crypto_epoch = 1; self.db.commit()
        value = wikis.get(self.db, "alice", doc["wiki_id"])
        self.assertIsNone(value["artifact"]["document"])
        self.assertNotIn("generation_provenance", value["artifact"])

    def test_multi_output_binds_each_own_result(self):
        p, c = self.bundle(2); receipt = self.publish(p, c)
        for item in c.documents:
            doc = item.document.model_dump(); entries = self.entries(doc)
            self.assertEqual(len(entries), 1)
            page = next(r for r in receipt["pages"] if r["wiki_id"] == doc["wiki_id"])
            self.assertEqual(entries[0]["result_revision_id"], page["result_revision_id"])
            self.assertEqual(entries[0]["result_document_hash"], digest(doc))

    def test_prepared_record_cannot_prove_a_generator(self):
        p, doc, _ = self.made()
        row = self.db.get(LibraryResource, ("alice", "wiki-operations", p.operation_id))
        record = json.loads(row.payload_json); record["state"] = "prepared"
        row.payload_json = json.dumps(record); row.version = 1; self.db.commit()
        self.assertEqual(self.entries(doc), [])

    def test_changed_old_result_is_not_replaced_by_current_body(self):
        doc = self.initial()[0]; original = self.entries(doc)[0]
        row = self.db.get(NoteRevision, original["result_revision_id"])
        snapshot = json.loads(row.snapshot_json); value = json.loads(snapshot["note"]["content"])
        value["drafts"][0]["title"] = "Changed old result"; seal(value["drafts"][0])
        snapshot["note"]["content"] = json.dumps(value); row.snapshot_json = json.dumps(snapshot); self.db.commit()
        self.assertEqual(self.entries(doc), [])

    def test_unreadable_source_omits_metadata(self):
        p, doc, _ = self.made()
        self.db.get(NoteHead, ("alice", p.inputs[0].note_ref.local_id)).crypto_epoch = 1; self.db.commit()
        value = wikis.get(self.db, "alice", doc["wiki_id"])
        self.assertIsNone(value["artifact"]["document"])
        self.assertNotIn("generation_provenance", value["artifact"])


if __name__ == "__main__":
    unittest.main()
