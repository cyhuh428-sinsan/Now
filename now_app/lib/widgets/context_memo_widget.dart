import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:intl/intl.dart';
import '../core/database/app_database.dart';
import '../repositories/repository_providers.dart';

// ============================================================
// Provider
// ============================================================

final latestContextProvider =
    FutureProvider.autoDispose<DailyContext?>((ref) async {
  const userId = 'local_user';
  return ref.watch(contextRepositoryProvider).getLatestContext(userId);
});

final todaySleepForHomeProvider =
    FutureProvider.autoDispose<List<SleepRecord>>((ref) async {
  const userId = 'local_user';
  return ref
      .watch(healthRepositoryProvider)
      .getSleepByDate(userId, DateTime.now());
});

// ============================================================
// 컨텍스트 메모 위젯
// ============================================================

class ContextMemoWidget extends ConsumerWidget {
  const ContextMemoWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contextAsync = ref.watch(latestContextProvider);
    final sleepAsync = ref.watch(todaySleepForHomeProvider);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: contextAsync.when(
        data: (ctx) {
          if (ctx != null) {
            return _ContextCard(
              context: ctx,
              sleepList: sleepAsync.valueOrNull ?? [],
              onEdit: () => _showInputSheet(context, ref),
            );
          }
          // DailyContext 없음 → 수면 기록 확인
          final sleepList = sleepAsync.valueOrNull ?? [];
          if (sleepList.isNotEmpty) {
            return _SleepSummaryCard(
              sleepList: sleepList,
              onAddCondition: () => _showInputSheet(context, ref),
              onEditSleep: () => _showSleepSheet(context, ref),
            );
          }
          return _EmptyContextCard(
              onTap: () => _showInputSheet(context, ref));
        },
        loading: () => const SizedBox.shrink(),
        error: (_, __) => const SizedBox.shrink(),
      ),
    );
  }

  void _showInputSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ContextInputSheet(
        onSaved: () => ref.invalidate(latestContextProvider),
        onSleepTapped: () => _showSleepSheet(context, ref),
      ),
    );
  }

  void _showSleepSheet(BuildContext context, WidgetRef ref) {
    // 현재 로드된 수면 기록 (있으면 수정 모드)
    final existingSleep =
        ref.read(todaySleepForHomeProvider).valueOrNull?.firstOrNull;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _HomeSleepSheet(
        existingSleep: existingSleep,
        onSaved: () {
          ref.invalidate(todaySleepForHomeProvider);
          ref.invalidate(latestContextProvider);
        },
      ),
    );
  }
}

// ============================================================
// 빈 상태 카드
// ============================================================

class _EmptyContextCard extends StatelessWidget {
  final VoidCallback onTap;
  const _EmptyContextCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: const Row(
          children: [
            Text('📝', style: TextStyle(fontSize: 16)),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                '오늘 컨디션을 기록해보세요',
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF9CA3AF),
                ),
              ),
            ),
            Icon(Icons.add,
                size: 16, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 컨텍스트 카드 (기록 있을 때)
// ============================================================

class _ContextCard extends StatelessWidget {
  final DailyContext context;
  final List<SleepRecord> sleepList;
  final VoidCallback onEdit;

  const _ContextCard({
    required this.context,
    required this.sleepList,
    required this.onEdit,
  });

  String? _sleepSummary() {
    if (sleepList.isEmpty) return null;
    final s = sleepList.first;
    if (s.wokeAt == null) return null;
    final woke = s.wokeAt!.isBefore(s.bedAt)
        ? s.wokeAt!.add(const Duration(days: 1))
        : s.wokeAt!;
    final hours = woke.difference(s.bedAt).inHours;
    return '수면 $hours시간';
  }

  @override
  Widget build(BuildContext buildContext) {
    final sleepStr = _sleepSummary();
    return GestureDetector(
      onTap: onEdit,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F9FF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFBAE6FD)),
        ),
        child: Row(
          children: [
            if (context.conditionScore != null) ...[
              _ConditionDot(score: context.conditionScore!),
              const SizedBox(width: 10),
            ] else ...[
              const Text('📝', style: TextStyle(fontSize: 16)),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    context.memo,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF0369A1),
                      fontWeight: FontWeight.w500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (sleepStr != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      sleepStr,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF0284C7),
                      ),
                    ),
                  ] else if (context.sleepHours != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      '수면 ${context.sleepHours}시간',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF0284C7),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.edit_outlined,
                size: 14, color: Color(0xFF0284C7)),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 수면 요약 카드 (DailyContext 없고 수면 기록만 있을 때)
// ============================================================

class _SleepSummaryCard extends StatelessWidget {
  final List<SleepRecord> sleepList;
  final VoidCallback onAddCondition;
  final VoidCallback onEditSleep;

  const _SleepSummaryCard({
    required this.sleepList,
    required this.onAddCondition,
    required this.onEditSleep,
  });

