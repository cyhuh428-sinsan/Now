import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/llm/llm_config.dart';

void main() {
  group('LlmConfig', () {
    test('Ollama 주소 기본값은 비어 있다', () {
      const config = LlmConfig(provider: LlmProvider.ollama);

      expect(config.ollamaUrl, isEmpty);
      expect(config.hasOllamaServer, isFalse);
    });

    test('Ollama 주소가 없으면 설정이 끝나지 않은 상태다', () {
      const config = LlmConfig(
        provider: LlmProvider.ollama,
        ollamaModel: 'llama3',
      );

      expect(config.isConfigured, isFalse);
    });

    test('공백만 있는 Ollama 주소도 없는 것으로 본다', () {
      const config = LlmConfig(
        provider: LlmProvider.ollama,
        ollamaUrl: '   ',
        ollamaModel: 'llama3',
      );

      expect(config.hasOllamaServer, isFalse);
      expect(config.isConfigured, isFalse);
    });

    test('Ollama 주소와 모델이 모두 있으면 설정이 끝난 상태다', () {
      const config = LlmConfig(
        provider: LlmProvider.ollama,
        ollamaUrl: 'http://192.168.0.10:11434',
        ollamaModel: 'llama3',
      );

      expect(config.isConfigured, isTrue);
    });

    test('클라우드 provider는 Ollama 주소와 무관하게 API Key로 판단한다', () {
      const withKey = LlmConfig(provider: LlmProvider.groq, apiKey: 'k');
      const withoutKey = LlmConfig(provider: LlmProvider.groq);

      expect(withKey.isConfigured, isTrue);
      expect(withoutKey.isConfigured, isFalse);
    });

    test('모르는 키는 gemini로 떨어진다', () {
      expect(LlmProvider.fromKey('ollama'), LlmProvider.ollama);
      expect(LlmProvider.fromKey('없는provider'), LlmProvider.gemini);
    });
  });
}
