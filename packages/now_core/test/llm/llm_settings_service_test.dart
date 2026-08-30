import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/llm/llm_config.dart';
import 'package:now_core/llm/llm_settings_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('저장 키 이름', () {
    // 이름을 바꾸면 이미 저장된 사용자의 API Key가 사라진다. 2.3.5와 같아야 한다.
    test('2.3.5에서 쓰던 이름을 그대로 쓴다', () {
      expect(LlmSettingsService.keyProvider, 'llm_provider');
      expect(LlmSettingsService.keyApiKeyPrefix, 'llm_api_key_');
      expect(LlmSettingsService.keyOllamaUrl, 'llm_ollama_url');
      expect(LlmSettingsService.keyOllamaModel, 'llm_ollama_model');
    });

    test('API Key는 provider별 키에 들어간다', () async {
      await LlmSettingsService().saveApiKey(LlmProvider.groq, 'gsk-test');

      expect(
        await const FlutterSecureStorage().read(key: 'llm_api_key_groq'),
        'gsk-test',
      );
    });

    test('2.3.5가 남긴 API Key를 그대로 읽는다', () async {
      FlutterSecureStorage.setMockInitialValues({
        'llm_api_key_openai': 'sk-old',
      });

      expect(
        await LlmSettingsService().loadApiKey(LlmProvider.openAi),
        'sk-old',
      );
    });
  });

  group('설정 로드', () {
    test('저장된 Ollama 주소가 없으면 비어 있다', () async {
      final config = await LlmSettingsService().loadConfig();

      expect(config.ollamaUrl, isEmpty);
      expect(config.hasOllamaServer, isFalse);
    });

    test('provider를 고르지 않았으면 groq이다', () async {
      expect((await LlmSettingsService().loadConfig()).provider,
          LlmProvider.groq);
    });

    test('저장된 Ollama 주소와 모델을 읽는다', () async {
      final service = LlmSettingsService();
      await service.saveProvider(LlmProvider.ollama);
      await service.saveOllamaSettings(
        url: 'http://192.168.0.10:11434',
        model: 'qwen2.5',
      );

      final config = await service.loadConfig();

      expect(config.provider, LlmProvider.ollama);
      expect(config.ollamaUrl, 'http://192.168.0.10:11434');
      expect(config.ollamaModel, 'qwen2.5');
      expect(config.isConfigured, isTrue);
    });
  });

  group('STT 티어', () {
    // M4에서 음성 설정만 떼어냈고 이 값은 여기 남았다.
    test('저장한 값이 없으면 tier1이다', () async {
      expect(await LlmSettingsService().loadSttTier(), 'tier1');
    });

    test('저장한 값을 그대로 읽는다', () async {
      final service = LlmSettingsService();
      await service.saveSttTier('tier2');

      expect(await service.loadSttTier(), 'tier2');
    });
  });
}
