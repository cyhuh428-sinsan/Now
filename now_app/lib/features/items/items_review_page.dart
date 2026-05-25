import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../meeting/meetings_page.dart';
import '../meeting/meeting_progress_page.dart';
import '../../repositories/repository_providers.dart';
import '../../llm/providers/llm_providers.dart';
import '../../services/server_sync_service.dart';

// ============================================================
// 모델
// ============================================================

enum ItemType { action, decision }

enum ItemStatus { draft, confirmed, archived }

class ExtractedItemData {
  final String id;
  final ItemType itemType;
  final String content;
  final double confidence;
  final String? ownerLabel;
  final String? dueDate;
  final String? dueTime;
  ItemStatus status;

  ExtractedItemData({
    required this.id,
    required this.itemType,
    required this.content,
    required this.confidence,
    this.ownerLabel,
    this.dueDate,
    this.dueTime,
    this.status = ItemStatus.draft,
  });
}

// ============================================================
// Provider
// ============================================================

final extractedItemsProvider =
    StateProvider<List<ExtractedItemData>>((ref) => [
          // 더미 데이터 (백엔드 연동 전)
          ExtractedItemData(
            id: '1',
            itemType: ItemType.action,
            content: 'UI 최종 검토 진행',
            confidence: 0.91,
            ownerLabel: '나',
            dueDate: '목요일',
            dueTime: '14:00',
          ),
          ExtractedItemData(
            id: '2',
            itemType: ItemType.action,
            content: '기획서 초안 팀 공유',
            confidence: 0.85,
            ownerLabel: '나',
            dueDate: null,
            dueTime: null,
          ),
          ExtractedItemData(
            id: '3',
            itemType: ItemType.decision,
            content: 'UI 시안은 목요일까지 완료하기로 결정',
            confidence: 0.95,
            ownerLabel: null,
            dueDate: null,
            dueTime: null,
          ),
          ExtractedItemData(
            id: '4',
            itemType: ItemType.action,
            content: '다음 주 월요일 팀 전체 리뷰 일정 잡기',
            confidence: 0.78,
            ownerLabel: '나',
            dueDate: '다음 주 월요일',
            dueTime: null,
          ),
        ]);

final selectedTabProvider = StateProvider<ItemType>((ref) => ItemType.action);

// ============================================================
// 결과 확인 화면
// ============================================================

class ItemsReviewPage extends ConsumerWidget {
  final String? meetingId;

