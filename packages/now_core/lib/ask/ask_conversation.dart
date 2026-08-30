/// 묻기 대화 상태.
///
/// 메모리에만 둔다. 저장하지 않는다. 화면을 닫으면 사라진다.
/// 메모에 넣은 답만 남고 대화 자체는 남기지 않는 것이 이 기능의 기준이다.
///
/// 값 객체로 만든다. 더하면 새 [AskConversation]이 나온다. 화면이 상태로
/// 들고 있다가 새 값으로 갈아 끼우면 되고, 요청이 실패했을 때 옛 값을 그대로
/// 두면 실패한 질문이 대화에 남지 않는다.
library;

import 'ask_limits.dart';

/// 발언한 쪽.
enum AskRole {
  /// 사용자가 한 질문.
  user,

  /// 모델이 준 답.
  assistant,
}

/// 대화 속 발언 하나.
class AskMessage {
  const AskMessage({required this.role, required this.text});

  /// 사용자가 한 질문.
  const AskMessage.user(this.text) : role = AskRole.user;

  /// 모델이 준 답.
  const AskMessage.assistant(this.text) : role = AskRole.assistant;

  final AskRole role;
  final String text;

  int get charCount => text.length;

  @override
  bool operator ==(Object other) =>
      other is AskMessage && other.role == role && other.text == text;

  @override
  int get hashCode => Object.hash(role, text);

  @override
  String toString() => 'AskMessage(${role.name}, ${text.length}자)';
}

/// 주고받은 말을 순서대로 들고 있는 대화.
class AskConversation {
  const AskConversation(this.messages);

  /// 아직 아무것도 묻지 않은 상태.
  const AskConversation.empty() : messages = const <AskMessage>[];

  /// 오래된 것부터 순서대로.
  final List<AskMessage> messages;

  bool get isEmpty => messages.isEmpty;
  bool get isNotEmpty => messages.isNotEmpty;
  int get length => messages.length;

  /// 발언 글자 수의 합. 상한과 견주는 값이다.
  int get charCount {
    var total = 0;
    for (final message in messages) {
      total += message.charCount;
    }
    return total;
  }

  /// 발언 하나를 더한 새 대화.
  AskConversation append(AskMessage message) =>
      AskConversation(<AskMessage>[...messages, message]);

  /// 질문과 답 한 쌍을 더한 새 대화.
  AskConversation appendTurn({
    required String question,
    required String answer,
  }) =>
      AskConversation(<AskMessage>[
        ...messages,
        AskMessage.user(question),
        AskMessage.assistant(answer),
      ]);

  /// 비운 대화. 화면을 닫거나 새로 묻기 시작할 때 쓴다.
  AskConversation cleared() => const AskConversation.empty();

  /// 상한 안에 들어오도록 앞부분을 덜어 낸 대화.
  ///
  /// ## 줄이는 기준
  ///
  /// - **오래된 것부터 통째로 버린다.** 발언 하나를 중간에서 자르지 않는다.
  ///   잘린 문장을 앞선 대화라고 보내면 모델이 그 조각에 대고 답한다.
  /// - **최근 것을 남긴다.** 후속 질문은 거의 언제나 바로 앞 답을 가리킨다.
  ///   "그거 말고 다른 방법은?" 은 열 번째 전 질문이 아니라 직전 답을 받는다.
  /// - **버리고 나서 답으로 시작하면 그 답도 버린다.** 질문 없는 답만 남으면
  ///   무엇에 대한 답인지 알 수 없어 모델이 엉뚱한 맥락을 만든다.
  /// - 발언 수([AskLimits.maxHistoryMessages])와 글자 수
  ///   ([AskLimits.maxHistoryChars]) 중 먼저 걸리는 쪽을 따른다.
  AskConversation trimmed([AskLimits limits = const AskLimits()]) {
    return trimmedTo(
      maxChars: limits.maxHistoryChars,
      maxMessages: limits.maxHistoryMessages,
    );
  }

  /// [trimmed]와 같되 상한을 직접 준다.
  AskConversation trimmedTo({required int maxChars, required int maxMessages}) {
    if (messages.isEmpty) return this;

    var kept = messages;
    if (maxMessages >= 0 && kept.length > maxMessages) {
      kept = kept.sublist(kept.length - maxMessages);
    }

    var total = 0;
    for (final message in kept) {
      total += message.charCount;
    }
    var start = 0;
    while (start < kept.length && total > maxChars) {
      total -= kept[start].charCount;
      start += 1;
    }

    // 앞이 답으로 시작하면 짝을 잃은 답이다. 함께 버린다.
    while (start < kept.length && kept[start].role == AskRole.assistant) {
      start += 1;
    }

    if (start == 0 && kept.length == messages.length) return this;
    return AskConversation(kept.sublist(start));
  }

  /// 앞선 질문 하나를 덜어 낸 대화.
  ///
  /// 프롬프트를 다 만들고도 상한을 넘을 때 한 번씩 불러 더 줄인다.
  AskConversation dropOldestTurn() {
    if (messages.isEmpty) return this;
    var start = 1;
    while (start < messages.length && messages[start].role == AskRole.assistant) {
      start += 1;
    }
    return AskConversation(messages.sublist(start));
  }

  @override
  String toString() => 'AskConversation(${messages.length}개, $charCount자)';
}
