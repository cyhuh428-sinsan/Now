import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../models/llm_config.dart';
import '../interfaces/llm_repository.dart';
import '../services/llm_settings_service.dart';
import '../cloud_llm_repositories.dart';
import '../ollama_llm_repository.dart';

part 'llm_providers.g.dart';

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
