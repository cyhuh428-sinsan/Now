import hashlib
import json
from datetime import datetime, timezone
from secrets import compare_digest

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.library import LibraryMutation, LibraryResource
from app.models.note import UserAccount, UserDevice
from app.schemas.library import CanvasPayload, QueryPayload, TemplatePayload
from app.schemas.wiki import WikiLink
from app.services.user_accounts import hash_access_token, require_web_session_access


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def error(code, status=409, **extra):
    raise HTTPException(status_code=status, detail={"code": code, **extra})


def library_user(db, owner_id, user_token, web_token):
    owner_id = owner_id.strip()
    if web_token:
        user = require_web_session_access(db, owner_id=owner_id, session_token=web_token)
    elif user_token:
        user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
        hashed = hash_access_token(user_token.strip())
        device = db.scalar(select(UserDevice).where(
            UserDevice.owner_id == owner_id, UserDevice.access_token_hash == hashed))
        if user is None or not (device or (
            user.access_token_hash and compare_digest(hashed, user.access_token_hash))):
            error("invalid_user_token", 401)
        if device is not None and not device.is_active:
            error("device_inactive", 403)
        if not user.is_active:
            error("user_inactive", 403)
    else:
        error("user_auth_required", 401)
    db.commit()
    return user.owner_id


def validate_payload(kind, payload):
    models = {"templates": TemplatePayload, "saved-queries": QueryPayload, "canvases": CanvasPayload, "wikis": WikiLink}
    if kind not in models:
        error("invalid_resource_kind", 422)
    limit = {"templates": 1024 * 1024, "saved-queries": 16 * 1024, "canvases": 2 * 1024 * 1024, "wikis": 256 * 1024}[kind]
    try:
        encoded = canonical(payload)
    except (ValueError, TypeError):
        error("invalid_payload", 422)
    if len(encoded.encode("utf-8")) > limit:
        error("payload_too_large", 413)
    if kind == "templates" and isinstance(payload.get("content_template"), str):
        if "NOW_ENCRYPTED_V1:" in payload["content_template"]:
            error("encrypted_template_forbidden", 422)
    model = models[kind]
    from pydantic import ValidationError
    try:
        model.model_validate(payload)
    except ValidationError:
        error("invalid_payload", 422)
    return encoded


def resource_payload(row):
    def timestamp(value):
        return value.replace(tzinfo=timezone.utc).isoformat() if value else None
    return {"id": row.id, "owner_id": row.owner_id, "schema_version": row.schema_version,
            "version": row.version, "payload": json.loads(row.payload_json) if row.payload_json else None,
            "created_at": timestamp(row.created_at), "updated_at": timestamp(row.updated_at),
            "deleted_at": timestamp(row.deleted_at)}


def mutate(db: Session, *, owner_id, kind, resource_id, body, deleting=False):
    encoded_payload = None if deleting else validate_payload(kind, body.payload)
    request_hash = hashlib.sha256(canonical({
        "kind": kind, "id": resource_id, "deleting": deleting,
        "body": body.model_dump(),
    }).encode("utf-8")).hexdigest()
    try:
        # 사용자별 상한, CAS, 재시도 원장을 한 직렬화 경계에서 갱신한다.
        if db.bind.dialect.name == "sqlite":
            db.execute(text("BEGIN IMMEDIATE"))
        else:
            db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id).with_for_update())
        previous = db.get(LibraryMutation, (owner_id, body.mutation_id))
        if previous:
            if previous.request_hash != request_hash:
                error("idempotency_mismatch")
            result = json.loads(previous.response_json)
            db.commit()
            return result
        row = db.get(LibraryResource, (owner_id, kind, resource_id))
        if row is None:
            if deleting:
                error("resource_not_found", 404)
            if body.base_version != 0:
                error("version_conflict", current_version=0)
            count = db.scalar(select(func.count()).select_from(LibraryResource).where(
                LibraryResource.owner_id == owner_id, LibraryResource.kind == kind,
                LibraryResource.deleted_at.is_(None)))
            if count >= resource_limit(kind):
                error("resource_limit")
            row = LibraryResource(owner_id=owner_id, kind=kind, id=resource_id,
                                  version=0, created_at=datetime.now(timezone.utc).replace(tzinfo=None))
            db.add(row)
        elif row.deleted_at is not None:
            error("resource_deleted")
        if row.version != body.base_version:
            error("version_conflict", current_version=row.version)
        row.version += 1
        row.schema_version = 1
        row.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        row.payload_json = encoded_payload
        if deleting:
            row.deleted_at = row.updated_at
        result = {"status": "ok", "resource": resource_payload(row), "mutation_id": body.mutation_id}
        db.add(LibraryMutation(owner_id=owner_id, mutation_id=body.mutation_id,
                               request_hash=request_hash, response_json=canonical(result)))
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise


def resource_limit(kind):
    return 12 if kind == "canvases" else 100
