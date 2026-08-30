/// 묻기 화면 — Now.
///
/// 메모를 쓰다 궁금한 것이 생기면 그 자리에서 묻는다. 별도 대화 프로그램이
/// 아니라서 대화는 저장하지 않고 메모리에만 둔다. 오늘 메모(진행 화면)와
/// 계층 메모(트리 편집 다이얼로그)가 이 위젯 하나를 함께 쓴다.
///
/// 실제 묻기 동작(길이 상한, 잠긴 메모 차단, 오류 문구)은
/// `package:now_core`의 `AskService`가 다 한다. 이 화면은 그 결과를
/// 보여 주고, 답을 메모에 넣을지·복사할지·버릴지만 다룬다.
library;

import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

import '../../llm/providers/llm_providers.dart';
import '../../repositories/repository_providers.dart';

/// 묻기 시트를 연다.
///
/// [noteContent]는 지금 보고 있는 메모의 제목+본문 문자열이다(첫 줄이 제목).
/// 잠긴 메모이거나 맥락을 붙일 수 없는 상황이면 null을 넘긴다 — 그러면
/// "이 메모 같이 보내기" 토글 자체가 보이지 않는다.
///
/// [onInsertAnswer]는 사용자가 "메모에 넣기"를 눌렀을 때 불린다. 이미
/// 머리줄·출처가 붙은 완성된 문자열(하나의 답 덩어리)을 받는다. 그 문자열을
/// 실제로 어디에 어떻게 붙일지는(문단으로 추가할지, 본문 끝에 이어 붙일지)
/// 부르는 화면이 정한다 — 시트는 저장 방법을 모른다.
Future<void> showAskSheet(
  BuildContext context, {
  required String? noteContent,
  required ValueChanged<String> onInsertAnswer,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => AskSheet(
      noteContent: noteContent,
      onInsertAnswer: onInsertAnswer,
    ),
  );
}

enum _AskSheetTab { ask, search }

class AskSheet extends ConsumerStatefulWidget {
  const AskSheet({
    super.key,
    required this.noteContent,
    required this.onInsertAnswer,
  });

  /// 지금 보고 있는 메모의 제목+본문. 맥락 토글을 켰을 때 이 값으로
  /// [AskNoteContext.fromContent]를 만든다. null이면 토글 자체가 없다.
  final String? noteContent;

  /// "메모에 넣기"를 눌렀을 때 완성된 답 덩어리를 넘겨받는 콜백.
  final ValueChanged<String> onInsertAnswer;

  @override
  ConsumerState<AskSheet> createState() => AskSheetState();
}

class AskSheetState extends ConsumerState<AskSheet> {
  final TextEditingController _questionController = TextEditingController();
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  _AskSheetTab _tab = _AskSheetTab.ask;
  AskConversation _conversation = const AskConversation.empty();
  bool _includeContext = true;
  bool _loading = false;
  String? _errorMessage;
  String? _sourceLabel;

  bool _searching = false;
  List<_AskSearchHit> _searchResults = const [];

  bool get _contextAvailable => widget.noteContent != null;