  const ItemsReviewPage({super.key, this.meetingId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(extractedItemsProvider);
    final selectedTab = ref.watch(selectedTabProvider);

    final filteredItems =
        items.where((i) => i.itemType == selectedTab).toList();

    final draftCount =
        items.where((i) => i.status == ItemStatus.draft).length;
    final confirmedCount =
        items.where((i) => i.status == ItemStatus.confirmed).length;

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
          '추출 결과',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: Column(
        children: [
          // 상태 요약
          _SummaryBar(
            total: items.length,
            draftCount: draftCount,
            confirmedCount: confirmedCount,
          ),

          // 탭 필터
          _TabFilter(
            selectedTab: selectedTab,
            actionCount: items
                .where((i) => i.itemType == ItemType.action)
                .length,
            decisionCount: items
                .where((i) => i.itemType == ItemType.decision)
                .length,
            onTabChanged: (tab) =>
                ref.read(selectedTabProvider.notifier).state = tab,
          ),

          // 아이템 목록
          Expanded(
            child: filteredItems.isEmpty
                ? _EmptyItems(type: selectedTab)
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                    itemCount: filteredItems.length,
                    itemBuilder: (context, index) {
                      return _ItemCard(
                        item: filteredItems[index],
                        onConfirm: () {
                          ref
                              .read(extractedItemsProvider.notifier)
                              .update((state) => state
                                  .map((i) => i.id == filteredItems[index].id
                                      ? (i..status = ItemStatus.confirmed)
                                      : i)
                                  .toList());
                        },
                        onArchive: () {
                          ref
                              .read(extractedItemsProvider.notifier)
                              .update((state) => state
                                  .map((i) => i.id == filteredItems[index].id
                                      ? (i..status = ItemStatus.archived)
                                      : i)
                                  .toList());
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
      // 완료 버튼
      bottomNavigationBar: _BottomBar(
        confirmedCount: confirmedCount,
        onDone: () async {
          final meta = ref.read(pendingMeetingMetaProvider);
          final extracted = ref.read(extractedItemsProvider);
          final repo = ref.read(localMeetingRepositoryProvider);
          debugPrint('[완료] meta=$meta, extracted=${extracted.length}개');

          if (meta != null) {
            final meetingId = DateTime.now().millisecondsSinceEpoch.toString();
            String rawTitle = meta['title'] as String? ?? '기록';
            final segments = (meta['segments'] as List?)
                    ?.cast<Map<String, dynamic>>() ?? [];
            final segTexts = segments.map((s) => s['text'] as String? ?? '').where((t) => t.isNotEmpty).take(10).join(' ');
            String title = rawTitle;
            final usedLlmAnalysis = meta['usedLlmAnalysis'] as bool? ?? false;
            if (usedLlmAnalysis && segTexts.isNotEmpty) {
              try {
                final llm = await ref.read(llmRepositoryProvider.future);
                if (llm != null) {
                  final suggested = await llm.chat(
                    '다음 회의/대화 내용을 보고 핵심을 담은 제목을 10자 이내로 한 줄만 작성해. 설명 없이 제목만: "$segTexts"'
                  );
                  final cleaned = suggested.trim().replaceAll('"', '').replaceAll("'", '');
                  if (cleaned.isNotEmpty && context.mounted) {
                    final confirmed = await showDialog<String>(
                      context: context,
                      builder: (_) => _TitleSuggestDialog(
                        suggested: cleaned,
                        original: rawTitle,
                      ),
                    );
                    if (confirmed != null) title = confirmed;
                  }
                }
              } catch (_) {}
            }
            final rType = meta['recordType'] as String? ?? 'meeting';
            final pName = meta['participantName'] as String? ?? '';
            final audioFilePath = meta['audioFilePath'] as String?;
            final segCount = meta['segmentCount'] as int? ?? 0;
            final actionCount =
                extracted.where((e) => e.itemType == ItemType.action).length;
            final decisionCount =
                extracted.where((e) => e.itemType == ItemType.decision).length;
            final now = DateTime.now();

            // DB 저장
            await repo.saveMeeting(
              meetingId: meetingId,
              title: title,
              recordType: rType,
              participantName: pName,
              segmentCount: segCount,
              actionCount: actionCount,
              decisionCount: decisionCount,
              startedAt: DateTime.tryParse(meta['date'] as String? ?? '') ?? now,
              endedAt: now,
              summary: audioFilePath == null ? null : 'audio:$audioFilePath',
            );

            // 세그먼트 저장
            if (segments.isNotEmpty) {
              await repo.saveSegments(meetingId, segments);
            }

            if (audioFilePath != null) {
              await _uploadRecordingIfConfigured(
                context,
                ref,
                meetingId: meetingId,
                audioFilePath: audioFilePath,
                transcript: segments
                    .map((s) => s['text'] as String? ?? '')
                    .where((text) => text.trim().isNotEmpty)
                    .join('\n\n'),
              );
            }

            // 추출 아이템 저장
            if (extracted.isNotEmpty) {
              await repo.saveExtractedItems(
                meetingId,
                extracted
                    .map((e) => {
                          'id': '${meetingId}_${e.id}',
                          'itemType': e.itemType == ItemType.action
                              ? 'action'
                              : 'decision',
                          'content': e.content,
                          'confidence': e.confidence,
                          'ownerLabel': e.ownerLabel,
                          'dueDate': e.dueDate,
                          'dueTime': e.dueTime,
                        })
                    .toList(),
              );
            }

            // 메모리 목록에도 즉시 반영
            final summary = MeetingSummary(
              id: meetingId,
              title: title,
              date: DateTime.tryParse(meta['date'] as String? ?? '') ?? now,
              segmentCount: segCount,
              actionCount: actionCount,
              decisionCount: decisionCount,
              recordType: rType,
              participantName: pName.isNotEmpty ? pName : null,
            );
            ref
                .read(meetingSummariesProvider.notifier)
                .addMeeting(summary);
            ref.read(pendingMeetingMetaProvider.notifier).state = null;
          }

          ref.read(extractedItemsProvider.notifier).state = [];
          ref.read(selectedTabProvider.notifier).state = ItemType.action;
          context.go('/meetings');
        },
      ),
    );
  }
}

Future<void> _uploadRecordingIfConfigured(
  BuildContext context,
  WidgetRef ref, {
  required String meetingId,
  required String audioFilePath,
  required String transcript,
}) async {
  final settings = await ServerSettings.load();
  if (!settings.enabled || !settings.isConfigured) return;

  final file = File(audioFilePath);
  if (!await file.exists()) return;

  try {
    await ref.read(serverSyncServiceProvider).uploadRecordingFile(
          settings,
          filePath: audioFilePath,
          localId: 'recording_$meetingId',
          noteLocalId: meetingId,
          transcript: transcript,
        );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('녹음 파일 서버 업로드 실패: $e'),
        backgroundColor: const Color(0xFFEF4444),
      ),
    );
  }
}

// ============================================================
// 상태 요약 바
// ============================================================

class _SummaryBar extends StatelessWidget {
  final int total;
  final int draftCount;
  final int confirmedCount;

  const _SummaryBar({
    required this.total,
    required this.draftCount,
    required this.confirmedCount,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB).withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome,
              size: 16, color: Color(0xFF2563EB)),
          const SizedBox(width: 8),
          Text(
            '총 $total개 추출됨',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF2563EB),
            ),
          ),
          const Spacer(),
          _StatusChip(
              label: '확인 대기 $draftCount',
              color: const Color(0xFFF59E0B)),
          const SizedBox(width: 6),
          _StatusChip(
              label: '확인 완료 $confirmedCount',
              color: const Color(0xFF10B981)),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final Color color;

  const _StatusChip({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ============================================================
// 탭 필터
// ============================================================

class _TabFilter extends StatelessWidget {
  final ItemType selectedTab;
  final int actionCount;
  final int decisionCount;
  final ValueChanged<ItemType> onTabChanged;

  const _TabFilter({
    required this.selectedTab,
    required this.actionCount,
    required this.decisionCount,
    required this.onTabChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          _TabChip(
            label: 'Action',
            count: actionCount,
            isSelected: selectedTab == ItemType.action,
            color: const Color(0xFF2563EB),
            onTap: () => onTabChanged(ItemType.action),
          ),
          const SizedBox(width: 8),
          _TabChip(
            label: 'Decision',
            count: decisionCount,
            isSelected: selectedTab == ItemType.decision,
            color: const Color(0xFF7C3AED),
            onTap: () => onTabChanged(ItemType.decision),
          ),
        ],
      ),
    );
  }
}

class _TabChip extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final Color color;
  final VoidCallback onTap;

  const _TabChip({
    required this.label,
    required this.count,
    required this.isSelected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? color : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? color : const Color(0xFFE5E7EB),
          ),
        ),
        child: Row(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isSelected ? Colors.white : const Color(0xFF6B7280),
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected
                    ? Colors.white.withValues(alpha: 0.3)
                    : const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color:
                      isSelected ? Colors.white : const Color(0xFF6B7280),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 아이템 카드
// ============================================================

class _ItemCard extends StatelessWidget {
  final ExtractedItemData item;
  final VoidCallback onConfirm;
  final VoidCallback onArchive;

  const _ItemCard({
    required this.item,
    required this.onConfirm,
    required this.onArchive,
  });

  @override
  Widget build(BuildContext context) {
    final isConfirmed = item.status == ItemStatus.confirmed;
    final isArchived = item.status == ItemStatus.archived;
    final isAction = item.itemType == ItemType.action;
    final accentColor =
        isAction ? const Color(0xFF2563EB) : const Color(0xFF7C3AED);

    return AnimatedOpacity(
      opacity: isArchived ? 0.4 : 1.0,
      duration: const Duration(milliseconds: 200),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isConfirmed
                ? const Color(0xFF10B981)
                : const Color(0xFFE5E7EB),
            width: isConfirmed ? 1.5 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 상단 콘텐츠
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 타입 + 신뢰도
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: accentColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          isAction ? 'Action' : 'Decision',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: accentColor,
                          ),
                        ),
                      ),
                      const Spacer(),
                      // 신뢰도
                      Icon(Icons.auto_awesome,
                          size: 12, color: Colors.amber.shade400),
                      const SizedBox(width: 3),
                      Text(
                        '${(item.confidence * 100).toInt()}%',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF9CA3AF),
                        ),
                      ),
                      // 확인 완료 표시
                      if (isConfirmed) ...[
                        const SizedBox(width: 8),
                        const Icon(Icons.check_circle,
                            size: 16, color: Color(0xFF10B981)),
                      ],
                      if (isArchived) ...[
                        const SizedBox(width: 8),
                        const Icon(Icons.archive_outlined,
                            size: 16, color: Color(0xFF9CA3AF)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),
                  // 내용
                  Text(
                    item.content,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF111827),
                      height: 1.4,
                    ),
                  ),
                  // 메타 정보 (Action만)
                  if (isAction && (item.ownerLabel != null ||
                      item.dueDate != null)) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (item.ownerLabel != null) ...[
                          const Icon(Icons.person_outline,
                              size: 13, color: Color(0xFF9CA3AF)),
                          const SizedBox(width: 3),
                          Text(
                            item.ownerLabel!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                          const SizedBox(width: 10),
                        ],
                        if (item.dueDate != null) ...[
                          const Icon(Icons.calendar_today_outlined,
                              size: 13, color: Color(0xFF9CA3AF)),
                          const SizedBox(width: 3),
                          Text(
                            item.dueTime != null
                                ? '${item.dueDate} ${item.dueTime}'
                                : item.dueDate!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ] else ...[
                          const Icon(Icons.calendar_today_outlined,
                              size: 13, color: Color(0xFF9CA3AF)),
                          const SizedBox(width: 3),
                          const Text(
                            '기한 미정',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ],
              ),
            ),

            // 하단 버튼 (archived가 아닐 때만)
            if (!isArchived) ...[
              const Divider(height: 1, color: Color(0xFFE5E7EB)),
              Row(
                children: [
                  // 보관 버튼
                  Expanded(
                    child: TextButton(
                      onPressed: onArchive,
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF9CA3AF),
                        padding:
                            const EdgeInsets.symmetric(vertical: 10),
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.only(
                            bottomLeft: Radius.circular(12),
                          ),
                        ),
                      ),
                      child: const Text(
                        '보관',
                        style: TextStyle(fontSize: 13),
                      ),
                    ),
                  ),
                  Container(
                      width: 1, height: 32, color: const Color(0xFFE5E7EB)),
                  // 확인 버튼
                  Expanded(
                    child: TextButton(
                      onPressed: isConfirmed ? null : onConfirm,
                      style: TextButton.styleFrom(
                        foregroundColor: isConfirmed
                            ? const Color(0xFF9CA3AF)
                            : const Color(0xFF10B981),
                        padding:
                            const EdgeInsets.symmetric(vertical: 10),
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.only(
                            bottomRight: Radius.circular(12),
                          ),
                        ),
                      ),
                      child: Text(
                        isConfirmed ? '확인 완료' : '확인',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 빈 목록
// ============================================================

class _EmptyItems extends StatelessWidget {
  final ItemType type;

  const _EmptyItems({required this.type});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            type == ItemType.action
                ? Icons.check_circle_outline
                : Icons.lightbulb_outline,
            size: 48,
            color: const Color(0xFFD1D5DB),
          ),
          const SizedBox(height: 16),
          Text(
            type == ItemType.action
                ? '추출된 Action이 없습니다'
                : '추출된 Decision이 없습니다',
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF9CA3AF),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 하단 바
// ============================================================

class _BottomBar extends StatefulWidget {
  final int confirmedCount;
  final Future<void> Function() onDone;

  const _BottomBar({
    required this.confirmedCount,
    required this.onDone,
  });

  @override
  State<_BottomBar> createState() => _BottomBarState();
}

class _BottomBarState extends State<_BottomBar> {
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, MediaQuery.of(context).viewPadding.bottom + 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
      ),
      child: SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          onPressed: _isLoading
              ? null
              : () async {
                  setState(() => _isLoading = true);
                  try {
                    await widget.onDone();
                  } catch (e) {
                    debugPrint('[완료 버튼 ERROR] $e');
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('저장 중 오류: $e')),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => _isLoading = false);
                  }
                },
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2563EB),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: _isLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      color: Colors.white, strokeWidth: 2))
              : Text(
                  widget.confirmedCount > 0
                      ? '완료 (${widget.confirmedCount}개 확인됨)'
                      : '완료',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
        ),
      ),
    );
  }
}

// ============================================================
// LLM 제목 제안 다이얼로그
// ============================================================

class _TitleSuggestDialog extends StatefulWidget {
  final String suggested;
  final String original;
  const _TitleSuggestDialog({required this.suggested, required this.original});

  @override
  State<_TitleSuggestDialog> createState() => _TitleSuggestDialogState();
}

class _TitleSuggestDialogState extends State<_TitleSuggestDialog> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.suggested);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: const Text('회의 제목', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('AI가 제목을 제안했어요. 수정 후 확정하세요.',
              style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          const SizedBox(height: 12),
          TextField(
            controller: _ctrl,
            autofocus: true,
            decoration: InputDecoration(
              hintText: '회의 제목',
              filled: true,
              fillColor: const Color(0xFFF9FAFB),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFF2563EB))),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => setState(() => _ctrl.text = widget.original),
            child: Text('기본 제목 사용: ${widget.original}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF),
                    decoration: TextDecoration.underline)),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, widget.original),
          child: const Text('건너뛰기', style: TextStyle(color: Color(0xFF6B7280))),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(context, _ctrl.text.trim().isEmpty ? widget.original : _ctrl.text.trim()),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2563EB),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          child: const Text('확정', style: TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
