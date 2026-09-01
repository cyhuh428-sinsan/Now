import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

import '../ask/ask_sheet.dart';
import '../settings/mail_settings_status.dart';
import '../settings/settings_providers.dart';
import 'tree_input_bar.dart';
import 'tree_providers.dart';
import 'tree_repository.dart';
import 'tree_voice_providers.dart';

/// 계층 메모 탭.
///
/// 주제(레벨 1) → 분류(레벨 2) → 메모(레벨 3) 3단계를 들여쓰기로 보여준다.
/// 실제 저장/조회/삭제 대기 처리는 [TreeMemoRepository]가 하고, 이 위젯은
/// 표시와 입력만 담당한다(`now_core` 설계 문서의 "화면은 표시와 입력만" 규칙).
class TreeMemoPage extends ConsumerStatefulWidget {
  const TreeMemoPage({super.key});

  @override
  ConsumerState<TreeMemoPage> createState() => _TreeMemoPageState();
}

class _TreeMemoPageState extends ConsumerState<TreeMemoPage> {
  final Set<String> _expandedIds = {};
  TreeMemoNode? _selectedNode;

  /// 이 화면을 벗어나면(위젯 상태가 사라지면) 함께 비워지는 복호화 결과.
  ///
  /// 화면에 머무는 동안만 평문을 기억한다. now_app의 `_unlockedEncryptedContents`와
  /// 같은 패턴이다.
  final Map<String, String> _unlockedEncryptedContents = {};

  /// 메모 읽어주기(TTS). 화면에 머무는 동안 하나만 만들어 모든 메모가
  /// 공유한다 — VoicePlaybackService의 "한 번에 하나만 재생" 규칙이 이
  /// 인스턴스 하나로만 지켜진다.
  VoicePlaybackService? _playback;

  static const List<String> _levelLabels = ['주제', '분류', '메모'];
  static const List<Color> _levelColors = [
    Color(0xFF2563EB),
    Color(0xFF059669),
    Color(0xFF9333EA),
  ];

  String _labelForLevel(int level) =>
      _levelLabels[(level - 1).clamp(0, _levelLabels.length - 1)];

  Color _colorForLevel(int level) =>
      _levelColors[(level - 1).clamp(0, _levelColors.length - 1)];

  @override
  void dispose() {
    _playback?.dispose();
    super.dispose();
  }

  /// 이미 만든 재생 서비스가 있으면 그대로 돌려주고, 없으면 만든다.
  ///
  /// 처음 재생 버튼을 누를 때만 서버 설정을 읽는다 — 이 화면에 진입만
  /// 해서는 음성 설정을 전혀 건드리지 않는다.
  Future<VoicePlaybackService> _ensurePlayback() async {
    final existing = _playback;
    if (existing != null) return existing;
    final settings = await ref.read(voiceSettingsStoreProvider).load();
    final buildClient = ref.read(voiceEngineClientBuilderProvider);
    final buildPlayback = ref.read(treeVoicePlaybackServiceBuilderProvider);
    final playback = buildPlayback(buildClient(settings));
    _playback = playback;
    return playback;
  }

  /// 이미 만들어져 있으면 그 인스턴스를, 없으면 null을 돌려준다.
  VoicePlaybackService? _currentPlayback() => _playback;

  Map<String?, List<TreeMemoNode>> _groupByParent(List<TreeMemoNode> nodes) {
    final map = <String?, List<TreeMemoNode>>{};
    for (final node in nodes) {
      map.putIfAbsent(node.parentId, () => []).add(node);
    }
    return map;
  }

