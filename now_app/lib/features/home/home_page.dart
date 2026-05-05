import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../repositories/repository_providers.dart';
import '../../widgets/context_memo_widget.dart';
import '../../widgets/app_bottom_nav.dart';
import '../settings/routine_management_page.dart';
import '../../services/briefing_service.dart';
import '../../core/database/app_database.dart';
import '../meeting/meetings_page.dart';

// ============================================================
// 모델
// ============================================================

class ActionItem {
  final String id;
  final String content;
  final String status;
  final String? dueTime;
  final String meetingTitle;

  const ActionItem({
    required this.id,
    required this.content,
    required this.status,
    this.dueTime,
    required this.meetingTitle,
  });
}

class CalendarEventItem {
  final String id;
  final String title;
  final String startTime;
  final String endTime;
  final bool hasMeeting;

  const CalendarEventItem({
    required this.id,
    required this.title,
    required this.startTime,
    required this.endTime,
    required this.hasMeeting,
  });
}

// ============================================================
// DB Provider
// ============================================================

const _userId = 'local_user';

final todayEventsDbProvider =
    FutureProvider.autoDispose<List<CalendarEventItem>>((ref) async {
  final repo = ref.watch(calendarEventRepositoryProvider);
  final events = await repo.getTodayEvents(_userId);
  final List<CalendarEventItem> result = [];
  for (final e in events) {
    final hasMeeting = await repo.hasMeeting(e.calendarEventId);
    result.add(CalendarEventItem(
      id: e.calendarEventId,
      title: e.title,
      startTime: DateFormat('HH:mm').format(e.startTime),
      endTime: DateFormat('HH:mm').format(e.endTime),
      hasMeeting: hasMeeting,
    ));
  }
  return result;
});

final todayActionsDbProvider =
    FutureProvider.autoDispose<List<ActionItem>>((ref) async {
  final items = await ref
      .watch(itemRepositoryProvider)
      .getTodayPendingItems(_userId);
  return items
      .map((item) => ActionItem(
            id: item.itemId,
            content: item.content,
            status: item.status,
            dueTime: item.dueTime,
            meetingTitle: '',
          ))
      .toList();
});

final todayMemoDbProvider =
    FutureProvider.autoDispose<MeetingSummary?>((ref) async {
  final memo = await ref
      .watch(localMeetingRepositoryProvider)
      .getDailyMemoByDate(DateTime.now());
  if (memo == null) return null;
  return MeetingSummary(
    id: memo.meetingId,
    title: memo.title.isNotEmpty ? memo.title : '오늘 메모',
    date: memo.startedAt ?? memo.createdAt,
    segmentCount: memo.segmentCount,
    actionCount: memo.actionCount,
    decisionCount: memo.decisionCount,
    isImportant: memo.isImportant,
    recordType: memo.recordType,
    participantName: memo.participantName,
  );
});

// 오늘 해당하는 루틴 필터링 (DB 연동)
final todayPendingRoutinesProvider =
    FutureProvider.autoDispose<List<RoutineUiItem>>((ref) async {
  // AsyncNotifier에서 데이터 로드
  final routinesAsync = ref.watch(routineItemsProvider);
  final routines = routinesAsync.valueOrNull ?? [];
  final today = DateTime.now();
  final weekday = today.weekday; // 1=월 ~ 7=일
  final todayStr = DateFormat('yyyy-MM-dd').format(today);

  // 오늘 완료된 루틴 ID 목록
  final repo = ref.read(routineRepositoryProvider);
  final completedIds = await repo.getCompletedRoutineIds('local_user', todayStr);

  return routines.where((r) {
    if (!r.isEnabled) return false;
    if (completedIds.contains(r.id)) return false; // 완료된 루틴 제외
    return switch (r.repeat) {
      RoutineRepeat.daily    => true,
      RoutineRepeat.weekdays => weekday <= 5,
      RoutineRepeat.weekends => weekday >= 6,
      RoutineRepeat.weekly   => r.weekdays.contains(weekday),
    };
  }).toList();
});

