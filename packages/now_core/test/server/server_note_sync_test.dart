import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:now_core/now_core.dart';

/// 실제 서버를 부르지 않는다. dio 어댑터를 갈아 끼워 가짜 응답을 준다.
/// (server_connection_test.dart와 같은 관례를 따른다.)
typedef FakeHandler = FutureOr<ResponseBody> Function(RequestOptions options);

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final FakeHandler handler;
  final List<RequestOptions> requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _jsonBody(Map<String, dynamic> data, {int status = 200}) {
  return ResponseBody.fromString(
    jsonEncode(data),
    status,
    headers: {
      Headers.contentTypeHeader: ['application/json; charset=utf-8'],
    },
  );
}

Dio _dioFor(
  _FakeAdapter adapter, {
  String baseUrl = 'http://server.test:8750',
}) {
  return Dio(BaseOptions(baseUrl: baseUrl))..httpClientAdapter = adapter;
}

ServerSettings _settings({
  bool enabled = true,
  String baseUrl = 'http://server.test:8750',
  DateTime? lastSyncedAt,
}) {
  return ServerSettings(
    enabled: enabled,
    baseUrl: baseUrl,
    token: '',
    userToken: '',
    webSessionToken: '',
    ownerId: 'cyhuh',
    deviceId: 'android-unit-test',
    lastSyncedAt: lastSyncedAt,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late NoteDatabase db;

  setUp(() {
    db = NoteDatabase.forTesting(NativeDatabase.memory());
    // syncNotes()가 서버 시각을 받으면 settings.save()를 호출해 저장소에
    // 쓴다. 실제 플러그인 채널이 없으면 예외가 나므로 가짜 값을 채운다.
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  tearDown(() async {
    await db.close();
  });

  group('push payload 구성', () {
    test('일자별 메모(daily)가 세그먼트를 이어붙여 payload로 조립된다', () async {
      final updatedAt = DateTime(2026, 8, 20, 9, 0, 0);
      await db.into(db.meetings).insert(
            MeetingsCompanion.insert(
              meetingId: 'daily:2026-08-20',
              title: const Value(''),
              recordType: const Value('memo'),
              summary: const Value('요약본'),
              createdAt: Value(updatedAt),
              updatedAt: Value(updatedAt),
            ),
          );
      await db.into(db.transcriptSegments).insert(
            TranscriptSegmentsCompanion.insert(
              segmentId: 'seg-1',
              meetingId: 'daily:2026-08-20',
              content: '첫 줄',
              timestamp: Value(DateTime(2026, 8, 20, 8, 0, 0)),
            ),
          );
      await db.into(db.transcriptSegments).insert(
            TranscriptSegmentsCompanion.insert(
              segmentId: 'seg-2',
              meetingId: 'daily:2026-08-20',
              content: '둘째 줄',
              timestamp: Value(DateTime(2026, 8, 20, 8, 30, 0)),
            ),
          );

      final adapter = _FakeAdapter(
        (options) => _jsonBody({'pushed_notes': [], 'pulled_notes': []}),
      );
      final dio = _dioFor(adapter);
      await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: const {},
        fullSync: true,
      );

      final sent = adapter.requests.single.data as Map;
      final notes = sent['notes'] as List;
      expect(notes.length, 1);
      final note = notes.single as Map;
      expect(note['note_type'], 'daily');
      expect(note['local_id'], 'daily:2026-08-20');
      expect(note['title'], '일자 메모'); // 제목이 비어 있으면 기본값을 쓴다
      expect(note['content'], '첫 줄\n\n둘째 줄');
      expect(note['tags'], 'recordType=memo');
      expect(note['source'], 'now_app');
      expect(note['parent_local_id'], isNull);
      expect(note['deleted_at'], isNull);
      expect(
        note['client_updated_at'],
        updatedAt.toIso8601String(),
      );
    });

    test('일자별 메모가 발언 기록이 없으면 summary를 대신 쓴다', () async {
      final updatedAt = DateTime(2026, 8, 20, 9, 0, 0);
      await db.into(db.meetings).insert(
            MeetingsCompanion.insert(
              meetingId: 'daily:2026-08-21',
              title: const Value('오늘 할 일'),
              recordType: const Value('memo'),
              summary: const Value('요약만 있음'),
              createdAt: Value(updatedAt),
              updatedAt: Value(updatedAt),
            ),
          );

      final adapter = _FakeAdapter(
        (options) => _jsonBody({'pushed_notes': [], 'pulled_notes': []}),
      );
      final dio = _dioFor(adapter);
      await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: const {},
        fullSync: true,
      );

      final note =
          (adapter.requests.single.data as Map)['notes'].first as Map;
      expect(note['title'], '오늘 할 일');
      expect(note['content'], '요약만 있음');
    });

    test('계층 메모(tree)가 제목/본문/부모/레벨로 나뉘어 payload로 조립된다', () async {
      final updatedAt = DateTime(2026, 8, 20, 10, 0, 0);
      await db.into(db.memos).insert(
            MemosCompanion.insert(
              memoId: 'tree-1',
              userId: 'cyhuh',
              content: '메모 제목\n메모 본문',
              tags: const Value('kind=tree;parent=parent-1;level=2'),
              source: const Value('note_tree'),
              createdAt: Value(updatedAt),
              updatedAt: Value(updatedAt),
            ),
          );

      final adapter = _FakeAdapter(
        (options) => _jsonBody({'pushed_notes': [], 'pulled_notes': []}),
      );
      final dio = _dioFor(adapter);
      await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: const {},
        fullSync: true,
      );

      final note =
          (adapter.requests.single.data as Map)['notes'].single as Map;
      expect(note['note_type'], 'tree');
      expect(note['local_id'], 'tree-1');
      expect(note['title'], '메모 제목');
      expect(note['content'], '메모 본문');
      expect(note['parent_local_id'], 'parent-1');
      expect(note['level'], 2);
      expect(note['tags'], 'kind=tree;parent=parent-1;level=2');
      expect(note['source'], 'note_tree');
      expect(note['deleted_at'], isNull);
    });

    test('deleted=true 태그가 붙은 계층 메모는 push payload에서 빠진다', () async {
      await db.into(db.memos).insert(
            MemosCompanion.insert(
              memoId: 'tree-deleted',
              userId: 'cyhuh',
              content: '지워진 메모',
              tags: const Value('kind=tree;parent=;level=1;deleted=true'),
              source: const Value('note_tree'),
            ),
          );

      final adapter = _FakeAdapter(
        (options) => _jsonBody({'pushed_notes': [], 'pulled_notes': []}),
      );
      final dio = _dioFor(adapter);
      // lastSyncedAt이 없으면(첫 동기화) notes가 비어도 요청을 건너뛰지
      // 않으므로, "빠졌다"는 사실이 실제로 요청 본문에서 확인된다.
      await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(lastSyncedAt: null),
        pendingDeletedTreeMemos: const {},
      );

      expect(adapter.requests, hasLength(1));
      final notes = (adapter.requests.single.data as Map)['notes'] as List;
      expect(notes, isEmpty);
    });

    test('삭제 대기 계층 메모 목록이 삭제 노트로 payload에 실린다', () async {
      final deletedAt = DateTime(2026, 8, 19, 0, 0, 0);
      final adapter = _FakeAdapter(
        (options) => _jsonBody({'pushed_notes': [], 'pulled_notes': []}),
      );
      final dio = _dioFor(adapter);
      await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: {
          'del-1': buildDeletedTreeMemoEntry(
            deletedAt: deletedAt,
            level: 2,
            parentLocalId: 'parent-x',
            title: '지운 메모 제목',
          ),
        },
        fullSync: true,
      );

      final notes = (adapter.requests.single.data as Map)['notes'] as List;
      expect(notes, hasLength(1));
      final note = notes.single as Map;
      expect(note['local_id'], 'del-1');
      expect(note['note_type'], 'tree');
      expect(note['title'], '지운 메모 제목');
      expect(note['parent_local_id'], 'parent-x');
      expect(note['level'], 2);
      expect(note['deleted_at'], deletedAt.toIso8601String());
      expect(note['client_updated_at'], deletedAt.toIso8601String());
    });
  });

  group('서버 응답 처리', () {
    test('성공 응답을 받으면 ServerSyncResult가 업로드/다운로드 개수를 담는다', () async {
      final adapter = _FakeAdapter(
        (options) => _jsonBody({
          'pushed_notes': [
            {'note_type': 'daily', 'local_id': 'd1'},
            {'note_type': 'daily', 'local_id': 'd2'},
          ],
          'pulled_notes': [
            {'note_type': 'unknown-type-ignored'},
          ],
          'server_time': '2026-08-20T09:30:00.000',
        }),
      );
      final dio = _dioFor(adapter);
      final outcome = await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: const {},
        fullSync: true,
      );

      expect(outcome.result.uploaded, 2);
      expect(outcome.result.downloaded, 1);
      expect(outcome.result.message, '메모 업로드 2건 · 서버 변경 1건 확인');
      expect(
        outcome.result.syncedAt,
        DateTime.parse('2026-08-20T09:30:00.000'),
      );
      expect(outcome.clearedDeletedTreeMemoIds, isEmpty);
    });

    test('보낼 것도 받을 것도 없으면 그 메시지를 담는다(빈 응답)', () async {
      final adapter = _FakeAdapter(
        (options) =>
            _jsonBody({'pushed_notes': [], 'pulled_notes': []}),
      );
      final dio = _dioFor(adapter);
      final outcome = await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: const {},
        fullSync: true,
      );

      expect(outcome.result.uploaded, 0);
      expect(outcome.result.downloaded, 0);
      expect(outcome.result.message, '동기화할 메모가 없습니다');
    });

    test('요청 본문이 owner_id/device_id/updated_after를 담는다', () async {
      final adapter = _FakeAdapter(
        (options) =>
            _jsonBody({'pushed_notes': [], 'pulled_notes': []}),
      );
      final dio = _dioFor(adapter);
      final lastSyncedAt = DateTime(2026, 8, 1, 0, 0, 0);
      await db.into(db.memos).insert(
            MemosCompanion.insert(
              memoId: 'tree-1',
              userId: 'cyhuh',
              content: '제목\n본문',
              source: const Value('note_tree'),
            ),
          );
      await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(lastSyncedAt: lastSyncedAt),
        pendingDeletedTreeMemos: const {},
      );

      final sent = adapter.requests.single.data as Map;
      expect(sent['owner_id'], 'cyhuh');
      expect(sent['device_id'], 'android-unit-test');
      expect(sent['updated_after'], lastSyncedAt.toIso8601String());
      expect(sent['include_deleted'], true);
      expect(adapter.requests.single.path, '/api/v1/sync');
    });

    test('서버 시각을 받으면 settings.lastSyncedAt으로 저장한다', () async {
      final adapter = _FakeAdapter(
        (options) => _jsonBody({
          'pushed_notes': [],
          'pulled_notes': [],
          'server_time': '2026-08-20T12:00:00.000',
        }),
      );
      final dio = _dioFor(adapter);
      await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: const {},
        fullSync: true,
      );

      final reloaded = await ServerSettings.load();
      expect(
        reloaded.lastSyncedAt,
        DateTime.parse('2026-08-20T12:00:00.000'),
      );
    });
  });

  group('pull(내려받기) 반영 - applyPulledNotes', () {
    test('새 계층 메모를 로컬에 추가한다', () async {
      final cleared = await ServerNoteSyncApi.applyPulledNotes(
        db: db,
        settings: _settings(),
        pulledNotes: [
          {
            'note_type': 'tree',
            'local_id': 'pulled-tree-1',
            'title': '내려온 제목',
            'content': '내려온 본문',
            'parent_local_id': 'parent-9',
            'level': 3,
            'tags': '',
            'client_updated_at': '2026-08-20T00:00:00.000',
            'deleted_at': null,
          },
        ],
      );

      expect(cleared, isEmpty);
      final memo = await (db.select(db.memos)
            ..where((m) => m.memoId.equals('pulled-tree-1')))
          .getSingle();
      expect(memo.content, '내려온 제목\n내려온 본문');
      expect(memo.source, 'note_tree');
      expect(memo.userId, 'cyhuh');
      expect(memo.tags, contains('kind=tree'));
      expect(memo.tags, contains('parent=parent-9'));
      expect(memo.tags, contains('level=3'));
    });

    test('새 일자별 메모를 로컬에 추가하고 세그먼트를 만든다', () async {
      await ServerNoteSyncApi.applyPulledNotes(
        db: db,
        settings: _settings(),
        pulledNotes: [
          {
            'note_type': 'daily',
            'local_id': 'daily:2026-08-20',
            'title': '내려온 일자 메모',
            'content': '오늘 한 일',
            'client_updated_at': '2026-08-20T05:00:00.000',
            'deleted_at': null,
          },
        ],
      );

      final meeting = await (db.select(db.meetings)
            ..where((m) => m.meetingId.equals('daily:2026-08-20')))
          .getSingle();
      expect(meeting.recordType, 'memo');
      expect(meeting.status, 'closed');
      expect(meeting.summary, '오늘 한 일');
      expect(meeting.startedAt, DateTime(2026, 8, 20));

      final segments = await (db.select(db.transcriptSegments)
            ..where((s) => s.meetingId.equals('daily:2026-08-20')))
          .get();
      expect(segments, hasLength(1));
      expect(segments.single.content, '오늘 한 일');
      expect(segments.single.segmentId, 'daily:2026-08-20_server');
    });

    test('기존 계층 메모보다 서버가 최신이면 갱신한다', () async {
      await db.into(db.memos).insert(
            MemosCompanion.insert(
              memoId: 'tree-2',
              userId: 'cyhuh',
              content: '옛 제목\n옛 본문',
              tags: const Value('kind=tree;parent=;level=1'),
              source: const Value('note_tree'),
              createdAt: Value(DateTime(2026, 8, 1)),
              updatedAt: Value(DateTime(2026, 8, 1)),
            ),
          );

      await ServerNoteSyncApi.applyPulledNotes(
        db: db,
        settings: _settings(),
        pulledNotes: [
          {
            'note_type': 'tree',
            'local_id': 'tree-2',
            'title': '새 제목',
            'content': '새 본문',
            'parent_local_id': null,
            'level': 1,
            'tags': '',
            'client_updated_at': '2026-08-10T00:00:00.000',
            'deleted_at': null,
          },
        ],
      );

      final memo = await (db.select(db.memos)
            ..where((m) => m.memoId.equals('tree-2')))
          .getSingle();
      expect(memo.content, '새 제목\n새 본문');
    });

    test('로컬이 서버보다 최신이면 서버 값으로 덮어쓰지 않는다', () async {
      await db.into(db.memos).insert(
            MemosCompanion.insert(
              memoId: 'tree-3',
              userId: 'cyhuh',
              content: '로컬 최신 제목\n로컬 최신 본문',
              tags: const Value('kind=tree;parent=;level=1'),
              source: const Value('note_tree'),
              createdAt: Value(DateTime(2026, 8, 20)),
              updatedAt: Value(DateTime(2026, 8, 20, 12, 0, 0)),
            ),
          );

      await ServerNoteSyncApi.applyPulledNotes(
        db: db,
        settings: _settings(),
        pulledNotes: [
          {
            'note_type': 'tree',
            'local_id': 'tree-3',
            'title': '옛 서버 제목',
            'content': '옛 서버 본문',
            'client_updated_at': '2026-08-20T10:00:00.000',
            'deleted_at': null,
          },
        ],
      );

      final memo = await (db.select(db.memos)
            ..where((m) => m.memoId.equals('tree-3')))
          .getSingle();
      expect(memo.content, '로컬 최신 제목\n로컬 최신 본문');
    });
  });

  group('ServerNoteSyncOutcome.clearedDeletedTreeMemoIds', () {
    test('push 후 서버가 삭제를 확인해 주면(pushed_notes) 대기 목록에서 지울 id로 담는다', () async {
      final deletedAt = DateTime(2026, 8, 19);
      final adapter = _FakeAdapter(
        (options) => _jsonBody({
          'pushed_notes': [
            {
              'note_type': 'tree',
              'local_id': 'del-1',
              'deleted_at': deletedAt.toIso8601String(),
            },
          ],
          'pulled_notes': [],
        }),
      );
      final dio = _dioFor(adapter);
      final outcome = await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: {
          'del-1': buildDeletedTreeMemoEntry(deletedAt: deletedAt, level: 1),
        },
        fullSync: true,
      );

      expect(outcome.clearedDeletedTreeMemoIds, {'del-1'});
    });

    test('deleted_at이 문자열이 아닌 falsy 값(false)이면 삭제로 오인하지 않는다', () async {
      // 서버는 deleted_at을 ISO 문자열 또는 null로만 보낸다(datetime | None 스키마).
      // 다른 클라이언트나 향후 변경으로 false/0 같은 값이 오더라도
      // toString() 판정에 걸려 로컬 메모가 지워지면 안 된다.
      await db.into(db.memos).insert(
            MemosCompanion.insert(
              memoId: 'del-falsy',
              userId: 'cyhuh',
              content: '살아있어야 하는 메모',
              source: const Value('note_tree'),
            ),
          );

      final cleared = await ServerNoteSyncApi.applyPulledNotes(
        db: db,
        settings: _settings(),
        pulledNotes: [
          {
            'note_type': 'tree',
            'local_id': 'del-falsy',
            'deleted_at': false,
          },
        ],
      );

      expect(cleared, isEmpty);
      final remaining = await (db.select(db.memos)
            ..where((m) => m.memoId.equals('del-falsy')))
          .getSingleOrNull();
      expect(remaining, isNotNull);
    });

    test('pushed_notes에 deleted_at이 없으면 대기 목록에서 지우지 않는다', () async {
      final deletedAt = DateTime(2026, 8, 19);
      final adapter = _FakeAdapter(
        (options) => _jsonBody({
          'pushed_notes': [
            {'note_type': 'tree', 'local_id': 'del-2', 'deleted_at': null},
          ],
          'pulled_notes': [],
        }),
      );
      final dio = _dioFor(adapter);
      final outcome = await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(),
        pendingDeletedTreeMemos: {
          'del-2': buildDeletedTreeMemoEntry(deletedAt: deletedAt, level: 1),
        },
        fullSync: true,
      );

      expect(outcome.clearedDeletedTreeMemoIds, isEmpty);
    });

    test('pull로 내려온 삭제 확정 노트(applyPulledNotes)도 지울 id로 담는다', () async {
      await db.into(db.memos).insert(
            MemosCompanion.insert(
              memoId: 'del-3',
              userId: 'cyhuh',
              content: '지워질 메모',
              source: const Value('note_tree'),
            ),
          );

      final cleared = await ServerNoteSyncApi.applyPulledNotes(
        db: db,
        settings: _settings(),
        pulledNotes: [
          {
            'note_type': 'tree',
            'local_id': 'del-3',
            'deleted_at': '2026-08-20T00:00:00.000',
          },
        ],
      );

      expect(cleared, {'del-3'});
      final remaining = await (db.select(db.memos)
            ..where((m) => m.memoId.equals('del-3')))
          .get();
      expect(remaining, isEmpty);
    });

    test(
      '앱 쪽 위임 계약: syncNotes()가 pull/push에서 지운 id를 합쳐 돌려준다',
      () async {
        // now_app/lib/services/server_sync_service.dart의 syncNotes()가
        // outcome.clearedDeletedTreeMemoIds를 받아 저장소에서 지우는 계약을
        // 이 계층에서 고정한다 (해당 파일은 다른 작업이 수정 중이라 직접
        // 건드리지 않고, 이 계층이 돌려주는 값만 검증한다).
        final deletedAt = DateTime(2026, 8, 19);
        await db.into(db.memos).insert(
              MemosCompanion.insert(
                memoId: 'del-pull',
                userId: 'cyhuh',
                content: '지워질 메모(pull)',
                source: const Value('note_tree'),
              ),
            );
        final adapter = _FakeAdapter(
          (options) => _jsonBody({
            'pushed_notes': [
              {
                'note_type': 'tree',
                'local_id': 'del-push',
                'deleted_at': deletedAt.toIso8601String(),
              },
            ],
            'pulled_notes': [
              {
                'note_type': 'tree',
                'local_id': 'del-pull',
                'deleted_at': deletedAt.toIso8601String(),
              },
            ],
          }),
        );
        final dio = _dioFor(adapter);
        final outcome = await ServerNoteSyncApi.syncNotes(
          dio: dio,
          db: db,
          settings: _settings(),
          pendingDeletedTreeMemos: {
            'del-push': buildDeletedTreeMemoEntry(
              deletedAt: deletedAt,
              level: 1,
            ),
          },
          fullSync: true,
        );

        expect(
          outcome.clearedDeletedTreeMemoIds,
          {'del-push', 'del-pull'},
        );
      },
    );
  });

  group('실패 경로', () {
    test('서버가 오류 응답을 주면 예외를 던지고 상세를 담는다', () async {
      final adapter = _FakeAdapter(
        (options) => ResponseBody.fromString(
          jsonEncode({'detail': '서버 내부 오류'}),
          500,
          headers: {
            Headers.contentTypeHeader: ['application/json; charset=utf-8'],
          },
        ),
      );
      final dio = _dioFor(adapter);

      await expectLater(
        ServerNoteSyncApi.syncNotes(
          dio: dio,
          db: db,
          settings: _settings(),
          pendingDeletedTreeMemos: const {},
          fullSync: true,
        ),
        throwsA(
          predicate(
            (e) =>
                e is Exception &&
                e.toString().contains('HTTP 500') &&
                e.toString().contains('서버 내부 오류'),
          ),
        ),
      );
    });

    test('서버에 연결하지 못하면 예외를 던진다', () async {
      final adapter = _FakeAdapter(
        (options) => throw DioException.connectionError(
          requestOptions: options,
          reason: 'refused',
        ),
      );
      final dio = _dioFor(adapter);

      await expectLater(
        ServerNoteSyncApi.syncNotes(
          dio: dio,
          db: db,
          settings: _settings(),
          pendingDeletedTreeMemos: const {},
          fullSync: true,
        ),
        throwsA(isA<Exception>()),
      );
    });

    test('연결 실패 시 로컬 DB는 바뀌지 않는다', () async {
      await db.into(db.memos).insert(
            MemosCompanion.insert(
              memoId: 'tree-untouched',
              userId: 'cyhuh',
              content: '건드리면 안 됨',
              source: const Value('note_tree'),
            ),
          );
      final adapter = _FakeAdapter(
        (options) => throw DioException.connectionError(
          requestOptions: options,
          reason: 'refused',
        ),
      );
      final dio = _dioFor(adapter);

      try {
        await ServerNoteSyncApi.syncNotes(
          dio: dio,
          db: db,
          settings: _settings(),
          pendingDeletedTreeMemos: const {},
          fullSync: true,
        );
        fail('예외가 나야 한다');
      } catch (_) {
        // 예상된 실패
      }

      final memo = await (db.select(db.memos)
            ..where((m) => m.memoId.equals('tree-untouched')))
          .getSingle();
      expect(memo.content, '건드리면 안 됨');
    });
  });

  group('settings.enabled / isConfigured가 false일 때', () {
    test('enabled가 false면 요청 없이 걸러진다', () async {
      final adapter = _FakeAdapter((options) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor(adapter);

      final outcome = await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(enabled: false),
        pendingDeletedTreeMemos: const {},
      );

      expect(outcome.result.uploaded, 0);
      expect(outcome.result.message, '서버 동기화가 꺼져 있습니다');
      expect(outcome.clearedDeletedTreeMemoIds, isEmpty);
      expect(adapter.requests, isEmpty);
    });

    test('baseUrl이 비어(isConfigured=false) 있으면 요청 없이 걸러진다', () async {
      final adapter = _FakeAdapter((options) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor(adapter, baseUrl: '');

      final outcome = await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(baseUrl: ''),
        pendingDeletedTreeMemos: const {},
      );

      expect(outcome.result.uploaded, 0);
      expect(outcome.result.message, '서버 주소가 없습니다');
      expect(adapter.requests, isEmpty);
    });

    test('보낼 메모가 없고 이미 동기화한 적이 있으면(스킵) 요청을 보내지 않는다', () async {
      final adapter = _FakeAdapter((options) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor(adapter);

      final outcome = await ServerNoteSyncApi.syncNotes(
        dio: dio,
        db: db,
        settings: _settings(lastSyncedAt: DateTime(2026, 8, 1)),
        pendingDeletedTreeMemos: const {},
      );

      expect(outcome.result.uploaded, 0);
      expect(outcome.result.message, '동기화할 메모가 없습니다');
      expect(adapter.requests, isEmpty);
    });
  });
}
