from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.note_v2 import Strict
from app.schemas.protected_analysis import BaseContext
from app.schemas.note_v2 import RevisionRef, SnapshotNote
from app.schemas.note_crypto import RepresentationKey
from pydantic import model_validator
from app.schemas.note_protected_write import Structure, Projection, ParentBase

HEX = r"^[0-9a-f]{64}$"
UID = Annotated[str, Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")]


class ProtectionTargetsQuery(Strict):
    schema_version: Literal[3]
    owner_id: str = Field(min_length=1, max_length=80)
    device_id: str = Field(min_length=1, max_length=120)
    limit: int = Field(default=100, ge=1, le=100)
    cursor: str | None = Field(default=None, max_length=4096)


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


class ParentQuery(Access):
    parent_local_id: str = Field(max_length=120)
    child_level: int = Field(ge=1, le=3)
    child_deleted: bool


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


class LegacyParent(Strict):
    kind: Literal["legacy"]
    parent_base: ParentBase
    structure_signature: "ParentSignature"


class ParentSignature(Strict):
    physical_note_id: int = Field(ge=1)
    note_type: str = Field(max_length=40)
    parent_local_id: str | None = Field(max_length=120)
    level: int = Field(ge=1, le=3)
    deleted_at: str | None
    device_id: str = Field(max_length=120)
    created_at: str
    updated_at: str
    client_updated_at: str | None


class MixedParent(Strict):
    kind: Literal["mixed"]
    local_id: str
    context: MixedBase
    catalog_digest: str = Field(pattern=HEX)


class MixedBinding(Strict):
    server_instance_id: UID
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    transition_id: UID
    crypto_epoch: int = Field(ge=1)
    destination_key: RepresentationKey
    revision_ref: RevisionRef | None
    parent_ref: RevisionRef | None


class MixedDescriptor(Strict):
    key: RepresentationKey
    representation_kind: Literal["snapshot_v1", "history_envelope_v1", "content_encrypted_v1", "linked_text_envelope_v1", "plain_text_v1"]
    representation_epoch: int = Field(ge=0)
    is_null: bool
    representation_version: int = Field(ge=1)
    representation_etag: UID
    storage_operation_id: UID | None
    semantic_origin_id: UID | None
    origin_validator: Literal["body_v1", "native_v1", "a2a_pre_origin_v0", "linked_v1", "body_mixed_v1", "native_mixed_v1", "linked_mixed_v1"]
    origin_row_required: bool
    expected_binding: MixedBinding | None
    revision_ref: RevisionRef | None
    parent_ref: RevisionRef | None
    physical_note_id: int | None = Field(ge=1)
    inventory_revision_id: UID | None
    linked_slot_version: int | None = Field(ge=0)
    ciphertext_sha256: str | None = Field(pattern=HEX)


class RestoreSource(Strict):
    revision_ref: RevisionRef
    descriptor: MixedDescriptor


class WriteQuote(Access):
    mutation_id: UID
    base: MixedBase
    expected_catalog_digest: str = Field(pattern=HEX)
    operation: Literal["put", "delete", "create", "restore"]
    target_current_mode: Literal["plain", "protected"]
    selection: Selection | None
    replica_policy: Literal["selected_head_only"]
    structure: Structure
    parent_context: LegacyParent | MixedParent | None
    restore_source: RestoreSource | None


class WriteManifest(Manifest):
    section: Literal["S", "DSET", "P", "O", "existing", "verified_existing"]


class WriteCommit(Commit):
    projection: Projection
    plain_after: SnapshotNote | None
    plain_before: SnapshotNote | None


class ImportProvenance(Strict):
    origin_server_instance_id: UID
    origin_owner_id: str = Field(min_length=1, max_length=80)


class DraftProvenance(ImportProvenance):
    kind: Literal["post_plain_draft"]
    mode_operation_id: UID
    mode_receipt_digest: str = Field(pattern=HEX)


class CipherProvenance(ImportProvenance):
    kind: Literal["cipher_branch"]
    origin_storage_operation_id: UID | None


class PlainProvenance(ImportProvenance):
    kind: Literal["plain_branch"]
    origin_revision_ref: RevisionRef | None


class MixedImportEntry(Strict):
    revision_id: UID
    parent_ref: RevisionRef | None
    origin_device_id: str = Field(min_length=1, max_length=120)
    source_kind: Literal["snapshot_v1", "history_envelope_v1"]
    source_epoch: int = Field(ge=0)
    target_kind: Literal["snapshot_v1", "history_envelope_v1"]
    target_epoch: int = Field(ge=0)
    expected_existing: MixedDescriptor | None
    provenance: Annotated[DraftProvenance | CipherProvenance | PlainProvenance, Field(discriminator="kind")]


class MixedImportPrepare(Access):
    mutation_id: UID
    base: MixedBase
    expected_catalog_digest: str = Field(pattern=HEX)
    entries: list[MixedImportEntry] = Field(min_length=1)


class PlainImportEntry(Strict):
    revision_id: UID
    snapshot: SnapshotNote


class ExistingCipherEntry(Strict):
    revision_id: UID
    ciphertext_sha256: str = Field(pattern=HEX)


class MixedImportCommit(Commit):
    client_verified_existing_set_digest: str = Field(pattern=HEX)
    plain_entries: list[PlainImportEntry]
    existing_ciphertexts: list[ExistingCipherEntry]


class ConversionCommit(Commit):
    target_epoch: int = Field(ge=1)
