import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../../core/database/app_database.dart';
import '../interfaces/routine_repository.dart';

class LocalRoutineRepository implements RoutineRepository {
  final AppDatabase _db;
  LocalRoutineRepository(this._db);

  // ── 루틴 CRUD ──

  @override
  Future<RoutineItem> saveRoutine(RoutineItemsCompanion routine) async {
    await _db.into(_db.routineItems).insert(routine);
    return await (_db.select(_db.routineItems)
          ..where((t) => t.routineId.equals(routine.routineId.value)))
        .getSingle();
  }

  @override
  Future<List<RoutineItem>> getAllRoutines(String userId) async {
    return await (_db.select(_db.routineItems)
          ..where((t) => t.userId.equals(userId))
          ..orderBy([
            (t) => OrderingTerm.asc(t.sortOrder),
            (t) => OrderingTerm.asc(t.createdAt),
          ]))
        .get();
  }

  @override
  Future<void> updateRoutine(RoutineItemsCompanion routine) async {
    await (_db.update(_db.routineItems)
          ..where((t) => t.routineId.equals(routine.routineId.value)))
        .write(routine);
  }

  @override
  Future<void> deleteRoutine(String routineId) async {
    await (_db.delete(_db.routineItems)
          ..where((t) => t.routineId.equals(routineId)))
        .go();
    await (_db.delete(_db.routineCompletions)
          ..where((t) => t.routineId.equals(routineId)))
        .go();
  }

  @override
  Future<void> toggleRoutine(String routineId, bool isEnabled) async {
    await (_db.update(_db.routineItems)
          ..where((t) => t.routineId.equals(routineId)))
        .write(RoutineItemsCompanion(
          isEnabled: Value(isEnabled),
          updatedAt: Value(DateTime.now()),
        ));
  }

  // ── 완료 기록 ──

  @override
  Future<void> markComplete(
      String routineId, String userId, String date) async {
    final existing = await (_db.select(_db.routineCompletions)
          ..where((t) =>
              t.routineId.equals(routineId) &
              t.userId.equals(userId) &
              t.completedDate.equals(date)))
        .getSingleOrNull();
    if (existing != null) return;

    await _db.into(_db.routineCompletions).insert(
          RoutineCompletionsCompanion(
            completionId: Value(const Uuid().v4()),
            routineId: Value(routineId),
            userId: Value(userId),
            completedDate: Value(date),
          ),
        );
  }

  @override
  Future<void> unmarkComplete(
      String routineId, String userId, String date) async {
    await (_db.delete(_db.routineCompletions)
          ..where((t) =>
              t.routineId.equals(routineId) &
              t.userId.equals(userId) &
              t.completedDate.equals(date)))
        .go();
  }

  @override
  Future<List<String>> getCompletedRoutineIds(
      String userId, String date) async {
    final rows = await (_db.select(_db.routineCompletions)
          ..where((t) =>
              t.userId.equals(userId) & t.completedDate.equals(date)))
        .get();
    return rows.map((r) => r.routineId).toList();
  }
}
