from datetime import datetime

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
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(device)
        return device

    device.last_seen_at = now
    return device
