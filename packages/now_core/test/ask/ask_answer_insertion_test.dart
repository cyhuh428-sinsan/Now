import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/ask/ask_answer_insertion.dart';

void main() {
  group('메모에 넣을 덩어리', () {
    test('머리줄과 답 본문으로 이루어진다', () {
      final block = buildAskInsertionBlock(
        '간장이나 된장으로 짠맛을 낼 수 있다.',
        question: '소금 대신 쓸 게 뭐가 있지?',
        sourceLabel: '로컬 모델',
      );

      expect(block, startsWith('> $askInsertionMarker — 소금 대신 쓸 게 뭐가 있지?'));
      expect(block, contains('> 출처: 로컬 모델'));
      expect(block, endsWith('간장이나 된장으로 짠맛을 낼 수 있다.'));
    });

    test('답 본문에는 인용 표시를 붙이지 않는다', () {
      final block = buildAskInsertionBlock(
        '```dart\nvoid main() {}\n```',
        question: '예제 좀',
      );

      expect(block, contains('```dart\nvoid main() {}\n```'));
      expect(
        block.split('\n').where((line) => line.startsWith('> ')).length,
        1,
        reason: '머리줄 한 줄만 인용 표시를 쓴다',
      );
    });

    test('답 본문을 고치지 않는다. 앞뒤 공백만 뗀다', () {
      final block = buildAskInsertionBlock('  줄 하나\n줄 둘  ');
      expect(block, endsWith('줄 하나\n줄 둘'));
    });

    test('질문이 길면 머리줄에서만 줄인다', () {
      final question = '가' * 200;
      final block = buildAskInsertionBlock('답', question: question);
      final head = block.split('\n').first;

      expect(head.length, lessThan(120));
      expect(head, endsWith('…'));
    });

    test('질문 속 줄바꿈은 머리줄을 늘리지 않는다', () {
      final block =
          buildAskInsertionBlock('답', question: '첫 줄\n둘째 줄\n셋째 줄');
      expect(block.split('\n').first, '> $askInsertionMarker — 첫 줄 둘째 줄 셋째 줄');
    });

    test('출처를 주지 않으면 출처 줄이 없다', () {
      final block = buildAskInsertionBlock('답', question: '질문');
      expect(block, isNot(contains('출처')));
    });

    test('빈 답은 빈 문자열이다', () {
      expect(buildAskInsertionBlock('   '), '');
    });
  });

  group('본문에 이어 붙이기', () {
    test('사이에 빈 줄을 하나 둔다', () {
      final result = appendAskAnswerToNote('원래 본문', '> 묻기 — 질문\n\n답');
      expect(result, '원래 본문\n\n> 묻기 — 질문\n\n답');
    });

    test('본문 끝 공백이 여러 줄이어도 빈 줄은 하나다', () {
      final result = appendAskAnswerToNote('원래 본문\n\n\n', '덩어리');
      expect(result, '원래 본문\n\n덩어리');
    });

    test('본문이 비어 있으면 덩어리만 남는다', () {
      expect(appendAskAnswerToNote('', '덩어리'), '덩어리');
    });

    test('덩어리가 비면 본문을 그대로 둔다', () {
      expect(appendAskAnswerToNote('원래 본문', '  '), '원래 본문');
    });
  });
}
