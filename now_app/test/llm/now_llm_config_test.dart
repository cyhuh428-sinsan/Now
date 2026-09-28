import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now/llm/providers/now_llm_config.dart';
import 'package:now_core/now_core.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('Now offers OmniRoute instead of DeepSeek', () {
    expect(nowLlmProviders, contains(LlmProvider.omniRoute));
    expect(nowLlmProviders, isNot(contains(LlmProvider.deepSeek)));
  });

  test('legacy DeepSeek selection does not reuse its API key', () async {
    FlutterSecureStorage.setMockInitialValues({
      'llm_provider': 'deepseek',
      'llm_api_key_deepseek': 'old-deepseek-key',
    });
    final service = LlmSettingsService();

    final config = await loadNowLlmConfig(service);
    expect(config.provider, LlmProvider.omniRoute);
    expect(config.apiKey, isEmpty);
    expect(await service.loadApiKey(LlmProvider.deepSeek), 'old-deepseek-key');

    await service.saveApiKey(LlmProvider.omniRoute, 'new-omni-key');
    await service.saveOmniRouteModel('my-model');
    final updated = await loadNowLlmConfig(service);
    expect(updated.apiKey, 'new-omni-key');
    expect(updated.omniRouteModel, 'my-model');
  });
}
