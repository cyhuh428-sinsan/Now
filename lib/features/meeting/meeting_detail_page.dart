import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart'; 
import '../items/items_review_page.dart';
import 'meetings_page.dart';
import '../../repositories/local/local_meeting_repository.dart';
import '../../repositories/repository_providers.dart';

// ============================================================
// 회의 상세 페이지 — 2단 구조
// 상단: 요약 (Action/Decision)
// 하단: 발언 전문
// ============================================================

class MeetingDetailPage extends ConsumerStatefulWidget {
  final MeetingSummary meeting;

  const MeetingDetailPage({super.key, required this.meeting});

  @override
  ConsumerState<MeetingDetailPage> createState() =>
      _MeetingDetailPageState();
}

class _MeetingDetailPageState extends ConsumerState<MeetingDetailPage> {
  late TextEditingController _titleController;
  bool _isEditingTitle = false;

  List<_SegmentData> _segments = [];
  List<ExtractedItemData> _items = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.meeting.title);
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadFromDb());
  }

  Future<void> _loadFromDb() async {
    final repo = ref.read(localMeetingRepositoryProvider);

    // 세그먼트 조회
    final dbSegments = await repo.getSegments(widget.meeting.id);
    final segments = dbSegments.map((s) => _SegmentData(
          id: s.segmentId,
          text: s.content,
          timestamp: s.timestamp ?? widget.meeting.date,
          speakerLabel: s.speaker,
        )).toList();

    // 추출 아이템 조회
    final dbItems = await repo.getExtractedItems(widget.meeting.id);
    final items = dbItems.map((i) => ExtractedItemData(
          id: i.itemId,
          itemType: i.itemType == 'action' ? ItemType.action : ItemType.decision,
          content: i.content,
          confidence: i.confidence ?? 0.0,
          ownerLabel: i.ownerLabel,
          dueDate: i.dueDate,
          dueTime: i.dueTime,
        )).toList();

    if (mounted) {
      setState(() {
        _segments = segments;
        _items = items;
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  void _saveTitle() {
    setState(() => _isEditingTitle = false);
    ref.read(localMeetingRepositoryProvider)
        .updateTitle(widget.meeting.id, _titleController.text);
    ref.read(meetingSummariesProvider.notifier)
        .updateTitle(widget.meeting.id, _titleController.text);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8F9FA),
        body: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
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
        title: _isEditingTitle
            ? TextField(
                controller: _titleController,
                autofocus: true,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF111827)),
                decoration: const InputDecoration(
                  border: InputBorder.none,
                  isDense: true,
                ),
                onSubmitted: (_) => _saveTitle(),
              )
            : GestureDetector(
                onTap: () => setState(() => _isEditingTitle = true),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        _titleController.text,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF111827),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    const Icon(Icons.edit_outlined,
                        size: 14, color: Color(0xFF9CA3AF)),
                  ],
                ),
              ),
        actions: [
          if (_isEditingTitle)
            TextButton(
              onPressed: _saveTitle,
              child: const Text('저장',
                  style: TextStyle(color: Color(0xFF2563EB))),
            )
          else 
            // ▼▼▼ [3. 추가] 편집 모드가 아닐 때 공유 버튼 표시
            IconButton(
              icon: const Icon(Icons.ios_share, size: 22, color: Color(0xFF111827)), // 공유 아이콘
              onPressed: _shareMeetingSummary, // 위에서 만든 함수 연결
              tooltip: '요약 공유하기',
            ),    
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
        children: [
          // 회의 메타 정보
          _MetaInfo(meeting: widget.meeting),
          const SizedBox(height: 20),

          // ── 상단: 요약 (Action/Decision) ──
          const _SectionHeader(
            icon: Icons.summarize_outlined,
            label: '요약',
          ),
          const SizedBox(height: 10),
          _items.isEmpty
              ? const _EmptyCard(message: '추출된 Action/Decision이 없습니다')
              : Column(
                  children: _items
                      .map((item) => _EditableItemCard(
                            item: item,
                            onChanged: (updated) {
                              setState(() {
                                final idx = _items
                                    .indexWhere((i) => i.id == updated.id);
                                if (idx >= 0) _items[idx] = updated;
                              });
                              ref.read(localMeetingRepositoryProvider)
                                  .updateExtractedItem(
                                    updated.id,
                                    updated.content,
                                    ownerLabel: updated.ownerLabel,
                                    dueDate: updated.dueDate,
                                    dueTime: updated.dueTime,
                                  );
                            },
                            onDeleted: (id) {
                              setState(() =>
                                  _items.removeWhere((i) => i.id == id));
                              ref.read(localMeetingRepositoryProvider)
                                  .deleteExtractedItem(id);
                            },
                          ))
                      .toList(),
                ),

          const SizedBox(height: 24),

          // ── 하단: 발언 전문 ──
          _SectionHeader(
            icon: Icons.chat_bubble_outline,
            label: '발언 전문 (${_segments.length})',
          ),
          const SizedBox(height: 10),
          ..._segments.map((seg) => _SegmentBubble(segment: seg)),
        ],
      ),
    );
  }

  // ▼▼▼ [2. 추가] 회의록 내용을 텍스트로 만들어 공유하는 함수
  void _shareMeetingSummary() {
    final dateStr = DateFormat('yyyy년 M월 d일 HH:mm').format(widget.meeting.date);
    final sb = StringBuffer();

    // 1. 제목 및 일시
    sb.writeln('[다온 AI 회의록 요약]');
    sb.writeln('제목: ${_titleController.text}');
    sb.writeln('일시: $dateStr');
    sb.writeln('');

    // 2. 요약 내용 (Action / Decision)
    if (_items.isEmpty) {
      sb.writeln('추출된 요약 내용이 없습니다.');
    } else {
      for (final item in _items) {
        final typeLabel = item.itemType == ItemType.action ? '[Action]' : '[Decision]';
        sb.writeln('$typeLabel ${item.content}');
        
        // 담당자나 기한이 있으면 같이 표기
        if (item.ownerLabel != null || item.dueDate != null) {
          final info = <String>[];
          if (item.ownerLabel != null) info.add('담당: ${item.ownerLabel}');
          if (item.dueDate != null) info.add('기한: ${item.dueDate}');
          sb.writeln('  └ ${info.join(' / ')}');
        }
        sb.writeln(''); // 줄바꿈
      }
    }

    // 3. 발언 전문 요약 (너무 길면 생략 가능)
    sb.writeln('--------------------');
    sb.writeln('총 발언 수: ${_segments.length}개');
    
    // 4. 공유 실행
    Share.share(sb.toString(), subject: widget.meeting.title);
  }
}