  Future<void> _addMemo(String title) async {
    final repo = ref.read(treeMemoRepositoryProvider);
    final parent = _selectedNode;
    if (!repo.canAddChild(parent)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('계층 메모는 최대 $kMaxTreeMemoLevel단계까지만 만들 수 있습니다.')),
      );
      return;
    }
    try {
      final created = await repo.addMemo(title: title, parent: parent);
      if (parent != null) {
        setState(() => _expandedIds.add(parent.id));
      }
      ref.invalidate(treeMemoNodesProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('"${created.title}"을 추가했습니다.')));
    } on TreeMemoLevelLimitExceeded {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('계층 메모는 최대 $kMaxTreeMemoLevel단계까지만 만들 수 있습니다.')),
      );
    }
  }

  void _toggleSelection(TreeMemoNode node) {
    setState(() {
      if (_selectedNode?.id == node.id) {
        _selectedNode = null;
      } else {
        _selectedNode = node;
      }
      if (node.level < kMaxTreeMemoLevel) {
        if (_expandedIds.contains(node.id)) {
          _expandedIds.remove(node.id);
        } else {
          _expandedIds.add(node.id);
        }
      }
    });
  }

  Future<String?> _requestEncryptionKey({
    required String title,
    required String message,
  }) async {
    final ctrl = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(message),
            const SizedBox(height: 12),
            TextField(
              key: const Key('tree-encryption-key-field'),
              controller: ctrl,
              obscureText: true,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: '암호 키',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (_) => Navigator.pop(ctx, ctrl.text),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text),
            child: const Text('확인'),
          ),
        ],
      ),
    );
    final trimmed = result?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  Future<void> _saveBody(TreeMemoNode node, String body) async {
    final repo = ref.read(treeMemoRepositoryProvider);
    await repo.saveBody(node, body);
    ref.invalidate(treeMemoNodesProvider);
  }

  Future<void> _unlockMemo(TreeMemoNode node) async {
    final key = await _requestEncryptionKey(
      title: '복호화',
      message: '이 메모를 잠시 열어볼 암호 키를 입력하세요.',
    );
    if (key == null) return;
    try {
      final plain = await const NoteEncryptionService().decrypt(
        node.content,
        key,
      );
      if (!mounted) return;
      setState(() {
        _unlockedEncryptedContents[node.id] = plain;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('메모를 복호화했습니다.')));
      _openMemo(node);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('복호화 실패: 암호 키를 확인하세요.'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  void _lockMemo(TreeMemoNode node) {
    setState(() {
      _unlockedEncryptedContents.remove(node.id);
    });
  }

  Future<void> _encryptMemo(
    TreeMemoNode node,
    String content, {
    VoidCallback? onEncrypted,
  }) async {
    if (content.trim().isEmpty) return;
    final key = await _requestEncryptionKey(
      title: '암호화',
      message: '이 메모를 암호화할 키를 입력하세요. 키를 잊으면 복구할 수 없습니다.',
    );
    if (key == null) return;
    try {
      final encrypted = await const NoteEncryptionService().encrypt(
        content,
        key,
      );
      await _saveBody(node, encrypted);
      _unlockedEncryptedContents.remove(node.id);
      onEncrypted?.call();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('메모를 암호화했습니다.')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('암호화 실패: $e'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  Future<void> _removeMemoEncryption(TreeMemoNode node) async {
    var plain = _unlockedEncryptedContents[node.id];
    if (plain == null) {
      final key = await _requestEncryptionKey(
        title: '암호화 해제',
        message: '평문으로 저장하려면 암호 키를 입력하세요.',
      );
      if (key == null) return;
      try {
        plain = await const NoteEncryptionService().decrypt(node.content, key);
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('암호화 해제 실패: 암호 키를 확인하세요.'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
        return;
      }
    }
    final resolvedPlain = plain;
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('암호화 해제'),
        content: const Text('이 메모를 평문으로 저장할까요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('해제'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _saveBody(node, resolvedPlain);
    setState(() {
      _unlockedEncryptedContents.remove(node.id);
    });
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('암호화를 해제하고 평문으로 저장했습니다.')));
  }

  void _insertIntoController(TextEditingController controller, String text) {
    final selection = controller.selection;
    final value = controller.text;
    final start = selection.isValid ? selection.start : value.length;
    final end = selection.isValid ? selection.end : value.length;
    final normalizedStart = start.clamp(0, value.length);
    final normalizedEnd = end.clamp(normalizedStart, value.length);
    controller.value = TextEditingValue(
      text: value.replaceRange(normalizedStart, normalizedEnd, text),
      selection: TextSelection.collapsed(offset: normalizedStart + text.length),
    );
  }

  Future<void> _openFindDialog(TextEditingController controller) async {
    final queryCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('본문 찾기'),
        content: TextField(
          key: const Key('tree-editor-find-field'),
          controller: queryCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: '찾을 단어',
            border: OutlineInputBorder(),
          ),
          onSubmitted: (_) {
            final query = queryCtrl.text;
            final index = controller.text.indexOf(query);
            if (query.isNotEmpty && index >= 0) {
              controller.selection = TextSelection(
                baseOffset: index,
                extentOffset: index + query.length,
              );
            }
            Navigator.pop(ctx);
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('닫기'),
          ),
          FilledButton(
            onPressed: () {
              final query = queryCtrl.text;
              final index = controller.text.indexOf(query);
              if (query.isNotEmpty && index >= 0) {
                controller.selection = TextSelection(
                  baseOffset: index,
                  extentOffset: index + query.length,
                );
              }
              Navigator.pop(ctx);
            },
            child: const Text('찾기'),
          ),
        ],
      ),
    );
  }

  Future<void> _openReplaceDialog(TextEditingController controller) async {
    final findCtrl = TextEditingController();
    final replaceCtrl = TextEditingController();
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('바꾸기'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              key: const Key('tree-editor-replace-find-field'),
              controller: findCtrl,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: '찾을 단어',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('tree-editor-replace-with-field'),
              controller: replaceCtrl,
              decoration: const InputDecoration(
                labelText: '바꿀 단어',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () {
              final query = findCtrl.text;
              if (query.isNotEmpty) {
                final index = controller.text.indexOf(query);
                if (index >= 0) {
                  controller.text = controller.text.replaceRange(
                    index,
                    index + query.length,
                    replaceCtrl.text,
                  );
                  controller.selection = TextSelection.collapsed(
                    offset: index + replaceCtrl.text.length,
                  );
                }
              }
              Navigator.pop(ctx);
            },
            child: const Text('현재 항목 바꾸기'),
          ),
          FilledButton(
            onPressed: () {
              final query = findCtrl.text;
              if (query.isNotEmpty) {
                controller.text = controller.text.replaceAll(
                  query,
                  replaceCtrl.text,
                );
                controller.selection = TextSelection.collapsed(
                  offset: controller.text.length,
                );
              }
              Navigator.pop(ctx);
            },
            child: const Text('모두 바꾸기'),
          ),
        ],
      ),
    );
  }

  Future<void> _showMarkdownPreview(
    TreeMemoNode node,
    TextEditingController controller,
  ) async {
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(node.title),
        content: SingleChildScrollView(
          child: Text(controller.text.isEmpty ? '(내용 없음)' : controller.text),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('닫기'),
          ),
        ],
      ),
    );
  }

  Future<void> _showEditorActionMenu(
    TreeMemoNode node,
    TextEditingController controller,
  ) async {
    final mailStatus = await ref.read(mailSettingsStatusProvider.future);
    if (!mounted) return;
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _EditorActionGroup(
                title: '편집',
                actions: [
                  _EditorActionItem(
                    icon: Icons.copy_outlined,
                    label: '복사',
                    value: 'copy',
                  ),
                  _EditorActionItem(
                    icon: Icons.select_all_outlined,
                    label: '모두 선택',
                    value: 'select_all',
                  ),
                ],
              ),
              _EditorActionGroup(
                title: '찾기',
                actions: [
                  _EditorActionItem(
                    icon: Icons.search_outlined,
                    label: '본문 찾기',
                    value: 'find',
                  ),
                  _EditorActionItem(
                    icon: Icons.find_replace_outlined,
                    label: '바꾸기',
                    value: 'replace',
                  ),
                ],
              ),
              _EditorActionGroup(
                title: '삽입',
                actions: [
                  _EditorActionItem(
                    icon: Icons.access_time_outlined,
                    label: '시간 넣기',
                    value: 'insert_time',
                  ),
                  _EditorActionItem(
                    icon: Icons.checklist_outlined,
                    label: '체크리스트 넣기',
                    value: 'insert_checklist',
                  ),
                ],
              ),
              _EditorActionGroup(
                title: '형식',
                actions: [
                  _EditorActionItem(
                    icon: Icons.format_bold,
                    label: '굵게',
                    value: 'bold',
                  ),
                  _EditorActionItem(
                    icon: Icons.title_outlined,
                    label: '제목 1',
                    value: 'heading1',
                  ),
                ],
              ),
              _EditorActionGroup(
                title: '메모',
                actions: [
                  _EditorActionItem(
                    icon: Icons.help_outline,
                    label: '묻기',
                    value: 'ask',
                  ),
                  _EditorActionItem(
                    icon: Icons.article_outlined,
                    label: 'Markdown 보기',
                    value: 'markdown',
                  ),
                ],
              ),
              _EditorActionGroup(
                title: '보안',
                actions: [
                  _EditorActionItem(
                    icon: Icons.lock_outline,
                    label: '암호화',
                    value: 'encrypt',
                  ),
                ],
              ),
              _EditorActionGroup(
                title: '출력',
                actions: [
                  _EditorActionItem(
                    key: const Key('tree-editor-action-send-mail'),
                    icon: Icons.mail_outline,
                    label: '메일 보내기',
                    value: 'send_mail',
                    enabled: mailStatus.enabled,
                    subtitle: mailStatus.enabled
                        ? '메일 설정 테스트 완료'
                        : '메일 설정 테스트 후 사용 가능',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (action == null) return;
    switch (action) {
      case 'copy':
        await Clipboard.setData(ClipboardData(text: controller.text));
        break;
      case 'select_all':
        controller.selection = TextSelection(
          baseOffset: 0,
          extentOffset: controller.text.length,
        );
        break;
      case 'find':
        await _openFindDialog(controller);
        break;
      case 'replace':
        await _openReplaceDialog(controller);
        break;
      case 'insert_time':
        _insertIntoController(controller, DateTime.now().toIso8601String());
        break;
      case 'insert_checklist':
        _insertIntoController(controller, '- [ ] ');
        break;
      case 'bold':
        _insertIntoController(controller, '****');
        controller.selection = TextSelection.collapsed(
          offset: (controller.selection.baseOffset - 2).clamp(
            0,
            controller.text.length,
          ),
        );
        break;
      case 'heading1':
        _insertIntoController(controller, '# ');
        break;
      case 'ask':
        final noteContent = joinNoteContent(
          title: node.title,
          body: controller.text,
        );
        if (!mounted) return;
        showAskSheet(
          context,
          noteContent: noteContent,
          onInsertAnswer: (block) {
            controller.text = appendAskAnswerToNote(controller.text, block);
            controller.selection = TextSelection.fromPosition(
              TextPosition(offset: controller.text.length),
            );
          },
        );
        break;
      case 'markdown':
        await _showMarkdownPreview(node, controller);
        break;
      case 'encrypt':
        await _encryptMemo(node, controller.text);
        break;
      case 'send_mail':
        if (!mailStatus.enabled) return;
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('메일 보내기 API 연결 후 발송 화면을 엽니다.')),
        );
        break;
    }
  }

  void _openMemo(TreeMemoNode node) {
    final unlocked = _unlockedEncryptedContents[node.id];
    if (node.isEncrypted && unlocked == null) {
      showModalBottomSheet<void>(
        context: context,
        builder: (ctx) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(right: 6),
                      child: Icon(Icons.lock, size: 18),
                    ),
                    Expanded(
                      child: Text(
                        node.title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(node.displayContent(null)),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _unlockMemo(node);
                  },
                  icon: const Icon(Icons.lock_open),
                  label: const Text('복호화'),
                ),
              ],
            ),
          ),
        ),
      );
      return;
    }

    if (node.isEncrypted) {
      showModalBottomSheet<void>(
        context: context,
        builder: (ctx) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(right: 6),
                      child: Icon(Icons.lock_open, size: 18),
                    ),
                    Expanded(
                      child: Text(
                        node.title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    _PlaybackButton(
                      id: node.id,
                      textProvider: () => unlocked ?? '',
                      ensurePlayback: _ensurePlayback,
                      currentPlayback: _currentPlayback,
                    ),
                    TextButton.icon(
                      onPressed: () {
                        Navigator.pop(ctx);
                        _lockMemo(node);
                      },
                      icon: const Icon(Icons.lock),
                      label: const Text('잠금'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(unlocked!.isEmpty ? '(내용 없음)' : unlocked),
              ],
            ),
          ),
        ),
      );
      return;
    }

    final controller = TextEditingController(text: node.content);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: 16 + MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      node.title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  _PlaybackButton(
                    id: node.id,
                    textProvider: () => controller.text,
                    ensurePlayback: _ensurePlayback,
                    currentPlayback: _currentPlayback,
                  ),
                  IconButton(
                    key: const Key('tree-editor-menu-button'),
                    tooltip: '편집 메뉴',
                    onPressed: () => _showEditorActionMenu(node, controller),
                    icon: const Icon(Icons.more_vert),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () {
                    final noteContent = joinNoteContent(
                      title: node.title,
                      body: controller.text,
                    );
                    showAskSheet(
                      context,
                      noteContent: noteContent,
                      onInsertAnswer: (block) {
                        controller.text = appendAskAnswerToNote(
                          controller.text,
                          block,
                        );
                        controller.selection = TextSelection.fromPosition(
                          TextPosition(offset: controller.text.length),
                        );
                      },
                    );
                  },
                  icon: const Icon(Icons.help_outline, size: 16),
                  label: const Text('묻기'),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: controller,
                maxLines: 8,
                minLines: 3,
                decoration: const InputDecoration(
                  hintText: '내용을 입력하세요',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _encryptMemo(
                        node,
                        controller.text,
                        onEncrypted: () {
                          if (ctx.mounted) Navigator.pop(ctx);
                        },
                      ),
                      icon: const Icon(Icons.lock_outline),
                      label: const Text('암호화'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () async {
                        await _saveBody(node, controller.text);
                        if (!ctx.mounted) return;
                        Navigator.pop(ctx);
                      },
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('저장'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _renameMemo(TreeMemoNode node) async {
    final controller = TextEditingController(text: node.title);
    final newTitle = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('이름 바꾸기'),
        content: TextField(
          key: const Key('tree-rename-field'),
          controller: controller,
          autofocus: true,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('확인'),
          ),
        ],
      ),
    );
    if (newTitle == null || newTitle.trim().isEmpty) return;
    final repo = ref.read(treeMemoRepositoryProvider);
    await repo.renameMemo(node, newTitle.trim());
    ref.invalidate(treeMemoNodesProvider);
  }

  Future<void> _deleteMemo(TreeMemoNode node) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('삭제'),
        content: Text('"${node.title}"을 삭제할까요? 하위 항목도 함께 삭제됩니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('삭제'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final repo = ref.read(treeMemoRepositoryProvider);
    final allNodes = await ref.read(treeMemoNodesProvider.future);
    await repo.deleteMemo(node, allNodes);
    if (_selectedNode?.id == node.id) {
      setState(() => _selectedNode = null);
    }
    ref.invalidate(treeMemoNodesProvider);
  }

  Future<void> _showNodeMenu(TreeMemoNode node) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('이름 바꾸기'),
              onTap: () => Navigator.pop(ctx, 'rename'),
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline),
              title: const Text('삭제'),
              onTap: () => Navigator.pop(ctx, 'delete'),
            ),
            if (!node.isEncrypted)
              ListTile(
                leading: const Icon(Icons.lock_outline),
                title: const Text('암호화'),
                onTap: () => Navigator.pop(ctx, 'encrypt'),
              ),
            if (node.isEncrypted) ...[
              ListTile(
                leading: const Icon(Icons.lock_open),
                title: const Text('복호화'),
                onTap: () => Navigator.pop(ctx, 'decrypt'),
              ),
              ListTile(
                leading: const Icon(Icons.no_encryption_outlined),
                title: const Text('암호화 해제'),
                onTap: () => Navigator.pop(ctx, 'remove_encryption'),
              ),
            ],
          ],
        ),
      ),
    );
    if (action == 'rename') {
      await _renameMemo(node);
    } else if (action == 'delete') {
      await _deleteMemo(node);
    } else if (action == 'encrypt') {
      await _encryptMemo(node, node.content);
    } else if (action == 'decrypt') {
      await _unlockMemo(node);
    } else if (action == 'remove_encryption') {
      await _removeMemoEncryption(node);
    }
  }

  Widget _buildNodeTile(
    TreeMemoNode node,
    Map<String?, List<TreeMemoNode>> byParent,
    int depth,
  ) {
    final children = byParent[node.id] ?? const <TreeMemoNode>[];
    final isExpanded = _expandedIds.contains(node.id);
    final isSelected = _selectedNode?.id == node.id;
    final isLeafLevel = node.level >= kMaxTreeMemoLevel;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          color: isSelected ? const Color(0x142563EB) : null,
          child: ListTile(
            key: Key('tree-node-${node.id}'),
            contentPadding: EdgeInsets.only(
              left: 16.0 + depth * 20.0,
              right: 8,
            ),
            leading: isLeafLevel
                ? const SizedBox(width: 24)
                : Icon(isExpanded ? Icons.expand_more : Icons.chevron_right),
            title: Row(
              children: [
                Container(
                  key: Key('tree-badge-${node.id}'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: _colorForLevel(node.level),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _labelForLevel(node.level),
                    style: const TextStyle(color: Colors.white, fontSize: 11),
                  ),
                ),
                const SizedBox(width: 8),
                if (node.isEncrypted)
                  const Padding(
                    padding: EdgeInsets.only(right: 4),
                    child: Icon(Icons.lock, size: 14),
                  ),
                Expanded(
                  child: Text(node.title, overflow: TextOverflow.ellipsis),
                ),
                if (children.isNotEmpty)
                  Text(
                    '(${children.length})',
                    style: const TextStyle(color: Colors.grey),
                  ),
              ],
            ),
            onTap: () {
              if (node.level >= kMaxTreeMemoLevel) {
                _openMemo(node);
              } else {
                _toggleSelection(node);
              }
            },
            onLongPress: () => _showNodeMenu(node),
          ),
        ),
        if (isExpanded)
          for (final child in children)
            _buildNodeTile(child, byParent, depth + 1),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final nodesAsync = ref.watch(treeMemoNodesProvider);

    return Scaffold(
      body: Column(
        children: [
          if (_selectedNode != null)
            Container(
              width: double.infinity,
              color: const Color(0x142563EB),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Expanded(child: Text('추가 위치: ${_selectedNode!.title} 아래')),
                  TextButton(
                    onPressed: () => setState(() => _selectedNode = null),
                    child: const Text('선택 해제'),
                  ),
                ],
              ),
            ),
          Expanded(
            child: nodesAsync.when(
              data: (nodes) {
                if (nodes.isEmpty) {
                  return const Center(child: Text('아직 만든 계층 메모가 없습니다.'));
                }
                final byParent = _groupByParent(nodes);
                final roots = byParent[null] ?? const <TreeMemoNode>[];
                return ListView(
                  children: [
                    for (final root in roots) _buildNodeTile(root, byParent, 0),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, stack) => Center(child: Text('불러오기 실패: $error')),
            ),
          ),
          TreeInputBar(
            hintText: _selectedNode == null
                ? '새 주제 제목'
                : '"${_selectedNode!.title}" 아래 새 항목 제목',
            onSubmit: _addMemo,
          ),
        ],
      ),
    );
  }
}

