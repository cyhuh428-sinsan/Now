import 'package:drift/drift.dart';

// ============================================================
// 노트 테이블 정의
//
// Now와 NowNote가 공유하는 메모 저장 구조다.
// 두 앱은 각자의 DB 파일을 쓰지만 테이블 구조는 이 정의 하나를 따른다.
//
// - 계층 메모: Memos (source='note_tree')
// - 일자별 메모: Meetings (recordType='memo') + TranscriptSegments
//
// Meetings는 회의/인터뷰/대화 기록과 테이블을 공유한다.
// NowNote는 recordType='memo' 행만 사용한다.
// ============================================================

// 회의/대화 기록
class Meetings extends Table {
  TextColumn get meetingId => text()();
  TextColumn get calendarEventId => text().nullable()();
  TextColumn get title => text().withDefault(const Constant(''))();
  TextColumn get status => text().withDefault(const Constant('planned'))();
  // recordType: meeting | interview | conversation | memo
  TextColumn get recordType =>
      text().withDefault(const Constant('meeting'))();
  TextColumn get participantName => text().nullable()();
  DateTimeColumn get startedAt => dateTime().nullable()();
  DateTimeColumn get endedAt => dateTime().nullable()();
  TextColumn get summary => text().nullable()();
  IntColumn get segmentCount => integer().withDefault(const Constant(0))();
  IntColumn get actionCount => integer().withDefault(const Constant(0))();
  IntColumn get decisionCount => integer().withDefault(const Constant(0))();
  BoolColumn get isImportant => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {meetingId};
}

// 발언 세그먼트
class TranscriptSegments extends Table {
  TextColumn get segmentId => text()();
  TextColumn get meetingId => text()();
  TextColumn get speaker => text().withDefault(const Constant('unknown'))();
  DateTimeColumn get timestamp => dateTime().nullable()();
  TextColumn get content => text()();
  RealColumn get confidence => real().nullable()();
  TextColumn get source => text().withDefault(const Constant('text_input'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {segmentId};
}

// 메모
class Memos extends Table {
  TextColumn get memoId => text()();
  TextColumn get userId => text()();
  TextColumn get content => text()();
  TextColumn get tags => text().nullable()();
  // source: capture | manual | note_tree
  TextColumn get source => text().withDefault(const Constant('manual'))();
  TextColumn get extractedId => text().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {memoId};
}
