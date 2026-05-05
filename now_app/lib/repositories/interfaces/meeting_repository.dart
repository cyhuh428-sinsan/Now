import '../../core/database/app_database.dart';

abstract class MeetingRepository {
  /// 회의 시작
  Future<Meeting> startMeeting({
    required String meetingId,
    required String calendarEventId,
  });

  /// 회의 종료
  Future<Meeting> closeMeeting(String meetingId);

  /// 회의 조회
  Future<Meeting?> getMeeting(String meetingId);

  /// 발언 세그먼트 추가
  Future<void> addSegment(TranscriptSegment segment);

  /// 회의의 전체 세그먼트 조회
  Future<List<TranscriptSegment>> getSegments(String meetingId);
}
