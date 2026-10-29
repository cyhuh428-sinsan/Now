"""Metadata-only linked text presence, drain cohorts, and worker execution CAS."""
from datetime import datetime

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LinkedSchema(Base):
    __tablename__ = "note_linked_schema"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[int] = mapped_column()


class LinkedText(Base):
    __tablename__ = "note_linked_texts"
    owner_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    local_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    key_json: Mapped[str] = mapped_column(String(220), primary_key=True)
    representation_kind: Mapped[str] = mapped_column(String(32))
    representation_epoch: Mapped[int] = mapped_column()
    is_null: Mapped[bool] = mapped_column()
    storage_operation_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    slot_version: Mapped[int] = mapped_column()


class RelatedDrain(Base):
    __tablename__ = "note_related_drains"
    __table_args__ = (UniqueConstraint("owner_id", "mutation_id", name="uq_related_drain_mutation"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    local_id: Mapped[str] = mapped_column(String(120), index=True)
    actor_device_id: Mapped[str] = mapped_column(String(120))
    mutation_id: Mapped[str] = mapped_column(String(36))
    conditions_json: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(20))
    drain_version: Mapped[int] = mapped_column(default=1)
    lease_version: Mapped[int] = mapped_column(default=1)
    expires_at: Mapped[datetime] = mapped_column()
    transition_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class AnalysisRun(Base):
    __tablename__ = "note_analysis_runs"
    job_id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), unique=True)
    owner_id: Mapped[str] = mapped_column(String(80))
    local_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    run_version: Mapped[int] = mapped_column(default=1)
    source_epoch: Mapped[int] = mapped_column()
    input_slot_version: Mapped[int | None] = mapped_column(nullable=True)
    claimed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    claimed_until: Mapped[datetime | None] = mapped_column(nullable=True)
    dispatched: Mapped[bool] = mapped_column(default=False)
    receipt_json: Mapped[str | None] = mapped_column(Text, nullable=True)
