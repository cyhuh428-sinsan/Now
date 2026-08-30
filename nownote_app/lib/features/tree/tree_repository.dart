import 'dart:convert';

import 'package:drift/drift.dart' hide Column;
import 'package:now_core/now_core.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

/// 계층 메모가 지킬 수 있는 최대 깊이.
///
/// 서버 capability `MAX_TREE_NOTE_LEVEL`과 같은 값이다(`server/app/core/capabilities.py`).
/// 이번 작업은 서버를 연결하지 않으므로 로컬에서 같은 상수로 지킨다.
const int kMaxTreeMemoLevel = 3;

/// 3단계를 넘는 위치에 새 항목을 추가하려 할 때 던진다.
class TreeMemoLevelLimitExceeded implements Exception {
  const TreeMemoLevelLimitExceeded(this.attemptedLevel);

  final int attemptedLevel;

  @override
  String toString() =>
      '계층 메모는 최대 $kMaxTreeMemoLevel단계까지만 만들 수 있습니다. (시도한 깊이: $attemptedLevel)';
}

/// 계층 메모(`Memos`, `source='note_tree'`) 저장/조회/삭제 대기 처리.
///
/// 화면 위젯을 갖지 않는다. `now_core`의 `TreeMemoNode`, `parseNoteTags`,
/// `buildTreeMemoTags`, `buildDeletedTreeMemoEntry`를 그대로 쓴다.
///
/// 삭제 대기 저장소(SharedPreferences)는 이 저장소가 앱마다 다를 수 있다는
/// `now_core`의 판단(`deleted_tree_memo.dart` 문서 주석, `now_app`의
/// `server_sync_service.dart` 구현)을 따라 이 클래스가 직접 갖는다.
class TreeMemoRepository {
  TreeMemoRepository(this._db);

  final NoteDatabase _db;

  static const String _deletedTreeMemosPrefsKey =
      'nownote_deleted_tree_memos';

  /// 계층 메모 전체를 오래된 순으로 읽는다.
  ///
  /// 오래된 순으로 읽어 두면 화면에서 형제 목록을 만들 때 만든 순서를
  /// 그대로 보여줄 수 있다(정렬 컬럼이 없으므로 생성 시각이 곧 순서다).
  Future<List<TreeMemoNode>> loadNodes() async {
    final rows = await (_db.select(_db.memos)
          ..where((m) => m.source.equals('note_tree'))
          ..orderBy([(m) => OrderingTerm.asc(m.createdAt)]))
        .get();
    return rows.map(TreeMemoNode.fromMemo).toList();
  }

  /// [parent] 아래에 새로 만들 항목이 가질 레벨.
  int nextLevelFor(TreeMemoNode? parent) {
    if (parent == null) return 1;
    return parent.level + 1;
  }

  /// [parent] 아래에 새 항목을 추가할 수 있는지.
  bool canAddChild(TreeMemoNode? parent) {
    if (parent == null) return true;
    return parent.level < kMaxTreeMemoLevel;
  }

