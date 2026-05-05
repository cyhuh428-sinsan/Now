import 'package:drift/drift.dart';
import '../../core/database/app_database.dart';
import '../interfaces/prepare_repository.dart';

class LocalPrepareRepository implements PrepareRepository {
  final AppDatabase _db;
  LocalPrepareRepository(this._db);

  @override
  Future<PrepareItem> savePrepare(PrepareItemsCompanion item) async {
    await _db.into(_db.prepareItems).insert(item);
    return await (_db.select(_db.prepareItems)
          ..where((t) => t.prepareId.equals(item.prepareId.value)))
        .getSingle();
  }

  @override
  Future<List<PrepareItem>> getUpcomingPrepares(String userId) async {
    final today = DateTime.now();
    final todayStr =
        '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    return await (_db.select(_db.prepareItems)
          ..where((t) =>
              t.userId.equals(userId) &
              t.targetDate.isBiggerOrEqualValue(todayStr))
          ..orderBy([(t) => OrderingTerm.asc(t.targetDate)]))
        .get();
  }

  @override
  Future<List<PrepareItem>> getPreparesByDate(
      String userId, String date) async {
    return await (_db.select(_db.prepareItems)
          ..where((t) =>
              t.userId.equals(userId) & t.targetDate.equals(date)))
        .get();
  }

  @override
  Future<void> deletePrepare(String prepareId) async {
    await (_db.delete(_db.prepareItems)
          ..where((t) => t.prepareId.equals(prepareId)))
        .go();
  }
}
