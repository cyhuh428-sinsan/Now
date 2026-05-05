import 'package:drift/drift.dart';
import 'package:device_calendar/device_calendar.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../core/database/app_database.dart';
import '../interfaces/calendar_event_repository.dart';

class LocalCalendarEventRepository implements CalendarEventRepository {
  final AppDatabase _db;

  // ▼▼▼ [2. 추가] 캘린더 플러그인 객체 생성
  final DeviceCalendarPlugin _deviceCalendarPlugin = DeviceCalendarPlugin();

  LocalCalendarEventRepository(this._db);

  // =========================================================
  // [1] 기존 핵심 로직 (LLM 및 홈 화면 연동용)
  // =========================================================

  /// 특정 사용자의 오늘 일정 조회 (홈 화면 표시용)
  @override
  Future<List<CalendarEvent>> getTodayEvents(String userId) async {
    final start = DateTime.now();
    final startOfDay = DateTime(start.year, start.month, start.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    return await (_db.select(_db.calendarEvents)
          ..where((t) =>
              t.userId.equals(userId) &
              t.startTime.isBiggerOrEqualValue(startOfDay) &
              t.startTime.isSmallerThanValue(endOfDay))
          ..orderBy([(t) => OrderingTerm.asc(t.startTime)]))
        .get();
  }

  @override
  Future<void> saveEvent(CalendarEventsCompanion event) async {
    await _db
        .into(_db.calendarEvents)
        .insertOnConflictUpdate(event);
  }

  @override
  Future<bool> hasMeeting(String calendarEventId) async {
    final result = await (_db.select(_db.meetings)
          ..where((t) => t.calendarEventId.equals(calendarEventId)))
        .getSingleOrNull();
    return result != null;
  }

  // =========================================================
  // [2] 추가된 UI 기능 (SchedulePage 일정 관리용)
  // =========================================================

  /// 선택한 날짜의 모든 일정 조회 (관리 화면용)
  Future<List<CalendarEvent>> getEventsByDate(DateTime date) {
    final startOfDay = DateTime(date.year, date.month, date.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    // 여기서는 userId 필터를 뺄 수도 있고, 필요하다면 넣을 수 있습니다.
    // 일단 모든 일정을 보여주도록 설정합니다.
    return (_db.select(_db.calendarEvents)
          ..where((tbl) => tbl.startTime.isBiggerOrEqualValue(startOfDay))
          ..where((tbl) => tbl.startTime.isSmallerThanValue(endOfDay))
          ..orderBy([(t) => OrderingTerm.asc(t.startTime)]))
        .get();
  }

  /// 새 일정 생성 (수동 등록)
  Future<int> createEvent(CalendarEventsCompanion companion) {
    return _db.into(_db.calendarEvents).insert(companion);
  }

  /// 일정 수정
  Future<bool> updateEvent(CalendarEventsCompanion companion) {
    return _db.update(_db.calendarEvents).replace(companion);
  }

  /// 일정 삭제
  Future<int> deleteEvent(String id) {
    return (_db.delete(_db.calendarEvents)
          ..where((tbl) => tbl.calendarEventId.equals(id)))
        .go();
  }

  // =========================================================
  // [3] 구글 캘린더 동기화 (Sync)
  // =========================================================

  Future<int> syncEventsByMonth(DateTime targetMonth) async { 
    print('=========== [동기화 시작] ===========');
    print('대상 월: ${targetMonth.year}년 ${targetMonth.month}월');

    // 1. 권한 체크
    var status = await Permission.calendarFullAccess.status;
    if (!status.isGranted) {
      print('⚠️ 권한이 없습니다. 권한을 요청합니다.');
      status = await Permission.calendarFullAccess.request();
      if (!status.isGranted) {
        print('❌ 권한이 거부되었습니다.');
        return 0;
      }
    }
    print('✅ 캘린더 권한 확인됨');

    // 2. 날짜 범위
    final startRange = DateTime(targetMonth.year, targetMonth.month, 1);
    final endRange = DateTime(targetMonth.year, targetMonth.month + 1, 1)
        .subtract(const Duration(milliseconds: 1));
    
    print('조회 기간: $startRange ~ $endRange');

    // 3. 기존 데이터 삭제
    final deleted = await (_db.delete(_db.calendarEvents)
          ..where((tbl) => tbl.startTime.isBiggerOrEqualValue(startRange))
          ..where((tbl) => tbl.startTime.isSmallerThanValue(endRange))
          ..where((tbl) => tbl.source.equals('device'))) 
        .go();
    print('🗑️ 기존 연동 데이터 삭제: $deleted건');

    // 4. 기기 캘린더 목록 가져오기
    final calendarsResult = await _deviceCalendarPlugin.retrieveCalendars();
    if (calendarsResult.data == null || calendarsResult.data!.isEmpty) {
      print('❌ 기기에서 캘린더를 찾을 수 없습니다. (목록 비어있음)');
      return 0;
    }

    print('📅 발견된 캘린더 개수: ${calendarsResult.data!.length}개');

    int syncCount = 0;
    for (var calendar in calendarsResult.data!) {
      print('   > 캘린더 스캔 중: [${calendar.name}] (ID: ${calendar.id}, Account: ${calendar.accountName})');
      
      final eventsResult = await _deviceCalendarPlugin.retrieveEvents(
        calendar.id,
        RetrieveEventsParams(startDate: startRange, endDate: endRange),
      );

      if (eventsResult.data != null && eventsResult.data!.isNotEmpty) {
        print('     🔹 이벤트 ${eventsResult.data!.length}개 발견됨');
        for (var event in eventsResult.data!) {
          if (event.eventId == null) continue;
          
          print('       - 저장 시도: ${event.title} (${event.start})');
          
          await _db.into(_db.calendarEvents).insertOnConflictUpdate(
                CalendarEventsCompanion.insert(
                  calendarEventId: event.eventId!, 
                  userId: 'local_user', 
                  title: event.title ?? '제목 없음',
                  startTime: event.start ?? startRange,
                  endTime: event.end ?? startRange.add(const Duration(hours: 1)),
                  location: Value(event.location),
                  category: Value(calendar.name), // 캘린더 이름
                  source: const Value('device'),
                ),
              );
          syncCount++;
        }
      } else {
        print('     - 이벤트 없음');
      }
    }
    
    print('=========== [동기화 완료] 총 $syncCount건 ===========');
    return syncCount;
  }
}