/// 메모 하나를 읽어주는 재생/정지 버튼.
///
/// 암호화된 메모는 잠금이 풀려 평문이 있을 때만 이 버튼이 쓰인다(호출하는
/// 쪽이 잠긴 상태에서는 아예 만들지 않는다). [textProvider]는 버튼을 누르는
/// 시점의 최신 내용을 돌려준다 — 편집 중인 텍스트 필드의 값이 바뀔 수
/// 있어서다.

class _EditorActionGroup extends StatelessWidget {
  const _EditorActionGroup({required this.title, required this.actions});

  final String title;
  final List<_EditorActionItem> actions;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
          child: Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.bold),
          ),
        ),
        for (final action in actions) action,
      ],
    );
  }
}

class _EditorActionItem extends StatelessWidget {
  const _EditorActionItem({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.enabled = true,
    this.subtitle,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool enabled;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      enabled: enabled,
      leading: Icon(icon),
      title: Text(label),
      subtitle: subtitle == null ? null : Text(subtitle!),
      dense: true,
      onTap: enabled ? () => Navigator.pop(context, value) : null,
    );
  }
}

class _PlaybackButton extends StatefulWidget {
  const _PlaybackButton({
    required this.id,
    required this.textProvider,
    required this.ensurePlayback,
    required this.currentPlayback,
  });

