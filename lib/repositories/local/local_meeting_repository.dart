import 'package:drift/drift.dart';
import '../../core/database/app_database.dart';

// ============================================================
// 기록(Meeting) DB 연동 Repository
// ============================================================

class LocalMeetingRepository {
  final AppDatabase _db;
  LocalMeetingRepository(this._db);

  // ── 기록 저장 ──────────────────────────────────────────────
  Future<void> saveMeeting({
    required String meetingId,
    required String title,
    required String recordType,
    required String participantName,
    required int segmentCount,
    required int actionCount,
    required int decisionCount,
    String? calendarEventId,
    DateTime? startedAt,
    DateTime? endedAt,
  }) async {
    final now = endedAt ?? DateTime.now();
    final started = startedAt ?? now;
    final pName = participantName.isNotEmpty ? participantName : null;

    await _db.into(_db.meetings).insertOnConflictUpdate(
      MeetingsCompanion(
        meetingId: Value(meetingId),
        // calendarEventId: null이면 생략 (NOT NULL 에러 방지)
        calendarEventId: calendarEventId != null
            ? Value(calendarEventId)
            : const Value.absent(),
        title: Value(title),
        status: const Value('closed'),
        recordType: Value(recordType),
        participantName: Value(pName),
        startedAt: Value(started),
        endedAt: Value(now),
        segmentCount: Value(segmentCount),
        actionCount: Value(actionCount),
        decisionCount: Value(decisionCount),
        isImportant: const Value(false),
        createdAt: Value(now),
        updatedAt: Value(now),
      ),
    );
  }

  // ── 세그먼트 일괄 저장 ─────────────────────────────────────
  Future<void> saveSegments(
      String meetingId, List<Map<String, dynamic>> segments) async {
    for (final s in segments) {
      await _db.into(_db.transcriptSegments).insertOnConflictUpdate(
            TranscriptSegmentsCompanion.insert(
              segmentId: s['id'] as String,
              meetingId: meetingId,
              content: s['text'] as String,
              speaker: Value(s['speakerLabel'] as String? ?? 'user'),
              timestamp: Value(s['timestamp'] as DateTime?),
              source: Value(s['source'] as String? ?? 'text_input'),
            ),
          );
    }
  }

  // ── 추출 아이템 일괄 저장 ──────────────────────────────────
  Future<void> saveExtractedItems(
      String meetingId, List<Map<String, dynamic>> items) async {
    for (final item in items) {
      await _db.into(_db.extractedItems).insertOnConflictUpdate(
            ExtractedItemsCompanion.insert(
              itemId: item['id'] as String,
              meetingId: meetingId,
              itemType: item['itemType'] as String,
              content: item['content'] as String,
              confidence: Value(item['confidence'] as double?),
              ownerLabel: Value(item['ownerLabel'] as String?),
              dueDate: Value(item['dueDate'] as String?),
              dueTime: Value(item['dueTime'] as String?),
              status: const Value('draft'),
            ),
          );
    }
  }

  // ── 기록 목록 조회 ─────────────────────────────────────────
  Future<List<Meeting>> getAllMeetings() async {
    return (_db.select(_db.meetings)
          ..orderBy([(t) => OrderingTerm.desc(t.createdAt)]))
        .get();
  }

  // ── 기록 단건 조회 ─────────────────────────────────────────
  Future<Meeting?> getMeetingById(String meetingId) async {
    return (_db.select(_db.meetings)
          ..where((t) => t.meetingId.equals(meetingId)))
        .getSingleOrNull();
  }

  // ── 세그먼트 조회 ──────────────────────────────────────────
  Future<List<TranscriptSegment>> getSegments(String meetingId) async {
    return (_db.select(_db.transcriptSegments)
          ..where((t) => t.meetingId.equals(meetingId))
          ..orderBy([(t) => OrderingTerm.asc(t.timestamp)]))
        .get();
  }

  // ── 추출 아이템 조회 ───────────────────────────────────────
  Future<List<ExtractedItem>> getExtractedItems(String meetingId) async {
    return (_db.select(_db.extractedItems)
          ..where((t) => t.meetingId.equals(meetingId)))
        .get();
  }

  // ── 중요 토글 ──────────────────────────────────────────────
  Future<void> toggleImportant(String meetingId, bool isImportant) async {
    await (_db.update(_db.meetings)
          ..where((t) => t.meetingId.equals(meetingId)))
        .write(MeetingsCompanion(
      isImportant: Value(isImportant),
      updatedAt: Value(DateTime.now()),
    ));
  }

  // ── 제목 수정 ──────────────────────────────────────────────
  Future<void> updateTitle(String meetingId, String title) async {
    await (_db.update(_db.meetings)
          ..where((t) => t.meetingId.equals(meetingId)))
        .write(MeetingsCompanion(
      title: Value(title),
      updatedAt: Value(DateTime.now()),
    ));
  }

  // ── 추출 아이템 수정 ───────────────────────────────────────────
  Future<void> updateExtractedItem(String itemId, String content,
      {String? ownerLabel, String? dueDate, String? dueTime}) async {
    await (_db.update(_db.extractedItems)
          ..where((t) => t.itemId.equals(itemId)))
        .write(ExtractedItemsCompanion(
      content: Value(content),
      ownerLabel: Value(ownerLabel),
      dueDate: Value(dueDate),
      dueTime: Value(dueTime),
      updatedAt: Value(DateTime.now()),
    ));
  }

  // ── 추출 아이템 삭제 ───────────────────────────────────────────
  Future<void> deleteExtractedItem(String itemId) async {
    await (_db.delete(_db.extractedItems)
          ..where((t) => t.itemId.equals(itemId)))
        .go();
  }

  // ── 삭제 ───────────────────────────────────────────────────
  Future<void> deleteMeeting(String meetingId) async {
    await (_db.delete(_db.meetings)
          ..where((t) => t.meetingId.equals(meetingId)))
        .go();
    await (_db.delete(_db.transcriptSegments)
          ..where((t) => t.meetingId.equals(meetingId)))
        .go();
    await (_db.delete(_db.extractedItems)
          ..where((t) => t.meetingId.equals(meetingId)))
        .go();
  }
}

