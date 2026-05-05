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
  final String whisperUrl;     // Whisper STT 서버

  const LlmConfig({
    required this.provider,
    this.apiKey = '',
    this.ollamaUrl = 'http://cyhuh.iptime.org:18080',
    this.ollamaModel = 'llama3.1',
    this.whisperUrl = '',
  });

  bool get isConfigured {
    if (provider == LlmProvider.ollama) {
      return ollamaUrl.isNotEmpty && ollamaModel.isNotEmpty;
    }
    return apiKey.isNotEmpty;
  }
}
