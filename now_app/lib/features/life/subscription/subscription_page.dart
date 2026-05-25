import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import 'package:drift/drift.dart' hide Column;
import '../../../core/database/app_database.dart';
import '../../../repositories/repository_providers.dart';
import '../../../repositories/local/local_subscription_repository.dart';

// ============================================================
// Provider
// ============================================================

const _userId = 'local_user';

final subscriptionsProvider =
    FutureProvider.autoDispose<List<SubscriptionItem>>((ref) async {
  final repo = ref.watch(subscriptionRepositoryProvider);
  return repo.getAllSubscriptions(_userId);
});

// ============================================================
// 정기결제 페이지
// ============================================================

class SubscriptionPage extends ConsumerStatefulWidget {
  const SubscriptionPage({super.key});

  @override
  ConsumerState<SubscriptionPage> createState() => _SubscriptionPageState();
}

class _SubscriptionPageState extends ConsumerState<SubscriptionPage> {
  @override
  void initState() {
    super.initState();
    // 오늘 결제일인 구독 항목 살림 반영
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await (ref.read(subscriptionRepositoryProvider) as LocalSubscriptionRepository).processTodayBilling(_userId);
      ref.invalidate(subscriptionsProvider);
    });
  }

  @override
  Widget build(BuildContext context) {
    final subsAsync = ref.watch(subscriptionsProvider);

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
          '정기결제',
          style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827)),
        ),
        actions: [
          TextButton.icon(
            onPressed: () => _showAddSheet(context, ref),
            icon: const Icon(Icons.add, size: 18, color: Color(0xFF8B5CF6)),
            label: const Text('추가',
                style: TextStyle(
                    color: Color(0xFF8B5CF6),
                    fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: subsAsync.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(child: Text('오류: $e')),
        data: (subs) {
          if (subs.isEmpty) {
            return _EmptySubscription(
                onAdd: () => _showAddSheet(context, ref));
          }

          final activeSubs = subs.where((s) => s.isActive).toList();
          final monthlyTotal = _calcMonthlyTotal(activeSubs);
          final yearlyTotal = _calcYearlyTotal(activeSubs);
          final today = DateTime.now().day;

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            children: [
              // 요약 카드
              _SummaryCard(
                  monthlyTotal: monthlyTotal, yearlyTotal: yearlyTotal),
              const SizedBox(height: 16),

              // 이번 달 결제 예정
              const Text('이번 달 결제 예정',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827))),
              const SizedBox(height: 8),
              ...activeSubs
                  .where((s) => s.billingDay >= today)
                  .map((s) => _SubCard(
                        sub: s,
                        today: today,
                        onEdit: () => _showEditSheet(context, ref, s),
                        onDelete: () => _confirmDelete(context, ref, s),
                        onToggle: () => ref
                            .read(subscriptionRepositoryProvider)
                            .toggleActive(s.subscriptionId, !s.isActive)
                            .then((_) =>
                                ref.invalidate(subscriptionsProvider)),
                      )),

              // 이번 달 완료
              if (activeSubs.any((s) => s.billingDay < today)) ...[
                const SizedBox(height: 16),
                const Text('이미 결제됨',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF9CA3AF))),
                const SizedBox(height: 8),
                ...activeSubs
                    .where((s) => s.billingDay < today)
                    .map((s) => _SubCard(
                          sub: s,
                          today: today,
                          isPast: true,
                          onEdit: () =>
                              _showEditSheet(context, ref, s),
                          onDelete: () =>
                              _confirmDelete(context, ref, s),
                          onToggle: () => ref
                              .read(subscriptionRepositoryProvider)
                              .toggleActive(
                                  s.subscriptionId, !s.isActive)
                              .then((_) =>
                                  ref.invalidate(subscriptionsProvider)),
                        )),
              ],

              // 비활성 구독
              if (subs.any((s) => !s.isActive)) ...[
                const SizedBox(height: 16),
                const Text('비활성',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF9CA3AF))),
                const SizedBox(height: 8),
                ...subs
                    .where((s) => !s.isActive)
                    .map((s) => _SubCard(
                          sub: s,
                          today: today,
                          isPast: true,
                          onEdit: () =>
                              _showEditSheet(context, ref, s),
                          onDelete: () =>
                              _confirmDelete(context, ref, s),
                          onToggle: () => ref
                              .read(subscriptionRepositoryProvider)
                              .toggleActive(
                                  s.subscriptionId, !s.isActive)
                              .then((_) =>
                                  ref.invalidate(subscriptionsProvider)),
                        )),
              ],
            ],
          );
        },
      ),
    );
  }

  int _calcMonthlyTotal(List<SubscriptionItem> subs) {
    int total = 0;
    for (final s in subs) {
      if (s.cycle == 'monthly') {
        total += s.amount;
      } else {
        // yearly → 월 환산
        total += (s.amount / 12).round();
      }
    }
    return total;
  }

  int _calcYearlyTotal(List<SubscriptionItem> subs) {
    int total = 0;
    for (final s in subs) {
      if (s.cycle == 'yearly') {
        total += s.amount;
      } else {
        total += s.amount * 12;
      }
    }
    return total;
  }

  void _showAddSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SubEditSheet(
        onSaved: () => ref.invalidate(subscriptionsProvider),
      ),
    );
  }

  void _showEditSheet(
      BuildContext context, WidgetRef ref, SubscriptionItem sub) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SubEditSheet(
        initial: sub,
        onSaved: () => ref.invalidate(subscriptionsProvider),
      ),
    );
  }

  void _confirmDelete(
      BuildContext context, WidgetRef ref, SubscriptionItem sub) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        title: const Text('삭제할까요?',
            style:
                TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Text('"${sub.name}" 항목이 삭제됩니다.',
            style: const TextStyle(
                fontSize: 14, color: Color(0xFF6B7280))),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('취소',
                  style: TextStyle(color: Color(0xFF6B7280)))),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref
                  .read(subscriptionRepositoryProvider)
                  .deleteSubscription(sub.subscriptionId)
                  .then((_) => ref.invalidate(subscriptionsProvider));
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
// 요약 카드
// ============================================================

