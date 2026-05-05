import '../../core/database/app_database.dart';

abstract class RoutineRepository {
  // ── 루틴 CRUD ──
  Future<RoutineItem> saveRoutine(RoutineItemsCompanion routine);
  Future<List<RoutineItem>> getAllRoutines(String userId);
  Future<void> updateRoutine(RoutineItemsCompanion routine);
  Future<void> deleteRoutine(String routineId);
  Future<void> toggleRoutine(String routineId, bool isEnabled);

  // ── 완료 기록 ──
  Future<void> markComplete(String routineId, String userId, String date);
  Future<void> unmarkComplete(String routineId, String userId, String date);
  Future<List<String>> getCompletedRoutineIds(String userId, String date);
}
