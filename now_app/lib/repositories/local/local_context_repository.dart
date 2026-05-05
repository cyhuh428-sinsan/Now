import 'package:drift/drift.dart';
import '../../core/database/app_database.dart';
import '../interfaces/context_repository.dart';

class LocalContextRepository implements ContextRepository {
  final AppDatabase _db;

  LocalContextRepository(this._db);

  @override
  Future<DailyContext> saveContext(DailyContextsCompanion context) async {
    await _db.into(_db.dailyContexts).insert(context);
    return await (_db.select(_db.dailyContexts)
          ..where((t) => t.contextId.equals(context.contextId.value)))
        .getSingle();
  }

  @override
  Future<List<DailyContext>> getContextsByDate(
      String userId, DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));

    return await (_db.select(_db.dailyContexts)
          ..where((t) =>
              t.userId.equals(userId) &
              t.recordedAt.isBiggerOrEqualValue(start) &
              t.recordedAt.isSmallerThanValue(end))
          ..orderBy([(t) => OrderingTerm.desc(t.recordedAt)]))
        .get();
  }

  @override
  Future<DailyContext?> getLatestContext(String userId) async {
    return await (_db.select(_db.dailyContexts)
          ..where((t) => t.userId.equals(userId))
          ..orderBy([(t) => OrderingTerm.desc(t.recordedAt)])
          ..limit(1))
        .getSingleOrNull();
  }
}
