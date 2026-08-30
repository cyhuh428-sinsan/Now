import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

import '../../shared/note_database_provider.dart';
import 'tree_repository.dart';

export '../../shared/note_database_provider.dart' show noteDatabaseProvider;

final treeMemoRepositoryProvider = Provider<TreeMemoRepository>((ref) {
  return TreeMemoRepository(ref.watch(noteDatabaseProvider));
});

/// 계층 메모 전체 목록. 추가/이름변경/삭제 뒤 `ref.invalidate`로 새로 읽는다.
final treeMemoNodesProvider =
    FutureProvider.autoDispose<List<TreeMemoNode>>((ref) async {
  final repo = ref.watch(treeMemoRepositoryProvider);
  return repo.loadNodes();
});
