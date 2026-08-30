import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/ask/ask_conversation.dart';
import 'package:now_core/ask/ask_exception.dart';
import 'package:now_core/ask/ask_limits.dart';
import 'package:now_core/ask/ask_note_context.dart';
import 'package:now_core/ask/ask_prompt.dart';
import 'package:now_core/notes/note_content.dart';

/// 프롬프트에 새어 나가면 안 되는 말.
///
/// 제품 이름, 화면 이름, 패키지 이름, provider 이름, 서버 주소가 여기 든다.
const _forbidden = <String>[
  'NowNote',
  'now_core',
  'now_app',
  'LlmChatPage',
  'LlmRepository',
  'AskService',
  'LLM',
  'Ollama',
  'OpenAI',
  'Gemini',
  'Groq',
  'DeepSeek',
  'drift',
  'Riverpod',
  'http',
  '://',
  '.com',
  '.co.kr',
  '@',
];

void main() {
  const builder = AskPromptBuilder();

  group('프롬프트 지시문', () {
    test('앱 내부 용어나 주소가 들어 있지 않다', () {
      for (final term in _forbidden) {
        expect(
          AskPromptBuilder.instruction.toLowerCase(),
          isNot(contains(term.toLowerCase())),
          reason: '"$term"이(가) 프롬프트에 들어갔다',
        );
      }
    });

    test('지시문에 로마자가 하나도 없다', () {
      expect(
        RegExp(r'[A-Za-z]').hasMatch(AskPromptBuilder.instruction),
        isFalse,
        reason: '로마자가 없으면 제품 이름과 클래스 이름도 들어갈 수 없다',
      );
    });

    test('메모 도우미 성격과 길이 제한을 담고 있다', () {
      expect(AskPromptBuilder.instruction, contains('메모'));
      expect(AskPromptBuilder.instruction, contains('짧게'));
      expect(AskPromptBuilder.instruction, contains('세 문장'));
    });

    test('참고 메모를 되풀이하지 말라고 못 박는다', () {
      expect(AskPromptBuilder.instruction, contains('되풀이하지'));
    });

    test('한국어 입력만 넣으면 완성된 프롬프트에도 로마자가 없다', () {
      final prompt = builder.build(
        question: '이거 무슨 뜻이지?',
        conversation: const AskConversation.empty()
            .appendTurn(question: '앞 질문', answer: '앞 답'),
        noteContext:
            AskNoteContext.fromNote(title: '메모 제목', body: '메모 본문 한 줄'),
      );

      expect(RegExp(r'[A-Za-z]').hasMatch(prompt.text), isFalse);
    });
  });

  group('맥락 붙이기', () {
    test('맥락을 넘기면 제목과 본문이 함께 나간다', () {
      final prompt = builder.build(
        question: '이 중에 뭘 먼저 사야 해?',
        noteContext:
            AskNoteContext.fromNote(title: '장보기', body: '두부 한 모\n콩나물 한 봉'),
      );

      expect(prompt.text, contains(AskPromptBuilder.contextHeading));
      expect(prompt.text, contains('제목: 장보기'));
      expect(prompt.text, contains('콩나물 한 봉'));
      expect(prompt.noteContext, isNotNull);
    });

    test('맥락을 넘기지 않으면 붙이지 않는다', () {
      final prompt = builder.build(question: '오늘 며칠이지?');

      expect(prompt.text, isNot(contains(AskPromptBuilder.contextHeading)));
      expect(prompt.noteContext, isNull);
    });

    test('줄여 보낼 때는 잘렸다는 것을 밝힌다', () {
      final prompt = builder.build(
        question: '정리해 줘',
        noteContext: AskNoteContext.fromNote(
          title: '긴 메모',
          body: '가' * 5000,
          limits: const AskLimits(maxContextChars: 300),
        ),
      );

      expect(prompt.text, contains(AskPromptBuilder.truncatedNotice));
    });

    test('질문은 언제나 맨 뒤에 온다', () {
      final prompt = builder.build(
        question: '마지막에 오는 질문',
        conversation: const AskConversation.empty()
            .appendTurn(question: '앞 질문', answer: '앞 답'),
        noteContext: AskNoteContext.fromNote(title: '제목', body: '본문'),
      );

      expect(prompt.text.trimRight(), endsWith('마지막에 오는 질문'));
      expect(
        prompt.text.indexOf(AskPromptBuilder.questionHeading),
        greaterThan(prompt.text.indexOf(AskPromptBuilder.historyHeading)),
      );
    });
  });

  group('대화 이어짐', () {
    test('앞선 대화를 질문과 함께 보낸다', () {
      final conversation = const AskConversation.empty()
          .appendTurn(question: '된장찌개에 뭐 넣지?', answer: '두부와 애호박을 넣는다.')
          .appendTurn(question: '두부는 어떤 걸로?', answer: '찌개용 부드러운 두부가 맞다.');

      final prompt =
          builder.build(question: '그럼 얼마나 끓여?', conversation: conversation);

      expect(prompt.text, contains(AskPromptBuilder.historyHeading));
      expect(prompt.text, contains('질문: 된장찌개에 뭐 넣지?'));
      expect(prompt.text, contains('답변: 찌개용 부드러운 두부가 맞다.'));
      expect(prompt.text, contains('그럼 얼마나 끓여?'));
    });

    test('첫 질문이면 앞선 대화 절이 없다', () {
      final prompt = builder.build(question: '처음 묻는다');
      expect(prompt.text, isNot(contains(AskPromptBuilder.historyHeading)));
    });

    test('앞선 대화의 순서가 유지된다', () {
      final conversation = const AskConversation.empty()
          .appendTurn(question: '첫째', answer: '첫째 답')
          .appendTurn(question: '둘째', answer: '둘째 답');

      final prompt = builder.build(question: '셋째', conversation: conversation);

      expect(prompt.text.indexOf('첫째'),
          lessThan(prompt.text.indexOf('둘째')));
    });
  });

  group('길이 초과 처리', () {
    const tight = AskLimits(
      maxQuestionChars: 100,
      maxContextChars: 300,
      maxHistoryChars: 100000,
      maxHistoryMessages: 1000,
      maxPromptChars: 1200,
      minContextChars: 100,
    );
    const tightBuilder = AskPromptBuilder(limits: tight);

    AskConversation longConversation() {
      var conversation = const AskConversation.empty();
      for (var i = 0; i < 30; i++) {
        conversation = conversation.appendTurn(
          question: '$i번째 질문 ${'가' * 40}',
          answer: '$i번째 답 ${'나' * 40}',
        );
      }
      return conversation;
    }

    test('상한을 넘지 않게 앞선 대화를 덜어 낸다', () {
      final prompt = tightBuilder.build(
        question: '마지막 질문',
        conversation: longConversation(),
      );

      expect(prompt.text.length, lessThanOrEqualTo(tight.maxPromptChars));
      expect(prompt.historyDropped, greaterThan(0));
      expect(prompt.text, contains('마지막 질문'));
    });

    test('덜어 내도 가장 최근 대화는 남는다', () {
      final conversation = longConversation();
      final prompt = tightBuilder.build(
        question: '마지막 질문',
        conversation: conversation,
      );

      expect(prompt.history.isNotEmpty, isTrue);
      expect(prompt.history.messages.last.text,
          conversation.messages.last.text);
    });

    test('맥락보다 앞선 대화를 먼저 버린다', () {
      final prompt = tightBuilder.build(
        question: '마지막 질문',
        conversation: longConversation(),
        noteContext: AskNoteContext.fromNote(
          title: '보고 있는 메모',
          body: '지금 쓰던 내용',
          limits: tight,
        ),
      );

      expect(prompt.historyDropped, greaterThan(0));
      expect(prompt.text, contains('지금 쓰던 내용'));
    });

    test('대화를 다 버려도 넘치면 맥락을 더 줄인다', () {
      final prompt = tightBuilder.build(
        question: '마지막 질문',
        noteContext: AskNoteContext.fromNote(
          title: '아주 긴 메모',
          body: '가' * 5000,
          limits: const AskLimits(maxContextChars: 3000),
        ),
      );

      expect(prompt.contextShortened, isTrue);
      expect(prompt.text.length, lessThanOrEqualTo(tight.maxPromptChars));
    });

    test('질문 자체는 자르지 않고 막는다', () {
      expect(
        () => tightBuilder.build(question: '가' * 200),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.questionTooLong),
        ),
      );
    });

    test('빈 질문은 요청을 만들지 않는다', () {
      expect(
        () => builder.build(question: '   '),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.emptyQuestion),
        ),
      );
    });
  });

  group('잠긴 메모 차단', () {
    test('질문에 암호문을 붙여 넣어도 막는다', () {
      expect(
        () => builder.build(question: '이거 뭐야 ${encryptedNotePrefix}QUJD'),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.lockedNote),
        ),
      );
    });
  });
}
