import 'package:health/health.dart';
import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';
import '../repositories/interfaces/health_repository.dart';
import '../core/database/app_database.dart';

// ============================================================
// 결과 모델
// ============================================================

class HealthSyncResult {
  final bool success;
  final int exerciseCount;
  final int sleepCount;
  final String? error;

  const HealthSyncResult({
    required this.success,
    this.exerciseCount = 0,
    this.sleepCount = 0,
    this.error,
  });

  String get summary {
    if (!success) return '동기화 실패: $error';
    if (exerciseCount == 0 && sleepCount == 0) return '새로운 데이터가 없습니다';
    final parts = <String>[];
    if (exerciseCount > 0) parts.add('운동 $exerciseCount건');
    if (sleepCount > 0) parts.add('수면 $sleepCount건');
    return '${parts.join(', ')} 동기화 완료';
  }
}

// ============================================================
// 동기화 서비스
// ============================================================

class HealthSyncService {
  final HealthRepository _healthRepo;
  static const _userId = 'local_user';
  static const _uuid = Uuid();

  static final _types = [
    HealthDataType.STEPS,
    HealthDataType.WORKOUT,
    HealthDataType.SLEEP_ASLEEP,
    HealthDataType.SLEEP_IN_BED,
    HealthDataType.ACTIVE_ENERGY_BURNED,
  ];

  HealthSyncService(this._healthRepo);

  // ── 권한 요청 ──

  Future<bool> requestPermissions() async {
    try {
      final health = Health();
      await health.configure();
      final permissions = List.filled(_types.length, HealthDataAccess.READ);
      return await health.requestAuthorization(_types, permissions: permissions);
    } catch (e) {
      return false;
    }
  }

  // ── 오늘 + 어제 데이터 동기화 ──

  Future<HealthSyncResult> syncRecentDays({int days = 2}) async {
    final now = DateTime.now();
    final from = DateTime(now.year, now.month, now.day)
        .subtract(Duration(days: days - 1));
    return _sync(from, now);
  }

  // ── 핵심 동기화 로직 ──

  Future<HealthSyncResult> _sync(DateTime from, DateTime to) async {
    int exerciseCount = 0;
    int sleepCount = 0;

    try {
      final health = Health();
      await health.configure();

      final rawData = await health.getHealthDataFromTypes(
        startTime: from,
        endTime: to,
        types: _types,
      );
      final data = health.removeDuplicates(rawData);

      // ── 걸음수 → 걷기 운동으로 변환 (일별 합산) ──
      final stepsData =
          data.where((d) => d.type == HealthDataType.STEPS).toList();
      if (stepsData.isNotEmpty) {
        final byDay = <String, List<HealthDataPoint>>{};
        for (final d in stepsData) {
          final key =
              '${d.dateFrom.year}-${d.dateFrom.month.toString().padLeft(2, '0')}-${d.dateFrom.day.toString().padLeft(2, '0')}';
          byDay.putIfAbsent(key, () => []).add(d);
        }
        for (final entry in byDay.entries) {
          final totalSteps = entry.value.fold<double>(0, (sum, d) {
            final v = d.value;
            return sum + (v is NumericHealthValue ? v.numericValue.toDouble() : 0);
          });
          if (totalSteps < 500) continue;

          final sample = entry.value.first.dateFrom;
          final dayStart = DateTime(sample.year, sample.month, sample.day, 0, 0);
          final dayEnd = DateTime(sample.year, sample.month, sample.day, 23, 59);
          final saved = await _saveExerciseIfNotDuplicate(
            startedAt: dayStart,
            endedAt: dayEnd,
            exerciseType: 'walking',
            durationMinutes: (totalSteps / 100).round().clamp(1, 180),
            intensity: totalSteps >= 10000
                ? 'high'
                : totalSteps >= 6000
                    ? 'medium'
                    : 'low',
            memo: '[건강앱] 걸음수: ${totalSteps.toInt()}걸음',
            estimatedCalories: (totalSteps * 0.04).round(),
          );
          if (saved) exerciseCount++;
        }
      }

      // ── 워크아웃 처리 ──
      final workouts =
          data.where((d) => d.type == HealthDataType.WORKOUT).toList();
      for (final workout in workouts) {
        final duration =
            workout.dateTo.difference(workout.dateFrom).inMinutes;
        if (duration < 1) continue;

        int? calories;
        if (workout.value is WorkoutHealthValue) {
          final wv = workout.value as WorkoutHealthValue;
          if (wv.totalEnergyBurned != null) {
            calories = wv.totalEnergyBurned!.round();
          }
        }

        final saved = await _saveExerciseIfNotDuplicate(
          startedAt: workout.dateFrom,
          endedAt: workout.dateTo,
          exerciseType: _mapWorkoutType(workout),
          durationMinutes: duration,
          intensity: 'medium',
          memo: '[건강앱] ${workout.sourceName}',
          estimatedCalories: calories,
        );
        if (saved) exerciseCount++;
      }

      // ── 수면 처리 ──
      final sleepData = data
          .where((d) =>
              d.type == HealthDataType.SLEEP_ASLEEP ||
              d.type == HealthDataType.SLEEP_IN_BED)
          .toList();
      if (sleepData.isNotEmpty) {
        sleepData.sort((a, b) => a.dateFrom.compareTo(b.dateFrom));
        final sessions = _mergeSleepSessions(sleepData);
        for (final session in sessions) {
          final duration =
              session.$2.difference(session.$1).inMinutes;
          if (duration < 30) continue;
          final saved = await _saveSleepIfNotDuplicate(
            bedAt: session.$1,
            wokeAt: session.$2,
            memo: '[건강앱] 자동 동기화',
          );
          if (saved) sleepCount++;
        }
      }

      return HealthSyncResult(
        success: true,
        exerciseCount: exerciseCount,
        sleepCount: sleepCount,
      );
    } catch (e) {
      return HealthSyncResult(success: false, error: e.toString());
    }
  }

