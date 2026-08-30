/// 질문, 앞선 대화, 메모 맥락을 하나의 프롬프트로 합친다.
///
/// [LlmRepository.chat]은 문자열 하나만 받는다. provider마다 대화 배열의
/// 모양이 달라 새 provider를 만들지 않는 한 역할별 배열을 보낼 수 없다.
/// 그래서 앞선 대화를 이 계층에서 글로 풀어 한 덩어리로 만든다.
library;

import 'ask_conversation.dart';
import 'ask_exception.dart';
import 'ask_limits.dart';
import 'ask_note_context.dart';

/// 합쳐진 프롬프트와, 실제로 실려 나간 것들.
class AskPrompt {
  const AskPrompt({
    required this.text,
    required this.history,
    required this.noteContext,
    required this.historyDropped,
    required this.contextShortened,
  });

  /// LLM에 보낼 문자열.
  final String text;

  /// 실제로 실려 나간 앞선 대화. 상한에 걸려 줄어든 뒤의 값이다.
  final AskConversation history;

  /// 실제로 실려 나간 메모 맥락. 붙이지 않았으면 null이다.
  final AskNoteContext? noteContext;

  /// 상한에 걸려 덜어 낸 발언 수.
  final int historyDropped;

  /// 상한에 걸려 맥락을 더 줄였는지.
  final bool contextShortened;

  int get charCount => text.length;

  @override
  String toString() => 'AskPrompt(${text.length}자, 대화 ${history.length}개'
      '${noteContext == null ? '' : ', 맥락 있음'})';
}

/// 프롬프트를 만든다.
class AskPromptBuilder {
  const AskPromptBuilder({this.limits = const AskLimits()});

  final AskLimits limits;

  /// 모델에게 주는 지시문.
  ///
  /// 메모 도우미 성격으로 쓴다. 사용자는 글을 쓰다 잠깐 묻는 것이지 대화를
  /// 즐기려는 것이 아니다. 그래서 길이를 묶고, 되묻지 않게 하고, 참고로 준
  /// 메모를 다시 읊지 않게 한다.
  ///
  /// 제품 이름, 화면 이름, 클래스 이름, 서버 주소를 넣지 않는다. 프롬프트는
  /// 외부 서버로 나가고 답변에 그대로 되비쳐 나오기도 한다. 이 규칙은
  /// 테스트로 고정해 둔다.
  static const String instruction = '''
당신은 메모를 쓰는 사람 옆에서 짧게 거들어 주는 조수입니다.
사용자는 글을 쓰다 잠깐 멈추고 궁금한 것을 물었습니다. 대화를 나누려는 것이 아닙니다.

[답하는 방식]
- 사용자가 쓴 언어로 답합니다.
- 짧게 답합니다. 기본은 세 문장 이내입니다. 나열이 꼭 필요하면 다섯 항목까지만 씁니다.
- 인사, 사과, 되묻기, 마무리 문장을 붙이지 않습니다. 답만 씁니다.
- "아래에 정리했습니다" 같은 안내 문장을 쓰지 않습니다. 바로 내용부터 씁니다.
- 참고로 받은 메모를 다시 옮겨 적거나 요약해 되풀이하지 않습니다.
  메모는 질문을 이해하기 위한 배경일 뿐이고, 사용자는 그 내용을 이미 알고 있습니다.
- 답은 사용자의 메모에 그대로 붙여 넣을 수 있는 문장이어야 합니다.
- 모르면 모른다고 한 문장으로 말합니다. 지어내지 않습니다.
- 확실하지 않은 사실은 확실하지 않다고 밝힙니다.
- 묻지 않은 조언이나 추가 제안을 덧붙이지 않습니다.''';

  /// 참고 메모 절의 머리.
  static const String contextHeading = '[참고 메모]';

  /// 앞선 대화 절의 머리.
  static const String historyHeading = '[앞선 대화]';

  /// 이번 질문 절의 머리.
  static const String questionHeading = '[질문]';

