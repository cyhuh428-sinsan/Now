"""Cold-process replica helper regression; only an in-memory SQLite database."""
import importlib
import json
import os
import pkgutil
import runpy
import sys
from pathlib import Path

os.environ["NOW_DATABASE_URL"] = "sqlite:///:memory:"
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "server"))

from app.db import Base, SessionLocal, engine
from app.models.note import Note, UserAccount
from app.models.note_history import NoteHead, NoteInventory
from app.services import note_v2
import app.models

for item in pkgutil.iter_modules(app.models.__path__):
    importlib.import_module("app.models." + item.name)
Base.metadata.create_all(engine)
run = "012345abcdef"
owner = f"qa_http_{run}_desktop_a"
local = f"qa-http-{run}-target"
with engine.begin() as connection:
    connection.execute(UserAccount.__table__.insert().values(owner_id=owner, display_name="Synthetic"))
    connection.execute(Note.__table__.insert().values(owner_id=owner, device_id="qa-original",
        local_id=local, note_type="tree", title="Synthetic", content="HTTP-QA-ORIGINAL-" + run + "\r\n", level=1))
with SessionLocal() as db:
    head = note_v2.baseline(db, owner, local)
    head.version = 1
    db.commit()
namespace = runpy.run_path(str(Path(__file__).with_name("note_protection_http_replica_seed.py")))
sys.argv = ["qa", run, "desktop", owner, local]
try:
    namespace["main"]()
    with SessionLocal() as db:
        head, rows = note_v2.scope(db, owner, local)
        assert len(rows) == 2
        inventory = list(db.query(NoteInventory).filter_by(owner_id=owner, local_id=local))
        assert len(inventory) == 2 and head.identity_state == "coherent"
        selected = next(row for row in inventory if row.revision_id == head.head_revision_id)
        assert selected.note_id == max(row.id for row in rows)
        assert (head.crypto_epoch, head.version, head.history_generation) == (0, 2, 2)
    try:
        namespace["main"]()
        raise AssertionError("duplicate seed accepted")
    except ValueError as error:
        assert str(error) == "qa_existing_scope"
    print(json.dumps({"ok": True, "cold_process": True, "selected_replica": True, "duplicate_rejected": True}))
finally:
    engine.dispose()
