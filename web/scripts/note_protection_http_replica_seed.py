"""Add one physical replica only to a fresh, exact isolated QA note."""
import json
import re
import sys

from sqlalchemy import inspect, select

from app.db import SessionLocal
from app.models.note import Note, UserAccount
from app.models.note_crypto import NoteCryptoFence
from app.models.note_history import NoteHead, NoteInventory
from app.services import note_v2


def main():
    run, mode, owner, local = sys.argv[1:]
    if not re.fullmatch(r"[0-9a-f]{12}", run) or mode not in ("web", "desktop"):
        raise ValueError("qa_scope")
    if owner != f"qa_http_{run}_{mode}_a" or local != f"qa-http-{run}-target":
        raise ValueError("qa_scope")
    with SessionLocal() as db:
        if db.scalar(select(UserAccount.id).where(UserAccount.owner_id == owner)) is None:
            raise ValueError("qa_account")
        head, rows = note_v2.scope(db, owner, local)
        if len(rows) != 1 or head is None or (head.crypto_epoch, head.version, head.history_generation) != (0, 1, 1):
            raise ValueError("qa_existing_scope")
        if db.get(NoteCryptoFence, (owner, local)) is not None:
            raise ValueError("qa_active_scope")
        source = rows[0]
        if source.content != "HTTP-QA-ORIGINAL-" + run + "\r\n" or source.parent_local_id is not None or source.level != 1:
            raise ValueError("qa_original_scope")
        values = {column.key: getattr(source, column.key) for column in inspect(Note).columns if column.key != "id"}
        values["device_id"] = "qa-physical-" + run
        replica = Note(**values)
        db.add(replica)
        db.flush()
        head = note_v2.baseline(db, owner, local)
        inventory = list(db.scalars(select(NoteInventory).where(NoteInventory.owner_id == owner, NoteInventory.local_id == local)))
        if len(inventory) != 2 or head.identity_state != "coherent":
            raise ValueError("qa_replica_baseline")
        ids = sorted([source.id, replica.id])
        db.commit()
    print(json.dumps(dict(ok=True, owner=owner, local_id=local, physical_ids=ids)))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps(dict(ok=False, code="qa_replica_seed_failed")))
        sys.exit(1)
