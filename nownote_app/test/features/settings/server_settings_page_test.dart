import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/settings/server_settings_page.dart';
import 'package:nownote/features/settings/server_settings_service.dart';
import 'package:nownote/features/settings/settings_providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 실제 서버를 부르지 않는다. `messenger_service_test.dart`와 같은
/// `HttpClientAdapter` 목 패턴을 쓴다.
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

Widget _wrap(ServerSettingsService service) {
  return ProviderScope(
    overrides: [serverSettingsServiceProvider.overrideWithValue(service)],
    child: const MaterialApp(home: ServerSettingsPage()),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  testWidgets('서버 주소를 입력하고 저장하면 필드가 유지된다', (tester) async {
    final service = ServerSettingsService();
    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, '서버 주소'),
      'http://server.test:8750',
    );
    await tester.enterText(find.widgetWithText(TextField, '사용자 ID'), 'cyhuh');
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(find.text('저장').last);
    await tester.pumpAndSettle();

    expect(find.text('서버 설정을 저장했습니다'), findsOneWidget);

    final saved = await service.loadSettings();
    expect(saved.baseUrl, 'http://server.test:8750');
    expect(saved.ownerId, 'cyhuh');
  });
  testWidgets('앱 접속 토큰을 입력하고 저장할 수 있다', (tester) async {
    final service = ServerSettingsService();
    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, '앱/설치형 접속 토큰'),
      'app-token-123',
    );
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(find.text('저장').last);
    await tester.pumpAndSettle();

    final saved = await service.loadSettings();
    expect(saved.userToken, 'app-token-123');
  });

  /// 판정 절차(1단계 `/health` → 2단계 `/health/ready` → 3단계
  /// `/api/v1/server`) 전체를 흉내 내는 목 어댑터를 만든다. `dioBuilder`와
  /// `dioWithoutUserTokenBuilder`가 같은 어댑터를 쓴다 — 세 경로 모두
  /// 무인증이라 두 Dio 중 어느 쪽으로 불러도 같은 응답을 준다.
  ServerSettingsService probeService({
    bool healthOk = true,
    bool readyOk = true,
    int serverInfoStatus = 200,
    Map<String, dynamic>? serverInfoBody,
    Map<String, dynamic>? tokenLoginBody,
  }) {
    Dio dioFor(ServerSettings settings) {
      return Dio(BaseOptions(baseUrl: settings.baseUrl))
        ..httpClientAdapter = _FakeAdapter((options) {
          if (options.path == '/health') {
            if (!healthOk) {
              throw DioException.connectionError(
                requestOptions: options,
                reason: 'refused',
              );
            }
            return _jsonBody({'status': 'ok', 'server': 'NowNote Test Server'});
          }
          if (options.path == '/health/ready') {
            if (!readyOk) {
              return _jsonBody({'status': 'not_ready'}, status: 503);
            }
            return _jsonBody({'status': 'ready'});
          }
          if (options.path == '/api/v1/server') {
            return _jsonBody(
              serverInfoBody ??
                  {
                    'server': 'NowNote Test Server',
                    'auth_required': false,
                    'api_version': 'v1',
                    'capabilities': <String, dynamic>{},
                  },
              status: serverInfoStatus,
            );
          }
          expect(options.path, '/api/v1/auth/token-login');
          return _jsonBody(tokenLoginBody ?? {});
        });
    }

    return ServerSettingsService(
      dioBuilder: dioFor,
      dioWithoutUserTokenBuilder: dioFor,
    );
  }

  testWidgets('연결 테스트를 누르면 목 서버 응답으로 결과가 보인다 — 네트워크를 실제로 타지 않는다', (
    tester,
  ) async {
    final service = probeService();

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, '서버 주소'),
      'http://server.test:8750',
    );
    final testButton = find.widgetWithText(OutlinedButton, '연결 테스트');
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(testButton);
    await tester.pumpAndSettle();

    expect(
      find.textContaining('NowNote Test Server 연결됨'),
      findsAtLeastNWidgets(1),
    );
  });

  testWidgets('1단계(/health) 실패 시 전용 문구를 보이고 뒤 단계로 넘어가지 않는다', (tester) async {
    final service = probeService(healthOk: false);

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, '서버 주소'),
      'http://server.test:8750',
    );
    final testButton = find.widgetWithText(OutlinedButton, '연결 테스트');
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(testButton);
    await tester.pumpAndSettle();

    expect(find.text('서버에 연결할 수 없습니다'), findsAtLeastNWidgets(1));
  });

  testWidgets('2단계(/health/ready) 실패 시 전용 문구를 보인다', (tester) async {
    final service = probeService(readyOk: false);

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, '서버 주소'),
      'http://server.test:8750',
    );
    final testButton = find.widgetWithText(OutlinedButton, '연결 테스트');
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(testButton);
    await tester.pumpAndSettle();

    expect(find.text('서버가 시작 중입니다. 잠시 후 다시 시도하세요'), findsAtLeastNWidgets(1));
  });

  testWidgets('3단계(/api/v1/server) 실패 시 전용 문구를 보인다', (tester) async {
    final service = probeService(serverInfoStatus: 500);

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, '서버 주소'),
      'http://server.test:8750',
    );
    final testButton = find.widgetWithText(OutlinedButton, '연결 테스트');
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(testButton);
    await tester.pumpAndSettle();

    expect(find.text('서버 정보를 확인할 수 없습니다'), findsAtLeastNWidgets(1));
  });

  testWidgets('처음 연결이면 서버 정보를 저장하고 바로 통과시킨다', (tester) async {
    final service = probeService();

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, '서버 주소'),
      'http://server.test:8750',
    );
    final testButton = find.widgetWithText(OutlinedButton, '연결 테스트');
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(testButton);
    await tester.pumpAndSettle();

    expect(find.textContaining('다른 서버로 보입니다'), findsNothing);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('nownote_known_server_name'), 'NowNote Test Server');
    expect(prefs.getString('nownote_known_api_version'), 'v1');
  });

  testWidgets('저장된 서버 정보와 다르면 경고를 보이되 로그인 단계까지 진행한다', (tester) async {
    SharedPreferences.setMockInitialValues({
      'nownote_known_server_name': 'Another Server',
      'nownote_known_api_version': 'v1',
    });
    final service = probeService();

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, '서버 주소'),
      'http://server.test:8750',
    );
    final testButton = find.widgetWithText(OutlinedButton, '연결 테스트');
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    await tester.tap(testButton);
    await tester.pumpAndSettle();

    expect(find.textContaining('이 주소는 다른 서버로 보입니다'), findsAtLeastNWidgets(1));
    expect(
      find.textContaining('NowNote Test Server 연결됨'),
      findsAtLeastNWidgets(1),
    );
  });
}
