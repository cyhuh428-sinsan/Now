from datetime import datetime

from pydantic import BaseModel, Field


class NoteIn(BaseModel):
    owner_id: str = Field(default="local_user", max_length=80)
    device_id: str = Field(max_length=120)
    local_id: str = Field(max_length=120)
    note_type: str = Field(max_length=40)
    title: str = Field(max_length=240)
    content: str = ""
    parent_local_id: str | None = Field(default=None, max_length=120)
    level: int = Field(default=1, ge=1, le=3)
    tags: str | None = None
    source: str | None = Field(default=None, max_length=80)
    client_updated_at: datetime | None = None
    deleted_at: datetime | None = None


class NoteOut(NoteIn):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NoteSyncRequest(BaseModel):
    notes: list[NoteIn]


class NoteSyncResponse(BaseModel):
    notes: list[NoteOut]


class SyncRequest(BaseModel):
    owner_id: str = Field(default="local_user", max_length=80)
    device_id: str = Field(max_length=120)
    updated_after: datetime | None = None
    include_deleted: bool = True
    notes: list[NoteIn] = Field(default_factory=list)


class SyncResponse(BaseModel):
    pushed_notes: list[NoteOut]
    pulled_notes: list[NoteOut]
    server_time: datetime


class RecordingOut(BaseModel):
    id: int
    owner_id: str
    device_id: str
    local_id: str
    note_local_id: str | None
    file_name: str
    content_type: str
    transcript: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
