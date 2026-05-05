import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../../core/database/app_database.dart';
import '../interfaces/subscription_repository.dart';

class LocalSubscriptionRepository implements SubscriptionRepository {
  final AppDatabase _db;
  LocalSubscriptionRepository(this._db);

  @override
  Future<SubscriptionItem> saveSubscription(
      SubscriptionItemsCompanion item) async {
    await _db.into(_db.subscriptionItems).insert(item);
    return await (_db.select(_db.subscriptionItems)
          ..where((t) =>
              t.subscriptionId.equals(item.subscriptionId.value)))
        .getSingle();
  }

  @override
  Future<List<SubscriptionItem>> getAllSubscriptions(String userId) async {
    return await (_db.select(_db.subscriptionItems)
          ..where((t) => t.userId.equals(userId))
          ..orderBy([(t) => OrderingTerm.asc(t.billingDay)]))
        .get();
  }

  @override
  Future<void> updateSubscription(SubscriptionItemsCompanion item) async {
    await (_db.update(_db.subscriptionItems)
          ..where((t) =>
              t.subscriptionId.equals(item.subscriptionId.value)))
        .write(item);
  }

  @override
  Future<void> deleteSubscription(String subscriptionId) async {
    await (_db.delete(_db.subscriptionItems)
          ..where((t) => t.subscriptionId.equals(subscriptionId)))
        .go();
  }

  @override
  Future<void> toggleActive(String subscriptionId, bool isActive) async {
    await (_db.update(_db.subscriptionItems)
          ..where((t) => t.subscriptionId.equals(subscriptionId)))
        .write(SubscriptionItemsCompanion(
          isActive: Value(isActive),
        ));
  }

  // 오늘 결제일인 구독 항목을 살림에 반영 (중복 방지)
  Future<void> processTodayBilling(String userId) async {
    final now = DateTime.now();
    final today = now.day;
    final todayDate = DateTime(now.year, now.month, now.day);

    final subs = await (_db.select(_db.subscriptionItems)
          ..where((t) => t.userId.equals(userId) & t.isActive.equals(true)))
        .get();

    for (final sub in subs) {
      if (sub.billingDay != today) continue;
      // 오늘 이미 처리했으면 스킵
      if (sub.lastBilledDate != null) {
        final last = sub.lastBilledDate!;
        final lastDate = DateTime(last.year, last.month, last.day);
        if (lastDate == todayDate) continue;
      }
      // 살림 지출 저장
      await _db.into(_db.transactions).insert(
        TransactionsCompanion.insert(
          transactionId: const Uuid().v4(),
          userId: userId,
          extractedId: Value(sub.subscriptionId),
          direction: '지출',
          amount: sub.amount,
          category: Value(sub.category ?? '구독'),
          memo: Value(sub.name),
          occurredAt: Value(now),
          source: const Value('subscription'),
        ),
      );
      // lastBilledDate 업데이트
      await (_db.update(_db.subscriptionItems)
            ..where((t) => t.subscriptionId.equals(sub.subscriptionId)))
          .write(SubscriptionItemsCompanion(lastBilledDate: Value(now)));
    }
  }
}
