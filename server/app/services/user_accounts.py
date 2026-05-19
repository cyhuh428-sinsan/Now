import hashlib
import secrets
from datetime import datetime
from secrets import compare_digest
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.note import UserAccount


def hash_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def touch_user_activity(
    db: Session,
    *,
    owner_id: str,
    seen_at: datetime | None = None,
) -> UserAccount:
    now = seen_at or datetime.utcnow()
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
    if user is None:
        user = UserAccount(owner_id=owner_id, is_active=1, last_seen_at=now)
        db.add(user)
        return user

    user.last_seen_at = now
    return user


def require_active_user(db: Session, *, owner_id: str) -> UserAccount:
    user = touch_user_activity(db, owner_id=owner_id)
    if not bool(user.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user inactive",
        )
    db.commit()
    db.refresh(user)
    return user


def require_user_api_access(
    db: Session,
    *,
    owner_id: str,
    access_token: str | None = None,
) -> UserAccount:
    user = touch_user_activity(db, owner_id=owner_id)
    if not bool(user.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user inactive",
        )

    settings = get_settings()
    if settings.user_token_required:
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="user token required",
            )
        if not user.access_token_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="user token not issued",
            )
        if not compare_digest(hash_access_token(access_token), user.access_token_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid user token",
            )
        user.access_token_last_used_at = datetime.utcnow()

    db.commit()
    db.refresh(user)
    return user


def create_user_account(
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
    cleaned_owner_id = _clean_required(owner_id, "", 80)
    if not cleaned_owner_id:
        return None
    existing = db.scalar(select(UserAccount).where(UserAccount.owner_id == cleaned_owner_id))
    if existing is not None:
        return None
    user = UserAccount(
        owner_id=cleaned_owner_id,
        email=_clean_optional(email, 240),
        display_name=_clean_optional(display_name, 120),
        timezone=_valid_timezone(timezone),
        group_name=_clean_required(group_name, "사용자", 80),
        two_factor_enabled=1 if two_factor_enabled else 0,
        is_active=1 if is_active else 0,
    )
    db.add(user)
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


def issue_user_access_token(db: Session, *, owner_id: str) -> tuple[UserAccount, str] | None:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
    if user is None:
        return None
    raw_token = secrets.token_urlsafe(32)
    user.access_token_hash = hash_access_token(raw_token)
    user.access_token_issued_at = datetime.utcnow()
    user.access_token_last_used_at = None
    return user, raw_token


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
