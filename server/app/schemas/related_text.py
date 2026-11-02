from typing import Literal

from pydantic import Field, field_validator

from app.schemas.note_v2 import Strict, uuid_text
from app.schemas.note_crypto import PrepareTransition, CommitTransition


class DrainPrepare(Strict):
    schema_version: Literal[1, 2]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    mutation_id: str
    server_instance_id: str
    crypto_epoch: int = Field(ge=0)
    expected_history_generation: int = Field(ge=0)
    _ids = field_validator("mutation_id", "server_instance_id")(uuid_text)


class DrainAction(Strict):
    schema_version: Literal[1]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    server_instance_id: str
    drain_id: str
    drain_version: int = Field(ge=1)
    lease_version: int = Field(ge=1)
    _ids = field_validator("server_instance_id", "drain_id")(uuid_text)


class PrepareRelated(PrepareTransition):
    schema_version: Literal[2]
    drain_id: str
    drain_version: int = Field(ge=1)
    linked_metadata_version: Literal[1]
    _drain = field_validator("drain_id")(uuid_text)


class CommitRelated(CommitTransition):
    schema_version: Literal[2]
    drain_id: str
    drain_version: int = Field(ge=1)
    linked_metadata_version: Literal[1]
    _drain = field_validator("drain_id")(uuid_text)
