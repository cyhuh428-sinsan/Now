import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../../core/database/app_database.dart';
import '../../repositories/repository_providers.dart';

class MemoTreePage extends ConsumerWidget {
  const MemoTreePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final memosAsync = ref.watch(treeMemosProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        title: const Text(
          '계층 메모',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: memosAsync.when(
        data: (memos) {
          final nodes = memos.map(TreeMemoNode.fromMemo).toList();
          final roots = nodes.where((n) => n.parentId == null).toList();

          if (roots.isEmpty) {
            return const Center(
              child: Text(
                '아직 계층 메모가 없습니다',
                style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 100),
            children: roots
                .map((node) => _TreeMemoTile(node: node, allNodes: nodes))
                .toList(),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('오류: $e')),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showTreeMemoDialog(context, ref),
        backgroundColor: const Color(0xFF2563EB),
        icon: const Icon(Icons.edit_note, color: Colors.white),
        label: const Text('부모메모 추가', style: TextStyle(color: Colors.white)),
      ),
    );
  }
}

final treeMemosProvider = FutureProvider.autoDispose<List<Memo>>((ref) async {
  final db = ref.watch(appDatabaseProvider);
  return (db.select(db.memos)
        ..where((m) => m.source.equals('note_tree'))
        ..orderBy([(m) => OrderingTerm.asc(m.createdAt)]))
      .get();
});

class TreeMemoNode {
  final String id;
  final String title;
  final String content;
  final String? parentId;
  final int level;

  const TreeMemoNode({
    required this.id,
    required this.title,
    required this.content,
    required this.parentId,
    required this.level,
  });

  factory TreeMemoNode.fromMemo(Memo memo) {
    final tags = _parseTags(memo.tags);
    final lines = memo.content.split('\n');
    final title = lines.first.trim().isEmpty ? '제목 없음' : lines.first.trim();
    final body = lines.skip(1).join('\n').trim();
    return TreeMemoNode(
      id: memo.memoId,
      title: title,
      content: body,
      parentId: tags['parent']?.isEmpty == true ? null : tags['parent'],
      level: int.tryParse(tags['level'] ?? '1') ?? 1,
    );
  }
}

Map<String, String> _parseTags(String? raw) {
  final result = <String, String>{};
  for (final part in (raw ?? '').split(';')) {
    final index = part.indexOf('=');
    if (index <= 0) continue;
    result[part.substring(0, index)] = part.substring(index + 1);
  }
  return result;
}

class _TreeMemoTile extends ConsumerWidget {
  final TreeMemoNode node;
  final List<TreeMemoNode> allNodes;

  const _TreeMemoTile({required this.node, required this.allNodes});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = allNodes.where((n) => n.parentId == node.id).toList();
    final indent = (node.level - 1) * 16.0;
    final addParent = _resolveAddParent(node, allNodes);
    final addLevel = _resolveNextLevel(addParent);

    return Padding(
      padding: EdgeInsets.only(left: indent, bottom: 8),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: ExpansionTile(
          initiallyExpanded: node.level < 3,
          tilePadding: const EdgeInsets.symmetric(horizontal: 12),
          childrenPadding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
          leading: Icon(
            node.level == 1
                ? Icons.folder_outlined
                : node.level == 2
                    ? Icons.note_outlined
                    : Icons.notes,
            color: const Color(0xFF2563EB),
          ),
          title: InkWell(
            onTap: () => _showTreeMemoDialog(
              context,
              ref,
              editingNode: node,
            ),
            child: Text(
              node.title,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF111827),
              ),
            ),
          ),
          subtitle: node.content.isEmpty
              ? null
              : Text(
                  node.content,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip: '${_treeMemoKind(addLevel)} 추가',
                icon: const Icon(Icons.add, size: 18),
                onPressed: addParent == null && node.level >= 3
                    ? null
                    : () => _showTreeMemoDialog(context, ref, parent: addParent),
              ),
              IconButton(
                tooltip: children.isEmpty ? '삭제' : '하위 메모가 있어 삭제 불가',
                icon: Icon(
                  Icons.delete_outline,
                  size: 18,
                  color: children.isEmpty
                      ? const Color(0xFF9CA3AF)
                      : const Color(0xFFD1D5DB),
                ),
                onPressed: children.isEmpty
                    ? () => _confirmDeleteTreeMemo(context, ref, node)
                    : null,
              ),
            ],
          ),
          children: children
              .map((child) => _TreeMemoTile(node: child, allNodes: allNodes))
              .toList(),
        ),
      ),
    );
  }
}

TreeMemoNode? _resolveAddParent(
  TreeMemoNode node,
  List<TreeMemoNode> allNodes,
) {
  if (node.level <= 2) return node;
  for (final candidate in allNodes) {
    if (candidate.id == node.parentId) return candidate;
  }
  return null;
}

int _resolveNextLevel(TreeMemoNode? parent, {TreeMemoNode? editingNode}) {
  if (editingNode != null) return editingNode.level;
  if (parent == null) return 1;
  return parent.level >= 2 ? 3 : parent.level + 1;
}

