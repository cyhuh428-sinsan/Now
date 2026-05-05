import '../../core/database/app_database.dart';

abstract class ContextRepository {
  /// 컨텍스트 메모 저장
  Future<DailyContext> saveContext(DailyContextsCompanion context);

  /// 날짜별 컨텍스트 조회
  Future<List<DailyContext>> getContextsByDate(String userId, DateTime date);

  /// 오늘 최신 컨텍스트 조회 (홈 화면용)
  Future<DailyContext?> getLatestContext(String userId);
}
