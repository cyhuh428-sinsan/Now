import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:now_core/now_core.dart';
import 'package:nownote/features/settings/server_settings_service.dart';
import 'package:nownote/features/today/today_memo_repository.dart';
import 'package:nownote/features/tree/tree_repository.dart';

/// U26~U28과 D5(제품군 정합성) 실기기 검증 중 발견한 문제를 고친다:
/// NowNote는 서버 연결 테스트/로그인은 되지만 실제 노트 동기화
/// (`/api/v1/sync`)를 전혀 호출하지 않았다. `ServerSettingsService.syncNotes`가
/// now_core의 `ServerNoteSyncApi`를 통해 오늘 메모(`Meetings`/
/// `TranscriptSegments`)와 계층 메모(`Memos`)를 실제로 올리고 받는지 확인한다.
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

ServerSettings _settings() {
  return const ServerSettings(
    enabled: true,
    baseUrl: 'http://127.0.0.1:8090',
    token: '',
    userToken: 'test-token',
    webSessionToken: '',
    ownerId: 'd5tester',
    deviceId: 'nownote-test',
    lastSyncedAt: null,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ServerSettingsService.syncNotes', () {
    late NoteDatabase db;

    setUp(() {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
      db = NoteDatabase.forTesting(NativeDatabase.memory());
    });

    tearDown(() async {
      await db.close();
    });

    test('로컬 계층 메모를 서버로 올린다', () async {
      final treeRepo = TreeMemoRepository(db);
      await treeRepo.addMemo(title: '동기화 테스트', body: '본문입니다');

      _FakeAdapter? adapter;
      final service = ServerSettingsService(
        dioBuilder: (settings) {
          final dio = Dio(BaseOptions(baseUrl: settings.baseUrl));
          adapter = _FakeAdapter((options) {
            expect(options.path, '/api/v1/sync');
            final data = options.data as Map;
            final notes = (data['notes'] as List).cast<Map>();
            expect(notes.any((n) => n['note_type'] == 'tree' && n['title'] == '동기화 테스트'), isTrue);
            return _jsonBody({
              'pushed_notes': notes,
              'pulled_notes': <Map<String, dynamic>>[],
              'server_time': '2026-08-30T00:00:00',
            });
          });
          dio.httpClientAdapter = adapter!;
          return dio;
        },
      );

      final result = await service.syncNotes(
        settings: _settings(),
        db: db,
        treeRepo: treeRepo,
      );

      expect(result.uploaded, 1);
      expect(adapter!.requests, hasLength(1));
    });

    test('서버가 내려준 계층 메모를 로컬 DB에 반영한다', () async {
      final treeRepo = TreeMemoRepository(db);

      final service = ServerSettingsService(
        dioBuilder: (settings) {
          final dio = Dio(BaseOptions(baseUrl: settings.baseUrl));
          dio.httpClientAdapter = _FakeAdapter((options) {
            return _jsonBody({
              'pushed_notes': <Map<String, dynamic>>[],
              'pulled_notes': [
                {
                  'owner_id': 'd5tester',
                  'device_id': 'web-desktop',
                  'local_id': 'server-tree-1',
                  'note_type': 'tree',
                  'title': '서버에서 내려온 메모',
                  'content': '서버 본문',
                  'parent_local_id': null,
                  'level': 1,
                  'tags': '',
                  'source': 'web-tree',
                  'created_at': '2026-08-30T00:00:00',
                  'updated_at': '2026-08-30T00:00:00',
                  'client_updated_at': '2026-08-30T00:00:00',
                  'deleted_at': null,
                },
              ],
              'server_time': '2026-08-30T00:00:00',
            });
          });
          return dio;
        },
      );

      await service.syncNotes(settings: _settings(), db: db, treeRepo: treeRepo);

      final nodes = await treeRepo.loadNodes();
      expect(nodes.map((n) => n.id), contains('server-tree-1'));
      expect(nodes.firstWhere((n) => n.id == 'server-tree-1').title, '서버에서 내려온 메모');
    });

    test('오늘 메모(Meetings/TranscriptSegments)도 올린다', () async {
      final todayRepo = TodayMemoRepository(db);
      final treeRepo = TreeMemoRepository(db);
      final today = DateTime(2026, 8, 30);
      await todayRepo.appendParagraph(
        date: today,
        text: '오늘 기록할 것',
        source: todayParagraphSourceText,
      );

      _FakeAdapter? adapter;
      final service = ServerSettingsService(
        dioBuilder: (settings) {
          final dio = Dio(BaseOptions(baseUrl: settings.baseUrl));
          adapter = _FakeAdapter((options) {
            final data = options.data as Map;
            final notes = (data['notes'] as List).cast<Map>();
            expect(
              notes.any((n) => n['note_type'] == 'daily' && n['content'].toString().contains('오늘 기록할 것')),
              isTrue,
            );
            return _jsonBody({
              'pushed_notes': notes,
              'pulled_notes': <Map<String, dynamic>>[],
              'server_time': '2026-08-30T00:00:00',
            });
          });
          dio.httpClientAdapter = adapter!;
          return dio;
        },
      );

      final result = await service.syncNotes(settings: _settings(), db: db, treeRepo: treeRepo);
      expect(result.uploaded, 1);
    });

    test('서버 동기화가 꺼져 있으면 요청을 보내지 않는다', () async {
      final treeRepo = TreeMemoRepository(db);
      var requested = false;
      final service = ServerSettingsService(
        dioBuilder: (settings) {
          final dio = Dio(BaseOptions(baseUrl: settings.baseUrl));
          dio.httpClientAdapter = _FakeAdapter((options) {
            requested = true;
            return _jsonBody({});
          });
          return dio;
        },
      );

      final settings = _settings().copyWith(enabled: false);
      final result = await service.syncNotes(settings: settings, db: db, treeRepo: treeRepo);

      expect(requested, isFalse);
      expect(result.uploaded, 0);
    });

    test('서버가 삭제를 확정하면 삭제 대기 목록에서 지운다', () async {
      final treeRepo = TreeMemoRepository(db);
      final memo = await treeRepo.addMemo(title: '지울 메모');
      await treeRepo.deleteMemo(memo, [memo]);
      expect(await treeRepo.loadPendingDeleted(), isNotEmpty);

      final service = ServerSettingsService(
        dioBuilder: (settings) {
          final dio = Dio(BaseOptions(baseUrl: settings.baseUrl));
          dio.httpClientAdapter = _FakeAdapter((options) {
            final data = options.data as Map;
            final notes = (data['notes'] as List).cast<Map>();
            return _jsonBody({
              'pushed_notes': notes,
              'pulled_notes': <Map<String, dynamic>>[],
              'server_time': '2026-08-30T00:00:00',
            });
          });
          return dio;
        },
      );

      await service.syncNotes(settings: _settings(), db: db, treeRepo: treeRepo);

      expect(await treeRepo.loadPendingDeleted(), isEmpty);
    });
  });
}
