import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../core/database/app_database.dart';
import '../../repositories/local/trip_repository.dart';
import '../../services/trip_service.dart';
import '../../widgets/app_bottom_nav.dart';

// ============================================================
// 여행 목록 메인
// ============================================================

class TravelPage extends ConsumerWidget {
  const TravelPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tripsAsync = ref.watch(tripsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        title: const Text('여행',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF111827))),
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: Color(0xFF2563EB)),
            onPressed: () => _showAddTripSheet(context, ref),
          ),
        ],
      ),
      body: tripsAsync.when(
        data: (trips) {
          if (trips.isEmpty) return const _EmptyTrips();
          final active = trips.where((t) => t.status == 'on_trip').toList();
          final planned = trips.where((t) => t.status == 'planning').toList();
          final done = trips.where((t) => t.status == 'completed').toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            children: [
              if (active.isNotEmpty) ...[
                _SectionHeader(label: '✈️ 여행 중', count: active.length),
                ...active.map((t) => _TripCard(trip: t)),
              ],
              if (planned.isNotEmpty) ...[
                _SectionHeader(label: '📋 예정', count: planned.length),
                ...planned.map((t) => _TripCard(trip: t)),
              ],
              if (done.isNotEmpty) ...[
                _SectionHeader(label: '✅ 완료', count: done.length),
                ...done.map((t) => _TripCard(trip: t)),
              ],
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('오류: $e')),
      ),
      extendBody: true,
      bottomNavigationBar: const AppBottomNav(selectedIndex: 3),
    );
  }

  void _showAddTripSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddTripSheet(ref: ref),
    );
  }
}

// ============================================================
// 여행 카드
// ============================================================

class _TripCard extends ConsumerWidget {
  final Trip trip;
  const _TripCard({required this.trip});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fmt = DateFormat('M월 d일');
    final days = trip.endDate.difference(trip.startDate).inDays + 1;
    final statusColor = trip.status == 'on_trip'
        ? const Color(0xFF059669)
        : trip.status == 'completed'
            ? const Color(0xFF6B7280)
            : const Color(0xFF2563EB);
    final statusLabel = trip.status == 'on_trip'
        ? '여행 중'
        : trip.status == 'completed'
            ? '완료'
            : '예정';

