from datetime import datetime

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
