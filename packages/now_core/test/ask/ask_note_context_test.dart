import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/ask/ask_exception.dart';
import 'package:now_core/ask/ask_limits.dart';
import 'package:now_core/ask/ask_note_context.dart';
import 'package:now_core/notes/note_content.dart';

void main() {
  group('맥락 만들기', () {
    test('제목과 본문을 그대로 담는다', () {
      final context = AskNoteContext.fromNote(
        title: '장보기',
        body: '두부 한 모\n콩나물 한 봉',
      );

      expect(context.title, '장보기');
      expect(context.body, '두부 한 모\n콩나물 한 봉');
      expect(context.truncated, isFalse);
    });

    test('제목이 비면 기본 제목을 쓴다', () {
      final context = AskNoteContext.fromNote(title: '   ', body: '내용');
      expect(context.title, defaultNoteTitle);
    });

    test('저장된 한 덩어리 문자열도 받는다', () {
      final context = AskNoteContext.fromContent('회의 정리\n첫째 줄\n둘째 줄');

      expect(context.title, '회의 정리');
      expect(context.body, '첫째 줄\n둘째 줄');
    });
  });

  group('잠긴 메모 차단', () {
    test('암호화된 본문은 맥락으로 쓸 수 없다', () {
      expect(
        () => AskNoteContext.fromNote(
          title: '비밀',
          body: '${encryptedNotePrefix}QUJDREVGRw==',
        ),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.lockedNote),
        ),
      );
    });

    test('제목 줄 뒤에 암호문이 붙은 저장 형태도 막는다', () {
      expect(
        () => AskNoteContext.fromContent(
          '잠긴 메모\n${encryptedNotePrefix}QUJDREVGRw==',
        ),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.lockedNote),
        ),
      );
    });

    test('본문 한가운데 암호문이 섞여 있어도 막는다', () {
      expect(
        () => AskNoteContext.fromNote(
          title: '메모',
          body: '앞줄\n${encryptedNotePrefix}QUJD\n뒷줄',
        ),
        throwsA(
          isA<AskException>()
              .having((e) => e.kind, 'kind', AskErrorKind.lockedNote),
        ),
      );
    });

    test('안내 문구는 사용자에게 보여도 되는 한국어다', () {
      try {
        AskNoteContext.fromNote(
          title: '메모',
          body: '${encryptedNotePrefix}QUJD',
        );
        fail('막지 못했다');
      } on AskException catch (error) {
        expect(error.message, contains('잠긴 메모'));
        expect(error.message, isNot(contains(encryptedNotePrefix)));
      }
    });

    test('복호화된 본문은 그대로 통과한다', () {
      final context =
          AskNoteContext.fromNote(title: '메모', body: '복호화된 진짜 내용');
      expect(context.body, '복호화된 진짜 내용');
    });
  });

  group('긴 메모 줄이기', () {
    const limits = AskLimits(maxContextChars: 200);

    test('상한을 넘으면 줄이고 표시를 남긴다', () {
      final long = List.generate(200, (i) => '$i번째 줄').join('\n');
      final context = AskNoteContext.fromNote(
        title: '긴 메모',
        body: long,
        limits: limits,
      );

      expect(context.truncated, isTrue);
      expect(context.body.length, lessThanOrEqualTo(200));
      expect(context.body, contains(askContextElision));
      expect(context.originalBodyChars, long.length);
    });

    test('앞과 뒤를 남기고 가운데를 버린다', () {
      final long = '${'앞' * 300}\n${'중' * 300}\n${'뒤' * 300}';
      final context = AskNoteContext.fromNote(
        title: '긴 메모',
        body: long,
        limits: limits,
      );

      expect(context.body, contains('앞'));
      expect(context.body, contains('뒤'));
    });

    test('앞을 뒤보다 많이 남긴다', () {
      final long = '${'앞' * 400}${'뒤' * 400}';
      final context = AskNoteContext.fromNote(
        title: '긴 메모',
        body: long,
        limits: limits,
      );

      final head = '앞'.allMatches(context.body).length;
      final tail = '뒤'.allMatches(context.body).length;
      expect(head, greaterThan(tail));
    });

    test('상한 안이면 줄이지 않는다', () {
      final context = AskNoteContext.fromNote(
        title: '짧은 메모',
        body: '한 줄뿐',
        limits: limits,
      );

      expect(context.truncated, isFalse);
      expect(context.body, '한 줄뿐');
    });

    test('더 줄여 달라고 하면 더 줄인다', () {
      final long = '가' * 1000;
      final context = AskNoteContext.fromNote(
        title: '긴 메모',
        body: long,
        limits: limits,
      );
      final shorter = context.shortenedTo(80);

      expect(shorter.body.length, lessThanOrEqualTo(80));
      expect(shorter.truncated, isTrue);
      expect(shorter.originalBodyChars, long.length);
    });
  });
}
