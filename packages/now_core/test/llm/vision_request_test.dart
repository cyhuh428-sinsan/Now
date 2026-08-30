import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/llm/base_llm_repository.dart';
import 'package:now_core/llm/cloud_llm_repositories.dart';
import 'package:now_core/llm/llm_config.dart';
import 'package:now_core/llm/llm_image_input.dart';
import 'package:now_core/llm/llm_repository.dart';
import 'package:now_core/llm/ollama_llm_repository.dart';

/// 나간 요청의 **실제 본문 바이트**를 붙잡는 어댑터.
///
/// `RequestOptions.data`가 아니라 직렬화된 스트림을 읽는다. 그래야 이미지가
/// 정말 요청에 실려 나갔는지를 확인할 수 있다.
class _BodyCapturingAdapter implements HttpClientAdapter {
  _BodyCapturingAdapter(this.responseBody);

  final String responseBody;
  final List<RequestOptions> requests = [];
  final List<String> bodies = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (requestStream != null) {
      final chunks = await requestStream.toList();
      bodies.add(utf8.decode(chunks.expand((c) => c).toList()));
    } else {
      bodies.add('');
    }
    return ResponseBody.fromString(
      responseBody,
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}

  Map<String, dynamic> get lastJsonBody =>
      jsonDecode(bodies.last) as Map<String, dynamic>;
}

/// OpenAI 호환 응답 한 벌.
const _openAiStyleResponse =
    '{"choices":[{"message":{"content":"영수증에 적힌 글자"}}]}';

/// 서명만 맞춘 최소 PNG 바이트.
final _png = <int>[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x01, 0x02];

LlmImageInput _image() => LlmImageInput.fromBytes(_png);

T _wire<T extends BaseLlmRepository>(T repo, _BodyCapturingAdapter adapter) {
  repo.dio.httpClientAdapter = adapter;
  return repo;
}

LlmConfig _cloud(LlmProvider provider) =>
    LlmConfig(provider: provider, apiKey: 'test-key-not-real');

