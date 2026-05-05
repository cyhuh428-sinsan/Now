import 'dart:convert';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/database/app_database.dart';
import '../repository_providers.dart';

const _uuid = Uuid();
const _userId = 'local_user';

class TripRepository {
  final AppDatabase _db;
  TripRepository(this._db);

  // ── 전체 목록 ──
  Future<List<Trip>> getAll() {
    return (_db.select(_db.trips)
          ..where((t) => t.userId.equals(_userId))
          ..orderBy([(t) => OrderingTerm.desc(t.startDate)]))
        .get();
  }

  // ── 단건 ──
  Future<Trip?> getById(String tripId) {
    return (_db.select(_db.trips)
          ..where((t) => t.tripId.equals(tripId)))
        .getSingleOrNull();
  }

  // ── 생성 ──
  Future<String> create({
    required String name,
    required String destination,
    required DateTime startDate,
    required DateTime endDate,
    int budgetTotal = 0,
    Map<String, int>? budgetByCategory,
  }) async {
    final id = _uuid.v4();
    await _db.into(_db.trips).insert(
      TripsCompanion.insert(
        tripId: id,
        userId: _userId,
        name: name,
        destination: destination,
        startDate: startDate,
        endDate: endDate,
        budgetTotal: Value(budgetTotal),
        budgetJson: Value(jsonEncode(budgetByCategory ?? {
          '항공': 0, '숙박': 0, '식비': 0, '관광': 0, '기타': 0,
        })),
      ),
    );
    return id;
  }

  // ── 상태 변경 ──
  Future<void> updateStatus(String tripId, String status) async {
    await (_db.update(_db.trips)..where((t) => t.tripId.equals(tripId)))
        .write(TripsCompanion(status: Value(status)));
  }

  // ── 후기 저장 ──
  Future<void> saveReview(String tripId, {int? rating, String? review, String? llmSummary, String? reviewPhotosJson}) async {
    await (_db.update(_db.trips)..where((t) => t.tripId.equals(tripId)))
        .write(TripsCompanion(
      status: const Value('completed'),
      rating: Value(rating),
      review: Value(review),
      llmSummary: Value(llmSummary),
      reviewPhotosJson: Value(reviewPhotosJson),
    ));
  }

  // ── 삭제 ──
  Future<void> delete(String tripId) async {
    await (_db.delete(_db.trips)..where((t) => t.tripId.equals(tripId))).go();
    await (_db.delete(_db.tripDayPlans)..where((t) => t.tripId.equals(tripId))).go();
    await (_db.delete(_db.tripChecklists)..where((t) => t.tripId.equals(tripId))).go();
  }

  // ── DayPlans ──
  Future<List<TripDayPlan>> getDayPlans(String tripId) {
    return (_db.select(_db.tripDayPlans)
          ..where((t) => t.tripId.equals(tripId))
          ..orderBy([
            (t) => OrderingTerm.asc(t.date),
            (t) => OrderingTerm.asc(t.sortOrder),
          ]))
        .get();
  }

  Future<String> addDayPlan({
    required String tripId,
    required DateTime date,
    required String title,
    String? originalTitle,
    String? content,
    int sortOrder = 0,
  }) async {
    final id = _uuid.v4();
    await _db.into(_db.tripDayPlans).insert(
      TripDayPlansCompanion.insert(
        planId: id,
        tripId: tripId,
        date: date,
        title: title,
        originalTitle: Value(originalTitle ?? title),
        content: Value(content),
        sortOrder: Value(sortOrder),
      ),
    );
    return id;
  }

  // status: pending | done | pass
  Future<void> updatePlanStatus(String planId, String status) async {
    await (_db.update(_db.tripDayPlans)..where((t) => t.planId.equals(planId)))
        .write(TripDayPlansCompanion(status: Value(status)));
  }

  Future<void> updatePlanDetail(String planId, {
    String? title,
    String? actualNote,
    String? photoUri,
  }) async {
    await (_db.update(_db.tripDayPlans)..where((t) => t.planId.equals(planId)))
        .write(TripDayPlansCompanion(
      title: title != null ? Value(title) : const Value.absent(),
      actualNote: actualNote != null ? Value(actualNote) : const Value.absent(),
      photoUri: photoUri != null ? Value(photoUri) : const Value.absent(),
    ));
  }

  Future<void> deleteDayPlan(String planId) async {
    await (_db.delete(_db.tripDayPlans)..where((t) => t.planId.equals(planId))).go();
  }

  // ── Checklists ──
  Future<List<TripChecklist>> getChecklists(String tripId) {
    return (_db.select(_db.tripChecklists)
          ..where((t) => t.tripId.equals(tripId))
          ..orderBy([(t) => OrderingTerm.asc(t.sortOrder)]))
        .get();
  }

  Future<String> addChecklist({
    required String tripId,
    required String item,
    String? category,
    int sortOrder = 0,
  }) async {
    final id = _uuid.v4();
    await _db.into(_db.tripChecklists).insert(
      TripChecklistsCompanion.insert(
        checkId: id,
        tripId: tripId,
        item: item,
        category: Value(category),
        sortOrder: Value(sortOrder),
      ),
    );
    return id;
  }

  Future<void> toggleChecklist(String checkId, bool isDone) async {
    await (_db.update(_db.tripChecklists)..where((t) => t.checkId.equals(checkId)))
        .write(TripChecklistsCompanion(isDone: Value(isDone)));
  }

  Future<void> deleteChecklist(String checkId) async {
    await (_db.delete(_db.tripChecklists)..where((t) => t.checkId.equals(checkId))).go();
  }
}

// ── Providers ──
final tripRepositoryProvider = Provider<TripRepository>((ref) {
  return TripRepository(ref.watch(appDatabaseProvider));
});

final tripsProvider = FutureProvider.autoDispose<List<Trip>>((ref) {
  return ref.watch(tripRepositoryProvider).getAll();
});

final tripDetailProvider = FutureProvider.autoDispose.family<Trip?, String>((ref, id) {
  return ref.watch(tripRepositoryProvider).getById(id);
});

final tripDayPlansProvider = FutureProvider.autoDispose.family<List<TripDayPlan>, String>((ref, tripId) {
  return ref.watch(tripRepositoryProvider).getDayPlans(tripId);
});

final tripChecklistsProvider = FutureProvider.autoDispose.family<List<TripChecklist>, String>((ref, tripId) {
  return ref.watch(tripRepositoryProvider).getChecklists(tripId);
});
