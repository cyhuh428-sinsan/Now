import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../repositories/repository_providers.dart';
import 'meetings_page.dart';

// ============================================================
// 메모 시작 페이지 - 혼자 말하거나 텍스트로 기록
// ============================================================

class MemoStartPage extends ConsumerStatefulWidget {
  final DateTime? initialDate;

  const MemoStartPage({super.key, this.initialDate});

  @override
  ConsumerState<MemoStartPage> createState() => _MemoStartPageState();
}

class _MemoStartPageState extends ConsumerState<MemoStartPage> {
  final _textController = TextEditingController();
  String _voiceInputMode = 'realtime';

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  Future<void> _saveTextMemo() async {
    final content = _textController.text.trim();
    if (content.isEmpty) return;

    final now = DateTime.now();
    final memoDate = _memoDateTime(now);
    final existing = await ref
        .read(localMeetingRepositoryProvider)
        .getDailyMemoByDate(memoDate);
    final meetingId = existing?.meetingId ?? now.microsecondsSinceEpoch.toString();
    final stamp =
        '${memoDate.month.toString().padLeft(2, '0')}${memoDate.day.toString().padLeft(2, '0')}_${now.hour.toString().padLeft(2, '0')}${now.minute.toString().padLeft(2, '0')}';
    final firstLine = content.split('\n').first.trim();
    final title = existing?.title ??
        (firstLine.length > 18
            ? '${firstLine.substring(0, 18)}...'
            : firstLine.isNotEmpty
                ? firstLine
                : '메모_$stamp');
    final existingCount = existing == null
        ? 0
        : await ref
            .read(localMeetingRepositoryProvider)
            .getSegmentCount(existing.meetingId);
    final segments = [
      {
        'id': '${meetingId}_${now.microsecondsSinceEpoch}',
        'text': content,
        'speakerLabel': 'user',
        'timestamp': now,
        'source': 'typed',
      }
    ];

    final repo = ref.read(localMeetingRepositoryProvider);
    await repo.saveMeeting(
      meetingId: meetingId,
      title: title,
      recordType: 'memo',
      participantName: '',
      segmentCount: existingCount + 1,
      actionCount: 0,
      decisionCount: 0,
      startedAt: existing?.startedAt ?? existing?.createdAt ?? memoDate,
      endedAt: now,
    );
    await repo.saveSegments(meetingId, segments);

    ref.read(meetingSummariesProvider.notifier).upsertMeeting(MeetingSummary(
          id: meetingId,
          title: title,
          date: existing?.startedAt ?? existing?.createdAt ?? now,
          segmentCount: existingCount + 1,
          actionCount: 0,
          decisionCount: 0,
          recordType: 'memo',
        ));

    if (mounted) context.go('/meetings');
  }

  @override
  Widget build(BuildContext context) {
    final titleDate = widget.initialDate ?? DateTime.now();
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
          '메모',
          style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF111827)),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${titleDate.month}월 ${titleDate.day}일 메모',
              style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827)),
            ),
            const SizedBox(height: 8),
            const Text(
              '날짜 중심 메모를 타이핑하거나 음성으로 남기세요.',
              style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                children: [
                  TextField(
                    controller: _textController,
                    minLines: 5,
                    maxLines: 8,
                    style: const TextStyle(
                        fontSize: 15, height: 1.5, color: Color(0xFF111827)),
                    decoration: const InputDecoration(
                      hintText: '오늘 기억할 것, 생각, 아이디어를 적어두세요.',
                      border: InputBorder.none,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _saveTextMemo,
                      icon: const Icon(Icons.save_outlined,
                          size: 18, color: Colors.white),
                      label: const Text('간단 메모 저장',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: const Column(
                children: [
                  Icon(Icons.mic_none,
                      size: 48, color: Color(0xFF2563EB)),
                  SizedBox(height: 12),
                  Text('음성으로 입력',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827))),
                  SizedBox(height: 6),
                  Text('입력 방식과 LLM 분석 여부는 저장 전에 선택합니다',
                      style:
                          TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _MemoModeButton(
                    icon: Icons.graphic_eq,
                    label: '실시간 변환',
                    selected: _voiceInputMode == 'realtime',
                    onTap: () => setState(() {
                      _voiceInputMode = 'realtime';
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _MemoModeButton(
                    icon: Icons.fiber_manual_record,
                    label: '녹음 후 변환',
                    selected: _voiceInputMode == 'record_then_transcribe',
                    onTap: () => setState(() {
                      _voiceInputMode = 'record_then_transcribe';
                    }),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: () {
                  context.push('/meeting/progress', extra: {
                    'event': null,
                    'recordType': 'memo',
                    'participantName': '',
                    'voiceInputMode': _voiceInputMode,
                    'memoDate': _memoDateTime(DateTime.now()),
                  });
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text(
                  '음성으로 간단 메모 시작',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white),
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],
          ),
        ),
      ),
    );
  }

  DateTime _memoDateTime(DateTime now) {
    final selected = widget.initialDate;
    if (selected == null) return now;
    return DateTime(
      selected.year,
      selected.month,
      selected.day,
      now.hour,
      now.minute,
      now.second,
      now.millisecond,
      now.microsecond,
    );
  }
}

class _MemoModeButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _MemoModeButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 44,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEFF6FF) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color:
                selected ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 17,
                color: selected
                    ? const Color(0xFF2563EB)
                    : const Color(0xFF6B7280)),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: selected
                      ? const Color(0xFF2563EB)
                      : const Color(0xFF374151),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
