import 'package:drift/drift.dart';
import '../../core/database/app_database.dart';
import '../interfaces/meal_repository.dart';

class LocalMealRepository implements MealRepository {
  final AppDatabase _db;

  LocalMealRepository(this._db);

  @override
  Future<MealRecord> saveMeal(MealRecordsCompanion meal) async {
    await _db.into(_db.mealRecords).insert(meal);
    return await (_db.select(_db.mealRecords)
          ..where((t) => t.mealId.equals(meal.mealId.value)))
        .getSingle();
  }

  @override
  Future<List<MealRecord>> getMealsByDate(
      String userId, DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));

    return await (_db.select(_db.mealRecords)
          ..where((t) =>
              t.userId.equals(userId) &
              t.eatenAt.isBiggerOrEqualValue(start) &
              t.eatenAt.isSmallerThanValue(end))
          ..orderBy([(t) => OrderingTerm.asc(t.eatenAt)]))
        .get();
  }

  @override
  Future<void> deleteMeal(String mealId) async {
    // 연결된 Transaction 먼저 삭제
    final meal = await (_db.select(_db.mealRecords)
          ..where((t) => t.mealId.equals(mealId)))
        .getSingleOrNull();
    if (meal?.extractedId != null) {
      await (_db.delete(_db.transactions)
            ..where((t) => t.extractedId.equals(meal!.extractedId!)))
          .go();
    }
    await (_db.delete(_db.mealRecords)
          ..where((t) => t.mealId.equals(mealId)))
        .go();
  }

  // 식사 수정 + 연결된 Transaction 금액/메모 동기화
  Future<void> updateMeal(String mealId, {
    String? description,
    int? amount,
    String? mealType,
    String? locationLabel,
  }) async {
    await (_db.update(_db.mealRecords)..where((t) => t.mealId.equals(mealId)))
        .write(MealRecordsCompanion(
      description: description != null ? Value(description) : const Value.absent(),
      amount: amount != null ? Value(amount) : const Value.absent(),
      mealType: mealType != null ? Value(mealType) : const Value.absent(),
      locationLabel: locationLabel != null ? Value(locationLabel) : const Value.absent(),
    ));
    // 연결된 Transaction 금액 동기화
    if (amount != null) {
      final meal = await (_db.select(_db.mealRecords)
            ..where((t) => t.mealId.equals(mealId)))
          .getSingleOrNull();
      if (meal?.extractedId != null) {
        await (_db.update(_db.transactions)
              ..where((t) => t.extractedId.equals(meal!.extractedId!)))
            .write(TransactionsCompanion(
          amount: Value(amount),
          memo: description != null ? Value(description) : const Value.absent(),
        ));
      }
    }
  }
}
