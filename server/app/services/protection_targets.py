"""Owner-only scope discovery. Never baseline, register devices, or read bodies."""
import base64
import binascii
import json
from uuid import UUID

from sqlalchemy import select

from app.models.note import Note, UserDevice
from app.models.note_crypto import ServerIdentity
from app.models.note_history import NoteHead
from app.services.note_crypto_fence import error
from app.services.note_crypto_storage import strict_object


def encode(value):
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def after_cursor(value, owner, instance):
    if value is None:
        return None
    try:
        raw = base64.b64decode(value + "=" * (-len(value) % 4), altchars=b"-_", validate=True)
        body = json.loads(raw.decode(), object_pairs_hook=strict_object)
        if (not isinstance(body, dict) or set(body) != {"schema_version", "owner_id", "server_instance_id", "after"}
            or type(body["schema_version"]) is not int or body["schema_version"] != 3
            or body["owner_id"] != owner or body["server_instance_id"] != instance
            or not isinstance(body["after"], str) or not 1 <= len(body["after"]) <= 120 or encode(body) != value):
            raise ValueError()
        return body["after"]
    except (ValueError, TypeError, UnicodeError, binascii.Error):
        error("invalid_cursor", 422)


def list_targets(db, body):
    device = db.scalar(select(UserDevice).where(UserDevice.owner_id == body.owner_id, UserDevice.device_id == body.device_id))
    if device is None or not device.is_active:
        error("device_inactive" if device is not None else "device_not_registered", 403)
    instance = db.scalar(select(ServerIdentity.instance_id).where(ServerIdentity.id == 1))
    if instance is None:
        error("server_identity_unavailable")
    try:
        if str(UUID(instance)) != instance:
            raise ValueError()
    except (ValueError, TypeError):
        error("server_identity_unavailable")
    after = after_cursor(body.cursor, body.owner_id, instance)
    has_note = select(Note.id).where(Note.owner_id == NoteHead.owner_id, Note.local_id == NoteHead.local_id).exists()
    statement = select(NoteHead, has_note.label("current_exists")).where(NoteHead.owner_id == body.owner_id)
    if after is not None:
        statement = statement.where(NoteHead.local_id > after)
    rows = list(db.execute(statement.order_by(NoteHead.local_id).limit(body.limit + 1)))
    items = []
    for head, exists in rows[:body.limit]:
        mode = head.current_mode if head.crypto_epoch > 0 else ("plain" if exists else "absent")
        if (not head.local_id or len(head.local_id) > 120 or type(head.crypto_epoch) is not int or head.crypto_epoch < 0
            or head.identity_state not in ("empty", "coherent", "ambiguous", "branch_only", "related_only")
            or head.protection_state not in ("legacy", "protected", "updating", "mixed_updating")
            or mode not in ("plain", "protected", "absent") or (mode == "absent") != (not exists)):
            error("inconsistent_protection_target")
        items.append({"local_id": head.local_id, "identity_state": head.identity_state, "protection_state": head.protection_state,
            "crypto_epoch": head.crypto_epoch, "current_mode": mode, "current_exists": bool(exists)})
    cursor = encode({"schema_version": 3, "owner_id": body.owner_id, "server_instance_id": instance,
        "after": items[-1]["local_id"]}) if len(rows) > body.limit else None
    return {"schema_version": 3, "server_instance_id": instance, "items": items, "next_cursor": cursor}
