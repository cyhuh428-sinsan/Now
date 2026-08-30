import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now/core/database/app_database.dart';
import 'package:now/services/note_store_migration_service.dart';
import 'package:now_core/now_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('NoteStoreMigrationService', () {
    late AppDatabase appDb;
    late NoteDatabase noteDb;

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      appDb = AppDatabase.forTesting(NativeDatabase.memory());
      noteDb = NoteDatabase.forTesting(NativeDatabase.memory());
      // 옛 버전에서 올라온 기기를 흉내낸다. 노트 테이블이 옛 DB에 남아 있다.
      await appDb.customStatement('''
        CREATE TABLE memos (
          memo_id TEXT NOT NULL PRIMARY KEY,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          tags TEXT,
          source TEXT NOT NULL DEFAULT 'manual',
          extracted_id TEXT,
          created_at INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT 0
        )
      ''');
    });

    tearDown(() async {
      await appDb.close();
      await noteDb.close();
    });

    Future<void> insertOldMemo(String id, String content) {
      return appDb.customStatement(
        'INSERT INTO memos (memo_id, user_id, content, source, tags, '
        'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, 'local', content, 'note_tree', 'level=1', 1000, 1000],
      );
    }

    test('옛 DB의 메모를 새 노트 DB로 옮긴다', () async {
      await insertOldMemo('m1', '첫 메모');
      await insertOldMemo('m2', '둘째 메모');

      final moved =
          await NoteStoreMigrationService(appDb, noteDb).migrateIfNeeded();

      expect(moved, isTrue);
      final rows = await noteDb.select(noteDb.memos).get();
      expect(rows.map((m) => m.memoId), containsAll(['m1', 'm2']));
      expect(rows.firstWhere((m) => m.memoId == 'm1').content, '첫 메모');
      expect(rows.firstWhere((m) => m.memoId == 'm1').source, 'note_tree');
    });

    test('한 번 옮긴 뒤에는 다시 옮기지 않는다', () async {
      await insertOldMemo('m1', '첫 메모');
      final service = NoteStoreMigrationService(appDb, noteDb);

      expect(await service.migrateIfNeeded(), isTrue);
      await insertOldMemo('m2', '이전 완료 후 추가된 메모');

      expect(await service.migrateIfNeeded(), isFalse);
      final rows = await noteDb.select(noteDb.memos).get();
      expect(rows.map((m) => m.memoId), ['m1']);
    });

    test('옛 테이블이 없는 새 기기에서는 조용히 끝난다', () async {
      await appDb.customStatement('DROP TABLE memos');

      final moved =
          await NoteStoreMigrationService(appDb, noteDb).migrateIfNeeded();

      expect(moved, isFalse);
      expect(await noteDb.select(noteDb.memos).get(), isEmpty);
    });

    test('같은 메모를 두 번 넣어도 중복되지 않는다', () async {
      await insertOldMemo('m1', '첫 메모');
      await noteDb.customStatement(
        'INSERT INTO memos (memo_id, user_id, content, source, '
        'created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['m1', 'local', '이미 있는 메모', 'note_tree', 1000, 1000],
      );

      await NoteStoreMigrationService(appDb, noteDb).migrateIfNeeded();

      final rows = await noteDb.select(noteDb.memos).get();
      expect(rows.length, 1);
      expect(rows.single.content, '이미 있는 메모');
    });
  });
}
