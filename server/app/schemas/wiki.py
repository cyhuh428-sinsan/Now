import hashlib
import json
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Discriminator, Field, Tag, model_validator

from app.schemas.library import Mutation


class WikiLifecycle(Mutation):
    device_id: str = Field(min_length=1, max_length=120)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def uuid_text(value):
    if str(UUID(value)) != value:
        raise ValueError("wiki_noncanonical_id")
    return value


def timestamp(value):
    if datetime.fromisoformat(value.replace("Z", "+00:00")).tzinfo is None:
        raise ValueError("wiki_timestamp_timezone")
    return value


Ident = Annotated[str, AfterValidator(uuid_text)]
Stamp = Annotated[str, Field(max_length=64), AfterValidator(timestamp)]
Hash = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
LabelId = Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class NoteRef(Strict):
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(min_length=1, max_length=120)


class WikiScope(Strict):
    url: str = Field(max_length=2048)
    owner: str = Field(min_length=1, max_length=80)


class WikiSource(Strict):
    id: LabelId
    origin: Literal["server", "local"]
    note_ref: NoteRef
    source_revision_id: Ident | None
    head_version: int = Field(ge=0)
    content_hash: Hash

    @model_validator(mode="after")
    def server_revision(self):
        if self.origin == "server" and self.source_revision_id is None:
            raise ValueError("wiki_server_source_revision")
        return self


class WikiCitation(Strict):
    id: LabelId
    source_id: LabelId
    quote: str = Field(min_length=1, max_length=4096)


class WikiSection(Strict):
    id: LabelId
    title: str = Field(min_length=1, max_length=240)
    markdown: str = Field(min_length=1, max_length=131072)
    citation_ids: list[LabelId] = Field(min_length=1, max_length=500)


class WikiDraft(Strict):
    id: Ident
    generation_id: Ident
    base_approved_revision_id: Ident | None
    scope: WikiScope
    title: str = Field(min_length=1, max_length=240)
    topic: str = Field(min_length=1, max_length=240)
    sections: list[WikiSection] = Field(min_length=1, max_length=100)
    citations: list[WikiCitation] = Field(min_length=1, max_length=500)
    source_manifest: list[WikiSource] = Field(min_length=1, max_length=30)
    provider: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=240)
    generated_at: Stamp
    validation_status: Literal["citations_checked"]
    draft_hash: Hash

    @model_validator(mode="after")
    def coherent(self):
        sources = {source.id: source for source in self.source_manifest}
        cites = {citation.id for citation in self.citations}
        if len(sources) != len(self.source_manifest) or len(cites) != len(self.citations):
            raise ValueError("wiki_duplicate_evidence")
        if len({section.id for section in self.sections}) != len(self.sections):
            raise ValueError("wiki_duplicate_section")
        if any(source.note_ref.owner_id != self.scope.owner for source in self.source_manifest):
            raise ValueError("wiki_source_owner")
        if len({(source.note_ref.owner_id, source.note_ref.local_id) for source in self.source_manifest}) != len(sources):
            raise ValueError("wiki_duplicate_source")
        if any(citation.source_id not in sources for citation in self.citations):
            raise ValueError("wiki_unknown_source")
        if any(not set(section.citation_ids) <= cites or len(set(section.citation_ids)) != len(section.citation_ids)
               for section in self.sections):
            raise ValueError("wiki_unknown_citation")
        if self.draft_hash != digest(self.model_dump(exclude={"draft_hash"})):
            raise ValueError("wiki_draft_hash")
        return self


class WikiApproval(Strict):
    id: Ident
    parent_approved_revision_id: Ident | None
    draft_id: Ident
    draft_hash: Hash
    source_manifest_hash: Hash
    approved_by: str = Field(min_length=1, max_length=80)
    approved_at: Stamp


