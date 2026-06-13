import 'dart:io';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_sound/flutter_sound.dart';
import 'package:path_provider/path_provider.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/database/app_database.dart';
import '../../services/note_encryption_service.dart';
import '../../services/server_sync_service.dart';
import '../../llm/services/llm_settings_service.dart';
import '../../repositories/repository_providers.dart';

class TreeDeletedMemo {
  final String memoId;
  final String title;
  final String content;
  final int level;
  final String? parentLocalId;
  final String? tags;
  final DateTime deletedAt;

  const TreeDeletedMemo({
    required this.memoId,
    required this.title,
    required this.content,
    required this.level,
    this.parentLocalId,
    this.tags,
    required this.deletedAt,
  });
}

final treeMemosProvider = FutureProvider.autoDispose<List<Memo>>((ref) async {
  final db = ref.watch(appDatabaseProvider);
  return (db.select(db.memos)
        ..where((m) => m.source.equals('note_tree'))
        ..orderBy([(m) => OrderingTerm.asc(m.createdAt)]))
      .get();
});

final treeDeletedMemosProvider =
    FutureProvider.autoDispose<List<TreeDeletedMemo>>((ref) async {
      final syncService = ref.watch(serverSyncServiceProvider);
      final entries = await syncService.getDeletedTreeMemoPendings();
      final list = entries.entries.map((entry) {
        final value = entry.value;
        return TreeDeletedMemo(
          memoId: entry.key,
          title: value['title']?.toString() ?? '삭제된 메모',
          content: value['content']?.toString() ?? '',
          level: int.tryParse(value['level']?.toString() ?? '1') ?? 1,
          parentLocalId: value['parent_local_id']?.toString(),
          tags: value['tags']?.toString(),
          deletedAt:
              DateTime.tryParse(value['deleted_at']?.toString() ?? '') ??
              DateTime.now(),
        );
      }).toList()..sort((a, b) => b.deletedAt.compareTo(a.deletedAt));
      return list;
    });

class MemoTreePage extends ConsumerStatefulWidget {
  const MemoTreePage({super.key});

  @override
  ConsumerState<MemoTreePage> createState() => _MemoTreePageState();
}

class _MemoTreePageState extends ConsumerState<MemoTreePage> {
  bool _showDeleted = false;
  final Set<String> _selectedDeletedIds = {};
  final Map<String, String> _unlockedEncryptedContents = {};
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  int _deletedMemoCount(AsyncValue<List<TreeDeletedMemo>> async) {
    if (async is AsyncData<List<TreeDeletedMemo>>) {
      return async.value.length;
    }
    return 0;
  }

  void _clearDeletedSelection() {
    if (_selectedDeletedIds.isNotEmpty) {
      setState(() => _selectedDeletedIds.clear());
    }
  }

  void _toggleDeletedSelection(String memoId) {
    setState(() {
      if (_selectedDeletedIds.contains(memoId)) {
        _selectedDeletedIds.remove(memoId);
      } else {
        _selectedDeletedIds.add(memoId);
      }
    });
  }

  String _formatDateTime(DateTime value) {
    final y = value.year.toString().padLeft(4, '0');
    final m = value.month.toString().padLeft(2, '0');
    final d = value.day.toString().padLeft(2, '0');
    final hh = value.hour.toString().padLeft(2, '0');
    final mm = value.minute.toString().padLeft(2, '0');
    return '$y.$m.$d $hh:$mm';
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

  Future<void> _saveTreeMemoBody(TreeMemoNode node, String body) async {
    final db = ref.read(appDatabaseProvider);
    await (db.update(db.memos)..where((m) => m.memoId.equals(node.id))).write(
      MemosCompanion(
        content: Value('${node.title}\n$body'),
        updatedAt: Value(DateTime.now()),
      ),
    );
    ref.invalidate(treeMemosProvider);
    await _syncTreeMemosIfConfigured();
  }

  Future<void> _syncTreeMemosIfConfigured() async {
    final settings = await ServerSettings.load();
    if (!settings.enabled || !settings.isConfigured) return;
    try {
      await ref.read(serverSyncServiceProvider).syncNotes(settings);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로컬 저장 완료. 서버 동기화는 나중에 다시 시도하세요.')),
      );
    }
  }

  Future<void> _unlockTreeMemo(TreeMemoNode node) async {
    final key = await _requestEncryptionKey(
      title: '복호화',
      message: '이 메모를 잠시 열어볼 암호 키를 입력하세요.',
    );
    if (key == null) return;
    try {
      final plain = await NoteEncryptionService().decrypt(node.content, key);
      if (!mounted) return;
      setState(() {
        _unlockedEncryptedContents[node.id] = plain;
      });
      _showTreeMemoContentSheet(
        context,
        ref,
        node,
        plain,
        editable: false,
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('메모를 복호화했습니다.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('복호화 실패: 암호 키를 확인하세요.'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    }
  }

  void _lockTreeMemo(TreeMemoNode node) {
    setState(() {
      _unlockedEncryptedContents.remove(node.id);
    });
  }

  Future<void> _removeTreeMemoEncryption(TreeMemoNode node) async {
    var plain = _unlockedEncryptedContents[node.id];
    if (plain == null) {
      final key = await _requestEncryptionKey(
        title: '암호화 해제',
        message: '평문으로 저장하려면 암호 키를 입력하세요.',
      );
      if (key == null) return;
      try {
        plain = await NoteEncryptionService().decrypt(node.content, key);
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('암호화 해제 실패: 암호 키를 확인하세요.'),
            backgroundColor: Color(0xFFEF4444),
          ),
        );
        return;
      }
    }
    if (plain == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('암호화 해제'),
        content: const Text('이 메모를 평문으로 저장할까요? 서버와 동기화되면 서버에도 평문으로 저장됩니다.'),
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
    await _saveTreeMemoBody(node, plain);
    _unlockedEncryptedContents.remove(node.id);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('암호화를 해제하고 평문으로 저장했습니다.')),
    );
  }

