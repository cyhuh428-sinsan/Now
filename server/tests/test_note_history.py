"""E1 history storage and v1 compatibility boundaries."""
from uuid import uuid4

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError


def test_history_schema_is_additive(client, db):
    tables = set(inspect(db.bind).get_table_names())
    assert {"note_heads", "note_revisions", "note_inventory"} <= tables


def test_existing_duplicate_new_daily_batch_behavior(db):
    """Keep the existing deferred-flush boundary visible during E1 design."""
    from app.schemas.note import NoteIn
    from app.services.note_sync import upsert_note

    owner = "e1_probe_" + uuid4().hex
    item = NoteIn(owner_id=owner, device_id="same", local_id="daily:2026-10-29",
                  note_type="daily", title="synthetic", content="first")
    first = upsert_note(item, db)
    second = upsert_note(item.model_copy(update={"content": "second"}), db)
    assert first is not second
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