class WikiArtifact(Strict):
    schema_version: Literal[1]
    document_version: int = Field(ge=1)
    wiki_id: Ident
    scope: WikiScope
    drafts: list[WikiDraft] = Field(min_length=1, max_length=1000)
    approvals: list[WikiApproval] = Field(max_length=1000)
    rejected_draft_ids: list[Ident] = Field(max_length=1000)

    @model_validator(mode="after")
    def coherent(self):
        drafts = {draft.id: draft for draft in self.drafts}
        if len(drafts) != len(self.drafts) or len({draft.generation_id for draft in self.drafts}) != len(drafts):
            raise ValueError("wiki_duplicate_draft")
        if any(draft.scope != self.scope for draft in self.drafts):
            raise ValueError("wiki_artifact_scope")
        rejected = set(self.rejected_draft_ids)
        if len(rejected) != len(self.rejected_draft_ids) or not rejected <= drafts.keys():
            raise ValueError("wiki_invalid_rejection")
        previous, approved, ids = None, set(), set()
        for approval in self.approvals:
            draft = drafts.get(approval.draft_id)
            if (draft is None or approval.id in ids or approval.draft_id in approved or approval.draft_id in rejected
                    or approval.parent_approved_revision_id != previous or draft.base_approved_revision_id != previous
                    or approval.approved_by != self.scope.owner or approval.draft_hash != draft.draft_hash
                    or approval.source_manifest_hash != digest([source.model_dump() for source in draft.source_manifest])):
                raise ValueError("wiki_approval_binding")
            ids.add(approval.id)
            approved.add(approval.draft_id)
            previous = approval.id
        if any(draft.base_approved_revision_id is not None and draft.base_approved_revision_id not in ids for draft in self.drafts):
            raise ValueError("wiki_unknown_approval_base")
        if len(canonical(self.model_dump()).encode("utf-8")) > 2097152:
            raise ValueError("wiki_artifact_capacity")
        return self


class WikiLink(Strict):
    artifact_local_id: str = Field(max_length=120)
    dependencies: list[NoteRef] = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def opaque(self):
        if not self.artifact_local_id.startswith("wiki:"):
            raise ValueError("wiki_artifact_id")
        uuid_text(self.artifact_local_id[5:])
        if len({(ref.owner_id, ref.local_id) for ref in self.dependencies}) != len(self.dependencies):
            raise ValueError("wiki_duplicate_dependency")
        return self


# V2 is opt-in: existing service imports and v1 hash inputs remain unchanged.
class WikiNoteEvidenceV2(WikiSource):
    kind: Literal["note"]


class WikiDependencyV2(Strict):
    owner_id: str = Field(min_length=1, max_length=80)
    wiki_id: Ident
    draft_id: Ident
    approval_id: Ident | None
    document_version: int = Field(ge=1)
    content_hash: Hash


class WikiEvidenceV2(WikiDependencyV2):
    id: LabelId
    kind: Literal["wiki"]
    origin: Literal["server", "local"]

    @model_validator(mode="after")
    def approved_source(self):
        if self.origin == "server" and self.approval_id is None:
            raise ValueError("wiki_server_approval_required")
        return self


EvidenceV2 = Annotated[WikiNoteEvidenceV2 | WikiEvidenceV2, Field(discriminator="kind")]


class WikiCitationV2(Strict):
    id: LabelId
    evidence_id: LabelId
    section_id: LabelId | None
    quote: str = Field(min_length=1, max_length=4096)


class WikiClaimV2(Strict):
    id: LabelId
    statement: str = Field(min_length=1, max_length=131072)
    citation_ids: list[LabelId] = Field(max_length=500)
    assessment: Literal["supported", "inferred", "uncertain", "unsupported"]


class WikiApprovedTargetV2(Strict):
    kind: Literal["approved"]
    wiki_id: Ident
    draft_id: Ident
    approval_id: Ident
    draft_hash: Hash
    section_id: LabelId | None


class WikiProposalTargetV2(Strict):
    kind: Literal["proposal"]
    operation_id: Ident
    wiki_id: Ident
    draft_id: Ident
    section_id: LabelId | None


