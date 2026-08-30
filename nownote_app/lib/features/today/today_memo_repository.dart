import 'package:drift/drift.dart';
import 'package:now_core/now_core.dart';

/// 오늘 메모 탭이 보여줄 문단 한 개.
///
/// `TranscriptSegments` 한 행에 대응한다. [source]는 이 문단이 어떤 방식으로
/// 들어왔는지를 나타낸다. `text_input`(텍스트) / `device_stt`(음성) / `photo`(사진).
class TodayMemoParagraph {
  const TodayMemoParagraph({
    required this.segmentId,
    required this.text,
    required this.timestamp,
    required this.source,
  });

  final String segmentId;
  final String text;
  final DateTime timestamp;
  final String source;
}

/// 텍스트 입력으로 들어온 문단의 저장 표시.
const String todayParagraphSourceText = 'text_input';

/// 기기 내 음성 인식으로 들어온 문단의 저장 표시.
///
/// Now의 회의/계층 메모 화면이 실시간 변환에 쓰는 것과 같은 값이다.
const String todayParagraphSourceVoice = 'device_stt';

/// 사진에서 읽어낸 뒤 사용자가 고쳐 넣은 문단의 저장 표시.
const String todayParagraphSourcePhoto = 'photo';

/// 묻기 시트에서 받은 답을 넣은 문단의 저장 표시.
const String todayParagraphSourceAsk = 'ask';

/// 오늘 메모 탭의 데이터 접근.
///
/// `Meetings`(`recordType='memo'`) + `TranscriptSegments`만 다룬다. 계층 메모
/// (`Memos`)나 회의/인터뷰/대화 기록(`recordType` != `memo`)에는 손대지 않는다.
///
/// 하루에 메모 하나, 그 안에 문단 여러 개 규칙을 여기서 지킨다. 화면은 이
/// 규칙을 모르고 날짜와 텍스트만 넘긴다.
class TodayMemoRepository {
  TodayMemoRepository(this._db);

  final NoteDatabase _db;

  /// 자정 기준으로 날짜만 남긴다. 같은 날인지 비교할 때 이 값으로 맞춘다.
  static DateTime normalizeDate(DateTime date) =>
      DateTime(date.year, date.month, date.day);

  /// [date]에 해당하는 일자별 메모(`Meeting`) 한 건을 찾는다. 없으면 null.
  Future<Meeting?> findMemoForDate(DateTime date) async {
    final target = normalizeDate(date);
    final rows = await (_db.select(
      _db.meetings,
    )..where((m) => m.recordType.equals('memo'))).get();
    for (final row in rows) {
      final rowDate = normalizeDate(row.startedAt ?? row.createdAt);
      if (rowDate == target) return row;
    }
    return null;
  }

  /// [meetingId]에 쌓인 문단을 시간순으로 돌려준다.
  Future<List<TodayMemoParagraph>> paragraphsFor(String meetingId) async {
    final rows =
        await (_db.select(_db.transcriptSegments)
              ..where((s) => s.meetingId.equals(meetingId))
              ..orderBy([(s) => OrderingTerm.asc(s.timestamp)]))
            .get();
    return rows
        .map(
          (s) => TodayMemoParagraph(
            segmentId: s.segmentId,
            text: s.content,
            timestamp: s.timestamp ?? s.createdAt,
            source: s.source,
          ),
        )
        .toList();
  }

  /// [date]의 메모 문단을 시간순으로 바로 돌려준다. 메모가 없으면 빈 목록.
  Future<List<TodayMemoParagraph>> paragraphsForDate(DateTime date) async {
    final memo = await findMemoForDate(date);
    if (memo == null) return const [];
    return paragraphsFor(memo.meetingId);
  }

  /// 일자별 메모가 있는 날짜 전체(자정 기준)를 돌려준다. 달력 점 표시용.
  Future<Set<DateTime>> datesWithMemo() async {
    final rows = await (_db.select(
      _db.meetings,
    )..where((m) => m.recordType.equals('memo'))).get();
    return rows.map((m) => normalizeDate(m.startedAt ?? m.createdAt)).toSet();
  }

  /// [date]의 메모에 문단을 하나 추가한다. 그 날 메모가 없으면 새로 만든다.
  ///
  /// 새 문단을 넣으면 이 함수가 즉시 저장한다. 화면은 언제 저장할지 판단하지
  /// 않고 이 함수를 부르기만 한다.
  Future<void> appendParagraph({
    required DateTime date,
    required String text,
    required String source,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    final now = DateTime.now();
    final existing = await findMemoForDate(date);
    final meetingId =
        existing?.meetingId ??
        'nownote_today_${normalizeDate(date).millisecondsSinceEpoch}';
    final startedAt = existing?.startedAt ?? _dateTimeAt(date, now);
    final segmentCount = (existing?.segmentCount ?? 0) + 1;

    final firstLine = trimmed.split('\n').first.trim();
    final fallbackTitle = firstLine.length > 30
        ? '${firstLine.substring(0, 30)}...'
        : firstLine;
    final title = existing != null && existing.title.isNotEmpty
        ? existing.title
        : (fallbackTitle.isEmpty ? '오늘 메모' : fallbackTitle);

    await _db
        .into(_db.meetings)
        .insertOnConflictUpdate(
          MeetingsCompanion(
            meetingId: Value(meetingId),
            title: Value(title),
            status: const Value('closed'),
            recordType: const Value('memo'),
            startedAt: Value(startedAt),
            endedAt: Value(now),
            segmentCount: Value(segmentCount),
            isImportant: existing == null
                ? const Value(false)
                : Value(existing.isImportant),
            createdAt: Value(existing?.createdAt ?? now),
            updatedAt: Value(now),
          ),
        );

    await _db
        .into(_db.transcriptSegments)
        .insert(
          TranscriptSegmentsCompanion.insert(
            segmentId: '${meetingId}_${now.microsecondsSinceEpoch}',
            meetingId: meetingId,
            content: trimmed,
            speaker: const Value('user'),
            timestamp: Value(now),
            source: Value(source),
          ),
        );
  }

  static DateTime _dateTimeAt(DateTime date, DateTime time) => DateTime(
    date.year,
    date.month,
    date.day,
    time.hour,
    time.minute,
    time.second,
    time.millisecond,
    time.microsecond,
  );
}