  /// 새 계층 메모를 만든다.
  ///
  /// [parent]가 이미 3단계(레벨 $kMaxTreeMemoLevel)면
  /// [TreeMemoLevelLimitExceeded]를 던지고 아무것도 저장하지 않는다.
  Future<TreeMemoNode> addMemo({
    required String title,
    String body = '',
    TreeMemoNode? parent,
    String? voiceMode,
  }) async {
    final level = nextLevelFor(parent);
    if (!canAddChild(parent)) {
      throw TreeMemoLevelLimitExceeded(level);
    }

    final resolvedTitle = noteTitleOrFallback(title);
    final now = DateTime.now();
    // 시계 분해도(특히 Windows)가 빠른 연속 호출을 구분하지 못해
    // microsecondsSinceEpoch만 쓰면 테스트에서 실제로 충돌했다. uuid로 바꾼다.
    final memoId = const Uuid().v4();
    final content = joinNoteContent(
      title: resolvedTitle,
      body: body.trim(),
    );
    final tags = buildTreeMemoTags(
      parentId: parent?.id,
      level: level,
      voiceMode: voiceMode,
    );

    await _db.into(_db.memos).insert(
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

    return TreeMemoNode(
      id: memoId,
      title: resolvedTitle,
      content: body.trim(),
      parentId: parent?.id,
      level: level,
      tags: tags,
    );
  }

  /// 제목만 바꾼다. 본문과 태그(부모/레벨)는 그대로 둔다.
  Future<void> renameMemo(TreeMemoNode node, String newTitle) async {
    final title = noteTitleOrFallback(newTitle, fallback: node.title);
    final content = joinNoteContent(title: title, body: node.content);
    await (_db.update(_db.memos)..where((m) => m.memoId.equals(node.id)))
        .write(
      MemosCompanion(
        content: Value(content),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  /// 본문 전체를 [body]로 바꿔 저장한다. 제목은 그대로 둔다.
  ///
  /// 암호화/복호화한 결과를 저장할 때 쓴다(암호화 시 [body]는 암호문,
  /// 복호화 해제 시 [body]는 평문). `renameMemo`와 반대로 본문만 바꾼다.
  Future<void> saveBody(TreeMemoNode node, String body) async {
    final content = joinNoteContent(title: node.title, body: body);
    await (_db.update(_db.memos)..where((m) => m.memoId.equals(node.id)))
        .write(
      MemosCompanion(
        content: Value(content),
        updatedAt: Value(DateTime.now()),
      ),
    );
  }

  /// [node]와 그 아래 모든 하위 항목을 삭제 대기로 옮긴다.
  ///
  /// 바로 지우지 않는다는 규칙은 이미 `now_core`(`buildDeletedTreeMemoEntry`)가
  /// 갖고 있다. 여기서는 대상 각각을 삭제 대기 저장소에 기록하고 나서
  /// `Memos` 행을 지운다. [allNodes]는 하위 항목을 찾기 위한 현재 전체 목록이다.
  Future<void> deleteMemo(
    TreeMemoNode node,
    List<TreeMemoNode> allNodes,
  ) async {
    final targets = _collectWithDescendants(node, allNodes);
    if (targets.isEmpty) return;

    final now = DateTime.now();
    final prefs = await SharedPreferences.getInstance();
    final pending = await _loadPendingDeleted(prefs);
    for (final target in targets) {
      pending[target.id] = buildDeletedTreeMemoEntry(
        deletedAt: now,
        level: target.level,
        parentLocalId: target.parentId,
        tags: target.tags,
        title: target.title,
        content: target.content,
      );
    }
    await prefs.setString(_deletedTreeMemosPrefsKey, jsonEncode(pending));

    for (final target in targets) {
      await (_db.delete(_db.memos)..where((m) => m.memoId.equals(target.id)))
          .go();
    }
  }

  /// 삭제 대기 중인 항목을 읽는다. 화면과 테스트가 처리 결과를 확인할 때 쓴다.
  Future<Map<String, Map<String, dynamic>>> loadPendingDeleted() async {
    final prefs = await SharedPreferences.getInstance();
    return _loadPendingDeleted(prefs);
  }

  List<TreeMemoNode> _collectWithDescendants(
    TreeMemoNode node,
    List<TreeMemoNode> allNodes,
  ) {
    final result = <TreeMemoNode>[node];
    final queue = <String>[node.id];
    while (queue.isNotEmpty) {
      final parentId = queue.removeLast();
      for (final candidate in allNodes) {
        if (candidate.parentId == parentId) {
          result.add(candidate);
          queue.add(candidate.id);
        }
      }
    }
    return result;
  }

  Future<Map<String, Map<String, dynamic>>> _loadPendingDeleted(
    SharedPreferences prefs,
  ) async {
    final raw = prefs.getString(_deletedTreeMemosPrefsKey);
    if (raw == null || raw.isEmpty) return {};
    return normalizeDeletedTreeMemos(jsonDecode(raw));
  }
}
