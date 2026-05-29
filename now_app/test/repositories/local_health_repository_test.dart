import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/core/database/app_database.dart';
import 'package:now_note/repositories/local/local_health_repository.dart';

void main() {
  group('LocalHealthRepository', () {
    late AppDatabase database;
    late LocalHealthRepository repository;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
      repository = LocalHealthRepository(database);
    });

    tearDown(() async {
      await database.close();
    });

    // ── 약/영양제 ──

    test('saveMedication stores and returns record', () async {
      final record = await repository.saveMedication(
        MedicationRecordsCompanion.insert(
          medicationId: 'med-1',
          userId: 'local_user',
          name: '비타민C',
          dosage: const Value('1정'),
        ),
      );
      expect(record.medicationId, 'med-1');
      expect(record.name, '비타민C');
    });

    test('getMedicationsByDate filters by date', () async {
      final today = DateTime(2026, 5, 30, 8, 0);
      final yesterday = DateTime(2026, 5, 29, 8, 0);

      await repository.saveMedication(
        MedicationRecordsCompanion.insert(
          medicationId: 'med-today',
          userId: 'local_user',
          name: '오늘 약',
          takenAt: Value(today),
        ),
      );
      await repository.saveMedication(
        MedicationRecordsCompanion.insert(
          medicationId: 'med-yesterday',
          userId: 'local_user',
          name: '어제 약',
          takenAt: Value(yesterday),
        ),
      );

      final results = await repository.getMedicationsByDate('local_user', today);
      expect(results.length, 1);
      expect(results.first.medicationId, 'med-today');
    });

    test('deleteMedication removes the record', () async {
      await repository.saveMedication(
        MedicationRecordsCompanion.insert(
          medicationId: 'med-del',
          userId: 'local_user',
          name: '삭제 약',
        ),
      );

      await repository.deleteMedication('med-del');

      final results = await repository.getMedicationsByDate('local_user', DateTime.now());
      expect(results, isEmpty);
    });

    // ── 운동 ──

    test('saveExercise stores and returns record', () async {
      final record = await repository.saveExercise(
        ExerciseRecordsCompanion.insert(
          exerciseId: 'ex-1',
          userId: 'local_user',
          exerciseType: '달리기',
          durationMinutes: const Value(30),
          intensity: const Value('중간'),
        ),
      );
      expect(record.exerciseId, 'ex-1');
      expect(record.exerciseType, '달리기');
      expect(record.durationMinutes, 30);
    });

    test('getExercisesByDate filters by date', () async {
      final today = DateTime(2026, 5, 30, 7, 0);
      final tomorrow = DateTime(2026, 5, 31, 7, 0);

      await repository.saveExercise(
        ExerciseRecordsCompanion.insert(
          exerciseId: 'ex-today',
          userId: 'local_user',
          exerciseType: '수영',
          startedAt: Value(today),
        ),
      );
      await repository.saveExercise(
        ExerciseRecordsCompanion.insert(
          exerciseId: 'ex-tomorrow',
          userId: 'local_user',
          exerciseType: '자전거',
          startedAt: Value(tomorrow),
        ),
      );

      final results = await repository.getExercisesByDate('local_user', today);
      expect(results.length, 1);
      expect(results.first.exerciseId, 'ex-today');
    });

    test('deleteExercise removes the record', () async {
      await repository.saveExercise(
        ExerciseRecordsCompanion.insert(
          exerciseId: 'ex-del',
          userId: 'local_user',
          exerciseType: '요가',
        ),
      );

      await repository.deleteExercise('ex-del');

      final results = await repository.getExercisesByDate('local_user', DateTime.now());
      expect(results, isEmpty);
    });

    // ── 수면 ──

    test('saveSleep stores and returns record', () async {
      final bedTime = DateTime(2026, 5, 29, 23, 0);
      final wakeTime = DateTime(2026, 5, 30, 7, 0);

      final record = await repository.saveSleep(
        SleepRecordsCompanion.insert(
          sleepId: 'sleep-1',
          userId: 'local_user',
          bedAt: bedTime,
          wokeAt: Value(wakeTime),
          qualityScore: const Value(4),
        ),
      );

      expect(record.sleepId, 'sleep-1');
      expect(record.qualityScore, 4);
    });

    test('updateSleep changes qualityScore', () async {
      final bedTime = DateTime(2026, 5, 30, 22, 30);
      await repository.saveSleep(
        SleepRecordsCompanion.insert(
          sleepId: 'sleep-upd',
          userId: 'local_user',
          bedAt: bedTime,
          qualityScore: const Value(3),
        ),
      );

      await repository.updateSleep(
        'sleep-upd',
        SleepRecordsCompanion(qualityScore: const Value(5)),
      );

      final records = await repository.getSleepByDate('local_user', bedTime);
      expect(records.first.qualityScore, 5);
    });

    test('deleteSleep removes the record', () async {
      final bedTime = DateTime(2026, 5, 30, 23, 30);
      await repository.saveSleep(
        SleepRecordsCompanion.insert(
          sleepId: 'sleep-del',
          userId: 'local_user',
          bedAt: bedTime,
        ),
      );

      await repository.deleteSleep('sleep-del');

      final records = await repository.getSleepByDate('local_user', bedTime);
      expect(records, isEmpty);
    });

    // ── 병원 ──

    test('saveHospital with amount creates linked transaction', () async {
      await repository.saveHospital(
        HospitalRecordsCompanion.insert(
          hospitalId: 'hosp-1',
          userId: 'local_user',
          hospitalName: '서울병원',
          visitedAt: Value(DateTime(2026, 5, 30, 10, 0)),
          amount: const Value(15000),
        ),
      );

      final txs = await (database.select(database.transactions)
            ..where((t) => t.extractedId.equals('hosp-1')))
          .get();
      expect(txs.length, 1);
      expect(txs.first.amount, 15000);
      expect(txs.first.category, '의료비');
    });

    test('saveHospital without amount does not create transaction', () async {
      await repository.saveHospital(
        HospitalRecordsCompanion.insert(
          hospitalId: 'hosp-2',
          userId: 'local_user',
          hospitalName: '검진센터',
          visitedAt: Value(DateTime(2026, 5, 30, 11, 0)),
        ),
      );

      final txs = await (database.select(database.transactions)
            ..where((t) => t.extractedId.equals('hosp-2')))
          .get();
      expect(txs, isEmpty);
    });
  });
}
