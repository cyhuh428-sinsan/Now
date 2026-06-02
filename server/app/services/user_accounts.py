import hashlib
import secrets
from datetime import datetime, timedelta
from secrets import compare_digest
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.note import UserAccount, UserDevice, UserGroup, WebSession

PASSWORD_HASH_ALGORITHM = "pbkdf2_sha256"
PASSWORD_HASH_ITERATIONS = 210_000
PASSWORD_POLICY_MESSAGE = "password must be at least 10 characters and include letters, numbers, and symbols"
WEB_SESSION_DAYS = 1
DEFAULT_USER_GROUPS: tuple[tuple[str, str, int], ...] = (
    ("관리자", "서버 운영과 사용자 상태를 확인하는 운영자 그룹", 10),
    ("사용자", "일반 NowNote 사용자 기본 그룹", 20),
    ("테스트", "검증과 smoke test에 사용하는 그룹", 90),
)


def hash_access_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_group_invite_code(invite_code: str) -> str:
    return hash_access_token(invite_code.strip())


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return "$".join(
        [
            PASSWORD_HASH_ALGORITHM,
            str(PASSWORD_HASH_ITERATIONS),
            salt.hex(),
            digest.hex(),
        ]
    )


def validate_password_policy(password: str) -> None:
    cleaned = (password or "").strip()
    has_letter = any(character.isalpha() for character in cleaned)
    has_number = any(character.isdigit() for character in cleaned)
    has_symbol = any(not character.isalnum() for character in cleaned)
    if len(cleaned) < 10 or not has_letter or not has_number or not has_symbol:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSWORD_POLICY_MESSAGE)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        algorithm, iterations_text, salt_hex, digest_hex = password_hash.split("$", 3)
        if algorithm != PASSWORD_HASH_ALGORITHM:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations_text),
        )
        return compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


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
    web_session_token: str | None = None,
) -> UserAccount:
    user = touch_user_activity(db, owner_id=owner_id)
    if not bool(user.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user inactive",
        )

    if web_session_token:
        session_user = require_web_session_access(
            db,
            owner_id=owner_id,
            session_token=web_session_token,
        )
        db.commit()
        db.refresh(session_user)
        return session_user

    settings = get_settings()
    if settings.user_token_required:
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="user token required",
            )
        token_hash = hash_access_token(access_token.strip())
        device = db.scalar(
            select(UserDevice).where(
                UserDevice.owner_id == owner_id,
                UserDevice.access_token_hash == token_hash,
            )
        )
        legacy_token_ok = bool(user.access_token_hash) and compare_digest(token_hash, user.access_token_hash)
        if device is None and not legacy_token_ok:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid user token",
            )
        if device is not None and not bool(device.is_active):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="device inactive",
            )
        if device is not None:
            device.access_token_last_used_at = datetime.utcnow()
            device.last_seen_at = datetime.utcnow()
        if legacy_token_ok:
            user.access_token_last_used_at = datetime.utcnow()

    db.commit()
    db.refresh(user)
    return user


def require_web_session_access(
    db: Session,
    *,
    owner_id: str,
    session_token: str | None,
) -> UserAccount:
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="web session required",
        )
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found")
    if not bool(user.is_active):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="user inactive",
        )

    session = db.scalar(
        select(WebSession).where(WebSession.session_token_hash == hash_access_token(session_token.strip()))
    )
    now = datetime.utcnow()
    if (
        session is None
        or session.owner_id != owner_id
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid web session",
        )
    session.last_used_at = now
    user.last_login_at = now
    user.last_seen_at = now
    return user


def issue_web_session(
    db: Session,
    *,
    owner_id: str,
    device_id: str | None = None,
    user_agent: str | None = None,
) -> tuple[WebSession, str]:
    raw_token = secrets.token_urlsafe(40)
    now = datetime.utcnow()
    session = WebSession(
        owner_id=owner_id,
        session_token_hash=hash_access_token(raw_token),
        device_id=_clean_optional(device_id, 120),
        user_agent=_clean_optional(user_agent, 500),
        expires_at=now + timedelta(days=WEB_SESSION_DAYS),
        last_used_at=now,
    )
    db.add(session)
    return session, raw_token


def revoke_web_session(db: Session, *, session_token: str) -> bool:
    session = db.scalar(
        select(WebSession).where(WebSession.session_token_hash == hash_access_token(session_token.strip()))
    )
    if session is None or session.revoked_at is not None:
        return False
    session.revoked_at = datetime.utcnow()
    return True


