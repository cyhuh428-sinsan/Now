import 'package:dio/dio.dart';

import 'base_llm_repository.dart';
import 'llm_config.dart';
import 'llm_image_input.dart';
import 'llm_repository.dart';

class OmniRouteLlmRepository extends BaseLlmRepository {
  OmniRouteLlmRepository(this.config);

  static const baseUrl = 'https://omniroute.sinsan.kr/v1';

  @override
  final LlmConfig config;

  String get _model => config.omniRouteModel.trim().isEmpty
      ? 'auto'
      : config.omniRouteModel.trim();

  Options get _options => Options(
    headers: {
      'Authorization': 'Bearer ${config.apiKey}',
      'Content-Type': 'application/json',
    },
  );

  @override
  bool get supportsImageInput => true;

  Future<String> _complete(Object content, double temperature) async {
    final response = await dio.post(
      '$baseUrl/chat/completions',
      options: _options,
      data: {
        'model': _model,
        'messages': [
          {'role': 'user', 'content': content},
        ],
        'temperature': temperature,
        'max_tokens': 2048,
      },
    );
    return response.data['choices'][0]['message']['content'] as String;
  }

  @override
  Future<String> chat(String prompt) => _complete(prompt, 0.3);

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) =>
      _complete(openAiImageContent(prompt, image), 0.0);

  @override
  Future<List<LlmExtractedItem>> extractItems(
    List<String> segments, {
    String recordType = 'meeting',
    String participantName = '',
    bool includeSpeakerSeparation = false,
    bool includeVoiceEmotion = false,
  }) async {
    final response = await _complete(
      buildPrompt(
        segments,
        recordType: recordType,
        participantName: participantName,
        includeSpeakerSeparation: includeSpeakerSeparation,
        includeVoiceEmotion: includeVoiceEmotion,
      ),
      0.2,
    );
    return parseResponse(response);
  }

  @override
  Future<bool> testConnection() async {
    try {
      final response = await dio.get('$baseUrl/models', options: _options);
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
