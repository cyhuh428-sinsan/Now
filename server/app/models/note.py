from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        UniqueConstraint("owner_id", "device_id", "local_id", name="uq_note_local"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    device_id: Mapped[str] = mapped_column(String(120), index=True)
    local_id: Mapped[str] = mapped_column(String(120), index=True)
    note_type: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(240))
    content: Mapped[str] = mapped_column(Text, default="")
    parent_local_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    level: Mapped[int] = mapped_column(Integer, default=1)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(80), nullable=True)
    client_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class Recording(Base):
    __tablename__ = "recordings"
    __table_args__ = (
        UniqueConstraint(
            "owner_id", "device_id", "local_id", name="uq_recording_local"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    device_id: Mapped[str] = mapped_column(String(120), index=True)
    local_id: Mapped[str] = mapped_column(String(120), index=True)
    note_local_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    file_name: Mapped[str] = mapped_column(String(240))
    content_type: Mapped[str] = mapped_column(String(120))
    storage_path: Mapped[str] = mapped_column(Text)
    transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    job_type: Mapped[str] = mapped_column(String(60), index=True)
    note_local_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    input_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    device_id: Mapped[str] = mapped_column(String(120), index=True)
    pushed_count: Mapped[int] = mapped_column(Integer, default=0)
    pulled_count: Mapped[int] = mapped_column(Integer, default=0)
    include_deleted: Mapped[int] = mapped_column(Integer, default=0)
    updated_after: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
