import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/core/database/app_database.dart';
import 'package:now_note/repositories/local/transaction_repository.dart';

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

    Future<void> _insertTx({
      required String id,
      required String userId,
      required String direction,
      required int amount,
      String? category,
      String? extractedId,
      DateTime? occurredAt,
    }) async {
      await database.into(database.transactions).insert(
        TransactionsCompanion.insert(
          transactionId: id,
          userId: userId,
          extractedId: Value(extractedId),
          direction: direction,
          amount: amount,
          category: Value(category),
          occurredAt: Value(occurredAt ?? DateTime(2026, 5, 15)),
        ),
      );
    }

    test('getByMonth returns only transactions in the given month', () async {
      await _insertTx(
        id: 'tx-may',
        userId: 'local_user',
        direction: '지출',
        amount: 5000,
        occurredAt: DateTime(2026, 5, 10),
      );
      await _insertTx(
        id: 'tx-june',
        userId: 'local_user',
        direction: '지출',
        amount: 8000,
        occurredAt: DateTime(2026, 6, 1),
      );

      final results = await repository.getByMonth('local_user', 2026, 5);
      expect(results.length, 1);
      expect(results.first.transactionId, 'tx-may');
    });

    test('getMonthlySummary calculates income and expense correctly', () async {
      await _insertTx(
        id: 'tx-income',
        userId: 'local_user',
        direction: '수입',
        amount: 3000000,
        occurredAt: DateTime(2026, 5, 1),
      );
      await _insertTx(
        id: 'tx-exp1',
        userId: 'local_user',
        direction: '지출',
        amount: 50000,
        occurredAt: DateTime(2026, 5, 10),
      );
      await _insertTx(
        id: 'tx-exp2',
        userId: 'local_user',
        direction: '지출',
        amount: 30000,
        occurredAt: DateTime(2026, 5, 20),
      );

      final summary = await repository.getMonthlySummary('local_user', 2026, 5);
      expect(summary.income, 3000000);
      expect(summary.expense, 80000);
    });

    test('getMonthlySummary returns zeros when no transactions', () async {
      final summary = await repository.getMonthlySummary('local_user', 2020, 1);
      expect(summary.income, 0);
      expect(summary.expense, 0);
    });

    test('updateTransaction updates amount and memo', () async {
      await _insertTx(
        id: 'tx-upd',
        userId: 'local_user',
        direction: '지출',
        amount: 10000,
        occurredAt: DateTime(2026, 5, 5),
      );

      await repository.updateTransaction('tx-upd', amount: 15000, memo: '수정됨');

      final txs = await repository.getByMonth('local_user', 2026, 5);
      expect(txs.first.amount, 15000);
      expect(txs.first.memo, '수정됨');
    });

    test('updateTransaction syncs amount to linked meal record', () async {
      const extractedId = 'ext-meal-1';
      await _insertTx(
        id: 'tx-meal',
        userId: 'local_user',
        direction: '지출',
        amount: 9000,
        extractedId: extractedId,
        occurredAt: DateTime(2026, 5, 5),
      );
      await database.into(database.mealRecords).insert(
        MealRecordsCompanion.insert(
          mealId: 'meal-linked',
          userId: 'local_user',
          extractedId: Value(extractedId),
          amount: const Value(9000),
        ),
      );

      await repository.updateTransaction(
        'tx-meal',
        amount: 12000,
        extractedId: extractedId,
      );

      final meal = await (database.select(database.mealRecords)
            ..where((t) => t.extractedId.equals(extractedId)))
          .getSingle();
      expect(meal.amount, 12000);
    });

    test('deleteTransaction removes the record', () async {
      await _insertTx(
        id: 'tx-del',
        userId: 'local_user',
        direction: '지출',
        amount: 5000,
        occurredAt: DateTime(2026, 5, 5),
      );

      await repository.deleteTransaction('tx-del');

      final txs = await repository.getByMonth('local_user', 2026, 5);
      expect(txs, isEmpty);
    });

    test('deleteTransaction also deletes linked meal record', () async {
      const extractedId = 'ext-del-1';
      await _insertTx(
        id: 'tx-del-meal',
        userId: 'local_user',
        direction: '지출',
        amount: 7000,
        extractedId: extractedId,
        occurredAt: DateTime(2026, 5, 5),
      );
      await database.into(database.mealRecords).insert(
        MealRecordsCompanion.insert(
          mealId: 'meal-del-linked',
          userId: 'local_user',
          extractedId: Value(extractedId),
        ),
      );

      await repository.deleteTransaction('tx-del-meal', extractedId: extractedId);

      final meals = await (database.select(database.mealRecords)
            ..where((t) => t.extractedId.equals(extractedId)))
          .get();
      expect(meals, isEmpty);
    });

    test('getCategoryTotals groups expense by category', () async {
      await _insertTx(
        id: 'tx-food-1',
        userId: 'local_user',
        direction: '지출',
        amount: 10000,
        category: '식비',
        occurredAt: DateTime(2026, 5, 1),
      );
      await _insertTx(
        id: 'tx-food-2',
        userId: 'local_user',
        direction: '지출',
        amount: 8000,
        category: '식비',
        occurredAt: DateTime(2026, 5, 2),
      );
      await _insertTx(
        id: 'tx-transport',
        userId: 'local_user',
        direction: '지출',
        amount: 3000,
        category: '교통비',
        occurredAt: DateTime(2026, 5, 3),
      );

      final totals = await repository.getCategoryTotals('local_user', 2026, 5, '지출');
      expect(totals['식비'], 18000);
      expect(totals['교통비'], 3000);
    });
  });
}
