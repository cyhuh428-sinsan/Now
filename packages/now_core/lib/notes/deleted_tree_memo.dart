/// 삭제 대기 계층 메모의 표현 규칙.
///
/// 삭제한 메모는 서버에 삭제가 전달될 때까지 로컬에 남는다.
/// 여기에는 그 항목의 모양과 읽는 규칙만 둔다.
/// 실제 저장 위치(앱마다 다르다)는 앱 쪽이 갖는다.
library;

/// 제목이 없는 삭제 항목에 쓰는 이름.
const defaultDeletedNoteTitle = '삭제된 메모';

/// 삭제 대기 항목 한 건을 만든다.
Map<String, dynamic> buildDeletedTreeMemoEntry({
  required DateTime deletedAt,
  required int level,
  String? parentLocalId,
  String? tags,
  String? title,
  String? content,
  String source = 'note_tree',
}) {
  return <String, dynamic>{
    'deleted_at': deletedAt.toIso8601String(),
    'level': level,
    'parent_local_id': parentLocalId ?? '',
    'tags': tags ?? '',
    'title': title ?? defaultDeletedNoteTitle,
    'content': content ?? '',
    'source': source,
  };
}

/// 저장소에서 읽어 온 값을 삭제 대기 맵으로 정규화한다.
///
/// - 맵이 아니면 빈 맵.
/// - 키가 비었거나 값이 맵이 아닌 항목은 버린다.
/// - 항목 안의 키는 문자열로 맞춘다. 키가 null인 항목은 버린다.
Map<String, Map<String, dynamic>> normalizeDeletedTreeMemos(Object? decoded) {
  final result = <String, Map<String, dynamic>>{};
  if (decoded is! Map) return result;
  decoded.forEach((key, value) {
    final memoId = key?.toString() ?? '';
    if (memoId.isEmpty || value is! Map) return;
    final item = <String, dynamic>{};
    value.forEach((k, v) {
      if (k != null) {
        item[k.toString()] = v;
      }
    });
    result[memoId] = item;
  });
  return result;
}

/// 삭제 대기 맵에서 주어진 id들을 지운다. 원본을 그대로 고친다.
void removeDeletedTreeMemos(
  Map<String, Map<String, dynamic>> current,
  Set<String> memoIds,
) {
  memoIds.forEach(current.remove);
}
