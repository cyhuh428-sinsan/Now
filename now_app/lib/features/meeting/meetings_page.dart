import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../repositories/local/local_meeting_repository.dart';
import '../../repositories/repository_providers.dart';
import '../../core/database/app_database.dart';
import 'memo_tree_page.dart';

// ============================================================
// 회의 요약 모델
// ============================================================

class MeetingSummary {
  final String id;
  final String title;
  final DateTime date;
  final int segmentCount;
  final int actionCount;
  final int decisionCount;
  final bool isImportant;
  // recordType: 'meeting' | 'interview' | 'conversation'
  final String recordType;
  final String? participantName;

  const MeetingSummary({
    required this.id,
    required this.title,
    required this.date,
    required this.segmentCount,
    required this.actionCount,
    required this.decisionCount,
    this.isImportant = false,
    this.recordType = 'meeting',
    this.participantName,
  });

  MeetingSummary copyWith({bool? isImportant}) => MeetingSummary(
        id: id,
        title: title,
        date: date,
        segmentCount: segmentCount,
        actionCount: actionCount,
        decisionCount: decisionCount,
        isImportant: isImportant ?? this.isImportant,
        recordType: recordType,
        participantName: participantName,
      );
}

// ============================================================
// Provider — DB 연동
// ============================================================

// DB Meeting → MeetingSummary 변환 헬퍼
MeetingSummary _toSummary(Meeting m) => MeetingSummary(
      id: m.meetingId,
      title: m.title.isNotEmpty ? m.title : '기록',
      date: m.startedAt ?? m.createdAt,
      segmentCount: m.segmentCount,
      actionCount: m.actionCount,
      decisionCount: m.decisionCount,
      isImportant: m.isImportant,
      recordType: m.recordType,
      participantName: m.participantName,
    );

// 메모리 + DB 동기화 Provider
final meetingSummariesProvider =
    StateNotifierProvider<MeetingSummariesNotifier, List<MeetingSummary>>(
        (ref) => MeetingSummariesNotifier(
            ref.watch(localMeetingRepositoryProvider)));

class MeetingSummariesNotifier
    extends StateNotifier<List<MeetingSummary>> {
  final LocalMeetingRepository _repo;

  MeetingSummariesNotifier(this._repo) : super([]) {
    _load();
  }

  Future<void> _load() async {
    final rows = await _repo.getAllMeetings();
    state = rows.map((m) => _toSummary(m)).toList();
  }

  Future<void> addMeeting(MeetingSummary summary) async {
    state = [summary, ...state];
  }

  Future<void> upsertMeeting(MeetingSummary summary) async {
    final exists = state.any((m) => m.id == summary.id);
    state = exists
        ? state.map((m) => m.id == summary.id ? summary : m).toList()
        : [summary, ...state];
  }

  Future<void> toggleImportant(String id) async {
    final target = state.firstWhere((m) => m.id == id);
    await _repo.toggleImportant(id, !target.isImportant);
    state = state
        .map((m) => m.id == id ? m.copyWith(isImportant: !m.isImportant) : m)
        .toList();
  }

  Future<void> deleteMeeting(String id) async {
    await _repo.deleteMeeting(id);
    state = state.where((m) => m.id != id).toList();
  }

  Future<void> updateTitle(String id, String title) async {
    await _repo.updateTitle(id, title);
    state = state
        .map((m) => m.id == id
            ? MeetingSummary(
                id: m.id,
                title: title,
                date: m.date,
                segmentCount: m.segmentCount,
                actionCount: m.actionCount,
                decisionCount: m.decisionCount,
                isImportant: m.isImportant,
                recordType: m.recordType,
                participantName: m.participantName,
              )
            : m)
        .toList();
  }
}

// ============================================================
// 회의록 탭 메인 페이지
// ============================================================

class MeetingsPage extends ConsumerWidget {
  const MeetingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meetings = ref.watch(meetingSummariesProvider);

