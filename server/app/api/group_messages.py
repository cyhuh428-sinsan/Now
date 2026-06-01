from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.note import GroupMessage, GroupMessageRead, UserAccount
from app.services.user_accounts import require_web_session_access

router = APIRouter(prefix="/api/v1/group-messages", tags=["group-messages"])


class GroupMessageCreate(BaseModel):
    owner_id: str = Field(max_length=80)
    body: str = Field(min_length=1, max_length=2000)


class GroupMessageReadUpdate(BaseModel):
    owner_id: str = Field(max_length=80)
    last_read_message_id: int = Field(ge=0)


def _message_payload(message: GroupMessage, users: dict[str, UserAccount]) -> dict:
    user = users.get(message.sender_owner_id)
    return {
        "id": message.id,
        "group_name": message.group_name,
        "sender_owner_id": message.sender_owner_id,
        "sender_display_name": user.display_name if user else None,
        "body": message.body,
        "created_at": message.created_at,
    }


@router.get("")
def list_group_messages(
    owner_id: str = Query(max_length=80),
    limit: int = Query(default=50, ge=1, le=100),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_web_session_access(
        db,
        owner_id=owner_id.strip(),
        session_token=web_session_token,
    )
    group_name = (user.group_name or "").strip()
    if not group_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user group required")
    messages = list(
        db.scalars(
            select(GroupMessage)
            .where(GroupMessage.group_name == group_name)
            .order_by(GroupMessage.created_at.desc(), GroupMessage.id.desc())
            .limit(limit)
        ).all()
    )
    sender_ids = {message.sender_owner_id for message in messages}
    users = {
        item.owner_id: item
        for item in db.scalars(select(UserAccount).where(UserAccount.owner_id.in_(sender_ids))).all()
    }
    read_state = _group_read_state(db, owner_id=user.owner_id, group_name=group_name)
    unread_count = _unread_message_count(
        db,
        group_name=group_name,
        owner_id=user.owner_id,
        last_read_message_id=read_state.last_read_message_id if read_state else 0,
    )
    db.commit()
    return {
        "status": "ok",
        "group_name": group_name,
        "unread_count": unread_count,
        "last_read_message_id": read_state.last_read_message_id if read_state else 0,
        "items": [_message_payload(message, users) for message in reversed(messages)],
    }


@router.post("")
def create_group_message(
    payload: GroupMessageCreate,
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_web_session_access(
        db,
        owner_id=payload.owner_id.strip(),
        session_token=web_session_token,
    )
    group_name = (user.group_name or "").strip()
    body = payload.body.strip()
    if not group_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user group required")
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message body required")
    message = GroupMessage(
        group_name=group_name,
        sender_owner_id=user.owner_id,
        body=body,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return {
        "status": "ok",
        "group_name": group_name,
        "item": _message_payload(message, {user.owner_id: user}),
    }


@router.post("/read")
def mark_group_messages_read(
    payload: GroupMessageReadUpdate,
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_web_session_access(
        db,
        owner_id=payload.owner_id.strip(),
        session_token=web_session_token,
    )
    group_name = (user.group_name or "").strip()
    if not group_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="user group required")
    latest_group_id = db.scalar(
        select(func.max(GroupMessage.id)).where(GroupMessage.group_name == group_name)
    ) or 0
    next_read_id = min(int(payload.last_read_message_id), int(latest_group_id))
    read_state = _group_read_state(db, owner_id=user.owner_id, group_name=group_name)
    if read_state is None:
        read_state = GroupMessageRead(
            owner_id=user.owner_id,
            group_name=group_name,
            last_read_message_id=next_read_id,
            read_at=datetime.utcnow(),
        )
        db.add(read_state)
    else:
        read_state.last_read_message_id = max(read_state.last_read_message_id, next_read_id)
        read_state.read_at = datetime.utcnow()
    db.commit()
    db.refresh(read_state)
    unread_count = _unread_message_count(
        db,
        group_name=group_name,
        owner_id=user.owner_id,
        last_read_message_id=read_state.last_read_message_id,
    )
    return {
        "status": "ok",
        "group_name": group_name,
        "last_read_message_id": read_state.last_read_message_id,
        "unread_count": unread_count,
    }


def _group_read_state(db: Session, *, owner_id: str, group_name: str) -> GroupMessageRead | None:
    return db.scalar(
        select(GroupMessageRead).where(
            GroupMessageRead.owner_id == owner_id,
            GroupMessageRead.group_name == group_name,
        )
    )


def _unread_message_count(
    db: Session,
    *,
    group_name: str,
    owner_id: str,
    last_read_message_id: int,
) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(GroupMessage)
            .where(
                GroupMessage.group_name == group_name,
                GroupMessage.id > last_read_message_id,
                GroupMessage.sender_owner_id != owner_id,
            )
        ) or 0
    )