    return GestureDetector(
      onTap: () => Navigator.push(context,
          MaterialPageRoute(builder: (_) => TripDetailPage(tripId: trip.tripId))),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(trip.name,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF111827))),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(statusLabel,
                      style: TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 14, color: Color(0xFF9CA3AF)),
                const SizedBox(width: 4),
                Text(trip.destination,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
                const Spacer(),
                Text('${fmt.format(trip.startDate)} ~ ${fmt.format(trip.endDate)} ($days일)',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
              ],
            ),
            if (trip.budgetTotal > 0) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.account_balance_wallet_outlined,
                      size: 14, color: Color(0xFF9CA3AF)),
                  const SizedBox(width: 4),
                  Text('예산 ${NumberFormat('#,###').format(trip.budgetTotal)}원',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                ],
              ),
            ],
            if (trip.rating != null) ...[
              const SizedBox(height: 6),
              Row(
                children: List.generate(
                    5,
                    (i) => Icon(
                          i < trip.rating! ? Icons.star : Icons.star_border,
                          size: 14,
                          color: const Color(0xFFF59E0B),
                        )),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 여행 추가 시트
// ============================================================

class _AddTripSheet extends StatefulWidget {
  final WidgetRef ref;
  const _AddTripSheet({required this.ref});

  @override
  State<_AddTripSheet> createState() => _AddTripSheetState();
}

class _AddTripSheetState extends State<_AddTripSheet> {
  final _nameCtrl = TextEditingController();
  final _destCtrl = TextEditingController();
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now().add(const Duration(days: 3));
  int _budgetTotal = 0;
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('yyyy.MM.dd');
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
          const Text('새 여행',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(
            controller: _nameCtrl,
            decoration:
                const InputDecoration(labelText: '여행 이름', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _destCtrl,
            decoration:
                const InputDecoration(labelText: '목적지', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _startDate,
                      firstDate: DateTime.now().subtract(const Duration(days: 365)),
                      lastDate: DateTime.now().add(const Duration(days: 730)),
                    );
                    if (d != null) {
                      setState(() {
                        _startDate = d;
                        if (_endDate.isBefore(_startDate)) {
                          _endDate = _startDate.add(const Duration(days: 1));
                        }
                      });
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey),
                        borderRadius: BorderRadius.circular(4)),
                    child: Text('출발: ${fmt.format(_startDate)}',
                        style: const TextStyle(fontSize: 14)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _endDate,
                      firstDate: _startDate,
                      lastDate: DateTime.now().add(const Duration(days: 730)),
                    );
                    if (d != null) {
                      setState(() => _endDate = d);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey),
                        borderRadius: BorderRadius.circular(4)),
                    child: Text('귀국: ${fmt.format(_endDate)}',
                        style: const TextStyle(fontSize: 14)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            decoration:
                const InputDecoration(labelText: '총 예산 (원)', border: OutlineInputBorder()),
            keyboardType: TextInputType.number,
            onChanged: (v) => _budgetTotal = int.tryParse(v.replaceAll(',', '')) ?? 0,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : _createTrip,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('여행 만들기',
                      style: TextStyle(color: Colors.white, fontSize: 15)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _createTrip() async {
    if (_nameCtrl.text.isEmpty || _destCtrl.text.isEmpty) return;
    setState(() => _loading = true);
    await widget.ref.read(tripRepositoryProvider).create(
          name: _nameCtrl.text,
          destination: _destCtrl.text,
          startDate: _startDate,
          endDate: _endDate,
          budgetTotal: _budgetTotal,
        );
    widget.ref.invalidate(tripsProvider);
    if (mounted) Navigator.pop(context);
  }
}

// ============================================================
// 여행 상세
// ============================================================

class TripDetailPage extends ConsumerStatefulWidget {
  final String tripId;
  const TripDetailPage({super.key, required this.tripId});

  @override
  ConsumerState<TripDetailPage> createState() => _TripDetailPageState();
}

class _TripDetailPageState extends ConsumerState<TripDetailPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tripAsync = ref.watch(tripDetailProvider(widget.tripId));

    return tripAsync.when(
      data: (trip) {
        if (trip == null) {
          return const Scaffold(body: Center(child: Text('여행을 찾을 수 없어요')));
        }
        return Scaffold(
          backgroundColor: const Color(0xFFF8F9FA),
          appBar: AppBar(
            backgroundColor: const Color(0xFFF8F9FA),
            elevation: 0,
            title: Text(trip.name,
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF111827))),
            actions: [_StatusButton(trip: trip)],
            bottom: TabBar(
              controller: _tabCtrl,
              labelColor: const Color(0xFF2563EB),
              unselectedLabelColor: const Color(0xFF9CA3AF),
              indicatorColor: const Color(0xFF2563EB),
              tabs: const [
                Tab(text: '📅 일정'),
                Tab(text: '✅ 체크리스트'),
                Tab(text: '📝 후기'),
              ],
            ),
          ),
          body: TabBarView(
            controller: _tabCtrl,
            children: [
              _PlanTab(tripId: widget.tripId, trip: trip),
              _ChecklistTab(tripId: widget.tripId, trip: trip),
              _ReviewTab(trip: trip),
            ],
          ),
        );
      },
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text('오류: $e'))),
    );
  }
}

// ── 상태 변경 버튼 ──
class _StatusButton extends ConsumerWidget {
  final Trip trip;
  const _StatusButton({required this.trip});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (trip.status == 'completed') return const SizedBox.shrink();
    final next = trip.status == 'planning' ? 'on_trip' : 'completed';
    final label = trip.status == 'planning' ? '여행 시작' : '여행 완료';
    return TextButton(
      onPressed: () async {
        await ref.read(tripRepositoryProvider).updateStatus(trip.tripId, next);
        ref.invalidate(tripDetailProvider(trip.tripId));
        ref.invalidate(tripsProvider);
      },
      child: Text(label, style: const TextStyle(color: Color(0xFF2563EB))),
    );
  }
}

