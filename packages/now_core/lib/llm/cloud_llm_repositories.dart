import 'package:dio/dio.dart';
import 'llm_repository.dart';
import 'llm_config.dart';
import 'llm_image_input.dart';
import 'base_llm_repository.dart';

// ── Groq ──
/// 이미지: 지원. 단 텍스트에 쓰는 llama-3.3-70b는 이미지를 받지 못하므로
/// 사진 요청만 Groq 문서가 안내하는 멀티모달 모델로 보낸다.
class GroqLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  GroqLlmRepository(this.config);

  /// Groq 문서(console.groq.com/docs/vision)가 이미지 입력 모델로 안내하는 값.
  static const String visionModel = 'qwen/qwen3.6-27b';

  @override
  bool get supportsImageInput => true;

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) async {
    final r = await dio.post(
      'https://api.groq.com/openai/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': visionModel, 'messages': [{'role': 'user', 'content': openAiImageContent(prompt, image)}], 'temperature': 0.0, 'max_tokens': 2048},
    );
    return r.data['choices'][0]['message']['content'] as String;
  }

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = '', bool includeSpeakerSeparation = false, bool includeVoiceEmotion = false}) async {
    final r = await dio.post(
      'https://api.groq.com/openai/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'llama-3.3-70b-versatile', 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName, includeSpeakerSeparation: includeSpeakerSeparation, includeVoiceEmotion: includeVoiceEmotion)}], 'temperature': 0.2, 'max_tokens': 2048},
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
/// 이미지: 미지원. DeepSeek API 문서에 이미지를 받는 모델이 없다.
/// [BaseLlmRepository]의 기본값(supportsImageInput = false)을 그대로 쓴다.
class DeepSeekLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  DeepSeekLlmRepository(this.config);

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = '', bool includeSpeakerSeparation = false, bool includeVoiceEmotion = false}) async {
    final r = await dio.post(
      'https://api.deepseek.com/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'deepseek-chat', 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName, includeSpeakerSeparation: includeSpeakerSeparation, includeVoiceEmotion: includeVoiceEmotion)}], 'temperature': 0.2, 'max_tokens': 2048},
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
/// 이미지: 지원. 요청 본문이 OpenAI 계열과 달라 parts에 inline_data를 넣는다.
class GeminiLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  GeminiLlmRepository(this.config);

  /// 텍스트 경로가 쓰는 gemini-1.5-flash는 은퇴했다. 사진 경로는 현재 문서에
  /// 살아 있는 멀티모달 모델로 보낸다.
  static const String visionModel = 'gemini-2.5-flash';

  @override
  bool get supportsImageInput => true;

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) async {
    final r = await dio.post(
      'https://generativelanguage.googleapis.com/v1beta/models/$visionModel:generateContent?key=${config.apiKey}',
      options: Options(headers: {'Content-Type': 'application/json'}),
      data: {
        'contents': [
          {
            'parts': [
              // 확인한 규격: REST generateContent의 Part는 snake_case
              // inline_data{mime_type, data}로 원본 바이트를 받는다.
              {
                'inline_data': {'mime_type': image.mimeType, 'data': image.base64Data}
              },
              {'text': prompt},
            ]
          }
        ],
        'generationConfig': {'temperature': 0.0, 'maxOutputTokens': 2048},
      },
    );
    return r.data['candidates'][0]['content']['parts'][0]['text'] as String;
  }

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = '', bool includeSpeakerSeparation = false, bool includeVoiceEmotion = false}) async {
    final r = await dio.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}',
      options: Options(headers: {'Content-Type': 'application/json'}),
      data: {'contents': [{'parts': [{'text': buildPrompt(segments, recordType: recordType, participantName: participantName, includeSpeakerSeparation: includeSpeakerSeparation, includeVoiceEmotion: includeVoiceEmotion)}]}], 'generationConfig': {'temperature': 0.2, 'maxOutputTokens': 2048}},
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
/// 이미지: 지원. gpt-4o-mini가 이미지를 받으므로 텍스트와 같은 모델을 쓴다.
class OpenAiLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  OpenAiLlmRepository(this.config);

  @override
  bool get supportsImageInput => true;

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) async {
    final r = await dio.post(
      'https://api.openai.com/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'gpt-4o-mini', 'messages': [{'role': 'user', 'content': openAiImageContent(prompt, image)}], 'temperature': 0.0, 'max_tokens': 2048},
    );
    return r.data['choices'][0]['message']['content'] as String;
  }

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = '', bool includeSpeakerSeparation = false, bool includeVoiceEmotion = false}) async {
    final r = await dio.post(
      'https://api.openai.com/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'gpt-4o-mini', 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName, includeSpeakerSeparation: includeSpeakerSeparation, includeVoiceEmotion: includeVoiceEmotion)}], 'temperature': 0.2, 'max_tokens': 2048},
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
/// 이미지: 지원. 현재 Claude 모델은 모두 이미지를 받으므로 텍스트와 같은
/// 모델을 쓴다. 문서 권장대로 이미지 블록을 텍스트 앞에 둔다.
class ClaudeLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  ClaudeLlmRepository(this.config);

  @override
  bool get supportsImageInput => true;

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) async {
    final r = await dio.post(
      'https://api.anthropic.com/v1/messages',
      options: Options(headers: {'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'}),
      data: {
        'model': 'claude-3-5-haiku-20241022',
        'max_tokens': 2048,
        'messages': [
          {
            'role': 'user',
            'content': [
              // 확인한 규격: image 블록의 source가 base64/media_type/data를 받는다.
              {
                'type': 'image',
                'source': {'type': 'base64', 'media_type': image.mimeType, 'data': image.base64Data}
              },
              {'type': 'text', 'text': prompt},
            ]
          }
        ],
      },
    );
    return r.data['content'][0]['text'] as String;
  }

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = '', bool includeSpeakerSeparation = false, bool includeVoiceEmotion = false}) async {
    final r = await dio.post(
      'https://api.anthropic.com/v1/messages',
      options: Options(headers: {'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'}),
      data: {'model': 'claude-3-5-haiku-20241022', 'max_tokens': 2048, 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName, includeSpeakerSeparation: includeSpeakerSeparation, includeVoiceEmotion: includeVoiceEmotion)}]},
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
/// 이미지: 미지원으로 둔다.
///
/// xAI가 이미지를 받는 것은 맞지만, 현재 공개 문서는 Responses API
/// (`/v1/responses`, `type: "input_image"`)만 예시로 보여 준다. 이 코드가 쓰는
/// `/v1/chat/completions`에 이미지를 어떤 모양으로 실어야 하는지 문서에서
/// 확인하지 못했다. 짐작으로 보내면 실패가 "인식 실패"로 보이므로,
/// 규격을 확인할 때까지 미지원으로 두고 사용자에게 그렇게 알린다.
class GrokLlmRepository extends BaseLlmRepository {
  @override final LlmConfig config;
  GrokLlmRepository(this.config);

  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType = 'meeting', String participantName = '', bool includeSpeakerSeparation = false, bool includeVoiceEmotion = false}) async {
    final r = await dio.post(
      'https://api.x.ai/v1/chat/completions',
      options: Options(headers: {'Authorization': 'Bearer ${config.apiKey}', 'Content-Type': 'application/json'}),
      data: {'model': 'grok-2-latest', 'messages': [{'role': 'user', 'content': buildPrompt(segments, recordType: recordType, participantName: participantName, includeSpeakerSeparation: includeSpeakerSeparation, includeVoiceEmotion: includeVoiceEmotion)}], 'temperature': 0.2, 'max_tokens': 2048},
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