class _SummaryCard extends StatelessWidget {
  final int monthlyTotal;
  final int yearlyTotal;
  const _SummaryCard(
      {required this.monthlyTotal, required this.yearlyTotal});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,###');
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('월 결제 합계',
                    style: TextStyle(
                        fontSize: 12, color: Colors.white70)),
                const SizedBox(height: 4),
                Text('${fmt.format(monthlyTotal)}원',
                    style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white)),
              ],
            ),
          ),
          Container(
            width: 1,
            height: 40,
            color: Colors.white24,
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(left: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('연 결제 합계',
                      style: TextStyle(
                          fontSize: 12, color: Colors.white70)),
                  const SizedBox(height: 4),
                  Text('${fmt.format(yearlyTotal)}원',
                      style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 구독 항목 카드
// ============================================================

class _SubCard extends StatelessWidget {
  final SubscriptionItem sub;
  final int today;
  final bool isPast;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onToggle;

  const _SubCard({
    required this.sub,
    required this.today,
    this.isPast = false,
    required this.onEdit,
    required this.onDelete,
    required this.onToggle,
  });

  String get _dday {
    final diff = sub.billingDay - today;
    if (diff == 0) return 'D-Day';
    if (diff > 0) return 'D-$diff';
    return '완료';
  }

  Color get _ddayColor {
    final diff = sub.billingDay - today;
    if (diff == 0) return const Color(0xFFEF4444);
    if (diff <= 3) return const Color(0xFFF59E0B);
    if (diff > 0) return const Color(0xFF8B5CF6);
    return const Color(0xFF9CA3AF);
  }

  String get _cycleLabel =>
      sub.cycle == 'monthly' ? '매월 ${sub.billingDay}일' : '매년';

  String get _categoryEmoji {
    switch (sub.category) {
      case 'OTT': return '📺';
      case '음악': return '🎵';
      case '업무': return '💼';
      case '게임': return '🎮';
      case '클라우드': return '☁️';
      default: return '💳';
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,###');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: isPast || !sub.isActive
            ? const Color(0xFFF9FAFB)
            : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Text(_categoryEmoji, style: const TextStyle(fontSize: 28)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  sub.name,
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: sub.isActive
                          ? const Color(0xFF111827)
                          : const Color(0xFF9CA3AF)),
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(_cycleLabel,
                        style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF6B7280))),
                    if (sub.category != null) ...[
                      const Text(' · ',
                          style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF))),
                      Text(sub.category!,
                          style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF))),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('${fmt.format(sub.amount)}원',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: sub.isActive
                          ? const Color(0xFF111827)
                          : const Color(0xFF9CA3AF))),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: _ddayColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(_dday,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: _ddayColor)),
              ),
            ],
          ),
          const SizedBox(width: 8),
          Column(
            children: [
              Switch(
                value: sub.isActive,
                onChanged: (_) => onToggle(),
                activeThumbColor: const Color(0xFF8B5CF6),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              Row(
                children: [
                  GestureDetector(
                    onTap: onEdit,
                    child: const Icon(Icons.edit_outlined,
                        size: 15, color: Color(0xFF9CA3AF)),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: onDelete,
                    child: const Icon(Icons.delete_outline,
                        size: 15, color: Color(0xFF9CA3AF)),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 추가/편집 바텀시트
// ============================================================

class _SubEditSheet extends ConsumerStatefulWidget {
  final SubscriptionItem? initial;
  final VoidCallback onSaved;
  const _SubEditSheet({this.initial, required this.onSaved});

  @override
  ConsumerState<_SubEditSheet> createState() => _SubEditSheetState();
}

class _SubEditSheetState extends ConsumerState<_SubEditSheet> {
  late TextEditingController _nameCtrl;
  late TextEditingController _amountCtrl;
  late String _cycle;
  late int _billingDay;
  late int? _alertDays;
  late String? _category;
  bool _isSaving = false;

  final _categories = ['OTT', '음악', '업무', '게임', '클라우드', '기타'];

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _nameCtrl = TextEditingController(text: init?.name ?? '');
    _amountCtrl = TextEditingController(
        text: init?.amount.toString() ?? '');
    _cycle = init?.cycle ?? 'monthly';
    _billingDay = init?.billingDay ?? 1;
    _alertDays = init?.alertDaysBefore;
    _category = init?.category;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _amountCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('서비스명을 입력해주세요')));
      return;
    }
    final amount = int.tryParse(
        _amountCtrl.text.trim().replaceAll(',', ''));
    if (amount == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('금액을 입력해주세요')));
      return;
    }

    setState(() => _isSaving = true);
    try {
      final companion = SubscriptionItemsCompanion(
        subscriptionId:
            Value(widget.initial?.subscriptionId ?? const Uuid().v4()),
        userId: const Value(_userId),
        name: Value(_nameCtrl.text.trim()),
        amount: Value(amount),
        cycle: Value(_cycle),
        billingDay: Value(_billingDay),
        alertDaysBefore: Value(_alertDays),
        category: Value(_category),
        isActive: Value(widget.initial?.isActive ?? true),
      );

      final repo = ref.read(subscriptionRepositoryProvider);
      if (widget.initial == null) {
        await repo.saveSubscription(companion);
      } else {
        await repo.updateSubscription(companion);
      }
      widget.onSaved();
      if (mounted) Navigator.pop(context);
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
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36, height: 4,
                decoration: BoxDecoration(
                    color: const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              widget.initial == null ? '정기결제 추가' : '정기결제 편집',
              style: const TextStyle(
                  fontSize: 17, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),

            // 서비스명
            _buildField(
              label: '서비스명',
              child: TextField(
                controller: _nameCtrl,
                decoration: _inputDeco('예: 넷플릭스, 유튜브 프리미엄'),
              ),
            ),
            const SizedBox(height: 14),

            // 금액
            _buildField(
              label: '금액',
              child: TextField(
                controller: _amountCtrl,
                keyboardType: TextInputType.number,
                decoration: _inputDeco('예: 17000').copyWith(
                  prefixText: '₩ ',
                  suffixText: '원',
                ),
              ),
            ),
            const SizedBox(height: 14),

            // 주기
            _buildField(
              label: '결제 주기',
              child: Row(
                children: [
                  _CycleChip(
                    label: '매월',
                    selected: _cycle == 'monthly',
                    onTap: () => setState(() => _cycle = 'monthly'),
                  ),
                  const SizedBox(width: 8),
                  _CycleChip(
                    label: '매년',
                    selected: _cycle == 'yearly',
                    onTap: () => setState(() => _cycle = 'yearly'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // 결제일
            _buildField(
              label: _cycle == 'monthly' ? '결제일 (매월)' : '결제일 (매년)',
              child: Row(
                children: [
                  const Text('매월 ',
                      style: TextStyle(
                          fontSize: 14, color: Color(0xFF6B7280))),
                  DropdownButton<int>(
                    value: _billingDay,
                    underline: const SizedBox(),
                    items: List.generate(28, (i) => i + 1)
                        .map((d) => DropdownMenuItem(
                              value: d,
                              child: Text('$d일'),
                            ))
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _billingDay = v ?? 1),
                  ),
                  const Text(' 결제',
                      style: TextStyle(
                          fontSize: 14, color: Color(0xFF6B7280))),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // 카테고리
            _buildField(
              label: '카테고리 (선택)',
              child: Wrap(
                spacing: 8,
                children: _categories
                    .map((c) => ChoiceChip(
                          label: Text(c),
                          selected: _category == c,
                          onSelected: (_) => setState(() =>
                              _category = _category == c ? null : c),
                          selectedColor: const Color(0xFF8B5CF6)
                              .withValues(alpha: 0.15),
                          labelStyle: TextStyle(
                            fontSize: 12,
                            color: _category == c
                                ? const Color(0xFF8B5CF6)
                                : const Color(0xFF6B7280),
                            fontWeight: _category == c
                                ? FontWeight.w600
                                : FontWeight.normal,
                          ),
                        ))
                    .toList(),
              ),
            ),
            const SizedBox(height: 20),

            // 저장 버튼
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF8B5CF6),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _isSaving
                    ? const SizedBox(
                        width: 20, height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
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

  Widget _buildField(
      {required String label, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6B7280))),
        const SizedBox(height: 8),
        child,
      ],
    );
  }

  InputDecoration _inputDeco(String hint) => InputDecoration(
        hintText: hint,
        hintStyle:
            const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
        filled: true,
        fillColor: const Color(0xFFF9FAFB),
        contentPadding: const EdgeInsets.all(12),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF8B5CF6))),
      );
}

class _CycleChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _CycleChip(
      {required this.label,
      required this.selected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected
              ? const Color(0xFF8B5CF6).withValues(alpha: 0.15)
              : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: selected
                ? const Color(0xFF8B5CF6)
                : Colors.transparent,
          ),
        ),
        child: Text(label,
            style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: selected
                    ? const Color(0xFF8B5CF6)
                    : const Color(0xFF6B7280))),
      ),
    );
  }
}

// ============================================================
// 빈 상태
// ============================================================

class _EmptySubscription extends StatelessWidget {
  final VoidCallback onAdd;
  const _EmptySubscription({required this.onAdd});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('💳', style: TextStyle(fontSize: 56)),
          const SizedBox(height: 16),
          const Text('등록된 정기결제가 없습니다',
              style:
                  TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 8),
          const Text('넷플릭스, 유튜브 등 구독 서비스를 등록해보세요',
              style:
                  TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: onAdd,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('정기결제 추가하기'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF8B5CF6),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
          ),
        ],
      ),
    );
  }
}
