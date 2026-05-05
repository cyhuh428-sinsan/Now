import '../../core/database/app_database.dart';

abstract class ItemRepository {
  /// 아이템 저장 (LLM 추출 결과)
  Future<void> saveItems(List<ExtractedItem> items);

  /// 회의의 아이템 목록 조회
  Future<List<ExtractedItem>> getItemsByMeeting(String meetingId);

  /// 오늘 미완료 아이템 조회 (홈 브리핑용)
  Future<List<ExtractedItem>> getTodayPendingItems(String userId);

  /// 아이템 상태 변경
  Future<void> confirmItem(String itemId);
  Future<void> archiveItem(String itemId);
  Future<void> completeItem(String itemId);
}