// ============================================================
// 일정 탭
// ============================================================

class _PlanTab extends ConsumerWidget {
  final String tripId;
  final Trip trip;
  const _PlanTab({required this.tripId, required this.trip});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plansAsync = ref.watch(tripDayPlansProvider(tripId));

    return plansAsync.when(
      data: (plans) {
        final grouped = <String, List<TripDayPlan>>{};
        for (final p in plans) {
          final key = DateFormat('yyyy-MM-dd').format(p.date);
          grouped.putIfAbsent(key, () => []).add(p);
        }
        return Column(
          children: [
            if (plans.isEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: _LlmSuggestButton(trip: trip, tripId: tripId),
              ),
            Expanded(
              child: plans.isEmpty
                  ? const Center(
                      child: Text('일정을 추가하거나 AI 추천을 받아보세요',
                          style: TextStyle(color: Color(0xFF9CA3AF))))
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _LlmSuggestButton(trip: trip, tripId: tripId),
                        ),
                        ...grouped.entries.map((e) => _DayPlanGroup(
                              dateKey: e.key,
                              plans: e.value,
                              tripId: tripId,
                            )),
                      ],
                    ),
            ),
            _AddPlanBar(tripId: tripId, trip: trip),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('오류: $e')),
    );
  }
}

// ── AI 일정 추천 버튼 ──
class _LlmSuggestButton extends ConsumerStatefulWidget {
  final Trip trip;
  final String tripId;
  const _LlmSuggestButton({required this.trip, required this.tripId});

  @override
  ConsumerState<_LlmSuggestButton> createState() => _LlmSuggestButtonState();
}

class _LlmSuggestButtonState extends ConsumerState<_LlmSuggestButton> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _loading ? null : _suggest,
        icon: _loading
            ? const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.auto_awesome, size: 16),
        label: Text(_loading ? 'AI가 일정 추천 중...' : 'AI 일정 추천 받기'),
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF2563EB),
          side: const BorderSide(color: Color(0xFF2563EB)),
        ),
      ),
    );
  }

  Future<void> _suggest() async {
    setState(() => _loading = true);
    final result = await ref.read(tripServiceProvider).suggestItinerary(
          destination: widget.trip.destination,
          startDate: widget.trip.startDate,
          endDate: widget.trip.endDate,
        );
    if (!mounted) return;

    final repo = ref.read(tripRepositoryProvider);
    final dayPlans = result['dayPlans'] as List? ?? [];
    final checklist = result['checklist'] as List? ?? [];

    int sort = 0;
    for (final day in dayPlans) {
      final plans = day['plans'] as List? ?? [];
      final dateParts = (day['date'] as String? ?? '').split('/');
      DateTime date = widget.trip.startDate;
      if (dateParts.length == 2) {
        final m = int.tryParse(dateParts[0]) ?? date.month;
        final d = int.tryParse(dateParts[1]) ?? date.day;
        date = DateTime(date.year, m, d);
      }
      for (final p in plans) {
        await repo.addDayPlan(
          tripId: widget.tripId,
          date: date,
          title: p.toString(),
          originalTitle: p.toString(),
          sortOrder: sort++,
        );
      }
    }

    for (final cat in checklist) {
      final category = cat['category'] as String? ?? '';
      final items = cat['items'] as List? ?? [];
      int s = 0;
      for (final item in items) {
        await repo.addChecklist(
          tripId: widget.tripId,
          item: item.toString(),
          category: category,
          sortOrder: s++,
        );
      }
    }

    ref.invalidate(tripDayPlansProvider(widget.tripId));
    ref.invalidate(tripChecklistsProvider(widget.tripId));
    setState(() => _loading = false);
  }
}

// ── 날짜별 그룹 ──
class _DayPlanGroup extends ConsumerWidget {
  final String dateKey;
  final List<TripDayPlan> plans;
  final String tripId;
  const _DayPlanGroup(
      {required this.dateKey, required this.plans, required this.tripId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final date = DateTime.parse(dateKey);
    final label = DateFormat('M월 d일 (E)', 'ko').format(date);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(label,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
        ),
        ...plans.map((p) => _PlanTile(plan: p, tripId: tripId)),
        const SizedBox(height: 4),
      ],
    );
  }
}