  final String id;
  final String Function() textProvider;
  final Future<VoicePlaybackService> Function() ensurePlayback;
  final VoicePlaybackService? Function() currentPlayback;

  @override
  State<_PlaybackButton> createState() => _PlaybackButtonState();
}

class _PlaybackButtonState extends State<_PlaybackButton> {
  StreamSubscription<VoicePlaybackState>? _subscription;
  bool _isPlaying = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.currentPlayback();
    if (existing != null) _bind(existing);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  void _bind(VoicePlaybackService service) {
    _subscription?.cancel();
    _subscription = service.states.listen(_onState);
    _onState(service.state);
  }

  void _onState(VoicePlaybackState state) {
    if (!mounted) return;
    setState(() {
      _isPlaying = state.isPlayingId(widget.id);
      _isLoading =
          state.status == VoicePlaybackStatus.loading && state.id == widget.id;
    });
  }

  Future<void> _toggle() async {
    final service = await widget.ensurePlayback();
    _bind(service);

    if (_isPlaying || _isLoading) {
      await service.stop();
      return;
    }

    if (!service.canSpeak) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('읽어주기가 설정되어 있지 않습니다. 설정에서 TTS 서버 주소를 입력해 주세요.'),
        ),
      );
      return;
    }

    final text = widget.textProvider();
    if (text.trim().isEmpty) return;

    try {
      await service.speak(text: text, id: widget.id);
    } on VoicePlaybackException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } on VoiceEngineException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return IconButton(
      key: Key('tree-memo-playback-${widget.id}'),
      tooltip: _isPlaying ? '읽어주기 중지' : '메모 읽어주기',
      icon: _isLoading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Icon(
              _isPlaying
                  ? Icons.stop_circle_outlined
                  : Icons.volume_up_outlined,
              color: _isPlaying ? colorScheme.primary : null,
            ),
      onPressed: _toggle,
    );
  }
}
