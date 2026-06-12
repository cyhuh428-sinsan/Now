from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.note import UserDevice


def touch_user_device(
    db: Session,
    *,
    owner_id: str,
    device_id: str,
    seen_at: datetime | None = None,
) -> UserDevice | None:
    cleaned_owner_id = owner_id.strip()
    cleaned_device_id = device_id.strip()
    if not cleaned_owner_id or not cleaned_device_id:
        return None

    now = seen_at or datetime.utcnow()
    device = db.scalar(
        select(UserDevice).where(
            UserDevice.owner_id == cleaned_owner_id,
            UserDevice.device_id == cleaned_device_id,
        )
    )
    if device is None:
        device = UserDevice(
            owner_id=cleaned_owner_id,
            device_id=cleaned_device_id,
            is_active=1,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(device)
        return device

    device.last_seen_at = now
    return device


def require_active_user_device(
    db: Session,
    *,
    owner_id: str,
    device_id: str,
) -> UserDevice | None:
    if not owner_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="owner_id required",
        )
    if not device_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="device_id required",
        )
    device = touch_user_device(db, owner_id=owner_id, device_id=device_id)
    if not bool(device.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="device inactive",
        )
    return device


def set_user_device_active(
    db: Session,
    *,
    owner_id: str,
    device_id: str,
    is_active: bool,
) -> UserDevice | None:
    device = touch_user_device(db, owner_id=owner_id, device_id=device_id)
    if device is None:
        return None
    device.is_active = 1 if is_active else 0
    return device