// ── 일정 아이템 ──
class _PlanTile extends ConsumerStatefulWidget {
  final TripDayPlan plan;
  final String tripId;
  const _PlanTile({required this.plan, required this.tripId});

  @override
  ConsumerState<_PlanTile> createState() => _PlanTileState();
}

class _PlanTileState extends ConsumerState<_PlanTile> {
  bool _expanded = false;

  Color get _statusColor {
    return widget.plan.status == 'done'
        ? const Color(0xFF059669)
        : const Color(0xFFD1D5DB);
  }

  String get _statusLabel {
    return widget.plan.status == 'done' ? '완료' : '미완료';
  }

  void _cycleStatus() async {
    final next = widget.plan.status == 'done' ? 'pending' : 'done';
    await ref.read(tripRepositoryProvider).updatePlanStatus(widget.plan.planId, next);
    ref.invalidate(tripDayPlansProvider(widget.tripId));
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked =
        await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    await ref
        .read(tripRepositoryProvider)
        .updatePlanDetail(widget.plan.planId, photoUri: picked.path);
    ref.invalidate(tripDayPlansProvider(widget.tripId));
  }

  @override
  Widget build(BuildContext context) {
    final isOriginalDiff = widget.plan.originalTitle != null &&
        widget.plan.originalTitle != widget.plan.title;

    return Dismissible(
      key: Key(widget.plan.planId),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        color: const Color(0xFFDC2626),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) async {
        await ref.read(tripRepositoryProvider).deleteDayPlan(widget.plan.planId);
        ref.invalidate(tripDayPlansProvider(widget.tripId));
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: _cycleStatus,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _statusColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(_statusLabel,
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: _statusColor)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.plan.title,
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF111827),
                              )),
                          if (isOriginalDiff)
                            Text('원본: ${widget.plan.originalTitle}',
                                style: const TextStyle(
                                    fontSize: 10, color: Color(0xFFD97706))),
                        ],
                      ),
                    ),
                    if (widget.plan.photoUri != null) ...[
                      const SizedBox(width: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: Image.network(
                          widget.plan.photoUri!,
                          width: 32,
                          height: 32,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(Icons.image,
                              size: 32, color: Color(0xFF9CA3AF)),
                        ),
                      ),
                    ],
                    const SizedBox(width: 4),
                    Icon(_expanded ? Icons.expand_less : Icons.expand_more,
                        size: 18, color: const Color(0xFF9CA3AF)),
                  ],
                ),
              ),
            ),
            if (_expanded)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Divider(height: 1),
                    const SizedBox(height: 10),
                    _EditableField(
                      label: '계획 수정',
                      value: widget.plan.title,
                      onSave: (v) async {
                        await ref.read(tripRepositoryProvider).updatePlanDetail(
                            widget.plan.planId,
                            title: v);
                        ref.invalidate(tripDayPlansProvider(widget.tripId));
                      },
                    ),
                    const SizedBox(height: 8),
                    _EditableField(
                      label: '감상 메모',
                      value: widget.plan.actualNote ?? '',
                      multiline: true,
                      onSave: (v) async {
                        await ref.read(tripRepositoryProvider).updatePlanDetail(
                            widget.plan.planId,
                            actualNote: v);
                        ref.invalidate(tripDayPlansProvider(widget.tripId));
                      },
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: _pickPhoto,
                      icon: const Icon(Icons.photo_camera, size: 16),
                      label:
                          Text(widget.plan.photoUri != null ? '사진 변경' : '사진 추가'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF2563EB),
                        side: const BorderSide(color: Color(0xFF2563EB)),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── 인라인 편집 필드 ──
class _EditableField extends StatefulWidget {
  final String label;
  final String value;
  final bool multiline;
  final Future<void> Function(String) onSave;
  const _EditableField({
    required this.label,
    required this.value,
    required this.onSave,
    this.multiline = false,
  });

  @override
  State<_EditableField> createState() => _EditableFieldState();
}

class _EditableFieldState extends State<_EditableField> {
  late TextEditingController _ctrl;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.value);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(widget.label,
                style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF6B7280),
                    fontWeight: FontWeight.w600)),
            const Spacer(),
            if (!_editing)
              GestureDetector(
                onTap: () => setState(() => _editing = true),
                child: const Icon(Icons.edit, size: 14, color: Color(0xFF9CA3AF)),
              ),
          ],
        ),
        const SizedBox(height: 4),
        if (_editing)
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _ctrl,
                  maxLines: widget.multiline ? 3 : 1,
                  autofocus: true,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () async {
                  await widget.onSave(_ctrl.text);
                  setState(() => _editing = false);
                },
                child: const Icon(Icons.check_circle,
                    color: Color(0xFF2563EB), size: 24),
              ),
            ],
          )
        else
          Text(
            _ctrl.text.isEmpty ? '(미입력)' : _ctrl.text,
            style: TextStyle(
              fontSize: 13,
              color: _ctrl.text.isEmpty
                  ? const Color(0xFFD1D5DB)
                  : const Color(0xFF374151),
              height: 1.4,
            ),
          ),
      ],
    );
  }
}

