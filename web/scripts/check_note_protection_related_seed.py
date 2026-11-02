"""Exercise the exact linked-only seed with a disposable in-memory database."""
import os
import runpy
import sys
from pathlib import Path

os.environ["NOW_DATABASE_URL"] = "sqlite:///:memory:"
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "server"))
from app.main import app  # noqa: F401
from app.db import SessionLocal, create_tables, engine
from app.models.note import Note, UserAccount
from app.models.note_history import NoteHead
from app.models.note_related import LinkedText
from sqlalchemy import select, func

create_tables()
run = "012345abcdef"
owner, local = f"qa_http_{run}_desktop_a", f"qa-http-{run}-target"
with SessionLocal() as db:
    db.add(UserAccount(owner_id=owner, display_name="Synthetic"))
    db.commit()
namespace = runpy.run_path(str(Path(__file__).with_name("note_protection_http_related_seed.py")))
sys.argv = ["qa", run, "desktop", owner, local]
try:
    namespace["main"]()
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Note)) == 0
        assert db.scalar(select(func.count()).select_from(LinkedText)) == 4
        assert db.get(NoteHead, (owner, local)).identity_state == "related_only"
    try:
        namespace["main"]()
        raise AssertionError("duplicate seed accepted")
    except ValueError as error:
        assert str(error) == "qa_existing_scope"
    print("linked-only seed: memory-only 4 slots, no Note, duplicate rejected PASS")
finally:
    engine.dispose()
