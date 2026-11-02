"""선택형 v3 백업 검증과 명시적인 빈 DB 복원. 서버는 시작하지 않는다."""
import argparse
import json
import os
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description='NowNote v3 백업 검증·빈 DB 복원')
    parser.add_argument('--backup', required=True)
    parser.add_argument('--apply', action='store_true', help='명시한 빈 DB에 적용; 생략하면 파일 검증만 수행')
    args = parser.parse_args()
    if args.apply and not os.environ.get('NOW_DATABASE_URL'):
        parser.error('적용하려면 대상 NOW_DATABASE_URL을 명시해야 합니다')
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from sqlalchemy import create_engine
    from sqlalchemy.exc import SQLAlchemyError
    from app.services.note_backup import validate_backup, restore_empty
    from app.services.note_crypto_storage import strict_object
    engine = None
    try:
        backup = json.loads(Path(args.backup).read_text(encoding='utf-8'), object_pairs_hook=strict_object)
        counts = validate_backup(backup)
        result = {'database_changed': False, 'section_counts': counts, 'server_started': False,
                  'requires_reauthentication': True, 'includes_recording_files': False}
        if args.apply:
            engine = create_engine(os.environ['NOW_DATABASE_URL'], hide_parameters=True)
            result.update(restore_empty(engine, backup), database_changed=True)
        print(json.dumps(result, ensure_ascii=True))
    except (OSError, ValueError, TypeError, KeyError, SQLAlchemyError):
        # SQL exceptions can contain credentials, row values and connection URLs.
        parser.error('백업 또는 빈 대상 DB 검증 실패; 변경 내용은 적용하지 않았습니다')
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == '__main__':
    main()
