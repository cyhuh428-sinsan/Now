"""Stage D 전용 합성 서버. 실제 사용자 DB/설정은 읽지 않는다."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
BASE = Path("D:/tmp/now-240-stage-d")
BASE.mkdir(parents=True, exist_ok=True)
os.environ.update({
    "NOW_DATABASE_URL": f"sqlite:///{(BASE / 'library-qa.db').as_posix()}",
    "NOW_STORAGE_DIR": str(BASE / "recordings"),
    "NOW_MESSENGER_STORAGE_DIR": str(BASE / "messenger"),
    "NOW_NOTE_ATTACHMENT_STORAGE_DIR": str(BASE / "attachments"),
    "NOW_USER_TOKEN_REQUIRED": "true",
    "NOW_SERVER_NAME": "NowNote Stage D synthetic QA",
})
sys.path.insert(0, str(ROOT / "server"))
from app.db import SessionLocal, create_tables
from app.models import *  # noqa: F403 - register the actual integrated models
from app.services.user_accounts import create_user_account, issue_web_session, issue_user_device_access_token
create_tables()
accounts = {}
with SessionLocal() as db:
    for owner in ("qa_library_alice", "qa_library_bob"):
        from app.models.note import UserAccount
        from sqlalchemy import select
        if not db.scalar(select(UserAccount).where(UserAccount.owner_id == owner)):
            create_user_account(db, owner_id=owner, password="StageD-synthetic-only-42!", email=f"{owner}@example.test", group_name="stage-d-qa")
        db.flush()
        _, session = issue_web_session(db, owner_id=owner)
        _, token = issue_user_device_access_token(db, owner_id=owner, device_id="stage-d-electron")
        accounts[owner] = {"session": session, "token": token}
    db.commit()
(BASE / "synthetic-accounts.json").write_text(json.dumps(accounts), encoding="utf-8")
import uvicorn
uvicorn.run("app.main:app", host="127.0.0.1", port=8750, log_level="warning")
