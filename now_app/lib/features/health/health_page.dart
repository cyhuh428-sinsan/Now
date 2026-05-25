import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' hide Column;
import '../../core/database/app_database.dart';
import '../../repositories/repository_providers.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../llm/providers/llm_providers.dart';
import '../../services/health_sync_service.dart';

// ============================================================
// 상수
// ============================================================

const _exerciseTypes = [
  ('walking', '걷기', '🚶'),
  ('running', '달리기', '🏃'),
  ('cycling', '자전거', '🚴'),
  ('gym', '헬스', '💪'),
  ('yoga', '요가', '🧘'),
  ('swimming', '수영', '🏊'),
  ('etc', '기타', '⚡'),
];

const _intensities = [
  ('low', '가볍게', Color(0xFF10B981)),
  ('medium', '보통', Color(0xFFF59E0B)),
  ('high', '강하게', Color(0xFFEF4444)),
];

const _sleepQualities = [
  (1, '😫', '나쁨'),
  (2, '😕', '별로'),
  (3, '😐', '보통'),
  (4, '🙂', '좋음'),
  (5, '😊', '최고'),
];

// ============================================================
// Provider
// ============================================================

final todayMedicationsProvider =
    FutureProvider.autoDispose<List<MedicationRecord>>((ref) async {
  const userId = 'local_user';
  return ref
      .watch(healthRepositoryProvider)
      .getMedicationsByDate(userId, DateTime.now());
});

final todayExercisesProvider =
    FutureProvider.autoDispose<List<ExerciseRecord>>((ref) async {
  const userId = 'local_user';
  return ref
      .watch(healthRepositoryProvider)
      .getExercisesByDate(userId, DateTime.now());
});

final todayHospitalsProvider =
    FutureProvider.autoDispose<List<HospitalRecord>>((ref) async {
  const userId = 'local_user';
  return ref
      .watch(healthRepositoryProvider)
      .getHospitalsByDate(userId, DateTime.now());
});

final todaySleepProvider =
    FutureProvider.autoDispose<List<SleepRecord>>((ref) async {
  const userId = 'local_user';
  return ref
      .watch(healthRepositoryProvider)
      .getSleepByDate(userId, DateTime.now());
});


// 최근 7일 건강 기록
final recentHealthProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  const userId = 'local_user';
  final repo = ref.watch(healthRepositoryProvider);
  final today = DateTime.now();
  final List<Map<String, dynamic>> result = [];
  for (int i = 1; i <= 7; i++) {
    final date = today.subtract(Duration(days: i));
    final sleep = await repo.getSleepByDate(userId, date);
    final meds = await repo.getMedicationsByDate(userId, date);
    final exercises = await repo.getExercisesByDate(userId, date);
    final hospitals = await repo.getHospitalsByDate(userId, date);
    if (sleep.isNotEmpty || meds.isNotEmpty ||
        exercises.isNotEmpty || hospitals.isNotEmpty) {
      result.add({
        'date': date,
        'sleep': sleep,
        'meds': meds,
        'exercises': exercises,
        'hospitals': hospitals,
      });
    }
  }
  return result;
});

// ============================================================
// 건강 탭 화면
// ============================================================

class HealthPage extends ConsumerStatefulWidget {
  /// 'sleep' | 'medication' | 'exercise' | 'hospital' — 페이지 진입 시 즉시 해당 시트 열기
  final String? initialSheet;
  const HealthPage({super.key, this.initialSheet});

  @override
  ConsumerState<HealthPage> createState() => _HealthPageState();
}

