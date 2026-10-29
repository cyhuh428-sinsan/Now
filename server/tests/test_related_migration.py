"""Actual pre-C1 tables, additive startup, atomic and one-shot classification."""
import os
from datetime import datetime
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event, inspect, select
from sqlalchemy.engine import make_url
from sqlalchemy.schema import CreateSchema, DropSchema
from sqlalchemy.orm import Session


@pytest.fixture
def legacy(tmp_path, monkeypatch):
    import app.db as database
    from app.models.note import AnalysisJob, Recording
    url = os.environ.get("NOW_E4A1_TEST_POSTGRES_URL")
    schema, admin = None, None
    if url:
        assert make_url(url).database == "nownote_e4a1_qa"
        schema = "c1_migration_" + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as conn:
            conn.execute(CreateSchema(schema))
        engine = create_engine(url, connect_args={"options": "-csearch_path=" + schema})
    else:
        engine = create_engine("sqlite:///" + (tmp_path / "legacy.db").as_posix())
    new_tables = {"note_linked_schema", "note_linked_texts", "note_related_drains", "note_analysis_runs"}
    try:
        with engine.begin() as conn:
            for table in database.Base.metadata.sorted_tables:
                if table.name not in new_tables:
                    table.create(conn)
            stamp = datetime(2003, 2, 1, 4, 5, 6)
            conn.execute(AnalysisJob.__table__.insert().values(owner_id="legacy_synthetic", note_local_id="linked",
                job_type="memo_summary", input_text="\r\nold input", result_json=' {"x": 1}\n', error_message=None,
                status="done", created_at=stamp, updated_at=stamp))
            conn.execute(Recording.__table__.insert().values(owner_id="legacy_synthetic", note_local_id="linked",
                device_id="past", local_id="rec", file_name="old.wav", content_type="audio/wav", storage_path="synthetic.wav",
                transcript="", created_at=stamp, updated_at=stamp))
        monkeypatch.setattr(database, "engine", engine)
        yield engine, database
    finally:
        engine.dispose()
        if schema:
            with admin.begin() as conn:
                conn.execute(DropSchema(schema, cascade=True))
            admin.dispose()


def original_rows(engine):
    from app.models.note import AnalysisJob, Recording
    with engine.connect() as conn:
        return [[tuple(r) for r in conn.execute(select(m.__table__).order_by(m.id))] for m in (AnalysisJob, Recording)]


def test_actual_legacy_classifies_once_and_does_not_repair_missing_metadata(legacy):
    from app.models.note_related import LinkedSchema, LinkedText
    from app.models.note_history import NoteHead
    from app.services.related_text import slots
    from fastapi import HTTPException
    engine, database = legacy
    before = original_rows(engine)
    database.create_tables(); database.create_tables()
    assert original_rows(engine) == before
    with Session(engine) as db:
        assert db.get(LinkedSchema, 1).version == 1
        values = list(db.scalars(select(LinkedText)))
        assert len(values) == 4 and all(v.slot_version == 0 and v.storage_operation_id is None for v in values)
        assert sum(v.is_null for v in values) == 1
        assert db.get(NoteHead, ("legacy_synthetic", "linked")).identity_state == "related_only"
        db.delete(values[0]); db.commit()
    database.create_tables()
    with Session(engine) as db:
        assert len(list(db.scalars(select(LinkedText)))) == 3
        with pytest.raises(HTTPException) as exc:
            slots(db, "legacy_synthetic", "linked")
        assert exc.value.status_code == 409


def test_future_metadata_schema_blocks_older_startup(legacy):
    from app.models.note_related import LinkedSchema
    engine, database = legacy
    database.create_tables()
    with Session(engine) as db:
        db.get(LinkedSchema, 1).version = 2; db.commit()
    with pytest.raises(RuntimeError, match="unsupported linked metadata schema"):
        database.create_tables()


def test_initial_classification_sql_failure_rolls_back_schema_and_originals(legacy):
    engine, database = legacy
    before = original_rows(engine); fired = []
    def fail(conn, cursor, statement, parameters, context, many):
        if statement.lower().startswith("insert into note_linked_texts"):
            fired.append(True); raise RuntimeError("synthetic initial classification failure")
    event.listen(engine, "before_cursor_execute", fail)
    try:
        with pytest.raises(RuntimeError, match="synthetic initial classification"):
            database.create_tables()
    finally:
        event.remove(engine, "before_cursor_execute", fail)
    assert fired and original_rows(engine) == before
    assert not inspect(engine).has_table("note_linked_schema")
    database.create_tables()