  // ── 수면 세션 병합 (30분 이하 간격은 연속으로 처리) ──

  List<(DateTime, DateTime)> _mergeSleepSessions(
      List<HealthDataPoint> data) {
    if (data.isEmpty) return [];
    final sessions = <(DateTime, DateTime)>[];
    var start = data.first.dateFrom;
    var end = data.first.dateTo;

    for (int i = 1; i < data.length; i++) {
      final d = data[i];
      if (d.dateFrom.difference(end).inMinutes <= 30) {
        if (d.dateTo.isAfter(end)) end = d.dateTo;
      } else {
        sessions.add((start, end));
        start = d.dateFrom;
        end = d.dateTo;
      }
    }
    sessions.add((start, end));
    return sessions;
  }

  // ── 중복 방지 저장: 운동 ──

  Future<bool> _saveExerciseIfNotDuplicate({
    required DateTime startedAt,
    required DateTime? endedAt,
    required String exerciseType,
    required int? durationMinutes,
    required String? intensity,
    required String? memo,
    required int? estimatedCalories,
  }) async {
    final existing =
        await _healthRepo.getExercisesByDate(_userId, startedAt);
    final isDuplicate = existing.any((e) =>
        e.memo != null &&
        e.memo!.contains('[건강앱]') &&
        e.exerciseType == exerciseType &&
        e.startedAt.difference(startedAt).abs() < const Duration(hours: 1));
    if (isDuplicate) return false;

    await _healthRepo.saveExercise(
      ExerciseRecordsCompanion.insert(
        exerciseId: _uuid.v4(),
        userId: _userId,
        exerciseType: exerciseType,
        startedAt: Value(startedAt),
        endedAt: Value(endedAt),
        durationMinutes: Value(durationMinutes),
        intensity: Value(intensity),
        memo: Value(memo),
        estimatedCalories: Value(estimatedCalories),
      ),
    );
    return true;
  }

  // ── 중복 방지 저장: 수면 ──

  Future<bool> _saveSleepIfNotDuplicate({
    required DateTime bedAt,
    required DateTime wokeAt,
    required String? memo,
  }) async {
    final existing = await _healthRepo.getSleepByDate(_userId, bedAt);
    final isDuplicate = existing.any((e) =>
        e.memo != null &&
        e.memo!.contains('[건강앱]') &&
        e.bedAt.difference(bedAt).abs() < const Duration(minutes: 30));
    if (isDuplicate) return false;

    await _healthRepo.saveSleep(
      SleepRecordsCompanion.insert(
        sleepId: _uuid.v4(),
        userId: _userId,
        bedAt: bedAt,
        wokeAt: Value(wokeAt),
        memo: Value(memo),
      ),
    );
    return true;
  }

  // ── 운동 타입 매핑 ──

  String _mapWorkoutType(HealthDataPoint workout) {
    if (workout.value is! WorkoutHealthValue) return 'etc';
    final wv = workout.value as WorkoutHealthValue;
    switch (wv.workoutActivityType) {
      case HealthWorkoutActivityType.RUNNING:
        return 'running';
      case HealthWorkoutActivityType.BIKING: // Android: BIKING, iOS: CYCLING (동일)
        return 'cycling';
      case HealthWorkoutActivityType.SWIMMING:
      case HealthWorkoutActivityType.SWIMMING_OPEN_WATER:
        return 'swimming';
      case HealthWorkoutActivityType.YOGA:
        return 'yoga';
      case HealthWorkoutActivityType.TRADITIONAL_STRENGTH_TRAINING:
      case HealthWorkoutActivityType.FUNCTIONAL_STRENGTH_TRAINING:
      case HealthWorkoutActivityType.CROSS_TRAINING:
        return 'gym';
      case HealthWorkoutActivityType.WALKING:
        return 'walking';
      default:
        return 'etc';
    }
  }
}
