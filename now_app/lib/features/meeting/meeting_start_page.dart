import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../home/home_page.dart';

// ============================================================
// 선택된 이벤트 상태 Provider
// ============================================================

final selectedEventProvider =
    StateProvider<CalendarEventItem?>((ref) => null);

// 기록 유형: 'meeting' | 'interview' | 'conversation'
final recordTypeProvider = StateProvider<String>((ref) => 'meeting');
final participantNameProvider = StateProvider<String>((ref) => '');
final voiceInputModeProvider = StateProvider<String>((ref) => 'realtime');

// ============================================================
// 회의 시작 화면
// ============================================================

class MeetingStartPage extends ConsumerStatefulWidget {
  final String? initialType;
  const MeetingStartPage({super.key, this.initialType});

  @override
  ConsumerState<MeetingStartPage> createState() => _MeetingStartPageState();
}

class _MeetingStartPageState extends ConsumerState<MeetingStartPage> {
  final _nameCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    // initialType이 있으면 즉시 설정 (탭에서 진입 시)
    if (widget.initialType != null) {
      // postFrameCallback 없이 즉시 설정
      Future.microtask(() {
        if (mounted) {
          ref.read(recordTypeProvider.notifier).state = widget.initialType!;
        }
      });
    }
  }

  @override
  void didUpdateWidget(covariant MeetingStartPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // initialType이 변경되면 즉시 반영
    if (widget.initialType != null &&
        widget.initialType != oldWidget.initialType) {
      ref.read(recordTypeProvider.notifier).state = widget.initialType!;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final eventsAsync = ref.watch(todayEventsDbProvider);
    final selectedEvent = ref.watch(selectedEventProvider);
    final recordType = ref.watch(recordTypeProvider);
    final voiceInputMode = ref.watch(voiceInputModeProvider);
    // initialType이 있으면 유형 칩 선택 숨김
    final fixedType = widget.initialType != null;

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
        title: Text(
          widget.initialType == 'conversation'
              ? '대화 기록'
              : widget.initialType == 'conversation'
                  ? '대화 기록'
                  : widget.initialType == 'meeting'
                      ? '회의 기록'
                      : '기록 시작',
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 유형 선택 (직접 진입 시만 표시)
            if (!fixedType) ...[
              const Text(
                '기록 유형',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                children: [
                  _TypeChip(
                    label: '🗓 회의',
                    selected: recordType == 'meeting',
                    onTap: () =>
                        ref.read(recordTypeProvider.notifier).state = 'meeting',
                  ),
                  _TypeChip(
                    label: '💬 대화',
                    selected: recordType == 'interview',
                    onTap: () =>
                        ref.read(recordTypeProvider.notifier).state = 'conversation',
                  ),
                  _TypeChip(
                    label: '💬 대화',
                    selected: recordType == 'conversation',
                    onTap: () =>
                        ref.read(recordTypeProvider.notifier).state = 'conversation',
                  ),
                ],
              ),
              const SizedBox(height: 8),
            ],
            if (recordType == 'interview' || recordType == 'conversation') ...[
              const SizedBox(height: 14),
              const Text(
                '대화 상대',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _nameCtrl,
                onChanged: (v) =>
                    ref.read(participantNameProvider.notifier).state = v,
                decoration: InputDecoration(
                  hintText: '예: 김팀장, 홍길동 클라이언트',
                  hintStyle: const TextStyle(
                      color: Color(0xFF9CA3AF), fontSize: 14),
                  filled: true,
                  fillColor: const Color(0xFFF9FAFB),
                  contentPadding: const EdgeInsets.all(12),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: Color(0xFFE5E7EB))),
                  enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: Color(0xFFE5E7EB))),
                  focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide:
                          const BorderSide(color: Color(0xFF2563EB))),
                ),
              ),
            ],
            const SizedBox(height: 20),
