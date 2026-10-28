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


class NoteInventory(Base):
    __tablename__ = "note_inventory"
    owner_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    local_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    note_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    revision_id: Mapped[str] = mapped_column(String(36))
    snapshot_json: Mapped[str] = mapped_column(Text)