class WikiRelationV2(Strict):
    id: LabelId
    from_section_id: LabelId | None
    to_ref: Annotated[WikiApprovedTargetV2 | WikiProposalTargetV2, Field(discriminator="kind")]
    type: Literal["related_to", "supports", "contradicts", "extends", "depends_on"]
    confidence: Literal["explicit", "inferred", "uncertain"]
    citation_ids: list[LabelId] = Field(max_length=500)


def _unique(values, code):
    if len(set(values)) != len(values):
        raise ValueError(code)


class WikiDraftV2(Strict):
    schema_version: Literal[2]
    id: Ident
    generation_id: Ident
    base_approved_revision_id: Ident | None
    scope: WikiScope
    title: str = Field(min_length=1, max_length=240)
    topic: str = Field(min_length=1, max_length=240)
    page_type: Literal["overview", "concept", "entity", "procedure", "reference", "synthesis"]
    summary: str = Field(max_length=500)
    aliases: list[Annotated[str, Field(min_length=1, max_length=120)]] = Field(max_length=20)
    sections: list[WikiSection] = Field(min_length=1, max_length=100)
    claims: list[WikiClaimV2] = Field(max_length=500)
    relations: list[WikiRelationV2] = Field(max_length=200)
    citations: list[WikiCitationV2] = Field(min_length=1, max_length=500)
    evidence_manifest: list[EvidenceV2] = Field(min_length=1, max_length=30)
    provider: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=240)
    generated_at: Stamp
    validation_status: Literal["citations_checked"]
    draft_hash: Hash

    @model_validator(mode="after")
    def coherent(self):
        for collection in (self.sections, self.claims, self.relations, self.citations, self.evidence_manifest):
            _unique([item.id for item in collection], "wiki_duplicate_id")
        _unique(self.aliases, "wiki_duplicate_alias")
        evidence = {item.id: item for item in self.evidence_manifest}
        identities = []
        for item in self.evidence_manifest:
            owner = item.note_ref.owner_id if item.kind == "note" else item.owner_id
            if owner != self.scope.owner:
                raise ValueError("wiki_source_owner")
            identities.append((item.kind, owner, item.note_ref.local_id if item.kind == "note" else
                               (item.wiki_id, item.draft_id, item.approval_id, item.document_version)))
        _unique(identities, "wiki_duplicate_source")
        for citation in self.citations:
            target = evidence.get(citation.evidence_id)
            if target is None or (target.kind == "wiki" and citation.section_id is None):
                raise ValueError("wiki_unknown_source")
        cites = {item.id for item in self.citations}
        sections = {item.id for item in self.sections}
        for item in [*self.sections, *self.claims, *self.relations]:
            _unique(item.citation_ids, "wiki_duplicate_citation")
            if not set(item.citation_ids) <= cites:
                raise ValueError("wiki_unknown_citation")
        if any(item.assessment == "supported" and not item.citation_ids for item in self.claims):
            raise ValueError("wiki_claim_evidence_required")
        if any(item.from_section_id is not None and item.from_section_id not in sections for item in self.relations):
            raise ValueError("wiki_relation_section")
        if self.draft_hash != digest(self.model_dump(exclude={"draft_hash"})):
            raise ValueError("wiki_draft_hash")
        return self


class WikiApprovalV2(Strict):
    schema_version: Literal[2]
    id: Ident
    parent_approved_revision_id: Ident | None
    draft_id: Ident
    draft_hash: Hash
    evidence_manifest_hash: Hash
    approved_by: str = Field(min_length=1, max_length=80)
    approved_at: Stamp


def _wiki_object_version(value):
    # Missing discriminator means an exact legacy object, never an injected v1 field.
    if isinstance(value, dict):
        return "legacy" if "schema_version" not in value else str(value["schema_version"])
    return "2" if isinstance(value, (WikiDraftV2, WikiApprovalV2)) else "legacy"


