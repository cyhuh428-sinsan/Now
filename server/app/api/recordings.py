from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_api_token
from app.db import get_db
from app.models.note import Recording
from app.schemas.note import RecordingOut
from app.services.recording_storage import save_recording_file
from app.services.user_accounts import require_active_user

router = APIRouter(
    prefix="/api/v1/recordings",
    tags=["recordings"],
    dependencies=[Depends(require_api_token)],
)


@router.get("", response_model=list[RecordingOut])
def list_recordings(
    owner_id: str = "local_user",
    db: Session = Depends(get_db),
) -> list[Recording]:
    require_active_user(db, owner_id=owner_id)
    return list(
        db.scalars(
            select(Recording)
            .where(Recording.owner_id == owner_id)
            .order_by(Recording.created_at.desc())
        ).all()
    )


@router.post("", response_model=RecordingOut)
async def upload_recording(
    owner_id: str = Form(default="local_user"),
    device_id: str = Form(...),
    local_id: str = Form(...),
    note_local_id: str | None = Form(default=None),
    transcript: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> Recording:
    require_active_user(db, owner_id=owner_id)
    file_name, storage_path = await save_recording_file(
        owner_id=owner_id,
        device_id=device_id,
        local_id=local_id,
        upload=file,
    )

    recording = db.scalar(
        select(Recording).where(
            Recording.owner_id == owner_id,
            Recording.device_id == device_id,
            Recording.local_id == local_id,
        )
    )
    if recording is None:
        recording = Recording(
            owner_id=owner_id,
            device_id=device_id,
            local_id=local_id,
            note_local_id=note_local_id,
            file_name=file_name,
            content_type=file.content_type or "application/octet-stream",
            storage_path=storage_path,
            transcript=transcript,
        )
        db.add(recording)
    else:
        recording.note_local_id = note_local_id
        recording.file_name = file_name
        recording.content_type = file.content_type or "application/octet-stream"
        recording.storage_path = storage_path
        recording.transcript = transcript

    db.commit()
    db.refresh(recording)
    return recording
