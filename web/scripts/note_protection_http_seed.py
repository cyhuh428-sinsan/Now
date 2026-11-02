"""Seed only a new, explicitly named isolated HTTP QA branch scope."""
import json
import re
import sys
from uuid import UUID

from sqlalchemy import select

from app.db import SessionLocal
from app.models.note import Note, UserAccount
from app.models.note_history import NoteHead
from app.models.note_v2 import NoteOfflineBranch


def main():
    run, mode, owner, local, branch = sys.argv[1:]
    if not re.fullmatch(r"[0-9a-f]{12}", run) or mode not in ("web", "desktop"):
        raise ValueError("qa_scope")
    if owner != f"qa_http_{run}_{mode}_a" or local != f"qa-http-{run}-target" or str(UUID(branch)) != branch:
        raise ValueError("qa_scope")
    stamp = "2026-10-30T00:00:00.000001Z"
    note = dict(id=None, owner_id=owner, local_id=local, device_id="qa-original-" + run,
                note_type="tree", title="HTTP QA branch", content="HTTP-QA-BRANCH-" + run + "\r\n",
                parent_local_id=None, level=1, tags=None, source=None, deleted_at=None,
                created_at=stamp, updated_at=stamp, client_updated_at=None)
    with SessionLocal() as db:
        if db.scalar(select(UserAccount.id).where(UserAccount.owner_id == owner)) is None or db.get(NoteHead, (owner, local)) is not None:
            raise ValueError("qa_existing_scope")
        if db.scalar(select(Note.id).where(Note.owner_id == owner, Note.local_id == local)) is not None:
            raise ValueError("qa_existing_scope")
        if db.get(NoteOfflineBranch, branch) is not None or db.scalar(select(NoteOfflineBranch.id).where(NoteOfflineBranch.owner_id == owner, NoteOfflineBranch.local_id == local)) is not None:
            raise ValueError("qa_existing_branch")
        db.add(NoteHead(owner_id=owner, local_id=local, version=0, identity_state="branch_only", history_generation=1))
        db.add(NoteOfflineBranch(id=branch, owner_id=owner, local_id=local, origin_device_id=note["device_id"],
                                 snapshot_json=json.dumps(dict(schema_version=1, note=note), ensure_ascii=True, separators=(",", ":"))))
        db.commit()
    print(json.dumps(dict(ok=True, owner=owner, local_id=local, branch_id=branch, current_absent=True)))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps(dict(ok=False, code="qa_seed_failed")))
        sys.exit(1)
