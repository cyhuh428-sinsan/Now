"""Transaction-scoped fencing shared by legacy writes and natural flushes."""
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import delete, text

from app.models.note_crypto import NoteCryptoFence, NoteCryptoTransition

ACTIVE_STATES = ("prepared", "staging", "ready")
TERMINAL_STATES = ("committed", "expired", "aborted")


def error(code, status=409):
    raise HTTPException(status_code=status, detail={"code": code}, headers={"Cache-Control": "no-store"})


def database_now(db):
    if db.bind.dialect.name == "postgresql":
        return db.scalar(text("SELECT clock_timestamp() AT TIME ZONE 'UTC'"))
    return datetime.fromisoformat(db.scalar(text("SELECT strftime('%Y-%m-%dT%H:%M:%f', 'now')")))


def expire(db, transition):
    if transition.state in ACTIVE_STATES and database_now(db) >= transition.expires_at:
        transition.state = "expired"
        db.execute(delete(NoteCryptoFence).where(NoteCryptoFence.transition_id == transition.id))
    return transition


def active_fence(db, owner, local):
    fence = db.get(NoteCryptoFence, (owner, local))
    if fence is None:
        return None
    transition = db.get(NoteCryptoTransition, fence.transition_id)
    if transition is None:
        error("inconsistent_crypto_fence")
    expire(db, transition)
    if transition.state not in ACTIVE_STATES + TERMINAL_STATES:
        error("inconsistent_crypto_fence")
    return transition if transition.state in ACTIVE_STATES else None


def require_unfenced(db, refs):
    from app.services.note_history import lock_note_writes
    refs = sorted(set(refs))
    lock_note_writes(db, [owner for owner, _ in refs])
    for owner, local in refs:
        if active_fence(db, owner, local):
            error("crypto_transition_in_progress", 423)
