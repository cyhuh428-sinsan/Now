import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/settings/nownote_llm_config.dart';

class _CaptureAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  final bodies = <Map<String, dynamic>>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (requestStream != null) {
      final bytes = await requestStream.expand((chunk) => chunk).toList();
      bodies.add(jsonDecode(utf8.decode(bytes)) as Map<String, dynamic>);
    }
    return ResponseBody.fromString(
      options.method == 'GET'
          ? '{"data":[]}'
          : '{"choices":[{"message":{"content":"ok"}}]}',
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test(
    'legacy DeepSeek selection never sends its saved key to OmniRoute',
    () async {
      FlutterSecureStorage.setMockInitialValues({
        'llm_provider': 'deepseek',
        'llm_api_key_deepseek': 'old-deepseek-key',
      });
      final service = LlmSettingsService();

      final config = await loadNowNoteLlmConfig(service);
      expect(config.provider, LlmProvider.omniRoute);
      expect(config.apiKey, isEmpty);
      expect(config.omniRouteModel, 'auto');

      await service.saveProvider(LlmProvider.omniRoute);
      await service.saveApiKey(LlmProvider.omniRoute, 'new-omni-key');
      await service.saveOmniRouteModel('vision-model');

      final saved = await service.loadConfig();
      expect(saved.provider, LlmProvider.omniRoute);
      expect(saved.apiKey, 'new-omni-key');
      expect(saved.omniRouteModel, 'vision-model');
      expect(
        await const FlutterSecureStorage().read(key: 'llm_api_key_deepseek'),
        'old-deepseek-key',
      );
    },
  );

  test(
    'OmniRoute sends chat and image requests to the configured endpoint',
    () async {
      final adapter = _CaptureAdapter();
      final config = LlmConfig(
        provider: LlmProvider.omniRoute,
        apiKey: 'new-omni-key',
        omniRouteModel: 'auto',
      );
      final repo = OmniRouteLlmRepository(config);
      repo.dio.httpClientAdapter = adapter;

      expect(await repo.chat('hello'), 'ok');
      expect(
        adapter.requests.first.path,
        'https://omniroute.sinsan.kr/v1/chat/completions',
      );
      expect(
        adapter.requests.first.headers['Authorization'],
        'Bearer new-omni-key',
      );
      expect(adapter.bodies.first['model'], 'auto');
      expect(repo.supportsImageInput, isTrue);

      final image = LlmImageInput.fromBytes([
        0x89,
        0x50,
        0x4e,
        0x47,
      ], mimeType: 'image/png');
      expect(await repo.chatWithImage('read this', image), 'ok');
      expect(jsonEncode(adapter.bodies.last), contains(image.base64Data));

      expect(await repo.testConnection(), isTrue);
      expect(
        adapter.requests.last.path,
        'https://omniroute.sinsan.kr/v1/models',
      );
    },
  );
}
