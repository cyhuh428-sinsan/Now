import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/today/today_memo_repository.dart';

void main() {
  late NoteDatabase db;
  late TodayMemoRepository repo;

  setUp(() {
    db = NoteDatabase.forTesting(NativeDatabase.memory());
    repo = TodayMemoRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  test('메모가 없는 날짜는 findMemoForDate가 null을 돌려준다', () async {
    final result = await repo.findMemoForDate(DateTime(2026, 8, 24));
    expect(result, isNull);
  });

  test('문단을 추가하면 그 날짜의 메모가 하나 생기고 문단이 저장된다', () async {
    final date = DateTime(2026, 8, 24);

    await repo.appendParagraph(
      date: date,
      text: '첫 문단',
      source: todayParagraphSourceText,
    );

    final memo = await repo.findMemoForDate(date);
    expect(memo, isNotNull);
    expect(memo!.recordType, 'memo');

    final paragraphs = await repo.paragraphsFor(memo.meetingId);
    expect(paragraphs, hasLength(1));
    expect(paragraphs.single.text, '첫 문단');
    expect(paragraphs.single.source, todayParagraphSourceText);
  });

  test('같은 날짜에 문단을 두 번 추가하면 메모 카드는 하나이고 문단만 늘어난다', () async {
    final date = DateTime(2026, 8, 24);

    await repo.appendParagraph(
      date: date,
      text: '첫 문단',
      source: todayParagraphSourceText,
    );
    await repo.appendParagraph(
      date: date,
      text: '둘째 문단',
      source: todayParagraphSourceVoice,
    );

    final memo = await repo.findMemoForDate(date);
    expect(memo, isNotNull);

    final paragraphs = await repo.paragraphsFor(memo!.meetingId);
    expect(paragraphs, hasLength(2));
    expect(paragraphs[0].text, '첫 문단');
    expect(paragraphs[1].text, '둘째 문단');
    expect(paragraphs[1].source, todayParagraphSourceVoice);

    final allMemos = await (db.select(
      db.meetings,
    )..where((m) => m.recordType.equals('memo'))).get();
    expect(allMemos, hasLength(1));
  });

  test('날짜가 다르면 메모가 따로 생긴다', () async {
    await repo.appendParagraph(
      date: DateTime(2026, 8, 24),
      text: '8월 24일',
      source: todayParagraphSourceText,
    );
    await repo.appendParagraph(
      date: DateTime(2026, 8, 25),
      text: '8월 25일',
      source: todayParagraphSourceText,
    );

    final dates = await repo.datesWithMemo();
    expect(dates, contains(DateTime(2026, 8, 24)));
    expect(dates, contains(DateTime(2026, 8, 25)));
    expect(dates, hasLength(2));

    final paragraphsOn24 = await repo.paragraphsForDate(DateTime(2026, 8, 24));
    expect(paragraphsOn24.single.text, '8월 24일');
  });

  test('빈 문자열은 저장하지 않는다', () async {
    await repo.appendParagraph(
      date: DateTime(2026, 8, 24),
      text: '   ',
      source: todayParagraphSourceText,
    );

    final memo = await repo.findMemoForDate(DateTime(2026, 8, 24));
    expect(memo, isNull);
  });
}
