import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/settings/settings_providers.dart';
import 'package:nownote/features/settings/voice_settings_page.dart';
import 'package:nownote/features/today/today_providers.dart';

/// `messenger_service_test.dart`와 같은 `HttpClientAdapter` 목 패턴이다.
typedef FakeHandler = FutureOr<ResponseBody> Function(RequestOptions options);

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final FakeHandler handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => handler(options);

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

/// 실제 LLM 서버를 부르지 않는다. [LlmRepository]를 구현한 가짜로 바꿔
/// 끼운다 — `messenger_page_test.dart`가 서비스를 상속해 바꾸는 패턴과 같되,
/// 여기서는 provider 자체(`llmRepositoryProvider`)를 override한다.
class _FakeLlmRepository implements LlmRepository {
  _FakeLlmRepository({required this.config, this.connectionOk = true});

  @override
  final LlmConfig config;
  final bool connectionOk;
  bool testConnectionCalled = false;

  @override
  bool get supportsImageInput => true;

  @override
  Future<String> chat(String prompt) async => '';

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) async =>
      '';

  @override
  Future<List<LlmExtractedItem>> extractItems(
    List<String> segments, {
    String recordType = 'meeting',
    String participantName = '',
    bool includeSpeakerSeparation = false,
    bool includeVoiceEmotion = false,
  }) async => const [];

  @override
  Future<bool> testConnection() async {
    testConnectionCalled = true;
    return connectionOk;
  }
}

Widget _wrap({
  FakeHandler? handler,
  LlmSettingsService? llmSettingsService,
  LlmRepository? Function(LlmConfig config)? llmRepositoryBuilder,
}) {
  return ProviderScope(
    overrides: [
      voiceEngineClientBuilderProvider.overrideWithValue(
        (settings) => VoiceEngineClient(
          settings: settings,
          dio: Dio()
            ..httpClientAdapter = _FakeAdapter(handler ?? (_) => _jsonBody({})),
        ),
      ),
      if (llmSettingsService != null)
        llmSettingsServiceProvider.overrideWithValue(llmSettingsService),
      if (llmRepositoryBuilder != null)
        llmRepositoryProvider.overrideWith((ref) async {
          final config = await ref.watch(llmConfigProvider.future);
          return llmRepositoryBuilder(config);
        }),
    ],
    child: const MaterialApp(home: VoiceSettingsPage()),
  );
}

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  /// LLM 섹션이 합쳐지며 화면이 길어져 기본 테스트 뷰포트로는 아래쪽
  /// 위젯(Provider 라디오, API Key 입력 등)이 캐시 범위 밖이라 트리에
  /// 빌드되지 않는다. 뷰포트를 넉넉히 키워 스크롤 없이 전부 빌드되게 한다.
  void useTallViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(1080, 4000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('STT/TTS 주소를 입력하고 저장하면 안내가 보인다', (tester) async {
    await tester.pumpWidget(_wrap(handler: (_) => _jsonBody({})));
    await tester.pumpAndSettle();

    final urlFields = find.byType(TextField);
    await tester.enterText(urlFields.first, 'http://192.168.0.10:8000');
    final saveButton = find.text('음성 서버 설정 저장');
    await tester.ensureVisible(saveButton);
    await tester.pumpAndSettle();
    await tester.tap(saveButton);
    await tester.pumpAndSettle();

    expect(find.text('음성 서버 설정을 저장했습니다'), findsOneWidget);
  });

  testWidgets('연결 확인이 성공하면 엔진 정보가 보인다', (tester) async {
    await tester.pumpWidget(
      _wrap(
        handler: (options) {
          expect(options.path, contains('/health'));
          return _jsonBody({'status': 'ok', 'ready': true, 'engine': 'whisper'});
        },
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'http://192.168.0.10:8000');
    await tester.tap(find.text('STT 연결 확인'));
    await tester.pumpAndSettle();

    expect(find.textContaining('연결됐습니다'), findsOneWidget);
    expect(find.textContaining('whisper'), findsOneWidget);
  });

  testWidgets('연결 확인이 실패하면 오류 문구가 보인다', (tester) async {
    await tester.pumpWidget(
      _wrap(
        handler: (options) => throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionError,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'http://192.168.0.10:8000');
    await tester.tap(find.text('STT 연결 확인'));
    await tester.pumpAndSettle();

    expect(find.text('STT 연결 확인'), findsOneWidget);
    expect(find.textContaining('연결됐습니다'), findsNothing);
  });

  testWidgets('provider를 고르고 API Key를 저장하면 다시 읽어도 그대로다', (tester) async {
    useTallViewport(tester);
    final service = LlmSettingsService();
    await tester.pumpWidget(
      _wrap(
        llmSettingsService: service,
        llmRepositoryBuilder: (config) => _FakeLlmRepository(config: config),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Anthropic Claude'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Anthropic Claude API Key'),
      'sk-test-key',
    );
    final saveButton = find.widgetWithText(OutlinedButton, '저장');
    await tester.ensureVisible(saveButton);
    await tester.pumpAndSettle();
    await tester.tap(saveButton);
    await tester.pumpAndSettle();

    expect(find.text('사진 읽기 설정을 저장했습니다'), findsOneWidget);

    final savedConfig = await service.loadConfig();
    expect(savedConfig.provider, LlmProvider.claude);
    final savedKey = await service.loadApiKey(LlmProvider.claude);
    expect(savedKey, 'sk-test-key');
  });

  testWidgets('연결 테스트를 누르면 가짜 repository의 testConnection이 호출된다', (
    tester,
  ) async {
    useTallViewport(tester);
    final service = LlmSettingsService();
    late _FakeLlmRepository createdRepo;
    await tester.pumpWidget(
      _wrap(
        llmSettingsService: service,
        llmRepositoryBuilder: (config) {
          createdRepo = _FakeLlmRepository(config: config, connectionOk: true);
          return createdRepo;
        },
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Groq API Key'),
      'groq-key',
    );
    final testButton1 = find.widgetWithText(ElevatedButton, '연결 테스트');
    await tester.ensureVisible(testButton1);
    await tester.pumpAndSettle();
    await tester.tap(testButton1);
    await tester.pumpAndSettle();

    expect(createdRepo.testConnectionCalled, isTrue);
    expect(find.text('연결 성공'), findsOneWidget);
  });

  testWidgets('설정이 없으면 연결 테스트가 안내 문구를 보여준다', (tester) async {
    useTallViewport(tester);
    final service = LlmSettingsService();
    await tester.pumpWidget(
      _wrap(
        llmSettingsService: service,
        llmRepositoryBuilder: (config) => null,
      ),
    );
    await tester.pumpAndSettle();

    final testButton2 = find.widgetWithText(ElevatedButton, '연결 테스트');
    await tester.ensureVisible(testButton2);
    await tester.pumpAndSettle();
    await tester.tap(testButton2);
    await tester.pumpAndSettle();

    expect(find.text('API Key 또는 설정이 없습니다'), findsOneWidget);
  });
}
