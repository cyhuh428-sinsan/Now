from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.note_v2 import HeadMutation, RevisionRef, Strict, uuid_text


class ReservedBranch(Strict):
    revision_id: str
    parent_ref: RevisionRef | None
    origin_device_id: str = Field(min_length=1, max_length=120)
    _revision = field_validator("revision_id")(uuid_text)


class PrepareTransition(HeadMutation):
    server_instance_id: str
    expected_history_generation: int = Field(ge=0)
    target_epoch: int = Field(ge=1)
    local_branches: list[ReservedBranch] = Field(default_factory=list)
    _instance = field_validator("server_instance_id")(uuid_text)


class TransitionAction(Strict):
    schema_version: int = Field(ge=1, le=1)
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    transition_id: str
    lease_version: int = Field(ge=1)
    _transition = field_validator("transition_id")(uuid_text)


class RepresentationKey(Strict):
    kind: Literal["note_body", "revision_snapshot", "revision_before", "inventory_snapshot", "offline_snapshot", "reserved_offline_snapshot",
                  "analysis_input", "analysis_result", "analysis_error", "recording_transcript"]
    id: str = Field(min_length=1, max_length=36)
    slot: Literal["content", "after", "before", "current", "snapshot", "input_text", "result_json", "error_message", "transcript"]

    @model_validator(mode="after")
    def key_shape(self):
        slots = {"note_body": "content", "revision_snapshot": "after", "revision_before": "before",
                 "inventory_snapshot": "current", "offline_snapshot": "snapshot", "reserved_offline_snapshot": "snapshot",
                 "analysis_input": "input_text", "analysis_result": "result_json", "analysis_error": "error_message",
                 "recording_transcript": "transcript"}
        if self.slot != slots[self.kind]:
            raise ValueError("invalid representation slot")
        if self.kind in ("note_body", "inventory_snapshot", "analysis_input", "analysis_result", "analysis_error", "recording_transcript"):
            if not self.id.isascii() or not self.id.isdigit() or int(self.id) < 1 or str(int(self.id)) != self.id:
                raise ValueError("invalid physical identifier")
        else:
            if uuid_text(self.id) != self.id:
                raise ValueError("noncanonical UUID")
        return self


class TransitionMutation(Strict):
    schema_version: Literal[1]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    transition_id: str
    _transition = field_validator("transition_id")(uuid_text)


class EntryMutation(TransitionMutation):
    entry_key: RepresentationKey
    source_etag: str
    target_epoch: int = Field(ge=1)
    total_chunks: int = Field(ge=1)
    total_bytes: int = Field(ge=1)
    _etag = field_validator("source_etag")(uuid_text)

    @model_validator(mode="after")
    def chunk_count(self):
        if self.total_chunks != (self.total_bytes + 262143) // 262144:
            raise ValueError("invalid chunk count")
        return self


class UploadChunk(EntryMutation):
    chunk_index: int = Field(ge=0)
    chunk_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    data_base64: str = Field(max_length=349528)


class SealEntry(EntryMutation):
    ciphertext_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class CommitTransition(TransitionMutation):
    mutation_id: str
    server_instance_id: str
    base_head_version: int = Field(ge=0)
    base_revision_id: str | None
    expected_inventory_revision_ids: list[str]
    expected_history_generation: int = Field(ge=0)
    from_epoch: int = Field(ge=0)
    target_epoch: int = Field(ge=1)
    metadata_manifest_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    client_verified_ciphertext_manifest_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    _ids = field_validator("mutation_id", "server_instance_id", "base_revision_id")(uuid_text)

    @field_validator("expected_inventory_revision_ids")
    @classmethod
    def inventory(cls, value):
        values = [uuid_text(v) for v in value]
        if len(values) != len(set(values)):
            raise ValueError("duplicate inventory revision")
        return sorted(values)