// ============================================================
// 회의 메타 정보
// ============================================================

class _MetaInfo extends StatelessWidget {
  final MeetingSummary meeting;

  const _MetaInfo({required this.meeting});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          _MetaChip(
            icon: Icons.calendar_today_outlined,
            label: DateFormat('M월 d일 HH:mm').format(meeting.date),
          ),
          const SizedBox(width: 16),
          _MetaChip(
            icon: Icons.chat_bubble_outline,
            label: '발언 ${meeting.segmentCount}개',
          ),
          const SizedBox(width: 16),
          _MetaChip(
            icon: Icons.task_alt,
            label: 'Action ${meeting.actionCount}',
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _MetaChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 13, color: const Color(0xFF9CA3AF)),
        const SizedBox(width: 4),
        Text(label,
            style: const TextStyle(
                fontSize: 12, color: Color(0xFF6B7280))),
      ],
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
// 빈 카드
// ============================================================

class _EmptyCard extends StatelessWidget {
  final String message;

  const _EmptyCard({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Center(
        child: Text(message,
            style: const TextStyle(
                fontSize: 13, color: Color(0xFF9CA3AF))),
      ),
    );
  }
}

// ============================================================
// 세그먼트 데이터 모델
// ============================================================

class _SegmentData {
  final String id;
  final String text;
  final DateTime timestamp;
  final String speakerLabel;

  const _SegmentData({
    required this.id,
    required this.text,
    required this.timestamp,
    required this.speakerLabel,
  });
}

// ============================================================
// 발언 말풍선
// ============================================================

class _SegmentBubble extends StatelessWidget {
  final _SegmentData segment;

  const _SegmentBubble({required this.segment});

