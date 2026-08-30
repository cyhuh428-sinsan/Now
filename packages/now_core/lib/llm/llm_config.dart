/// 지원 LLM 목록
enum LlmProvider {
  gemini('Google Gemini', 'gemini'),
  openAi('OpenAI ChatGPT', 'openai'),
  claude('Anthropic Claude', 'claude'),
  groq('Groq', 'groq'),
  grok('xAI Grok', 'grok'),
  deepSeek('DeepSeek', 'deepseek'),
  ollama('로컬 Ollama', 'ollama');

  final String displayName;
  final String key;
  const LlmProvider(this.displayName, this.key);

  static LlmProvider fromKey(String key) =>
      LlmProvider.values.firstWhere((e) => e.key == key,
          orElse: () => LlmProvider.gemini);
}

/// LLM 설정값 (secure_storage에서 로드)
class LlmConfig {
  final LlmProvider provider;
  final String apiKey;         // 클라우드용
  final String ollamaUrl;      // Ollama 전용
  final String ollamaModel;    // Ollama 전용
  // 음성 서버 주소/키는 now_core의 VoiceSettings가 들고 있다. 여기 두지 않는다.

  const LlmConfig({
    required this.provider,
    this.apiKey = '',
    // Ollama 서버는 사용자마다 다르다. 기본값을 박아 두면 설정하지 않은 앱이
    // 남의 서버로 요청을 보낸다. 비워 두고 설정 화면에서 받는다.
    this.ollamaUrl = '',
    this.ollamaModel = 'llama3.1',
  });

  /// Ollama 서버 주소가 들어와 있는지.
  bool get hasOllamaServer => ollamaUrl.trim().isNotEmpty;

  bool get isConfigured {
    if (provider == LlmProvider.ollama) {
      return hasOllamaServer && ollamaModel.isNotEmpty;
    }
    return apiKey.isNotEmpty;
  }
}
