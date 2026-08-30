import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/llm/llm_config.dart';
import 'package:now_core/llm/llm_repository.dart';
import 'package:now_core/llm/ollama_llm_repository.dart';

/// 나간 요청을 기록하고 정해진 답을 돌려주는 어댑터.
///
/// 주소가 비었을 때 "요청하지 않는다"를 확인하려면 실제로 나갔는지를 봐야 한다.
class _RecordingAdapter implements HttpClientAdapter {
  _RecordingAdapter({this.body = '{}'});

  final String body;
  final List<RequestOptions> requests = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      body,
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

OllamaLlmRepository _repo(String url, _RecordingAdapter adapter) {
  final repo = OllamaLlmRepository(
    LlmConfig(
      provider: LlmProvider.ollama,
      ollamaUrl: url,
      ollamaModel: 'llama3',
    ),
  );
  repo.dio.httpClientAdapter = adapter;
  return repo;
}

void main() {
  group('Ollama 주소가 비었을 때', () {
    late _RecordingAdapter adapter;

    setUp(() {
      adapter = _RecordingAdapter();
    });

    test('chat은 요청하지 않고 설정 안내를 던진다', () async {
      final repo = _repo('', adapter);

      await expectLater(
        repo.chat('안녕'),
        throwsA(
          isA<LlmNotConfiguredException>().having(
            (e) => e.message,
            'message',
            OllamaLlmRepository.missingServerMessage,
          ),
        ),
      );
      expect(adapter.requests, isEmpty);
    });

    test('extractItems도 요청하지 않고 설정 안내를 던진다', () async {
      final repo = _repo('   ', adapter);

      await expectLater(
        repo.extractItems(const ['오늘 회의 정리']),
        throwsA(isA<LlmNotConfiguredException>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('testConnection은 요청하지 않고 false를 준다', () async {
      final repo = _repo('', adapter);

      expect(await repo.testConnection(), isFalse);
      expect(adapter.requests, isEmpty);
    });

    test('getAvailableModels는 요청하지 않고 기본 목록을 준다', () async {
      final repo = _repo('', adapter);

      expect(
        await repo.getAvailableModels(),
        OllamaLlmRepository.fallbackModels,
      );
      expect(adapter.requests, isEmpty);
    });

    test('안내 문구는 사용자가 무엇을 해야 하는지 말해 준다', () {
      expect(
        OllamaLlmRepository.missingServerMessage,
        'Ollama 서버 주소를 설정에서 입력해 주세요',
      );
    });
  });

  group('Ollama 주소가 있을 때', () {
    test('chat은 설정한 주소의 OpenAI 호환 경로로 보낸다', () async {
      final adapter = _RecordingAdapter(
        body: jsonEncode({
          'choices': [
            {
              'message': {'content': '응답'},
            },
          ],
        }),
      );
      final repo = _repo('http://192.168.0.10:11434', adapter);

      expect(await repo.chat('안녕'), '응답');
      expect(adapter.requests, hasLength(1));
      expect(
        adapter.requests.single.uri.toString(),
        'http://192.168.0.10:11434/v1/chat/completions',
      );
    });

    test('끝에 붙은 슬래시나 /v1은 중복되지 않는다', () async {
      final adapter = _RecordingAdapter(
        body: jsonEncode({
          'data': [
            {'id': 'llama3'},
          ],
        }),
      );
      final repo = _repo('http://192.168.0.10:11434/v1/', adapter);

      expect(await repo.getAvailableModels(), ['llama3']);
      expect(
        adapter.requests.single.uri.toString(),
        'http://192.168.0.10:11434/v1/models',
      );
    });
  });
}
