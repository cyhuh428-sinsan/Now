import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../core/database/app_database.dart';
import '../../repositories/local/transaction_repository.dart';
import '../../repositories/repository_providers.dart';

// ============================================================
// 살림 탭 (수입/지출 관리)
// ============================================================

class MoneyPage extends ConsumerWidget {
  const MoneyPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ym = ref.watch(selectedYearMonthProvider);
    final summaryAsync = ref.watch(monthlySummaryProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          '살림',
          style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827)),
        ),
        centerTitle: false,
        actions: [
          // 이전 달
          IconButton(
            icon: const Icon(Icons.chevron_left, color: Color(0xFF6B7280)),
            onPressed: () {
              final prev = DateTime(ym.year, ym.month - 1);
              ref.read(selectedYearMonthProvider.notifier).state = prev;
            },
          ),
          Text(
            '${ym.year}년 ${ym.month}월',
            style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
          ),
          // 다음 달 (현재 달 이후는 비활성)
          IconButton(
            icon: Icon(
              Icons.chevron_right,
              color: _isCurrentMonth(ym)
                  ? const Color(0xFFD1D5DB)
                  : const Color(0xFF6B7280),
            ),
            onPressed: _isCurrentMonth(ym)
                ? null
                : () {
                    final next = DateTime(ym.year, ym.month + 1);
                    ref.read(selectedYearMonthProvider.notifier).state = next;
                  },
          ),
        ],
      ),
      body: Column(
        children: [
          // 월별 요약 카드
          summaryAsync.when(
            data: (s) => _MonthlySummaryCard(
                income: s.income, expense: s.expense),
            loading: () => const _MonthlySummaryCard(income: 0, expense: 0),
            error: (_, __) => const _MonthlySummaryCard(income: 0, expense: 0),
          ),
          // 구독-지출 교차 브리핑 카드
          const _SubscriptionBriefingCard(),
          // 차트 + 이상치
          const _ChartSection(),
          // 거래 목록
          const Expanded(child: _TransactionList()),
        ],
      ),
      extendBody: true,
      floatingActionButton: const CaptureFab(),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      bottomNavigationBar: const AppBottomNav(selectedIndex: 2),
    );
  }

  bool _isCurrentMonth(DateTime ym) {
    final now = DateTime.now();
    return ym.year == now.year && ym.month == now.month;
  }
}

// ============================================================
// 월별 요약 카드
// ============================================================

class _MonthlySummaryCard extends StatelessWidget {
  final int income;
  final int expense;
  const _MonthlySummaryCard(
      {required this.income, required this.expense});

  @override
  Widget build(BuildContext context) {
    final balance = income - expense;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('이번 달 요약',
              style: TextStyle(
                  fontSize: 12,
                  color: Colors.white70,
                  fontWeight: FontWeight.w500)),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _SummaryItem(label: '수입', amount: income, isIncome: true),
              _SummaryItem(label: '지출', amount: expense, isIncome: false),
              _SummaryItem(label: '잔액', amount: balance, isBalance: true),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, size: 14, color: Colors.white70),
                SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Capture 버튼으로 영수증이나 음성으로 기록하세요',
                    style: TextStyle(fontSize: 12, color: Colors.white70),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryItem extends StatelessWidget {
  final String label;
  final int amount;
  final bool isIncome;
  final bool isBalance;

  const _SummaryItem({
    required this.label,
    required this.amount,
    this.isIncome = false,
    this.isBalance = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 11, color: Colors.white70)),
        const SizedBox(height: 4),
        Text(
          amount == 0 ? '-' : '${NumberFormat('#,###').format(amount)}원',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: isBalance
                ? Colors.white
                : isIncome
                    ? const Color(0xFF86EFAC)
                    : const Color(0xFFFCA5A5),
          ),
        ),
      ],
    );
  }
}

// ============================================================
// 거래 목록
// ============================================================

class _TransactionList extends ConsumerWidget {
  const _TransactionList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final transactionsAsync = ref.watch(monthlyTransactionsProvider);
    return transactionsAsync.when(
      data: (list) {
        if (list.isEmpty) return const _EmptyState();
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
          itemCount: list.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) =>
              _TransactionTile(item: list[index]),
        );
      },
      loading: () =>
          const Center(child: CircularProgressIndicator()),
      error: (e, _) =>
          Center(child: Text('오류: $e')),
    );
  }
}

