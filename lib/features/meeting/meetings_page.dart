import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../repositories/local/local_meeting_repository.dart';
import '../../repositories/repository_providers.dart';
import '../../core/database/app_database.dart';

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
    final convList = meetings.where((m) => m.recordType == 'conversation').toList();

    final memosAsync = ref.watch(memosProvider);

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
            // ── 대화2 탭 (면담 → 대화로 통합 예정) ──
            interviewList.isEmpty
                ? const _EmptyMeetings(type: 'conversation')
                : _RecordList(
                    meetings: interviewList,
                    onTap: (m) => context.push('/meetings/${m.id}', extra: m),
                    onImportantToggle: (m) => _toggleImportant(ref, m),
                    onDelete: (m) => _confirmDelete(context, ref, m),
                  ),
            // ── 메모 탭 ──
            memosAsync.when(
              data: (memos) => memos.isEmpty
                  ? const _EmptyMemos()
                  : _MemoList(memos: memos),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('오류: \$e')),
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
                  ctx.push('/memo/start');
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

// 메모 목록 Provider
final memosProvider = FutureProvider.autoDispose<List<Memo>>((ref) async {
  final db = ref.watch(appDatabaseProvider);
  return (db.select(db.memos)
        ..where((m) => m.userId.equals('local_user'))
        ..orderBy([(m) => OrderingTerm.desc(m.createdAt)]))
      .get();
});

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
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: meeting.isImportant
              ? const Color(0xFFF59E0B).withOpacity(0.5)
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
                  color: const Color(0xFF2563EB).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.groups_outlined,
                    size: 20, color: Color(0xFF2563EB)),
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
                          '발언 ${meeting.segmentCount}개',
                          style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF)),
                        ),
                      ],
                    ),
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
        color: color.withOpacity(0.1),
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
// 메모 목록
// ============================================================

class _MemoList extends StatelessWidget {
  final List<Memo> memos;
  const _MemoList({required this.memos});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
      itemCount: memos.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) => _MemoCard(memo: memos[index]),
    );
  }
}

class _MemoCard extends StatelessWidget {
  final Memo memo;
  const _MemoCard({required this.memo});

  @override
  Widget build(BuildContext context) {
    final tags = memo.tags?.split(',').where((t) => t.trim().isNotEmpty).toList() ?? [];
    final dateStr = DateFormat('M월 d일 HH:mm').format(memo.createdAt);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            memo.content,
            style: const TextStyle(fontSize: 14, color: Color(0xFF111827), height: 1.5),
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
          ),
          if (tags.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: tags.map((tag) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(tag.trim(),
                    style: const TextStyle(fontSize: 11, color: Color(0xFF2563EB))),
              )).toList(),
            ),
          ],
          const SizedBox(height: 8),
          Text(dateStr,
              style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
        ],
      ),
    );
  }
}

class _EmptyMemos extends StatelessWidget {
  const _EmptyMemos();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.note_outlined, size: 56, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('저장된 메모가 없어요',
              style: TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 8),
          const Text('Capture 버튼으로 메모를 기록해보세요',
              style: TextStyle(fontSize: 13, color: Color(0xFFD1D5DB))),
        ],
      ),
    );
  }
}

class _EmptyMeetings extends StatelessWidget {
  final String type;
  const _EmptyMeetings({this.type = 'meeting'});

  @override
  Widget build(BuildContext context) {
    // type: 'meeting' | 'interview' | 'conversation'
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(type == 'meeting' ? Icons.article_outlined : Icons.chat_bubble_outline,
              size: 56, color: const Color(0xFFD1D5DB)),
          const SizedBox(height: 16),
          Text(type == 'meeting' ? '아직 회의 기록이 없습니다' : '아직 대화 기록이 없습니다',
              style: const TextStyle(fontSize: 15, color: Color(0xFF9CA3AF))),
          const SizedBox(height: 8),
          Text(type == 'meeting' ? '회의를 시작해보세요' : '대화를 시작해보세요',
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
            icon: Icon(type == 'meeting' ? Icons.mic : Icons.chat, size: 16),
            label: Text(type == 'meeting' ? '회의 시작하기' : '대화 시작하기'),
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

