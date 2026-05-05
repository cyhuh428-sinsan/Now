import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/database/app_database.dart';
import 'interfaces/meal_repository.dart';
import 'interfaces/context_repository.dart';
import 'interfaces/health_repository.dart';
import 'interfaces/calendar_event_repository.dart';
import 'interfaces/item_repository.dart';
import 'interfaces/routine_repository.dart';
import 'interfaces/fashion_repository.dart';
import 'interfaces/prepare_repository.dart';
import 'interfaces/subscription_repository.dart';
import 'local/local_meal_repository.dart';
import 'local/local_context_repository.dart';
import 'local/local_health_repository.dart';
import 'local/local_calendar_event_repository.dart';
import 'local/local_item_repository.dart';
import 'local/local_routine_repository.dart';
import 'local/local_fashion_repository.dart';
import 'local/local_prepare_repository.dart';
import 'local/local_subscription_repository.dart';
import 'local/local_meeting_repository.dart';

part 'repository_providers.g.dart';

// Meeting Repository (인터페이스 없음 — 직접 구현체 사용)
final localMeetingRepositoryProvider = Provider<LocalMeetingRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalMeetingRepository(db);
}); 

// ============================================================
// DB Provider
// ============================================================

@riverpod
AppDatabase appDatabase(AppDatabaseRef ref) {
  final db = AppDatabase();
  ref.onDispose(db.close);
  return db;
}

// ============================================================
// Repository Providers
// 2차-B 서버 전환 시 Local → Server 구현체로 교체만 하면 됨
// ============================================================

@riverpod
MealRepository mealRepository(MealRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalMealRepository(db);
}

@riverpod
ContextRepository contextRepository(ContextRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalContextRepository(db);
}

@riverpod
HealthRepository healthRepository(HealthRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalHealthRepository(db);
}

@riverpod
CalendarEventRepository calendarEventRepository(
    CalendarEventRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalCalendarEventRepository(db);
}

@riverpod
ItemRepository itemRepository(ItemRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalItemRepository(db);
}

@riverpod
RoutineRepository routineRepository(RoutineRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalRoutineRepository(db);
}

@riverpod
FashionRepository fashionRepository(FashionRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalFashionRepository(db);
}

@riverpod
PrepareRepository prepareRepository(PrepareRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalPrepareRepository(db);
}

@riverpod
SubscriptionRepository subscriptionRepository(SubscriptionRepositoryRef ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalSubscriptionRepository(db);
}

final localCalendarEventRepositoryProvider = Provider<LocalCalendarEventRepository>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return LocalCalendarEventRepository(db);
});