DraftAny = Annotated[Annotated[WikiDraft, Tag("legacy")] | Annotated[WikiDraftV2, Tag("2")],
                     Discriminator(_wiki_object_version)]
ApprovalAny = Annotated[Annotated[WikiApproval, Tag("legacy")] | Annotated[WikiApprovalV2, Tag("2")],
                        Discriminator(_wiki_object_version)]


class WikiArtifactV2(Strict):
    schema_version: Literal[2]
    document_version: int = Field(ge=1)
    wiki_id: Ident
    scope: WikiScope
    drafts: list[DraftAny] = Field(min_length=1, max_length=1000)
    approvals: list[ApprovalAny] = Field(max_length=1000)
    rejected_draft_ids: list[Ident] = Field(max_length=1000)

    @model_validator(mode="after")
    def coherent(self):
        _unique([item.id for item in self.drafts], "wiki_duplicate_draft")
        _unique([item.generation_id for item in self.drafts], "wiki_duplicate_generation")
        _unique(self.rejected_draft_ids, "wiki_invalid_rejection")
        drafts = {item.id: item for item in self.drafts}
        rejected = set(self.rejected_draft_ids)
        if not rejected <= drafts.keys() or any(item.scope != self.scope for item in self.drafts):
            raise ValueError("wiki_artifact_scope")
        previous, approved, ids = None, set(), set()
        for item in self.approvals:
            draft = drafts.get(item.draft_id)
            if draft is None:
                raise ValueError("wiki_approval_binding")
            is_v2 = isinstance(draft, WikiDraftV2)
            if is_v2 != isinstance(item, WikiApprovalV2):
                raise ValueError("wiki_approval_schema")
            evidence = draft.evidence_manifest if is_v2 else draft.source_manifest
            actual = item.evidence_manifest_hash if is_v2 else item.source_manifest_hash
            if (item.id in ids or item.draft_id in approved or item.draft_id in rejected
                    or item.parent_approved_revision_id != previous or draft.base_approved_revision_id != previous
                    or item.approved_by != self.scope.owner or item.draft_hash != draft.draft_hash
                    or actual != digest([ref.model_dump() for ref in evidence])):
                raise ValueError("wiki_approval_binding")
            previous = item.id
            ids.add(item.id)
            approved.add(item.draft_id)
        if any(item.base_approved_revision_id is not None and item.base_approved_revision_id not in ids for item in self.drafts):
            raise ValueError("wiki_unknown_approval_base")
        for draft in self.drafts:
            if isinstance(draft, WikiDraftV2) and any(
                    item.kind == "wiki" and item.wiki_id == self.wiki_id for item in draft.evidence_manifest):
                raise ValueError("wiki_self_evidence")
        if len(canonical(self.model_dump()).encode("utf-8")) > 2097152:
            raise ValueError("wiki_artifact_capacity")
        return self


class WikiLinkV2(Strict):
    artifact_local_id: str = Field(max_length=120)
    dependencies: list[NoteRef] = Field(min_length=1, max_length=1000)
    wiki_dependencies: list[WikiDependencyV2] = Field(max_length=1000)
    document_schema_floor: Literal[2]
    lineage_manifest_hash: Hash

    @model_validator(mode="after")
    def opaque(self):
        if not self.artifact_local_id.startswith("wiki:"):
            raise ValueError("wiki_artifact_id")
        uuid_text(self.artifact_local_id[5:])
        _unique([(item.owner_id, item.local_id) for item in self.dependencies], "wiki_duplicate_dependency")
        _unique([canonical(item.model_dump()) for item in self.wiki_dependencies], "wiki_duplicate_dependency")
        owners = {item.owner_id for item in [*self.dependencies, *self.wiki_dependencies]}
        if len(owners) != 1:
            raise ValueError("wiki_source_owner")
        if any(item.wiki_id == self.artifact_local_id[5:] for item in self.wiki_dependencies):
            raise ValueError("wiki_self_evidence")
        return self
