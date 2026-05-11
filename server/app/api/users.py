from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_api_token
from app.db import get_db
from app.models.note import UserAccount
from app.services.user_accounts import require_active_user, touch_user_activity, update_user_account

router = APIRouter(
    prefix="/api/v1/users",
    tags=["users"],
    dependencies=[Depends(require_api_token)],
)


class UserProfileUpdate(BaseModel):
    email: str | None = Field(default=None, max_length=240)
    display_name: str | None = Field(default=None, max_length=120)
    timezone: str = Field(default="Asia/Seoul", max_length=80)


@router.get("/{owner_id}")
def user_profile(owner_id: str, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(UserAccount).where(UserAccount.owner_id == owner_id))
    if user is None:
        user = touch_user_activity(db, owner_id=owner_id)
        db.commit()
        db.refresh(user)
    return {"status": "ok", "user": _user_payload(user)}


@router.patch("/{owner_id}")
def update_user_profile(
    owner_id: str,
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
) -> dict:
    user = require_active_user(db, owner_id=owner_id)
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