    final meetingList = meetings.where((m) => m.recordType == 'meeting').toList();
    final interviewList = meetings.where((m) => m.recordType == 'interview' || m.recordType == 'conversation').toList();
    final memoList = meetings.where((m) => m.recordType == 'memo').toList();
    final treeMemosAsync = ref.watch(treeMemosProvider);

    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8F9FA),
        appBar: AppBar(
          backgroundColor: const Color(0xFFF8F9FA),
          elevation: 0,
          title: const Text(
            '기록',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827),
            ),
          ),
          bottom: const TabBar(
            labelColor: Color(0xFF2563EB),
            unselectedLabelColor: Color(0xFF9CA3AF),
            indicatorColor: Color(0xFF2563EB),
            tabs: [
              Tab(text: '🗓 회의'),
              Tab(text: '💬 대화'),
              Tab(text: '📝 메모'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // ── 회의 탭 ──
            meetingList.isEmpty
                ? const _EmptyMeetings(type: 'meeting')
                : _RecordList(
                    meetings: meetingList,
                    onTap: (m) => context.push('/meetings/${m.id}', extra: m),
                    onImportantToggle: (m) => _toggleImportant(ref, m),
                    onDelete: (m) => _confirmDelete(context, ref, m),
                  ),
            // ── 대화 탭 ──
            interviewList.isEmpty
                ? const _EmptyMeetings(type: 'conversation')
                : _RecordList(
                    meetings: interviewList,
                    onTap: (m) => context.push('/meetings/${m.id}', extra: m),
                    onImportantToggle: (m) => _toggleImportant(ref, m),
                    onDelete: (m) => _confirmDelete(context, ref, m),
                  ),
            // ── 메모 탭 ──
            treeMemosAsync.when(
              data: (treeMemos) => memoList.isEmpty && treeMemos.isEmpty
                  ? const _EmptyMeetings(type: 'memo')
                  : _MemoOverviewList(
                      dailyMemos: memoList,
                      treeMemos: treeMemos,
                      onDailyTap: (m) =>
                          context.push('/meetings/${m.id}', extra: m),
                      onImportantToggle: (m) => _toggleImportant(ref, m),
                      onDelete: (m) => _confirmDelete(context, ref, m),
                    ),
              loading: () => memoList.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _MemoOverviewList(
                      dailyMemos: memoList,
                      treeMemos: const [],
                      onDailyTap: (m) =>
                          context.push('/meetings/${m.id}', extra: m),
                      onImportantToggle: (m) => _toggleImportant(ref, m),
                      onDelete: (m) => _confirmDelete(context, ref, m),
                    ),
              error: (e, _) => Center(child: Text('오류: $e')),
            ),
          ],
        ),
        floatingActionButton: Builder(
          builder: (ctx) {
            return FloatingActionButton(
              onPressed: () {
                // 버튼 누르는 시점의 탭 인덱스 확인
                final tabIndex = DefaultTabController.of(ctx).index;
                final types = ['meeting', 'conversation', 'memo'];
                final type = types[tabIndex];
                debugPrint('[+ 버튼] 현재 탭=$tabIndex type=$type');
                if (type == 'memo') {
                  _showMemoCreateSheet(ctx);
                } else {
                  ctx.push('/meeting/start', extra: {'initialType': type});
                }
              },
              backgroundColor: const Color(0xFF2563EB),
              child: const Icon(Icons.add, color: Colors.white),
            );
          },
        ),
        bottomNavigationBar: const AppBottomNav(selectedIndex: 4),
      ),
    );
  }
}

// ============================================================

// 기록 목록 위젯
// ============================================================

class _RecordList extends StatelessWidget {
  final List<MeetingSummary> meetings;
  final void Function(MeetingSummary) onTap;
  final void Function(MeetingSummary) onImportantToggle;
  final void Function(MeetingSummary) onDelete;

