import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/ask/ask_conversation.dart';
import 'package:now_core/ask/ask_exception.dart';
import 'package:now_core/ask/ask_limits.dart';
import 'package:now_core/ask/ask_note_context.dart';
import 'package:now_core/ask/ask_prompt.dart';
import 'package:now_core/ask/ask_service.dart';
import 'package:now_core/llm/base_llm_repository.dart';
import 'package:now_core/llm/llm_config.dart';
import 'package:now_core/llm/llm_image_input.dart';
import 'package:now_core/llm/llm_repository.dart';
import 'package:now_core/notes/note_content.dart';

/// 네트워크에 나가지 않는 가짜 provider.
///
/// 받은 프롬프트를 기록만 한다. 실제 키나 주소를 쓰지 않는다.
class _FakeLlm extends BaseLlmRepository {
  _FakeLlm({
    this.reply = '짧은 답',
    this.failure,
    LlmConfig? config,
  }) : config = config ??
            const LlmConfig(
              provider: LlmProvider.openAi,
              apiKey: 'test-key-not-real',
            );

  @override
  final LlmConfig config;

  final String reply;
  final Object? failure;

  final List<String> prompts = <String>[];

  @override
  Future<String> chat(String prompt) async {
    prompts.add(prompt);
    if (failure != null) throw failure!;
    return reply;
  }

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) async =>
      reply;

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
  group('묻기 실행', () {
    test('답을 앞뒤 공백만 떼고 돌려준다', () async {
      final llm = _FakeLlm(reply: '  두 문장으로 답한다.  ');
      final result = await AskService(llm).ask(question: '뭐라고?');

      expect(result.answer, '두 문장으로 답한다.');
    });

    test('보낸 프롬프트에 질문이 들어 있다', () async {
      final llm = _FakeLlm();
      await AskService(llm).ask(question: '이게 무슨 뜻이지?');

      expect(llm.prompts.single, contains('이게 무슨 뜻이지?'));
      expect(llm.prompts.single, contains(AskPromptBuilder.instruction));
    });

    test('설정이 비어 있으면 요청을 만들지 않는다', () async {
      final llm = _FakeLlm(
        config: const LlmConfig(provider: LlmProvider.openAi, apiKey: ''),
      );

      await expectLater(
        AskService(llm).ask(question: '질문'),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.notConfigured),
        ),
      );
      expect(llm.prompts, isEmpty);
    });

    test('빈 답이 오면 실패로 본다', () async {
      final llm = _FakeLlm(reply: '   ');

      await expectLater(
        AskService(llm).ask(question: '질문'),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.emptyAnswer),
        ),
      );
    });
  });

  group('대화 이어짐', () {
    test('돌려준 대화에 이번 질문과 답이 더해진다', () async {
      final llm = _FakeLlm(reply: '첫 답');
      final result = await AskService(llm).ask(question: '첫 질문');

      expect(result.conversation.length, 2);
      expect(result.conversation.messages.first.text, '첫 질문');
      expect(result.conversation.messages.last.text, '첫 답');
    });

    test('후속 질문에는 앞선 대화가 함께 나간다', () async {
      final llm = _FakeLlm(reply: '둘째 답');
      final service = AskService(llm);

      final first = AskResult(
        answer: '첫 답',
        conversation: const AskConversation.empty()
            .appendTurn(question: '첫 질문', answer: '첫 답'),
        prompt: const AskPromptBuilder().build(question: '첫 질문'),
      );

      final second = await service.ask(
        question: '둘째 질문',
        conversation: first.conversation,
      );

      expect(llm.prompts.single, contains('첫 질문'));
      expect(llm.prompts.single, contains('첫 답'));
      expect(llm.prompts.single, contains('둘째 질문'));
      expect(second.conversation.length, 4);
    });

    test('실패하면 그 질문이 대화에 남지 않는다', () async {
      final llm = _FakeLlm(failure: _badResponse(500));
      final before = const AskConversation.empty()
          .appendTurn(question: '첫 질문', answer: '첫 답');

      await expectLater(
        AskService(llm).ask(question: '실패할 질문', conversation: before),
        throwsA(isA<AskException>()),
      );
      expect(before.length, 2);
      expect(
        before.messages.any((m) => m.text == '실패할 질문'),
        isFalse,
      );
    });

    test('길이 때문에 덜어 낸 앞부분도 돌려준 대화에는 남아 있다', () async {
      const tight = AskLimits(maxHistoryMessages: 2, maxPromptChars: 100000);
      final llm = _FakeLlm(reply: '새 답');

      var conversation = const AskConversation.empty();
      for (var i = 0; i < 5; i++) {
        conversation =
            conversation.appendTurn(question: '$i번 질문', answer: '$i번 답');
      }

      final result = await AskService(llm, limits: tight)
          .ask(question: '새 질문', conversation: conversation);

      expect(result.prompt.history.length, 2);
      expect(llm.prompts.single, isNot(contains('0번 질문')));
      expect(result.conversation.length, 12);
      expect(result.conversation.messages.first.text, '0번 질문');
    });
  });

  group('맥락 붙이기', () {
    test('맥락을 넘긴 때만 메모가 나간다', () async {
      final llm = _FakeLlm();
      final service = AskService(llm);

      await service.ask(question: '맥락 없이');
      expect(llm.prompts.last, isNot(contains('장보기')));

      await service.ask(
        question: '맥락 붙여',
        noteContext:
            AskNoteContext.fromNote(title: '장보기', body: '두부 한 모'),
      );
      expect(llm.prompts.last, contains('장보기'));
      expect(llm.prompts.last, contains('두부 한 모'));
    });
  });

  group('잠긴 메모 차단', () {
    test('암호문이 든 맥락은 만들 때 막힌다', () {
      expect(
        () => AskNoteContext.fromNote(
          title: '잠긴 메모',
          body: '${encryptedNotePrefix}QUJD',
        ),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.lockedNote),
        ),
      );
    });

    test('질문에 암호문이 섞여 있으면 요청이 나가지 않는다', () async {
      final llm = _FakeLlm();

      await expectLater(
        AskService(llm)
            .ask(question: '이거 뭐야 ${encryptedNotePrefix}QUJDREVG'),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.lockedNote),
        ),
      );
      expect(llm.prompts, isEmpty);
    });
  });

  group('길이 초과 처리', () {
    test('질문이 상한을 넘으면 요청이 나가지 않는다', () async {
      final llm = _FakeLlm();

      await expectLater(
        AskService(llm, limits: const AskLimits(maxQuestionChars: 50))
            .ask(question: '가' * 100),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.questionTooLong),
        ),
      );
      expect(llm.prompts, isEmpty);
    });

    test('맥락과 대화가 길어도 프롬프트는 상한 안이다', () async {
      const tight = AskLimits(
        maxQuestionChars: 100,
        maxContextChars: 400,
        maxPromptChars: 1200,
        minContextChars: 100,
      );
      final llm = _FakeLlm();

      var conversation = const AskConversation.empty();
      for (var i = 0; i < 30; i++) {
        conversation = conversation.appendTurn(
          question: '$i번 질문 ${'가' * 40}',
          answer: '$i번 답 ${'나' * 40}',
        );
      }

      final result = await AskService(llm, limits: tight).ask(
        question: '마지막 질문',
        conversation: conversation,
        noteContext: AskNoteContext.fromNote(
          title: '긴 메모',
          body: '다' * 5000,
          limits: tight,
        ),
      );

      expect(llm.prompts.single.length, lessThanOrEqualTo(1200));
      expect(llm.prompts.single, contains('마지막 질문'));
      expect(result.prompt.historyDropped, greaterThan(0));
    });
  });

  group('실패 이유 구분', () {
    Future<AskException> failWith(Object error) async {
      try {
        await AskService(_FakeLlm(failure: error)).ask(question: '질문');
      } on AskException catch (e) {
        return e;
      }
      fail('예외가 나오지 않았다');
    }

    test('401은 인증 실패다', () async {
      final error = await failWith(_badResponse(401));
      expect(error.kind, AskErrorKind.unauthorized);
      expect(error.isRetryable, isFalse);
    });

    test('타임아웃은 다시 시도할 수 있다', () async {
      final error = await failWith(DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.receiveTimeout,
      ));
      expect(error.kind, AskErrorKind.timeout);
      expect(error.isRetryable, isTrue);
    });

    test('연결 실패를 구분한다', () async {
      final error = await failWith(DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.connectionError,
      ));
      expect(error.kind, AskErrorKind.connectionFailed);
    });

    test('설정 없음 예외를 그대로 옮긴다', () async {
      final error =
          await failWith(const LlmNotConfiguredException('서버 주소를 넣어 주세요.'));
      expect(error.kind, AskErrorKind.notConfigured);
      expect(error.message, '서버 주소를 넣어 주세요.');
    });

    test('응답 모양이 다르면 응답 이상으로 본다', () async {
      final error = await failWith(TypeError());
      expect(error.kind, AskErrorKind.invalidResponse);
    });

    test('413은 너무 길다고 알려 준다', () async {
      final error = await failWith(_badResponse(413));
      expect(error.kind, AskErrorKind.serverError);
      expect(error.message, contains('너무 길어'));
    });

    test('안내 문구는 한국어이고 원인 예외 문자열이 새어 나가지 않는다', () async {
      final error = await failWith(_badResponse(500, body: 'internal detail'));
      expect(error.message, isNot(contains('internal detail')));
      expect(error.detail, contains('internal detail'));
      expect(RegExp(r'[가-힣]').hasMatch(error.message), isTrue);
    });
  });

  group('메모에 넣을 문자열', () {
    test('출처에 provider 이름이 들어간다', () {
      final service = AskService(_FakeLlm());
      final block = service.insertionBlock('답 본문', question: '질문');

      expect(block, contains('출처: ${LlmProvider.openAi.displayName}'));
      expect(block, endsWith('답 본문'));
    });

    test('출처에 키나 주소가 들어가지 않는다', () {
      final service = AskService(_FakeLlm(
        config: const LlmConfig(
          provider: LlmProvider.ollama,
          ollamaUrl: 'http://example.invalid:11434',
          ollamaModel: 'some-model',
        ),
      ));
      final block = service.insertionBlock('답', question: '질문');

      expect(block, isNot(contains('example.invalid')));
      expect(block, isNot(contains('some-model')));
      expect(block, contains(LlmProvider.ollama.displayName));
    });
  });
}
