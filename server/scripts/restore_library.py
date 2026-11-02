"""기존 메모 복구와 별개인 Stage D 섹션 오프라인 복구 도구."""
import argparse
import json
import os
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Stage D 자원 복구. 기존 메모/계정은 변경하지 않습니다.")
    parser.add_argument("--backup", required=True)
    parser.add_argument("--apply", action="store_true", help="생략하면 파일 검증만 수행")
    args = parser.parse_args()
    if not os.environ.get("NOW_DATABASE_URL"):
        parser.error("대상 NOW_DATABASE_URL을 명시해야 합니다")
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from sqlalchemy.orm import Session
    from app.db import engine
    from app.models.library import LibraryMutation, LibraryResource
    from app.api.admin import _verify_backup_payload
    from app.services.library_backup import restore_library
    backup = json.loads(Path(args.backup).read_text(encoding="utf-8"))
    if any(check["status"] != "ok" for check in _verify_backup_payload(backup)):
        parser.error("백업 검증 실패")
    if not args.apply:
        print("백업 검증 통과; DB 변경 없음")
        return
    LibraryResource.__table__.create(engine, checkfirst=True)
    LibraryMutation.__table__.create(engine, checkfirst=True)
    with Session(engine) as db:
        result = restore_library(db, backup)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