// ============================================================
// 홈 화면
// ============================================================

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(todayEventsDbProvider);
    final actionsAsync = ref.watch(todayActionsDbProvider);
    final todayMemoAsync = ref.watch(todayMemoDbProvider);
    final briefingAsync = ref.watch(todayBriefingProvider);
    final todayRoutinesAsync = ref.watch(todayPendingRoutinesProvider);
    final todayRoutines = todayRoutinesAsync.valueOrNull ?? [];
    final now = DateTime.now();
    final greeting = _getGreeting(now.hour);
    final dateStr = DateFormat('M월 d일 EEEE', 'ko').format(now);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FB),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF5F7FB),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Color(0xFF6B7280)),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      extendBody: true,
      floatingActionButton: const _HomeInputFab(),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      body: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _HomeHeader(greeting: greeting, dateStr: dateStr),
            ),
            const SliverToBoxAdapter(child: ContextMemoWidget()),

            // LLM 브리핑 카드
            SliverToBoxAdapter(
              child: briefingAsync.when(
                data: (b) => b != null
                    ? _LlmBriefingCard(
                        briefing: b,
                        onRefresh: () async {
                          await ref
                              .read(briefingServiceProvider)
                              .deleteTodayBriefing();
                          ref.invalidate(todayBriefingProvider);
                        },
                      )
                    : _LlmBriefingEmptyCard(
                        onRefresh: () async {
                          ref.invalidate(todayBriefingProvider);
                        },
                      ),
                loading: () => const _BriefingLoadingCard(),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ),

            // 오늘 루틴
            if (todayRoutines.isNotEmpty)
              SliverToBoxAdapter(
                child: _RoutineSection(routines: todayRoutines),
              ),

            SliverToBoxAdapter(
              child: actionsAsync.when(
                data: (actions) => _BriefingSection(actions: actions),
                loading: () => const _LoadingSection(label: '오늘 할 일'),
                error: (e, _) => const SizedBox.shrink(),
              ),
            ),
            SliverToBoxAdapter(
              child: eventsAsync.when(
                data: (events) => _TimelineSection(events: events),
                loading: () => const _LoadingSection(label: '오늘 일정'),
                error: (e, _) => const _TimelineSection(events: []),
              ),
            ),
            SliverToBoxAdapter(
              child: todayMemoAsync.when(
                data: (memo) => _TodayMemoSection(memo: memo),
                loading: () => const _LoadingSection(label: '오늘 메모'),
                error: (e, _) => const _TodayMemoSection(memo: null),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
      ),
      bottomNavigationBar: const AppBottomNav(selectedIndex: 0),
    );
  }

  String _getGreeting(int hour) {
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '안녕하세요';
    return '수고하셨어요';
  }
}