class _HealthPageState extends ConsumerState<HealthPage> {
  String? _llmSummary;
  bool _isAnalyzing = false;
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    // 진입 즉시 지정된 시트 열기 (첫 프레임 렌더링 후)
    if (widget.initialSheet != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final type = switch (widget.initialSheet) {
          'sleep'      => _SheetType.sleep,
          'medication' => _SheetType.medication,
          'exercise'   => _SheetType.exercise,
          'hospital'   => _SheetType.hospital,
          _            => null,
        };
        if (type != null) _showSheet(context, ref, type);
      });
    }
  }

  Future<void> _syncFromHealthApp() async {
    setState(() => _isSyncing = true);
    try {
      final service = HealthSyncService(ref.read(healthRepositoryProvider));
      final granted = await service.requestPermissions();
      if (!granted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('건강 앱 접근 권한이 필요합니다')),
          );
        }
        return;
      }
      final result = await service.syncRecentDays();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.summary)),
        );
        if (result.success && (result.exerciseCount > 0 || result.sleepCount > 0)) {
          // 화면 새로고침
          ref.invalidate(todayExercisesProvider);
          ref.invalidate(todaySleepProvider);
          ref.invalidate(recentHealthProvider);
        }
      }
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  Future<void> _analyzeHealth() async {
    final sleepList = ref.read(todaySleepProvider).valueOrNull ?? [];
    final medList = ref.read(todayMedicationsProvider).valueOrNull ?? [];
    final exList = ref.read(todayExercisesProvider).valueOrNull ?? [];
    final hospList = ref.read(todayHospitalsProvider).valueOrNull ?? [];

    if (sleepList.isEmpty && medList.isEmpty &&
        exList.isEmpty && hospList.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('오늘 기록된 건강 데이터가 없습니다')),
      );
      return;
    }

    setState(() => _isAnalyzing = true);
    try {
      final repo = await ref.read(llmRepositoryProvider.future);
      if (repo == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('LLM 설정을 먼저 완료해주세요')),
        );
        return;
      }

      final lines = <String>[];
      if (sleepList.isNotEmpty) {
        for (final s in sleepList) {
          final start = DateFormat('HH:mm').format(s.bedAt);
          final end = s.wokeAt != null
              ? DateFormat('HH:mm').format(s.wokeAt!)
              : '?';
          final qualityStr = s.qualityScore != null
              ? ' (품질: ${s.qualityScore}점)'
              : '';
          lines.add('수면: $start ~ $end$qualityStr');
        }
      }
      if (medList.isNotEmpty) {
        for (final m in medList) {
          final dosageStr = m.dosage != null ? ' ${m.dosage}' : '';
          lines.add('투약: ${m.name}$dosageStr');
        }
      }
      if (exList.isNotEmpty) {
        for (final e in exList) {
          final durStr = e.durationMinutes != null
              ? ' ${e.durationMinutes}분'
              : '';
          final calStr = e.estimatedCalories != null
              ? ' ${e.estimatedCalories}kcal'
              : '';
          lines.add('운동: ${e.exerciseType}$durStr$calStr');
        }
      }
      if (hospList.isNotEmpty) {
        for (final h in hospList) {
          lines.add('병원: ${h.hospitalName} (${h.department ?? ""})');
        }
      }

      final dataStr = lines.join('\n');
      final prompt = '오늘의 건강 기록입니다:\n$dataStr\n\n'
          '위 데이터를 바탕으로 건강 상태를 간단히 분석해주세요.\n'
          '3~4문장으로 요약하고, 개선할 점이나 격려의 말도 포함해주세요.';

      final result = await repo.chat(prompt);
      if (mounted) setState(() => _llmSummary = result.trim());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('분석 실패: $e')));
      }
    } finally {
      if (mounted) setState(() => _isAnalyzing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final dateStr = DateFormat('M월 d일 EEEE', 'ko').format(now);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left, color: Color(0xFF111827), size: 28),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          '건강',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
        actions: [
          _isSyncing
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFF2563EB),
                    ),
                  ),
                )
              : IconButton(
                  icon: const Icon(
                    Icons.sync,
                    color: Color(0xFF2563EB),
                  ),
                  tooltip: '건강 앱 동기화',
                  onPressed: _syncFromHealthApp,
                ),
        ],
      ),
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: Text(
                  dateStr,
                  style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
                ),
              ),
            ),

            // AI 건강 분석 카드
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text('✨',
                              style: TextStyle(fontSize: 16)),
                          const SizedBox(width: 6),
                          const Text('AI 건강 분석',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF111827))),
                          const Spacer(),
                          GestureDetector(
                            onTap: _isAnalyzing ? null : _analyzeHealth,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981)
                                    .withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: _isAnalyzing
                                  ? const SizedBox(
                                      width: 14, height: 14,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Color(0xFF10B981)),
                                    )
                                  : const Text('분석',
                                      style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF10B981))),
                            ),
                          ),
                        ],
                      ),
                      if (_llmSummary != null) ...[
                        const SizedBox(height: 10),
                        Text(
                          _llmSummary!,
                          style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF374151),
                              height: 1.6),
                        ),
                      ] else ...[
                        const SizedBox(height: 8),
                        const Text(
                          '오늘 기록을 분석해서 건강 상태를 요약해드립니다',
                          style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF9CA3AF)),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),

            // 수면 섹션
            SliverToBoxAdapter(
              child: _HealthSection(
                emoji: '😴',
                title: '수면',
                onAdd: () => _showSheet(context, ref, _SheetType.sleep),
                child: ref.watch(todaySleepProvider).when(
                      data: (list) => list.isEmpty
                          ? _EmptyCard(
                              onTap: () => _showSheet(
                                  context, ref, _SheetType.sleep))
                          : Column(
                              children: list
                                  .map((s) => _SleepCard(
                                        item: s,
                                        onDelete: () async {
                                          await ref
                                              .read(healthRepositoryProvider)
                                              .deleteSleep(s.sleepId);
                                          ref.invalidate(todaySleepProvider);
                                        },
                                      ))
                                  .toList(),
                            ),
                      loading: () => const _LoadingCard(),
                      error: (e, _) => Text('$e'),
                    ),
              ),
            ),

            // 약/영양제 섹션
            SliverToBoxAdapter(
              child: _HealthSection(
                emoji: '💊',
                title: '약 · 영양제',
                onAdd: () => _showSheet(context, ref, _SheetType.medication),
                child: ref.watch(todayMedicationsProvider).when(
                      data: (list) => list.isEmpty
                          ? _EmptyCard(
                              onTap: () => _showSheet(
                                  context, ref, _SheetType.medication))
                          : Column(
                              children: list
                                  .map((m) => _MedicationCard(
                                        item: m,
                                        onDelete: () async {
                                          await ref
                                              .read(healthRepositoryProvider)
                                              .deleteMedication(m.medicationId);
                                          ref.invalidate(
                                              todayMedicationsProvider);
                                        },
                                      ))
                                  .toList(),
                            ),
                      loading: () => const _LoadingCard(),
                      error: (e, _) => Text('$e'),
                    ),
              ),
            ),

            // 운동 섹션
            SliverToBoxAdapter(
              child: _HealthSection(
                emoji: '🏃',
                title: '운동',
                onAdd: () => _showSheet(context, ref, _SheetType.exercise),
                child: ref.watch(todayExercisesProvider).when(
                      data: (list) => list.isEmpty
                          ? _EmptyCard(
                              onTap: () => _showSheet(
                                  context, ref, _SheetType.exercise))
                          : Column(
                              children: list
                                  .map((e) => _ExerciseCard(
                                        item: e,
                                        onDelete: () async {
                                          await ref
                                              .read(healthRepositoryProvider)
                                              .deleteExercise(e.exerciseId);
                                          ref.invalidate(
                                              todayExercisesProvider);
                                        },
                                      ))
                                  .toList(),
                            ),
                      loading: () => const _LoadingCard(),
                      error: (e, _) => Text('$e'),
                    ),
              ),
            ),

            // 병원 섹션
            SliverToBoxAdapter(
              child: _HealthSection(
                emoji: '🏥',
                title: '병원',
                onAdd: () => _showSheet(context, ref, _SheetType.hospital),
                child: ref.watch(todayHospitalsProvider).when(
                      data: (list) => list.isEmpty
                          ? _EmptyCard(
                              onTap: () => _showSheet(
                                  context, ref, _SheetType.hospital))
                          : Column(
                              children: list
                                  .map((h) => _HospitalCard(
                                        item: h,
                                        onDelete: () async {
                                          await ref
                                              .read(healthRepositoryProvider)
                                              .deleteHospital(h.hospitalId);
                                          ref.invalidate(
                                              todayHospitalsProvider);
                                        },
                                      ))
                                  .toList(),
                            ),
                      loading: () => const _LoadingCard(),
                      error: (e, _) => Text('$e'),
                    ),
              ),
            ),

            // 이전 건강 기록
            const SliverToBoxAdapter(
              child: _RecentHealthSection(),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
      bottomNavigationBar: const AppBottomNav(selectedIndex: 2),
    );
  }

  void _showSheet(BuildContext context, WidgetRef ref, _SheetType type) {
    // 수면 시트를 열 때 오늘 이미 기록이 있으면 기존 데이터로 수정 모드 진입
    final existingSleep = type == _SheetType.sleep
        ? (ref.read(todaySleepProvider).valueOrNull?.isNotEmpty == true
            ? ref.read(todaySleepProvider).valueOrNull!.first
            : null)
        : null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddHealthSheet(
        type: type,
        existingSleep: existingSleep,
        onSaved: () {
          switch (type) {
            case _SheetType.sleep:
              ref.invalidate(todaySleepProvider);
            case _SheetType.medication:
              ref.invalidate(todayMedicationsProvider);
            case _SheetType.exercise:
              ref.invalidate(todayExercisesProvider);
            case _SheetType.hospital:
              ref.invalidate(todayHospitalsProvider);
          }
        },
      ),
    );
  }
}



