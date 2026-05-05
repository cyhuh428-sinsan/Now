import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/core/database/app_database.dart';
import 'package:now_note/repositories/local/local_routine_repository.dart';

void main() {
  group('LocalRoutineRepository', () {
    late AppDatabase database;
    late LocalRoutineRepository repository;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
      repository = LocalRoutineRepository(database);
    });

    tearDown(() async {
      await database.close();
    });

    test('markComplete stores only one completion per routine/date', () async {
      await repository.saveRoutine(
        RoutineItemsCompanion.insert(
          routineId: 'routine-1',
          userId: 'local_user',
          name: '물 마시기',
        ),
      );

      await repository.markComplete('routine-1', 'local_user', '2026-03-02');
      await repository.markComplete('routine-1', 'local_user', '2026-03-02');

      final completedIds =
          await repository.getCompletedRoutineIds('local_user', '2026-03-02');

      expect(completedIds, ['routine-1']);
    });

    test('deleteRoutine also deletes linked completion records', () async {
      await repository.saveRoutine(
        RoutineItemsCompanion.insert(
          routineId: 'routine-2',
          userId: 'local_user',
          name: '영양제 먹기',
        ),
      );
      await repository.markComplete('routine-2', 'local_user', '2026-03-02');

      await repository.deleteRoutine('routine-2');

      final routines = await repository.getAllRoutines('local_user');
      final completedIds =
          await repository.getCompletedRoutineIds('local_user', '2026-03-02');

      expect(routines, isEmpty);
      expect(completedIds, isEmpty);
    });
  });
}
