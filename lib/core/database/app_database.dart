import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

part 'app_database.g.dart';

// ============================================================
// 1. 테이블 정의
// ============================================================

// 사용자
class Users extends Table {
  TextColumn get userId => text()();
  TextColumn get timezone => text().withDefault(const Constant('Asia/Seoul'))();
  TextColumn get locale => text().nullable()();
  TextColumn get settingsJson => text().withDefault(const Constant('{}'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {userId};
}

// 캘린더 이벤트
class CalendarEvents extends Table {
  TextColumn get calendarEventId => text()();
  TextColumn get userId => text()();
  TextColumn get title => text()();
  DateTimeColumn get startTime => dateTime()();
  DateTimeColumn get endTime => dateTime()();
  TextColumn get location => text().nullable()();
  TextColumn get category => text().nullable()();
  TextColumn get source => text().withDefault(const Constant('manual'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {calendarEventId};
}

// 회의/대화 기록
class Meetings extends Table {
  TextColumn get meetingId => text()();
  TextColumn get calendarEventId => text().nullable()();
  TextColumn get title => text().withDefault(const Constant(''))();
  TextColumn get status => text().withDefault(const Constant('planned'))();
  // recordType: meeting | interview | conversation
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

// 추출 아이템 (Action / Decision)
class ExtractedItems extends Table {
  TextColumn get itemId => text()();
  TextColumn get meetingId => text()();
  TextColumn get itemType => text()();
  TextColumn get status => text().withDefault(const Constant('draft'))();
  TextColumn get content => text()();
  RealColumn get confidence => real().nullable()();
  TextColumn get ownerLabel => text().nullable()();
  TextColumn get dueDate => text().nullable()();
  TextColumn get dueTime => text().nullable()();
  TextColumn get scheduledCalendarEventId => text().nullable()();
  DateTimeColumn get confirmedAt => dateTime().nullable()();
  DateTimeColumn get scheduledAt => dateTime().nullable()();
  DateTimeColumn get completedAt => dateTime().nullable()();
  DateTimeColumn get archivedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {itemId};
}

// 식사 기록
class MealRecords extends Table {
  TextColumn get mealId => text()();
  TextColumn get userId => text()();
  DateTimeColumn get eatenAt => dateTime().withDefault(currentDateAndTime)();
  TextColumn get mealType => text().nullable()();
  TextColumn get photoPath => text().nullable()();
  TextColumn get description => text().nullable()();
  TextColumn get locationLabel => text().nullable()();
  RealColumn get locationLat => real().nullable()();
  RealColumn get locationLng => real().nullable()();
  // ★ 신규: 식비 금액 (원 단위, null = 미입력)
  IntColumn get amount => integer().nullable()();
  // ★ 신규: LLM 예측 금액 여부
  BoolColumn get isAmountEstimated =>
      boolean().withDefault(const Constant(false))();
  // Capture 연동용 extractedId
  TextColumn get extractedId => text().nullable()();
  TextColumn get nutritionAnalysisJson => text().nullable()();
  DateTimeColumn get nutritionAnalyzedAt => dateTime().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {mealId};
}

// 컨텍스트 메모
class DailyContexts extends Table {
  TextColumn get contextId => text()();
  TextColumn get userId => text()();
  DateTimeColumn get recordedAt => dateTime().withDefault(currentDateAndTime)();
  TextColumn get memo => text()();
  RealColumn get sleepHours => real().nullable()();
  IntColumn get conditionScore => integer().nullable()();
  TextColumn get weatherLabel => text().nullable()();
  RealColumn get weatherTemp => real().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {contextId};
}

// 약/영양제 복용 기록
class MedicationRecords extends Table {
  TextColumn get medicationId => text()();
  TextColumn get userId => text()();
  DateTimeColumn get takenAt => dateTime().withDefault(currentDateAndTime)();
  TextColumn get name => text()();
  TextColumn get dosage => text().nullable()();
  TextColumn get memo => text().nullable()();
  BoolColumn get isPrescription =>
      boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {medicationId};
}

// 운동 기록
class ExerciseRecords extends Table {
  TextColumn get exerciseId => text()();
  TextColumn get userId => text()();
  DateTimeColumn get startedAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get endedAt => dateTime().nullable()();
  TextColumn get exerciseType => text()();
  IntColumn get durationMinutes => integer().nullable()();
  TextColumn get intensity => text().nullable()();
  TextColumn get locationLabel => text().nullable()();
  TextColumn get memo => text().nullable()();
  IntColumn get estimatedCalories => integer().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {exerciseId};
}

// 병원 방문 기록
class HospitalRecords extends Table {
  TextColumn get hospitalId => text()();
  TextColumn get userId => text()();
  DateTimeColumn get visitedAt => dateTime().withDefault(currentDateAndTime)();
  TextColumn get hospitalName => text()();
  TextColumn get department => text().nullable()();
  TextColumn get reason => text().nullable()();
  TextColumn get diagnosis => text().nullable()();
  TextColumn get memo => text().nullable()();
  IntColumn get amount => integer().nullable()(); // 병원비
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {hospitalId};
}

// 수면 기록
class SleepRecords extends Table {
  TextColumn get sleepId => text()();
  TextColumn get userId => text()();
  // 취침 시각
  DateTimeColumn get bedAt => dateTime()();
  // 기상 시각
  DateTimeColumn get wokeAt => dateTime().nullable()();
  // 수면 질: 1(나쁨) ~ 5(좋음)
  IntColumn get qualityScore => integer().nullable()();
  TextColumn get memo => text().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {sleepId};
}

// 루틴 정의
class RoutineItems extends Table {
  TextColumn get routineId => text()();
  TextColumn get userId => text()();
  TextColumn get name => text()();
  // repeat: daily | weekdays | weekends | weekly
  TextColumn get repeat => text().withDefault(const Constant('daily'))();
  // weekdays: 쉼표 구분 "1,3,5" (weekly 시)
  TextColumn get weekdaysJson => text().nullable()();
  // alertTime: "HH:mm" 형식, null = 알림 없음
  TextColumn get alertTime => text().nullable()();
  BoolColumn get isEnabled =>
      boolean().withDefault(const Constant(true))();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt =>
      dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {routineId};
}

// 루틴 일별 완료 기록
class RoutineCompletions extends Table {
  TextColumn get completionId => text()();
  TextColumn get routineId => text()();
  TextColumn get userId => text()();
  // completedDate: "YYYY-MM-DD"
  TextColumn get completedDate => text()();
  DateTimeColumn get completedAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {completionId};
}

// 패션 기록
class FashionRecords extends Table {
  TextColumn get fashionId => text()();
  TextColumn get userId => text()();
  // photoPath: 사진 파일 경로
  TextColumn get photoPath => text().nullable()();
  // llmAnalysis: LLM 분석 결과 (착용 아이템 JSON 문자열)
  TextColumn get llmAnalysis => text().nullable()();
  // weatherSummary: 날씨 요약 (연계용)
  TextColumn get weatherSummary => text().nullable()();
  TextColumn get memo => text().nullable()();
  DateTimeColumn get recordedAt =>
      dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get createdAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {fashionId};
}

// 일정 준비물
class PrepareItems extends Table {
  TextColumn get prepareId => text()();
  TextColumn get userId => text()();
  // targetDate: "YYYY-MM-DD"
  TextColumn get targetDate => text()();
  TextColumn get title => text()(); // 일정명 (예: 출장, 병원)
  // itemsJson: 준비물 목록 JSON 배열 (예: ["노트북","충전기"])
  TextColumn get itemsJson => text()();
  BoolColumn get isNotified =>
      boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {prepareId};
}

// 정기결제
class SubscriptionItems extends Table {
  TextColumn get subscriptionId => text()();
  TextColumn get userId => text()();
  TextColumn get name => text()(); // 서비스명 (예: 넷플릭스)
  IntColumn get amount => integer()(); // 금액 (원)
  // cycle: monthly | yearly
  TextColumn get cycle => text().withDefault(const Constant('monthly'))();
  // billingDay: 결제일 (1~31)
  IntColumn get billingDay => integer()();
  // alertDaysBefore: N일 전 알림 (0=당일, null=알림없음)
  IntColumn get alertDaysBefore => integer().nullable()();
  TextColumn get category => text().nullable()(); // 카테고리 (OTT/음악/업무 등)
  BoolColumn get isActive =>
      boolean().withDefault(const Constant(true))();
  DateTimeColumn get lastBilledDate => dateTime().nullable()(); // 마지막 살림 반영일
  DateTimeColumn get createdAt =>
      dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {subscriptionId};
}


// capture 원본 입력
class CaptureItems extends Table {
  TextColumn get captureId => text()();
  TextColumn get userId => text()();
  // sourceType: voice | photo | text
  TextColumn get sourceType => text()();
  TextColumn get rawText => text().nullable()();
  TextColumn get assetUri => text().nullable()();
  // status: pending | processing | done | error
  TextColumn get status => text().withDefault(const Constant('pending'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {captureId};
}

// LLM이 추출한 capture 결과
class ExtractedCaptures extends Table {
  TextColumn get extractedId => text()();
  TextColumn get captureId => text()();
  // domain: 살림 | 건강 | 일정 | 할일 | 메모
  TextColumn get domain => text()();
  TextColumn get entitiesJson => text().nullable()();
  RealColumn get confidence => real()();
  BoolColumn get committed => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {extractedId};
}

// 수입/지출 거래 (살림 탭)
class Transactions extends Table {
  TextColumn get transactionId => text()();
  TextColumn get userId => text()();
  TextColumn get extractedId => text().nullable()();
  DateTimeColumn get occurredAt => dateTime().withDefault(currentDateAndTime)();
  // direction: 수입 | 지출
  TextColumn get direction => text()();
  IntColumn get amount => integer()();
  TextColumn get category => text().nullable()();
  TextColumn get memo => text().nullable()();
  // source: capture | manual
  TextColumn get source => text().withDefault(const Constant('manual'))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {transactionId};
}

// 메모
class Memos extends Table {
  TextColumn get memoId => text()();
  TextColumn get userId => text()();
  TextColumn get content => text()();
  TextColumn get tags => text().nullable()();
  // source: capture | manual
  TextColumn get source => text().withDefault(const Constant('manual'))();
  TextColumn get extractedId => text().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {memoId};
}


// 여행
class Trips extends Table {
  TextColumn get tripId => text()();
  TextColumn get userId => text()();
  TextColumn get name => text()();
  TextColumn get destination => text()();
  DateTimeColumn get startDate => dateTime()();
  DateTimeColumn get endDate => dateTime()();
  IntColumn get budgetTotal => integer().withDefault(const Constant(0))();
  // budgetJson: {"항공":0,"숙박":0,"식비":0,"관광":0,"기타":0}
  TextColumn get budgetJson => text().withDefault(const Constant('{}'))();
  // status: planning | on_trip | completed
  TextColumn get status => text().withDefault(const Constant('planning'))();
  IntColumn get rating => integer().nullable()();
  TextColumn get review => text().nullable()();
  TextColumn get llmSummary => text().nullable()();
  // 후기 사진 경로 목록 JSON (예: ["/path/a.jpg", "/path/b.jpg"])
  TextColumn get reviewPhotosJson => text().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {tripId};
}

// 여행 날짜별 계획
class TripDayPlans extends Table {
  TextColumn get planId => text()();
  TextColumn get tripId => text()();
  DateTimeColumn get date => dateTime()();
  // 원본 계획 (보존용)
  TextColumn get originalTitle => text().nullable()();
  // 실제 진행 중 수정 가능한 제목
  TextColumn get title => text()();
  TextColumn get content => text().nullable()();
  // status: pending | done | pass
  TextColumn get status => text().withDefault(const Constant('pending'))();
  // 실제 진행 중 감상 메모
  TextColumn get actualNote => text().nullable()();
  // 대표사진 경로
  TextColumn get photoUri => text().nullable()();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {planId};
}

// 여행 체크리스트
class TripChecklists extends Table {
  TextColumn get checkId => text()();
  TextColumn get tripId => text()();
  TextColumn get item => text()();
  TextColumn get category => text().nullable()();
  BoolColumn get isDone => boolean().withDefault(const Constant(false))();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {checkId};
}

// 브리핑 이력
class Briefings extends Table {
  TextColumn get briefingId => text()();
  TextColumn get userId => text()();
  TextColumn get dateKey => text()();
  TextColumn get mustDoJson => text().withDefault(const Constant('[]'))();
  TextColumn get tasksJson => text().withDefault(const Constant('[]'))();
  TextColumn get advice => text().nullable()();
  TextColumn get adviceBasis => text().nullable()();
  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {briefingId};
}

// 누적 롤링 요약
class RollingSummaries extends Table {
  TextColumn get summaryId => text()();
  TextColumn get userId => text()();
  TextColumn get sleepSummary => text().nullable()();
  TextColumn get expenseSummary => text().nullable()();
  TextColumn get lifeSummary => text().nullable()();
  TextColumn get lastAdvice => text().nullable()();
  DateTimeColumn get updatedAt => dateTime().withDefault(currentDateAndTime)();

  @override
  Set<Column> get primaryKey => {summaryId};
}


// ============================================================
// 2. 데이터베이스 클래스
// ============================================================

@DriftDatabase(tables: [
  Users,
  CalendarEvents,
  Meetings,
  TranscriptSegments,
  ExtractedItems,
  MealRecords,
  DailyContexts,
  MedicationRecords,
  ExerciseRecords,
  HospitalRecords,
  SleepRecords,
  RoutineItems,
  RoutineCompletions,
  FashionRecords,
  PrepareItems,
  SubscriptionItems,
  // v11 신규
  CaptureItems,
  ExtractedCaptures,
  Transactions,
  Memos,
  // v12 신규
  Briefings,
  RollingSummaries,
  // v13 신규
  Trips,
  TripDayPlans,
  TripChecklists,
])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(_openConnection());
  AppDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 17;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
        onUpgrade: (m, from, to) async {
          if (from < 2) {
            await m.addColumn(mealRecords, mealRecords.amount);
            await m.addColumn(mealRecords, mealRecords.isAmountEstimated);
          }
          if (from < 3) {
            await m.createTable(sleepRecords);
          }
          if (from < 4) {
            await m.createTable(routineItems);
            await m.createTable(routineCompletions);
          }
          if (from < 5) {
            await m.createTable(fashionRecords);
          }
          if (from < 6) {
            await m.createTable(prepareItems);
          }
          if (from < 7) {
            await m.createTable(subscriptionItems);
          }
          if (from < 8) {
            await m.database.customStatement(
                "ALTER TABLE meetings ADD COLUMN record_type TEXT NOT NULL DEFAULT 'meeting'");
            await m.database.customStatement(
                'ALTER TABLE meetings ADD COLUMN participant_name TEXT');
          }
          if (from < 9) {
            await m.database.customStatement(
                "ALTER TABLE meetings ADD COLUMN title TEXT NOT NULL DEFAULT ''");
            await m.database.customStatement(
                'ALTER TABLE meetings ADD COLUMN segment_count INTEGER NOT NULL DEFAULT 0');
            await m.database.customStatement(
                'ALTER TABLE meetings ADD COLUMN action_count INTEGER NOT NULL DEFAULT 0');
            await m.database.customStatement(
                'ALTER TABLE meetings ADD COLUMN decision_count INTEGER NOT NULL DEFAULT 0');
            await m.database.customStatement(
                'ALTER TABLE meetings ADD COLUMN is_important INTEGER NOT NULL DEFAULT 0');
          }
          if (from < 10) {
            // v10: calendar_event_id NOT NULL → nullable 변경
            // SQLite는 컬럼 제약 변경 불가 → 테이블 재생성 방식
            await m.database.customStatement(
                'ALTER TABLE meetings RENAME TO meetings_old');
            await m.database.customStatement('''
              CREATE TABLE meetings (
                meeting_id TEXT NOT NULL PRIMARY KEY,
                calendar_event_id TEXT,
                title TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'planned',
                record_type TEXT NOT NULL DEFAULT 'meeting',
                participant_name TEXT,
                started_at INTEGER,
                ended_at INTEGER,
                summary TEXT,
                segment_count INTEGER NOT NULL DEFAULT 0,
                action_count INTEGER NOT NULL DEFAULT 0,
                decision_count INTEGER NOT NULL DEFAULT 0,
                is_important INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
              )
            ''');
            await m.database.customStatement('''
              INSERT INTO meetings
                SELECT meeting_id, calendar_event_id, title, status,
                       record_type, participant_name, started_at, ended_at,
                       summary, segment_count, action_count, decision_count,
                       is_important, created_at, updated_at
                FROM meetings_old
            ''');
            await m.database.customStatement('DROP TABLE meetings_old');
          }
          if (from < 11) {
            await m.createTable(captureItems);
            await m.createTable(extractedCaptures);
            await m.createTable(transactions);
            await m.createTable(memos);
          }
          if (from < 12) {
            await m.createTable(briefings);
            await m.createTable(rollingSummaries);
          }
          if (from < 13) {
            await m.createTable(trips);
            await m.createTable(tripDayPlans);
            await m.createTable(tripChecklists);
          }
          if (from < 14) {
            // 이미 존재할 수 있어서 예외 무시
            try { await m.database.customStatement('ALTER TABLE trip_day_plans ADD COLUMN original_title TEXT'); } catch (_) {}
            try { await m.database.customStatement("ALTER TABLE trip_day_plans ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'"); } catch (_) {}
            try { await m.database.customStatement('ALTER TABLE trip_day_plans ADD COLUMN actual_note TEXT'); } catch (_) {}
            try { await m.database.customStatement('ALTER TABLE trip_day_plans ADD COLUMN photo_uri TEXT'); } catch (_) {}
          }
          if (from < 15) {
            try { await m.database.customStatement('ALTER TABLE trips ADD COLUMN review_photos_json TEXT'); } catch (_) {}
          }
          if (from < 16) {
            await m.database.customStatement('ALTER TABLE meal_records ADD COLUMN extracted_id TEXT');
          }
          if (from < 17) {
            try { await m.database.customStatement('ALTER TABLE hospital_records ADD COLUMN amount INTEGER'); } catch (_) {}
            try { await m.database.customStatement('ALTER TABLE subscription_items ADD COLUMN last_billed_date INTEGER'); } catch (_) {}
          }
        },
      );
}

QueryExecutor _openConnection() {
  return driftDatabase(name: 'now_app_db');
}