  const _RecordList({
    required this.meetings,
    required this.onTap,
    required this.onImportantToggle,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final important = meetings.where((m) => m.isImportant).toList();
    final pinned = important.isNotEmpty ? important : meetings.take(3).toList();
    final grouped = <String, List<MeetingSummary>>{};
    for (final m in meetings) {
      final key = DateFormat('yyyy년 M월 d일 EEEE', 'ko').format(m.date);
      grouped.putIfAbsent(key, () => []).add(m);
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        _SectionHeader(
          icon: Icons.push_pin_outlined,
          label: important.isNotEmpty ? '중요' : '최근',
        ),
        const SizedBox(height: 8),
        ...pinned.map((m) => _MeetingCard(
              meeting: m,
              onTap: () => onTap(m),
              onImportantToggle: () => onImportantToggle(m),
              onDelete: () => onDelete(m),
            )),
        const SizedBox(height: 20),
        const _SectionHeader(
          icon: Icons.calendar_month_outlined,
          label: '전체',
        ),
        const SizedBox(height: 8),
        ...grouped.entries.map((entry) => _DateGroup(
              dateLabel: entry.key,
              meetings: entry.value,
              onTap: onTap,
              onImportantToggle: onImportantToggle,
              onDelete: onDelete,
            )),
        ],
      );
  }
}

class _MemoOverviewList extends StatefulWidget {
  final List<MeetingSummary> dailyMemos;
  final List<Memo> treeMemos;
  final void Function(MeetingSummary) onDailyTap;
  final void Function(MeetingSummary) onImportantToggle;
  final void Function(MeetingSummary) onDelete;

  const _MemoOverviewList({
    required this.dailyMemos,
    required this.treeMemos,
    required this.onDailyTap,
    required this.onImportantToggle,
    required this.onDelete,
  });

  @override
  State<_MemoOverviewList> createState() => _MemoOverviewListState();
}

class _MemoOverviewListState extends State<_MemoOverviewList> {
  late DateTime _focusedDay;
  late DateTime _selectedDay;

  @override
  void initState() {
    super.initState();
    _selectedDay = DateTime.now();
    _focusedDay = DateTime.now();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        const _SectionHeader(
          icon: Icons.calendar_month_outlined,
          label: '일자별 메모',
        ),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: TableCalendar<MeetingSummary>(
            locale: 'ko_KR',
            firstDay: DateTime.utc(2020, 1, 1),
            lastDay: DateTime.utc(2035, 12, 31),
            focusedDay: _focusedDay,
            daysOfWeekHeight: 24,
            rowHeight: 36,
            selectedDayPredicate: (day) => isSameDay(_selectedDay, day),
            eventLoader: (day) => widget.dailyMemos
                .where((memo) => isSameDay(memo.date, day))
                .toList(),
            calendarFormat: CalendarFormat.month,
            availableCalendarFormats: const {CalendarFormat.month: '월'},
            headerStyle: const HeaderStyle(
              titleCentered: true,
              formatButtonVisible: false,
              headerPadding: EdgeInsets.symmetric(vertical: 6),
              titleTextStyle: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF111827),
              ),
              leftChevronPadding: EdgeInsets.all(8),
              rightChevronPadding: EdgeInsets.all(8),
            ),
            calendarStyle: const CalendarStyle(
              selectedDecoration: BoxDecoration(
                color: Color(0xFF2563EB),
                shape: BoxShape.circle,
              ),
              todayDecoration: BoxDecoration(
                color: Color(0xFFEFF6FF),
                shape: BoxShape.circle,
              ),
              todayTextStyle: TextStyle(color: Color(0xFF2563EB)),
              markerDecoration: BoxDecoration(
                color: Color(0xFF10B981),
                shape: BoxShape.circle,
              ),
              cellMargin: EdgeInsets.all(4),
            ),
            onDaySelected: (selectedDay, focusedDay) {
              setState(() {
                _selectedDay = selectedDay;
                _focusedDay = focusedDay;
              });
              final memo = _dailyMemoFor(selectedDay);
              if (memo == null) {
                context.push('/memo/start', extra: selectedDay);
              } else {
                widget.onDailyTap(memo);
              }
            },
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            const Expanded(
              child: _SectionHeader(
                icon: Icons.account_tree_outlined,
                label: '계층 메모',
              ),
            ),
            TextButton(
              onPressed: () => context.push('/memo/tree'),
              child: const Text('편집'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (widget.treeMemos.isEmpty)
          _EmptyInlineMemoCard(
            icon: Icons.account_tree_outlined,
            title: '계층 메모가 없습니다',
            subtitle: '상위 메모부터 만들어보세요',
            onTap: () => context.push('/memo/tree'),
          )
        else
          _TreeMemoCompactList(memos: widget.treeMemos),
      ],
    );
  }

  MeetingSummary? _dailyMemoFor(DateTime day) {
    for (final memo in widget.dailyMemos) {
      if (isSameDay(memo.date, day)) return memo;
    }
    return null;
  }
}

