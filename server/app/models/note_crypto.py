"""Transition metadata and ciphertext-only immutable upload storage."""
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, LargeBinary, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ServerIdentity(Base):
    __tablename__ = "server_identity"
    __table_args__ = (CheckConstraint("id = 1", name="single_server_identity"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    instance_id: Mapped[str] = mapped_column(String(36), unique=True)


class NoteCryptoTransition(Base):
    __tablename__ = "note_crypto_transitions"
    __table_args__ = (UniqueConstraint("owner_id", "mutation_id", name="uq_crypto_prepare"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    local_id: Mapped[str] = mapped_column(String(120), index=True)
    mutation_id: Mapped[str] = mapped_column(String(36))
    actor_device_id: Mapped[str] = mapped_column(String(120))
    conditions_json: Mapped[str] = mapped_column(Text)
    manifest_digest: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(24), default="prepared")
    lease_version: Mapped[int] = mapped_column(default=1)
    expires_at: Mapped[datetime] = mapped_column()
    created_at: Mapped[datetime] = mapped_column()
    commit_conditions_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class NoteCryptoEntry(Base):
    __tablename__ = "note_crypto_entries"
    transition_id: Mapped[str] = mapped_column(ForeignKey("note_crypto_transitions.id"), primary_key=True)
    key_json: Mapped[str] = mapped_column(String(220), primary_key=True)
    source_etag: Mapped[str] = mapped_column(String(36))
    source_kind: Mapped[str] = mapped_column(String(32))
    output_kind: Mapped[str] = mapped_column(String(32))
    representation_epoch: Mapped[int] = mapped_column()
    binding_json: Mapped[str | None] = mapped_column(Text, nullable=True)


class NoteCryptoFence(Base):
    __tablename__ = "note_crypto_fences"
    owner_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    local_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    transition_id: Mapped[str] = mapped_column(ForeignKey("note_crypto_transitions.id"), unique=True)


class NoteCryptoUpload(Base):
    __tablename__ = "note_crypto_uploads"
    transition_id: Mapped[str] = mapped_column(ForeignKey("note_crypto_transitions.id"), primary_key=True)
    key_json: Mapped[str] = mapped_column(String(220), primary_key=True)
    total_chunks: Mapped[int] = mapped_column()
    total_bytes: Mapped[int] = mapped_column()
    ciphertext_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)


class NoteCryptoChunk(Base):
    __tablename__ = "note_crypto_chunks"
    transition_id: Mapped[str] = mapped_column(ForeignKey("note_crypto_transitions.id"), primary_key=True)
    key_json: Mapped[str] = mapped_column(String(220), primary_key=True)
    chunk_index: Mapped[int] = mapped_column(primary_key=True)
    chunk_sha256: Mapped[str] = mapped_column(String(64))
    data: Mapped[bytes] = mapped_column(LargeBinary)
