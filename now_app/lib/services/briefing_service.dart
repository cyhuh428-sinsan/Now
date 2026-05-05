import 'dart:convert';
import 'dart:math';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import '../core/database/app_database.dart';
import '../repositories/repository_providers.dart';
import '../llm/providers/llm_providers.dart';

const _uuid = Uuid();
const _userId = 'local_user';

// ============================================================
// 브리핑 서비스
// ============================================================

class BriefingService {
  final AppDatabase _db;
  final dynamic _llm; // BaseLlmRepository

  BriefingService(this._db, this._llm);

  // ── 오늘 브리핑 생성 (메인 진입점) ──
  Future<Briefing?> generateTodayBriefing() async {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

    final existing = await (_db.select(_db.briefings)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.dateKey.equals(today)))
        .getSingleOrNull();
    if (existing != null) return existing;

    if (_llm == null) return null;

    final data = await _collectData();
    final rolling = await _loadRollingSummary();
    final prompt = _buildPrompt(data, rolling);
    final response = await _llm.chat(prompt);
    final parsed = _parseResponse(response);

    final briefingId = _uuid.v4();
    await _db.into(_db.briefings).insert(
      BriefingsCompanion.insert(
        briefingId: briefingId,
        userId: _userId,
        dateKey: today,
        mustDoJson: Value(parsed['mustDo'] ?? '[]'),
        tasksJson: Value(parsed['tasks'] ?? '[]'),
        advice: Value(parsed['advice']),
        adviceBasis: Value(parsed['adviceBasis']),
      ),
    );

    // Rolling Summary 고도화 업데이트 (LLM 기반)
    await _updateRollingSummary(data, parsed['advice']);

