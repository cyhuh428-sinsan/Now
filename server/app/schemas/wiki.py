import hashlib
import json
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator


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
        if self.origin == "server" and (self.source_revision_id is None or self.head_version < 1):
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
