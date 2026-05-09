from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.note import UserAccount


def touch_user_activity(
    db: Session,
    *,
    owner_id: str,
    seen_at: datetime | None = None,
) -> UserAccount:
    now = seen_at or datetime.utcnow()
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
    if user is None:
        user = UserAccount(owner_id=owner_id, last_seen_at=now)
        db.add(user)
        return user

    user.last_seen_at = now
    user.is_active = 1
    return user


def update_user_account(
    db: Session,
    *,
    owner_id: str,
    email: str | None = None,
    display_name: str | None = None,
    timezone: str = "Asia/Seoul",
    group_name: str = "사용자",
    two_factor_enabled: bool = False,
    is_active: bool = True,
) -> UserAccount | None:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
    if user is None:
        return None

    user.email = _clean_optional(email, 240)
    user.display_name = _clean_optional(display_name, 120)
    user.timezone = _valid_timezone(timezone)
    user.group_name = _clean_required(group_name, "사용자", 80)
    user.two_factor_enabled = 1 if two_factor_enabled else 0
    user.is_active = 1 if is_active else 0
    return user


def _clean_optional(value: str | None, max_length: int) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned[:max_length] if cleaned else None


def _clean_required(value: str | None, fallback: str, max_length: int) -> str:
    cleaned = (value or "").strip()
    return (cleaned or fallback)[:max_length]


def _valid_timezone(value: str | None) -> str:
    timezone = _clean_required(value, "Asia/Seoul", 80)
    try:
        ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        return "Asia/Seoul"
    return timezone
