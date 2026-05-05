import '../../core/database/app_database.dart';

abstract class FashionRepository {
  Future<FashionRecord> saveFashion(FashionRecordsCompanion fashion);
  Future<List<FashionRecord>> getFashionsByDate(String userId, DateTime date);
  Future<List<FashionRecord>> getRecentFashions(String userId, {int limit = 30});
  Future<void> updateAnalysis(String fashionId, String analysis);
  Future<void> deleteFashion(String fashionId);
}
