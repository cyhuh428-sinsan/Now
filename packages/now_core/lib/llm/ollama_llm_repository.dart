import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'llm_repository.dart';
import 'llm_config.dart';
import 'llm_image_input.dart';
import 'base_llm_repository.dart';

class OllamaLlmRepository extends BaseLlmRepository {
  @override
  final LlmConfig config;

  OllamaLlmRepository(this.config);

  /// 서버 주소가 비었을 때 사용자에게 보여줄 안내.
  static const String missingServerMessage = 'Ollama 서버 주소를 설정에서 입력해 주세요';

  /// 서버 주소를 못 받았을 때 모델 목록 대신 내주는 값.
  ///
  /// 요청이 실패했을 때 내주던 값과 같다. 화면이 빈 드롭다운을 만나지 않게 한다.
  static const List<String> fallbackModels = [
    'llama3',
    'mistral',
    'qwen2.5',
    'gemma2',
  ];

  // 주소 뒤에 '/v1'이 없으면 자동으로 붙여줌 (OpenAI 호환성)
  String get _baseUrl {
    String url = config.ollamaUrl.trim();
    if (url.endsWith('/')) url = url.substring(0, url.length - 1);
    if (!url.endsWith('/v1')) url = '$url/v1';
    return url;
  }

  // 1. 회의록/데이터 추출 (OpenAI 호환 방식)
  @override
  Future<List<LlmExtractedItem>> extractItems(List<String> segments,
      {String recordType = 'meeting',
      String participantName = '',
      bool includeSpeakerSeparation = false,
      bool includeVoiceEmotion = false}) async {
    if (!config.hasOllamaServer) {
      throw const LlmNotConfiguredException(missingServerMessage);
    }
    final r = await dio.post(
      '$_baseUrl/chat/completions',
      options: Options(
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer daon-local-key' // 가짜 키
        },
        receiveTimeout: const Duration(seconds: 120),
      ),
      data: {
        'model': config.ollamaModel,
        'messages': [
          {
            'role': 'user',
            'content': buildPrompt(segments,
                recordType: recordType,
                participantName: participantName,
                includeSpeakerSeparation: includeSpeakerSeparation,
                includeVoiceEmotion: includeVoiceEmotion)
          }
        ],
        'temperature': 0.2,
        'stream': false,
      },
    );

    // 응답 파싱
    final content = r.data['choices'][0]['message']['content'] as String;
    return parseResponse(content);
  }

  // 2. 일반 채팅 (OpenAI 호환 방식)
  @override
  Future<String> chat(String prompt) async {
    if (!config.hasOllamaServer) {
      throw const LlmNotConfiguredException(missingServerMessage);
    }
    final r = await dio.post(
      '$_baseUrl/chat/completions',
      options: Options(
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer daon-local-key'
        },
        receiveTimeout: const Duration(seconds: 60),
      ),
      data: {
        'model': config.ollamaModel,
        'messages': [
          {'role': 'user', 'content': prompt}
        ],
        'temperature': 0.3,
        'stream': false,
      },
    );
    return r.data['choices'][0]['message']['content'] as String;
  }

  // 2-1. 이미지 입력 (OpenAI 호환 방식)
  //
  // Ollama의 OpenAI 호환 엔드포인트는 Vision을 지원한다고 문서에 적혀 있고,
  // 이미지는 base64 data URL로만 받는다(외부 URL은 받지 않는다).
  // 다만 실제로 읽어낼 수 있는지는 사용자가 고른 모델에 달려 있다. 서버에
  // 물어볼 방법이 없으므로 지원한다고 두고, 모델이 못 받으면 서버 오류로
  // 돌아온다.
  @override
  bool get supportsImageInput => true;

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) async {
    if (!config.hasOllamaServer) {
      throw const LlmNotConfiguredException(missingServerMessage);
    }
    final r = await dio.post(
      '$_baseUrl/chat/completions',
      options: Options(
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer daon-local-key'
        },
        // 로컬 모델은 이미지 처리가 텍스트보다 오래 걸린다.
        receiveTimeout: const Duration(seconds: 180),
      ),
      data: {
        'model': config.ollamaModel,
        'messages': [
          {'role': 'user', 'content': openAiImageContent(prompt, image)}
        ],
        'temperature': 0.0,
        'stream': false,
      },
    );
    return r.data['choices'][0]['message']['content'] as String;
  }

  // 3. 연결 테스트 (OpenAI 호환 방식)
  @override
  Future<bool> testConnection() async {
    if (!config.hasOllamaServer) return false;
    try {
      final r = await dio.get(
        '$_baseUrl/models',
        options: Options(receiveTimeout: const Duration(seconds: 10)),
      );
      return r.statusCode == 200;
    } catch (e) {
      developer.log('Ollama 연결 실패: $e');
      return false;
    }
  }

  // 4. [새로 추가된 기능] 모델 목록 가져오기
  Future<List<String>> getAvailableModels() async {
    if (!config.hasOllamaServer) {
      developer.log(missingServerMessage);
      return fallbackModels;
    }
    try {
      final r = await dio.get(
        '$_baseUrl/models',
        options: Options(receiveTimeout: const Duration(seconds: 10)),
      );

      if (r.statusCode == 200) {
        final List data = r.data['data'];
        // 모델 ID만 추출해서 리스트로 반환
        return data.map((e) => e['id'].toString()).toList();
      }
    } catch (e) {
      developer.log('모델 목록 가져오기 실패: $e');
    }
    // 실패 시 기본값 반환
    return fallbackModels;
  }
}
