import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/input/photo_text_extractor.dart';
import 'package:now_core/llm/base_llm_repository.dart';
import 'package:now_core/llm/llm_config.dart';
import 'package:now_core/llm/llm_image_input.dart';
import 'package:now_core/llm/llm_repository.dart';

/// 네트워크에 나가지 않는 가짜 provider.
///
/// 실제 API를 부르지 않고, 받은 프롬프트와 이미지를 기록한다.
class _FakeLlm extends BaseLlmRepository {
  _FakeLlm({
    required this.supportsImageInput,
    this.reply = '옮겨 적은 글자',
    this.failure,
    LlmProvider provider = LlmProvider.openAi,
  }) : config = LlmConfig(provider: provider, apiKey: 'test-key-not-real');

  @override
  final LlmConfig config;

  @override
  final bool supportsImageInput;

  final String reply;
  final Object? failure;

  String? lastPrompt;
  LlmImageInput? lastImage;

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) async {
    lastPrompt = prompt;
    lastImage = image;
    if (failure != null) throw failure!;
    return reply;
  }

  @override
  Future<String> chat(String prompt) async => reply;

  @override
  Future<List<LlmExtractedItem>> extractItems(
    List<String> segments, {
    String recordType = 'meeting',
    String participantName = '',
    bool includeSpeakerSeparation = false,
    bool includeVoiceEmotion = false,
  }) async =>
      const [];

  @override
  Future<bool> testConnection() async => true;
}

final _png = <int>[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x07];

DioException _badResponse(int status, {Object? body}) => DioException(
      requestOptions: RequestOptions(path: '/v1/chat/completions'),
      type: DioExceptionType.badResponse,
      response: Response(
        requestOptions: RequestOptions(path: '/v1/chat/completions'),
        statusCode: status,
        data: body,
      ),
    );

