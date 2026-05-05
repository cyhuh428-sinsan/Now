import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_app/core/database/app_database.dart';
import 'package:now_app/repositories/local/transaction_repository.dart';

void main() {
  group('TransactionRepository', () {
    late AppDatabase database;
    late TransactionRepository repository;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
      repository = TransactionRepository(database);
    });

    tearDown(() async {
      await database.close();
    });

    test('updateTransaction syncs the linked meal record amount', () async {
      await database.into(database.mealRecords).insert(
            MealRecordsCompanion.insert(
              mealId: 'meal-1',
              userId: 'local_user',
              extractedId: const Value('capture-1'),
              description: const Value('점심'),
            ),
          );

      await database.into(database.transactions).insert(
            TransactionsCompanion.insert(
              transactionId: 'tx-1',
              userId: 'local_user',
              extractedId: const Value('capture-1'),
              direction: '지출',
              amount: 12000,
            ),
          );

      await repository.updateTransaction(
        'tx-1',
        amount: 15000,
        extractedId: 'capture-1',
      );

      final meal = await (database.select(database.mealRecords)
            ..where((t) => t.mealId.equals('meal-1')))
          .getSingle();

      expect(meal.amount, 15000);
    });

    test('deleteTransaction removes both the transaction and linked meal record', () async {
      await database.into(database.mealRecords).insert(
            MealRecordsCompanion.insert(
              mealId: 'meal-2',
              userId: 'local_user',
              extractedId: const Value('capture-2'),
              description: const Value('저녁'),
            ),
          );

      await database.into(database.transactions).insert(
            TransactionsCompanion.insert(
              transactionId: 'tx-2',
              userId: 'local_user',
              extractedId: const Value('capture-2'),
              direction: '지출',
              amount: 18000,
            ),
          );

      await repository.deleteTransaction('tx-2', extractedId: 'capture-2');

      final transaction = await (database.select(database.transactions)
            ..where((t) => t.transactionId.equals('tx-2')))
          .getSingleOrNull();
      final meal = await (database.select(database.mealRecords)
            ..where((t) => t.mealId.equals('meal-2')))
          .getSingleOrNull();

      expect(transaction, isNull);
      expect(meal, isNull);
    });
  });
}
