import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';

void main() {
  group('isEncryptedNoteContent', () {
    test('접두어가 있으면 true', () {
      expect(isEncryptedNoteContent('${encryptedNotePrefix}abc123'), isTrue);
    });

    test('접두어만 있어도 true', () {
      expect(isEncryptedNoteContent(encryptedNotePrefix), isTrue);
    });

    test('평문/빈 값/null 은 false', () {
      expect(isEncryptedNoteContent('일반 메모 내용'), isFalse);
      expect(isEncryptedNoteContent(''), isFalse);
      expect(isEncryptedNoteContent(null), isFalse);
    });

    test('접두어가 가운데 있으면 false', () {
      expect(isEncryptedNoteContent('앞말 $encryptedNotePrefix'), isFalse);
    });
  });

  group('splitNoteContent', () {
    test('첫 줄이 제목, 나머지가 본문', () {
      expect(
        splitNoteContent('제목\n첫째 줄\n둘째 줄'),
        const NoteTitleBody(title: '제목', body: '첫째 줄\n둘째 줄'),
      );
    });

    test('제목의 앞뒤 공백을 없앤다', () {
      expect(splitNoteContent('  제목  \n본문').title, '제목');
    });

    test('제목이 비면 제목 없음', () {
      expect(splitNoteContent('\n본문').title, defaultNoteTitle);
      expect(splitNoteContent('   \n본문').title, defaultNoteTitle);
      expect(splitNoteContent('').title, defaultNoteTitle);
    });

    test('본문을 trim 한다', () {
      expect(splitNoteContent('제목\n\n  본문  \n\n').body, '본문');
    });

    test('한 줄뿐이면 본문은 빈 문자열', () {
      expect(splitNoteContent('제목만').body, '');
    });

    test('본문 가운데 빈 줄은 남는다', () {
      expect(splitNoteContent('제목\n가\n\n나').body, '가\n\n나');
    });
  });

  group('joinNoteContent', () {
    test('제목과 본문을 줄바꿈으로 잇는다', () {
      expect(joinNoteContent(title: '제목', body: '본문'), '제목\n본문');
    });

    test('나눈 뒤 다시 이으면 제목과 본문이 유지된다', () {
      final split = splitNoteContent('제목\n본문 첫 줄\n본문 둘째 줄');
      final rejoined = joinNoteContent(title: split.title, body: split.body);
      expect(splitNoteContent(rejoined), split);
    });
  });

  group('noteTitleOrFallback', () {
    test('공백을 없애고 돌려준다', () {
      expect(noteTitleOrFallback('  제목 '), '제목');
    });

    test('비었거나 null 이면 기본값', () {
      expect(noteTitleOrFallback(''), defaultNoteTitle);
      expect(noteTitleOrFallback('   '), defaultNoteTitle);
      expect(noteTitleOrFallback(null), defaultNoteTitle);
    });

    test('기본값을 바꿀 수 있다', () {
      expect(noteTitleOrFallback(null, fallback: '없음'), '없음');
    });
  });
}