// ── 일정 추가 바 ──
class _AddPlanBar extends ConsumerStatefulWidget {
  final String tripId;
  final Trip trip;
  const _AddPlanBar({required this.tripId, required this.trip});

  @override
  ConsumerState<_AddPlanBar> createState() => _AddPlanBarState();
}

class _AddPlanBarState extends ConsumerState<_AddPlanBar> {
  final _ctrl = TextEditingController();
  late DateTime _selectedDate;

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.trip.startDate;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          12, 8, 12, MediaQuery.of(context).viewInsets.bottom + 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: _selectedDate,
                firstDate: widget.trip.startDate,
                lastDate: widget.trip.endDate,
              );
              if (d != null) setState(() => _selectedDate = d);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(DateFormat('M/d').format(_selectedDate),
                  style: const TextStyle(fontSize: 12, color: Color(0xFF2563EB))),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _ctrl,
              decoration: const InputDecoration(
                hintText: '일정 추가',
                border: InputBorder.none,
                hintStyle: TextStyle(color: Color(0xFF9CA3AF)),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.send, color: Color(0xFF2563EB), size: 20),
            onPressed: () async {
              if (_ctrl.text.isEmpty) return;
              await ref.read(tripRepositoryProvider).addDayPlan(
                    tripId: widget.tripId,
                    date: _selectedDate,
                    title: _ctrl.text,
                    originalTitle: _ctrl.text,
                  );
              _ctrl.clear();
              ref.invalidate(tripDayPlansProvider(widget.tripId));
            },
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 체크리스트 탭
// ============================================================

class _ChecklistTab extends ConsumerWidget {
  final String tripId;
  final Trip trip;
  const _ChecklistTab({required this.tripId, required this.trip});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final checksAsync = ref.watch(tripChecklistsProvider(tripId));

    return checksAsync.when(
      data: (checks) {
        final grouped = <String, List<TripChecklist>>{};
        for (final c in checks) {
          grouped.putIfAbsent(c.category ?? '기타', () => []).add(c);
        }
        final done = checks.where((c) => c.isDone).length;
        return Column(
          children: [
            if (checks.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: LinearProgressIndicator(
                  value: checks.isEmpty ? 0 : done / checks.length,
                  backgroundColor: const Color(0xFFE5E7EB),
                  color: const Color(0xFF2563EB),
                  minHeight: 6,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                child: Text('$done / ${checks.length} 완료',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
              ),
            ],
            Expanded(
              child: checks.isEmpty
                  ? const Center(
                      child: Text('준비물을 추가하세요',
                          style: TextStyle(color: Color(0xFF9CA3AF))))
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                      children: grouped.entries
                          .map((e) => _CheckGroup(
                                category: e.key,
                                items: e.value,
                                tripId: tripId,
                              ))
                          .toList(),
                    ),
            ),
            _AddCheckBar(tripId: tripId),
          ],
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('오류: $e')),
    );
  }
}

