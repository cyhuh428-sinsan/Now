import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/core/database/app_database.dart';
import 'package:now_note/services/server_sync_service.dart';

void main() {
  group('ServerSyncService', () {
    late AppDatabase database;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
    });

    tearDown(() async {
      await database.close();
    });

    test('syncNotes stores pulled tree notes in local memo table', () async {
      final settings = ServerSettings(
        enabled: true,
        baseUrl: 'http://127.0.0.1:8750',
        token: '',
        userToken: '',
        ownerId: 'cyhuh',
        deviceId: 'android-test',
        lastSyncedAt: DateTime(2026, 5, 30),
      );

      await ServerSyncService(database).applyPulledNotesForTest(
        settings,
        [
          {
            'owner_id': 'cyhuh',
            'device_id': 'web-desktop',
            'local_id': 'tree-1',
            'note_type': 'tree',
            'title': '서버 계층 메모',
            'content': '서버에서 내려온 본문',
            'parent_local_id': null,
            'level': 1,
            'tags': 'cloud,shared',
            'source': 'web-tree',
            'created_at': '2026-05-31T00:00:00',
            'updated_at': '2026-05-31T00:10:00',
            'client_updated_at': '2026-05-31T00:10:00',
            'deleted_at': null,
          },
        ],
      );

      final memos = await database.select(database.memos).get();
      expect(memos.length, 1);
      expect(memos.first.memoId, 'tree-1');
      expect(memos.first.userId, 'cyhuh');
      expect(memos.first.source, 'note_tree');
      expect(memos.first.content, '서버 계층 메모\n서버에서 내려온 본문');
      expect(memos.first.tags, contains('kind=tree'));
      expect(memos.first.tags, contains('level=1'));
      expect(memos.first.tags, contains('serverTags=cloud,shared'));
    });

    test('syncNotes preserves pulled encrypted tree note payload', () async {
      const encrypted =
          'NOW_ENCRYPTED_V1:eyJ2IjoxLCJhbGciOiJBRVMtR0NNIiwiZGF0YSI6ImNpcGhlciJ9';
      final settings = ServerSettings(
        enabled: true,
        baseUrl: 'http://127.0.0.1:8750',
        token: '',
        userToken: '',
        ownerId: 'cyhuh',
        deviceId: 'android-test',
        lastSyncedAt: DateTime(2026, 5, 30),
      );

      await ServerSyncService(database).applyPulledNotesForTest(
        settings,
        [
          {
            'owner_id': 'cyhuh',
            'device_id': 'web-desktop',
            'local_id': 'encrypted-tree-1',
            'note_type': 'tree',
            'title': '비밀 메모',
            'content': encrypted,
            'parent_local_id': null,
            'level': 1,
            'tags': '',
            'source': 'web-tree',
            'created_at': '2026-05-31T00:00:00',
            'updated_at': '2026-05-31T00:10:00',
            'client_updated_at': '2026-05-31T00:10:00',
            'deleted_at': null,
          },
        ],
      );

      final memo = await (database.select(database.memos)
            ..where((m) => m.memoId.equals('encrypted-tree-1')))
          .getSingle();
      expect(memo.content, '비밀 메모\n$encrypted');
      expect(memo.source, 'note_tree');
    });

    test('syncNotes keeps first pull request even when local notes are empty', () {
      expect(shouldSkipServerSyncRequestForTest(const [], false, null), isFalse);
      expect(
        shouldSkipServerSyncRequestForTest(
          const [],
          false,
          DateTime(2026, 6, 1),
        ),
        isTrue,
      );
      expect(
        shouldSkipServerSyncRequestForTest(const [], true, DateTime(2026, 6, 1)),
        isFalse,
      );
    });
  });
}
