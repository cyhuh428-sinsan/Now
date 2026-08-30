import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';

Memo _memo({required String content, String? tags, String memoId = 'm1'}) {
  final now = DateTime(2026, 1, 1);
  return Memo(
    memoId: memoId,
    userId: 'local_user',
    content: content,
    tags: tags,
    source: 'note_tree',
    createdAt: now,
    updatedAt: now,
  );
}

void main() {
  group('TreeMemoNode.fromMemo', () {
    test('첫 줄을 제목으로, 나머지를 본문으로 읽는다', () {
      final node = TreeMemoNode.fromMemo(
        _memo(content: '제목\n본문 1\n본문 2', tags: 'kind=tree;parent=;level=1'),
      );
      expect(node.id, 'm1');
      expect(node.title, '제목');
      expect(node.content, '본문 1\n본문 2');
    });

    test('제목이 비면 제목 없음', () {
      final node = TreeMemoNode.fromMemo(_memo(content: '\n본문'));
      expect(node.title, defaultNoteTitle);
    });

    test('태그에서 부모와 단계를 읽는다', () {
      final node = TreeMemoNode.fromMemo(
        _memo(content: '제목', tags: 'kind=tree;parent=p1;level=3'),
      );
      expect(node.parentId, 'p1');
      expect(node.level, 3);
    });

    test('부모 값이 비면 null', () {
      final node = TreeMemoNode.fromMemo(
        _memo(content: '제목', tags: 'kind=tree;parent=;level=2'),
      );
      expect(node.parentId, isNull);
    });

    test('부모 키가 없어도 null', () {
      final node = TreeMemoNode.fromMemo(_memo(content: '제목', tags: 'kind=tree'));
      expect(node.parentId, isNull);
    });

    test('단계가 없거나 숫자가 아니면 1', () {
      expect(TreeMemoNode.fromMemo(_memo(content: '제목')).level, 1);
      expect(
        TreeMemoNode.fromMemo(_memo(content: '제목', tags: 'level=abc')).level,
        1,
      );
    });

    test('태그가 null 이면 빈 문자열로 담는다', () {
      expect(TreeMemoNode.fromMemo(_memo(content: '제목')).tags, '');
    });
  });

  group('TreeMemoNode 판정', () {
    TreeMemoNode node({String content = '본문', String tags = ''}) => TreeMemoNode(
          id: 'm1',
          title: '제목',
          content: content,
          parentId: null,
          level: 1,
          tags: tags,
        );

    test('암호화 여부는 본문 접두어로 본다', () {
      expect(node(content: '${encryptedNotePrefix}xx').isEncrypted, isTrue);
      expect(node(content: '평문').isEncrypted, isFalse);
    });

    test('공유 여부는 태그로 본다', () {
      expect(node(tags: 'kind=tree;serverTags=shared').isShared, isTrue);
      expect(node(tags: 'kind=tree;level=1').isShared, isFalse);
    });

    test('평문이면 displayContent 는 본문 그대로', () {
      expect(node(content: '평문').displayContent(null), '평문');
      expect(node(content: '평문').displayContent('무시됨'), '평문');
    });

    test('암호화 상태에서 풀린 내용이 있으면 그것을 보여준다', () {
      final n = node(content: '${encryptedNotePrefix}xx');
      expect(n.displayContent('풀린 본문'), '풀린 본문');
    });

    test('암호화 상태에서 풀린 내용이 없으면 안내 문구', () {
      final n = node(content: '${encryptedNotePrefix}xx');
      expect(n.displayContent(null), '암호화된 메모입니다. 복호화 버튼을 눌러 키를 입력하세요.');
    });
  });
}
