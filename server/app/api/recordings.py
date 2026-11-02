from fastapi import APIRouter, Depends, File, Form, Header, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_client_api_access
from app.db import get_db
from app.models.note import Recording
from app.schemas.note import RecordingOut
from app.services.recording_storage import delete_recording_file, save_recording_file
from app.services.user_accounts import require_user_api_access
from app.services.user_devices import require_active_user_device
from app.services import related_text as linked

router = APIRouter(
    prefix="/api/v1/recordings",
    tags=["recordings"],
    dependencies=[Depends(require_client_api_access)],
)


@router.get("", response_model=list[RecordingOut])
def list_recordings(
    owner_id: str = "local_user",
    note_local_id: str | None = Query(default=None),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> list[Recording]:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    stmt = select(Recording).where(Recording.owner_id == owner_id)
    if note_local_id is not None:
        stmt = stmt.where(Recording.note_local_id == note_local_id)
    rows = list(db.scalars(stmt.order_by(Recording.created_at.desc())).all())
    linked.legacy_read(db, rows)
    return rows


@router.post("", response_model=RecordingOut)
async def upload_recording(
    owner_id: str = Form(default="local_user"),
    device_id: str = Form(...),
    local_id: str = Form(...),
    note_local_id: str | None = Form(default=None),
    transcript: str | None = Form(default=None),
    file: UploadFile = File(...),
    user_token: str | None = Header(default=None, alias="X-Now-User-Token"),
    web_session_token: str | None = Header(default=None, alias="X-Now-Web-Session"),
    db: Session = Depends(get_db),
) -> Recording:
    require_user_api_access(
        db,
        owner_id=owner_id,
        access_token=user_token,
        web_session_token=web_session_token,
    )
    require_active_user_device(db, owner_id=owner_id, device_id=device_id)
    from app.services.note_history import lock_note_writes
    lock_note_writes(db, [owner_id])
    original = db.scalar(select(Recording).where(Recording.owner_id == owner_id,
        Recording.device_id == device_id, Recording.local_id == local_id))
    refs = [(owner_id, value) for value in (original.note_local_id if original else None, note_local_id) if value is not None]
    if refs:
        linked.guard(db, refs)
    file_name, storage_path = await save_recording_file(
        owner_id=owner_id,
        device_id=device_id,
        local_id=local_id,
        upload=file,
    )

    old_storage_path = original.storage_path if original is not None else None
    try:
        recording = db.scalar(select(Recording).where(Recording.owner_id == owner_id,
            Recording.device_id == device_id, Recording.local_id == local_id).execution_options(populate_existing=True))
        actual_refs = [(owner_id, value) for value in (recording.note_local_id if recording else None, note_local_id) if value is not None]
        if actual_refs:
            linked.guard(db, actual_refs)
        if recording is None:
            recording = Recording(owner_id=owner_id, device_id=device_id, local_id=local_id, note_local_id=note_local_id,
                file_name=file_name, content_type=file.content_type or "application/octet-stream", storage_path=storage_path,
                transcript=transcript)
            db.add(recording)
        else:
            recording.note_local_id = note_local_id
            recording.file_name = file_name
            recording.content_type = file.content_type or "application/octet-stream"
            recording.storage_path = storage_path
            recording.transcript = transcript
        db.commit()
    except Exception:
        db.rollback()
        if storage_path != old_storage_path:
            delete_recording_file(storage_path)
        raise
    if old_storage_path and old_storage_path != storage_path:
        delete_recording_file(old_storage_path)
    db.refresh(recording)
    linked.legacy_read(db, [recording])
    return recording
