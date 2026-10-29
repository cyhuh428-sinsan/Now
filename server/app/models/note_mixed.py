"""Metadata-only positive classification for independently typed live slots."""
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, ForeignKeyConstraint, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class MixedSchema(Base):
    __tablename__ = "note_mixed_schema"
    __table_args__ = (CheckConstraint("id = 1 AND version = 1"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[int] = mapped_column()
    initial_scopes_json: Mapped[str] = mapped_column(Text)
    initial_scopes_digest: Mapped[str] = mapped_column(String(64))
    initialized_at: Mapped[datetime] = mapped_column()


class MixedScope(Base):
    __tablename__ = "note_mixed_scopes"
    __table_args__ = (CheckConstraint("metadata_version = 1"),)
    owner_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    local_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    metadata_version: Mapped[int] = mapped_column()
    cohort_id: Mapped[str] = mapped_column(String(36), unique=True)
    initial_slots_json: Mapped[str] = mapped_column(Text)
    initial_slots_digest: Mapped[str] = mapped_column(String(64))
    classified_at: Mapped[datetime] = mapped_column()


class MixedSlot(Base):
    __tablename__ = "note_mixed_slots"
    __table_args__ = (
        ForeignKeyConstraint(["owner_id", "local_id"], ["note_mixed_scopes.owner_id", "note_mixed_scopes.local_id"]),
        ForeignKeyConstraint(["cohort_id"], ["note_mixed_scopes.cohort_id"]),
        CheckConstraint("representation_epoch >= 0 AND representation_version >= 1"),
    )
    owner_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    local_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    key_json: Mapped[str] = mapped_column(String(220), primary_key=True)
    representation_kind: Mapped[str] = mapped_column(String(32))
    representation_epoch: Mapped[int] = mapped_column()
    is_null: Mapped[bool] = mapped_column(Boolean)
    representation_version: Mapped[int] = mapped_column(BigInteger)
    representation_etag: Mapped[str] = mapped_column(String(36))
    storage_operation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    semantic_origin_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    origin_validator: Mapped[str] = mapped_column(String(32))
    cohort_id: Mapped[str] = mapped_column(String(36))
