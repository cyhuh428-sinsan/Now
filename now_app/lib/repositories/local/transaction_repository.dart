import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/database/app_database.dart';
import '../repository_providers.dart';

class TransactionRepository {
  final AppDatabase _db;
  TransactionRepository(this._db);

  // 월별 거래 조회
  Future<List<Transaction>> getByMonth(String userId, int year, int month) async {
    final start = DateTime(year, month, 1);
    final end = DateTime(year, month + 1, 1);
    return (_db.select(_db.transactions)
          ..where((t) => t.userId.equals(userId))
          ..where((t) => t.occurredAt.isBiggerOrEqualValue(start))
          ..where((t) => t.occurredAt.isSmallerThanValue(end))
          ..orderBy([(t) => OrderingTerm.desc(t.occurredAt)]))
        .get();
  }

  // 월별 요약 (수입 합계, 지출 합계)
  Future<({int income, int expense})> getMonthlySummary(
      String userId, int year, int month) async {
    final list = await getByMonth(userId, year, month);
    int income = 0, expense = 0;
    for (final t in list) {
      if (t.direction == '수입') {
        income += t.amount;
      } else {
        expense += t.amount;
      }
    }
    return (income: income, expense: expense);
  }

  // 거래 수정 + 연결된 MealRecord 금액/메모 동기화
  Future<void> updateTransaction(String transactionId, {
    int? amount,
    String? memo,
    String? category,
    String? extractedId,
  }) async {
    await (_db.update(_db.transactions)
          ..where((t) => t.transactionId.equals(transactionId)))
        .write(TransactionsCompanion(
      amount: amount != null ? Value(amount) : const Value.absent(),
      memo: memo != null ? Value(memo) : const Value.absent(),
      category: category != null ? Value(category) : const Value.absent(),
    ));
    // 연결된 MealRecord 금액 동기화
    if (amount != null && extractedId != null) {
      await (_db.update(_db.mealRecords)
            ..where((t) => t.extractedId.equals(extractedId)))
          .write(MealRecordsCompanion(
        amount: Value(amount),
      ));
    }
  }

  // 거래 삭제 + 연결된 MealRecord도 함께 삭제
  Future<void> deleteTransaction(String transactionId, {String? extractedId}) async {
    await (_db.delete(_db.transactions)
          ..where((t) => t.transactionId.equals(transactionId)))
        .go();
    if (extractedId != null) {
      await (_db.delete(_db.mealRecords)
            ..where((t) => t.extractedId.equals(extractedId)))
          .go();
    }
  }
}

final transactionRepositoryProvider = Provider<TransactionRepository>((ref) {
  return TransactionRepository(ref.watch(appDatabaseProvider));
});

// 선택된 연/월
final selectedYearMonthProvider = StateProvider<DateTime>((ref) => DateTime.now());

// 월별 거래 목록
final monthlyTransactionsProvider =
    FutureProvider.autoDispose<List<Transaction>>((ref) async {
  const userId = 'local_user';
  final ym = ref.watch(selectedYearMonthProvider);
  return ref
      .watch(transactionRepositoryProvider)
      .getByMonth(userId, ym.year, ym.month);
});

// 월별 요약
final monthlySummaryProvider =
    FutureProvider.autoDispose<({int income, int expense})>((ref) async {
  const userId = 'local_user';
  final ym = ref.watch(selectedYearMonthProvider);
  return ref
      .watch(transactionRepositoryProvider)
      .getMonthlySummary(userId, ym.year, ym.month);
});

// ── 카테고리별 집계 ──
extension TransactionRepositoryExt on TransactionRepository {
  Future<Map<String, int>> getCategoryTotals(
      String userId, int year, int month, String direction) async {
    final list = await getByMonth(userId, year, month);
    final Map<String, int> totals = {};
    for (final t in list.where((t) => t.direction == direction)) {
      final cat = t.category ?? '기타';
      totals[cat] = (totals[cat] ?? 0) + t.amount;
    }
    return Map.fromEntries(
        totals.entries.toList()..sort((a, b) => b.value.compareTo(a.value)));
  }
}

// 카테고리별 지출 provider
final categoryExpenseProvider =
    FutureProvider.autoDispose<Map<String, int>>((ref) async {
  const userId = 'local_user';
  final ym = ref.watch(selectedYearMonthProvider);
  return ref
      .watch(transactionRepositoryProvider)
      .getCategoryTotals(userId, ym.year, ym.month, '지출');
});