  @override
  Widget build(BuildContext context) {
    final isUser = segment.speakerLabel == 'user';
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: isUser
                  ? const Color(0xFF2563EB)
                  : const Color(0xFF6B7280),
              shape: BoxShape.circle,
            ),
            child: Icon(isUser ? Icons.person : Icons.people,
                size: 14, color: Colors.white),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      isUser ? '나' : '상대방',
                      style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF374151)),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      DateFormat('HH:mm').format(segment.timestamp),
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF9CA3AF)),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Text(
                    segment.text,
                    style: const TextStyle(
                        fontSize: 14,
                        color: Color(0xFF111827),
                        height: 1.4),
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

// ============================================================
// 편집 가능한 아이템 카드
// ============================================================

class _EditableItemCard extends ConsumerStatefulWidget {
  final ExtractedItemData item;
  final void Function(ExtractedItemData) onChanged;
  final void Function(String) onDeleted;

  const _EditableItemCard({
    required this.item,
    required this.onChanged,
    required this.onDeleted,
  });

  @override
  ConsumerState<_EditableItemCard> createState() => _EditableItemCardState();
}

class _EditableItemCardState extends ConsumerState<_EditableItemCard> {
  bool _isEditing = false;
  late TextEditingController _contentCtrl;
  late TextEditingController _ownerCtrl;
  late TextEditingController _dueDateCtrl;
  late TextEditingController _dueTimeCtrl;

  @override
  void initState() {
    super.initState();
    _contentCtrl = TextEditingController(text: widget.item.content);
    _ownerCtrl =
        TextEditingController(text: widget.item.ownerLabel ?? '');
    _dueDateCtrl =
        TextEditingController(text: widget.item.dueDate ?? '');
    _dueTimeCtrl =
        TextEditingController(text: widget.item.dueTime ?? '');
  }

  @override
  void dispose() {
    _contentCtrl.dispose();
    _ownerCtrl.dispose();
    _dueDateCtrl.dispose();
    _dueTimeCtrl.dispose();
    super.dispose();
  }

  void _save(WidgetRef ref) {
    final now = DateTime.now();
    final histories = <ItemChangeHistory>[];

    // 변경된 필드만 히스토리 기록
    void record(String field, String? oldVal, String? newVal) {
      if (oldVal != newVal) {
        histories.add(ItemChangeHistory(
          itemId: widget.item.id,
          changedAt: now,
          field: field,
          oldValue: oldVal,
          newValue: newVal,
        ));
      }
    }

    final newContent = _contentCtrl.text.trim();
    final newOwner = _ownerCtrl.text.trim().isEmpty ? null : _ownerCtrl.text.trim();
    final newDate  = _dueDateCtrl.text.trim().isEmpty ? null : _dueDateCtrl.text.trim();
    final newTime  = _dueTimeCtrl.text.trim().isEmpty ? null : _dueTimeCtrl.text.trim();

    record('content',    widget.item.content,    newContent);
    record('ownerLabel', widget.item.ownerLabel, newOwner);
    record('dueDate',    widget.item.dueDate,    newDate);
    record('dueTime',    widget.item.dueTime,    newTime);

    if (histories.isNotEmpty) {
      ref.read(itemChangeHistoryProvider.notifier).update(
            (state) => [...state, ...histories],
          );
    }

    widget.onChanged(ExtractedItemData(
      id: widget.item.id,
      itemType: widget.item.itemType,
      content: newContent,
      confidence: widget.item.confidence,
      ownerLabel: newOwner,
      dueDate: newDate,
      dueTime: newTime,
      status: widget.item.status,
    ));
    setState(() => _isEditing = false);
  }

  @override
  Widget build(BuildContext context) {
    final isAction = widget.item.itemType == ItemType.action;
    final accentColor =
        isAction ? const Color(0xFF2563EB) : const Color(0xFF10B981);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: accentColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    isAction ? 'Action' : 'Decision',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: accentColor),
                  ),
                ),
                const Spacer(),
                if (!_isEditing) ...[
                  GestureDetector(
                    onTap: () => setState(() => _isEditing = true),
                    child: const Icon(Icons.edit_outlined,
                        size: 16, color: Color(0xFF9CA3AF)),
                  ),
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: () => widget.onDeleted(widget.item.id),
                    child: const Icon(Icons.delete_outline,
                        size: 16, color: Color(0xFF9CA3AF)),
                  ),
                ] else ...[
                  TextButton(
                    onPressed: () =>
                        setState(() => _isEditing = false),
                    child: const Text('취소',
                        style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF9CA3AF))),
                  ),
                  TextButton(
                    onPressed: () => _save(ref),
                    child: const Text('저장',
                        style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF2563EB),
                            fontWeight: FontWeight.w600)),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 8),
            _isEditing
                ? TextField(
                    controller: _contentCtrl,
                    maxLines: null,
                    decoration: _inputDeco('내용'),
                  )
                : Text(
                    widget.item.content,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF111827),
                        height: 1.4),
                  ),
            if (isAction) ...[
              const SizedBox(height: 8),
              _isEditing
                  ? Row(children: [
                      Expanded(
                          child: TextField(
                              controller: _ownerCtrl,
                              decoration: _inputDeco('담당자'))),
                      const SizedBox(width: 8),
                      Expanded(
                          child: _DatePickerField(
                              controller: _dueDateCtrl,
                              label: '기한')),
                      const SizedBox(width: 8),
                      Expanded(
                          child: TextField(
                              controller: _dueTimeCtrl,
                              decoration: _inputDeco('시간'))),
                    ])
                  : Row(children: [
                      if (widget.item.ownerLabel != null) ...[
                        const Icon(Icons.person_outline,
                            size: 12, color: Color(0xFF9CA3AF)),
                        const SizedBox(width: 3),
                        Text(widget.item.ownerLabel!,
                            style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF9CA3AF))),
                        const SizedBox(width: 10),
                      ],
                      if (widget.item.dueDate != null) ...[
                        const Icon(Icons.calendar_today_outlined,
                            size: 12, color: Color(0xFF9CA3AF)),
                        const SizedBox(width: 3),
                        Text(
                          widget.item.dueTime != null
                              ? '${widget.item.dueDate} ${widget.item.dueTime}'
                              : widget.item.dueDate!,
                          style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF)),
                        ),
                      ],
                    ]),
            ],
            // 변경 히스토리
            if (!_isEditing)
              ItemHistoryView(itemId: widget.item.id),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDeco(String label) => InputDecoration(
        labelText: label,
        isDense: true,
        filled: true,
        fillColor: const Color(0xFFF9FAFB),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFF2563EB)),
        ),
      );
}