def create_user_account(
    db: Session,
    *,
    owner_id: str,
    password: str | None = None,
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
    cleaned_group_name = ensure_user_group(db, group_name).name
    user = UserAccount(
        owner_id=cleaned_owner_id,
        email=_clean_optional(email, 240),
        display_name=_clean_optional(display_name, 120),
        timezone=_valid_timezone(timezone),
        group_name=cleaned_group_name,
        two_factor_enabled=1 if two_factor_enabled else 0,
        is_active=1 if is_active else 0,
    )
    set_user_password(user, password)
    db.add(user)
    return user


def update_user_account(
    db: Session,
    *,
    owner_id: str,
    password: str | None = None,
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
    user.group_name = ensure_user_group(db, group_name).name
    user.two_factor_enabled = 1 if two_factor_enabled else 0
    user.is_active = 1 if is_active else 0
    set_user_password(user, password)
    return user


def ensure_user_groups(db: Session) -> list[UserGroup]:
    for name, description, sort_order in DEFAULT_USER_GROUPS:
        ensure_user_group(
            db,
            name,
            description=description,
            sort_order=sort_order,
        )
    existing_user_groups = db.scalars(select(UserAccount.group_name).distinct()).all()
    for group_name in existing_user_groups:
        ensure_user_group(db, group_name)
    return list_user_groups(db)


def ensure_user_group(
    db: Session,
    name: str | None,
    *,
    description: str = "",
    sort_order: int = 100,
    is_active: bool = True,
    invite_code: str | None = None,
) -> UserGroup:
    cleaned_name = _clean_required(name, "사용자", 80)
    group = db.scalar(select(UserGroup).where(UserGroup.name == cleaned_name))
    if group is None:
        group = UserGroup(
            name=cleaned_name,
            description=_clean_required(description, "", 240),
            sort_order=sort_order,
            is_active=1 if is_active else 0,
        )
        set_user_group_invite_code(group, invite_code)
        db.add(group)
        db.flush()
        return group
    if description and not group.description:
        group.description = _clean_required(description, "", 240)
    if sort_order != 100 and group.sort_order == 100:
        group.sort_order = sort_order
    set_user_group_invite_code(group, invite_code)
    return group


def list_user_groups(db: Session, *, include_inactive: bool = True) -> list[UserGroup]:
    ensure_default_user_groups_only(db)
    stmt = select(UserGroup)
    if not include_inactive:
        stmt = stmt.where(UserGroup.is_active == 1)
    return list(db.scalars(stmt.order_by(UserGroup.sort_order, UserGroup.name)).all())


def update_user_group(
    db: Session,
    *,
    group_id: int,
    name: str,
    description: str = "",
    sort_order: int = 100,
    is_active: bool = True,
    invite_code: str | None = None,
) -> UserGroup | None:
    group = db.scalar(select(UserGroup).where(UserGroup.id == group_id))
    if group is None:
        return None
    cleaned_name = _clean_required(name, "사용자", 80)
    duplicate = db.scalar(
        select(UserGroup).where(UserGroup.name == cleaned_name, UserGroup.id != group_id)
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="group name already exists",
        )
    old_name = group.name
    group.name = cleaned_name
    group.description = _clean_required(description, "", 240)
    group.sort_order = max(0, min(int(sort_order), 9999))
    group.is_active = 1 if is_active else 0
    set_user_group_invite_code(group, invite_code)
    if old_name != cleaned_name:
        users = list(db.scalars(select(UserAccount).where(UserAccount.group_name == old_name)).all())
        for user in users:
            user.group_name = cleaned_name
    return group


def set_user_group_invite_code(group: UserGroup, invite_code: str | None) -> bool:
    cleaned_code = (invite_code or "").strip()
    if not cleaned_code:
        return False
    group.invite_code_hash = hash_group_invite_code(cleaned_code)
    group.invite_code_updated_at = datetime.utcnow()
    return True


def join_user_group_by_invite(
    db: Session,
    *,
    user: UserAccount,
    group_name: str,
    invite_code: str,
) -> UserAccount:
    cleaned_group_name = _clean_required(group_name, "", 80)
    cleaned_code = (invite_code or "").strip()
    if not cleaned_group_name or not cleaned_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="group name and invite code are required",
        )
    group = db.scalar(select(UserGroup).where(UserGroup.name == cleaned_group_name))
    if group is None or not bool(group.is_active) or not group.invite_code_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="invalid group invite",
        )
    if not compare_digest(hash_group_invite_code(cleaned_code), group.invite_code_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="invalid group invite",
        )
    user.group_name = group.name
    user.updated_at = datetime.utcnow()
    return user


def ensure_default_user_groups_only(db: Session) -> None:
    created = False
    for name, description, sort_order in DEFAULT_USER_GROUPS:
        group = db.scalar(select(UserGroup).where(UserGroup.name == name))
        if group is None:
            db.add(
                UserGroup(
                    name=name,
                    description=description,
                    sort_order=sort_order,
                    is_active=1,
                )
            )
            created = True
    if created:
        db.flush()


def issue_user_access_token(db: Session, *, owner_id: str) -> tuple[UserAccount, str] | None:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
    if user is None:
        return None
    raw_token = secrets.token_urlsafe(32)
    user.access_token_hash = hash_access_token(raw_token)
    user.access_token_issued_at = datetime.utcnow()
    user.access_token_last_used_at = None
    return user, raw_token


def issue_user_device_access_token(
    db: Session,
    *,
    owner_id: str,
    device_id: str | None,
    display_name: str | None = None,
) -> tuple[UserDevice, str] | None:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
    if user is None:
        return None
    cleaned_device_id = _clean_required(device_id, "desktop", 120)
    now = datetime.utcnow()
    device = db.scalar(
        select(UserDevice).where(
            UserDevice.owner_id == owner_id,
            UserDevice.device_id == cleaned_device_id,
        )
    )
    if device is None:
        device = UserDevice(
            owner_id=owner_id,
            device_id=cleaned_device_id,
            display_name=_clean_optional(display_name, 120),
            is_active=1,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(device)
    else:
        device.display_name = _clean_optional(display_name, 120) or device.display_name
        device.is_active = 1
        device.last_seen_at = now
    raw_token = secrets.token_urlsafe(32)
    device.access_token_hash = hash_access_token(raw_token)
    device.access_token_value = raw_token
    device.access_token_issued_at = now
    device.access_token_last_used_at = None
    user.last_login_at = now
    user.last_seen_at = now
    return device, raw_token


def set_user_password(user: UserAccount, password: str | None) -> None:
    cleaned = (password or "").strip()
    if not cleaned:
        return
    validate_password_policy(cleaned)
    user.password_hash = hash_password(cleaned)
    user.password_updated_at = datetime.utcnow()


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
