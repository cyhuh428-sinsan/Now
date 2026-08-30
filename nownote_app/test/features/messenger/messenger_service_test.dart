import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/messenger/messenger_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 실제 서버를 부르지 않는다. now_core의 `server_messenger_test.dart`와 같은
/// `HttpClientAdapter` 목 패턴을 쓴다.
typedef FakeHandler = FutureOr<ResponseBody> Function(RequestOptions options);

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final FakeHandler handler;
  final List<RequestOptions> requests = <RequestOptions>[];

  RequestOptions get lastRequest => requests.last;

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

ServerSettings _settings({
  String baseUrl = 'http://server.test:8750',
  String userToken = '',
  String webSessionToken = '',
}) {
  return ServerSettings(
    enabled: true,
    baseUrl: baseUrl,
    token: '',
    userToken: userToken,
    webSessionToken: webSessionToken,
    ownerId: 'cyhuh',
    deviceId: 'test-device',
    lastSyncedAt: null,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('loadSettings', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('서버 주소를 저장하지 않았으면 isConfigured가 false다', () async {
      final service = MessengerService();
      final settings = await service.loadSettings();
      expect(settings.isConfigured, isFalse);
    });
  });

  group('loadRooms / loadMessages / sendMessage / markRoomRead', () {
    late _FakeAdapter adapter;
    late MessengerService service;

    void setHandler(FakeHandler handler) {
      adapter = _FakeAdapter(handler);
      service = MessengerService(
        messengerDioBuilder: (settings) {
          return Dio(BaseOptions(baseUrl: settings.baseUrl))
            ..httpClientAdapter = adapter;
        },
      );
    }

    test('loadRooms는 방 목록과 그룹명을 돌려준다', () async {
      setHandler((options) {
        expect(options.path, '/api/v1/messenger/rooms');
        return _jsonBody({
          'group_name': '개발팀',
          'rooms': [
            {
              'id': 1,
              'room_type': 'group',
              'name': '전체 채팅',
              'group_name': '개발팀',
              'last_message_id': 10,
              'last_read_message_id': 8,
              'unread_count': 2,
              'members': [],
            },
          ],
        });
      });

      final result = await service.loadRooms(_settings());

      expect(result.groupName, '개발팀');
      expect(result.rooms, hasLength(1));
      expect(result.rooms.single.name, '전체 채팅');
    });

    test('loadMessages는 방 정보와 메시지 목록을 돌려준다', () async {
      setHandler((options) {
        expect(options.path, '/api/v1/messenger/rooms/7/messages');
        return _jsonBody({
          'room': {'id': 7, 'name': '전체 채팅'},
          'items': [
            {
              'id': 100,
              'room_id': 7,
              'sender_owner_id': 'cyhuh',
              'body': '안녕하세요',
              'created_at': '2026-08-19T00:00:00Z',
            },
          ],
        });
      });

      final result = await service.loadMessages(_settings(), roomId: 7);

      expect(result.room?.id, 7);
      expect(result.items.single.body, '안녕하세요');
    });

    test('sendMessage는 본문을 보내고 응답 메시지를 돌려준다', () async {
      setHandler((options) {
        expect(options.method, 'POST');
        expect(options.path, '/api/v1/messenger/rooms/7/messages');
        final data = options.data as Map;
        expect(data['body'], '안녕');
        return _jsonBody({
          'item': {
            'id': 200,
            'room_id': 7,
            'sender_owner_id': 'cyhuh',
            'body': '안녕',
            'created_at': '2026-08-19T00:02:00Z',
          },
        });
      });

      final message = await service.sendMessage(
        _settings(),
        roomId: 7,
        body: '안녕',
      );

      expect(message.id, 200);
      expect(message.body, '안녕');
    });

    test('markRoomRead는 읽음 위치를 보낸다', () async {
      setHandler((options) {
        expect(options.method, 'POST');
        expect(options.path, '/api/v1/messenger/rooms/7/read');
        final data = options.data as Map;
        expect(data['last_read_message_id'], 9);
        return _jsonBody({});
      });

      await service.markRoomRead(
        _settings(),
        roomId: 7,
        lastReadMessageId: 9,
      );

      expect(adapter.requests, hasLength(1));
    });
  });

  group('기본 Dio 빌더(messengerDioBuilder 미지정)', () {
    test('서버 주소가 비어 있으면 실제 네트워크 없이 예외를 던진다', () async {
      final service = MessengerService();
      await expectLater(
        service.loadRooms(_settings(baseUrl: '')),
        throwsA(isA<Exception>()),
      );
    });
  });
}