// ============================================================
// 히스토리 뷰 위젯
// ============================================================

class ItemHistoryView extends ConsumerWidget {
  final String itemId;

  const ItemHistoryView({super.key, required this.itemId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allHistory = ref.watch(itemChangeHistoryProvider);
    final history = allHistory
        .where((h) => h.itemId == itemId)
        .toList()
      ..sort((a, b) => b.changedAt.compareTo(a.changedAt));

    if (history.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 12),
        const Row(
          children: [
            Icon(Icons.history, size: 13, color: Color(0xFF9CA3AF)),
            SizedBox(width: 4),
            Text(
              '변경 이력',
              style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ...history.map((h) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  const SizedBox(width: 4),
                  Text(
                    DateFormat('M/d HH:mm').format(h.changedAt),
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF9CA3AF)),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${h.fieldLabel}: ',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF6B7280)),
                  ),
                  if (h.oldValue != null)
                    Text(
                      '"${h.oldValue}" → ',
                      style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF9CA3AF),
                          decoration: TextDecoration.lineThrough),
                    ),
                  Expanded(
                    child: Text(
                      h.newValue ?? '(삭제)',
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF2563EB)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }
}

// ============================================================
// DatePicker 필드 위젯
// ============================================================

class _DatePickerField extends StatelessWidget {
  final TextEditingController controller;
  final String label;

  const _DatePickerField({
    required this.controller,
    required this.label,
  });

  String _displayDate(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    try {
      final dt = DateTime.parse(raw);
      return '${dt.month}/${dt.day}';
    } catch (_) {
      return raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        // 현재 값 파싱 (초기값)
        DateTime initial = DateTime.now();
        if (controller.text.isNotEmpty) {
          try {
            initial = DateTime.parse(controller.text);
          } catch (_) {}
        }

        final picked = await showDatePicker(
          context: context,
          initialDate: initial,
          firstDate: DateTime.now().subtract(const Duration(days: 30)),
          lastDate: DateTime.now().add(const Duration(days: 365)),
          builder: (context, child) => Theme(
            data: Theme.of(context).copyWith(
              colorScheme: const ColorScheme.light(
                primary: Color(0xFF2563EB),
              ),
            ),
            child: child!,
          ),
        );

        if (picked != null) {
          controller.text =
              '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                controller.text.isEmpty
                    ? label
                    : _displayDate(controller.text),
                style: TextStyle(
                  fontSize: 13,
                  color: controller.text.isEmpty
                      ? const Color(0xFF9CA3AF)
                      : const Color(0xFF111827),
                ),
              ),
            ),
            const Icon(Icons.calendar_today_outlined,
                size: 14, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}