class _HomeInputFab extends StatelessWidget {
  const _HomeInputFab();

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton(
      onPressed: () => _showInputHub(context),
      backgroundColor: const Color(0xFF2563EB),
      elevation: 4,
      shape: const CircleBorder(),
      child: const Icon(Icons.add, color: Colors.white, size: 28),
    );
  }

  void _showInputHub(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              _InputHubAction(
                icon: Icons.today_outlined,
                title: '간단 메모',
                subtitle: '날짜 중심으로 빠르게 기록',
                onTap: () {
                  Navigator.pop(sheetContext);
                  context.push('/memo/start');
                },
              ),
              _InputHubAction(
                icon: Icons.account_tree_outlined,
                title: '계층 메모',
                subtitle: '메모 아래에 메모 정리',
                onTap: () {
                  Navigator.pop(sheetContext);
                  context.push('/memo/tree');
                },
              ),
              _InputHubAction(
                icon: Icons.center_focus_strong,
                title: '캡처',
                subtitle: '사진, 텍스트, 음성 자동 분류',
                onTap: () {
                  Navigator.pop(sheetContext);
                  context.push('/capture');
                },
              ),
              _InputHubAction(
                icon: Icons.groups_outlined,
                title: '회의/대화',
                subtitle: '원본과 LLM 분석 저장',
                onTap: () {
                  Navigator.pop(sheetContext);
                  context.push('/meeting/start');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InputHubAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _InputHubAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: const Color(0xFF2563EB), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 20, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 헤더
// ============================================================

class _HomeHeader extends StatelessWidget {
  final String greeting;
  final String dateStr;
  const _HomeHeader({required this.greeting, required this.dateStr});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(18, 18, 14, 16),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE5EAF2)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF1F2937).withValues(alpha: 0.06),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          children: [
            Positioned(
              right: -12,
              top: -8,
              child: Opacity(
                opacity: 0.12,
                child: Image.asset(
                  'assets/icon/app_icon.png',
                  width: 120,
                  height: 120,
                ),
              ),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        greeting,
                        style: const TextStyle(
                          fontSize: 23,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF111827),
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        dateStr,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      const SizedBox(height: 14),
                      InkWell(
                        onTap: () => context.push('/memo/start'),
                        borderRadius: BorderRadius.circular(999),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.edit_note,
                                  size: 16, color: Color(0xFF2563EB)),
                              SizedBox(width: 6),
                              Text(
                                '오늘 메모 남기기',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF2563EB),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 78,
                  height: 78,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Image.asset('assets/icon/app_icon.png'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 오늘 루틴 섹션
// ============================================================

class _RoutineSection extends ConsumerWidget {
  final List<RoutineUiItem> routines;
  const _RoutineSection({required this.routines});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🔁', style: TextStyle(fontSize: 14)),
              const SizedBox(width: 6),
              const Text('오늘 루틴',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                      letterSpacing: 0.5)),
              const Spacer(),
              GestureDetector(
                onTap: () => context.push('/settings/routines'),
                child: const Text('관리',
                    style: TextStyle(
                        fontSize: 12, color: Color(0xFF2563EB))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: routines
                  .asMap()
                  .entries
                  .map((entry) => _RoutineTile(
                        routine: entry.value,
                        isLast: entry.key == routines.length - 1,
                        onToggle: () async {
                          // 완료 처리 → RoutineCompletions DB 기록
                          final todayStr = DateFormat('yyyy-MM-dd')
                              .format(DateTime.now());
                          await ref
                              .read(routineRepositoryProvider)
                              .markComplete(
                                  entry.value.id, 'local_user', todayStr);
                          ref.invalidate(todayPendingRoutinesProvider);
                        },
                      ))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _RoutineTile extends StatelessWidget {
  final RoutineUiItem routine;
  final bool isLast;
  final VoidCallback onToggle;

  const _RoutineTile({
    required this.routine,
    required this.isLast,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(
            children: [
              // 체크 버튼
              GestureDetector(
                onTap: onToggle,
                child: Container(
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFF3F4F6),
                    border: Border.all(
                        color: const Color(0xFFD1D5DB), width: 1.5),
                  ),
                  child: const SizedBox.shrink(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      routine.name,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF111827)),
                    ),
                    Row(
                      children: [
                        Text(
                          routine.repeatLabel,
                          style: const TextStyle(
                              fontSize: 11, color: Color(0xFF9CA3AF)),
                        ),
                        if (routine.alertTime != null) ...[
                          const Text(' · ',
                              style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF9CA3AF))),
                          Text(
                            routine.alertLabel,
                            style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF9CA3AF)),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (!isLast)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: Divider(height: 1, color: Color(0xFFE5E7EB)),
          ),
      ],
    );
  }
}

// ============================================================
// 로딩 섹션
// ============================================================

class _LoadingSection extends StatelessWidget {
  final String label;
  const _LoadingSection({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280))),
          const SizedBox(height: 10),
          Container(
            height: 72,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: const Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Color(0xFF2563EB)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// ============================================================
// LLM 브리핑 카드
// ============================================================

class _LlmBriefingCard extends StatefulWidget {
  final Briefing briefing;
  final Future<void> Function() onRefresh;
  const _LlmBriefingCard({required this.briefing, required this.onRefresh});

  @override
  State<_LlmBriefingCard> createState() => _LlmBriefingCardState();
}

class _LlmBriefingCardState extends State<_LlmBriefingCard> {
  bool _isRefreshing = false;

  List<String> _parseJson(String? json) {
    if (json == null || json.isEmpty) return [];
    try {
      final decoded = jsonDecode(json);
      if (decoded is List) return decoded.cast<String>();
    } catch (_) {}
    return [];
  }

  @override
  Widget build(BuildContext context) {
    final mustDo = _parseJson(widget.briefing.mustDoJson);
    final tasks = _parseJson(widget.briefing.tasksJson);
    final advice = widget.briefing.advice;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 헤더
          Row(
            children: [
              const Text('✨', style: TextStyle(fontSize: 14)),
              const SizedBox(width: 6),
              const Text('오늘의 브리핑',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                      letterSpacing: 0.5)),
              const Spacer(),
              GestureDetector(
                onTap: _isRefreshing
                    ? null
                    : () async {
                        setState(() => _isRefreshing = true);
                        await widget.onRefresh();
                        if (mounted) setState(() => _isRefreshing = false);
                      },
                child: _isRefreshing
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF9CA3AF),
                        ),
                      )
                    : const Icon(Icons.refresh,
                        size: 16, color: Color(0xFF9CA3AF)),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // 조언 카드 (데이터 있을 때만)
          if (advice != null && advice.isNotEmpty) ...[
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
                  const Text('💡 AI 조언',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.white70)),
                  const SizedBox(height: 6),
                  Text(advice,
                      style: const TextStyle(
                          fontSize: 14,
                          color: Colors.white,
                          height: 1.5)),
                  if (widget.briefing.adviceBasis != null) ...[
                    const SizedBox(height: 6),
                    Text('근거: ${widget.briefing.adviceBasis}',
                        style: const TextStyle(
                            fontSize: 11, color: Colors.white60)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 10),
          ],

          // 오늘 꼭 할 것
          if (mustDo.isNotEmpty)
            _BriefingItemList(
              icon: '🎯',
              label: 'AI 추천 오늘 고려사항',
              items: mustDo,
              accentColor: const Color(0xFFDC2626),
            ),

          // 할 일
          if (tasks.isNotEmpty)
            _BriefingItemList(
              icon: '📋',
              label: 'AI 제안',
              items: tasks,
              accentColor: const Color(0xFF2563EB),
            ),
        ],
      ),
    );
  }
}

class _BriefingItemList extends StatelessWidget {
  final String icon;
  final String label;
  final List<String> items;
  final Color accentColor;
  const _BriefingItemList({
    required this.icon,
    required this.label,
    required this.items,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
              child: Row(
                children: [
                  Text(icon, style: const TextStyle(fontSize: 13)),
                  const SizedBox(width: 6),
                  Text(label,
                      style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: accentColor)),
                ],
              ),
            ),
            const Divider(height: 1, indent: 14, endIndent: 14),
            ...items.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 9),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 5,
                        height: 5,
                        margin: const EdgeInsets.only(top: 6, right: 8),
                        decoration: BoxDecoration(
                          color: accentColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      Expanded(
                        child: Text(item,
                            style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF111827),
                                height: 1.4)),
                      ),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }
}

