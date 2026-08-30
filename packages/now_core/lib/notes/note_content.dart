/// 메모 본문 규칙.
///
/// 메모는 한 덩어리 문자열로 저장한다. 첫 줄이 제목, 나머지가 본문이다.
library;

/// 암호화된 메모 본문 앞에 붙는 표시.
const encryptedNotePrefix = 'NOW_ENCRYPTED_V1:';

/// 제목이 비었을 때 대신 쓰는 이름.
const defaultNoteTitle = '제목 없음';

/// 본문이 암호화된 상태인지 본다.
bool isEncryptedNoteContent(String? content) {
  return (content ?? '').startsWith(encryptedNotePrefix);
}

/// 제목과 본문으로 나뉜 메모.
class NoteTitleBody {
  final String title;
  final String body;

  const NoteTitleBody({required this.title, required this.body});

  @override
  bool operator ==(Object other) =>
      other is NoteTitleBody && other.title == title && other.body == body;

  @override
  int get hashCode => Object.hash(title, body);

  @override
  String toString() => 'NoteTitleBody(title: $title, body: $body)';
}

/// 저장된 메모 문자열을 제목과 본문으로 나눈다.
///
/// - 첫 줄을 `trim()` 해 제목으로 쓴다. 비면 [defaultNoteTitle].
/// - 둘째 줄부터를 이어 붙이고 `trim()` 해 본문으로 쓴다.
NoteTitleBody splitNoteContent(String content) {
  final lines = content.split('\n');
  final head = lines.first.trim();
  return NoteTitleBody(
    title: head.isEmpty ? defaultNoteTitle : head,
    body: lines.skip(1).join('\n').trim(),
  );
}

/// [splitNoteContent] 의 역방향. 제목과 본문을 저장용 문자열로 합친다.
String joinNoteContent({required String title, required String body}) {
  return '$title\n$body';
}

/// 제목 문자열을 다듬는다. 비면 [fallback].
String noteTitleOrFallback(String? value, {String fallback = defaultNoteTitle}) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? fallback : trimmed;
}