class _CheckGroup extends StatelessWidget {
  final String category;
  final List<TripChecklist> items;
  final String tripId;
  const _CheckGroup(
      {required this.category, required this.items, required this.tripId});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(category,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
        ),
        ...items.map((c) => _CheckTile(item: c, tripId: tripId)),
      ],
    );
  }
}

class _CheckTile extends ConsumerWidget {
  final TripChecklist item;
  final String tripId;
  const _CheckTile({required this.item, required this.tripId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Dismissible(
      key: Key(item.checkId),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        color: const Color(0xFFDC2626),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) async {
        await ref.read(tripRepositoryProvider).deleteChecklist(item.checkId);
        ref.invalidate(tripChecklistsProvider(tripId));
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: ListTile(
          dense: true,
          leading: Checkbox(
            value: item.isDone,
            onChanged: (v) async {
              await ref
                  .read(tripRepositoryProvider)
                  .toggleChecklist(item.checkId, v ?? false);
              ref.invalidate(tripChecklistsProvider(tripId));
            },
            activeColor: const Color(0xFF059669),
          ),
          title: Text(item.item,
              style: TextStyle(
                fontSize: 14,
                color: item.isDone
                    ? const Color(0xFF9CA3AF)
                    : const Color(0xFF111827),
                decoration: item.isDone ? TextDecoration.lineThrough : null,
              )),
        ),
      ),
    );
  }
}

class _AddCheckBar extends ConsumerStatefulWidget {
  final String tripId;
  const _AddCheckBar({required this.tripId});

  @override
  ConsumerState<_AddCheckBar> createState() => _AddCheckBarState();
}

class _AddCheckBarState extends ConsumerState<_AddCheckBar> {
  final _ctrl = TextEditingController();
  final _catCtrl = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          12, 8, 12, MediaQuery.of(context).viewInsets.bottom + 8),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 70,
            child: TextField(
              controller: _catCtrl,
              decoration: const InputDecoration(
                hintText: '분류',
                border: InputBorder.none,
                hintStyle: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
              ),
              style: const TextStyle(fontSize: 12),
            ),
          ),
          Container(width: 1, height: 24, color: Colors.grey.shade300),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _ctrl,
              decoration: const InputDecoration(
                hintText: '준비물 추가',
                border: InputBorder.none,
                hintStyle: TextStyle(color: Color(0xFF9CA3AF)),
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.send, color: Color(0xFF2563EB), size: 20),
            onPressed: () async {
              if (_ctrl.text.isEmpty) return;
              await ref.read(tripRepositoryProvider).addChecklist(
                    tripId: widget.tripId,
                    item: _ctrl.text,
                    category: _catCtrl.text.isEmpty ? '기타' : _catCtrl.text,
                  );
              _ctrl.clear();
              ref.invalidate(tripChecklistsProvider(widget.tripId));
            },
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 후기 탭
// ============================================================

class _ReviewTab extends ConsumerStatefulWidget {
  final Trip trip;
  const _ReviewTab({required this.trip});

  @override
  ConsumerState<_ReviewTab> createState() => _ReviewTabState();
}

class _ReviewTabState extends ConsumerState<_ReviewTab> {
  late int _rating;
  late TextEditingController _reviewCtrl;
  bool _generating = false;
  List<String> _photos = [];

