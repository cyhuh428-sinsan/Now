from datetime import datetime

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class NoteOfflineBranch(Base):
    __tablename__ = "note_offline_branches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    local_id: Mapped[str] = mapped_column(String(120), index=True)
    parent_kind: Mapped[str | None] = mapped_column(String(24), nullable=True)
    parent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    origin_device_id: Mapped[str] = mapped_column(String(120))
    captured_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    representation_epoch: Mapped[int] = mapped_column(Integer, default=0)
    representation_kind: Mapped[str] = mapped_column(String(32), default="snapshot_v1")
    snapshot_json: Mapped[str] = mapped_column(Text)


class NoteMutation(Base):
    __tablename__ = "note_mutations"
    owner_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    mutation_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    local_id: Mapped[str] = mapped_column(String(120))
    operation: Mapped[str] = mapped_column(String(24))
    actor_device_id: Mapped[str] = mapped_column(String(120))
    crypto_epoch: Mapped[int] = mapped_column(Integer)
    conditions_json: Mapped[str] = mapped_column(Text)
    result_json: Mapped[str] = mapped_column(Text)
