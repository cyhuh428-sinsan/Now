from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

SCHEMA_MIGRATION_LOCK_ID = 87502026


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    from app.models.note import (  # noqa: F401
        AnalysisJob,
        Note,
        Recording,
        ReleaseEvidenceRecord,
        SyncLog,
        UserAccount,
        UserDevice,
    )

    if engine.dialect.name == "postgresql":
        with engine.begin() as conn:
            conn.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": SCHEMA_MIGRATION_LOCK_ID})
            Base.metadata.create_all(bind=conn)
            migrate_schema(conn)
        return

    Base.metadata.create_all(bind=engine)
    migrate_schema()


def migrate_schema(conn: Connection | None = None) -> None:
    bind = conn or engine
    inspector = inspect(bind)
    if "user_accounts" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("user_accounts")}
    columns = {
        "access_token_hash": "VARCHAR(128)",
        "access_token_issued_at": "TIMESTAMP",
        "access_token_last_used_at": "TIMESTAMP",
    }
    missing = [(name, definition) for name, definition in columns.items() if name not in existing_columns]
    if not missing:
        return
    if conn is not None:
        for name, definition in missing:
            conn.execute(text(f"ALTER TABLE user_accounts ADD COLUMN {name} {definition}"))
        return
    with engine.begin() as fallback_conn:
        for name, definition in missing:
            fallback_conn.execute(text(f"ALTER TABLE user_accounts ADD COLUMN {name} {definition}"))
