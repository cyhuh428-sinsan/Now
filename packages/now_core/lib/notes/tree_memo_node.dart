import '../data/note_database.dart';
import 'note_content.dart';
import 'note_tags.dart';

/// 계층 메모 한 칸.
///
/// 저장된 [Memo] 행을 화면과 동기화가 함께 쓰는 형태로 읽어 놓은 값이다.
/// 화면 코드를 담지 않는다.
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
  bool get isShared => noteTagsContainShared(tags);

  String displayContent(String? unlockedContent) {
    if (!isEncrypted) return content;
    return unlockedContent ?? '암호화된 메모입니다. 복호화 버튼을 눌러 키를 입력하세요.';
  }

  factory TreeMemoNode.fromMemo(Memo memo) {
    final tags = parseNoteTags(memo.tags);
    final split = splitNoteContent(memo.content);
    return TreeMemoNode(
      id: memo.memoId,
      title: split.title,
      content: split.body,
      parentId: tags['parent']?.isEmpty == true ? null : tags['parent'],
      level: int.tryParse(tags['level'] ?? '1') ?? 1,
      tags: memo.tags ?? '',
    );
  }
}
