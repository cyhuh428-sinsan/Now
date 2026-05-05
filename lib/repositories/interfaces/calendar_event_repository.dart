import '../../core/database/app_database.dart';

abstract class CalendarEventRepository {
  /// 오늘 일정 조회
  Future<List<CalendarEvent>> getTodayEvents(String userId);

  /// 일정 저장
  Future<void> saveEvent(CalendarEventsCompanion event);

  /// 특정 일정에 회의가 존재하는지 확인
  Future<bool> hasMeeting(String calendarEventId);
}
