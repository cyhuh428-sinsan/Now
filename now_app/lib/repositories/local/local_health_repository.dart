import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../../core/database/app_database.dart';
import '../interfaces/health_repository.dart';

class LocalHealthRepository implements HealthRepository {
  final AppDatabase _db;

  LocalHealthRepository(this._db);

  // ── 약/영양제 ──

  @override
  Future<MedicationRecord> saveMedication(
      MedicationRecordsCompanion med) async {
    await _db.into(_db.medicationRecords).insert(med);
    return await (_db.select(_db.medicationRecords)
          ..where((t) => t.medicationId.equals(med.medicationId.value)))
        .getSingle();
  }

  @override
  Future<List<MedicationRecord>> getMedicationsByDate(
      String userId, DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));
    return await (_db.select(_db.medicationRecords)
          ..where((t) =>
              t.userId.equals(userId) &
              t.takenAt.isBiggerOrEqualValue(start) &
              t.takenAt.isSmallerThanValue(end))
          ..orderBy([(t) => OrderingTerm.asc(t.takenAt)]))
        .get();
  }

  @override
  Future<void> deleteMedication(String medicationId) async {
    await (_db.delete(_db.medicationRecords)
          ..where((t) => t.medicationId.equals(medicationId)))
        .go();
  }

  // ── 운동 ──

  @override
  Future<ExerciseRecord> saveExercise(ExerciseRecordsCompanion exercise) async {
    await _db.into(_db.exerciseRecords).insert(exercise);
    return await (_db.select(_db.exerciseRecords)
          ..where((t) => t.exerciseId.equals(exercise.exerciseId.value)))
        .getSingle();
  }

  @override
  Future<List<ExerciseRecord>> getExercisesByDate(
      String userId, DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));
    return await (_db.select(_db.exerciseRecords)
          ..where((t) =>
              t.userId.equals(userId) &
              t.startedAt.isBiggerOrEqualValue(start) &
              t.startedAt.isSmallerThanValue(end))
          ..orderBy([(t) => OrderingTerm.asc(t.startedAt)]))
        .get();
  }

  @override
  Future<void> deleteExercise(String exerciseId) async {
    await (_db.delete(_db.exerciseRecords)
          ..where((t) => t.exerciseId.equals(exerciseId)))
        .go();
  }

  // ── 병원 ──

  @override
  Future<HospitalRecord> saveHospital(HospitalRecordsCompanion hospital) async {
    await _db.into(_db.hospitalRecords).insert(hospital);
    final saved = await (_db.select(_db.hospitalRecords)
          ..where((t) => t.hospitalId.equals(hospital.hospitalId.value)))
        .getSingle();
    // 병원비가 있으면 살림 지출에도 저장
    if (saved.amount != null && saved.amount! > 0) {
      await _db.into(_db.transactions).insert(
        TransactionsCompanion.insert(
          transactionId: const Uuid().v4(),
          userId: saved.userId,
          extractedId: Value(saved.hospitalId),
          direction: '지출',
          amount: saved.amount!,
          category: const Value('의료비'),
          memo: Value(saved.hospitalName),
          occurredAt: Value(saved.visitedAt),
          source: const Value('health'),
        ),
      );
    }
    return saved;
  }

  @override
  Future<List<HospitalRecord>> getHospitalsByDate(
      String userId, DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));
    return await (_db.select(_db.hospitalRecords)
          ..where((t) =>
              t.userId.equals(userId) &
              t.visitedAt.isBiggerOrEqualValue(start) &
              t.visitedAt.isSmallerThanValue(end))
          ..orderBy([(t) => OrderingTerm.asc(t.visitedAt)]))
        .get();
  }

  @override
  Future<void> deleteHospital(String hospitalId) async {
    await (_db.delete(_db.hospitalRecords)
          ..where((t) => t.hospitalId.equals(hospitalId)))
        .go();
  }

  // ── 수면 ──

  @override
  Future<SleepRecord> saveSleep(SleepRecordsCompanion sleep) async {
    await _db.into(_db.sleepRecords).insert(sleep);
    return await (_db.select(_db.sleepRecords)
          ..where((t) => t.sleepId.equals(sleep.sleepId.value)))
        .getSingle();
  }

  @override
  Future<List<SleepRecord>> getSleepByDate(
      String userId, DateTime date) async {
    final start = DateTime(date.year, date.month, date.day);
    final end = start.add(const Duration(days: 1));
    return await (_db.select(_db.sleepRecords)
          ..where((t) =>
              t.userId.equals(userId) &
              t.bedAt.isBiggerOrEqualValue(start) &
              t.bedAt.isSmallerThanValue(end))
          ..orderBy([(t) => OrderingTerm.asc(t.bedAt)]))
        .get();
  }

  @override
  Future<void> updateSleep(String sleepId, SleepRecordsCompanion data) async {
    await (_db.update(_db.sleepRecords)
          ..where((t) => t.sleepId.equals(sleepId)))
        .write(data);
  }

  @override
  Future<void> deleteSleep(String sleepId) async {
    await (_db.delete(_db.sleepRecords)
          ..where((t) => t.sleepId.equals(sleepId)))
        .go();
  }
}