class _TreeMemoCompactList extends StatefulWidget {
  final List<Memo> memos;

  const _TreeMemoCompactList({required this.memos});

  @override
  State<_TreeMemoCompactList> createState() => _TreeMemoCompactListState();
}

class _TreeMemoCompactListState extends State<_TreeMemoCompactList> {
  final Set<String> _expandedNodeIds = {};

  @override
  Widget build(BuildContext context) {
    final nodes = widget.memos.map(TreeMemoNode.fromMemo).toList();
    final roots = nodes.where((node) => node.parentId == null).toList();
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        children:
            roots.expand((node) => _buildNodeRows(context, node, nodes)).toList(),
      ),
    );
  }

  List<Widget> _buildNodeRows(
    BuildContext context,
    TreeMemoNode node,
    List<TreeMemoNode> nodes,
  ) {
    final children = nodes.where((child) => child.parentId == node.id).toList();
    final isExpanded = _expandedNodeIds.contains(node.id);
    return [
      _TreeMemoTitleRow(
        node: node,
        hasChildren: children.isNotEmpty,
        isExpanded: isExpanded,
        onTap: children.isEmpty
            ? () => context.push('/memo/tree')
            : () {
                setState(() {
                  if (isExpanded) {
                    _collapseNode(node, nodes);
                  } else {
                    _expandedNodeIds.add(node.id);
                  }
                });
              },
      ),
      if (isExpanded)
        ...children.expand((child) => _buildNodeRows(context, child, nodes)),
    ];
  }

  void _collapseNode(TreeMemoNode node, List<TreeMemoNode> nodes) {
    _expandedNodeIds.remove(node.id);
    final children = nodes.where((child) => child.parentId == node.id);
    for (final child in children) {
      _collapseNode(child, nodes);
    }
  }
}

class _TreeMemoTitleRow extends StatelessWidget {
  final TreeMemoNode node;
  final bool hasChildren;
  final bool isExpanded;
  final VoidCallback onTap;

  const _TreeMemoTitleRow({
    required this.node,
    required this.hasChildren,
    required this.isExpanded,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.fromLTRB(12 + ((node.level - 1) * 18), 8, 12, 8),
        child: Row(
          children: [
            Icon(
              node.level == 1
                  ? Icons.folder_outlined
                  : node.level == 2
                      ? Icons.subdirectory_arrow_right
                      : Icons.notes,
              size: 17,
              color: const Color(0xFF2563EB),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                node.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: node.level == 1 ? 14 : 13,
                  fontWeight:
                      node.level == 1 ? FontWeight.w600 : FontWeight.w500,
                  color: const Color(0xFF111827),
                ),
              ),
            ),
            if (hasChildren)
              Icon(
                isExpanded ? Icons.expand_less : Icons.expand_more,
                size: 18,
                color: const Color(0xFF9CA3AF),
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyInlineMemoCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _EmptyInlineMemoCard({
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
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            Icon(icon, color: const Color(0xFF2563EB)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 3),
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF9CA3AF))),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}

void _toggleImportant(WidgetRef ref, MeetingSummary meeting) {
  ref.read(meetingSummariesProvider.notifier).toggleImportant(meeting.id);
}

void _confirmDelete(
    BuildContext context, WidgetRef ref, MeetingSummary meeting) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        title: const Text('기록을 삭제할까요?',
            style:
                TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
        content: Text(
          '"${meeting.title}" 기록이 모두 삭제됩니다.',
          style:
              const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소',
                style: TextStyle(color: Color(0xFF6B7280))),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(meetingSummariesProvider.notifier).deleteMeeting(meeting.id);
            },
            child: const Text('삭제',
                style: TextStyle(color: Color(0xFFEF4444))),
          ),
        ],
      ),
    );
}

