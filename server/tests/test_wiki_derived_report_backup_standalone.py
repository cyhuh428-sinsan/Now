"""합성 Query/Lint 파생 문서의 기존 작업·빈 DB 복원 계약을 검사한다."""
import copy
import json
import unittest
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import HTTPException

from test_wiki_comparisons_standalone import ComparisonTest
from test_wiki_v2_standalone import draft, artifact, seal, approval
from app.models.library import LibraryResource
from app.models.note_history import NoteHead
from app.services import note_backup, wiki_operations as operations


class DerivedReportBackupTest(unittest.TestCase):
    setUp = ComparisonTest.setUp
    tearDown = ComparisonTest.tearDown
    service = ComparisonTest.service
    bundle = ComparisonTest.bundle
    build = ComparisonTest.build
    publish = ComparisonTest.publish
    initial = ComparisonTest.initial
    comparison = ComparisonTest.comparison

    def proposal(self, inputs, title):
        value = draft()
        value.update(id=str(uuid4()), generation_id=str(uuid4()), title=title,
                     provider="manual", model="wiki-lint-v1", claims=[],
                     evidence_manifest=copy.deepcopy(inputs))
        value["citations"] = [dict(id="context-"+str(n), evidence_id=ref["id"],
                                   section_id="s", quote="Exact quote")
                              for n, ref in enumerate(inputs)]
        value["sections"] = [dict(id="report", title=title, markdown="Synthetic review only.",
                                  citation_ids=[c["id"] for c in value["citations"]])]
        seal(value)
        document = artifact(value)
        document["wiki_id"] = str(uuid4())
        return document

    def test_derived_draft_and_approval_restore_all_fixed_inputs_and_receipts(self):
        inputs = [self.comparison(doc) for doc in self.initial(2)]
        for title in ("Synthetic Query answer", "Synthetic Lint report"):
            with self.subTest(title=title):
                document = self.proposal(inputs, title)
                prepared, commit = self.build([document], ["create_draft"], inputs)
                receipt = self.publish(prepared, commit)
                self.assertEqual(document["approvals"], [])
                approved = copy.deepcopy(document)
                approved["document_version"] += 1
                approved["approvals"].append(approval(approved["drafts"][0]))
                decision, decision_commit = self.build([approved], ["approve_draft"], inputs)
                self.publish(decision, decision_commit)
                backup = note_backup.export_snapshot(self.db)
                empty = create_engine("sqlite:///:memory:")
                try:
                    note_backup.restore_empty(empty, backup)
                    with Session(empty) as restored:
                        self.assertEqual(operations.get_operation(restored, "alice", prepared.operation_id)["receipt"], receipt)
                        self.assertEqual(operations.get_operation(restored, "alice", decision.operation_id)["state"], "committed")
                        link = restored.get(LibraryResource, ("alice", "wikis", document["wiki_id"]))
                        payload = json.loads(link.payload_json)
                        self.assertEqual({ref["wiki_id"] for ref in payload["wiki_dependencies"]}, {ref["wiki_id"] for ref in inputs})
                        self.assertEqual({ref["local_id"] for ref in payload["dependencies"]}, {"source"})
                        note_backup.validate_backup(note_backup.export_snapshot(restored))
                finally:
                    empty.dispose()

    def test_report_omitting_a_consumed_wiki_cannot_publish(self):
        inputs = [self.comparison(doc) for doc in self.initial(2)]
        document = self.proposal(inputs[:1], "Incomplete synthetic report")
        prepared, commit = self.build([document], ["create_draft"], inputs)
        operations.prepare_operation(self.db, prepared)
        with self.assertRaises(HTTPException):
            operations.commit_operation(self.db, prepared.operation_id, commit)
        self.assertIsNone(self.db.get(NoteHead, ("alice", "wiki:"+document["wiki_id"])))
        self.assertEqual(operations.get_operation(self.db, "alice", prepared.operation_id)["state"], "prepared")
