import '../../core/database/app_database.dart';

abstract class PrepareRepository {
  Future<PrepareItem> savePrepare(PrepareItemsCompanion item);
  Future<List<PrepareItem>> getUpcomingPrepares(String userId);
  Future<List<PrepareItem>> getPreparesByDate(String userId, String date);
  Future<void> deletePrepare(String prepareId);
}