// ============================================================
// 이전 건강 기록 섹션
// ============================================================

class _RecentHealthSection extends ConsumerWidget {
  const _RecentHealthSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recentAsync = ref.watch(recentHealthProvider);
    return recentAsync.when(
      data: (days) {
        if (days.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Divider(height: 32, color: Color(0xFFE5E7EB)),
              const Text(
                '이전 기록',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 12),
              ...days.map((day) => _RecentHealthDay(day: day)),
            ],
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _RecentHealthDay extends StatelessWidget {
  final Map<String, dynamic> day;
  const _RecentHealthDay({required this.day});

  @override
  Widget build(BuildContext context) {
    final date = day['date'] as DateTime;
    final dateLabel = DateFormat('M월 d일 EEEE', 'ko').format(date);
    final sleep = day['sleep'] as List<SleepRecord>;
    final meds = day['meds'] as List<MedicationRecord>;
    final exercises = day['exercises'] as List<ExerciseRecord>;
    final hospitals = day['hospitals'] as List<HospitalRecord>;

    final items = <_HealthHistoryItem>[];
    for (final s in sleep) {
      items.add(_HealthHistoryItem(
        emoji: '😴',
        label: '수면',
        detail: s.memo ?? (s.wokeAt != null
            ? () {
                final woke = s.wokeAt!.isBefore(s.bedAt)
                    ? s.wokeAt!.add(const Duration(days: 1))
                    : s.wokeAt!;
                return '${woke.difference(s.bedAt).inHours}시간';
              }()
            : '${DateFormat('HH:mm').format(s.bedAt)} 취침'),
      ));
    }
    for (final m in meds) {
      items.add(_HealthHistoryItem(emoji: '💊', label: '약·영양제', detail: m.name));
    }
    for (final e in exercises) {
      items.add(_HealthHistoryItem(
        emoji: '🏃',
        label: '운동',
        detail: '${e.exerciseType} ${e.durationMinutes ?? 0}분'.trim(),
      ));
    }
    for (final h in hospitals) {
      items.add(_HealthHistoryItem(emoji: '🏥', label: '병원', detail: h.hospitalName));
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(dateLabel,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
          const SizedBox(height: 8),
          ...items.map((item) => Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Row(
                  children: [
                    Text('${item.emoji} ${item.label}',
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF6B7280))),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(item.detail,
                          style: const TextStyle(
                              fontSize: 14, color: Color(0xFF111827)),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }
}

class _HealthHistoryItem {
  final String emoji;
  final String label;
  final String detail;
  const _HealthHistoryItem(
      {required this.emoji, required this.label, required this.detail});
}

// ============================================================
// 섹션 컨테이너
// ============================================================

class _HealthSection extends StatelessWidget {
  final String emoji;
  final String title;
  final VoidCallback onAdd;
  final Widget child;

  const _HealthSection({
    required this.emoji,
    required this.title,
    required this.onAdd,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF374151),
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: onAdd,
                child: const Icon(Icons.add_circle_outline,
                    size: 20, color: Color(0xFF2563EB)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

// ============================================================
// 빈 카드
// ============================================================

class _EmptyCard extends StatelessWidget {
  final VoidCallback onTap;
  const _EmptyCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: const Color(0xFFE5E7EB), style: BorderStyle.solid),
        ),
        child: const Center(
          child: Text(
            '+ 기록 추가',
            style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
          ),
        ),
      ),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }
}

// ============================================================
// 수면 카드
// ============================================================

class _SleepCard extends StatelessWidget {
  final SleepRecord item;
  final VoidCallback onDelete;

  const _SleepCard({required this.item, required this.onDelete});

  String _duration() {
    if (item.wokeAt == null) return '기상 미입력';
    // 기상이 취침보다 이른 경우(자정 넘김) 다음날로 보정
    final woke = item.wokeAt!.isBefore(item.bedAt)
        ? item.wokeAt!.add(const Duration(days: 1))
        : item.wokeAt!;
    final diff = woke.difference(item.bedAt);
    final h = diff.inHours;
    final m = diff.inMinutes % 60;
    return '$h시간 ${m > 0 ? '${m}분' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    final quality = item.qualityScore != null
        ? _sleepQualities.firstWhere(
            (q) => q.$1 == item.qualityScore,
            orElse: () => _sleepQualities[2],
          )
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFEEF2FF),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Center(
              child: Text('😴', style: TextStyle(fontSize: 18)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      DateFormat('HH:mm').format(item.bedAt),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const Text(' → ',
                        style: TextStyle(
                            fontSize: 13, color: Color(0xFF9CA3AF))),
                    Text(
                      item.wokeAt != null
                          ? DateFormat('HH:mm').format(item.wokeAt!)
                          : '기상 미입력',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      _duration(),
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF6B7280)),
                    ),
                  ],
                ),
                if (quality != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(quality.$2,
                          style: const TextStyle(fontSize: 13)),
                      const SizedBox(width: 4),
                      Text(
                        quality.$3,
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF6B7280)),
                      ),
                      if (item.memo != null) ...[
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            item.memo!,
                            style: const TextStyle(
                                fontSize: 12, color: Color(0xFF9CA3AF)),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ],
            ),
          ),
          _deleteButton(context, onDelete),
        ],
      ),
    );
  }
}

