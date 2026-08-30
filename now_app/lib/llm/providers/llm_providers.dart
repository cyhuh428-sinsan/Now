import 'package:now_core/now_core.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'llm_providers.g.dart';

// LLM provider 구현과 설정 저장은 now_core/lib/llm에 있다. NowNote와 "묻기"
// 기능이 같은 것을 쓴다. 여기 남은 것은 앱의 riverpod 배선뿐이다.
// now_core는 riverpod에 기대지 않는다. 음성 계층(M4)도 같은 모양이다.

@riverpod
LlmSettingsService llmSettingsService(LlmSettingsServiceRef ref) {
  return LlmSettingsService();
}

@riverpod
Future<LlmConfig> llmConfig(LlmConfigRef ref) async {
  final service = ref.watch(llmSettingsServiceProvider);
  return service.loadConfig();
}

@riverpod
Future<LlmRepository?> llmRepository(LlmRepositoryRef ref) async {
  final config = await ref.watch(llmConfigProvider.future);
  if (!config.isConfigured) return null;
  return switch (config.provider) {
    LlmProvider.groq     => GroqLlmRepository(config),
    LlmProvider.deepSeek => DeepSeekLlmRepository(config),
    LlmProvider.gemini   => GeminiLlmRepository(config),
    LlmProvider.openAi   => OpenAiLlmRepository(config),
    LlmProvider.claude   => ClaudeLlmRepository(config),
    LlmProvider.grok     => GrokLlmRepository(config),
    LlmProvider.ollama   => OllamaLlmRepository(config),
  };
}
