import 'package:drift/drift.dart';
import '../../core/database/app_database.dart';
import '../interfaces/fashion_repository.dart';

class LocalFashionRepository implements FashionRepository {
  final AppDatabase _db;
  LocalFashionRepository(this._db);

  @override
  Future<FashionRecord> saveFashion(FashionRecordsCompanion fashion) async {
    await _db.into(_db.fashionRecords).insert(fashion);
    return await (_db.select(_db.fashionRecords)
          ..where((t) => t.fashionId.equals(fashion.fashionId.value)))
        .getSingle();
  }

  @override
  Future<List<FashionRecord>> getFashionsByDate(
      String userId, DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));
    return await (_db.select(_db.fashionRecords)
          ..where((t) =>
              t.userId.equals(userId) &
              t.recordedAt.isBiggerOrEqualValue(start) &
              t.recordedAt.isSmallerThanValue(end))
          ..orderBy([(t) => OrderingTerm.desc(t.recordedAt)]))
        .get();
  }

  @override
  Future<List<FashionRecord>> getRecentFashions(String userId,
      {int limit = 30}) async {
    return await (_db.select(_db.fashionRecords)
          ..where((t) => t.userId.equals(userId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordedAt)])
          ..limit(limit))
        .get();
  }

  @override
  Future<void> updateAnalysis(String fashionId, String analysis) async {
    await (_db.update(_db.fashionRecords)
          ..where((t) => t.fashionId.equals(fashionId)))
        .write(FashionRecordsCompanion(
          llmAnalysis: Value(analysis),
        ));
  }

  @override
  Future<void> deleteFashion(String fashionId) async {
    await (_db.delete(_db.fashionRecords)
          ..where((t) => t.fashionId.equals(fashionId)))
        .go();
  }
}
