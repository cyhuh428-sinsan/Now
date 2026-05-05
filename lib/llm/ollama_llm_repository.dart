import 'package:dio/dio.dart';
import 'interfaces/llm_repository.dart';
import 'models/llm_config.dart';
import 'base_llm_repository.dart';

class OllamaLlmRepository extends BaseLlmRepository {
  @override
  final LlmConfig config;

  OllamaLlmRepository(this.config);

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
      {String recordType = 'meeting', String participantName = ''}) async {
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
                recordType: recordType, participantName: participantName)
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

  // 3. 연결 테스트 (OpenAI 호환 방식)
  @override
  Future<bool> testConnection() async {
    try {
      final r = await dio.get(
        '$_baseUrl/models',
        options: Options(receiveTimeout: const Duration(seconds: 10)),
      );
      return r.statusCode == 200;
    } catch (e) {
      print("Ollama 연결 실패: $e");
      return false;
    }
  }

  // 4. [새로 추가된 기능] 모델 목록 가져오기
  Future<List<String>> getAvailableModels() async {
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
      print("모델 목록 가져오기 실패: $e");
    }
    // 실패 시 기본값 반환
    return ['llama3', 'mistral', 'qwen2.5', 'gemma2'];
  }
}