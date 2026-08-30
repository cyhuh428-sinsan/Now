import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:now_core/server/server_profile.dart';
import 'package:now_core/server/server_settings.dart';

/// 실제 서버를 부르지 않는다. dio 어댑터를 갈아 끼워 가짜 응답을 준다.
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

  group('loadUserProfile', () {
    test('서버 주소가 없으면 요청을 보내지 않고 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      await expectLater(
        ServerProfileApi.loadUserProfile(
          dio: dio,
          settings: _settings(baseUrl: ''),
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('owner_id로 조회하고 응답의 user를 프로필로 담는다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.path, '/api/v1/users/cyhuh');
        expect(options.method, 'GET');
        return _jsonBody({
          'user': {
            'owner_id': 'cyhuh',
            'email': 'cyhuh@example.com',
            'display_name': '홍길동',
            'timezone': 'Asia/Seoul',
            'group_name': '사용자',
            'two_factor_enabled': true,
            'is_active': true,
            'last_seen_at': '2026-08-19T00:00:00Z',
          },
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final profile = await ServerProfileApi.loadUserProfile(
        dio: dio,
        settings: _settings(),
      );

      expect(profile.ownerId, 'cyhuh');
      expect(profile.email, 'cyhuh@example.com');
      expect(profile.displayName, '홍길동');
      expect(profile.timezone, 'Asia/Seoul');
      expect(profile.twoFactorEnabled, true);
      expect(profile.isActive, true);
    });

    test('응답에 user가 없으면 기본값으로 채운 프로필을 돌려준다', () async {
      final adapter = _FakeAdapter((_) => _jsonBody({}));
      final dio = _dioFor('http://server.test:8750', adapter);
      final profile = await ServerProfileApi.loadUserProfile(
        dio: dio,
        settings: _settings(),
      );

      expect(profile.ownerId, 'local_user');
      expect(profile.email, isNull);
      expect(profile.timezone, 'Asia/Seoul');
      expect(profile.isActive, true);
    });

    test('서버가 오류를 돌려주면 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return ResponseBody.fromString(
          jsonEncode({'detail': 'user inactive'}),
          403,
          headers: {
            Headers.contentTypeHeader: ['application/json; charset=utf-8'],
          },
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      try {
        await ServerProfileApi.loadUserProfile(
          dio: dio,
          settings: _settings(),
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('비활성 사용자'));
      }
    });
  });

  group('saveUserProfile', () {
    test('서버 주소가 없으면 요청을 보내지 않고 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      await expectLater(
        ServerProfileApi.saveUserProfile(
          dio: dio,
          settings: _settings(baseUrl: ''),
          email: 'a@b.com',
          displayName: '홍길동',
          timezone: 'Asia/Seoul',
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('PATCH로 저장하고 빈 값은 null로 보낸다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.method, 'PATCH');
        expect(options.path, '/api/v1/users/cyhuh');
        final data = options.data as Map;
        expect(data['email'], isNull);
        expect(data['display_name'], '홍길동');
        expect(data['timezone'], 'Asia/Seoul');
        return _jsonBody({
          'user': {
            'owner_id': 'cyhuh',
            'display_name': '홍길동',
            'timezone': 'Asia/Seoul',
          },
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final profile = await ServerProfileApi.saveUserProfile(
        dio: dio,
        settings: _settings(),
        email: '   ',
        displayName: '홍길동',
        timezone: 'Asia/Seoul',
      );

      expect(profile.displayName, '홍길동');
    });

    test('timezone이 비어 있으면 Asia/Seoul로 채운다', () async {
      final adapter = _FakeAdapter((options) {
        final data = options.data as Map;
        expect(data['timezone'], 'Asia/Seoul');
        return _jsonBody({
          'user': {'owner_id': 'cyhuh', 'timezone': 'Asia/Seoul'},
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      await ServerProfileApi.saveUserProfile(
        dio: dio,
        settings: _settings(),
        email: null,
        displayName: null,
        timezone: '   ',
      );
    });

    test('404면 조회 후 다시 저장을 시도한다', () async {
      var patchCount = 0;
      final paths = <String>[];
      final adapter = _FakeAdapter((options) {
        paths.add('${options.method} ${options.path}');
        if (options.method == 'PATCH') {
          patchCount++;
          if (patchCount == 1) {
            return ResponseBody.fromString('', 404);
          }
          return _jsonBody({
            'user': {'owner_id': 'cyhuh', 'display_name': '홍길동'},
          });
        }
        // GET
        return _jsonBody({
          'user': {'owner_id': 'cyhuh'},
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final profile = await ServerProfileApi.saveUserProfile(
        dio: dio,
        settings: _settings(),
        email: null,
        displayName: '홍길동',
        timezone: 'Asia/Seoul',
      );

      expect(profile.displayName, '홍길동');
      expect(patchCount, 2);
      expect(
        paths,
        ['PATCH /api/v1/users/cyhuh', 'GET /api/v1/users/cyhuh', 'PATCH /api/v1/users/cyhuh'],
      );
    });

    test('404 외 오류는 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return ResponseBody.fromString(
          jsonEncode({'detail': '요청이 올바르지 않습니다'}),
          400,
          headers: {
            Headers.contentTypeHeader: ['application/json; charset=utf-8'],
          },
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      try {
        await ServerProfileApi.saveUserProfile(
          dio: dio,
          settings: _settings(),
          email: null,
          displayName: null,
          timezone: 'Asia/Seoul',
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('요청이 올바르지 않습니다'));
      }
    });
  });
}
