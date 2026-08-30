import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:now_core/server/server_messenger.dart';
import 'package:now_core/server/server_settings.dart';

/// 실제 서버를 부르지 않는다. dio 어댑터를 갈아 끼워 가짜 응답을 준다.
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

Dio _dioFor(String baseUrl, _FakeAdapter adapter) {
  return Dio(BaseOptions(baseUrl: baseUrl))..httpClientAdapter = adapter;
}

ServerSettings _settings({String baseUrl = 'http://server.test:8750'}) {
  return ServerSettings(
    enabled: true,
    baseUrl: baseUrl,
    token: '',
    userToken: '',
    webSessionToken: '',
    ownerId: 'cyhuh',
    deviceId: 'android-unit-test',
    lastSyncedAt: null,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('loadMessengerRooms', () {
    test('서버 주소가 없으면 요청 없이 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      await expectLater(
        ServerMessengerApi.loadMessengerRooms(
          dio: dio,
          settings: _settings(baseUrl: ''),
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('owner_id로 조회하고 방 목록/그룹명을 파싱한다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.method, 'GET');
        expect(options.path, '/api/v1/messenger/rooms');
        expect(options.queryParameters['owner_id'], 'cyhuh');
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
              'members': [
                {'owner_id': 'cyhuh'},
                {'ownerId': 'jane'},
                'kim',
              ],
            },
            // id가 0 이하인 항목은 걸러진다.
            {'id': 0, 'name': '유령방'},
          ],
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      final result = await ServerMessengerApi.loadMessengerRooms(
        dio: dio,
        settings: _settings(),
      );

      expect(result.groupName, '개발팀');
      expect(result.rooms, hasLength(1));
      final room = result.rooms.single;
      expect(room.id, 1);
      expect(room.roomType, 'group');
      expect(room.name, '전체 채팅');
      expect(room.lastMessageId, 10);
      expect(room.lastReadMessageId, 8);
      expect(room.unreadCount, 2);
      expect(room.members, ['cyhuh', 'jane', 'kim']);
    });

    test('서버가 오류를 돌려주면 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return _jsonBody({'detail': 'user inactive'}, status: 403);
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      try {
        await ServerMessengerApi.loadMessengerRooms(
          dio: dio,
          settings: _settings(),
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('비활성 사용자'));
      }
    });
  });

  group('loadMessengerMessages', () {
    test('서버 주소가 없으면 요청 없이 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      await expectLater(
        ServerMessengerApi.loadMessengerMessages(
          dio: dio,
          settings: _settings(baseUrl: ''),
          roomId: 1,
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('roomId로 경로를 만들고 room/items를 함께 파싱한다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.method, 'GET');
        expect(options.path, '/api/v1/messenger/rooms/7/messages');
        expect(options.queryParameters['owner_id'], 'cyhuh');
        expect(options.queryParameters['limit'], 100);
        return _jsonBody({
          'room': {'id': 7, 'name': '전체 채팅'},
          'items': [
            {
              'id': 100,
              'room_id': 7,
              'sender_owner_id': 'cyhuh',
              'sender_display_name': '치현',
              'body': '안녕하세요',
              'created_at': '2026-08-19T00:00:00Z',
            },
            {
              'id': 101,
              'room_id': 7,
              'sender_owner_id': 'jane',
              'body': '네',
              'created_at': '2026-08-19T00:01:00Z',
            },
          ],
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      final result = await ServerMessengerApi.loadMessengerMessages(
        dio: dio,
        settings: _settings(),
        roomId: 7,
      );

      expect(result.room, isNotNull);
      expect(result.room!.id, 7);
      expect(result.room!.name, '전체 채팅');
      expect(result.items, hasLength(2));
      expect(result.items.first.body, '안녕하세요');
      expect(result.items.first.senderDisplayName, '치현');
      // sender_display_name이 없으면 sender_owner_id로 대체된다.
      expect(result.items.last.senderDisplayName, 'jane');
    });

    test('room이 없으면 null로 채운다', () async {
      final adapter = _FakeAdapter((options) {
        return _jsonBody({'items': []});
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      final result = await ServerMessengerApi.loadMessengerMessages(
        dio: dio,
        settings: _settings(),
        roomId: 7,
      );

      expect(result.room, isNull);
      expect(result.items, isEmpty);
    });

    test('서버가 오류를 돌려주면 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return _jsonBody({'detail': '방을 찾을 수 없습니다'}, status: 404);
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      try {
        await ServerMessengerApi.loadMessengerMessages(
          dio: dio,
          settings: _settings(),
          roomId: 7,
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('방을 찾을 수 없습니다'));
      }
    });
  });

  group('sendMessengerMessage', () {
    test('서버 주소가 없으면 요청 없이 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      await expectLater(
        ServerMessengerApi.sendMessengerMessage(
          dio: dio,
          settings: _settings(baseUrl: ''),
          roomId: 1,
          body: '안녕',
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('본문이 비어 있으면 요청 없이 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      await expectLater(
        ServerMessengerApi.sendMessengerMessage(
          dio: dio,
          settings: _settings(),
          roomId: 1,
          body: '   ',
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('본문을 다듬어 보내고 응답 메시지를 파싱한다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.method, 'POST');
        expect(options.path, '/api/v1/messenger/rooms/7/messages');
        final data = options.data as Map;
        expect(data['owner_id'], 'cyhuh');
        expect(data['body'], '안녕하세요');
        return _jsonBody({
          'item': {
            'id': 200,
            'room_id': 7,
            'sender_owner_id': 'cyhuh',
            'body': '안녕하세요',
            'created_at': '2026-08-19T00:02:00Z',
          },
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      final message = await ServerMessengerApi.sendMessengerMessage(
        dio: dio,
        settings: _settings(),
        roomId: 7,
        body: '  안녕하세요  ',
      );

      expect(message.id, 200);
      expect(message.body, '안녕하세요');
    });

    test('응답에 item이 없으면 예외를 던진다', () async {
      final adapter = _FakeAdapter((options) {
        return _jsonBody({});
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      try {
        await ServerMessengerApi.sendMessengerMessage(
          dio: dio,
          settings: _settings(),
          roomId: 7,
          body: '안녕',
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('서버 응답에 메시지가 없습니다'));
      }
    });

    test('서버가 오류를 돌려주면 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return _jsonBody({'detail': '전송 실패'}, status: 400);
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      try {
        await ServerMessengerApi.sendMessengerMessage(
          dio: dio,
          settings: _settings(),
          roomId: 7,
          body: '안녕',
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('전송 실패'));
      }
    });
  });

  group('markMessengerRoomRead', () {
    test('서버 주소가 없으면 요청을 보내지 않는다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      await ServerMessengerApi.markMessengerRoomRead(
        dio: dio,
        settings: _settings(baseUrl: ''),
        roomId: 1,
        lastReadMessageId: 5,
      );
      expect(adapter.requests, isEmpty);
    });

    test('lastReadMessageId가 0 이하이면 요청을 보내지 않는다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      await ServerMessengerApi.markMessengerRoomRead(
        dio: dio,
        settings: _settings(),
        roomId: 1,
        lastReadMessageId: 0,
      );
      expect(adapter.requests, isEmpty);
    });

    test('읽음 위치를 보낸다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.method, 'POST');
        expect(options.path, '/api/v1/messenger/rooms/7/read');
        final data = options.data as Map;
        expect(data['owner_id'], 'cyhuh');
        expect(data['last_read_message_id'], 9);
        return _jsonBody({});
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      await ServerMessengerApi.markMessengerRoomRead(
        dio: dio,
        settings: _settings(),
        roomId: 7,
        lastReadMessageId: 9,
      );

      expect(adapter.requests, hasLength(1));
    });

    test('서버가 오류를 돌려주면 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return _jsonBody({'detail': '읽음 처리 실패'}, status: 400);
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      try {
        await ServerMessengerApi.markMessengerRoomRead(
          dio: dio,
          settings: _settings(),
          roomId: 7,
          lastReadMessageId: 9,
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('읽음 처리 실패'));
      }
    });
  });
}
