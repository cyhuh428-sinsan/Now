import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'llm_config.dart';

class LlmSettingsService {
  /// 저장소를 받는다. 넘기지 않으면 기기 보안 저장소를 쓴다.
  ///
  /// 저장 키 이름은 2.3.5와 같다. 이름을 바꾸면 이미 저장된 API Key가
  /// 읽히지 않는다.
  LlmSettingsService({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _storage = storage;

  final FlutterSecureStorage _storage;

  static const keyProvider = 'llm_provider';
  static const keyApiKeyPrefix = 'llm_api_key_';
  static const keyOllamaUrl = 'llm_ollama_url';
  static const keyOllamaModel = 'llm_ollama_model';

  /// 현재 설정 전체 로드
  Future<LlmConfig> loadConfig() async {
    final providerKey =
        await _storage.read(key: keyProvider) ?? LlmProvider.groq.key;
    final provider = LlmProvider.fromKey(providerKey);

    final apiKey =
        await _storage.read(key: '$keyApiKeyPrefix${provider.key}') ?? '';

    // Ollama 주소에는 기본값을 두지 않는다. 사용자마다 서버가 다르고,
    // 기본값을 박아 두면 설정하지 않은 앱이 남의 서버로 요청을 보낸다.
    final ollamaUrl = await _storage.read(key: keyOllamaUrl) ?? '';

    final ollamaModel = await _storage.read(key: keyOllamaModel) ?? 'llama3';

    return LlmConfig(
      provider: provider,
      apiKey: apiKey,
      ollamaUrl: ollamaUrl,
      ollamaModel: ollamaModel,
    );
  }

  /// 선택 LLM 저장
  Future<void> saveProvider(LlmProvider provider) async {
    await _storage.write(key: keyProvider, value: provider.key);
  }

  /// API Key 저장 (해당 LLM별)
  Future<void> saveApiKey(LlmProvider provider, String apiKey) async {
    await _storage.write(key: '$keyApiKeyPrefix${provider.key}', value: apiKey);
  }

  /// API Key 로드 (해당 LLM별)
  Future<String> loadApiKey(LlmProvider provider) async {
    return await _storage.read(key: '$keyApiKeyPrefix${provider.key}') ?? '';
  }

  /// Ollama 설정 전체 저장 (URL + Model)
  Future<void> saveOllamaSettings({
    required String url,
    required String model,
  }) async {
    await _storage.write(key: keyOllamaUrl, value: url);
    await _storage.write(key: keyOllamaModel, value: model);
  }

  /// STT 티어 저장/로드
  Future<void> saveSttTier(String tier) async {
    await _storage.write(key: 'stt_tier', value: tier);
  }

  Future<String> loadSttTier() async {
    return await _storage.read(key: 'stt_tier') ?? 'tier1';
  }

  /// [추가] 모델만 따로 저장 (드롭다운에서 선택했을 때 사용)
  Future<void> saveOllamaModel(String model) async {
    await _storage.write(key: keyOllamaModel, value: model);
  }
}
