"""Strict metadata-only preparation and cipher-only protected import."""
from typing import Literal

from pydantic import Field, field_validator

from app.schemas.note_v2 import Strict, uuid_text
from app.schemas.note_crypto import ReservedBranch, UploadChunk, SealEntry, TransitionAction


class ImportEntry(ReservedBranch):
    expected_existing_ciphertext_sha256: str | None = Field(pattern=r"^[0-9a-f]{64}$")


class PrepareImport(Strict):
    schema_version: Literal[1]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    mutation_id: str
    server_instance_id: str
    crypto_epoch: int = Field(ge=0)
    target_epoch: int = Field(ge=1)
    base_head_version: int = Field(ge=0)
    base_revision_id: str | None
    expected_history_generation: int = Field(ge=0)
    expected_inventory_revision_ids: list[str]
    entries: list[ImportEntry] = Field(min_length=1)
    _ids = field_validator("mutation_id", "server_instance_id", "base_revision_id")(uuid_text)

    @field_validator("expected_inventory_revision_ids")
    @classmethod
    def inventory(cls, values):
        values = [uuid_text(v) for v in values]
        if len(values) != len(set(values)):
            raise ValueError("duplicate inventory revision")
        return sorted(values)

    @field_validator("entries")
    @classmethod
    def ordered(cls, values):
        return sorted(values, key=lambda e: e.revision_id)


class ImportCommit(Strict):
    schema_version: Literal[2]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    mutation_id: str
    server_instance_id: str
    import_id: str
    crypto_epoch: int = Field(ge=1)
    metadata_manifest_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    client_verified_ciphertext_manifest_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    client_verified_existing_set_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    _ids = field_validator("mutation_id", "server_instance_id", "import_id")(uuid_text)


class ImportChunk(UploadChunk):
    transition_id: str = Field(alias="import_id")


class ImportSeal(SealEntry):
    transition_id: str = Field(alias="import_id")


class ImportAction(TransitionAction):
    transition_id: str = Field(alias="import_id")