// ============================================================
// 약/영양제 카드
// ============================================================

class _MedicationCard extends StatelessWidget {
  final MedicationRecord item;
  final VoidCallback onDelete;

  const _MedicationCard({required this.item, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.medication_outlined,
                size: 18, color: Color(0xFF16A34A)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      item.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF111827),
                      ),
                    ),
                    if (item.isPrescription) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFF2563EB).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('처방',
                            style: TextStyle(
                                fontSize: 10,
                                color: Color(0xFF2563EB),
                                fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ],
                ),
                if (item.dosage != null)
                  Text(item.dosage!,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF9CA3AF))),
              ],
            ),
          ),
          _deleteButton(context, onDelete),
        ],
      ),
    );
  }
}

// ============================================================
// 운동 카드
// ============================================================

class _ExerciseCard extends StatelessWidget {
  final ExerciseRecord item;
  final VoidCallback onDelete;

  const _ExerciseCard({required this.item, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final typeInfo = _exerciseTypes.firstWhere(
      (e) => e.$1 == item.exerciseType,
      orElse: () => ('etc', '기타', '⚡'),
    );
    final intensityInfo = item.intensity != null
        ? _intensities.firstWhere(
            (i) => i.$1 == item.intensity,
            orElse: () => _intensities[1],
          )
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(typeInfo.$3,
                  style: const TextStyle(fontSize: 18)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  typeInfo.$2,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (item.durationMinutes != null)
                      Text('${item.durationMinutes}분',
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFF6B7280))),
                    if (intensityInfo != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        intensityInfo.$2,
                        style: TextStyle(
                            fontSize: 12, color: intensityInfo.$3),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          _deleteButton(context, onDelete),
        ],
      ),
    );
  }
}

