from typing import Annotated, Literal

from pydantic import Field, field_validator

from app.schemas.note_v2 import Strict
from app.schemas.note_mixed import Access, MixedBase, MixedDescriptor, UID, HEX, Commit
from app.schemas.mixed_analysis import Bundle


class ExecutionReference(Strict):
    execution_id: UID
    terminal_run_version: int = Field(ge=1)
    terminal_receipt_digest: str = Field(pattern=HEX)
    original_bundle_digest: str = Field(pattern=HEX)


class E1(ExecutionReference):
    schema_version: Literal[1]


class E3(ExecutionReference):
    schema_version: Literal[3]


Reference = Annotated[E1 | E3, Field(discriminator="schema_version")]


class Write(Access):
    mutation_id: UID
    base: MixedBase
    expected_catalog_digest: str = Field(pattern=HEX)


class Initial(Write):
    execution_ref: E3
    bundle_metadata: Bundle


class Transcript(Write):
    recording_id: int = Field(ge=1, le=2147483647)
    expected_descriptor: MixedDescriptor
    is_null: bool


class Replan(Write):
    execution_ref: Reference
    previous_write_id: UID | None
    previous_write_state: Literal["none", "stale", "aborted", "expired"]
    target_epoch: int = Field(ge=1)
    confirmed_reuse_original_result: Literal[True]

    @field_validator("confirmed_reuse_original_result", mode="before")
    @classmethod
    def confirmed(cls, value):
        if type(value) is not bool or value is not True:
            raise ValueError("explicit original result reuse required")
        return value


class LinkedCommit(Commit):
    target_epoch: int = Field(ge=1)


class LegacyDispatchReceipt(Strict):
    execution_id: UID
    dispatch_id: UID
    source_digest: str = Field(pattern=HEX)
    run_version: int = Field(ge=1)


class LegacyTerminalReceipt(Strict):
    execution_id: UID
    original_job_id: int = Field(ge=1, le=2147483647)
    dispatch_id: UID | None
    source_digest: str = Field(pattern=HEX)
    terminal_run_version: int = Field(ge=1)
    outcome: Literal["done", "failed", "result_unavailable", "cancelled"]
    bundle_digest: str | None = Field(pattern=HEX)
    client_reported: Literal[True]
    external_settled: Literal[True]
    result_server_persisted: Literal[False]

    @field_validator("client_reported", "external_settled", "result_server_persisted", mode="before")
    @classmethod
    def exact_flag(cls, value):
        if type(value) is not bool:
            raise ValueError("boolean receipt flag required")
        return value