  @override
  void initState() {
    super.initState();
    _rating = widget.trip.rating ?? 0;
    _reviewCtrl = TextEditingController(text: widget.trip.review ?? '');
    // 기존 사진 목록 로드
    final existing = widget.trip.reviewPhotosJson;
    if (existing != null && existing.isNotEmpty) {
      try {
        _photos = List<String>.from(jsonDecode(existing) as List);
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCompleted = widget.trip.status == 'completed';
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('별점',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
          const SizedBox(height: 8),
          Row(
            children: List.generate(
                5,
                (i) => GestureDetector(
                      onTap: () => setState(() => _rating = i + 1),
                      child: Icon(
                        i < _rating ? Icons.star : Icons.star_border,
                        size: 36,
                        color: const Color(0xFFF59E0B),
                      ),
                    )),
          ),
          const SizedBox(height: 20),
          if (widget.trip.llmSummary != null) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2563EB), Color(0xFF7C3AED)],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('✨ AI 여행 요약',
                      style: TextStyle(
                          fontSize: 11,
                          color: Colors.white70,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  Text(widget.trip.llmSummary!,
                      style: const TextStyle(
                          fontSize: 14, color: Colors.white, height: 1.5)),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          // 사진 섹션
          Row(
            children: [
              const Text('사진',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280))),
              const Spacer(),
              GestureDetector(
                onTap: _pickPhoto,
                child: const Icon(Icons.add_photo_alternate_outlined,
                    color: Color(0xFF2563EB), size: 24),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_photos.isNotEmpty) ...[
            SizedBox(
              height: 90,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _photos.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final path = _photos[i];
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.file(
                          File(path),
                          width: 90,
                          height: 90,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 90,
                            height: 90,
                            color: const Color(0xFFE5E7EB),
                            child: const Icon(Icons.broken_image,
                                color: Color(0xFF9CA3AF)),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () => _removePhoto(path),
                          child: Container(
                            width: 20,
                            height: 20,
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close,
                                size: 12, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
          ],
          const Text('후기 작성',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
          const SizedBox(height: 8),
          TextField(
            controller: _reviewCtrl,
            maxLines: 6,
            decoration: const InputDecoration(
              hintText: '여행 후기를 자유롭게 작성해보세요',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          if (isCompleted)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _generating ? null : _generateSummary,
                icon: _generating
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.auto_awesome, size: 16),
                label: Text(_generating ? 'AI 요약 생성 중...' : 'AI 여행 요약 생성'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF7C3AED),
                  side: const BorderSide(color: Color(0xFF7C3AED)),
                ),
              ),
            ),
          const SizedBox(height: 12),
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
                  style: TextStyle(color: Colors.white, fontSize: 15)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    setState(() => _photos.add(picked.path));
  }

  void _removePhoto(String path) {
    setState(() => _photos.remove(path));
  }

  Future<void> _generateSummary() async {
    setState(() => _generating = true);
    final plans =
        await ref.read(tripDayPlansProvider(widget.trip.tripId).future);
    final summary = await ref.read(tripServiceProvider).generateTripSummary(
          trip: widget.trip,
          dayPlans: plans,
          checklists: [],
          totalExpense: 0,
        );
    if (summary != null) {
      await ref.read(tripRepositoryProvider).saveReview(
            widget.trip.tripId,
            rating: _rating,
            review: _reviewCtrl.text,
            llmSummary: summary,
            reviewPhotosJson: jsonEncode(_photos),
          );
      ref.invalidate(tripDetailProvider(widget.trip.tripId));
    }
    if (mounted) setState(() => _generating = false);
  }

  Future<void> _save() async {
    await ref.read(tripRepositoryProvider).saveReview(
          widget.trip.tripId,
          rating: _rating,
          review: _reviewCtrl.text,
          reviewPhotosJson: jsonEncode(_photos),
        );
    ref.invalidate(tripDetailProvider(widget.trip.tripId));
    ref.invalidate(tripsProvider);
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('저장되었습니다')));
    }
  }
}

// ============================================================
// 공통 위젯
// ============================================================

class _SectionHeader extends StatelessWidget {
  final String label;
  final int count;
  const _SectionHeader({required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 12, 0, 8),
      child: Row(
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
          const SizedBox(width: 6),
          Text('$count',
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF2563EB))),
        ],
      ),
    );
  }
}

class _EmptyTrips extends StatelessWidget {
  const _EmptyTrips();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.flight_outlined, size: 64, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('계획 중인 여행이 없어요',
              style: TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 8),
          const Text('우측 상단 + 버튼으로 여행을 추가해보세요',
              style: TextStyle(fontSize: 13, color: Color(0xFFD1D5DB))),
        ],
      ),
    );
  }
}
