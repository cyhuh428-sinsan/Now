/// 메모 태그 문자열 규칙.
///
/// 태그는 `key=value` 쌍을 `;` 로 이어 붙인 한 줄 문자열이다.
/// 예: `kind=tree;parent=1700000000;level=2;voiceMode=realtime`
///
/// Now와 NowNote가 같은 해석을 쓰도록 이 파일 하나만 고친다.
library;

/// 태그 문자열을 key/value 맵으로 읽는다.
///
/// - `;` 로 자르고 각 조각을 첫 `=` 기준으로 나눈다.
/// - `=` 가 없거나 맨 앞에 있는 조각은 버린다.
/// - 같은 키가 여러 번 나오면 뒤에 나온 값이 이긴다.
Map<String, String> parseNoteTags(String? raw) {
  final result = <String, String>{};
  for (final part in (raw ?? '').split(';')) {
    final index = part.indexOf('=');
    if (index <= 0) continue;
    result[part.substring(0, index)] = part.substring(index + 1);
  }
  return result;
}

/// [parseNoteTags] 의 역방향. 맵을 태그 문자열로 되돌린다.
///
/// 맵의 순서를 그대로 따른다.
String buildNoteTags(Map<String, String> tags) {
  return tags.entries.map((entry) => '${entry.key}=${entry.value}').join(';');
}

/// 계층 메모를 새로 쓰거나 고칠 때 붙이는 태그를 만든다.
///
/// [voiceMode] 가 null이면 `voiceMode` 항목을 붙이지 않는다.
String buildTreeMemoTags({
  String? parentId,
  required int level,
  String? voiceMode,
}) {
  final tags = <String, String>{
    'kind': 'tree',
    'parent': parentId ?? '',
    'level': level.toString(),
  };
  if (voiceMode != null) {
    tags['voiceMode'] = voiceMode;
  }
  return buildNoteTags(tags);
}

/// 서버에서 내려온 노트의 태그를 로컬 계층 메모 태그로 맞춘다.
///
/// - 서버 태그가 `key=value` 형식이면 그 맵 위에 kind/parent/level 을 덮어쓴다.
///   (원래 있던 키의 자리는 그대로 두고, 없던 키만 뒤에 붙는다.)
/// - 그렇지 않으면 kind/parent/level 을 새로 만들고, 서버 태그 원문이 있으면
///   `serverTags` 로 보존한다. 이때 `;` 는 구분자와 겹치므로 `,` 로 바꾼다.
String mergeTreeMemoTagsFromServer({
  String? rawTags,
  String? parentLocalId,
  int level = 1,
}) {
  final raw = rawTags?.trim() ?? '';
  final parent = parentLocalId?.trim() ?? '';
  final parsed = parseNoteTags(raw);

  if (parsed.isNotEmpty) {
    parsed['kind'] = 'tree';
    parsed['parent'] = parent;
    parsed['level'] = level.toString();
    return buildNoteTags(parsed);
  }

  final parts = <String>[
    'kind=tree',
    'parent=$parent',
    'level=$level',
  ];
  if (raw.isNotEmpty) {
    parts.add('serverTags=${raw.replaceAll(';', ',')}');
  }
  return parts.join(';');
}

/// 태그가 공유 표시를 담고 있는지 본다.
///
/// 원본 태그, `serverTags` 값, `tags` 값 세 후보를 훑는다.
/// 각 후보는 공백·쉼표·세미콜론·등호로 잘라 `shared` 토큰을 찾는다.
bool noteTagsContainShared(String rawTags) {
  final parsed = parseNoteTags(rawTags);
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
