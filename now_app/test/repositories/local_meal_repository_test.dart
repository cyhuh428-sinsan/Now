import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/core/database/app_database.dart';
import 'package:now_note/repositories/local/local_meal_repository.dart';

void main() {
  group('LocalMealRepository', () {
    late AppDatabase database;
    late LocalMealRepository repository;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
      repository = LocalMealRepository(database);
    });

    tearDown(() async {
      await database.close();
    });

    test('saveMeal stores and returns a meal record', () async {
      final meal = await repository.saveMeal(
        MealRecordsCompanion.insert(
          mealId: 'meal-1',
          userId: 'local_user',
          eatenAt: Value(DateTime(2026, 5, 30, 12, 0)),
          mealType: const Value('점심'),
          description: const Value('비빔밥'),
          amount: const Value(9000),
        ),
      );

      expect(meal.mealId, 'meal-1');
      expect(meal.description, '비빔밥');
      expect(meal.amount, 9000);
    });

    test('getMealsByDate returns only meals for the given date', () async {
      final today = DateTime(2026, 5, 30, 12, 0);
      final tomorrow = DateTime(2026, 5, 31, 12, 0);

      await repository.saveMeal(
        MealRecordsCompanion.insert(
          mealId: 'meal-today',
          userId: 'local_user',
          eatenAt: Value(today),
          description: const Value('오늘 점심'),
        ),
      );
      await repository.saveMeal(
        MealRecordsCompanion.insert(
          mealId: 'meal-tomorrow',
          userId: 'local_user',
          eatenAt: Value(tomorrow),
          description: const Value('내일 점심'),
        ),
      );

      final meals = await repository.getMealsByDate('local_user', today);
      expect(meals.length, 1);
      expect(meals.first.mealId, 'meal-today');
    });

    test('deleteMeal removes the meal record', () async {
      await repository.saveMeal(
        MealRecordsCompanion.insert(
          mealId: 'meal-del',
          userId: 'local_user',
        ),
      );

      await repository.deleteMeal('meal-del');

      final meals = await repository.getMealsByDate(
        'local_user',
        DateTime.now(),
      );
      expect(meals, isEmpty);
    });

    test('deleteMeal also removes linked transaction', () async {
      final extractedId = 'ext-1';
      await repository.saveMeal(
        MealRecordsCompanion.insert(
          mealId: 'meal-tx',
          userId: 'local_user',
          extractedId: Value(extractedId),
          amount: const Value(10000),
        ),
      );
      // 연결된 transaction 삽입
      await database.into(database.transactions).insert(
        TransactionsCompanion.insert(
          transactionId: 'tx-1',
          userId: 'local_user',
          extractedId: Value(extractedId),
          direction: '지출',
          amount: 10000,
        ),
      );

      await repository.deleteMeal('meal-tx');

      final txs = await (database.select(database.transactions)
            ..where((t) => t.extractedId.equals(extractedId)))
          .get();
      expect(txs, isEmpty);
    });

    test('updateMeal syncs amount to linked transaction', () async {
      final extractedId = 'ext-2';
      await repository.saveMeal(
        MealRecordsCompanion.insert(
          mealId: 'meal-upd',
          userId: 'local_user',
          extractedId: Value(extractedId),
          amount: const Value(8000),
        ),
      );
      await database.into(database.transactions).insert(
        TransactionsCompanion.insert(
          transactionId: 'tx-2',
          userId: 'local_user',
          extractedId: Value(extractedId),
          direction: '지출',
          amount: 8000,
        ),
      );

      await repository.updateMeal('meal-upd', amount: 12000);

      final tx = await (database.select(database.transactions)
            ..where((t) => t.extractedId.equals(extractedId)))
          .getSingle();
      expect(tx.amount, 12000);
    });
  });
}