// ============================================================
// 병원 카드
// ============================================================

class _HospitalCard extends StatelessWidget {
  final HospitalRecord item;
  final VoidCallback onDelete;

  const _HospitalCard({required this.item, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(14, 12, 4, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFFFF1F2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.local_hospital_outlined,
                size: 18, color: Color(0xFFE11D48)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.hospitalName,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (item.department != null) ...[
                      Text(item.department!,
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFF6B7280))),
                      const SizedBox(width: 8),
                    ],
                    if (item.reason != null)
                      Expanded(
                        child: Text(
                          item.reason!,
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFF9CA3AF)),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          _deleteButton(context, onDelete),
        ],
      ),
    );
  }
}

// ============================================================
// 공통 삭제 버튼
// ============================================================

Widget _deleteButton(BuildContext context, VoidCallback onDelete) {
  return IconButton(
    icon: const Icon(Icons.delete_outline,
        size: 18, color: Color(0xFF9CA3AF)),
    onPressed: () => showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('삭제할까요?',
            style:
                TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소',
                style: TextStyle(color: Color(0xFF6B7280))),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              onDelete();
            },
            child: const Text('삭제',
                style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    ),
  );
}

// ============================================================
// 추가 바텀 시트
// ============================================================

enum _SheetType { sleep, medication, exercise, hospital }