  String _sleepText() {
    final s = sleepList.first;
    final bedStr = DateFormat('HH:mm').format(s.bedAt);
    if (s.wokeAt == null) return '취침 $bedStr';
    final woke = s.wokeAt!.isBefore(s.bedAt)
        ? s.wokeAt!.add(const Duration(days: 1))
        : s.wokeAt!;
    final wokeStr = DateFormat('HH:mm').format(woke);
    final hours = woke.difference(s.bedAt).inHours;
    return '$bedStr → $wokeStr · $hours시간';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F9FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFBAE6FD)),
      ),
      child: Row(
        children: [
          const Text('😴', style: TextStyle(fontSize: 16)),
          const SizedBox(width: 10),
          Expanded(
            child: GestureDetector(
              onTap: onEditSleep,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _sleepText(),
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF0369A1),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    '탭하여 수면 수정',
                    style: TextStyle(
                      fontSize: 11,
                      color: Color(0xFF0284C7),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onAddCondition,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                '+ 컨디션',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF2563EB),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConditionDot extends StatelessWidget {
  final int score;
  const _ConditionDot({required this.score});

  String get _emoji {
    if (score >= 4) return '😊';
    if (score >= 3) return '😐';
    return '😔';
  }

  @override
  Widget build(BuildContext context) {
    return Text(_emoji, style: const TextStyle(fontSize: 18));
  }
}

// ============================================================
// 오늘 컨디션 입력 바텀 시트
// ============================================================

class _ContextInputSheet extends ConsumerStatefulWidget {
  final VoidCallback onSaved;
  final VoidCallback onSleepTapped;
  const _ContextInputSheet({
    required this.onSaved,
    required this.onSleepTapped,
  });

  @override
  ConsumerState<_ContextInputSheet> createState() =>
      _ContextInputSheetState();
}

class _ContextInputSheetState extends ConsumerState<_ContextInputSheet> {
  final _memoCtrl = TextEditingController();
  int? _conditionScore;
  bool _isSaving = false;

  @override
  void dispose() {
    _memoCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_memoCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('메모를 입력해주세요')));
      return;
    }
    setState(() => _isSaving = true);
    try {
      await ref.read(contextRepositoryProvider).saveContext(
            DailyContextsCompanion(
              contextId: Value(const Uuid().v4()),
              userId: const Value('local_user'),
              recordedAt: Value(DateTime.now()),
              memo: Value(_memoCtrl.text.trim()),
              conditionScore: Value(_conditionScore),
            ),
          );
      widget.onSaved();
      if (mounted) Navigator.pop(context);
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sleepAsync = ref.watch(todaySleepForHomeProvider);
    final hasSleep = sleepAsync.valueOrNull?.isNotEmpty == true;

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
            const Text(
              '오늘 컨디션',
              style: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),

            // 컨디션 점수
            const Text('컨디션',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _ConditionButton(
                    emoji: '😔', label: '나쁨', score: 1,
                    selected: _conditionScore == 1,
                    onTap: () => setState(() => _conditionScore = 1)),
                _ConditionButton(
                    emoji: '😕', label: '조금 피곤', score: 2,
                    selected: _conditionScore == 2,
                    onTap: () => setState(() => _conditionScore = 2)),
                _ConditionButton(
                    emoji: '😐', label: '보통', score: 3,
                    selected: _conditionScore == 3,
                    onTap: () => setState(() => _conditionScore = 3)),
                _ConditionButton(
                    emoji: '🙂', label: '좋음', score: 4,
                    selected: _conditionScore == 4,
                    onTap: () => setState(() => _conditionScore = 4)),
                _ConditionButton(
                    emoji: '😊', label: '최고', score: 5,
                    selected: _conditionScore == 5,
                    onTap: () => setState(() => _conditionScore = 5)),
              ],
            ),
            const SizedBox(height: 16),

            // 수면 기록 바로가기 (건강 페이지 이동 없이 직접 시트 오픈)
            GestureDetector(
              onTap: () {
                Navigator.pop(context);
                widget.onSleepTapped();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F7FF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Row(
                  children: [
                    const Text('😴',
                        style: TextStyle(fontSize: 18)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        hasSleep ? '수면 기록 수정하기' : '수면 기록하기',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ),
                    const Icon(Icons.chevron_right,
                        size: 18, color: Color(0xFF2563EB)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // 메모
            const Text('한 줄 메모',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            TextField(
              controller: _memoCtrl,
              decoration: InputDecoration(
                hintText: '예: 어젯밤 늦게 자서 좀 피곤함',
                hintStyle: const TextStyle(
                    color: Color(0xFF9CA3AF), fontSize: 14),
                filled: true,
                fillColor: const Color(0xFFF9FAFB),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFFE5E7EB)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide:
                      const BorderSide(color: Color(0xFF2563EB)),
                ),
              ),
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
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
}

// ============================================================
// 홈에서 직접 띄우는 수면 기록/수정 시트
// ============================================================

class _HomeSleepSheet extends ConsumerStatefulWidget {
  final SleepRecord? existingSleep;
  final VoidCallback onSaved;

  const _HomeSleepSheet({
    required this.onSaved,
    this.existingSleep,
  });

  @override
  ConsumerState<_HomeSleepSheet> createState() => _HomeSleepSheetState();
}

class _HomeSleepSheetState extends ConsumerState<_HomeSleepSheet> {
  TimeOfDay _bedTime = const TimeOfDay(hour: 23, minute: 0);
  TimeOfDay? _wakeTime;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    final s = widget.existingSleep;
    if (s != null) {
      _bedTime = TimeOfDay.fromDateTime(s.bedAt);
      if (s.wokeAt != null) {
        _wakeTime = TimeOfDay.fromDateTime(s.wokeAt!);
      }
    }
  }

  DateTime _todayAt(TimeOfDay t) {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day, t.hour, t.minute);
  }

  // 기상이 취침보다 이르면 다음날로 처리 (자정 넘김)
  DateTime _wokeAt(TimeOfDay wakeTime) {
    final bed = _todayAt(_bedTime);
    final woke = _todayAt(wakeTime);
    return woke.isBefore(bed) ? woke.add(const Duration(days: 1)) : woke;
  }

  Future<void> _pickTime({required bool isBed}) async {
    final initial = isBed
        ? _bedTime
        : (_wakeTime ?? const TimeOfDay(hour: 6, minute: 0));
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme:
              const ColorScheme.light(primary: Color(0xFF2563EB)),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        if (isBed) {
          _bedTime = picked;
        } else {
          _wakeTime = picked;
        }
      });
    }
  }

  String _fmt(TimeOfDay? t) {
    if (t == null) return '미설정';
    return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  String _durationText() {
    if (_wakeTime == null) return '';
    final bed = _todayAt(_bedTime);
    final woke = _wokeAt(_wakeTime!);
    final diff = woke.difference(bed);
    return '${diff.inHours}시간 ${diff.inMinutes % 60 > 0 ? '${diff.inMinutes % 60}분' : ''}';
  }

  Future<void> _save() async {
    setState(() => _isSaving = true);
    try {
      const userId = 'local_user';
      final repo = ref.read(healthRepositoryProvider);
      if (widget.existingSleep != null) {
        // 수면 시간만 수정 (질/메모는 건강 페이지에서 관리)
        await repo.updateSleep(
          widget.existingSleep!.sleepId,
          SleepRecordsCompanion(
            bedAt: Value(_todayAt(_bedTime)),
            wokeAt: Value(_wakeTime != null ? _wokeAt(_wakeTime!) : null),
          ),
        );
      } else {
        await repo.saveSleep(SleepRecordsCompanion(
          sleepId: Value(const Uuid().v4()),
          userId: const Value(userId),
          bedAt: Value(_todayAt(_bedTime)),
          wokeAt: Value(_wakeTime != null ? _wokeAt(_wakeTime!) : null),
        ));
      }
      widget.onSaved();
      if (mounted) Navigator.pop(context);
    } catch (e) {
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
    final isEdit = widget.existingSleep != null;
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
            // 핸들
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
              isEdit ? '😴 수면 수정' : '😴 수면 기록',
              style: const TextStyle(
                  fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),

            // 취침 / 기상 시간
            Row(
              children: [
                Expanded(
                  child: _buildTimeField(
                    '취침 시간',
                    _bedTime,
                    onTap: () => _pickTime(isBed: true),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimeField(
                    '기상 시간 (선택)',
                    _wakeTime,
                    onTap: () => _pickTime(isBed: false),
                    onClear: _wakeTime != null
                        ? () => setState(() => _wakeTime = null)
                        : null,
                  ),
                ),
              ],
            ),
            if (_wakeTime != null) ...[
              const SizedBox(height: 8),
              Center(
                child: Text(
                  '수면시간: ${_durationText()}',
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF2563EB)),
                ),
              ),
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
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2),
                      )
                    : Text(
                        isEdit ? '수정 저장' : '저장',
                        style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimeField(
    String label,
    TimeOfDay? time, {
    required VoidCallback onTap,
    VoidCallback? onClear,
  }) {
    return GestureDetector(
      onTap: onTap,
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
                    _fmt(time),
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

// ============================================================
// 컨디션 버튼
// ============================================================

class _ConditionButton extends StatelessWidget {
  final String emoji;
  final String label;
  final int score;
  final bool selected;
  final VoidCallback onTap;

  const _ConditionButton({
    required this.emoji,
    required this.label,
    required this.score,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? const Color(0xFF2563EB).withValues(alpha: 0.1)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected
                ? const Color(0xFF2563EB)
                : Colors.transparent,
          ),
        ),
        child: Column(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 24)),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: selected
                    ? const Color(0xFF2563EB)
                    : const Color(0xFF9CA3AF),
                fontWeight: selected
                    ? FontWeight.w600
                    : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
