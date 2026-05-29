from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.models.note import UserAccount, UserDevice
from app.services.user_accounts import require_user_api_access, update_user_account
from app.services.user_devices import set_user_device_active

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
    dependencies=[Depends(require_client_api_access)],
)


class UserProfileUpdate(BaseModel):
    email: str | None = Field(default=None, max_length=240)
    display_name: str | None = Field(default=None, max_length=120)
    timezone: str = Field(default="Asia/Seoul", max_length=80)


class UserDeviceUpdate(BaseModel):
    is_active: bool = True


@router.get("/{owner_id}")
def user_profile(
    owner_id: str,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    return {"status": "ok", "user": _user_payload(user)}


@router.patch("/{owner_id}")
def update_user_profile(
    owner_id: str,
    payload: UserProfileUpdate,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    user = require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    updated = update_user_account(
        db,
        owner_id=owner_id,
        email=payload.email,
        display_name=payload.display_name,
        timezone=payload.timezone,
        group_name=user.group_name,
        two_factor_enabled=bool(user.two_factor_enabled),
        is_active=bool(user.is_active),
    )
    db.commit()
    db.refresh(updated)
    return {"status": "ok", "user": _user_payload(updated)}


@router.get("/{owner_id}/devices")
def user_devices(
    owner_id: str,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    devices = list(
        db.scalars(
            select(UserDevice)
            .where(UserDevice.owner_id == owner_id)
            .order_by(
                UserDevice.last_seen_at.desc().nullslast(),
                UserDevice.updated_at.desc(),
                UserDevice.id.desc(),
            )
        ).all()
    )
    return {
        "status": "ok",
        "owner_id": owner_id,
        "devices": [_device_payload(device) for device in devices],
    }


@router.patch("/{owner_id}/devices/{device_id}")
def update_user_device(
    owner_id: str,
    device_id: str,
    payload: UserDeviceUpdate,
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> dict:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    existing = db.scalar(
        select(UserDevice).where(
            UserDevice.owner_id == owner_id,
            UserDevice.device_id == device_id,
        )
    )
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="device not found",
        )
    device = set_user_device_active(
        db,
        owner_id=owner_id,
        device_id=device_id,
        is_active=payload.is_active,
    )
    db.commit()
    if device is not None:
        db.refresh(device)
    return {"status": "ok", "device": _device_payload(device)}


def _user_payload(user: UserAccount) -> dict:
    return {
        "owner_id": user.owner_id,
        "email": user.email,
        "display_name": user.display_name,
        "timezone": user.timezone,
        "group_name": user.group_name,
        "two_factor_enabled": bool(user.two_factor_enabled),
        "is_active": bool(user.is_active),
        "confirmed_at": user.confirmed_at,
        "last_login_at": user.last_login_at,
        "last_seen_at": user.last_seen_at,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


def _device_payload(device: UserDevice | None) -> dict | None:
    if device is None:
        return None
    return {
        "owner_id": device.owner_id,
        "device_id": device.device_id,
        "display_name": device.display_name,
        "is_active": bool(device.is_active),
        "first_seen_at": device.first_seen_at,
        "last_seen_at": device.last_seen_at,
        "created_at": device.created_at,
        "updated_at": device.updated_at,
    }