class _AddHealthSheet extends ConsumerStatefulWidget {
  final _SheetType type;
  final VoidCallback onSaved;
  final SleepRecord? existingSleep;
  const _AddHealthSheet({
    required this.type,
    required this.onSaved,
    this.existingSleep,
  });

  @override
  ConsumerState<_AddHealthSheet> createState() => _AddHealthSheetState();
}

class _AddHealthSheetState extends ConsumerState<_AddHealthSheet> {
  final _c1 = TextEditingController();
  final _c2 = TextEditingController();
  final _c3 = TextEditingController();
  final _c4 = TextEditingController();
  final _c5 = TextEditingController(); // 병원비
  bool _isPrescription = false;
  String _exerciseType = 'walking';
  String _intensity = 'medium';
  int? _duration;
  // 수면
  TimeOfDay _bedTime = const TimeOfDay(hour: 23, minute: 0);
  TimeOfDay? _wakeTime;
  int _sleepQuality = 3;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    // 기존 수면 기록이 있으면 필드 미리 채우기
    final s = widget.existingSleep;
    if (s != null) {
      _bedTime = TimeOfDay.fromDateTime(s.bedAt);
      if (s.wokeAt != null) {
        _wakeTime = TimeOfDay.fromDateTime(s.wokeAt!);
      }
      _sleepQuality = s.qualityScore ?? 3;
      if (s.memo != null) _c1.text = s.memo!;
    }
  }

  @override
  void dispose() {
    _c1.dispose();
    _c2.dispose();
    _c3.dispose();
    _c4.dispose();
    _c5.dispose();
    super.dispose();
  }

  DateTime _todayAt(TimeOfDay t) {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day, t.hour, t.minute);
  }

  // 기상 시간이 취침 시간보다 이르면 다음날로 처리 (예: 23:00 취침 → 06:00 기상)
  DateTime _wokeAt(TimeOfDay wakeTime) {
    final bed = _todayAt(_bedTime);
    final woke = _todayAt(wakeTime);
    return woke.isBefore(bed) ? woke.add(const Duration(days: 1)) : woke;
  }

  Future<void> _save() async {
    if (widget.type != _SheetType.sleep &&
        widget.type != _SheetType.exercise &&
        _c1.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('필수 항목을 입력해주세요')));
      return;
    }
    setState(() => _isSaving = true);
    try {
      const userId = 'local_user';
      final repo = ref.read(healthRepositoryProvider);
      debugPrint('[SAVE] type=${widget.type}, exerciseType=$_exerciseType, duration=$_duration');

      switch (widget.type) {
        case _SheetType.sleep:
          if (widget.existingSleep != null) {
            // 기존 기록 수정
            await repo.updateSleep(
              widget.existingSleep!.sleepId,
              SleepRecordsCompanion(
                bedAt: Value(_todayAt(_bedTime)),
                wokeAt: Value(_wakeTime != null ? _wokeAt(_wakeTime!) : null),
                qualityScore: Value(_sleepQuality),
                memo: Value(_c1.text.trim().isEmpty ? null : _c1.text.trim()),
              ),
            );
          } else {
            // 신규 저장
            await repo.saveSleep(SleepRecordsCompanion(
              sleepId: Value(const Uuid().v4()),
              userId: const Value(userId),
              bedAt: Value(_todayAt(_bedTime)),
              wokeAt: Value(_wakeTime != null ? _wokeAt(_wakeTime!) : null),
              qualityScore: Value(_sleepQuality),
              memo: Value(_c1.text.trim().isEmpty ? null : _c1.text.trim()),
            ));
          }

        case _SheetType.medication:
          await repo.saveMedication(MedicationRecordsCompanion(
            medicationId: Value(const Uuid().v4()),
            userId: const Value(userId),
            takenAt: Value(DateTime.now()),
            name: Value(_c1.text.trim()),
            dosage: Value(_c2.text.trim().isEmpty ? null : _c2.text.trim()),
            memo: Value(_c3.text.trim().isEmpty ? null : _c3.text.trim()),
            isPrescription: Value(_isPrescription),
          ));

        case _SheetType.exercise:
          await repo.saveExercise(ExerciseRecordsCompanion(
            exerciseId: Value(const Uuid().v4()),
            userId: const Value(userId),
            startedAt: Value(DateTime.now()),
            exerciseType: Value(_exerciseType),
            durationMinutes: Value(_duration),
            intensity: Value(_intensity),
            locationLabel:
                Value(_c3.text.trim().isEmpty ? null : _c3.text.trim()),
            memo: Value(_c4.text.trim().isEmpty ? null : _c4.text.trim()),
          ));

        case _SheetType.hospital:
          final rawAmount = _c5.text.trim().replaceAll(',', '');
          final hospitalAmount = rawAmount.isEmpty ? null : int.tryParse(rawAmount);
          await repo.saveHospital(HospitalRecordsCompanion(
            hospitalId: Value(const Uuid().v4()),
            userId: const Value(userId),
            visitedAt: Value(DateTime.now()),
            hospitalName: Value(_c1.text.trim()),
            department:
                Value(_c2.text.trim().isEmpty ? null : _c2.text.trim()),
            reason: Value(_c3.text.trim().isEmpty ? null : _c3.text.trim()),
            diagnosis:
                Value(_c4.text.trim().isEmpty ? null : _c4.text.trim()),
            amount: Value(hospitalAmount),
          ));
      }
      widget.onSaved();
      debugPrint('[SAVE] success');
      if (mounted) Navigator.pop(context);
    } catch (e, st) {
      debugPrint('[SAVE] error: $e\n$st');
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('저장 실패: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.fromLTRB(
          20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              switch (widget.type) {
                _SheetType.sleep      => widget.existingSleep != null
                    ? '😴 수면 수정'
                    : '😴 수면 기록',
                _SheetType.medication => '💊 약 · 영양제 기록',
                _SheetType.exercise   => '🏃 운동 기록',
                _SheetType.hospital   => '🏥 병원 방문 기록',
              },
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),

            // ── 수면 입력 ──
            if (widget.type == _SheetType.sleep) ...[
              // 취침/기상 시간
              Row(
                children: [
                  Expanded(
                    child: _TimePickerField(
                      label: '취침 시간',
                      time: _bedTime,
                      onPicked: (t) => setState(() => _bedTime = t),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _TimePickerField(
                      label: '기상 시간 (선택)',
                      time: _wakeTime,
                      onPicked: (t) => setState(() => _wakeTime = t),
                      onClear: () => setState(() => _wakeTime = null),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // 수면 질
              const Text('수면 질',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280))),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: _sleepQualities.map((q) {
                  final isSelected = _sleepQuality == q.$1;
                  return GestureDetector(
                    onTap: () => setState(() => _sleepQuality = q.$1),
                    child: Column(
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFF2563EB).withOpacity(0.1)
                                : const Color(0xFFF3F4F6),
                            borderRadius: BorderRadius.circular(12),
                            border: isSelected
                                ? Border.all(
                                    color: const Color(0xFF2563EB), width: 2)
                                : null,
                          ),
                          child: Center(
                            child: Text(q.$2,
                                style: const TextStyle(fontSize: 22)),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(q.$3,
                            style: TextStyle(
                              fontSize: 11,
                              color: isSelected
                                  ? const Color(0xFF2563EB)
                                  : const Color(0xFF9CA3AF),
                              fontWeight: isSelected
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            )),
                      ],
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              _buildField('메모 (선택)', _c1, '예: 잠들기 힘들었음, 꿈을 많이 꿈'),
            ],

            // ── 약/영양제 입력 ──
            if (widget.type == _SheetType.medication) ...[
              _buildField('약/영양제 이름 *', _c1, '예: 비타민C, 타이레놀'),
              const SizedBox(height: 12),
              _buildField('복용량', _c2, '예: 1정, 500mg'),
              const SizedBox(height: 12),
              Row(
                children: [
                  const Text('처방약',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF6B7280))),
                  const Spacer(),
                  Switch(
                    value: _isPrescription,
                    onChanged: (v) =>
                        setState(() => _isPrescription = v),
                    activeColor: const Color(0xFF2563EB),
                  ),
                ],
              ),
              _buildField('메모', _c3, ''),
            ],

            // ── 운동 입력 ──
            if (widget.type == _SheetType.exercise) ...[
              const Text('운동 종류 *',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280))),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _exerciseTypes.map((e) {
                  final isSelected = _exerciseType == e.$1;
                  return GestureDetector(
                    onTap: () => setState(() => _exerciseType = e.$1),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF2563EB)
                            : const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(e.$3,
                              style: const TextStyle(fontSize: 14)),
                          const SizedBox(width: 4),
                          Text(
                            e.$2,
                            style: TextStyle(
                              fontSize: 13,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFF374151),
                              fontWeight: isSelected
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              const Text('강도',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280))),
              const SizedBox(height: 8),
              Row(
                children: _intensities.map((i) {
                  final isSelected = _intensity == i.$1;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _intensity = i.$1),
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding:
                            const EdgeInsets.symmetric(vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? i.$3.withOpacity(0.15)
                              : const Color(0xFFF3F4F6),
                          borderRadius: BorderRadius.circular(8),
                          border: isSelected
                              ? Border.all(color: i.$3)
                              : null,
                        ),
                        child: Center(
                          child: Text(
                            i.$2,
                            style: TextStyle(
                              fontSize: 13,
                              color: isSelected
                                  ? i.$3
                                  : const Color(0xFF6B7280),
                              fontWeight: isSelected
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              _buildField('시간 (분)', _c2, '예: 30',
                  keyboardType: TextInputType.number,
                  onChanged: (v) =>
                      _duration = int.tryParse(v)),
              const SizedBox(height: 12),
              _buildField('장소', _c3, '예: 한강공원'),
              const SizedBox(height: 12),
              _buildField('메모', _c4, ''),
            ],

            // ── 병원 입력 ──
            if (widget.type == _SheetType.hospital) ...[
              _buildField('병원명 *', _c1, '예: 서울내과'),
              const SizedBox(height: 12),
              _buildField('진료과', _c2, '예: 내과, 정형외과'),
              const SizedBox(height: 12),
              _buildField('방문 이유', _c3, '예: 감기, 정기검진'),
              const SizedBox(height: 12),
              _buildField('진단', _c4, '예: 급성 상기도염'),
              const SizedBox(height: 12),
              _buildField('병원비', _c5, '예: 35000', keyboardType: TextInputType.number),
            ],

            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2),
                      )
                    : const Text('저장',
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField(String label, TextEditingController ctrl, String hint,
      {TextInputType keyboardType = TextInputType.text,
      ValueChanged<String>? onChanged}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B7280))),
        const SizedBox(height: 8),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          onChanged: onChanged,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle:
                const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFF2563EB)),
            ),
          ),
        ),
      ],
    );
  }
}