  /// 맥락을 줄여 보낼 때 덧붙이는 한 줄.
  static const String truncatedNotice =
      '(이 메모는 길어서 일부만 옮겼습니다. 옮기지 않은 부분이 있으니 "메모에 그런 내용이 없다"고 단정하지 마세요.)';

  /// 프롬프트를 만든다.
  ///
  /// 상한을 넘으면 아래 순서로 줄인다.
  ///
  /// 1. 앞선 대화를 오래된 것부터 덜어 낸다.
  /// 2. 그래도 넘으면 메모 맥락을 더 줄인다.
  ///
  /// 이번 질문은 건드리지 않는다. 사용자가 방금 친 문장이고, 그것을 자르면
  /// 묻지 않은 것에 답이 온다. 대화를 맥락보다 먼저 버리는 이유는, 지금
  /// 보고 있는 메모가 질문이 나온 이유이고 옛 대화는 곁가지이기 때문이다.
  ///
  /// 질문이 비었거나 너무 길면, 잠긴 메모의 암호문이 섞여 있으면
  /// [AskException]을 던진다.
  AskPrompt build({
    required String question,
    AskConversation conversation = const AskConversation.empty(),
    AskNoteContext? noteContext,
  }) {
    final trimmedQuestion = question.trim();
    if (trimmedQuestion.isEmpty) {
      throw AskException(
        kind: AskErrorKind.emptyQuestion,
        message: '무엇을 물을지 입력해 주세요.',
      );
    }
    if (trimmedQuestion.length > limits.maxQuestionChars) {
      throw AskException(
        kind: AskErrorKind.questionTooLong,
        message: '질문이 너무 깁니다. ${limits.maxQuestionChars}자 안으로 줄여 주세요.',
        detail: '${trimmedQuestion.length}자',
      );
    }
    // 암호문을 질문에 붙여 넣은 경우도 막는다. 맥락만 막으면 새어 나갈 길이
    // 남는다.
    AskNoteContext.assertNotEncrypted(trimmedQuestion, what: '질문');

    var history = conversation.trimmed(limits);
    var context = noteContext;
    var contextShortened = false;

    var text = _assemble(
      question: trimmedQuestion,
      history: history,
      context: context,
    );

    // 1) 앞선 대화를 오래된 것부터 덜어 낸다.
    while (text.length > limits.maxPromptChars && history.isNotEmpty) {
      history = history.dropOldestTurn();
      text = _assemble(
        question: trimmedQuestion,
        history: history,
        context: context,
      );
    }

    // 2) 그래도 넘으면 맥락을 더 줄인다.
    while (text.length > limits.maxPromptChars &&
        context != null &&
        context.body.length > limits.minContextChars) {
      final next = (context.body.length ~/ 2)
          .clamp(limits.minContextChars, context.body.length - 1);
      context = context.shortenedTo(next);
      contextShortened = true;
      text = _assemble(
        question: trimmedQuestion,
        history: history,
        context: context,
      );
    }

    return AskPrompt(
      text: text,
      history: history,
      noteContext: context,
      historyDropped: conversation.length - history.length,
      contextShortened: contextShortened,
    );
  }

  String _assemble({
    required String question,
    required AskConversation history,
    required AskNoteContext? context,
  }) {
    final parts = <String>[instruction];

    if (context != null && !context.isEmpty) {
      final buffer = StringBuffer()
        ..writeln(contextHeading)
        ..writeln('제목: ${context.title}');
      if (context.body.isNotEmpty) {
        buffer.writeln(context.body);
      }
      if (context.truncated) {
        buffer.writeln(truncatedNotice);
      }
      parts.add(buffer.toString().trimRight());
    }

    if (history.isNotEmpty) {
      final buffer = StringBuffer()..writeln(historyHeading);
      for (final message in history.messages) {
        final label = message.role == AskRole.user ? '질문' : '답변';
        buffer.writeln('$label: ${message.text}');
      }
      parts.add(buffer.toString().trimRight());
    }

    parts.add('$questionHeading\n$question');
    return parts.join('\n\n');
  }
}