class _BriefingLoadingCard extends StatelessWidget {
  const _BriefingLoadingCard();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Color(0xFF2563EB)),
            ),
            SizedBox(width: 10),
            Text('브리핑 생성 중...',
                style:
                    TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
          ],
        ),
      ),
    );
  }
}

class _LlmBriefingEmptyCard extends StatelessWidget {
  final Future<void> Function() onRefresh;

  const _LlmBriefingEmptyCard({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome_outlined,
                  size: 14, color: Color(0xFF6B7280)),
              const SizedBox(width: 6),
              const Text('LLM 브리핑',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                      letterSpacing: 0.5)),
              const Spacer(),
              GestureDetector(
                onTap: onRefresh,
                child: const Icon(Icons.refresh,
                    size: 16, color: Color(0xFF9CA3AF)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          InkWell(
            onTap: onRefresh,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.auto_awesome,
                      size: 22, color: Color(0xFF2563EB)),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('오늘 브리핑이 아직 없습니다',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF111827))),
                        SizedBox(height: 3),
                        Text('터치하여 다시 생성해보세요',
                            style: TextStyle(
                                fontSize: 12, color: Color(0xFF9CA3AF))),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right,
                      size: 18, color: Color(0xFF9CA3AF)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// 브리핑 섹션 (오늘 할 일)
// ============================================================

class _BriefingSection extends StatelessWidget {
  final List<ActionItem> actions;
  const _BriefingSection({required this.actions});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('☀️', style: TextStyle(fontSize: 14)),
              const SizedBox(width: 6),
              const Text('오늘 할 일',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                      letterSpacing: 0.5)),
              const Spacer(),
              Text('${actions.length}건',
                  style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF2563EB))),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: actions.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: Text('오늘 할 일이 없습니다 🎉',
                          style: TextStyle(
                              fontSize: 14, color: Color(0xFF9CA3AF))),
                    ),
                  )
                : Column(
                    children: actions
                        .map((a) => _ActionTile(action: a))
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  final ActionItem action;
  const _ActionTile({required this.action});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                  color: const Color(0xFFD1D5DB), width: 1.5),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(action.content,
                    style: const TextStyle(
                        fontSize: 14, color: Color(0xFF111827))),
                if (action.dueTime != null)
                  Text(action.dueTime!,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF9CA3AF))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 타임라인 섹션 (오늘 일정) - 자동 새로고침 적용됨
// ============================================================

class _TimelineSection extends ConsumerWidget { // [변경] StatelessWidget -> ConsumerWidget
  final List<CalendarEventItem> events;
  const _TimelineSection({required this.events});