  Future<void> _encryptTreeMemo(TreeMemoNode node) async {
    if (node.content.trim().isEmpty) return;
    final key = await _requestEncryptionKey(
      title: '암호화',
      message: '이 메모를 암호화할 키를 입력하세요. 키를 잊으면 복구할 수 없습니다.',
    );
    if (key == null) return;
    try {
      final encrypted = await NoteEncryptionService().encrypt(node.content, key);
      await _saveTreeMemoBody(node, encrypted);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('메모를 암호화했습니다.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('암호화 실패: $e'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  Future<void> _deleteSelectedDeletedMemos() async {
    if (_selectedDeletedIds.isEmpty) return;
    if (!mounted) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('선택한 메모 영구삭제'),
        content: Text('선택한 ${_selectedDeletedIds.length}개 메모를 영구삭제하시겠습니까?'),
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
    if (confirm != true) return;

    final db = ref.read(appDatabaseProvider);
    final syncService = ref.read(serverSyncServiceProvider);
    await (db.delete(
      db.memos,
    )..where((t) => t.memoId.isIn(_selectedDeletedIds.toList()))).go();
    await syncService.clearDeletedTreeMemoPendings(_selectedDeletedIds);
    ref.invalidate(treeDeletedMemosProvider);
    ref.invalidate(treeMemosProvider);
    _clearDeletedSelection();
  }

  Future<void> _deleteAllDeletedMemos() async {
    final items = await ref.read(treeDeletedMemosProvider.future);
    if (items.isEmpty) return;
    if (!mounted) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('삭제 보관함 비우기'),
        content: Text('삭제 보관함의 ${items.length}개 항목을 모두 영구삭제할까요?'),
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
    if (confirm != true) return;

    final db = ref.read(appDatabaseProvider);
    final syncService = ref.read(serverSyncServiceProvider);
    final ids = items.map((item) => item.memoId).toList();
    await (db.delete(db.memos)..where((t) => t.memoId.isIn(ids))).go();
    await syncService.clearAllDeletedTreeMemoPendings();
    ref.invalidate(treeDeletedMemosProvider);
    ref.invalidate(treeMemosProvider);
    _clearDeletedSelection();
  }

  Future<void> _deleteSingleDeletedMemo(String memoId) async {
    if (!mounted) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('영구삭제'),
        content: const Text('이 항목을 삭제 보관함에서 영구삭제할까요?'),
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
    if (confirm != true) return;

    final db = ref.read(appDatabaseProvider);
    final syncService = ref.read(serverSyncServiceProvider);
    await (db.delete(db.memos)..where((t) => t.memoId.equals(memoId))).go();
    await syncService.clearDeletedTreeMemoPendings({memoId});
    ref.invalidate(treeDeletedMemosProvider);
    ref.invalidate(treeMemosProvider);
    _selectedDeletedIds.remove(memoId);
  }

  Future<void> _restoreSingleDeletedMemo(String memoId) async {
    if (!mounted) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('메모 복원'),
        content: const Text('이 항목을 복원할까요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
            ),
            child: const Text('복원'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final syncService = ref.read(serverSyncServiceProvider);
    final pendingMap = await syncService.getDeletedTreeMemoPendings();
    final db = ref.read(appDatabaseProvider);
    final restored = await _restoreDeletedMemoFromPending(
      pendingMap: pendingMap,
      memoId: memoId,
      db: db,
      now: DateTime.now(),
    );
    if (!restored) return;

    await syncService.clearDeletedTreeMemoPendings({memoId});
    ref.invalidate(treeDeletedMemosProvider);
    ref.invalidate(treeMemosProvider);
    _selectedDeletedIds.remove(memoId);
  }

  Future<bool> _restoreDeletedMemoFromPending({
    required Map<String, Map<String, dynamic>> pendingMap,
    required String memoId,
    required AppDatabase db,
    required DateTime now,
  }) async {
    final data = pendingMap[memoId];
    if (data == null) return false;

    final title = data['title']?.toString() ?? '';
    final content = data['content']?.toString() ?? '';
    final tags = data['tags']?.toString() ?? '';
    final fullContent = (content.trim().isEmpty ? title : content).trim();

    await db
        .into(db.memos)
        .insert(
          MemosCompanion.insert(
            memoId: memoId,
            userId: 'local_user',
            content: fullContent,
            tags: Value(tags),
            source: const Value('note_tree'),
            createdAt: Value(now),
            updatedAt: Value(now),
          ),
          mode: InsertMode.replace,
        );
    return true;
  }

  Future<void> _restoreSelectedDeletedMemos() async {
    if (_selectedDeletedIds.isEmpty) return;
    if (!mounted) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('선택한 메모 복원'),
        content: Text('선택한 ${_selectedDeletedIds.length}개 메모를 복원할까요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
            ),
            child: const Text('복원'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final syncService = ref.read(serverSyncServiceProvider);
    final pendingMap = await syncService.getDeletedTreeMemoPendings();
    final db = ref.read(appDatabaseProvider);
    final now = DateTime.now();
    final selectedIds = _selectedDeletedIds.toList()
      ..sort((a, b) {
        final aLevel =
            int.tryParse(pendingMap[a]?['level']?.toString() ?? '1') ?? 1;
        final bLevel =
            int.tryParse(pendingMap[b]?['level']?.toString() ?? '1') ?? 1;
        final levelCmp = aLevel.compareTo(bLevel);
        return levelCmp != 0 ? levelCmp : a.compareTo(b);
      });

    final restoredIds = <String>{};
    for (final memoId in selectedIds) {
      final restored = await _restoreDeletedMemoFromPending(
        pendingMap: pendingMap,
        memoId: memoId,
        db: db,
        now: now,
      );
      if (restored) restoredIds.add(memoId);
    }

    if (restoredIds.isNotEmpty) {
      await syncService.clearDeletedTreeMemoPendings(restoredIds);
    }
    ref.invalidate(treeDeletedMemosProvider);
    ref.invalidate(treeMemosProvider);
    _clearDeletedSelection();
  }

  Future<void> _restoreAllDeletedMemos() async {
    final items = await ref.read(treeDeletedMemosProvider.future);
    if (items.isEmpty) return;
    if (!mounted) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('전체 복원'),
        content: Text('삭제 보관함의 ${items.length}개 항목을 모두 복원할까요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
            ),
            child: const Text('복원'),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    final syncService = ref.read(serverSyncServiceProvider);
    final pendingMap = await syncService.getDeletedTreeMemoPendings();
    final db = ref.read(appDatabaseProvider);
    final now = DateTime.now();
    final restoredIds = <String>{};
    final orderedIds = items.map((item) => item.memoId).toList()
      ..sort((a, b) {
        final aLevel =
            int.tryParse(pendingMap[a]?['level']?.toString() ?? '1') ?? 1;
        final bLevel =
            int.tryParse(pendingMap[b]?['level']?.toString() ?? '1') ?? 1;
        final levelCmp = aLevel.compareTo(bLevel);
        return levelCmp != 0 ? levelCmp : a.compareTo(b);
      });

    for (final memoId in orderedIds) {
      final restored = await _restoreDeletedMemoFromPending(
        pendingMap: pendingMap,
        memoId: memoId,
        db: db,
        now: now,
      );
      if (restored) restoredIds.add(memoId);
    }

    if (restoredIds.isNotEmpty) {
      await syncService.clearDeletedTreeMemoPendings(restoredIds);
    }
    ref.invalidate(treeDeletedMemosProvider);
    ref.invalidate(treeMemosProvider);
    _clearDeletedSelection();
  }

  List<TreeMemoNode> _filterTreeNodes(List<TreeMemoNode> nodes) {
    final query = _searchQuery.trim().toLowerCase();
    if (query.isEmpty) return nodes;

    final byId = {for (final node in nodes) node.id: node};
    final childrenByParent = <String, List<TreeMemoNode>>{};
    for (final node in nodes) {
      final parentId = node.parentId;
      if (parentId == null) continue;
      childrenByParent.putIfAbsent(parentId, () => []).add(node);
    }

    bool matches(TreeMemoNode node) {
      final unlocked = _unlockedEncryptedContents[node.id];
      final searchableContent = node.isEncrypted
          ? unlocked ?? ''
          : node.content;
      return node.title.toLowerCase().contains(query) ||
          searchableContent.toLowerCase().contains(query);
    }

    final visibleIds = <String>{};
    void includeAncestors(TreeMemoNode node) {
      var current = node;
      while (current.parentId != null) {
        final parent = byId[current.parentId];
        if (parent == null || !visibleIds.add(parent.id)) break;
        current = parent;
      }
    }

    void includeDescendants(TreeMemoNode node) {
      for (final child in childrenByParent[node.id] ?? const <TreeMemoNode>[]) {
        if (visibleIds.add(child.id)) {
          includeDescendants(child);
        }
      }
    }

    for (final node in nodes) {
      if (!matches(node)) continue;
      visibleIds.add(node.id);
      includeAncestors(node);
      includeDescendants(node);
    }

    return nodes.where((node) => visibleIds.contains(node.id)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final memosAsync = ref.watch(treeMemosProvider);
    final deletedAsync = ref.watch(treeDeletedMemosProvider);

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
        actions: [
          if (_showDeleted && _selectedDeletedIds.isNotEmpty)
            IconButton(
              tooltip: '선택 복원',
              icon: const Icon(Icons.restore),
              onPressed: _restoreSelectedDeletedMemos,
            ),
          if (_showDeleted && _selectedDeletedIds.isNotEmpty)
            IconButton(
              tooltip: '선택 삭제',
              icon: const Icon(Icons.delete),
              onPressed: _deleteSelectedDeletedMemos,
            ),
          if (_showDeleted &&
              _selectedDeletedIds.isEmpty &&
              _deletedMemoCount(deletedAsync) > 0)
            IconButton(
              tooltip: '전체 복원',
              icon: const Icon(Icons.restore_from_trash),
              onPressed: _restoreAllDeletedMemos,
            ),
          if (_showDeleted &&
              _selectedDeletedIds.isEmpty &&
              _deletedMemoCount(deletedAsync) > 0)
            IconButton(
              tooltip: '전체 삭제',
              icon: const Icon(Icons.delete_sweep),
              onPressed: _deleteAllDeletedMemos,
            ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: Column(
          children: [
            ToggleButtons(
              isSelected: [!_showDeleted, _showDeleted],
              onPressed: (index) {
                setState(() {
                  _showDeleted = index == 1;
                  _selectedDeletedIds.clear();
                });
              },
              borderRadius: BorderRadius.circular(12),
              selectedColor: Colors.white,
              fillColor: const Color(0xFF2563EB),
              color: const Color(0xFF374151),
              children: const [
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Text('계층 메모'),
                ),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  child: Text('삭제 보관함'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (!_showDeleted) ...[
              TextField(
                controller: _searchCtrl,
                decoration: InputDecoration(
                  hintText: '목록 제목/본문 검색',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchQuery.isEmpty
                      ? null
                      : IconButton(
                          tooltip: '검색어 지우기',
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            _searchCtrl.clear();
                            setState(() => _searchQuery = '');
                          },
                        ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  isDense: true,
                ),
                textInputAction: TextInputAction.search,
                onChanged: (value) => setState(() => _searchQuery = value),
              ),
              const SizedBox(height: 12),
            ],
            Expanded(
              child: _showDeleted
                  ? deletedAsync.when(
                      data: (items) {
                        if (items.isEmpty) {
                          return const Center(
                            child: Text(
                              '삭제 보관함이 비어있습니다',
                              style: TextStyle(
                                fontSize: 14,
                                color: Color(0xFF9CA3AF),
                              ),
                            ),
                          );
                        }
                        return ListView.separated(
                          padding: const EdgeInsets.only(bottom: 100),
                          itemCount: items.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (ctx, index) {
                            final item = items[index];
                            final isChecked = _selectedDeletedIds.contains(
                              item.memoId,
                            );
                            return Card(
                              child: ListTile(
                                leading: Checkbox(
                                  value: isChecked,
                                  onChanged: (_) {
                                    _toggleDeletedSelection(item.memoId);
                                  },
                                ),
                                title: Text(item.title),
                                subtitle: Text(
                                  '${_treeMemoKind(item.level)} · 삭제 시각 ${_formatDateTime(item.deletedAt)}',
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      icon: const Icon(Icons.restore),
                                      tooltip: '복원',
                                      onPressed: () =>
                                          _restoreSingleDeletedMemo(
                                            item.memoId,
                                          ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_forever),
                                      tooltip: '영구 삭제',
                                      onPressed: () =>
                                          _deleteSingleDeletedMemo(item.memoId),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        );
                      },
                      loading: () =>
                          const Center(child: CircularProgressIndicator()),
                      error: (e, _) => Center(child: Text('오류: $e')),
                    )
                  : memosAsync.when(
                      data: (memos) {
                        final nodes = memos.map(TreeMemoNode.fromMemo).toList();
                        final visibleNodes = _filterTreeNodes(nodes);
                        final roots = visibleNodes
                            .where((n) => n.parentId == null)
                            .toList();

                        if (nodes.isEmpty) {
                          return const Center(
                            child: Text(
                              '아직 계층 메모가 없습니다',
                              style: TextStyle(
                                fontSize: 14,
                                color: Color(0xFF9CA3AF),
                              ),
                            ),
                          );
                        }
                        if (roots.isEmpty) {
                          return const Center(
                            child: Text(
                              '검색 결과가 없습니다',
                              style: TextStyle(
                                fontSize: 14,
                                color: Color(0xFF9CA3AF),
                              ),
                            ),
                          );
                        }

                        return ListView(
                          padding: const EdgeInsets.only(bottom: 100),
                          children: roots
                              .map(
                                (node) => _TreeMemoTile(
                                  node: node,
                                  allNodes: visibleNodes,
                                  unlockedContents: _unlockedEncryptedContents,
                                  onUnlock: _unlockTreeMemo,
                                  onLock: _lockTreeMemo,
                                  onRemoveEncryption: _removeTreeMemoEncryption,
                                  onEncrypt: _encryptTreeMemo,
                                ),
                              )
                              .toList(),
                        );
                      },
                      loading: () =>
                          const Center(child: CircularProgressIndicator()),
                      error: (e, _) => Center(child: Text('오류: $e')),
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: _showDeleted
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _showTreeMemoDialog(context, ref),
              backgroundColor: const Color(0xFF2563EB),
              icon: const Icon(Icons.edit_note, color: Colors.white),
              label: const Text(
                '부모메모 추가',
                style: TextStyle(color: Colors.white),
              ),
            ),
    );
  }
}

class TreeMemoNode {
  final String id;
  final String title;
  final String content;
  final String? parentId;
  final int level;
  final String tags;

  const TreeMemoNode({
    required this.id,
    required this.title,
    required this.content,
    required this.parentId,
    required this.level,
    required this.tags,
  });

  bool get isEncrypted => isEncryptedNoteContent(content);
  bool get isShared => _treeMemoTagsContainShared(tags);

  String displayContent(String? unlockedContent) {
    if (!isEncrypted) return content;
    return unlockedContent ?? '암호화된 메모입니다. 복호화 버튼을 눌러 키를 입력하세요.';
  }

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
      tags: memo.tags ?? '',
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

bool _treeMemoTagsContainShared(String rawTags) {
  final parsed = _parseTags(rawTags);
  final candidates = <String>[
    rawTags,
    parsed['serverTags'] ?? '',
    parsed['tags'] ?? '',
  ];
  for (final candidate in candidates) {
    final tokens = candidate
        .toLowerCase()
        .split(RegExp(r'[\s,;=]+'))
        .map((token) => token.trim())
        .where((token) => token.isNotEmpty);
    if (tokens.contains('shared')) return true;
  }
  return false;
}

class _TreeMemoTile extends ConsumerWidget {
  final TreeMemoNode node;
  final List<TreeMemoNode> allNodes;
  final Map<String, String> unlockedContents;
  final Future<void> Function(TreeMemoNode node) onUnlock;
  final void Function(TreeMemoNode node) onLock;
  final Future<void> Function(TreeMemoNode node) onRemoveEncryption;
  final Future<void> Function(TreeMemoNode node) onEncrypt;

  const _TreeMemoTile({
    required this.node,
    required this.allNodes,
    required this.unlockedContents,
    required this.onUnlock,
    required this.onLock,
    required this.onRemoveEncryption,
    required this.onEncrypt,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = allNodes.where((n) => n.parentId == node.id).toList();
    final indent = (node.level - 1) * 8.0;
    final addParent = _resolveAddParent(node);
    final addLevel = addParent == null ? null : _resolveNextLevel(addParent);
    final unlockedContent = unlockedContents[node.id];
    final displayContent = node.displayContent(unlockedContent);
    final isShared = node.isShared;
    final accentColor = isShared
        ? const Color(0xFF059669)
        : const Color(0xFF2563EB);
    final titleColor = isShared
        ? const Color(0xFF047857)
        : const Color(0xFF111827);

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
          tilePadding: const EdgeInsets.symmetric(horizontal: 8),
          childrenPadding: const EdgeInsets.fromLTRB(6, 0, 6, 8),
          minTileHeight: 56,
          visualDensity: const VisualDensity(horizontal: -4, vertical: -2),
          leading: Icon(
            isShared
                ? Icons.folder_shared_outlined
                : node.level == 1
                ? Icons.folder_outlined
                : node.level == 2
                ? Icons.note_outlined
                : Icons.notes,
            color: accentColor,
            size: 22,
          ),
          title: InkWell(
            onTap: () {
              if (node.isEncrypted) {
                if (unlockedContent != null) {
                  _showTreeMemoContentSheet(
                    context,
                    ref,
                    node,
                    unlockedContent,
                    editable: false,
                  );
                  return;
                }
                onUnlock(node);
                return;
              }
              _showTreeMemoContentSheet(
                context,
                ref,
                node,
                displayContent,
                editable: true,
              );
            },
            child: SizedBox(
              width: double.infinity,
              child: Text(
                node.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ).copyWith(color: titleColor),
              ),
            ),
          ),
          subtitle: displayContent.isEmpty
              ? null
              : Text(
                  displayContent,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF6B7280),
                  ),
                ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 20,
                height: 34,
                child: IconButton(
                  tooltip: '열기',
                  icon: const Icon(Icons.open_in_new_outlined, size: 18),
                  constraints: const BoxConstraints.tightFor(
                    width: 20,
                    height: 34,
                  ),
                  padding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                  onPressed: () {
                    if (node.isEncrypted && unlockedContent == null) {
                      onUnlock(node);
                      return;
                    }
                    _showTreeMemoContentSheet(
                      context,
                      ref,
                      node,
                      displayContent,
                      editable: !node.isEncrypted,
                    );
                  },
                ),
              ),
              if (addParent != null && addLevel != null)
                SizedBox(
                  width: 20,
                  height: 34,
                  child: IconButton(
                    tooltip: '${_treeMemoKind(addLevel)} 추가',
                    icon: const Icon(Icons.add, size: 18),
                    constraints: const BoxConstraints.tightFor(
                      width: 20,
                      height: 34,
                    ),
                    padding: EdgeInsets.zero,
                    visualDensity: VisualDensity.compact,
                    onPressed: () =>
                        _showTreeMemoDialog(context, ref, parent: addParent),
                  ),
                ),
              SizedBox(
                width: 20,
                height: 34,
                child: PopupMenuButton<String>(
                  tooltip: '메모 작업',
                  icon: const Icon(Icons.more_vert, size: 20),
                  iconSize: 20,
                  padding: EdgeInsets.zero,
                  onSelected: (value) {
                    switch (value) {
                      case 'unlock':
                        onUnlock(node);
                        break;
                      case 'lock':
                        onLock(node);
                        break;
                      case 'removeEncryption':
                        onRemoveEncryption(node);
                        break;
                      case 'encrypt':
                        onEncrypt(node);
                        break;
                      case 'analysis':
                        _requestTreeMemoAnalysis(context, ref, node);
                        break;
                      case 'delete':
                        _confirmDeleteTreeMemo(context, ref, node);
                        break;
                    }
                  },
                  itemBuilder: (context) => [
                    if (node.isEncrypted)
                      PopupMenuItem(
                        value: unlockedContent == null ? 'unlock' : 'lock',
                        child: Text(unlockedContent == null ? '복호화' : '잠금'),
                      )
                    else
                      const PopupMenuItem(
                        value: 'encrypt',
                        child: Text('암호화'),
                      ),
                    if (node.isEncrypted)
                      const PopupMenuItem(
                        value: 'removeEncryption',
                        child: Text('암호화 해제'),
                      ),
                    if (!node.isEncrypted)
                      const PopupMenuItem(
                        value: 'analysis',
                        child: Text('서버 분석'),
                      ),
                    if (children.isEmpty)
                      const PopupMenuItem(value: 'delete', child: Text('삭제'))
                    else
                      const PopupMenuItem(
                        enabled: false,
                        child: Text('하위 메모가 있어 삭제 불가'),
                      ),
                  ],
                ),
              ),
            ],
          ),
          children: children
              .map(
                (child) => _TreeMemoTile(
                  node: child,
                  allNodes: allNodes,
                  unlockedContents: unlockedContents,
                  onUnlock: onUnlock,
                  onLock: onLock,
                  onRemoveEncryption: onRemoveEncryption,
                  onEncrypt: onEncrypt,
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

Future<void> _showTreeMemoContentSheet(
  BuildContext context,
  WidgetRef ref,
  TreeMemoNode node,
  String content, {
  required bool editable,
}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => _TreeMemoContentSheet(
      node: node,
      content: content,
      editable: editable,
      onEdit: () {
        Navigator.pop(ctx);
        _showTreeMemoDialog(context, ref, editingNode: node);
      },
    ),
  );
}

class _TreeMemoContentSheet extends StatefulWidget {
  final TreeMemoNode node;
  final String content;
  final bool editable;
  final VoidCallback onEdit;

  const _TreeMemoContentSheet({
    required this.node,
    required this.content,
    required this.editable,
    required this.onEdit,
  });

  @override
  State<_TreeMemoContentSheet> createState() => _TreeMemoContentSheetState();
}

class _TreeMemoContentSheetState extends State<_TreeMemoContentSheet> {
  final TextEditingController _findCtrl = TextEditingController();
  String _findQuery = '';

  @override
  void dispose() {
    _findCtrl.dispose();
    super.dispose();
  }

  int get _matchCount {
    final query = _findQuery.trim();
    if (query.isEmpty) return 0;
    return RegExp(RegExp.escape(query), caseSensitive: false)
        .allMatches(widget.content)
        .length;
  }

  @override
  Widget build(BuildContext context) {
    final matchCount = _matchCount;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.78,
      minChildSize: 0.45,
      maxChildSize: 0.95,
      builder: (ctx, scrollController) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 18),
          child: Column(
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
              Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.node.title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                      ),
                    ),
                  ),
                  if (widget.editable)
                    TextButton.icon(
                      onPressed: widget.onEdit,
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      label: const Text('편집'),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _treeMemoKind(widget.node.level),
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _findCtrl,
                decoration: InputDecoration(
                  hintText: '본문 찾기',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _findQuery.isEmpty
                      ? null
                      : IconButton(
                          tooltip: '검색어 지우기',
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            _findCtrl.clear();
                            setState(() => _findQuery = '');
                          },
                        ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  isDense: true,
                ),
                textInputAction: TextInputAction.search,
                onChanged: (value) => setState(() => _findQuery = value),
              ),
              const SizedBox(height: 6),
              Text(
                _findQuery.trim().isEmpty
                    ? '본문에서 단어를 찾습니다'
                    : '찾은 단어 $matchCount개',
                style: TextStyle(
                  fontSize: 12,
                  color: matchCount == 0 && _findQuery.trim().isNotEmpty
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF6B7280),
                ),
              ),
              const Divider(height: 18),
              Expanded(
                child: widget.content.trim().isEmpty
                    ? const Center(
                        child: Text(
                          '메모 내용이 없습니다',
                          style: TextStyle(
                            fontSize: 14,
                            color: Color(0xFF9CA3AF),
                          ),
                        ),
                      )
                    : SingleChildScrollView(
                        controller: scrollController,
                        child: _LinkifiedSelectableText(
                          content: widget.content,
                          highlightQuery: _findQuery,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LinkifiedSelectableText extends StatelessWidget {
  final String content;
  final String highlightQuery;

  const _LinkifiedSelectableText({
    required this.content,
    this.highlightQuery = '',
  });

  @override
  Widget build(BuildContext context) {
    const baseStyle = TextStyle(
      fontSize: 15,
      height: 1.55,
      color: Color(0xFF111827),
    );
    const linkStyle = TextStyle(
      fontSize: 15,
      height: 1.55,
      color: Color(0xFF2563EB),
      decoration: TextDecoration.underline,
    );
    return SelectableText.rich(
      TextSpan(
        style: baseStyle,
        children: _linkifiedMemoSpans(
          content,
          baseStyle,
          linkStyle,
          highlightQuery.trim(),
        ),
      ),
    );
  }
}

List<InlineSpan> _linkifiedMemoSpans(
  String text,
  TextStyle baseStyle,
  TextStyle linkStyle,
  String highlightQuery,
) {
  final pattern = RegExp(
    r'(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})',
    caseSensitive: false,
  );
  final spans = <InlineSpan>[];
  var index = 0;
  for (final match in pattern.allMatches(text)) {
    if (match.start > index) {
      spans.addAll(
        _highlightedMemoSpans(
          text.substring(index, match.start),
          baseStyle,
          highlightQuery,
        ),
      );
    }
    final raw = match.group(0) ?? '';
    final trimmed = raw.replaceFirst(RegExp(r'[.,;:!?]+$'), '');
    final trailing = raw.substring(trimmed.length);
    spans.addAll(
      _highlightedMemoSpans(
        trimmed,
        linkStyle,
        highlightQuery,
        recognizerFactory: () =>
            TapGestureRecognizer()..onTap = () => _openMemoLink(trimmed),
      ),
    );
    if (trailing.isNotEmpty) {
      spans.addAll(_highlightedMemoSpans(trailing, baseStyle, highlightQuery));
    }
    index = match.end;
  }
  if (index < text.length) {
    spans.addAll(
      _highlightedMemoSpans(text.substring(index), baseStyle, highlightQuery),
    );
  }
  return spans;
}

List<TextSpan> _highlightedMemoSpans(
  String text,
  TextStyle style,
  String query, {
  GestureRecognizer Function()? recognizerFactory,
}) {
  if (text.isEmpty) return const [];
  final normalizedQuery = query.trim();
  if (normalizedQuery.isEmpty) {
    return [
      TextSpan(text: text, style: style, recognizer: recognizerFactory?.call()),
    ];
  }

  final matches = RegExp(
    RegExp.escape(normalizedQuery),
    caseSensitive: false,
  ).allMatches(text).toList();
  if (matches.isEmpty) {
    return [
      TextSpan(text: text, style: style, recognizer: recognizerFactory?.call()),
    ];
  }

  final spans = <TextSpan>[];
  var index = 0;
  for (final match in matches) {
    if (match.start > index) {
      spans.add(
        TextSpan(
          text: text.substring(index, match.start),
          style: style,
          recognizer: recognizerFactory?.call(),
        ),
      );
    }
    spans.add(
      TextSpan(
        text: text.substring(match.start, match.end),
        style: style.copyWith(backgroundColor: const Color(0xFFFFF59D)),
        recognizer: recognizerFactory?.call(),
      ),
    );
    index = match.end;
  }
  if (index < text.length) {
    spans.add(
      TextSpan(
        text: text.substring(index),
        style: style,
        recognizer: recognizerFactory?.call(),
      ),
    );
  }
  return spans;
}

Future<void> _openMemoLink(String value) async {
  final target = _normalizeMemoLink(value);
  final uri = Uri.tryParse(target);
  if (uri == null) return;
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

String _normalizeMemoLink(String value) {
  final text = value.trim().replaceFirst(RegExp(r'[.,;:!?]+$'), '');
  final emailPattern = RegExp(
    r'^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$',
    caseSensitive: false,
  );
  if (emailPattern.hasMatch(text)) return 'mailto:$text';
  if (text.startsWith(RegExp(r'https?:\/\/', caseSensitive: false))) return text;
  return 'https://$text';
}

Future<void> _requestTreeMemoAnalysis(
  BuildContext context,
  WidgetRef ref,
  TreeMemoNode node,
) async {
  final settings = await ServerSettings.load();
  if (!settings.enabled || !settings.isConfigured) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('서버 연결을 켠 뒤 분석 작업을 등록할 수 있습니다.')),
    );
    return;
  }

  final inputText = '${node.title}\n${node.content}'.trim();
  if (inputText.isEmpty) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('분석할 메모 내용이 없습니다.')),
    );
    return;
  }

  try {
    final job = await ref.read(serverSyncServiceProvider).createAnalysisJob(
          settings,
          jobType: 'memo_summary',
          noteLocalId: node.id,
          inputText: inputText,
        );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('서버 분석 작업을 등록했습니다. #${job.id}')),
    );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('서버 분석 등록 실패: $e'),
        backgroundColor: const Color(0xFFEF4444),
      ),
    );
  }
}

TreeMemoNode? _resolveAddParent(TreeMemoNode node) {
  if (node.level < 3) return node;
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
  WidgetRef ref, {
  TreeMemoNode? parent,
  TreeMemoNode? editingNode,
}) async {
  final titleCtrl = TextEditingController(text: editingNode?.title ?? '');
  final bodyCtrl = TextEditingController(text: editingNode?.content ?? '');
  final speech = SpeechToText();
  final recorder = FlutterSoundRecorder();
  String? recordingPath;
  String? pendingUploadRecordingPath;
  String pendingUploadTranscript = '';
  final level = _resolveNextLevel(parent, editingNode: editingNode);
  final memoKind = _treeMemoKind(level);
  bool isListening = false;
  bool isTranscribing = false;
  String voiceInputMode = 'realtime';

  if (level > 3) return;

  Future<void> deletePendingUploadFile() async {
    if (pendingUploadRecordingPath == null) return;
    try {
      final file = File(pendingUploadRecordingPath!);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {}
    pendingUploadRecordingPath = null;
    pendingUploadTranscript = '';
  }

  Future<void> stopRecordingIfNeeded() async {
    try {
      if (voiceInputMode == 'record_then_transcribe') {
        await recorder.stopRecorder();
      } else {
        await speech.stop();
      }
    } catch (_) {
      // 음성 입력 세션 정리 실패는 사용자 체감 동작에 직접 영향이 크지 않으므로 무시
    }

    try {
      await recorder.closeRecorder();
    } catch (_) {}

    if (recordingPath != null) {
      try {
        final file = File(recordingPath!);
        if (await file.exists()) {
          await file.delete();
        }
      } catch (_) {}
      recordingPath = null;
    }

    await deletePendingUploadFile();
  }

  Future<void> deleteRecordingFile() async {
    if (recordingPath == null) return;
    try {
      final file = File(recordingPath!);
      if (await file.exists()) {
        await file.delete();
      }
    } catch (_) {}
    recordingPath = null;
  }

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
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
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
                      setDialogState(() {
                        isListening = false;
                        isTranscribing = true;
                      });
                      try {
                        if (voiceInputMode == 'record_then_transcribe') {
                          try {
                            await recorder.stopRecorder();
                            await recorder.closeRecorder();
                          } catch (e) {
                            debugPrint(
                              '[MEMO_TREE_RECORD] recorder stop error: $e',
                            );
                          }

                          if (recordingPath == null) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('녹음 파일을 찾을 수 없습니다.'),
                                ),
                              );
                            }
                          } else {
                            final file = File(recordingPath!);
                            if (!(await file.exists()) ||
                                await file.length() < 1000) {
                              await deleteRecordingFile();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('녹음이 짧아 변환을 생략했어요.'),
                                  ),
                                );
                              }
                            } else {
                              final whisperUrl = await LlmSettingsService()
                                  .loadWhisperUrl();
                              if (whisperUrl.trim().isEmpty) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Whisper 서버 URL이 없으면 녹음 후 변환을 시작할 수 없습니다.',
                                      ),
                                    ),
                                  );
                                }
                              } else {
                                try {
                                  final dio = Dio();
                                  final formData = FormData.fromMap({
                                    'file': await MultipartFile.fromFile(
                                      recordingPath!,
                                      filename: 'memo_tree.aac',
                                    ),
                                  });
                                  final response = await dio.post(
                                    '$whisperUrl/transcribe',
                                    data: formData,
                                    options: Options(
                                      receiveTimeout: const Duration(
                                        seconds: 120,
                                      ),
                                    ),
                                  );
                                  final text =
                                      response.data['text'] as String? ?? '';
                                  final newText = text.trim();
                                  if (newText.isNotEmpty) {
                                    final current = bodyCtrl.text.trim();
                                    bodyCtrl.text = current.isEmpty
                                        ? newText
                                        : '$current\n$newText';
                                    bodyCtrl.selection =
                                        TextSelection.fromPosition(
                                          TextPosition(
                                            offset: bodyCtrl.text.length,
                                          ),
                                        );
                                    await deletePendingUploadFile();
                                    pendingUploadRecordingPath = recordingPath;
                                    pendingUploadTranscript = newText;
                                    recordingPath = null;
                                  }
                                } catch (e) {
                                  debugPrint(
                                    '[MEMO_TREE_RECORD] transcribe error: $e',
                                  );
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('변환 실패: $e')),
                                    );
                                  }
                                }
                              }
                              if (recordingPath != null) {
                                await deleteRecordingFile();
                              }
                            }
                          }
                        } else {
                          await speech.stop();
                        }
                      } finally {
                        if (context.mounted) {
                          setDialogState(() {
                            isListening = false;
                            isTranscribing = false;
                          });
                        }
                      }
                      return;
                    }

                    if (voiceInputMode == 'record_then_transcribe') {
                      try {
                        final dir = await getApplicationDocumentsDirectory();
                        final folder = Directory('${dir.path}/recordings');
                        if (!await folder.exists()) {
                          await folder.create(recursive: true);
                        }
                        recordingPath =
                            '${folder.path}/memo_tree_${DateTime.now().millisecondsSinceEpoch}.aac';
                        await recorder.openRecorder();
                        await recorder.startRecorder(
                          toFile: recordingPath!,
                          codec: Codec.aacADTS,
                          bitRate: 128000,
                          sampleRate: 16000,
                        );
                        setDialogState(() => isListening = true);
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('녹음 시작 실패: $e')),
                          );
                        }
                      }
                      return;
                    }

                    final available = await speech.initialize();
                    if (!available) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('음성 인식 엔진 초기화 실패')),
                        );
                      }
                      return;
                    }
                    setDialogState(() => isListening = true);
                    await speech.listen(
                      localeId: 'ko_KR',
                      onResult: (result) {
                        if (voiceInputMode == 'realtime') {
                          bodyCtrl.text = result.recognizedWords;
                          bodyCtrl.selection = TextSelection.fromPosition(
                            TextPosition(offset: bodyCtrl.text.length),
                          );
                        }
                      },
                    );
                  },
                  icon: Icon(
                    isListening ? Icons.mic : Icons.mic_none,
                    size: 18,
                  ),
                  label: Text(
                    isListening
                        ? (voiceInputMode == 'record_then_transcribe'
                              ? '정지 후 변환'
                              : '듣는 중')
                        : isTranscribing
                        ? '변환 중'
                        : '음성으로 입력',
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () async {
                        if (isTranscribing) return;
                        if (isListening) {
                          if (voiceInputMode == 'record_then_transcribe') {
                            await recorder.stopRecorder();
                            await recorder.closeRecorder();
                            await deleteRecordingFile();
                          } else {
                            await speech.stop();
                          }
                        }
                        if (ctx.mounted) Navigator.pop(ctx);
                      },
                      child: const Text('취소'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () async {
                        if (isTranscribing) return;
                        if (isListening) {
                          if (voiceInputMode == 'record_then_transcribe') {
                            await recorder.stopRecorder();
                            await recorder.closeRecorder();
                            await deleteRecordingFile();
                          } else {
                            await speech.stop();
                          }
                        }
                        final title = titleCtrl.text.trim();
                        if (title.isEmpty) return;
                        final db = ref.read(appDatabaseProvider);
                        final now = DateTime.now();
                        final content = '$title\n${bodyCtrl.text.trim()}';
                        final tags =
                            'kind=tree;parent=${parent?.id ?? editingNode?.parentId ?? ''};level=$level;voiceMode=$voiceInputMode';
                        final memoId =
                            editingNode?.id ??
                            now.microsecondsSinceEpoch.toString();
                        if (editingNode == null) {
                          await db
                              .into(db.memos)
                              .insert(
                                MemosCompanion.insert(
                                  memoId: memoId,
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
                              .write(
                                MemosCompanion(
                                  content: Value(content),
                                  tags: Value(tags),
                                  updatedAt: Value(now),
                                ),
                              );
                        }
                        if (!context.mounted) return;
                        await _uploadTreeRecordingIfConfigured(
                          context,
                          ref,
                          memoId: memoId,
                          audioFilePath: pendingUploadRecordingPath,
                          transcript: pendingUploadTranscript,
                        );
                        await deletePendingUploadFile();
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

  await stopRecordingIfNeeded();
}

Future<void> _uploadTreeRecordingIfConfigured(
  BuildContext context,
  WidgetRef ref, {
  required String memoId,
  required String? audioFilePath,
  required String transcript,
}) async {
  if (audioFilePath == null || transcript.trim().isEmpty) return;

  final settings = await ServerSettings.load();
  if (!settings.enabled || !settings.isConfigured) return;

  final file = File(audioFilePath);
  if (!await file.exists()) return;

  try {
    await ref.read(serverSyncServiceProvider).uploadRecordingFile(
          settings,
          filePath: audioFilePath,
          localId: 'tree_recording_$memoId',
          noteLocalId: memoId,
          transcript: transcript,
        );
  } catch (e) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('계층 메모 녹음 업로드 실패: $e'),
        backgroundColor: const Color(0xFFEF4444),
      ),
    );
  }
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
  final syncService = ref.read(serverSyncServiceProvider);
  await syncService.markTreeMemoDeleted(
    node.id,
    level: node.level,
    parentLocalId: node.parentId,
    tags: node.tags,
    title: node.title,
    content: '${node.title}\n${node.content}',
    deletedAt: DateTime.now(),
  );
  await (db.delete(db.memos)..where((m) => m.memoId.equals(node.id))).go();
  ref.invalidate(treeMemosProvider);
  ref.invalidate(treeDeletedMemosProvider);
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
        foregroundColor: selected
            ? const Color(0xFF2563EB)
            : const Color(0xFF6B7280),
        backgroundColor: selected ? const Color(0xFFEFF6FF) : Colors.white,
        side: BorderSide(
          color: selected ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB),
        ),
        minimumSize: const Size(0, 44),
      ),
    );
  }
}