void _showMemoCreateSheet(BuildContext context) {
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            const SizedBox(height: 16),
            _MemoCreateAction(
              icon: Icons.today_outlined,
              title: '간단 메모',
              subtitle: '날짜 중심 메모를 입력합니다',
              onTap: () {
                Navigator.pop(sheetContext);
                context.push('/memo/start');
              },
            ),
            _MemoCreateAction(
              icon: Icons.account_tree_outlined,
              title: '계층 메모',
              subtitle: '메모 아래에 메모를 정리합니다',
              onTap: () {
                Navigator.pop(sheetContext);
                context.push('/memo/tree');
              },
            ),
          ],
        ),
      ),
    ),
  );
}

class _MemoCreateAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _MemoCreateAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: const Color(0xFF2563EB)),
      ),
      title: Text(title,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle,
          style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
      trailing: const Icon(Icons.chevron_right, color: Color(0xFF9CA3AF)),
    );
  }
}

// ============================================================
// 섹션 헤더
// ============================================================

class _SectionHeader extends StatelessWidget {
  final IconData icon;
  final String label;

  const _SectionHeader({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: const Color(0xFF6B7280)),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Color(0xFF6B7280),
            letterSpacing: 0.4,
          ),
        ),
      ],
    );
  }
}

// ============================================================
// 날짜 그룹
// ============================================================

class _DateGroup extends StatelessWidget {
  final String dateLabel;
  final List<MeetingSummary> meetings;
  final void Function(MeetingSummary) onTap;
  final void Function(MeetingSummary) onImportantToggle;
  final void Function(MeetingSummary) onDelete;

  const _DateGroup({
    required this.dateLabel,
    required this.meetings,
    required this.onTap,
    required this.onImportantToggle,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 12, 4, 6),
          child: Text(
            dateLabel,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFF9CA3AF),
            ),
          ),
        ),
        ...meetings.map((m) => _MeetingCard(
              meeting: m,
              onTap: () => onTap(m),
              onImportantToggle: () => onImportantToggle(m),
              onDelete: () => onDelete(m),
            )),
      ],
    );
  }
}

// ============================================================
// 회의 카드
// ============================================================

class _MeetingCard extends StatelessWidget {
  final MeetingSummary meeting;
  final VoidCallback onTap;
  final VoidCallback onImportantToggle;
  final VoidCallback onDelete;