void main() {
  group('읽어낸 텍스트', () {
    test('LLM이 준 글자를 그대로 돌려준다', () async {
      final llm = _FakeLlm(supportsImageInput: true, reply: '  두부 3,000원\n콩나물 1,500원  ');
      final text = await PhotoTextExtractor(llm).extractFromBytes(_png);

      expect(text, '두부 3,000원\n콩나물 1,500원');
    });

    test('코드 블록으로 감싸 와도 벗겨 낸다', () async {
      final llm = _FakeLlm(
        supportsImageInput: true,
        reply: '```\n영수증\n합계 12,000원\n```',
      );
      final text = await PhotoTextExtractor(llm).extractFromBytes(_png);

      expect(text, '영수증\n합계 12,000원');
    });

    test('이미지와 프롬프트가 provider까지 그대로 간다', () async {
      final llm = _FakeLlm(supportsImageInput: true);
      await PhotoTextExtractor(llm).extractFromBytes(_png);

      expect(llm.lastImage!.bytes, _png);
      expect(llm.lastImage!.mimeType, 'image/png');
      expect(llm.lastPrompt, PhotoTextExtractor.transcriptionPrompt);
    });

    test('프롬프트는 옮겨 적기를 시키고 요약을 막는다', () {
      const prompt = PhotoTextExtractor.transcriptionPrompt;
      expect(prompt, contains('그대로 옮겨'));
      expect(prompt, contains('요약하거나 해석하지 마세요'));
      // 도메인 판정은 이 계층의 일이 아니다.
      expect(prompt, isNot(contains('살림')));
      expect(prompt, isNot(contains('confidence')));
    });

    test('글자를 못 찾으면 noText로 알린다', () async {
      final llm = _FakeLlm(supportsImageInput: true, reply: '   ');
      await expectLater(
        PhotoTextExtractor(llm).extractFromBytes(_png),
        throwsA(isA<PhotoTextExtractionException>()
            .having((e) => e.kind, 'kind', PhotoTextErrorKind.noText)),
      );
    });
  });

  group('미지원 provider', () {
    test('요청을 만들지 않고 미지원을 알린다', () async {
      final llm = _FakeLlm(
        supportsImageInput: false,
        provider: LlmProvider.deepSeek,
      );

      await expectLater(
        PhotoTextExtractor(llm).extractFromBytes(_png),
        throwsA(isA<PhotoTextExtractionException>().having(
          (e) => e.kind,
          'kind',
          PhotoTextErrorKind.providerUnsupported,
        )),
      );
      expect(llm.lastImage, isNull);
    });

    test('안내 문구에 고른 provider 이름이 들어간다', () async {
      final llm = _FakeLlm(
        supportsImageInput: false,
        provider: LlmProvider.deepSeek,
      );
      try {
        await PhotoTextExtractor(llm).extractFromBytes(_png);
        fail('예외가 나와야 한다');
      } on PhotoTextExtractionException catch (e) {
        expect(e.message, contains(LlmProvider.deepSeek.displayName));
        expect(e.isRetryable, isFalse);
      }
    });

    test('provider가 뒤늦게 미지원을 던져도 같은 종류로 바꾼다', () async {
      final llm = _FakeLlm(
        supportsImageInput: true,
        failure: LlmImageUnsupportedException(LlmProvider.grok),
      );
      await expectLater(
        PhotoTextExtractor(llm).extractFromBytes(_png),
        throwsA(isA<PhotoTextExtractionException>().having(
          (e) => e.kind,
          'kind',
          PhotoTextErrorKind.providerUnsupported,
        )),
      );
    });
  });

  group('크기 제한', () {
    test('상한을 넘으면 요청하지 않고 tooLarge로 알린다', () async {
      final llm = _FakeLlm(supportsImageInput: true);
      final bytes = List<int>.filled(PhotoTextExtractor.maxImageBytes + 1, 0)
        ..setRange(0, _png.length, _png);

      await expectLater(
        PhotoTextExtractor(llm).extractFromBytes(bytes),
        throwsA(isA<PhotoTextExtractionException>()
            .having((e) => e.kind, 'kind', PhotoTextErrorKind.imageTooLarge)),
      );
      expect(llm.lastImage, isNull);
    });

    test('상한과 같은 크기는 통과한다', () async {
      final llm = _FakeLlm(supportsImageInput: true);
      final bytes = List<int>.filled(PhotoTextExtractor.maxImageBytes, 0)
        ..setRange(0, _png.length, _png);

      await PhotoTextExtractor(llm).extractFromBytes(bytes);

      expect(llm.lastImage!.byteLength, PhotoTextExtractor.maxImageBytes);
    });

    test('서버가 413으로 거절해도 tooLarge로 알린다', () async {
      final llm = _FakeLlm(
        supportsImageInput: true,
        failure: _badResponse(413),
      );
      await expectLater(
        PhotoTextExtractor(llm).extractFromBytes(_png),
        throwsA(isA<PhotoTextExtractionException>()
            .having((e) => e.kind, 'kind', PhotoTextErrorKind.imageTooLarge)),
      );
    });

    test('읽을 수 없는 형식은 요청하지 않는다', () async {
      final llm = _FakeLlm(supportsImageInput: true);
      await expectLater(
        PhotoTextExtractor(llm).extractFromBytes(
          const [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          filePath: '/tmp/문서.pdf',
        ),
        throwsA(isA<PhotoTextExtractionException>().having(
          (e) => e.kind,
          'kind',
          PhotoTextErrorKind.unsupportedFormat,
        )),
      );
      expect(llm.lastImage, isNull);
    });
  });

  group('실패 종류 구분', () {
    test('설정이 비었으면 notConfigured', () async {
      final llm = _FakeLlm(
        supportsImageInput: true,
        failure: const LlmNotConfiguredException('Ollama 서버 주소를 설정에서 입력해 주세요'),
      );
      try {
        await PhotoTextExtractor(llm).extractFromBytes(_png);
        fail('예외가 나와야 한다');
      } on PhotoTextExtractionException catch (e) {
        expect(e.kind, PhotoTextErrorKind.notConfigured);
        expect(e.message, contains('Ollama'));
      }
    });

    test('401은 unauthorized', () async {
      final llm =
          _FakeLlm(supportsImageInput: true, failure: _badResponse(401));
      try {
        await PhotoTextExtractor(llm).extractFromBytes(_png);
        fail('예외가 나와야 한다');
      } on PhotoTextExtractionException catch (e) {
        expect(e.kind, PhotoTextErrorKind.unauthorized);
        expect(e.statusCode, 401);
        expect(e.message, contains('API 키'));
        expect(e.isRetryable, isFalse);
      }
    });

    test('연결 실패는 connectionFailed이고 다시 시도할 만하다', () async {
      final llm = _FakeLlm(
        supportsImageInput: true,
        failure: DioException(
          requestOptions: RequestOptions(path: '/v1/chat/completions'),
          type: DioExceptionType.connectionError,
        ),
      );
      try {
        await PhotoTextExtractor(llm).extractFromBytes(_png);
        fail('예외가 나와야 한다');
      } on PhotoTextExtractionException catch (e) {
        expect(e.kind, PhotoTextErrorKind.connectionFailed);
        expect(e.isRetryable, isTrue);
      }
    });

    test('시간 초과는 timeout', () async {
      final llm = _FakeLlm(
        supportsImageInput: true,
        failure: DioException(
          requestOptions: RequestOptions(path: '/v1/chat/completions'),
          type: DioExceptionType.receiveTimeout,
        ),
      );
      try {
        await PhotoTextExtractor(llm).extractFromBytes(_png);
        fail('예외가 나와야 한다');
      } on PhotoTextExtractionException catch (e) {
        expect(e.kind, PhotoTextErrorKind.timeout);
      }
    });

    test('400은 모델이 사진을 못 받는 경우를 함께 안내한다', () async {
      final llm = _FakeLlm(
        supportsImageInput: true,
        failure: _badResponse(400, body: 'model does not support images'),
      );
      try {
        await PhotoTextExtractor(llm).extractFromBytes(_png);
        fail('예외가 나와야 한다');
      } on PhotoTextExtractionException catch (e) {
        expect(e.kind, PhotoTextErrorKind.serverError);
        expect(e.message, contains('사진을 받는지'));
        expect(e.detail, contains('model does not support images'));
      }
    });

    test('응답 모양이 다르면 invalidResponse', () async {
      final llm = _FakeLlm(
        supportsImageInput: true,
        failure: TypeError(),
      );
      try {
        await PhotoTextExtractor(llm).extractFromBytes(_png);
        fail('예외가 나와야 한다');
      } on PhotoTextExtractionException catch (e) {
        expect(e.kind, PhotoTextErrorKind.invalidResponse);
      }
    });
  });
}