Text(
              recordType == 'meeting'
                  ? '어떤 회의를 시작할까요?'
                  : recordType == 'interview'
                      ? '대화 상대를 입력하고 바로 시작하세요'
                      : '바로 기록을 시작하세요',
              style: const TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 12),
            const Text(
              '음성 입력 방식',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF6B7280)),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _ModeButton(
                    icon: Icons.graphic_eq,
                    label: '실시간 변환',
                    selected: voiceInputMode == 'realtime',
                    onTap: () => ref
                        .read(voiceInputModeProvider.notifier)
                        .state = 'realtime',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _ModeButton(
                    icon: Icons.fiber_manual_record,
                    label: '녹음 후 변환',
                    selected: voiceInputMode == 'record_then_transcribe',
                    onTap: () => ref
                        .read(voiceInputModeProvider.notifier)
                        .state = 'record_then_transcribe',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),

            // 회의일 때만 일정 목록 표시
            if (recordType == 'meeting') Expanded(
              child: eventsAsync.when(
                data: (events) {
                  final availableEvents =
                      events.where((e) => !e.hasMeeting).toList();
                  return availableEvents.isEmpty
                      ? const _NoEventSection()
                      : ListView.builder(
                          itemCount: availableEvents.length,
                          itemBuilder: (context, index) {
                            final event = availableEvents[index];
                            final isSelected = selectedEvent?.id == event.id;
                            return _EventSelectCard(
                              event: event,
                              isSelected: isSelected,
                              onTap: () {
                                ref
                                    .read(selectedEventProvider.notifier)
                                    .state = isSelected ? null : event;
                              },
                            );
                          },
                        );
                },
                loading: () => const Center(
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                error: (e, _) => const _NoEventSection(),
              ),
            ),

            // 면담/대화일 때 안내 문구
            if (recordType != 'meeting')
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        recordType == 'interview'
                            ? Icons.handshake_outlined
                            : Icons.chat_bubble_outline,
                        size: 48,
                        color: const Color(0xFFD1D5DB),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        recordType == 'interview'
                            ? '면담은 일정 없이 바로 시작합니다'
                            : '대화는 일정 없이 바로 시작합니다',
                        style: const TextStyle(
                            fontSize: 14, color: Color(0xFF9CA3AF)),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '위에서 대화 상대 이름을 입력해주세요',
                        style: TextStyle(
                            fontSize: 13, color: Color(0xFFD1D5DB)),
                      ),
                    ],
                  ),
                ),
              ),

            // 기록 시작 버튼
            const SizedBox(height: 12),
            Row(
              children: [
                // 회의: 일정 연결 시작 버튼
                if (recordType == 'meeting') ...[
                  Expanded(
                    child: SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: selectedEvent == null
                            ? null
                            : () {
                                final type = ref.read(recordTypeProvider);
                                final name = ref.read(participantNameProvider);
                                final voiceInputMode =
                                    ref.read(voiceInputModeProvider);
                                ref.read(selectedEventProvider.notifier).state = null;
                                context.push('/meeting/progress', extra: {
                                  'event': selectedEvent,
                                  'recordType': type,
                                  'participantName': name,
                                  'voiceInputMode': voiceInputMode,
                                });
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          disabledBackgroundColor: const Color(0xFFE5E7EB),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          selectedEvent == null ? '일정 선택 후 시작' : '일정 연결 시작',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: selectedEvent == null
                                ? const Color(0xFF9CA3AF)
                                : Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
                // 면담/대화: 사이 간격 없음 (버튼이 1개)
                if (recordType == 'meeting') const SizedBox(width: 10),
                // 바로 시작 버튼 (면담/대화는 전체 너비)
                if (recordType == 'meeting')
                  SizedBox(
                    height: 52,
                    child: OutlinedButton(
                      onPressed: () {
                        final type = ref.read(recordTypeProvider);
                        final name = ref.read(participantNameProvider);
                        final voiceInputMode =
                            ref.read(voiceInputModeProvider);
                        ref.read(selectedEventProvider.notifier).state = null;
                        context.push('/meeting/progress', extra: {
                          'event': null,
                          'recordType': type,
                          'participantName': name,
                          'voiceInputMode': voiceInputMode,
                        });
                      },
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFF2563EB)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        '바로 시작',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF2563EB),
                        ),
                      ),
                    ),
                  ),
                // 면담/대화: 전체 너비 바로 시작 버튼
                if (recordType != 'meeting')
                  Expanded(
                    child: SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: () {
                          final type = ref.read(recordTypeProvider);
                          final name = ref.read(participantNameProvider);
                          final voiceInputMode =
                              ref.read(voiceInputModeProvider);
                          ref.read(selectedEventProvider.notifier).state = null;
                          context.push('/meeting/progress', extra: {
                            'event': null,
                            'recordType': type,
                            'participantName': name,
                            'voiceInputMode': voiceInputMode,
                          });
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          recordType == 'interview' ? '면담 시작' : '대화 시작',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
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
// 이벤트 선택 카드
// ============================================================

class _EventSelectCard extends StatelessWidget {
  final CalendarEventItem event;
  final bool isSelected;
  final VoidCallback onTap;

  const _EventSelectCard({
    required this.event,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF2563EB)
                : const Color(0xFFE5E7EB),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  )
                ]
              : null,
        ),
        child: Row(
          children: [
            // 선택 표시
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected
                    ? const Color(0xFF2563EB)
                    : Colors.transparent,
                border: Border.all(
                  color: isSelected
                      ? const Color(0xFF2563EB)
                      : const Color(0xFFD1D5DB),
                  width: 2,
                ),
              ),
              child: isSelected
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 14),
            // 이벤트 정보
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: isSelected
                          ? const Color(0xFF2563EB)
                          : const Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.access_time,
                          size: 13, color: Color(0xFF9CA3AF)),
                      const SizedBox(width: 4),
                      Text(
                        '${event.startTime} - ${event.endTime}',
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF9CA3AF)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            // 진행 중 표시
            if (_isNow(event.startTime, event.endTime))
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  '진행 중',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF10B981),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  bool _isNow(String start, String end) {
    final now = DateTime.now();
    final startParts = start.split(':');
    final endParts = end.split(':');
    final startTime = DateTime(now.year, now.month, now.day,
        int.parse(startParts[0]), int.parse(startParts[1]));
    final endTime = DateTime(now.year, now.month, now.day,
        int.parse(endParts[0]), int.parse(endParts[1]));
    return now.isAfter(startTime) && now.isBefore(endTime);
  }
}

