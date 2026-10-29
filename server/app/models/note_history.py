from datetime import datetime

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class NoteHead(Base):
    __tablename__ = "note_heads"
    owner_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    local_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    version: Mapped[int] = mapped_column(Integer, default=0)
    identity_state: Mapped[str] = mapped_column(String(20), default="coherent")
    head_revision_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    protection_state: Mapped[str] = mapped_column(String(20), default="legacy", server_default="legacy")
    crypto_epoch: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    history_generation: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class NoteRevision(Base):
    __tablename__ = "note_revisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    local_id: Mapped[str] = mapped_column(String(120), index=True)
    note_id: Mapped[int] = mapped_column(Integer)
    parent_revision_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reason: Mapped[str] = mapped_column(String(24))
    captured_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    snapshot_json: Mapped[str] = mapped_column(Text)
    before_snapshot_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    representation_epoch: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    representation_kind: Mapped[str] = mapped_column(String(32), default="snapshot_v1", server_default="snapshot_v1")


class NoteInventory(Base):
    __tablename__ = "note_inventory"
    owner_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    local_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    note_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    revision_id: Mapped[str] = mapped_column(String(36))
    snapshot_json: Mapped[str] = mapped_column(Text)
    representation_epoch: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    representation_kind: Mapped[str] = mapped_column(String(32), default="snapshot_v1", server_default="snapshot_v1")
