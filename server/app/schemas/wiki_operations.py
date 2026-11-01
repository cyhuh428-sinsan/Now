"""Strict, not-yet-routed Wiki operation envelopes."""
from typing import Annotated, Literal
from pydantic import BeforeValidator, Field, model_validator
from app.schemas.wiki import (
    Strict, Ident, Hash, EvidenceV2, WikiArtifactV2, canonical, digest, _unique,
)


def _schema_one(value):
    if type(value) is not int or value != 1:
        raise ValueError("wiki_operation_schema")
    return value


class OperationEnvelope(Strict):
    schema_version: Annotated[Literal[1], BeforeValidator(_schema_one)]
    owner_id: str = Field(min_length=1, max_length=80)
    device_id: str = Field(min_length=1, max_length=120)
    mutation_id: Ident
    manifest_hash: Hash


class DraftBinding(Strict):
    wiki_id: Ident
    draft_id: Ident
    draft_hash: Hash


class OperationChange(Strict):
    wiki_id: Ident
    action: Literal["create_draft", "append_draft", "approve_draft", "reject_draft"]
    note_mutation_id: Ident
    base_head_revision_id: Ident | None
    base_head_version: int = Field(ge=0)
    base_index_version: int = Field(ge=0)
    base_document_version: int = Field(ge=0)
    result_document_hash: Hash

    @model_validator(mode="after")
    def base(self):
        values = (self.base_head_version, self.base_index_version, self.base_document_version)
        if self.action == "create_draft":
            if self.base_head_revision_id is not None or any(values):
                raise ValueError("wiki_create_base")
        elif self.base_head_revision_id is None or not all(v > 0 for v in values):
            raise ValueError("wiki_existing_base")
        return self


def evidence_order(item):
    if item.kind == "note":
        return (item.kind, item.note_ref.owner_id, item.note_ref.local_id, item.source_revision_id or "")
    return (item.kind, item.owner_id, item.wiki_id, item.draft_id, item.approval_id)


class PrepareOperation(OperationEnvelope):
    operation_id: Ident
    commit_mutation_id: Ident
    abort_mutation_id: Ident
    kind: Literal["ingest", "integrate"]
    inputs: list[EvidenceV2] = Field(min_length=1, max_length=30)
    draft_bindings: list[DraftBinding] = Field(max_length=10)
    changes: list[OperationChange] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def coherent(self):
        _unique([self.mutation_id, self.commit_mutation_id, self.abort_mutation_id,
                 *[c.note_mutation_id for c in self.changes]], "wiki_operation_uuid_collision")
        _unique([c.wiki_id for c in self.changes], "wiki_duplicate_target")
        _unique([i.id for i in self.inputs], "wiki_duplicate_input")
        _unique([evidence_order(i) for i in self.inputs], "wiki_duplicate_input")
        _unique([(b.wiki_id, b.draft_id) for b in self.draft_bindings], "wiki_duplicate_binding")
        if self.changes != sorted(self.changes, key=lambda c: c.wiki_id):
            raise ValueError("wiki_target_order")
        if self.inputs != sorted(self.inputs, key=evidence_order):
            raise ValueError("wiki_input_order")
        if self.draft_bindings != sorted(self.draft_bindings, key=lambda b: (b.wiki_id, b.draft_id)):
            raise ValueError("wiki_binding_order")
        for item in self.inputs:
            owner = item.note_ref.owner_id if item.kind == "note" else item.owner_id
            if item.origin != "server" or owner != self.owner_id:
                raise ValueError("wiki_server_input_required")
        if any(b.wiki_id not in {c.wiki_id for c in self.changes} for b in self.draft_bindings):
            raise ValueError("wiki_binding_target")
        if self.manifest_hash != digest(self.model_dump(exclude={"manifest_hash"})):
            raise ValueError("wiki_operation_manifest_hash")
        return self


class OperationDocument(Strict):
    wiki_id: Ident
    document: WikiArtifactV2

    @model_validator(mode="after")
    def identity(self):
        if self.wiki_id != self.document.wiki_id:
            raise ValueError("wiki_document_identity")
        return self


class CommitOperation(OperationEnvelope):
    documents: list[OperationDocument] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def coherent(self):
        _unique([item.wiki_id for item in self.documents], "wiki_duplicate_target")
        if self.documents != sorted(self.documents, key=lambda item: item.wiki_id):
            raise ValueError("wiki_target_order")
        if any(item.document.scope.owner != self.owner_id for item in self.documents):
            raise ValueError("wiki_source_owner")
        if len(canonical(self.model_dump()).encode("utf-8")) > 20 * 1024 * 1024:
            raise ValueError("wiki_operation_capacity")
        return self


class AbortOperation(OperationEnvelope):
    pass


class ReservedMutation(Strict):
    status: Literal["reserved"]
    operation_id: Ident
    phase: Literal["commit", "abort", "page"]
    wiki_id: Ident | None = None
    manifest_hash: Hash

    @model_validator(mode="after")
    def page(self):
        if (self.phase == "page") != (self.wiki_id is not None):
            raise ValueError("wiki_reserved_phase")
        return self


class OperationRecord(Strict):
    state: Literal["prepared", "committed", "aborted"]
    manifest: PrepareOperation
    reserved_bytes: int = Field(ge=131072, le=131072)
