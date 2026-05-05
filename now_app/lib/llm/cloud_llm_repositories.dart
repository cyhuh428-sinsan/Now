import 'package:dio/dio.dart';
import 'interfaces/llm_repository.dart';
import 'models/llm_config.dart';
import 'base_llm_repository.dart';

// ── Groq ──
class GroqLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  GroqLlmRepository(this.config);

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = ''}) async {
    final r = await dio.post(
      'https://api.groq.com/openai/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'llama-3.3-70b-versatile', 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName)}], 'temperature': 0.2, 'max_tokens': 2048},
    );
    return parseResponse(r.data['choices'][0]['message']['content'] as String);
  }

  @override
  Future<String> chat(String prompt) async {
    final r = await dio.post(
      'https://api.groq.com/openai/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'llama-3.3-70b-versatile', 'messages': [{'role': 'user', 'content': prompt}], 'temperature': 0.3, 'max_tokens': 2048},
    );
    return r.data['choices'][0]['message']['content'] as String;
  }

  @override
  Future<bool> testConnection() async {
    try {
      final r = await dio.get('https://api.groq.com/openai/v1/models', options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}'}));
      return r.statusCode == 200;
    } catch (_) { return false; }
  }
}

// ── DeepSeek ──
class DeepSeekLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  DeepSeekLlmRepository(this.config);

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = ''}) async {
    final r = await dio.post(
      'https://api.deepseek.com/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'deepseek-chat', 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName)}], 'temperature': 0.2, 'max_tokens': 2048},
    );
    return parseResponse(r.data['choices'][0]['message']['content'] as String);
  }

  @override
  Future<String> chat(String prompt) async {
    final r = await dio.post(
      'https://api.deepseek.com/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'deepseek-chat', 'messages': [{'role': 'user', 'content': prompt}], 'temperature': 0.3, 'max_tokens': 2048},
    );
    return r.data['choices'][0]['message']['content'] as String;
  }

  @override
  Future<bool> testConnection() async {
    try {
      final r = await dio.get('https://api.deepseek.com/models', options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}'}));
      return r.statusCode == 200;
    } catch (_) { return false; }
  }
}

// ── Gemini ──
class GeminiLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  GeminiLlmRepository(this.config);

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = ''}) async {
    final r = await dio.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}',
      options: Options(headers: {'Content-Type': 'application/json'}),
      data: {'contents': [{'parts': [{'text': buildPrompt(segments, recordType: recordType, participantName: participantName)}]}], 'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 2048}},
    );
    return parseResponse(r.data['candidates'][0]['content']['parts'][0]['text'] as String);
  }

  @override
  Future<String> chat(String prompt) async {
    final r = await dio.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}',
      options: Options(headers: {'Content-Type': 'application/json'}),
      data: {'contents': [{'parts': [{'text': prompt}]}], 'generationConfig': {'temperature': 0.3, 'maxOutputTokens': 2048}},
    );
    return r.data['candidates'][0]['content']['parts'][0]['text'] as String;
  }

  @override
  Future<bool> testConnection() async {
    try {
      final r = await dio.get('https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}');
      return r.statusCode == 200;
    } catch (_) { return false; }
  }
}

// ── OpenAI ──
class OpenAiLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  OpenAiLlmRepository(this.config);

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = ''}) async {
    final r = await dio.post(
      'https://api.openai.com/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'gpt-4o-mini', 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName)}], 'temperature': 0.2, 'max_tokens': 2048},
    );
    return parseResponse(r.data['choices'][0]['message']['content'] as String);
  }

  @override
  Future<String> chat(String prompt) async {
    final r = await dio.post(
      'https://api.openai.com/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'gpt-4o-mini', 'messages': [{'role': 'user', 'content': prompt}], 'temperature': 0.3, 'max_tokens': 2048},
    );
    return r.data['choices'][0]['message']['content'] as String;
  }

  @override
  Future<bool> testConnection() async {
    try {
      final r = await dio.get('https://api.openai.com/v1/models', options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}'}));
      return r.statusCode == 200;
    } catch (_) { return false; }
  }
}

// ── Claude ──
class ClaudeLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  ClaudeLlmRepository(this.config);

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = ''}) async {
    final r = await dio.post(
      'https://api.anthropic.com/v1/messages',
      options: Options(headers: {'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'}),
      data: {'model': 'claude-3-5-haiku-20241022', 'max_tokens': 2048, 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName)}]},
    );
    return parseResponse(r.data['content'][0]['text'] as String);
  }

  @override
  Future<String> chat(String prompt) async {
    final r = await dio.post(
      'https://api.anthropic.com/v1/messages',
      options: Options(headers: {'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'}),
      data: {'model': 'claude-3-5-haiku-20241022', 'max_tokens': 2048, 'messages': [{'role': 'user', 'content': prompt}]},
    );
    return r.data['content'][0]['text'] as String;
  }

  @override
  Future<bool> testConnection() async {
    try {
      final r = await dio.post(
        'https://api.anthropic.com/v1/messages',
        options: Options(headers: {'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'}),
        data: {'model': 'claude-3-5-haiku-20241022', 'max_tokens': 10, 'messages': [{'role': 'user', 'content': 'hi'}]},
      );
      return r.statusCode == 200;
    } catch (_) { return false; }
  }
}

// ── xAI Grok ──
class GrokLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  GrokLlmRepository(this.config);

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = ''}) async {
    final r = await dio.post(
      'https://api.x.ai/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'grok-2-latest', 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName)}], 'temperature': 0.2, 'max_tokens': 2048},
    );
    return parseResponse(r.data['choices'][0]['message']['content'] as String);
  }

  @override
  Future<String> chat(String prompt) async {
    final r = await dio.post(
      'https://api.x.ai/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'grok-2-latest', 'messages': [{'role': 'user', 'content': prompt}], 'temperature': 0.3, 'max_tokens': 2048},
    );
    return r.data['choices'][0]['message']['content'] as String;
  }

  @override
  Future<bool> testConnection() async {
    try {
      final r = await dio.get('https://api.x.ai/v1/models', options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}'}));
      return r.statusCode == 200;
    } catch (_) { return false; }
  }
}
