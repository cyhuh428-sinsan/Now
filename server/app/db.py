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
        GroupMessage,
        GroupMessageRead,
        MessengerAttachment,
        MessengerMessage,
        MessengerRoom,
        MessengerRoomMember,
        Note,
        Recording,
        ReleaseEvidenceRecord,
        SyncLog,
        UserAccount,
        UserDevice,
        UserGroup,
        WebSession,
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
    table_names = inspector.get_table_names()
    migrations = []
    if "user_accounts" in table_names:
        account_columns = {column["name"] for column in inspector.get_columns("user_accounts")}
        account_migrations = {
            "password_hash": "VARCHAR(240)",
            "password_updated_at": "TIMESTAMP",
            "password_recovery_hash": "VARCHAR(128)",
            "password_recovery_issued_at": "TIMESTAMP",
            "access_token_hash": "VARCHAR(128)",
            "access_token_issued_at": "TIMESTAMP",
            "access_token_last_used_at": "TIMESTAMP",
        }
        migrations.extend(
            ("user_accounts", name, definition)
            for name, definition in account_migrations.items()
            if name not in account_columns
        )
    if "user_devices" in table_names:
        device_columns = {column["name"] for column in inspector.get_columns("user_devices")}
        device_migrations = {
            "access_token_hash": "VARCHAR(128)",
            "access_token_value": "VARCHAR(240)",
            "access_token_issued_at": "TIMESTAMP",
            "access_token_last_used_at": "TIMESTAMP",
        }
        migrations.extend(
            ("user_devices", name, definition)
            for name, definition in device_migrations.items()
            if name not in device_columns
        )
    if "user_groups" in table_names:
        group_columns = {column["name"] for column in inspector.get_columns("user_groups")}
        group_migrations = {
            "invite_code_hash": "VARCHAR(128)",
            "invite_code_updated_at": "TIMESTAMP",
        }
        migrations.extend(
            ("user_groups", name, definition)
            for name, definition in group_migrations.items()
            if name not in group_columns
        )
    if not migrations:
        return
    if conn is not None:
        for table, name, definition in migrations:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
        return
    with engine.begin() as fallback_conn:
        for table, name, definition in migrations:
            fallback_conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))