class _TransactionTile extends ConsumerWidget {
  final Transaction item;
  const _TransactionTile({required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isIncome = item.direction == '수입';
    final fmt = NumberFormat('#,###');
    return Dismissible(
      key: Key(item.transactionId),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFDC2626),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 24),
      ),
      confirmDismiss: (_) async {
        return await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('삭제할까요?'),
            content: Text('"${item.memo ?? item.category ?? item.direction}" 항목을 삭제합니다.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('취소')),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('삭제', style: TextStyle(color: Color(0xFFDC2626))),
              ),
            ],
          ),
        ) ?? false;
      },
      onDismissed: (_) async {
        await ref.read(transactionRepositoryProvider).deleteTransaction(
          item.transactionId,
          extractedId: item.extractedId,
        );
        ref.invalidate(monthlyTransactionsProvider);
        ref.invalidate(monthlySummaryProvider);
        ref.invalidate(categoryExpenseProvider);
      },
      child: GestureDetector(
        onLongPress: () => _showEditDialog(context, ref),
        child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          // 카테고리 아이콘
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isIncome
                  ? const Color(0xFFDCFCE7)
                  : const Color(0xFFFEE2E2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              isIncome
                  ? Icons.arrow_downward
                  : Icons.arrow_upward,
              size: 18,
              color: isIncome
                  ? const Color(0xFF16A34A)
                  : const Color(0xFFDC2626),
            ),
          ),
          const SizedBox(width: 12),
          // 내용
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.memo ?? item.category ?? item.direction,
                  style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF111827)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${item.category ?? ''} · ${DateFormat('M/d HH:mm').format(item.occurredAt)}',
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF9CA3AF)),
                ),
              ],
            ),
          ),
          // 금액
          Text(
            '${isIncome ? '+' : '-'}${fmt.format(item.amount)}원',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: isIncome
                  ? const Color(0xFF16A34A)
                  : const Color(0xFFDC2626),
            ),
          ),
        ],
      ),
        ),  // GestureDetector child
      ),  // Dismissible child
    );
  }

  void _showEditDialog(BuildContext context, WidgetRef ref) {
    final amountCtrl = TextEditingController(text: item.amount.toString());
    final memoCtrl = TextEditingController(text: item.memo ?? '');
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('수정', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: amountCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '금액', suffix: Text('원')),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: memoCtrl,
              decoration: const InputDecoration(labelText: '메모'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('취소')),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final amount = int.tryParse(amountCtrl.text.replaceAll(',', ''));
              if (amount == null) return;
              await ref.read(transactionRepositoryProvider).updateTransaction(
                item.transactionId,
                amount: amount,
                memo: memoCtrl.text.trim().isEmpty ? null : memoCtrl.text.trim(),
                extractedId: item.extractedId,
              );
              ref.invalidate(monthlyTransactionsProvider);
              ref.invalidate(monthlySummaryProvider);
              ref.invalidate(categoryExpenseProvider);
            },
            child: const Text('저장', style: TextStyle(color: Color(0xFF2563EB))),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 빈 상태
// ============================================================

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.account_balance_wallet_outlined,
              size: 56, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text(
            '기록된 수입/지출이 없어요',
            style: TextStyle(fontSize: 15, color: Color(0xFF9CA3AF)),
          ),
          const SizedBox(height: 8),
          const Text(
            'Capture 버튼으로 영수증 사진이나\n음성으로 기록해보세요',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFFD1D5DB)),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 차트 + 이상치 섹션
// ============================================================

class _ChartSection extends ConsumerWidget {
  const _ChartSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoryAsync = ref.watch(categoryExpenseProvider);
    final summaryAsync = ref.watch(monthlySummaryProvider);