  @override
  void dispose() {
    _questionController.dispose();
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final question = _questionController.text.trim();
    if (question.isEmpty || _loading) return;

    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    try {
      final llmRepo = await ref.read(llmRepositoryProvider.future);
      if (llmRepo == null) {
        setState(() {
          _errorMessage = '먼저 설정에서 사용할 LLM을 지정해 주세요.';
        });
        return;
      }

      final askService = AskService(llmRepo);

      AskNoteContext? noteContext;
      if (_includeContext && widget.noteContent != null) {
        try {
          noteContext = AskNoteContext.fromContent(widget.noteContent!);
        } on AskException catch (e) {
          setState(() => _errorMessage = e.message);
          return;
        }
      }

      final result = await askService.ask(
        question: question,
        conversation: _conversation,
        noteContext: noteContext,
      );

      if (!mounted) return;
      setState(() {
        _conversation = result.conversation;
        _sourceLabel = askService.sourceLabel;
        _questionController.clear();
      });
      _scrollToBottom();
    } on AskException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _copyAnswer(String answer) {
    Clipboard.setData(ClipboardData(text: answer));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('답을 복사했습니다.')),
    );
  }

  void _insertAnswer(String answer, String? question) {
    final block = buildAskInsertionBlock(
      answer,
      question: question,
      sourceLabel: _sourceLabel,
    );
    widget.onInsertAnswer(block);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('메모에 넣었습니다.')),
    );
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _search(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) {
      setState(() => _searchResults = const []);
      return;
    }
    setState(() => _searching = true);
    try {
      final db = ref.read(noteDatabaseProvider);
      final results = await _searchNotes(db, trimmed);
      if (!mounted) return;
      setState(() => _searchResults = results);
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        child: FractionallySizedBox(
          heightFactor: 0.88,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE5E7EB),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                _buildTabBar(),
                const SizedBox(height: 12),
                Expanded(
                  child: _tab == _AskSheetTab.ask
                      ? _buildAskTab()
                      : _buildSearchTab(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTabBar() {
    return Row(
      children: [
        Expanded(
          child: _TabButton(
            label: '묻기',
            icon: Icons.chat_bubble_outline,
            selected: _tab == _AskSheetTab.ask,
            onTap: () => setState(() => _tab = _AskSheetTab.ask),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _TabButton(
            label: '내 메모 찾기',
            icon: Icons.search,
            selected: _tab == _AskSheetTab.search,
            onTap: () => setState(() => _tab = _AskSheetTab.search),
          ),
        ),
      ],
    );
  }

  Widget _buildAskTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_contextAvailable)
          SwitchListTile.adaptive(
            contentPadding: EdgeInsets.zero,
            dense: true,
            value: _includeContext,
            onChanged: (value) => setState(() => _includeContext = value),
            title: const Text(
              '이 메모 같이 보내기',
              style: TextStyle(fontSize: 13, color: Color(0xFF374151)),
            ),
          ),
        Expanded(
          child: _conversation.isEmpty
              ? const _AskEmptyState()
              : ListView.builder(
                  controller: _scrollController,
                  itemCount: _conversation.length,
                  itemBuilder: (context, index) {
                    final message = _conversation.messages[index];
                    if (message.role == AskRole.user) {
                      return _QuestionBubble(text: message.text);
                    }
                    final question = index > 0
                        ? _conversation.messages[index - 1].text
                        : null;
                    return _AnswerBubble(
                      text: message.text,
                      onCopy: () => _copyAnswer(message.text),
                      onInsert: () => _insertAnswer(message.text, question),
                    );
                  },
                ),
        ),
        if (_errorMessage != null)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFFCA5A5)),
            ),
            child: Text(
              _errorMessage!,
              style: const TextStyle(fontSize: 13, color: Color(0xFFB91C1C)),
            ),
          ),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _questionController,
                maxLines: null,
                textInputAction: TextInputAction.send,
                enabled: !_loading,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: '무엇이 궁금한가요?',
                  hintStyle: const TextStyle(
                      color: Color(0xFF9CA3AF), fontSize: 14),
                  filled: true,
                  fillColor: const Color(0xFFF9FAFB),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: const BorderSide(color: Color(0xFF2563EB)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            GestureDetector(
              onTap: _loading ? null : _send,
              child: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _loading
                      ? const Color(0xFF93C5FD)
                      : const Color(0xFF2563EB),
                  shape: BoxShape.circle,
                ),
                child: _loading
                    ? const Padding(
                        padding: EdgeInsets.all(10),
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send, color: Colors.white, size: 18),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSearchTab() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: _searchController,
          textInputAction: TextInputAction.search,
          onSubmitted: _search,
          decoration: InputDecoration(
            hintText: '내 메모에서 찾기',
            hintStyle:
                const TextStyle(color: Color(0xFF9CA3AF), fontSize: 14),
            prefixIcon: const Icon(Icons.search, size: 20),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: _searching
              ? const Center(child: CircularProgressIndicator())
              : _searchResults.isEmpty
                  ? const Center(
                      child: Text(
                        '검색어를 입력해 보세요.',
                        style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                      ),
                    )
                  : ListView.separated(
                      itemCount: _searchResults.length,
                      separatorBuilder: (_, __) =>
                          const Divider(height: 1, color: Color(0xFFE5E7EB)),
                      itemBuilder: (context, index) {
                        final hit = _searchResults[index];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            hit.title,
                            style: const TextStyle(
                                fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            hit.snippet,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 12, color: Color(0xFF6B7280)),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }
}

/// 검색 결과 한 건.
class _AskSearchHit {
  const _AskSearchHit({required this.title, required this.snippet});

  final String title;
  final String snippet;
}

/// 오늘 메모(TranscriptSegments+Meetings)와 계층 메모(Memos)를 본문/제목
/// LIKE 검색한다. 잠긴 메모는 암호문이 그대로 보이지 않도록 제외한다.
Future<List<_AskSearchHit>> _searchNotes(
  NoteDatabase db,
  String query,
) async {
  final pattern = '%$query%';
  final hits = <_AskSearchHit>[];

  final memoRows = await (db.select(db.memos)
        ..where((m) => m.content.like(pattern))
        ..limit(20))
      .get();
  for (final row in memoRows) {
    if (isEncryptedNoteContent(row.content)) continue;
    final split = splitNoteContent(row.content);
    hits.add(_AskSearchHit(
      title: split.title,
      snippet: split.body.isEmpty ? '(내용 없음)' : split.body,
    ));
  }

  final segmentQuery = db.select(db.transcriptSegments).join([
    innerJoin(
      db.meetings,
      db.meetings.meetingId.equalsExp(db.transcriptSegments.meetingId),
    ),
  ])
    ..where(
      db.transcriptSegments.content.like(pattern) &
          db.meetings.recordType.equals('memo'),
    )
    ..limit(20);
  final segmentRows = await segmentQuery.get();
  for (final row in segmentRows) {
    final segment = row.readTable(db.transcriptSegments);
    final meeting = row.readTable(db.meetings);
    hits.add(_AskSearchHit(
      title: meeting.title.isEmpty ? '오늘 메모' : meeting.title,
      snippet: segment.content,
    ));
  }

  return hits;
}

class _TabButton extends StatelessWidget {
  const _TabButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF2563EB) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 16,
                color: selected ? Colors.white : const Color(0xFF6B7280)),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : const Color(0xFF6B7280),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AskEmptyState extends StatelessWidget {
  const _AskEmptyState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 24),
        child: Text(
          '메모를 쓰다 궁금한 것이 생기면 물어보세요.\n답을 메모에 넣거나 복사할 수 있습니다.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF), height: 1.5),
        ),
      ),
    );
  }
}

class _QuestionBubble extends StatelessWidget {
  const _QuestionBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        constraints: const BoxConstraints(maxWidth: 280),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFDBEAFE),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF93C5FD)),
        ),
        child: Text(
          text,
          style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
        ),
      ),
    );
  }
}

class _AnswerBubble extends StatelessWidget {
  const _AnswerBubble({
    required this.text,
    required this.onCopy,
    required this.onInsert,
  });

  final String text;
  final VoidCallback onCopy;
  final VoidCallback onInsert;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        constraints: const BoxConstraints(maxWidth: 280),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              text,
              style: const TextStyle(
                  fontSize: 14, color: Color(0xFF111827), height: 1.4),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextButton.icon(
                  onPressed: onInsert,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: const Icon(Icons.note_add_outlined,
                      size: 16, color: Color(0xFF2563EB)),
                  label: const Text('메모에 넣기',
                      style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF2563EB),
                          fontWeight: FontWeight.w600)),
                ),
                TextButton.icon(
                  onPressed: onCopy,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: const Icon(Icons.copy_outlined,
                      size: 16, color: Color(0xFF6B7280)),
                  label: const Text('복사',
                      style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
