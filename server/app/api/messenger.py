from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.note import (
    GroupMessage,
    MessengerAttachment,
    MessengerMessage,
    MessengerRoom,
    MessengerRoomMember,
    UserAccount,
)
from app.services.messenger_storage import (
    messenger_upload_policy,
    resolve_messenger_attachment_path,
    save_messenger_attachment,
)
from app.services.user_accounts import require_web_session_access

router = APIRouter(prefix="/api/v1/messenger", tags=["messenger"])


class MessengerRoomCreate(BaseModel):
    owner_id: str = Field(max_length=80)
    name: str | None = Field(default=None, max_length=120)
    member_owner_ids: list[str] = Field(min_length=1, max_length=30)


class MessengerMessageCreate(BaseModel):
    owner_id: str = Field(max_length=80)
    body: str = Field(min_length=1, max_length=2000)


class MessengerReadUpdate(BaseModel):
    owner_id: str = Field(max_length=80)
    last_read_message_id: int = Field(ge=0)


@router.get("/policy")
def messenger_policy() -> dict:
    return {"status": "ok", **messenger_upload_policy()}


@router.get("/rooms")
def list_rooms(
    owner_id: str = Query(max_length=80),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _session_user(db, owner_id=owner_id, token=web_session_token)
    group_room = _ensure_group_room(db, user)
    _migrate_group_messages(db, room=group_room, group_name=user.group_name)
    rooms = list(
        db.scalars(
            select(MessengerRoom)
            .join(MessengerRoomMember, MessengerRoomMember.room_id == MessengerRoom.id)
            .where(
                MessengerRoom.group_name == user.group_name,
                MessengerRoom.is_active == 1,
                MessengerRoomMember.owner_id == user.owner_id,
                MessengerRoomMember.is_active == 1,
            )
            .order_by(MessengerRoom.updated_at.desc(), MessengerRoom.id.asc())
        ).all()
    )
    memberships = {
        item.room_id: item
        for item in db.scalars(
            select(MessengerRoomMember).where(MessengerRoomMember.owner_id == user.owner_id)
        ).all()
    }
    db.commit()
    return {
        "status": "ok",
        "group_name": user.group_name,
        "rooms": [_room_payload(db, room, memberships.get(room.id), user.owner_id) for room in rooms],
    }


@router.get("/rooms/unread")
def list_room_unread_counts(
    owner_id: str = Query(max_length=80),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _session_user(db, owner_id=owner_id, token=web_session_token)
    group_room = _ensure_group_room(db, user)
    _migrate_group_messages(db, room=group_room, group_name=user.group_name)
    rooms = list(
        db.scalars(
            select(MessengerRoom)
            .join(MessengerRoomMember, MessengerRoomMember.room_id == MessengerRoom.id)
            .where(
                MessengerRoom.group_name == user.group_name,
                MessengerRoom.is_active == 1,
                MessengerRoomMember.owner_id == user.owner_id,
                MessengerRoomMember.is_active == 1,
            )
            .order_by(MessengerRoom.updated_at.desc(), MessengerRoom.id.asc())
        ).all()
    )
    memberships = {
        item.room_id: item
        for item in db.scalars(
            select(MessengerRoomMember).where(MessengerRoomMember.owner_id == user.owner_id)
        ).all()
    }
    unread_rooms = [_room_payload(db, room, memberships.get(room.id), user.owner_id) for room in rooms]
    db.commit()
    return {
        "status": "ok",
        "group_name": user.group_name,
        "total_unread_count": sum(int(room["unread_count"]) for room in unread_rooms),
        "rooms": unread_rooms,
    }


@router.post("/rooms")
def create_room(
    payload: MessengerRoomCreate,
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _session_user(db, owner_id=payload.owner_id, token=web_session_token)
    member_ids = {item.strip()[:80] for item in payload.member_owner_ids if item.strip()}
    member_ids.add(user.owner_id)
    valid_users = list(
        db.scalars(
            select(UserAccount).where(
                UserAccount.owner_id.in_(member_ids),
                UserAccount.group_name == user.group_name,
                UserAccount.is_active == 1,
            )
        ).all()
    )
    valid_ids = {item.owner_id for item in valid_users}
    if user.owner_id not in valid_ids or len(valid_ids) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="at least two room members required")
    room_name = (payload.name or "").strip()[:120]
    if not room_name:
        room_name = ", ".join(sorted(valid_ids - {user.owner_id})[:3])
    room = MessengerRoom(
        group_name=user.group_name,
        room_type="private",
        name=room_name,
        created_by=user.owner_id,
        updated_at=datetime.utcnow(),
    )
    db.add(room)
    db.flush()
    for owner_id in sorted(valid_ids):
        db.add(
            MessengerRoomMember(
                room_id=room.id,
                owner_id=owner_id,
                role="owner" if owner_id == user.owner_id else "member",
            )
        )
    db.commit()
    return {"status": "ok", "room": _room_payload(db, room, None, user.owner_id)}


@router.get("/rooms/{room_id}/messages")
def list_messages(
    room_id: int,
    owner_id: str = Query(max_length=80),
    limit: int = Query(default=50, ge=1, le=100),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _session_user(db, owner_id=owner_id, token=web_session_token)
    room, member = _require_room_member(db, room_id=room_id, user=user)
    if room.room_type == "group":
        _migrate_group_messages(db, room=room, group_name=user.group_name)
    messages = list(
        db.scalars(
            select(MessengerMessage)
            .where(MessengerMessage.room_id == room.id, MessengerMessage.deleted_at.is_(None))
            .order_by(MessengerMessage.created_at.desc(), MessengerMessage.id.desc())
            .limit(limit)
        ).all()
    )
    users = _users_by_owner_id(db, {message.sender_owner_id for message in messages})
    attachment_rows = list(
        db.scalars(
            select(MessengerAttachment).where(
                MessengerAttachment.message_id.in_([message.id for message in messages] or [0]),
                MessengerAttachment.deleted_at.is_(None),
            )
        ).all()
    )
    attachments_by_message: dict[int, list[MessengerAttachment]] = {}
    for attachment in attachment_rows:
        attachments_by_message.setdefault(attachment.message_id, []).append(attachment)
    db.commit()
    return {
        "status": "ok",
        "room": _room_payload(db, room, member, user.owner_id),
        "items": [
            _message_payload(message, users, attachments_by_message)
            for message in reversed(messages)
        ],
    }


@router.post("/rooms/{room_id}/messages")
def create_message(
    room_id: int,
    payload: MessengerMessageCreate,
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _session_user(db, owner_id=payload.owner_id, token=web_session_token)
    room, _member = _require_room_member(db, room_id=room_id, user=user)
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message body required")
    message = MessengerMessage(room_id=room.id, sender_owner_id=user.owner_id, body=body)
    room.updated_at = datetime.utcnow()
    db.add(message)
    db.commit()
    db.refresh(message)
    return {"status": "ok", "item": _message_payload(message, {user.owner_id: user}, {})}


@router.post("/rooms/{room_id}/attachments")
async def upload_attachment(
    room_id: int,
    owner_id: str = Query(max_length=80),
    body: str = Query(default="", max_length=2000),
    file: UploadFile = File(...),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _session_user(db, owner_id=owner_id, token=web_session_token)
    room, _member = _require_room_member(db, room_id=room_id, user=user)
    message = MessengerMessage(room_id=room.id, sender_owner_id=user.owner_id, body=body.strip())
    db.add(message)
    db.flush()
    saved = await save_messenger_attachment(
        group_name=user.group_name,
        room_id=room.id,
        owner_id=user.owner_id,
        upload=file,
    )
    attachment = MessengerAttachment(message_id=message.id, owner_id=user.owner_id, **saved)
    room.updated_at = datetime.utcnow()
    db.add(attachment)
    db.commit()
    db.refresh(message)
    db.refresh(attachment)
    return {"status": "ok", "item": _message_payload(message, {user.owner_id: user}, {message.id: [attachment]})}


@router.get("/attachments/{attachment_id}")
def download_attachment(
    attachment_id: int,
    owner_id: str = Query(max_length=80),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> FileResponse:
    user = _session_user(db, owner_id=owner_id, token=web_session_token)
    attachment = db.get(MessengerAttachment, attachment_id)
    if attachment is None or attachment.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="attachment not found")
    message = db.get(MessengerMessage, attachment.message_id)
    if message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="message not found")
    _require_room_member(db, room_id=message.room_id, user=user)
    target = resolve_messenger_attachment_path(attachment.storage_path)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="attachment file missing")
    return FileResponse(
        target,
        media_type=attachment.content_type,
        filename=attachment.original_name,
    )


@router.post("/rooms/{room_id}/read")
def mark_room_read(
    room_id: int,
    payload: MessengerReadUpdate,
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = _session_user(db, owner_id=payload.owner_id, token=web_session_token)
    room, member = _require_room_member(db, room_id=room_id, user=user)
    latest_id = db.scalar(select(func.max(MessengerMessage.id)).where(MessengerMessage.room_id == room.id)) or 0
    member.last_read_message_id = max(member.last_read_message_id, min(payload.last_read_message_id, latest_id))
    member.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(member)
    return {
        "status": "ok",
        "room_id": room.id,
        "last_read_message_id": member.last_read_message_id,
        "unread_count": _unread_count(db, room.id, user.owner_id, member.last_read_message_id),
    }


def _session_user(db: Session, *, owner_id: str, token: str | None) -> UserAccount:
    user = require_web_session_access(db, owner_id=owner_id.strip(), session_token=token)
    group_name = (user.group_name or "").strip()
    if not group_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user group required")
    return user


def _ensure_group_room(db: Session, user: UserAccount) -> MessengerRoom:
    room = db.scalar(
        select(MessengerRoom).where(
            MessengerRoom.group_name == user.group_name,
            MessengerRoom.room_type == "group",
            MessengerRoom.name == "전체 그룹",
        )
    )
    if room is None:
        room = MessengerRoom(
            group_name=user.group_name,
            room_type="group",
            name="전체 그룹",
            created_by=user.owner_id,
        )
        db.add(room)
        db.flush()
    active_users = list(
        db.scalars(
            select(UserAccount).where(UserAccount.group_name == user.group_name, UserAccount.is_active == 1)
        ).all()
    )
    existing = {
        item.owner_id
        for item in db.scalars(select(MessengerRoomMember).where(MessengerRoomMember.room_id == room.id)).all()
    }
    for account in active_users:
        if account.owner_id not in existing:
            db.add(MessengerRoomMember(room_id=room.id, owner_id=account.owner_id))
    db.flush()
    return room


def _migrate_group_messages(db: Session, *, room: MessengerRoom, group_name: str) -> None:
    legacy_messages = list(
        db.scalars(select(GroupMessage).where(GroupMessage.group_name == group_name).order_by(GroupMessage.id.asc())).all()
    )
    if not legacy_messages:
        return
    existing = {
        item
        for item in db.scalars(
            select(MessengerMessage.legacy_group_message_id).where(MessengerMessage.legacy_group_message_id.is_not(None))
        ).all()
    }
    for legacy in legacy_messages:
        if legacy.id in existing:
            continue
        db.add(
            MessengerMessage(
                room_id=room.id,
                sender_owner_id=legacy.sender_owner_id,
                body=legacy.body,
                legacy_group_message_id=legacy.id,
                created_at=legacy.created_at,
                updated_at=legacy.created_at,
            )
        )
    db.flush()


def _require_room_member(db: Session, *, room_id: int, user: UserAccount) -> tuple[MessengerRoom, MessengerRoomMember]:
    room = db.get(MessengerRoom, room_id)
    if room is None or room.group_name != user.group_name or not bool(room.is_active):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="room not found")
    member = db.scalar(
        select(MessengerRoomMember).where(
            MessengerRoomMember.room_id == room.id,
            MessengerRoomMember.owner_id == user.owner_id,
            MessengerRoomMember.is_active == 1,
        )
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="room member required")
    return room, member


def _room_payload(db: Session, room: MessengerRoom, member: MessengerRoomMember | None, owner_id: str) -> dict:
    if member is None:
        member = db.scalar(
            select(MessengerRoomMember).where(
                MessengerRoomMember.room_id == room.id,
                MessengerRoomMember.owner_id == owner_id,
            )
        )
    last_read_id = member.last_read_message_id if member else 0
    latest = db.scalar(select(func.max(MessengerMessage.id)).where(MessengerMessage.room_id == room.id)) or 0
    return {
        "id": room.id,
        "group_name": room.group_name,
        "room_type": room.room_type,
        "name": room.name,
        "updated_at": _utc_iso(room.updated_at),
        "last_message_id": latest,
        "last_read_message_id": last_read_id,
        "unread_count": _unread_count(db, room.id, owner_id, last_read_id),
    }


def _message_payload(
    message: MessengerMessage,
    users: dict[str, UserAccount],
    attachments_by_message: dict[int, list[MessengerAttachment]],
) -> dict:
    user = users.get(message.sender_owner_id)
    return {
        "id": message.id,
        "room_id": message.room_id,
        "sender_owner_id": message.sender_owner_id,
        "sender_display_name": user.display_name if user else None,
        "body": message.body,
        "created_at": _utc_iso(message.created_at),
        "attachments": [_attachment_payload(item) for item in attachments_by_message.get(message.id, [])],
    }


def _attachment_payload(attachment: MessengerAttachment) -> dict:
    return {
        "id": attachment.id,
        "original_name": attachment.original_name,
        "content_type": attachment.content_type,
        "extension": attachment.extension,
        "size_bytes": attachment.size_bytes,
        "is_image": attachment.extension in {"jpg", "jpeg", "png", "webp", "gif"},
    }


def _users_by_owner_id(db: Session, owner_ids: set[str]) -> dict[str, UserAccount]:
    if not owner_ids:
        return {}
    return {
        user.owner_id: user
        for user in db.scalars(select(UserAccount).where(UserAccount.owner_id.in_(owner_ids))).all()
    }


def _unread_count(db: Session, room_id: int, owner_id: str, last_read_message_id: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(MessengerMessage)
            .where(
                MessengerMessage.room_id == room_id,
                MessengerMessage.id > last_read_message_id,
                MessengerMessage.sender_owner_id != owner_id,
                MessengerMessage.deleted_at.is_(None),
            )
        ) or 0
    )


def _utc_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