String _treeMemoKind(int level) {
  if (level <= 1) return '부모메모';
  if (level == 2) return '자식메모';
  return '손자메모';
}

Future<void> _showTreeMemoDialog(
  BuildContext context,
  WidgetRef ref,
  {TreeMemoNode? parent, TreeMemoNode? editingNode}
) async {
  final titleCtrl = TextEditingController(text: editingNode?.title ?? '');
  final bodyCtrl = TextEditingController(text: editingNode?.content ?? '');
  final speech = SpeechToText();
  final level = _resolveNextLevel(parent, editingNode: editingNode);
  final memoKind = _treeMemoKind(level);
  bool isListening = false;
  String voiceInputMode = 'realtime';

  if (level > 3) return;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDialogState) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
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
              const SizedBox(height: 16),
              Text(
                editingNode == null ? '$memoKind 추가' : '$memoKind 편집',
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: titleCtrl,
                decoration: InputDecoration(
                  labelText: '$memoKind 제목',
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                height: 260,
                decoration: BoxDecoration(
                  color: const Color(0xFFF9FAFB),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: TextField(
                  controller: bodyCtrl,
                  maxLines: null,
                  expands: true,
                  textAlignVertical: TextAlignVertical.top,
                  decoration: InputDecoration(
                    hintText: '$memoKind 내용을 입력하세요.',
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.all(14),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _TreeVoiceModeButton(
                      icon: Icons.graphic_eq,
                      label: '실시간 변환',
                      selected: voiceInputMode == 'realtime',
                      onTap: () => setDialogState(() {
                        voiceInputMode = 'realtime';
                      }),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _TreeVoiceModeButton(
                      icon: Icons.fiber_manual_record,
                      label: '녹음 후 변환',
                      selected: voiceInputMode == 'record_then_transcribe',
                      onTap: () => setDialogState(() {
                        voiceInputMode = 'record_then_transcribe';
                      }),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    if (isListening) {
                      await speech.stop();
                      setDialogState(() => isListening = false);
                      return;
                    }
                    final available = await speech.initialize();
                    if (!available) return;
                    setDialogState(() => isListening = true);
                    await speech.listen(
                      localeId: 'ko_KR',
                      onResult: (result) {
                        bodyCtrl.text = result.recognizedWords;
                        bodyCtrl.selection = TextSelection.fromPosition(
                          TextPosition(offset: bodyCtrl.text.length),
                        );
                        if (result.finalResult) {
                          setDialogState(() => isListening = false);
                        }
                      },
                    );
                  },
                  icon: Icon(isListening ? Icons.mic : Icons.mic_none, size: 18),
                  label: Text(isListening ? '듣는 중' : '음성으로 입력'),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        await speech.stop();
                        if (ctx.mounted) Navigator.pop(ctx);
                      },
                      child: const Text('취소'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        await speech.stop();
                        final title = titleCtrl.text.trim();
                        if (title.isEmpty) return;
                        final db = ref.read(appDatabaseProvider);
                        final now = DateTime.now();
                        final content = '$title\n${bodyCtrl.text.trim()}';
                        final tags =
                            'kind=tree;parent=${parent?.id ?? editingNode?.parentId ?? ''};level=$level;voiceMode=$voiceInputMode';
                        if (editingNode == null) {
                          final id = now.microsecondsSinceEpoch.toString();
                          await db.into(db.memos).insert(
                                MemosCompanion.insert(
                                  memoId: id,
                                  userId: 'local_user',
                                  content: content,
                                  tags: Value(tags),
                                  source: const Value('note_tree'),
                                  createdAt: Value(now),
                                  updatedAt: Value(now),
                                ),
                              );
                        } else {
                          await (db.update(db.memos)
                                ..where((m) => m.memoId.equals(editingNode.id)))
                              .write(MemosCompanion(
                            content: Value(content),
                            tags: Value(tags),
                            updatedAt: Value(now),
                          ));
                        }
                        ref.invalidate(treeMemosProvider);
                        if (ctx.mounted) Navigator.pop(ctx);
                      },
                      child: const Text('저장'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

Future<void> _confirmDeleteTreeMemo(
  BuildContext context,
  WidgetRef ref,
  TreeMemoNode node,
) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text('${_treeMemoKind(node.level)} 삭제'),
      content: Text('"${node.title}" 메모를 삭제할까요?'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('취소'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFFDC2626),
          ),
          child: const Text('삭제'),
        ),
      ],
    ),
  );

  if (confirmed != true) return;
  final db = ref.read(appDatabaseProvider);
  await (db.delete(db.memos)..where((m) => m.memoId.equals(node.id))).go();
  ref.invalidate(treeMemosProvider);
}

class _TreeVoiceModeButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _TreeVoiceModeButton({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16),
      label: Text(label, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(
        foregroundColor:
            selected ? const Color(0xFF2563EB) : const Color(0xFF6B7280),
        backgroundColor: selected ? const Color(0xFFEFF6FF) : Colors.white,
        side: BorderSide(
          color: selected ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB),
        ),
        minimumSize: const Size(0, 44),
      ),
    );
  }
}
