import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/llm_config.dart';

class LlmSettingsService {
  static const _storage = FlutterSecureStorage();

  static const _keyProvider = 'llm_provider';
  static const _keyApiKeyPrefix = 'llm_api_key_';
  static const _keyOllamaUrl = 'llm_ollama_url';
  static const _keyOllamaModel = 'llm_ollama_model';
  static const _keyWhisperUrl = 'whisper_server_url';

  /// 현재 설정 전체 로드
  Future<LlmConfig> loadConfig() async {
    final providerKey =
        await _storage.read(key: _keyProvider) ?? LlmProvider.groq.key;
    final provider = LlmProvider.fromKey(providerKey);

    final apiKey =
        await _storage.read(key: '$_keyApiKeyPrefix${provider.key}') ?? '';
        
    // [변경 1] 기본값을 내 서버 주소로 설정 (초기화 시 편리함)
    final ollamaUrl =
        await _storage.read(key: _keyOllamaUrl) ?? 'http://cyhuh.iptime.org:18080';
        
    final ollamaModel =
        await _storage.read(key: _keyOllamaModel) ?? 'llama3';

    final whisperUrl =
        await _storage.read(key: _keyWhisperUrl) ?? '';

    return LlmConfig(
      provider: provider,
      apiKey: apiKey,
      ollamaUrl: ollamaUrl,
      ollamaModel: ollamaModel,
      whisperUrl: whisperUrl,
    );
  }

  /// 선택 LLM 저장
  Future<void> saveProvider(LlmProvider provider) async {
    await _storage.write(key: _keyProvider, value: provider.key);
  }

  /// API Key 저장 (해당 LLM별)
  Future<void> saveApiKey(LlmProvider provider, String apiKey) async {
    await _storage.write(
        key: '$_keyApiKeyPrefix${provider.key}', value: apiKey);
  }

  /// API Key 로드 (해당 LLM별)
  Future<String> loadApiKey(LlmProvider provider) async {
    return await _storage.read(key: '$_keyApiKeyPrefix${provider.key}') ?? '';
  }

  /// Ollama 설정 전체 저장 (URL + Model)
  Future<void> saveOllamaSettings({
    required String url,
    required String model,
  }) async {
    await _storage.write(key: _keyOllamaUrl, value: url);
    await _storage.write(key: _keyOllamaModel, value: model);
  }

  /// STT 티어 저장/로드
  Future<void> saveSttTier(String tier) async {
    await _storage.write(key: 'stt_tier', value: tier);
  }

  Future<String> loadSttTier() async {
    return await _storage.read(key: 'stt_tier') ?? 'tier1';
  }

  /// Whisper 서버 URL 저장
  Future<void> saveWhisperUrl(String url) async {
    await _storage.write(key: _keyWhisperUrl, value: url);
  }

  /// Whisper 서버 URL 로드
  Future<String> loadWhisperUrl() async {
    return await _storage.read(key: _keyWhisperUrl) ?? '';
  }

  /// [추가] 모델만 따로 저장 (드롭다운에서 선택했을 때 사용)
  Future<void> saveOllamaModel(String model) async {
    await _storage.write(key: _keyOllamaModel, value: model);
  }
}