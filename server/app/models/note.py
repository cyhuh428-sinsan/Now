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


class UserAccount(Base):
    __tablename__ = "user_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(240), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    timezone: Mapped[str] = mapped_column(String(80), default="Asia/Seoul")
    group_name: Mapped[str] = mapped_column(String(80), default="사용자", index=True)
    two_factor_enabled: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(240), nullable=True)
    password_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    password_recovery_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    password_recovery_issued_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    access_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    access_token_issued_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    access_token_last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class UserGroup(Base):
    __tablename__ = "user_groups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(240), default="")
    invite_code_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    invite_code_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=100, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class UserDevice(Base):
    __tablename__ = "user_devices"
    __table_args__ = (
        UniqueConstraint("owner_id", "device_id", name="uq_user_device"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    device_id: Mapped[str] = mapped_column(String(120), index=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    access_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    access_token_value: Mapped[str | None] = mapped_column(String(240), nullable=True)
    access_token_issued_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    access_token_last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class WebSession(Base):
    __tablename__ = "web_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    session_token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    device_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class GroupMessage(Base):
    __tablename__ = "group_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_name: Mapped[str] = mapped_column(String(80), index=True)
    sender_owner_id: Mapped[str] = mapped_column(String(80), index=True)
    body: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class GroupMessageRead(Base):
    __tablename__ = "group_message_reads"
    __table_args__ = (
        UniqueConstraint("owner_id", "group_name", name="uq_group_message_read_owner_group"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    group_name: Mapped[str] = mapped_column(String(80), index=True)
    last_read_message_id: Mapped[int] = mapped_column(Integer, default=0)
    read_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class MessengerRoom(Base):
    __tablename__ = "messenger_rooms"
    __table_args__ = (
        UniqueConstraint("group_name", "room_type", "name", name="uq_messenger_room_group_type_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_name: Mapped[str] = mapped_column(String(80), index=True)
    room_type: Mapped[str] = mapped_column(String(30), default="group", index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_by: Mapped[str] = mapped_column(String(80), index=True)
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class MessengerRoomMember(Base):
    __tablename__ = "messenger_room_members"
    __table_args__ = (
        UniqueConstraint("room_id", "owner_id", name="uq_messenger_room_member"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(Integer, index=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    role: Mapped[str] = mapped_column(String(30), default="member")
    last_read_message_id: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[int] = mapped_column(Integer, default=1, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class MessengerMessage(Base):
    __tablename__ = "messenger_messages"
    __table_args__ = (
        UniqueConstraint("legacy_group_message_id", name="uq_messenger_legacy_group_message"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(Integer, index=True)
    sender_owner_id: Mapped[str] = mapped_column(String(80), index=True)
    body: Mapped[str] = mapped_column(Text, default="")
    legacy_group_message_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class MessengerAttachment(Base):
    __tablename__ = "messenger_attachments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    message_id: Mapped[int] = mapped_column(Integer, index=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    storage_key: Mapped[str] = mapped_column(String(240), unique=True, index=True)
    storage_path: Mapped[str] = mapped_column(Text)
    original_name: Mapped[str] = mapped_column(String(240))
    content_type: Mapped[str] = mapped_column(String(120))
    extension: Mapped[str] = mapped_column(String(20), index=True)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


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


class ReleaseEvidenceRecord(Base):
    __tablename__ = "release_evidence_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_name: Mapped[str] = mapped_column(String(120), index=True)
    section: Mapped[str] = mapped_column(String(160), index=True)
    label: Mapped[str] = mapped_column(String(240), index=True)
    result: Mapped[str] = mapped_column(String(40), default="재확인 필요", index=True)
    checked_by: Mapped[str] = mapped_column(String(120), default="")
    evidence_location: Mapped[str] = mapped_column(Text, default="")
    actual_note: Mapped[str] = mapped_column(Text, default="")
    memo: Mapped[str] = mapped_column(Text, default="")
    checked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
