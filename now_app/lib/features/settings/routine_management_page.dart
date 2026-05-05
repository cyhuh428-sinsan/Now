import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' hide Column;
import '../../core/database/app_database.dart';
import '../../repositories/repository_providers.dart';

// ============================================================
// 루틴 UI 모델 (DB RoutineItem과 분리)
// ============================================================

enum RoutineRepeat { daily, weekdays, weekends, weekly }

class RoutineUiItem {
  final String id;
  final String name;
  final RoutineRepeat repeat;
  final List<int> weekdays;
  final TimeOfDay? alertTime;
  final bool isEnabled;

  const RoutineUiItem({
    required this.id,
    required this.name,
    required this.repeat,
    this.weekdays = const [],
    this.alertTime,
    this.isEnabled = true,
  });

  RoutineUiItem copyWith({
    String? name,
    RoutineRepeat? repeat,
    List<int>? weekdays,
    TimeOfDay? alertTime,
    bool? isEnabled,
    bool clearAlertTime = false,
  }) =>
      RoutineUiItem(
        id: id,
        name: name ?? this.name,
        repeat: repeat ?? this.repeat,
        weekdays: weekdays ?? this.weekdays,
        alertTime: clearAlertTime ? null : (alertTime ?? this.alertTime),
        isEnabled: isEnabled ?? this.isEnabled,
      );

  String get repeatLabel => switch (repeat) {
        RoutineRepeat.daily    => '매일',
        RoutineRepeat.weekdays => '평일',
        RoutineRepeat.weekends => '주말',
        RoutineRepeat.weekly   => _weekdayLabel(),
      };

  String _weekdayLabel() {
    if (weekdays.isEmpty) return '매주';
    const labels = ['월', '화', '수', '목', '금', '토', '일'];
    return '매주 ${weekdays.map((d) => labels[d - 1]).join('/')}';
  }

  String get alertLabel {
    if (alertTime == null) return '알림 없음';
    final h = alertTime!.hour.toString().padLeft(2, '0');
    final m = alertTime!.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  // DB Row → UI 모델
  static RoutineUiItem fromDb(RoutineItem row) {
    final repeat = switch (row.repeat) {
      'weekdays' => RoutineRepeat.weekdays,
      'weekends' => RoutineRepeat.weekends,
      'weekly'   => RoutineRepeat.weekly,
      _          => RoutineRepeat.daily,
    };
    List<int> weekdays = [];
    if (row.weekdaysJson != null && row.weekdaysJson!.isNotEmpty) {
      weekdays = row.weekdaysJson!
          .split(',')
          .where((s) => s.isNotEmpty)
          .map((s) => int.tryParse(s) ?? 1)
          .toList();
    }
    TimeOfDay? alertTime;
    if (row.alertTime != null) {
      final parts = row.alertTime!.split(':');
      if (parts.length == 2) {
        alertTime = TimeOfDay(
          hour: int.tryParse(parts[0]) ?? 0,
          minute: int.tryParse(parts[1]) ?? 0,
        );
      }
    }
    return RoutineUiItem(
      id: row.routineId,
      name: row.name,
      repeat: repeat,
      weekdays: weekdays,
      alertTime: alertTime,
      isEnabled: row.isEnabled,
    );
  }

  // UI 모델 → DB Companion
  RoutineItemsCompanion toCompanion(String userId, {int sortOrder = 0}) {
    return RoutineItemsCompanion(
      routineId: Value(id),
      userId: Value(userId),
      name: Value(name),
      repeat: Value(repeat.name),
      weekdaysJson: Value(weekdays.isNotEmpty ? weekdays.join(',') : null),
      alertTime: Value(alertTime != null
          ? '${alertTime!.hour.toString().padLeft(2, '0')}:${alertTime!.minute.toString().padLeft(2, '0')}'
          : null),
      isEnabled: Value(isEnabled),
      sortOrder: Value(sortOrder),
      updatedAt: Value(DateTime.now()),
    );
  }
}

// ============================================================
// Provider — DB 연동
// ============================================================

const _userId = 'local_user';

final routineItemsProvider =
    AsyncNotifierProvider<RoutineItemsNotifier, List<RoutineUiItem>>(
        RoutineItemsNotifier.new);

class RoutineItemsNotifier extends AsyncNotifier<List<RoutineUiItem>> {
  @override
  Future<List<RoutineUiItem>> build() async {
    final repo = ref.watch(routineRepositoryProvider);
    final rows = await repo.getAllRoutines(_userId);
    return rows.map(RoutineUiItem.fromDb).toList();
  }

  Future<void> add(RoutineUiItem item) async {
    final repo = ref.read(routineRepositoryProvider);
    final current = state.valueOrNull ?? [];
    await repo.saveRoutine(
        item.toCompanion(_userId, sortOrder: current.length));
    ref.invalidateSelf();
  }

