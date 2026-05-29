import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/core/database/app_database.dart';
import 'package:now_note/repositories/local/local_context_repository.dart';

void main() {
  group('LocalContextRepository', () {
    late AppDatabase database;
    late LocalContextRepository repository;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
      repository = LocalContextRepository(database);
    });

    tearDown(() async {
      await database.close();
    });

    test('saveContext stores and returns record', () async {
      final context = await repository.saveContext(
        DailyContextsCompanion.insert(
          contextId: 'ctx-1',
          userId: 'local_user',
          memo: '오늘 컨디션 좋음',
          conditionScore: const Value(4),
          sleepHours: const Value(7.5),
        ),
      );
      expect(context.contextId, 'ctx-1');
      expect(context.memo, '오늘 컨디션 좋음');
      expect(context.conditionScore, 4);
    });

    test('getContextsByDate returns only contexts for the given date', () async {
      final today = DateTime(2026, 5, 30, 9, 0);
      final yesterday = DateTime(2026, 5, 29, 9, 0);

      await repository.saveContext(
        DailyContextsCompanion.insert(
          contextId: 'ctx-today',
          userId: 'local_user',
          memo: '오늘',
          recordedAt: Value(today),
        ),
      );
      await repository.saveContext(
        DailyContextsCompanion.insert(
          contextId: 'ctx-yesterday',
          userId: 'local_user',
          memo: '어제',
          recordedAt: Value(yesterday),
        ),
      );

      final results = await repository.getContextsByDate('local_user', today);
      expect(results.length, 1);
      expect(results.first.contextId, 'ctx-today');
    });

    test('getContextsByDate returns empty when no records for date', () async {
      final results = await repository.getContextsByDate(
        'local_user',
        DateTime(2020, 1, 1),
      );
      expect(results, isEmpty);
    });

    test('getLatestContext returns the most recent record', () async {
      final earlier = DateTime(2026, 5, 29, 8, 0);
      final later = DateTime(2026, 5, 30, 10, 0);

      await repository.saveContext(
        DailyContextsCompanion.insert(
          contextId: 'ctx-early',
          userId: 'local_user',
          memo: '이른 것',
          recordedAt: Value(earlier),
        ),
      );
      await repository.saveContext(
        DailyContextsCompanion.insert(
          contextId: 'ctx-late',
          userId: 'local_user',
          memo: '최근 것',
          recordedAt: Value(later),
        ),
      );

      final latest = await repository.getLatestContext('local_user');
      expect(latest?.contextId, 'ctx-late');
    });

    test('getLatestContext returns null when no records exist', () async {
      final latest = await repository.getLatestContext('no_user');
      expect(latest, equals(null));
    });
  });
}
