from typing import Literal

from pydantic import Field, field_validator

from app.schemas.note_v2 import Strict, HeadMutation, RevisionRef, uuid_text, timestamp
from app.schemas.note_crypto import UploadChunk, SealEntry, TransitionAction


class Structure(Strict):
    note_type: str = Field(max_length=40)
    parent_local_id: str | None = Field(max_length=120)
    level: int = Field(ge=1, le=3)
    deleted_at: str | None
    _deleted = field_validator("deleted_at")(timestamp)


class Projection(Structure):
    title: str = Field(max_length=240)
    tags: str | None
    source: str | None = Field(max_length=80)


class ParentBase(Strict):
    local_id: str = Field(max_length=120)
    head_version: int = Field(ge=0)
    head_revision_id: str | None
    crypto_epoch: int = Field(ge=0)
    history_generation: int = Field(ge=0)
    inventory_revision_ids: list[str]
    physical_note_id: int = Field(ge=1)
    _head = field_validator("head_revision_id")(uuid_text)

    @field_validator("inventory_revision_ids")
    @classmethod
    def inventory(cls, values):
        parsed = [uuid_text(v) for v in values]
        if len(parsed) != len(set(parsed)):
            raise ValueError("duplicate inventory revision")
        return sorted(parsed)


class Quote(HeadMutation):
    server_instance_id: str
    operation: Literal["put", "create", "restore"]
    target_epoch: int = Field(ge=1)
    expected_history_generation: int = Field(ge=0)
    structure: Structure
    parent_base: ParentBase | None
    target_ref: RevisionRef | None
    target_ciphertext_sha256: str | None = Field(pattern=r"^[0-9a-f]{64}$")
    _instance = field_validator("server_instance_id")(uuid_text)


class QuoteCommit(Strict):
    schema_version: Literal[1]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    quote_id: str
    mutation_id: str
    server_instance_id: str
    crypto_epoch: int = Field(ge=1)
    base_head_version: int = Field(ge=0)
    base_revision_id: str | None
    expected_history_generation: int = Field(ge=0)
    expected_inventory_revision_ids: list[str]
    metadata_manifest_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    client_verified_ciphertext_manifest_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    projection: Projection
    _ids = field_validator("quote_id", "mutation_id", "server_instance_id", "base_revision_id")(uuid_text)
    _inventory = field_validator("expected_inventory_revision_ids")(ParentBase.inventory.__func__)


class QuoteChunk(UploadChunk):
    transition_id: str = Field(alias="quote_id")


class QuoteSeal(SealEntry):
    transition_id: str = Field(alias="quote_id")


class QuoteAction(TransitionAction):
    transition_id: str = Field(alias="quote_id")
