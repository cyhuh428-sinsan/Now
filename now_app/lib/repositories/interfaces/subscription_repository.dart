import '../../core/database/app_database.dart';

abstract class SubscriptionRepository {
  Future<SubscriptionItem> saveSubscription(SubscriptionItemsCompanion item);
  Future<List<SubscriptionItem>> getAllSubscriptions(String userId);
  Future<void> updateSubscription(SubscriptionItemsCompanion item);
  Future<void> deleteSubscription(String subscriptionId);
  Future<void> toggleActive(String subscriptionId, bool isActive);
}
