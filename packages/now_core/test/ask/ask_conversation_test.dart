import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/ask/ask_conversation.dart';
import 'package:now_core/ask/ask_limits.dart';

AskConversation _turns(int count, {int chars = 10}) {
  var conversation = const AskConversation.empty();
  for (var i = 0; i < count; i++) {
    conversation = conversation.appendTurn(
      question: 'Q$i${'가' * chars}',
      answer: 'A$i${'나' * chars}',
    );
  }
  return conversation;
}

void main() {
  group('대화 쌓기', () {
    test('질문과 답이 순서대로 쌓인다', () {
      final conversation = const AskConversation.empty()
          .appendTurn(question: '첫 질문', answer: '첫 답')
          .appendTurn(question: '둘째 질문', answer: '둘째 답');

      expect(conversation.length, 4);
      expect(conversation.messages.map((m) => m.role).toList(), [
        AskRole.user,
        AskRole.assistant,
        AskRole.user,
        AskRole.assistant,
      ]);
      expect(conversation.messages.first.text, '첫 질문');
      expect(conversation.messages.last.text, '둘째 답');
    });

    test('더해도 원래 대화는 그대로다', () {
      final first = const AskConversation.empty()
          .appendTurn(question: '질문', answer: '답');
      final second = first.appendTurn(question: '또', answer: '또 답');

      expect(first.length, 2);
      expect(second.length, 4);
    });

    test('비우면 아무것도 남지 않는다', () {
      final conversation = _turns(3);
      expect(conversation.cleared().isEmpty, isTrue);
    });
  });

  group('길이 초과 처리', () {
    test('글자 상한을 넘으면 오래된 것부터 버린다', () {
      final conversation = _turns(5, chars: 50);
      final trimmed = conversation.trimmedTo(maxChars: 220, maxMessages: 100);

      expect(trimmed.charCount, lessThanOrEqualTo(220));
      expect(trimmed.length, lessThan(conversation.length));
      // 가장 최근 답은 남는다.
      expect(trimmed.messages.last.text, conversation.messages.last.text);
    });

    test('발언을 중간에서 자르지 않는다', () {
      final conversation = _turns(5, chars: 50);
      final trimmed = conversation.trimmedTo(maxChars: 220, maxMessages: 100);

      for (final message in trimmed.messages) {
        expect(
          conversation.messages.any((m) => m.text == message.text),
          isTrue,
          reason: '남은 발언은 원본과 글자까지 같아야 한다',
        );
      }
    });

    test('버리고 나서 답으로 시작하면 그 답도 버린다', () {
      final conversation = _turns(4, chars: 40);
      final trimmed = conversation.trimmedTo(maxChars: 100, maxMessages: 100);

      expect(trimmed.isEmpty || trimmed.messages.first.role == AskRole.user,
          isTrue);
    });

    test('발언 수 상한이 먼저 걸리면 최근 것만 남는다', () {
      final conversation = _turns(10, chars: 1);
      final trimmed = conversation.trimmedTo(maxChars: 100000, maxMessages: 4);

      expect(trimmed.length, 4);
      expect(trimmed.messages.first.text, 'Q8가');
    });

    test('상한 안이면 같은 대화를 그대로 준다', () {
      final conversation = _turns(2, chars: 5);
      final trimmed = conversation.trimmed(const AskLimits());

      expect(identical(trimmed, conversation), isTrue);
    });

    test('빈 대화는 줄여도 빈 대화다', () {
      expect(const AskConversation.empty().trimmed().isEmpty, isTrue);
    });

    test('앞선 질문 하나를 덜어 내면 질문과 그 답이 함께 빠진다', () {
      final conversation = _turns(3, chars: 2);
      final dropped = conversation.dropOldestTurn();

      expect(dropped.length, conversation.length - 2);
      expect(dropped.messages.first.role, AskRole.user);
      expect(dropped.messages.first.text, startsWith('Q1'));
    });
  });
}
