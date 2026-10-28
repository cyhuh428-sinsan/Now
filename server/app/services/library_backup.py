"""Stage D 백업 검증과 충돌 시 전체 중단하는 오프라인 복구."""
import json
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.library import LibraryMutation, LibraryResource
from app.services.library import validate_payload


def export_library(db: Session):
    # 자원과 재시도 응답이 같은 시점의 snapshot에 속해야 한다.
    with db.bind.connect() as connection:
        if connection.dialect.name == "postgresql":
            connection = connection.execution_options(isolation_level="REPEATABLE READ")
        with Session(connection) as snapshot:
            if connection.dialect.name == "sqlite":
                snapshot.execute(text("BEGIN"))
            return {
                model.__tablename__: [
                    {column.name: getattr(row, column.name) for column in model.__table__.columns}
                    for row in snapshot.scalars(select(model)).all()
                ]
                for model in (LibraryResource, LibraryMutation)
            }


class ResourceBackup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    owner_id: str = Field(min_length=1, max_length=80)
    kind: Literal["templates", "saved-queries"]
    id: UUID
    schema_version: Literal[1]
    version: int = Field(ge=1)
    payload_json: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class MutationBackup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    owner_id: str = Field(min_length=1, max_length=80)
    mutation_id: UUID
    request_hash: str = Field(pattern="^[0-9a-f]{64}$")
    response_json: str


def validate_library_backup(backup):
    if backup.get("backup_schema_version") == 1:
        if any(key in backup.get("items", {}) for key in ("library_resources", "library_mutations")):
            raise ValueError("v1 backup cannot contain Stage D sections")
        return [], []
    items = backup.get("items", {})
    resources = [ResourceBackup.model_validate(row) for row in items["library_resources"]]
    mutations = [MutationBackup.model_validate(row) for row in items["library_mutations"]]
    resource_keys = set()
    active_counts = {}
    for row in resources:
        key = (row.owner_id, row.kind, str(row.id))
        if key in resource_keys:
            raise ValueError("duplicate resource")
        resource_keys.add(key)
        if row.deleted_at is None:
            validate_payload(row.kind, json.loads(row.payload_json))
            count_key = (row.owner_id, row.kind)
            active_counts[count_key] = active_counts.get(count_key, 0) + 1
            if active_counts[count_key] > 100:
                raise ValueError("resource limit exceeded")
        elif row.payload_json is not None:
            raise ValueError("tombstone payload must be null")
        for date in (row.created_at, row.updated_at, row.deleted_at):
            if date and date.tzinfo is not None and date.utcoffset().total_seconds() != 0:
                raise ValueError("backup timestamps must be UTC")
    mutation_keys = set()
    for row in mutations:
        key = (row.owner_id, str(row.mutation_id))
        if key in mutation_keys:
            raise ValueError("duplicate mutation")
        mutation_keys.add(key)
        response = json.loads(row.response_json)
        resource = response["resource"]
        if set(response) != {"status", "resource", "mutation_id"}:
            raise ValueError("invalid mutation fields")
        if set(resource) != {"id", "owner_id", "schema_version", "version", "payload",
                             "created_at", "updated_at", "deleted_at"}:
            raise ValueError("invalid resource response fields")
        valid_snapshot = False
        for current in resources:
            if current.owner_id != row.owner_id or str(current.id) != resource["id"]:
                continue
            try:
                values = {**resource, "kind": current.kind,
                          "payload_json": json.dumps(resource["payload"], ensure_ascii=False)
                          if resource["payload"] is not None else None}
                values.pop("payload")
                parsed = ResourceBackup.model_validate(values)
                if parsed.version > current.version:
                    continue
                if parsed.deleted_at is None:
                    validate_payload(current.kind, resource["payload"])
                elif resource["payload"] is not None:
                    continue
                valid_snapshot = True
                break
            except Exception:
                continue
        if not valid_snapshot:
            raise ValueError("invalid mutation snapshot")
        if (response["status"] != "ok" or response["mutation_id"] != str(row.mutation_id)
                or resource["owner_id"] != row.owner_id
                or not any(k[0] == row.owner_id and k[2] == resource["id"] for k in resource_keys)):
            raise ValueError("invalid mutation response")
    return resources, mutations


def restore_library(db: Session, backup: dict):
    from app.api.admin import _verify_backup_payload

    if any(check["status"] != "ok" for check in _verify_backup_payload(backup)):
        raise ValueError("invalid backup")
    resources, mutations = validate_library_backup(backup)
    try:
        # 대상 DB의 기존 자원을 덮어쓰지 않는다. 중복이 하나라도 있으면 전체 취소한다.
        for row in resources:
            if db.get(LibraryResource, (row.owner_id, row.kind, str(row.id))):
                raise ValueError("resource already exists")
        for row in mutations:
            if db.get(LibraryMutation, (row.owner_id, str(row.mutation_id))):
                raise ValueError("mutation already exists")
        additions = {}
        for row in resources:
            if row.deleted_at is None:
                key = (row.owner_id, row.kind)
                additions[key] = additions.get(key, 0) + 1
        for (owner, kind), count in additions.items():
            existing = db.scalar(select(func.count()).select_from(LibraryResource).where(
                LibraryResource.owner_id == owner, LibraryResource.kind == kind,
                LibraryResource.deleted_at.is_(None)))
            if existing + count > 100:
                raise ValueError("resource limit exceeded")
        for row in resources:
            values = row.model_dump()
            values["id"] = str(row.id)
            for name in ("created_at", "updated_at", "deleted_at"):
                if values[name]:
                    values[name] = values[name].replace(tzinfo=None)
            db.add(LibraryResource(**values))
        for row in mutations:
            values = row.model_dump()
            values["mutation_id"] = str(row.mutation_id)
            db.add(LibraryMutation(**values))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"library_resources": len(resources), "library_mutations": len(mutations)}
