import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

/// 사진 입력에 쓸 LLM 배선.
///
/// LLM provider 구현과 설정 저장은 `now_core`에 있다(캡처와 "묻기"가 이미
/// 쓰고 있다). 설정 화면(U18)이 아직 없어도 이 provider는 저장된 값을 그대로
/// 읽어 쓸 수 있다. 화면(U18)이 붙으면 같은 [LlmSettingsService]를 공유한다.
final llmSettingsServiceProvider = Provider<LlmSettingsService>((ref) {
  return LlmSettingsService();
});

final llmConfigProvider = FutureProvider.autoDispose<LlmConfig>((ref) async {
  final service = ref.watch(llmSettingsServiceProvider);
  return service.loadConfig();
});

/// 설정이 없으면 null을 돌려준다. 화면은 null이면 안내 문구를 보여준다.
final llmRepositoryProvider =
    FutureProvider.autoDispose<LlmRepository?>((ref) async {
  final config = await ref.watch(llmConfigProvider.future);
  if (!config.isConfigured) return null;
  return switch (config.provider) {
    LlmProvider.groq => GroqLlmRepository(config),
    LlmProvider.deepSeek => DeepSeekLlmRepository(config),
    LlmProvider.gemini => GeminiLlmRepository(config),
    LlmProvider.openAi => OpenAiLlmRepository(config),
    LlmProvider.claude => ClaudeLlmRepository(config),
    LlmProvider.grok => GrokLlmRepository(config),
    LlmProvider.ollama => OllamaLlmRepository(config),
  };
});