  Future<void> editRoutine(RoutineUiItem item) async {
    final repo = ref.read(routineRepositoryProvider);
    await repo.updateRoutine(item.toCompanion(_userId));
    ref.invalidateSelf();
  }

  Future<void> remove(String id) async {
    final repo = ref.read(routineRepositoryProvider);
    await repo.deleteRoutine(id);
    ref.invalidateSelf();
  }

  Future<void> toggle(String id, bool isEnabled) async {
    final repo = ref.read(routineRepositoryProvider);
    await repo.toggleRoutine(id, isEnabled);
    ref.invalidateSelf();
  }
}

// ============================================================
// 루틴 관리 페이지
// ============================================================

class RoutineManagementPage extends ConsumerWidget {
  const RoutineManagementPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final routinesAsync = ref.watch(routineItemsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios,
              size: 18, color: Color(0xFF111827)),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          '루틴 관리',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
        actions: [
          TextButton.icon(
            onPressed: () => _showAddDialog(context, ref),
            icon: const Icon(Icons.add, size: 18, color: Color(0xFF2563EB)),
            label: const Text('추가',
                style: TextStyle(
                    color: Color(0xFF2563EB),
                    fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: routinesAsync.when(
        loading: () => const Center(
            child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(child: Text('오류: $e')),
        data: (routines) => routines.isEmpty
            ? const _EmptyRoutines()
            : ListView.builder(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
                itemCount: routines.length,
                itemBuilder: (context, index) {
                  final routine = routines[index];
                  return _RoutineCard(
                    routine: routine,
                    onToggle: () => ref
                        .read(routineItemsProvider.notifier)
                        .toggle(routine.id, !routine.isEnabled),
                    onEdit: () =>
                        _showEditDialog(context, ref, routine),
                    onDelete: () =>
                        _confirmDelete(context, ref, routine),
                  );
                },
              ),
      ),
    );
  }

  void _showAddDialog(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RoutineEditSheet(
        onSave: (routine) =>
            ref.read(routineItemsProvider.notifier).add(routine),
      ),
    );
  }

  void _showEditDialog(
      BuildContext context, WidgetRef ref, RoutineUiItem routine) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _RoutineEditSheet(
        initial: routine,
        onSave: (updated) =>
            ref.read(routineItemsProvider.notifier).editRoutine(updated),
      ),
    );
  }