    return categoryAsync.when(
      data: (categories) {
        if (categories.isEmpty) return const SizedBox.shrink();
        final totalExpense = summaryAsync.valueOrNull?.expense ?? 0;
        return Column(
          children: [
            // 월별 막대차트
            const _BarChartCard(),
            const SizedBox(height: 8),
            // 파이차트
            _PieChartCard(categories: categories, total: totalExpense),
            const SizedBox(height: 8),
            // 이상치 감지
            _AnomalyCard(categories: categories, total: totalExpense),
          ],
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}


// ============================================================
// 월별 막대차트 카드 (최근 6개월)
// ============================================================

final monthlyExpenseHistoryProvider =
    FutureProvider.autoDispose<List<({int year, int month, int expense})>>((ref) async {
  const userId = 'local_user';
  final repo = ref.watch(transactionRepositoryProvider);
  final now = DateTime.now();
  final result = <({int year, int month, int expense})>[];
  for (int i = 5; i >= 0; i--) {
    final dt = DateTime(now.year, now.month - i, 1);
    final summary = await repo.getMonthlySummary(userId, dt.year, dt.month);
    result.add((year: dt.year, month: dt.month, expense: summary.expense));
  }
  return result;
});

class _BarChartCard extends ConsumerWidget {
  const _BarChartCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(monthlyExpenseHistoryProvider);

    return historyAsync.when(
      data: (history) {
        if (history.every((h) => h.expense == 0)) return const SizedBox.shrink();
        final maxVal = history.map((h) => h.expense).reduce((a, b) => a > b ? a : b);
        final fmt = NumberFormat('#,###');

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('월별 지출 추이',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF111827))),
              const SizedBox(height: 16),
              SizedBox(
                height: 120,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: history.map((h) {
                    final ratio = maxVal > 0 ? h.expense / maxVal : 0.0;
                    final isCurrentMonth = h.year == DateTime.now().year &&
                        h.month == DateTime.now().month;
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (isCurrentMonth)
                              Text(
                                fmt.format(h.expense),
                                style: const TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF2563EB)),
                                overflow: TextOverflow.ellipsis,
                              ),
                            const SizedBox(height: 2),
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 400),
                              curve: Curves.easeOut,
                              height: ratio * 80,
                              decoration: BoxDecoration(
                                color: isCurrentMonth
                                    ? const Color(0xFF2563EB)
                                    : const Color(0xFFBFDBFE),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${h.month}월',
                              style: TextStyle(
                                fontSize: 11,
                                color: isCurrentMonth
                                    ? const Color(0xFF2563EB)
                                    : const Color(0xFF9CA3AF),
                                fontWeight: isCurrentMonth
                                    ? FontWeight.bold
                                    : FontWeight.normal,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

// ============================================================
// 파이차트 카드
// ============================================================

const _chartColors = [
  Color(0xFF2563EB),
  Color(0xFF7C3AED),
  Color(0xFF059669),
  Color(0xFFD97706),
  Color(0xFFDC2626),
  Color(0xFF0891B2),
  Color(0xFF9CA3AF),
];

class _PieChartCard extends StatelessWidget {
  final Map<String, int> categories;
  final int total;
  const _PieChartCard({required this.categories, required this.total});

  @override
  Widget build(BuildContext context) {
    final entries = categories.entries.toList();
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('카테고리별 지출',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827))),
          const SizedBox(height: 16),
          Row(
            children: [
              // 파이차트
              SizedBox(
                width: 120,
                height: 120,
                child: CustomPaint(
                  painter: _PieChartPainter(
                    entries: entries,
                    total: total,
                    colors: _chartColors,
                  ),
                ),
              ),
              const SizedBox(width: 20),
              // 범례
              Expanded(
                child: Column(
                  children: entries.take(5).toList().asMap().entries.map((e) {
                    final idx = e.key;
                    final entry = e.value;
                    final pct = total > 0
                        ? (entry.value / total * 100).toStringAsFixed(1)
                        : '0';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        children: [
                          Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: _chartColors[idx % _chartColors.length],
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              entry.key,
                              style: const TextStyle(
                                  fontSize: 12, color: Color(0xFF374151)),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '$pct%',
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF111827)),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PieChartPainter extends CustomPainter {
  final List<MapEntry<String, int>> entries;
  final int total;
  final List<Color> colors;

  _PieChartPainter(
      {required this.entries, required this.total, required this.colors});

  @override
  void paint(Canvas canvas, Size size) {
    if (total == 0) return;
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    double startAngle = -pi / 2;

    for (int i = 0; i < entries.length; i++) {
      final sweep = entries[i].value / total * 2 * pi;
      final paint = Paint()
        ..color = colors[i % colors.length]
        ..style = PaintingStyle.fill;
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweep,
        true,
        paint,
      );
      startAngle += sweep;
    }

    // 가운데 흰 원 (도넛 효과)
    canvas.drawCircle(
        center,
        radius * 0.55,
        Paint()
          ..color = Colors.white
          ..style = PaintingStyle.fill);
  }

  @override
  bool shouldRepaint(_PieChartPainter old) => old.total != total;
}

// ============================================================
// 이상치 감지 카드
// ============================================================

class _AnomalyCard extends StatelessWidget {
  final Map<String, int> categories;
  final int total;
  const _AnomalyCard({required this.categories, required this.total});

  // 평균 대비 30% 이상 높은 카테고리 감지
  List<MapEntry<String, int>> get _anomalies {
    if (categories.isEmpty || total == 0) return [];
    final avg = total / categories.length;
    return categories.entries
        .where((e) => e.value > avg * 1.3)
        .toList()
      ..sort((a, b) => b.value.compareTo(a.value));
  }

  @override
  Widget build(BuildContext context) {
    final anomalies = _anomalies;
    if (anomalies.isEmpty) return const SizedBox.shrink();
    final fmt = NumberFormat('#,###');

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_outlined,
                  size: 16, color: Color(0xFFD97706)),
              SizedBox(width: 6),
              Text('이달 지출 주의',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFD97706))),
            ],
          ),
          const SizedBox(height: 8),
          ...anomalies.take(3).map((e) {
            final pct = total > 0 ? (e.value / total * 100).toInt() : 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      '${e.key} · 전체의 $pct%',
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF92400E)),
                    ),
                  ),
                  Text(
                    '${fmt.format(e.value)}원',
                    style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFD97706)),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ============================================================
// 구독-지출 교차 브리핑 Provider
// ============================================================

final _subscriptionCrossProvider = FutureProvider.autoDispose<
    ({
      int count,
      int monthlyTotal,
      List<SubscriptionItem> todayDue,
    })>((ref) async {
  const userId = 'local_user';
  final db = ref.watch(appDatabaseProvider);
  final now = DateTime.now();

  final subs = await (db.select(db.subscriptionItems)
        ..where((t) => t.userId.equals(userId))
        ..where((t) => t.isActive.equals(true)))
      .get();

  final monthlyTotal = subs.fold(0, (sum, s) =>
      sum + (s.cycle == 'monthly' ? s.amount : (s.amount / 12).round()));

  final todayDue = subs.where((s) => s.billingDay == now.day).toList();

  return (count: subs.length, monthlyTotal: monthlyTotal, todayDue: todayDue);
});

// ============================================================
// 구독-지출 교차 브리핑 카드
// ============================================================

class _SubscriptionBriefingCard extends ConsumerWidget {
  const _SubscriptionBriefingCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subAsync = ref.watch(_subscriptionCrossProvider);
    final summaryAsync = ref.watch(monthlySummaryProvider);

    return subAsync.when(
      data: (sub) {
        if (sub.count == 0) return const SizedBox.shrink();

        final fmt = NumberFormat('#,###');
        final monthlyExpense = summaryAsync.valueOrNull?.expense ?? 0;

        // 구독비가 이달 지출에서 차지하는 비중 (추정)
        final subRatio = monthlyExpense > 0
            ? (sub.monthlyTotal / monthlyExpense * 100).clamp(0, 100)
            : 0.0;

        // 경고 레벨: 구독비가 지출의 40% 초과 시
        final isWarning = subRatio >= 40;

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isWarning
                ? const Color(0xFFFFF7ED)
                : const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isWarning
                  ? const Color(0xFFFED7AA)
                  : const Color(0xFFBBF7D0),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    isWarning
                        ? Icons.warning_amber_outlined
                        : Icons.subscriptions_outlined,
                    size: 15,
                    color: isWarning
                        ? const Color(0xFFD97706)
                        : const Color(0xFF059669),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    '정기결제 현황',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: isWarning
                          ? const Color(0xFFD97706)
                          : const Color(0xFF059669),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${sub.count}건 · 월 ${fmt.format(sub.monthlyTotal)}원',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isWarning
                          ? const Color(0xFF92400E)
                          : const Color(0xFF065F46),
                    ),
                  ),
                ],
              ),
              if (monthlyExpense > 0) ...[
                const SizedBox(height: 8),
                // 구독비 비중 바
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (subRatio / 100).clamp(0.0, 1.0),
                    minHeight: 6,
                    backgroundColor: const Color(0xFFE5E7EB),
                    valueColor: AlwaysStoppedAnimation<Color>(
                      isWarning
                          ? const Color(0xFFD97706)
                          : const Color(0xFF059669),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '이달 지출 중 정기결제 비중: ${subRatio.toStringAsFixed(1)}%'
                  '${isWarning ? ' ⚠️ 절감 검토 권장' : ''}',
                  style: TextStyle(
                    fontSize: 11,
                    color: isWarning
                        ? const Color(0xFF92400E)
                        : const Color(0xFF065F46),
                  ),
                ),
              ],
              // 오늘 결제 예정
              if (sub.todayDue.isNotEmpty) ...[
                const SizedBox(height: 8),
                const Divider(height: 1, color: Color(0xFFE5E7EB)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.today_outlined,
                        size: 13, color: Color(0xFFEF4444)),
                    const SizedBox(width: 4),
                    Text(
                      '오늘 결제 예정: ${sub.todayDue.map((s) => '${s.name} ${fmt.format(s.amount)}원').join(', ')}',
                      style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFFEF4444),
                          fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}
