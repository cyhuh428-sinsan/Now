import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:now_core/server/server_connection.dart';
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

ServerSettings _settings({
  String baseUrl = 'http://server.test:8750',
  String userToken = '',
}) {
  return ServerSettings(
    enabled: true,
    baseUrl: baseUrl,
    token: '',
    userToken: userToken,
    webSessionToken: '',
    ownerId: 'cyhuh',
    deviceId: 'android-unit-test',
    lastSyncedAt: null,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('testConnection', () {
    test('서버 주소가 없으면 요청을 보내지 않고 실패를 돌려준다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      final result = await ServerConnectionApi.testConnection(
        dio: dio,
        dioWithoutUserToken: dio,
        settings: _settings(baseUrl: ''),
      );
      expect(result.ok, false);
      expect(result.message, '서버 주소가 없습니다');
      expect(adapter.requests, isEmpty);
    });

    test('연결에 성공하면 서버 이름과 capability를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.path, '/api/v1/server');
        return _jsonBody({
          'server': 'NowNote Server',
          'auth_required': true,
          'capabilities': {
            'sync': true,
            'max_tree_note_level': 3,
            'user_profile': true,
          },
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.testConnection(
        dio: dio,
        dioWithoutUserToken: dio,
        settings: _settings(),
      );

      expect(result.ok, true);
      expect(result.serverName, 'NowNote Server');
      expect(result.capabilities['sync'], true);
      expect(result.message, contains('NowNote Server 연결됨'));
      expect(result.message, contains('토큰 필요'));
      expect(result.message, contains('계층 3단계'));
      expect(result.publicReadiness, isNull);
    });

    test('응답의 api_version 값을 담는다', () async {
      final adapter = _FakeAdapter((_) => _jsonBody({
            'server': 'NowNote Server',
            'auth_required': false,
            'api_version': 'v1',
            'capabilities': <String, dynamic>{},
          }));
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.testConnection(
        dio: dio,
        dioWithoutUserToken: dio,
        settings: _settings(),
      );

      expect(result.ok, true);
      expect(result.apiVersion, 'v1');
    });

    test('공용 서버 준비 상태를 응답에서 읽어 담는다', () async {
      final adapter = _FakeAdapter((_) => _jsonBody({
            'server': 'NowNote Server',
            'auth_required': false,
            'capabilities': <String, dynamic>{},
            'public_server_readiness': {
              'status': 'planned',
              'remaining': ['backup', 'two_factor'],
            },
          }));
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.testConnection(
        dio: dio,
        dioWithoutUserToken: dio,
        settings: _settings(),
      );

      expect(result.publicReadiness?.status, 'planned');
      expect(result.publicReadiness?.remaining, ['backup', 'two_factor']);
      expect(result.message, contains('공용 서버 준비 중 · 남은 항목 2개'));
    });

    test('사용자 토큰이 있으면 토큰 검증 요청도 함께 보낸다', () async {
      final paths = <String>[];
      final adapter = _FakeAdapter((options) {
        paths.add(options.path);
        if (options.path == '/api/v1/server') {
          return _jsonBody({
            'server': 'NowNote Server',
            'auth_required': true,
            'capabilities': <String, dynamic>{},
          });
        }
        expect(options.path, '/api/v1/auth/token-login');
        final data = options.data as Map;
        expect(data['owner_id'], 'cyhuh');
        expect(data['access_token'], 'user-token-abc');
        return _jsonBody({});
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.testConnection(
        dio: dio,
        dioWithoutUserToken: dio,
        settings: _settings(userToken: 'user-token-abc'),
      );

      expect(result.ok, true);
      expect(paths, ['/api/v1/server', '/api/v1/auth/token-login']);
    });

    test('토큰 검증이 실패하면 연결 전체를 실패로 돌린다', () async {
      final adapter = _FakeAdapter((options) {
        if (options.path == '/api/v1/server') {
          return _jsonBody({
            'server': 'NowNote Server',
            'auth_required': true,
            'capabilities': <String, dynamic>{},
          });
        }
        return ResponseBody.fromString(
          jsonEncode({'detail': '토큰이 유효하지 않습니다'}),
          401,
          headers: {
            Headers.contentTypeHeader: ['application/json; charset=utf-8'],
          },
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.testConnection(
        dio: dio,
        dioWithoutUserToken: dio,
        settings: _settings(userToken: 'bad-token'),
      );

      expect(result.ok, false);
      expect(result.message, contains('HTTP 401'));
      expect(result.message, contains('토큰이 유효하지 않습니다'));
    });

    test('서버에 연결하지 못하면 실패 메시지를 돌려준다', () async {
      final adapter = _FakeAdapter((options) {
        throw DioException.connectionError(
          requestOptions: options,
          reason: 'refused',
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.testConnection(
        dio: dio,
        dioWithoutUserToken: dio,
        settings: _settings(),
      );

      expect(result.ok, false);
      expect(result.message, contains('요청 실패'));
    });
  });

  group('probeConnectionSteps', () {
    test('서버 주소가 없으면 health 단계 실패로 돌려준다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      final result = await ServerConnectionApi.probeConnectionSteps(
        dioWithoutUserToken: dio,
        settings: _settings(baseUrl: ''),
      );
      expect(result.ok, false);
      expect(result.failedStage, ConnectionProbeStage.health);
      expect(adapter.requests, isEmpty);
    });

    test('/health가 실패하면 health 단계에서 멈춘다', () async {
      final paths = <String>[];
      final adapter = _FakeAdapter((options) {
        paths.add(options.path);
        throw DioException.connectionError(
          requestOptions: options,
          reason: 'refused',
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.probeConnectionSteps(
        dioWithoutUserToken: dio,
        settings: _settings(),
      );
      expect(result.ok, false);
      expect(result.failedStage, ConnectionProbeStage.health);
      expect(paths, ['/health']);
    });

    test('/health는 되지만 /health/ready가 실패하면 ready 단계에서 멈춘다', () async {
      final paths = <String>[];
      final adapter = _FakeAdapter((options) {
        paths.add(options.path);
        if (options.path == '/health') {
          return _jsonBody({'status': 'ok'});
        }
        return ResponseBody.fromString('', 503);
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.probeConnectionSteps(
        dioWithoutUserToken: dio,
        settings: _settings(),
      );
      expect(result.ok, false);
      expect(result.failedStage, ConnectionProbeStage.ready);
      expect(paths, ['/health', '/health/ready']);
    });

    test('세 단계가 모두 성공하면 서버 이름과 api_version을 담는다', () async {
      final paths = <String>[];
      final adapter = _FakeAdapter((options) {
        paths.add(options.path);
        if (options.path == '/api/v1/server') {
          return _jsonBody({'server': 'NowNote Server', 'api_version': 'v1'});
        }
        return _jsonBody({'status': 'ok'});
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.probeConnectionSteps(
        dioWithoutUserToken: dio,
        settings: _settings(),
      );
      expect(result.ok, true);
      expect(result.serverName, 'NowNote Server');
      expect(result.apiVersion, 'v1');
      expect(paths, ['/health', '/health/ready', '/api/v1/server']);
    });

    test('/api/v1/server만 실패하면 serverInfo 단계로 표시한다', () async {
      final adapter = _FakeAdapter((options) {
        if (options.path == '/api/v1/server') {
          return ResponseBody.fromString('', 500);
        }
        return _jsonBody({'status': 'ok'});
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final result = await ServerConnectionApi.probeConnectionSteps(
        dioWithoutUserToken: dio,
        settings: _settings(),
      );
      expect(result.ok, false);
      expect(result.failedStage, ConnectionProbeStage.serverInfo);
    });
  });

  group('createWebSession', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('서버 주소가 없으면 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      await expectLater(
        ServerConnectionApi.createWebSession(
          dioWithoutUserToken: dio,
          settings: _settings(baseUrl: ''),
          password: 'pw',
        ),
        throwsA(isA<Exception>()),
      );
    });

    test('비밀번호가 비어 있으면 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      await expectLater(
        ServerConnectionApi.createWebSession(
          dioWithoutUserToken: dio,
          settings: _settings(),
          password: '   ',
        ),
        throwsA(isA<Exception>()),
      );
    });

    test('성공하면 세션 토큰을 담은 설정을 돌려주고 저장한다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.path, '/api/v1/auth/web-login');
        final data = options.data as Map;
        expect(data['owner_id'], 'cyhuh');
        expect(data['password'], 'secret');
        return _jsonBody({'session_token': 'session-xyz'});
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final next = await ServerConnectionApi.createWebSession(
        dioWithoutUserToken: dio,
        settings: _settings(),
        password: 'secret',
      );

      expect(next.webSessionToken, 'session-xyz');

      final reloaded = await ServerSettings.load();
      expect(reloaded.webSessionToken, 'session-xyz');
    });

    test('응답에 세션 토큰이 없으면 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) => _jsonBody({}));
      final dio = _dioFor('http://server.test:8750', adapter);
      await expectLater(
        ServerConnectionApi.createWebSession(
          dioWithoutUserToken: dio,
          settings: _settings(),
          password: 'secret',
        ),
        throwsA(isA<Exception>()),
      );
    });

    test('서버가 오류를 돌려주면 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return ResponseBody.fromString(
          jsonEncode({'detail': '비밀번호가 올바르지 않습니다'}),
          401,
          headers: {
            Headers.contentTypeHeader: ['application/json; charset=utf-8'],
          },
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      try {
        await ServerConnectionApi.createWebSession(
          dioWithoutUserToken: dio,
          settings: _settings(),
          password: 'secret',
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('비밀번호가 올바르지 않습니다'));
      }
    });
  });
}