  void _confirmDelete(
      BuildContext context, WidgetRef ref, RoutineUiItem routine) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        title: const Text('루틴을 삭제할까요?',
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        content: Text('"${routine.name}" 루틴이 삭제됩니다.',
            style: const TextStyle(
                fontSize: 14, color: Color(0xFF6B7280))),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소',
                style: TextStyle(color: Color(0xFF6B7280))),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(routineItemsProvider.notifier).remove(routine.id);
            },
            child: const Text('삭제',
                style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 루틴 카드
// ============================================================

class _RoutineCard extends StatelessWidget {
  final RoutineUiItem routine;
  final VoidCallback onToggle;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _RoutineCard({
    required this.routine,
    required this.onToggle,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: routine.isEnabled
                    ? const Color(0xFF2563EB).withOpacity(0.1)
                    : const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.repeat,
                size: 20,
                color: routine.isEnabled
                    ? const Color(0xFF2563EB)
                    : const Color(0xFF9CA3AF),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    routine.name,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: routine.isEnabled
                          ? const Color(0xFF111827)
                          : const Color(0xFF9CA3AF),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      _Tag(label: routine.repeatLabel),
                      const SizedBox(width: 6),
                      _Tag(
                        label: routine.alertLabel,
                        icon: Icons.notifications_outlined,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              children: [
                Switch(
                  value: routine.isEnabled,
                  onChanged: (_) => onToggle(),
                  activeColor: const Color(0xFF2563EB),
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                Row(
                  children: [
                    GestureDetector(
                      onTap: onEdit,
                      child: const Icon(Icons.edit_outlined,
                          size: 16, color: Color(0xFF9CA3AF)),
                    ),
                    const SizedBox(width: 10),
                    GestureDetector(
                      onTap: onDelete,
                      child: const Icon(Icons.delete_outline,
                          size: 16, color: Color(0xFF9CA3AF)),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final IconData? icon;
  const _Tag({required this.label, this.icon});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 11, color: const Color(0xFF9CA3AF)),
          const SizedBox(width: 2),
        ],
        Text(label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
      ],
    );
  }
}

// ============================================================
// 루틴 추가/편집 바텀시트
// ============================================================

class _RoutineEditSheet extends ConsumerStatefulWidget {
  final RoutineUiItem? initial;
  final void Function(RoutineUiItem) onSave;

  const _RoutineEditSheet({this.initial, required this.onSave});

  @override
  ConsumerState<_RoutineEditSheet> createState() =>
      _RoutineEditSheetState();
}

class _RoutineEditSheetState extends ConsumerState<_RoutineEditSheet> {
  late TextEditingController _nameCtrl;
  late RoutineRepeat _repeat;
  late List<int> _weekdays;
  TimeOfDay? _alertTime;

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _nameCtrl = TextEditingController(text: init?.name ?? '');
    _repeat = init?.repeat ?? RoutineRepeat.daily;
    _weekdays = List.from(init?.weekdays ?? []);
    _alertTime = init?.alertTime;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  void _save() {
    if (_nameCtrl.text.trim().isEmpty) return;
    final routine = RoutineUiItem(
      id: widget.initial?.id ?? const Uuid().v4(),
      name: _nameCtrl.text.trim(),
      repeat: _repeat,
      weekdays: _repeat == RoutineRepeat.weekly ? _weekdays : [],
      alertTime: _alertTime,
      isEnabled: widget.initial?.isEnabled ?? true,
    );
    widget.onSave(routine);
    Navigator.pop(context);
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            widget.initial == null ? '루틴 추가' : '루틴 편집',
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameCtrl,
            decoration: const InputDecoration(
              labelText: '루틴 이름',
              hintText: '예: 혈압약 복용, 비타민 섭취',
              border: OutlineInputBorder(),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Color(0xFF2563EB)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text('반복 주기',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: RoutineRepeat.values.map((r) {
              final labels = {
                RoutineRepeat.daily:    '매일',
                RoutineRepeat.weekdays: '평일',
                RoutineRepeat.weekends: '주말',
                RoutineRepeat.weekly:   '요일 선택',
              };
              return ChoiceChip(
                label: Text(labels[r]!),
                selected: _repeat == r,
                onSelected: (_) => setState(() {
                  _repeat = r;
                  if (r != RoutineRepeat.weekly) _weekdays.clear();
                }),
                selectedColor: const Color(0xFF2563EB).withOpacity(0.15),
                labelStyle: TextStyle(
                  color: _repeat == r
                      ? const Color(0xFF2563EB)
                      : const Color(0xFF6B7280),
                  fontWeight: _repeat == r
                      ? FontWeight.w600
                      : FontWeight.normal,
                ),
              );
            }).toList(),
          ),
          if (_repeat == RoutineRepeat.weekly) ...[
            const SizedBox(height: 12),
            const Text('요일',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280))),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: ['월', '화', '수', '목', '금', '토', '일']
                  .asMap().entries.map((e) {
                final day = e.key + 1;
                final selected = _weekdays.contains(day);
                return GestureDetector(
                  onTap: () => setState(() {
                    selected ? _weekdays.remove(day) : _weekdays.add(day);
                  }),
                  child: Container(
                    width: 36, height: 36,
                    decoration: BoxDecoration(
                      color: selected
                          ? const Color(0xFF2563EB)
                          : const Color(0xFFF3F4F6),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(e.value,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: selected
                                ? Colors.white
                                : const Color(0xFF6B7280),
                          )),
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
          const SizedBox(height: 16),
          const Text('알림 시간',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () async {
              final picked = await showTimePicker(
                context: context,
                initialTime:
                    _alertTime ?? const TimeOfDay(hour: 8, minute: 0),
                builder: (context, child) => Theme(
                  data: Theme.of(context).copyWith(
                    colorScheme: const ColorScheme.light(
                        primary: Color(0xFF2563EB)),
                  ),
                  child: child!,
                ),
              );
              if (picked != null) setState(() => _alertTime = picked);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.notifications_outlined,
                      size: 18, color: Color(0xFF6B7280)),
                  const SizedBox(width: 10),
                  Text(
                    _alertTime == null
                        ? '알림 없음 (탭하여 설정)'
                        : '${_alertTime!.hour.toString().padLeft(2, '0')}:${_alertTime!.minute.toString().padLeft(2, '0')}',
                    style: TextStyle(
                      fontSize: 14,
                      color: _alertTime == null
                          ? const Color(0xFF9CA3AF)
                          : const Color(0xFF111827),
                    ),
                  ),
                  const Spacer(),
                  if (_alertTime != null)
                    GestureDetector(
                      onTap: () => setState(() => _alertTime = null),
                      child: const Icon(Icons.close,
                          size: 16, color: Color(0xFF9CA3AF)),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text('저장',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 빈 상태
// ============================================================

class _EmptyRoutines extends StatelessWidget {
  const _EmptyRoutines();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.repeat, size: 56, color: Color(0xFFD1D5DB)),
          SizedBox(height: 16),
          Text('등록된 루틴이 없습니다',
              style: TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
          SizedBox(height: 8),
          Text('우측 상단 추가 버튼을 눌러 루틴을 만들어보세요',
              style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
        ],
      ),
    );
  }
}
