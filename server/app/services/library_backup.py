"""Stage D 백업 검증과 충돌 시 전체 중단하는 오프라인 복구."""
import json
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.library import LibraryMutation, LibraryResource
from app.services.library import resource_limit, validate_payload


def export_library(db: Session):
    # 자원과 재시도 응답이 같은 시점의 snapshot에 속해야 한다.
    with db.bind.connect() as connection:
        if connection.dialect.name == "postgresql":
            connection = connection.execution_options(isolation_level="REPEATABLE READ")
        with Session(connection) as snapshot:
            if connection.dialect.name == "sqlite":
                snapshot.execute(text("BEGIN"))
            if snapshot.scalar(select(LibraryResource).where(
                    (LibraryResource.kind=="wiki-operations") | (LibraryResource.schema_version==2)).limit(1)) is not None:
                raise HTTPException(status_code=409,detail={"code":"wiki_requires_v3_backup"})
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
    kind: Literal["templates", "saved-queries", "canvases", "wikis", "wiki-operations"]
    id: UUID
    schema_version: Literal[1,2]
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


def validate_wiki_link(owner, ident, payload, schema_version=1):
    from app.schemas.wiki import WikiLink, WikiLinkV2, digest
    value = (WikiLinkV2 if schema_version==2 else WikiLink).model_validate(payload)
    if schema_version==2 and value.lineage_manifest_hash!=digest(value.model_dump(exclude={"lineage_manifest_hash"})):
        raise ValueError("invalid wiki lineage hash")
    if value.artifact_local_id != "wiki:" + str(ident) or any(ref.owner_id != owner for ref in value.dependencies):
        raise ValueError("invalid wiki index")
    return {(ref.owner_id, ref.local_id) for ref in value.dependencies}


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
    operation_ids={}
    operation_counts={}
    for row in resources:
        key = (row.owner_id, row.kind, str(row.id))
        if key in resource_keys:
            raise ValueError("duplicate resource")
        resource_keys.add(key)
        if (row.kind=="wiki-operations" or row.schema_version==2) and backup.get("backup_schema_version")!=3:
            raise ValueError("wiki_requires_v3_backup")
        if row.schema_version==2 and row.kind!="wikis":raise ValueError("invalid resource schema")
        if row.kind=="wiki-operations":
            from app.schemas.wiki_operations import OperationRecord
            from app.services.wiki_operations import phases, fingerprint
            record=OperationRecord.model_validate_json(row.payload_json)
            body=record.manifest
            if body.owner_id!=row.owner_id or body.operation_id!=str(row.id) or row.deleted_at is not None:
                raise ValueError("invalid wiki operation")
            count,active=operation_counts.get(row.owner_id,(0,0))
            operation_counts[row.owner_id]=(count+1,active+int(record.state=="prepared"))
            if count+1>2000 or active+int(record.state=="prepared")>100 or (count+1)*131072>256*1024*1024:
                raise ValueError("wiki operation limit")
            for ident,phase,wiki in phases(body):
                phase_key=(row.owner_id,ident)
                if phase_key in operation_ids:raise ValueError("duplicate wiki operation mutation")
                operation_ids[phase_key]=(record,phase,wiki,fingerprint(body,phase,wiki))
            continue
        if row.kind == "wikis":
            if row.schema_version==1:validate_payload(row.kind, json.loads(row.payload_json))
            if len(row.payload_json.encode("utf-8"))>256*1024:raise ValueError("wiki index limit")
            validate_wiki_link(row.owner_id, row.id, json.loads(row.payload_json),row.schema_version)
        if row.deleted_at is None:
            if row.schema_version==1:validate_payload(row.kind, json.loads(row.payload_json))
            count_key = (row.owner_id, row.kind)
            active_counts[count_key] = active_counts.get(count_key, 0) + 1
            if active_counts[count_key] > resource_limit(row.kind):
                raise ValueError("resource limit exceeded")
        elif row.payload_json is not None and row.kind != "wikis":
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
        if key in operation_ids:
            record,phase,wiki,hashed=operation_ids[key]
            if row.request_hash!=hashed or response.get("operation_id")!=record.manifest.operation_id or response.get("manifest_hash")!=record.manifest.manifest_hash:
                raise ValueError("invalid wiki operation receipt")
            continue  # Full state/revision checks run in the v3 isolated validation DB.
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
                if current.kind == "wikis":
                    prior = validate_wiki_link(row.owner_id, current.id, resource["payload"],parsed.schema_version)
                    present = validate_wiki_link(current.owner_id, current.id, json.loads(current.payload_json),current.schema_version)
                    if not prior.issubset(present):
                        continue
                if parsed.deleted_at is None:
                    if parsed.schema_version==1:validate_payload(current.kind, resource["payload"])
                elif resource["payload"] is not None and current.kind != "wikis":
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

    # Wiki indexes cannot be separated from protected Note history and receipts.
    if any(row.get("kind") in ("wikis","wiki-operations") for row in backup.get("items", {}).get("library_resources", [])):
        raise ValueError("wiki_requires_v3_backup")
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
            if existing + count > resource_limit(kind):
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
