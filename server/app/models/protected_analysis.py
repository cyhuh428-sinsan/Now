"""Non-live client execution metadata; IDs may be provisional on SQLite."""
from datetime import datetime

from sqlalchemy import String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class ProtectedAnalysisClaim(Base):
    __tablename__ = "note_protected_analysis_claims"
    __table_args__ = (UniqueConstraint("owner_id", "mutation_id", name="uq_protected_analysis_claim_mutation"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    local_id: Mapped[str] = mapped_column(String(120), index=True)
    actor_device_id: Mapped[str] = mapped_column(String(120))
    mutation_id: Mapped[str] = mapped_column(String(36))
    job_id: Mapped[int] = mapped_column()
    job_id_mode: Mapped[str] = mapped_column(String(16))
    conditions_json: Mapped[str] = mapped_column(Text)
    progress_json: Mapped[str] = mapped_column(Text, default="{}")
    state: Mapped[str] = mapped_column(String(24))
    run_version: Mapped[int] = mapped_column(default=1)
    lease_version: Mapped[int] = mapped_column(default=1)
    expires_at: Mapped[datetime] = mapped_column()