  const _MeetingCard({
    required this.meeting,
    required this.onTap,
    required this.onImportantToggle,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final isMemo = meeting.recordType == 'memo';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: meeting.isImportant
              ? const Color(0xFFF59E0B).withValues(alpha: 0.5)
              : const Color(0xFFE5E7EB),
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              // 아이콘
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                    isMemo
                        ? Icons.edit_note
                        : meeting.recordType == 'conversation'
                            ? Icons.chat_bubble_outline
                            : Icons.groups_outlined,
                    size: 20,
                    color: const Color(0xFF2563EB)),
              ),
              const SizedBox(width: 12),
              // 정보
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (meeting.isImportant) ...[
                          const Icon(Icons.push_pin,
                              size: 13, color: Color(0xFFF59E0B)),
                          const SizedBox(width: 4),
                        ],
                        Expanded(
                          child: Text(
                            meeting.title,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF111827),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.access_time,
                            size: 12, color: Color(0xFF9CA3AF)),
                        const SizedBox(width: 3),
                        Text(
                          DateFormat('M/d HH:mm').format(meeting.date),
                          style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF)),
                        ),
                        const SizedBox(width: 10),
                        const Icon(Icons.chat_bubble_outline,
                            size: 12, color: Color(0xFF9CA3AF)),
                        const SizedBox(width: 3),
                        Text(
                          isMemo
                              ? '메모 ${meeting.segmentCount}줄'
                              : '발언 ${meeting.segmentCount}개',
                          style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF)),
                        ),
                      ],
                    ),
                    if (!isMemo ||
                        meeting.actionCount > 0 ||
                        meeting.decisionCount > 0) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          _Chip(
                              label: 'Action ${meeting.actionCount}',
                              color: const Color(0xFF2563EB)),
                          const SizedBox(width: 6),
                          _Chip(
                              label: 'Decision ${meeting.decisionCount}',
                              color: const Color(0xFF10B981)),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              // 버튼
              Column(
                children: [
                  GestureDetector(
                    onTap: onImportantToggle,
                    child: Icon(
                      meeting.isImportant
                          ? Icons.push_pin
                          : Icons.push_pin_outlined,
                      size: 18,
                      color: meeting.isImportant
                          ? const Color(0xFFF59E0B)
                          : const Color(0xFF9CA3AF),
                    ),
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: onDelete,
                    child: const Icon(Icons.delete_outline,
                        size: 18, color: Color(0xFF9CA3AF)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color color;

  const _Chip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: color),
      ),
    );
  }
}

// ============================================================
// 빈 상태
// ============================================================

// ============================================================
class _EmptyMeetings extends StatelessWidget {
  final String type;
  const _EmptyMeetings({this.type = 'meeting'});

  @override
  Widget build(BuildContext context) {
    // type: 'meeting' | 'interview' | 'conversation' | 'memo'
    final isMeeting = type == 'meeting';
    final isMemo = type == 'memo';
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(isMeeting
              ? Icons.article_outlined
              : isMemo
                  ? Icons.note_outlined
                  : Icons.chat_bubble_outline,
              size: 56, color: const Color(0xFFD1D5DB)),
          const SizedBox(height: 16),
          Text(isMeeting
              ? '아직 회의 기록이 없습니다'
              : isMemo
                  ? '아직 메모 기록이 없습니다'
                  : '아직 대화 기록이 없습니다',
              style: const TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 8),
          Text(isMeeting
              ? '회의를 시작해보세요'
              : isMemo
                  ? '메모를 시작해보세요'
                  : '대화를 시작해보세요',
              style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () {
              if (type == 'memo') {
                context.push('/memo/start');
              } else {
                context.push('/meeting/start', extra: {'initialType': type});
              }
            },
            icon: Icon(isMeeting
                ? Icons.mic
                : isMemo
                    ? Icons.edit_note
                    : Icons.chat,
                size: 16),
            label: Text(isMeeting
                ? '회의 시작하기'
                : isMemo
                    ? '메모 시작하기'
                    : '대화 시작하기'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF2563EB),
              side: const BorderSide(color: Color(0xFF2563EB)),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 변경 히스토리 모델 (Action Item 편집 이력)
// ============================================================

class ItemChangeHistory {
  final String itemId;
  final DateTime changedAt;
  final String field;       // 'content' | 'dueDate' | 'dueTime' | 'ownerLabel'
  final String? oldValue;
  final String? newValue;
  final String changedBy;   // 'user' | 'llm'

  const ItemChangeHistory({
    required this.itemId,
    required this.changedAt,
    required this.field,
    this.oldValue,
    this.newValue,
    this.changedBy = 'user',
  });

  String get fieldLabel => switch (field) {
        'content'    => '내용',
        'dueDate'    => '기한',
        'dueTime'    => '시간',
        'ownerLabel' => '담당자',
        _            => field,
      };
}

final itemChangeHistoryProvider =
    StateProvider<List<ItemChangeHistory>>((ref) => []);