  @override
  Widget build(BuildContext context, WidgetRef ref) { // [변경] WidgetRef 추가
    
    // 일정 관리 페이지로 이동하는 함수
    Future<void> goToSchedulePage() async {
      await context.push('/schedule');
      ref.invalidate(todayEventsDbProvider);
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.calendar_month_outlined,
                  size: 14, color: Color(0xFF6B7280)),
              const SizedBox(width: 6),
              const Text('오늘 일정',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                      letterSpacing: 0.5)),
              const Spacer(),
              
              // [관리] 버튼 클릭 시
              GestureDetector(
                onTap: goToSchedulePage,
                child: const Text('관리',
                    style: TextStyle(fontSize: 12, color: Color(0xFF2563EB))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          
          // [컨테이너] 클릭 시
          InkWell(
            onTap: goToSchedulePage,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: events.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 24),
                      child: Center( // Center 위젯으로 텍스트 중앙 정렬
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('오늘 일정이 없습니다',
                                style: TextStyle(
                                    fontSize: 14, color: Color(0xFF9CA3AF))),
                            SizedBox(height: 4),
                            Text('터치하여 일정 추가',
                                style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF2563EB),
                                    fontWeight: FontWeight.w500)),
                          ],
                        ),
                      ),
                    )
                  : Column(
                      children: events
                          .map((e) => _EventTile(
                                event: e,
                                onTap: e.hasMeeting
                                    ? () => context.push(
                                          '/meeting/progress',
                                          extra: CalendarEventItem(
                                            id: e.id,
                                            title: e.title,
                                            startTime: e.startTime,
                                            endTime: e.endTime,
                                            hasMeeting: e.hasMeeting,
                                          ),
                                        )
                                    : goToSchedulePage, // 일반 일정도 클릭하면 관리 화면으로
                              ))
                          .toList(),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EventTile extends StatelessWidget {
  final CalendarEventItem event;
  final VoidCallback? onTap;

  const _EventTile({required this.event, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            // 1. 색상 바 (회의가 있으면 초록, 없으면 파랑)
            Container(
              width: 3,
              height: 36,
              decoration: BoxDecoration(
                color: event.hasMeeting
                    ? const Color(0xFF10B981)
                    : const Color(0xFF2563EB),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 12),
            
            // 2. 제목 및 시간
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(event.title,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF111827))),
                  const SizedBox(height: 2),
                  Text('${event.startTime} - ${event.endTime}',
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF9CA3AF))),
                ],
              ),
            ),
            
            // 3. 우측 아이콘 (회의 기록됨 뱃지 or 화살표)
            if (event.hasMeeting)
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('기록됨',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF10B981))),
              )
            else
              const Icon(Icons.chevron_right,
                  size: 18, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}

class _TodayMemoSection extends StatelessWidget {
  final MeetingSummary? memo;

  const _TodayMemoSection({required this.memo});

  @override
  Widget build(BuildContext context) {
    final todayMemo = memo;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.edit_note_outlined,
                  size: 14, color: Color(0xFF6B7280)),
              const SizedBox(width: 6),
              const Text('오늘 메모',
                  style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                      letterSpacing: 0.5)),
              const Spacer(),
              GestureDetector(
                onTap: () => context.push('/memo/start'),
                child: const Text('추가',
                    style: TextStyle(fontSize: 12, color: Color(0xFF2563EB))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          InkWell(
            onTap: todayMemo == null
                ? () => context.push('/memo/start')
                : () => context.push('/meetings/${todayMemo.id}',
                    extra: todayMemo),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: todayMemo == null
                  ? const Center(
                      child: Column(
                        children: [
                          Text('오늘 메모가 없습니다',
                              style: TextStyle(
                                  fontSize: 14, color: Color(0xFF9CA3AF))),
                          SizedBox(height: 4),
                          Text('터치하여 메모 추가',
                              style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF2563EB),
                                  fontWeight: FontWeight.w500)),
                        ],
                      ),
                    )
                  : Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.edit_note,
                              size: 22, color: Color(0xFF2563EB)),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(todayMemo.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF111827))),
                              const SizedBox(height: 3),
                              Text(
                                '${DateFormat('HH:mm').format(todayMemo.date)} · 메모 ${todayMemo.segmentCount}줄',
                                style: const TextStyle(
                                    fontSize: 12, color: Color(0xFF9CA3AF)),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right,
                            size: 18, color: Color(0xFF9CA3AF)),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
