import 'package:now_core/now_core.dart';

final nowLlmProviders = LlmProvider.values
    .where((provider) => provider != LlmProvider.deepSeek)
    .toList(growable: false);

Future<LlmConfig> loadNowLlmConfig(LlmSettingsService service) async {
  final config = await service.loadConfig();
  if (config.provider != LlmProvider.deepSeek) return config;

  // Preserve the old key, but require a separate OmniRoute key.
  await service.saveProvider(LlmProvider.omniRoute);
  return service.loadConfig();
}