// ============================================================
// TimePicker 필드 위젯
// ============================================================

class _TimePickerField extends StatelessWidget {
  final String label;
  final TimeOfDay? time;
  final ValueChanged<TimeOfDay> onPicked;
  final VoidCallback? onClear;

  const _TimePickerField({
    required this.label,
    required this.time,
    required this.onPicked,
    this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final picked = await showTimePicker(
          context: context,
          initialTime: time ?? const TimeOfDay(hour: 23, minute: 0),
          builder: (context, child) => Theme(
            data: Theme.of(context).copyWith(
              colorScheme: const ColorScheme.light(
                  primary: Color(0xFF2563EB)),
            ),
            child: child!,
          ),
        );
        if (picked != null) onPicked(picked);
      },
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            const Icon(Icons.access_time_outlined,
                size: 16, color: Color(0xFF9CA3AF)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF9CA3AF))),
                  Text(
                    time != null
                        ? '${time!.hour.toString().padLeft(2, '0')}:${time!.minute.toString().padLeft(2, '0')}'
                        : '미설정',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: time != null
                          ? const Color(0xFF111827)
                          : const Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),
            if (time != null && onClear != null)
              GestureDetector(
                onTap: onClear,
                child: const Icon(Icons.close,
                    size: 14, color: Color(0xFF9CA3AF)),
              ),
          ],
        ),
      ),
    );
  }
}
