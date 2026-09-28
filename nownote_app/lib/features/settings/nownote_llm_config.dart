import 'package:now_core/now_core.dart';

const nowNoteLlmProviders = <LlmProvider>[
  LlmProvider.gemini,
  LlmProvider.openAi,
  LlmProvider.claude,
  LlmProvider.groq,
  LlmProvider.grok,
  LlmProvider.omniRoute,
  LlmProvider.ollama,
];

Future<LlmConfig> loadNowNoteLlmConfig(LlmSettingsService service) async {
  final config = await service.loadConfig();
  if (config.provider != LlmProvider.deepSeek) return config;

  // The old DeepSeek key remains stored, but is never used for OmniRoute.
  await service.saveProvider(LlmProvider.omniRoute);
  return service.loadConfig();
}
