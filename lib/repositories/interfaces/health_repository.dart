import '../../core/database/app_database.dart';

abstract class HealthRepository {
  // ── 약/영양제 ──
  Future<MedicationRecord> saveMedication(MedicationRecordsCompanion med);
  Future<List<MedicationRecord>> getMedicationsByDate(String userId, DateTime date);
  Future<void> deleteMedication(String medicationId);

  // ── 운동 ──
  Future<ExerciseRecord> saveExercise(ExerciseRecordsCompanion exercise);
  Future<List<ExerciseRecord>> getExercisesByDate(String userId, DateTime date);
  Future<void> deleteExercise(String exerciseId);

  // ── 병원 ──
  Future<HospitalRecord> saveHospital(HospitalRecordsCompanion hospital);
  Future<List<HospitalRecord>> getHospitalsByDate(String userId, DateTime date);
  Future<void> deleteHospital(String hospitalId);

  // ── 수면 ──
  Future<SleepRecord> saveSleep(SleepRecordsCompanion sleep);
  Future<void> updateSleep(String sleepId, SleepRecordsCompanion data);
  Future<List<SleepRecord>> getSleepByDate(String userId, DateTime date);
  Future<void> deleteSleep(String sleepId);
}