void main() {
  group('이미지를 받는 provider', () {
    test('OpenAI는 content 배열에 data URL을 실어 보낸다', () async {
      final adapter = _BodyCapturingAdapter(_openAiStyleResponse);
      final repo = _wire(OpenAiLlmRepository(_cloud(LlmProvider.openAi)), adapter);
      final image = _image();

      expect(repo.supportsImageInput, isTrue);
      final text = await repo.chatWithImage('글자를 옮겨 적어라', image);

      expect(text, '영수증에 적힌 글자');
      expect(adapter.requests.single.path,
          'https://api.openai.com/v1/chat/completions');

      final content =
          adapter.lastJsonBody['messages'][0]['content'] as List<dynamic>;
      final imagePart = content.firstWhere((p) => p['type'] == 'image_url');
      expect(imagePart['image_url']['url'], image.dataUrl);
      expect(imagePart['image_url']['url'], contains(image.base64Data));
    });

    test('Groq는 사진용 멀티모달 모델로 data URL을 실어 보낸다', () async {
      final adapter = _BodyCapturingAdapter(_openAiStyleResponse);
      final repo = _wire(GroqLlmRepository(_cloud(LlmProvider.groq)), adapter);
      final image = _image();

      expect(repo.supportsImageInput, isTrue);
      await repo.chatWithImage('글자를 옮겨 적어라', image);

      final body = adapter.lastJsonBody;
      // 텍스트 경로가 쓰는 llama-3.3-70b는 이미지를 받지 못한다.
      expect(body['model'], GroqLlmRepository.visionModel);
      expect(body['model'], isNot('llama-3.3-70b-versatile'));

      final content = body['messages'][0]['content'] as List<dynamic>;
      expect(
        content.firstWhere((p) => p['type'] == 'image_url')['image_url']['url'],
        image.dataUrl,
      );
    });

    test('Gemini는 parts의 inline_data에 순수 base64를 넣는다', () async {
      final adapter = _BodyCapturingAdapter(
        '{"candidates":[{"content":{"parts":[{"text":"영수증에 적힌 글자"}]}}]}',
      );
      final repo =
          _wire(GeminiLlmRepository(_cloud(LlmProvider.gemini)), adapter);
      final image = _image();

      expect(repo.supportsImageInput, isTrue);
      final text = await repo.chatWithImage('글자를 옮겨 적어라', image);

      expect(text, '영수증에 적힌 글자');
      expect(adapter.requests.single.path,
          contains('models/${GeminiLlmRepository.visionModel}:generateContent'));

      final parts =
          adapter.lastJsonBody['contents'][0]['parts'] as List<dynamic>;
      final inline = parts.firstWhere((p) => p['inline_data'] != null);
      expect(inline['inline_data']['mime_type'], 'image/png');
      expect(inline['inline_data']['data'], image.base64Data);
      // data URL 접두사가 붙으면 Gemini는 base64를 해석하지 못한다.
      expect(inline['inline_data']['data'], isNot(contains('data:')));
    });

    test('Claude는 image 블록의 source에 base64를 넣고 텍스트보다 앞에 둔다', () async {
      final adapter =
          _BodyCapturingAdapter('{"content":[{"text":"영수증에 적힌 글자"}]}');
      final repo =
          _wire(ClaudeLlmRepository(_cloud(LlmProvider.claude)), adapter);
      final image = _image();

      expect(repo.supportsImageInput, isTrue);
      final text = await repo.chatWithImage('글자를 옮겨 적어라', image);

      expect(text, '영수증에 적힌 글자');
      final content =
          adapter.lastJsonBody['messages'][0]['content'] as List<dynamic>;
      expect(content.first['type'], 'image');
      expect(content.first['source']['type'], 'base64');
      expect(content.first['source']['media_type'], 'image/png');
      expect(content.first['source']['data'], image.base64Data);
      expect(content.last['type'], 'text');
    });

    test('Ollama는 OpenAI 호환 형태로 data URL을 실어 보낸다', () async {
      final adapter = _BodyCapturingAdapter(_openAiStyleResponse);
      final repo = _wire(
        OllamaLlmRepository(const LlmConfig(
          provider: LlmProvider.ollama,
          ollamaUrl: 'http://localhost:11434',
          ollamaModel: 'test-vision-model',
        )),
        adapter,
      );
      final image = _image();

      expect(repo.supportsImageInput, isTrue);
      await repo.chatWithImage('글자를 옮겨 적어라', image);

      final body = adapter.lastJsonBody;
      expect(body['model'], 'test-vision-model');
      final content = body['messages'][0]['content'] as List<dynamic>;
      expect(
        content.firstWhere((p) => p['type'] == 'image_url')['image_url']['url'],
        image.dataUrl,
      );
    });

    test('Ollama 주소가 비었으면 사진 요청을 만들지 않는다', () async {
      final adapter = _BodyCapturingAdapter(_openAiStyleResponse);
      final repo = _wire(
        OllamaLlmRepository(const LlmConfig(
          provider: LlmProvider.ollama,
          ollamaModel: 'test-vision-model',
        )),
        adapter,
      );

      await expectLater(
        repo.chatWithImage('글자를 옮겨 적어라', _image()),
        throwsA(isA<LlmNotConfiguredException>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('이미지가 요청 바이트에 실제로 들어간다', () async {
      final adapter = _BodyCapturingAdapter(_openAiStyleResponse);
      final repo = _wire(OpenAiLlmRepository(_cloud(LlmProvider.openAi)), adapter);
      final image = _image();

      await repo.chatWithImage('글자를 옮겨 적어라', image);

      // 직렬화된 본문 문자열 안에 base64가 그대로 들어 있어야 한다.
      expect(adapter.bodies.single, contains(image.base64Data));
    });
  });

  group('이미지를 받지 못하는 provider', () {
    test('DeepSeek은 요청하지 않고 미지원을 알린다', () async {
      final adapter = _BodyCapturingAdapter(_openAiStyleResponse);
      final repo =
          _wire(DeepSeekLlmRepository(_cloud(LlmProvider.deepSeek)), adapter);

      expect(repo.supportsImageInput, isFalse);
      await expectLater(
        repo.chatWithImage('글자를 옮겨 적어라', _image()),
        throwsA(isA<LlmImageUnsupportedException>().having(
          (e) => e.provider,
          'provider',
          LlmProvider.deepSeek,
        )),
      );
      expect(adapter.requests, isEmpty);
    });

    test('Grok은 요청하지 않고 미지원을 알린다', () async {
      final adapter = _BodyCapturingAdapter(_openAiStyleResponse);
      final repo = _wire(GrokLlmRepository(_cloud(LlmProvider.grok)), adapter);

      expect(repo.supportsImageInput, isFalse);
      await expectLater(
        repo.chatWithImage('글자를 옮겨 적어라', _image()),
        throwsA(isA<LlmImageUnsupportedException>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('미지원 안내에 고른 provider 이름이 들어간다', () {
      final message = LlmImageUnsupportedException(LlmProvider.grok).message;
      expect(message, contains(LlmProvider.grok.displayName));
      expect(message, contains('사진'));
    });
  });

  group('텍스트 경로', () {
    test('chat은 이미지 지원 여부와 무관하게 그대로 돈다', () async {
      final adapter = _BodyCapturingAdapter(_openAiStyleResponse);
      final repo =
          _wire(DeepSeekLlmRepository(_cloud(LlmProvider.deepSeek)), adapter);

      final text = await repo.chat('안녕');

      expect(text, '영수증에 적힌 글자');
      expect(adapter.lastJsonBody['messages'][0]['content'], '안녕');
    });
  });
}
