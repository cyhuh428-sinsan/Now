from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.note_v2 import Strict
from app.schemas.protected_analysis import BaseContext
from app.schemas.note_v2 import RevisionRef, SnapshotNote
from app.schemas.note_crypto import RepresentationKey
from pydantic import model_validator

HEX = r"^[0-9a-f]{64}$"
UID = Annotated[str, Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")]


class Access(Strict):
    schema_version: Literal[3]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    server_instance_id: str

    @field_validator("server_instance_id")
    @classmethod
    def canonical_uuid(cls, value):
        if value != str(UUID(value)):
            raise ValueError("noncanonical UUID")
        return value


class MixedBase(Strict):
    base: BaseContext
    current_mode: Literal["protected", "plain", "absent"]
    selected_physical_note_id: int | None = Field(ge=1)
    mixed_metadata_version: Literal[1]

    @field_validator("mixed_metadata_version", mode="before")
    @classmethod
    def exact_version(cls, value):
        if type(value) is not int:
            raise ValueError("integer metadata version required")
        return value


class Read(Access):
    expected_context: str = Field(max_length=4096)
    catalog_digest: str = Field(pattern=HEX)


class Page(Read):
    limit: int = Field(default=100, ge=1, le=500)
    cursor: str | None = Field(default=None, max_length=4096)


class Item(Read):
    kind: str
    representation_id: str
    slot: str
    representation_etag: UID


class Chunk(Item):
    chunk_index: int = Field(ge=0)


class Revision(Read):
    revision_kind: Literal["note_revision", "offline_branch"]
    revision_id: UID


class DrainRef(Strict):
    drain_id: UID
    drain_version: int = Field(ge=1)


class Selection(Strict):
    physical_note_id: int = Field(ge=1)
    inventory_revision_ref: RevisionRef
    note_representation_etag: UID
    inventory_representation_etag: UID


class Prepare(Access):
    mutation_id: UID
    base: MixedBase
    expected_catalog_digest: str = Field(pattern=HEX)
    drain_ref: DrainRef


class PlainQuote(Prepare):
    selection: Selection
    replica_policy: Literal["selected_head_only"]
    target_current_mode: Literal["plain"]


class Reservation(Strict):
    revision_id: UID
    parent_ref: RevisionRef | None
    origin_device_id: str = Field(min_length=1, max_length=120)
    source_representation_kind: Literal["snapshot_v1", "history_envelope_v1"]
    source_representation_epoch: int = Field(ge=0)


class ConversionPrepare(Prepare):
    target_epoch: int = Field(ge=1)
    target_current_mode: Literal["protected", "absent"]
    reserved_branches: list[Reservation]


class Operation(Access):
    operation_id: UID


class Action(Operation):
    lease_version: int = Field(ge=1)


class Manifest(Operation):
    metadata_manifest_digest: str = Field(pattern=HEX)
    section: Literal["S", "DSET", "P", "O"]
    limit: int = Field(default=100, ge=1, le=500)
    cursor: str | None = Field(default=None, max_length=4096)


class Source(Operation):
    metadata_manifest_digest: str = Field(pattern=HEX)
    kind: str
    representation_id: str
    slot: str
    source_etag: UID
    chunk_index: int = Field(ge=0)


class Entry(Operation):
    metadata_manifest_digest: str = Field(pattern=HEX)
    entry_key: RepresentationKey
    source_etag: UID
    target_epoch: int = Field(ge=1)
    total_chunks: int = Field(ge=1)
    total_bytes: int = Field(ge=1)

    @model_validator(mode="after")
    def chunk_count(self):
        if self.total_chunks != (self.total_bytes + 262143) // 262144:
            raise ValueError("invalid chunk count")
        return self


class Upload(Entry):
    chunk_index: int = Field(ge=0)
    chunk_sha256: str = Field(pattern=HEX)
    data_base64: str = Field(max_length=349528)


class Seal(Entry):
    ciphertext_sha256: str = Field(pattern=HEX)


class Staged(Source):
    target_epoch: int = Field(ge=1)


class Commit(Action):
    mutation_id: UID
    base: MixedBase
    metadata_manifest_digest: str = Field(pattern=HEX)
    client_verified_ciphertext_manifest_digest: str = Field(pattern=HEX)
    client_decryption_verified: bool

    @field_validator("client_decryption_verified")
    @classmethod
    def verified(cls, value):
        if value is not True:
            raise ValueError("decryption verification required")
        return value


class PlainCommit(Commit):
    plain_current: SnapshotNote


class ConversionCommit(Commit):
    target_epoch: int = Field(ge=1)
