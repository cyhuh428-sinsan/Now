from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.capabilities import MAX_TREE_NOTE_LEVEL


def uuid_text(value):
    if value is None:
        return None
    return str(UUID(value))


def timestamp(value):
    if value is None:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timezone required")
    return parsed.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    @model_validator(mode="before")
    @classmethod
    def exact_schema_type(cls, value):
        if isinstance(value, dict) and "schema_version" in value and type(value["schema_version"]) is not int:
            raise ValueError("schema_version must be an integer")
        return value


class RevisionRef(Strict):
    kind: Literal["note_revision", "offline_branch"]
    id: str
    _id = field_validator("id")(uuid_text)


class NoteValue(Strict):
    note_type: str = Field(max_length=40)
    title: str = Field(max_length=240)
    content: str
    parent_local_id: str | None = Field(default=None, max_length=120)
    level: int = Field(default=1, ge=1, le=MAX_TREE_NOTE_LEVEL)
    tags: str | None = None
    source: str | None = Field(default=None, max_length=80)
    deleted_at: str | None = None
    _deleted = field_validator("deleted_at")(timestamp)


class SnapshotNote(NoteValue):
    id: int | None = Field(ge=1)
    owner_id: str = Field(min_length=1, max_length=80)
    device_id: str = Field(max_length=120)
    local_id: str = Field(max_length=120)
    parent_local_id: str | None = Field(max_length=120)
    level: int = Field(ge=1, le=MAX_TREE_NOTE_LEVEL)
    tags: str | None
    source: str | None = Field(max_length=80)
    deleted_at: str | None
    client_updated_at: str | None
    created_at: str
    updated_at: str
    _dates = field_validator("client_updated_at", "created_at", "updated_at")(timestamp)


class Snapshot(Strict):
    schema_version: Literal[1]
    note: SnapshotNote


class Mutation(Strict):
    schema_version: Literal[1]
    owner_id: str = Field(min_length=1, max_length=80)
    local_id: str = Field(max_length=120)
    device_id: str = Field(min_length=1, max_length=120)
    mutation_id: str
    crypto_epoch: int = Field(ge=0)
    _id = field_validator("mutation_id")(uuid_text)


class HeadMutation(Mutation):
    base_head_version: int = Field(ge=0)
    base_revision_id: str | None
    expected_inventory_revision_ids: list[str]
    replica_policy: Literal["selected_head_only"] | None = None
    _revision = field_validator("base_revision_id")(uuid_text)

    @field_validator("expected_inventory_revision_ids")
    @classmethod
    def inventory(cls, values):
        parsed = [uuid_text(value) for value in values]
        if len(parsed) != len(set(parsed)):
            raise ValueError("duplicate inventory revision")
        return sorted(parsed)


class PutNote(HeadMutation):
    note: NoteValue


class RestoreNote(HeadMutation):
    target_ref: RevisionRef


class BranchEntry(Strict):
    revision_id: str
    parent_ref: RevisionRef | None
    snapshot: Snapshot
    _id = field_validator("revision_id")(uuid_text)


class ImportBranches(Mutation):
    entries: list[BranchEntry] = Field(min_length=1)