// ============================================================
// 일정 없음 섹션
// ============================================================

class _NoEventSection extends ConsumerWidget {
  const _NoEventSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.calendar_today_outlined,
              size: 48, color: Color(0xFFD1D5DB)),
          const SizedBox(height: 16),
          const Text(
            '오늘 시작할 수 있는 회의 일정이 없습니다',
            style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () {
              final type = ref.read(recordTypeProvider);
              final name = ref.read(participantNameProvider);
              final voiceInputMode = ref.read(voiceInputModeProvider);
              context.push('/meeting/progress', extra: {
                'event': null,
                'recordType': type,
                'participantName': name,
                'voiceInputMode': voiceInputMode,
              });
            },
            icon: const Icon(Icons.add, size: 16),
            label: const Text('일정 없이 회의 시작'),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF2563EB),
              side: const BorderSide(color: Color(0xFF2563EB)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 유형 선택 칩
// ============================================================

class _TypeChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _TypeChip(
      {required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? const Color(0xFF2563EB).withValues(alpha: 0.1)
              : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected
                ? const Color(0xFF2563EB)
                : Colors.transparent,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: selected
                ? const Color(0xFF2563EB)
                : const Color(0xFF6B7280),
          ),
        ),
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _ModeButton({
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
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 12),
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
                size: 18,
                color: selected
                    ? const Color(0xFF2563EB)
                    : const Color(0xFF6B7280)),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 13,
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
