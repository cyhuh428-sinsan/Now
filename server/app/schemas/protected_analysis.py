from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.note_v2 import Strict, uuid_text
from app.schemas.note_crypto import RepresentationKey

HEX = r"^[0-9a-f]{64}$"


class BaseContext(Strict):
    head_version: int = Field(ge=0)
    head_revision_id: str | None
    crypto_epoch: int = Field(ge=0)
    history_generation: int = Field(ge=0)
    protection_state: Literal["legacy", "protected"]
    inventory_revision_ids: list[str]
    identity_state: Literal["coherent", "ambiguous", "branch_only", "related_only"]
    current_exists: bool
    _ref = field_validator("head_revision_id")(uuid_text)


class SourceContext(Strict):
    server_instance_id: str
    base: BaseContext
    catalog_digest: str = Field(pattern=HEX)
    _id = field_validator("server_instance_id")(uuid_text)


class SourceKey(Strict):
    key: RepresentationKey
    representation_etag: str = Field(pattern=HEX)
    slot_version: int | None = Field(ge=0)
    ciphertext_sha256: str | None = Field(pattern=HEX)
    is_null: bool


class Scope(Strict):
    schema_version: Literal[1]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    server_instance_id: str
    _instance = field_validator("server_instance_id")(uuid_text)

    @model_validator(mode="before")
    @classmethod
    def exact_confirmation(cls, value):
        if isinstance(value, dict):
            for field in ("client_execution_confirmed", "provider_terminal_observed", "confirmed_reuse_original_result"):
                if field in value and type(value[field]) is not bool:
                    raise ValueError("confirmation must be boolean")
        return value


class Claim(Scope):
    mutation_id: str
    source_context: SourceContext
    job_type: str = Field(min_length=1, max_length=60)
    prompt_version: Literal["single_source_v1"]
    source_job_id: int | None = Field(ge=1, le=2147483647)
    source_keys: list[SourceKey] = Field(min_length=1)
    execution_route: Literal["client_provider"]
    client_execution_confirmed: Literal[True]
    _mutation = field_validator("mutation_id")(uuid_text)


class ClaimAction(Scope):
    execution_id: str
    run_version: int = Field(ge=1)
    lease_version: int = Field(ge=1)
    _id = field_validator("execution_id")(uuid_text)


class Dispatch(ClaimAction):
    source_digest: str = Field(pattern=HEX)


class NullSlot(Strict):
    key: RepresentationKey
    is_null: bool


class CipherRecord(Strict):
    entry_key: RepresentationKey
    destination_key: RepresentationKey
    source_etag: str
    output_kind: Literal["linked_text_envelope_v1"]
    target_epoch: int = Field(ge=1)
    total_bytes: int = Field(ge=1)
    ciphertext_sha256: str = Field(pattern=HEX)
    _etag = field_validator("source_etag")(uuid_text)


class Bundle(Strict):
    source_digest: str = Field(pattern=HEX)
    original_job_id: int = Field(ge=1, le=2147483647)
    original_epoch: int = Field(ge=1)
    outcome: Literal["done", "failed"]
    error_code: Literal["provider_error", "invalid_result"] | None
    slot_nulls: list[NullSlot]
    ciphertext_manifest: list[CipherRecord]
    bundle_digest: str = Field(pattern=HEX)


class Settle(ClaimAction):
    dispatch_id: str
    provider_terminal_observed: Literal[True]
    outcome: Literal["done", "failed", "result_unavailable"]
    bundle_metadata: Bundle | None
    local_checkpoint_confirmed: bool
    unavailable_reason: Literal["key_unavailable", "cipher_store_failed", "response_lost"] | None
    _dispatch = field_validator("dispatch_id")(uuid_text)


class ResultPrepare(Scope):
    mutation_id: str
    execution_id: str
    terminal_run_version: int = Field(ge=1)
    terminal_receipt_digest: str = Field(pattern=HEX)
    base: BaseContext
    bundle_metadata: Bundle
    _ids = field_validator("mutation_id", "execution_id")(uuid_text)


class Replan(Scope):
    mutation_id: str
    execution_id: str
    terminal_receipt_digest: str = Field(pattern=HEX)
    original_bundle_digest: str = Field(pattern=HEX)
    previous_write_id: str | None
    previous_write_state: Literal["none", "stale", "aborted", "expired"]
    base: BaseContext
    target_epoch: int = Field(ge=1)
    confirmed_reuse_original_result: Literal[True]
    _ids = field_validator("mutation_id", "execution_id", "previous_write_id")(uuid_text)


class TranscriptPrepare(Scope):
    mutation_id: str
    base: BaseContext
    recording_id: int = Field(ge=1)
    expected_slot_version: int = Field(ge=0)
    expected_representation_etag: str = Field(pattern=HEX)
    is_null: bool
    _mutation = field_validator("mutation_id")(uuid_text)


class WriteAction(Scope):
    write_id: str
    lease_version: int = Field(ge=1)
    _write = field_validator("write_id")(uuid_text)


class Commit(Scope):
    write_id: str
    mutation_id: str
    target_epoch: int = Field(ge=1)
    metadata_manifest_digest: str = Field(pattern=HEX)
    client_verified_ciphertext_manifest_digest: str = Field(pattern=HEX)
    _ids = field_validator("write_id", "mutation_id")(uuid_text)