    return (_db.select(_db.briefings)
          ..where((t) => t.briefingId.equals(briefingId)))
        .getSingle();
  }

  // ── 오늘 브리핑 삭제 (강제 재생성용) ──
  Future<void> deleteTodayBriefing() async {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await (_db.delete(_db.briefings)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.dateKey.equals(today)))
        .go();
  }

  // ── 데이터 수집 ──
  Future<Map<String, dynamic>> _collectData() async {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final sevenDaysAgo = today.subtract(const Duration(days: 7));
    final monthStart = DateTime(now.year, now.month, 1);

    // 오늘 일정
    final todayEvents = await (_db.select(_db.calendarEvents)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.startTime.isBiggerOrEqualValue(today))
          ..where((t) => t.startTime.isSmallerThanValue(tomorrow))
          ..orderBy([(t) => OrderingTerm.asc(t.startTime)]))
        .get();

    // 미완료 Action/Task
    final pendingItems = await (_db.select(_db.extractedItems)
          ..where((t) => t.status.equals('confirmed'))
          ..where((t) => t.completedAt.isNull())
          ..where((t) => t.archivedAt.isNull()))
        .get();

    // 오늘 결제 예정 구독
    final todaySubscriptions = await (_db.select(_db.subscriptionItems)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.isActive.equals(true))
          ..where((t) => t.billingDay.equals(now.day)))
        .get();

    // 이번 달 활성 구독 전체 (교차 브리핑용)
    final allSubscriptions = await (_db.select(_db.subscriptionItems)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.isActive.equals(true)))
        .get();

    // 최근 7일 수면
    final sleepRecords = await (_db.select(_db.sleepRecords)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.bedAt.isBiggerOrEqualValue(sevenDaysAgo)))
        .get();

    // 최근 7일 지출
    final expenses = await (_db.select(_db.transactions)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.direction.equals('지출'))
          ..where((t) =>
              t.occurredAt.isBiggerOrEqualValue(sevenDaysAgo)))
        .get();

    // 이번 달 수입
    final incomes = await (_db.select(_db.transactions)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.direction.equals('수입'))
          ..where((t) =>
              t.occurredAt.isBiggerOrEqualValue(monthStart)))
        .get();

    // 최근 7일 운동 (Rolling Summary 고도화용)
    final exercises = await (_db.select(_db.exerciseRecords)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.startedAt.isBiggerOrEqualValue(sevenDaysAgo)))
        .get();

    // 최근 7일 식사 (Rolling Summary 고도화용)
    final meals = await (_db.select(_db.mealRecords)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.eatenAt.isBiggerOrEqualValue(sevenDaysAgo)))
        .get();

    // 루틴 (오늘 해당)
    final routines = await (_db.select(_db.routineItems)
          ..where((t) => t.userId.equals(_userId))
          ..where((t) => t.isEnabled.equals(true)))
        .get();

    // 월 구독 총액 계산 (교차 브리핑용)
    final monthlySubTotal = allSubscriptions.fold(0, (sum, s) =>
        sum + (s.cycle == 'monthly' ? s.amount : (s.amount / 12).round()));

    return {
      'todayEvents': todayEvents,
      'pendingItems': pendingItems,
      'subscriptions': todaySubscriptions,       // 오늘 결제 예정
      'allSubscriptions': allSubscriptions,       // 전체 구독
      'monthlySubTotal': monthlySubTotal,         // 월 구독 총액
      'sleepRecords': sleepRecords,
      'expenses': expenses,
      'incomes': incomes,
      'exercises': exercises,
      'meals': meals,
      'routines': routines,
    };
  }

  // ── Rolling Summary 로드 ──
  Future<RollingSummary?> _loadRollingSummary() async {
    return (_db.select(_db.rollingSummaries)
          ..where((t) => t.userId.equals(_userId)))
        .getSingleOrNull();
  }

  // ── LLM 브리핑 프롬프트 ──
  String _buildPrompt(
      Map<String, dynamic> data, RollingSummary? rolling) {
    final now = DateTime.now();
    final todayStr = DateFormat('yyyy년 M월 d일 EEEE', 'ko').format(now);

    final events = data['todayEvents'] as List<CalendarEvent>;
    final pending = data['pendingItems'] as List<ExtractedItem>;
    final subs = data['subscriptions'] as List<SubscriptionItem>;
    final sleeps = data['sleepRecords'] as List<SleepRecord>;
    final expenses = data['expenses'] as List<Transaction>;
    final incomes = data['incomes'] as List<Transaction>;
    final monthlySubTotal = data['monthlySubTotal'] as int? ?? 0;

    // 수면 평균 계산
    final sleepHours = sleeps
        .where((s) => s.wokeAt != null)
        .map((s) {
          final woke = s.wokeAt!.isBefore(s.bedAt)
              ? s.wokeAt!.add(const Duration(days: 1))
              : s.wokeAt!;
          return woke.difference(s.bedAt).inHours;
        })
        .toList();
    final avgSleep = sleepHours.isEmpty
        ? null
        : sleepHours.reduce((a, b) => a + b) / sleepHours.length;

    // 7일 지출 합계
    final totalExpense =
        expenses.fold(0, (sum, t) => sum + t.amount);

    // 이번 달 수입 합계
    final totalIncome =
        incomes.fold(0, (sum, t) => sum + t.amount);

    final fmt = NumberFormat('#,###');

    // 카테고리별 지출 분석
    final categoryMap = <String, int>{};
    for (final t in expenses) {
      final cat = t.category ?? '기타';
      categoryMap[cat] = (categoryMap[cat] ?? 0) + t.amount;
    }
    final topCategories = (categoryMap.entries.toList()
          ..sort((a, b) => b.value.compareTo(a.value)))
        .take(3)
        .map((e) => '${e.key} ${fmt.format(e.value)}원')
        .join(', ');

    // 구독 vs 실소비 교차 분석
    final estimatedWeeklySubCost = (monthlySubTotal / 4).round();
    final realConsumption = max(0, totalExpense - estimatedWeeklySubCost);

    return '''
오늘 날짜: $todayStr

[앱 컨텍스트 — 반드시 숙지]
이 앱은 개인 일상 관리 앱입니다.
- "수입"은 실제 급여·소득이 아니라 이번 달 개인 용돈/생활비 예산입니다.
- 따라서 "수입 증대", "부업", "재테크" 등 소득 관련 조언은 절대 금지합니다.
- 재정 조언은 예산 대비 지출 비중, 구독 합리성, 소비 습관 개선에만 집중하세요.

[오늘 일정]
${events.isEmpty ? '없음' : events.map((e) => '- ${DateFormat('HH:mm').format(e.startTime)} ${e.title}').join('\n')}

[오늘 결제 예정 구독]
${subs.isEmpty ? '없음' : subs.map((s) => '- ${s.name} ${fmt.format(s.amount)}원').join('\n')}

[미완료 할 일/Action]
${pending.isEmpty ? '없음' : pending.take(10).map((i) => '- [${i.itemType}] ${i.content}${i.dueDate != null ? ' (마감: ${i.dueDate})' : ''}').join('\n')}

[최근 7일 수면]
${avgSleep == null ? '데이터 없음' : '평균 ${avgSleep.toStringAsFixed(1)}시간'}

[최근 7일 지출 분석]
총 ${fmt.format(totalExpense)}원
주요 카테고리: ${topCategories.isEmpty ? '없음' : topCategories}

[이달 예산/용돈 vs 지출 분석]
월 정기결제 총액: ${fmt.format(monthlySubTotal)}원 (주당 환산 약 ${fmt.format(estimatedWeeklySubCost)}원)
최근 7일 실소비(구독 제외 추정): ${fmt.format(realConsumption)}원
이번 달 예산/용돈: ${fmt.format(totalIncome)}원

[누적 패턴 요약]
수면: ${rolling?.sleepSummary ?? '없음'}
지출: ${rolling?.expenseSummary ?? '없음'}
생활: ${rolling?.lifeSummary ?? '없음'}

[어제 조언 (중복 금지)]
${rolling?.lastAdvice ?? '없음'}

---
위 데이터를 분석해서 오늘의 브리핑을 생성하세요.

규칙:
1. 조언은 반드시 데이터 교차 해석 기반 (단순 나열 금지)
2. "수입 증대", "부업", "소득 증가" 관련 조언은 절대 금지 — 여기서 수입은 용돈/예산임
3. 재정 조언은 예산 대비 지출 비중, 구독 합리성, 소비 습관 개선에만 집중
4. 어제 조언과 중복 금지
5. 각 섹션 3줄 이내, 근거 없는 조언 금지

반드시 아래 JSON 형식으로만 응답:
{
  "mustDo": ["오늘 꼭 할 일 1", "오늘 꼭 할 일 2"],
  "tasks": ["할 일 1", "할 일 2"],
  "advice": "조언 (1~3줄, 교차 해석 기반)",
  "adviceBasis": "근거 데이터 한 줄 요약"
}
''';
  }

  // ── 응답 파싱 ──
  Map<String, String?> _parseResponse(String response) {
    try {
      final jsonStr =
          RegExp(r'\{[\s\S]*\}').firstMatch(response)?.group(0);
      if (jsonStr == null) return {};
      final decoded = jsonDecode(jsonStr) as Map<String, dynamic>;
      return {
        'mustDo': jsonEncode(decoded['mustDo'] ?? []),
        'tasks': jsonEncode(decoded['tasks'] ?? []),
        'advice': decoded['advice'] as String?,
        'adviceBasis': decoded['adviceBasis'] as String?,
      };
    } catch (_) {
      return {'advice': response};
    }
  }

  // ============================================================
  // Rolling Summary 고도화 (LLM 기반 패턴 분석)
  // ============================================================

  Future<void> _updateRollingSummary(
      Map<String, dynamic> data, String? todayAdvice) async {
    // LLM이 있으면 패턴 분석, 없으면 단순 집계로 폴백
    if (_llm != null) {
      await _updateRollingSummaryWithLlm(data, todayAdvice);
    } else {
      await _updateRollingSummarySimple(data, todayAdvice);
    }
  }

  // ── LLM 기반 Rolling Summary 업데이트 ──
  Future<void> _updateRollingSummaryWithLlm(
      Map<String, dynamic> data, String? todayAdvice) async {
    try {
      final prompt = _buildRollingPrompt(data);
      final response = await _llm.chat(prompt);
      final parsed = _parseRollingResponse(response);

      await _saveRollingSummary(
        sleepSummary: parsed['sleepSummary'],
        expenseSummary: parsed['expenseSummary'],
        lifeSummary: parsed['lifeSummary'],
        todayAdvice: todayAdvice,
      );
    } catch (_) {
      // LLM 실패 시 단순 집계로 폴백
      await _updateRollingSummarySimple(data, todayAdvice);
    }
  }

  // ── Rolling Summary LLM 프롬프트 ──
  String _buildRollingPrompt(Map<String, dynamic> data) {
    final sleeps = data['sleepRecords'] as List<SleepRecord>;
    final expenses = data['expenses'] as List<Transaction>;
    final exercises = data['exercises'] as List<ExerciseRecord>;
    final meals = data['meals'] as List<MealRecord>;
    final fmt = NumberFormat('#,###');

    // 수면 데이터 정리
    final sleepLines = sleeps
        .where((s) => s.wokeAt != null)
        .map((s) {
          final wokeFixed = s.wokeAt!.isBefore(s.bedAt)
              ? s.wokeAt!.add(const Duration(days: 1))
              : s.wokeAt!;
          final dur = wokeFixed.difference(s.bedAt);
          final bed = DateFormat('M/d HH:mm').format(s.bedAt);
          final woke = DateFormat('HH:mm').format(s.wokeAt!);
          return '  - $bed 취침 → $woke 기상 (${dur.inHours}시간 ${dur.inMinutes % 60}분)';
        })
        .join('\n');

    // 지출 카테고리 요약
    final categoryMap = <String, int>{};
    for (final t in expenses) {
      final cat = t.category ?? '기타';
      categoryMap[cat] = (categoryMap[cat] ?? 0) + t.amount;
    }
    final categoryLines = (categoryMap.entries.toList()
          ..sort((a, b) => b.value.compareTo(a.value)))
        .map((e) => '  - ${e.key}: ${fmt.format(e.value)}원')
        .join('\n');
    final totalExpense = expenses.fold(0, (sum, t) => sum + t.amount);

    // 운동 요약
    final exerciseLines = exercises.isEmpty
        ? '  - 기록 없음'
        : exercises
            .map((e) =>
                '  - ${e.exerciseType} ${e.durationMinutes != null ? "${e.durationMinutes}분" : ""} ${e.intensity ?? ""}')
            .join('\n');

    // 식사 요약
    final mealTypeCount = <String, int>{};
    for (final m in meals) {
      final t = m.mealType ?? '기타';
      mealTypeCount[t] = (mealTypeCount[t] ?? 0) + 1;
    }
    final mealLine = mealTypeCount.isEmpty
        ? '기록 없음'
        : mealTypeCount.entries
            .map((e) => '${e.key} ${e.value}회')
            .join(', ');

    return '''
다음 최근 7일간 데이터를 분석하여 각 도메인별 핵심 패턴을 파악하세요.

[수면 기록]
${sleepLines.isEmpty ? '  - 기록 없음' : sleepLines}

[지출 기록]
  총 ${fmt.format(totalExpense)}원
$categoryLines

[운동 기록]
$exerciseLines

[식사 기록]
  $mealLine

각 도메인의 패턴, 트렌드, 주목할 점을 1~2문장으로 요약하세요.
- 단순 수치 나열 금지, 트렌드·규칙성·이상징후 중심으로 서술
- 데이터가 없으면 null

반드시 아래 JSON 형식으로만 응답:
{
  "sleepSummary": "수면 패턴 요약 1~2문장 (없으면 null)",
  "expenseSummary": "지출 패턴 요약 1~2문장 (없으면 null)",
  "lifeSummary": "운동·식사 생활 패턴 요약 1~2문장 (없으면 null)"
}
''';
  }

  // ── Rolling 응답 파싱 ──
  Map<String, String?> _parseRollingResponse(String response) {
    try {
      final jsonStr =
          RegExp(r'\{[\s\S]*\}').firstMatch(response)?.group(0);
      if (jsonStr == null) return {};
      final decoded = jsonDecode(jsonStr) as Map<String, dynamic>;
      return {
        'sleepSummary': decoded['sleepSummary'] as String?,
        'expenseSummary': decoded['expenseSummary'] as String?,
        'lifeSummary': decoded['lifeSummary'] as String?,
      };
    } catch (_) {
      return {};
    }
  }

  // ── 단순 집계 폴백 ──
  Future<void> _updateRollingSummarySimple(
      Map<String, dynamic> data, String? todayAdvice) async {
    final sleeps = data['sleepRecords'] as List<SleepRecord>;
    final expenses = data['expenses'] as List<Transaction>;
    final fmt = NumberFormat('#,###');

    final sleepHours = sleeps
        .where((s) => s.wokeAt != null)
        .map((s) {
          final woke = s.wokeAt!.isBefore(s.bedAt)
              ? s.wokeAt!.add(const Duration(days: 1))
              : s.wokeAt!;
          return woke.difference(s.bedAt).inHours;
        })
        .toList();
    final avgSleep = sleepHours.isEmpty
        ? null
        : sleepHours.reduce((a, b) => a + b) / sleepHours.length;

    final totalExpense = expenses.fold(0, (sum, t) => sum + t.amount);

    await _saveRollingSummary(
      sleepSummary: avgSleep != null
          ? '최근 7일 평균 수면 ${avgSleep.toStringAsFixed(1)}시간'
          : null,
      expenseSummary: '최근 7일 지출 ${fmt.format(totalExpense)}원',
      lifeSummary: null,
      todayAdvice: todayAdvice,
    );
  }

  // ── Rolling Summary 저장 (공통) ──
  Future<void> _saveRollingSummary({
    required String? sleepSummary,
    required String? expenseSummary,
    required String? lifeSummary,
    required String? todayAdvice,
  }) async {
    final existing = await _loadRollingSummary();
    if (existing == null) {
      await _db.into(_db.rollingSummaries).insert(
        RollingSummariesCompanion.insert(
          summaryId: _uuid.v4(),
          userId: _userId,
          sleepSummary: Value(sleepSummary),
          expenseSummary: Value(expenseSummary),
          lifeSummary: Value(lifeSummary),
          lastAdvice: Value(todayAdvice),
        ),
      );
    } else {
      await (_db.update(_db.rollingSummaries)
            ..where((t) => t.userId.equals(_userId)))
          .write(RollingSummariesCompanion(
        sleepSummary: Value(sleepSummary),
        expenseSummary: Value(expenseSummary),
        lifeSummary: Value(lifeSummary),
        lastAdvice: Value(todayAdvice),
        updatedAt: Value(DateTime.now()),
      ));
    }
  }
}

// ============================================================
// Provider
// ============================================================

final briefingServiceProvider = Provider<BriefingService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  final llm = ref.watch(llmRepositoryProvider).valueOrNull;
  return BriefingService(db, llm);
});

// 오늘 브리핑
final todayBriefingProvider =
    FutureProvider.autoDispose<Briefing?>((ref) async {
  return ref.watch(briefingServiceProvider).generateTodayBriefing();
});
