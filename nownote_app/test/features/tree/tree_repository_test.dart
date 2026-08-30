import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/tree/tree_repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late NoteDatabase db;
  late TreeMemoRepository repo;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    db = NoteDatabase.forTesting(NativeDatabase.memory());
    repo = TreeMemoRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  test('부모가 없으면 레벨 1(주제)을 만든다', () async {
    final node = await repo.addMemo(title: '주제 1');
    expect(node.level, 1);
    expect(node.parentId, isNull);
    expect(node.title, '주제 1');

    final loaded = await repo.loadNodes();
    expect(loaded, hasLength(1));
    expect(loaded.single.level, 1);
  });

  test('레벨 1 아래에 레벨 2를 만든다', () async {
    final topic = await repo.addMemo(title: '주제 1');
    final category = await repo.addMemo(title: '분류 1', parent: topic);
    expect(category.level, 2);
    expect(category.parentId, topic.id);
  });

  test('레벨 2 아래에 레벨 3을 만든다', () async {
    final topic = await repo.addMemo(title: '주제 1');
    final category = await repo.addMemo(title: '분류 1', parent: topic);
    final memo = await repo.addMemo(title: '메모 1', parent: category);
    expect(memo.level, 3);
    expect(memo.parentId, category.id);
  });

  test('레벨 3 아래에는 추가할 수 없다', () async {
    final topic = await repo.addMemo(title: '주제 1');
    final category = await repo.addMemo(title: '분류 1', parent: topic);
    final memo = await repo.addMemo(title: '메모 1', parent: category);

    expect(repo.canAddChild(memo), isFalse);
    expect(
      () => repo.addMemo(title: '4단계 시도', parent: memo),
      throwsA(isA<TreeMemoLevelLimitExceeded>()),
    );

    final loaded = await repo.loadNodes();
    expect(loaded, hasLength(3));
  });

  test('제목을 바꿔도 본문과 레벨은 그대로다', () async {
    final topic = await repo.addMemo(title: '원래 제목', body: '본문');
    await repo.renameMemo(topic, '새 제목');

    final loaded = await repo.loadNodes();
    final renamed = loaded.single;
    expect(renamed.title, '새 제목');
    expect(renamed.content, '본문');
    expect(renamed.level, 1);
  });

  test('본문을 통째로 바꿔 저장해도 제목은 그대로다', () async {
    final topic = await repo.addMemo(title: '원래 제목', body: '원래 본문');
    await repo.saveBody(topic, 'NOW_ENCRYPTED_V1:cipher-text');

    final loaded = await repo.loadNodes();
    final saved = loaded.single;
    expect(saved.title, '원래 제목');
    expect(saved.content, 'NOW_ENCRYPTED_V1:cipher-text');
    expect(saved.level, 1);
  });

  test('삭제하면 목록에서 사라지고 삭제 대기로 남는다', () async {
    final topic = await repo.addMemo(title: '주제 1');
    await repo.deleteMemo(topic, await repo.loadNodes());

    final loaded = await repo.loadNodes();
    expect(loaded, isEmpty);

    final pending = await repo.loadPendingDeleted();
    expect(pending.keys, contains(topic.id));
    expect(pending[topic.id]!['title'], '주제 1');
  });

  test('상위를 지우면 하위 항목도 함께 삭제 대기로 옮긴다', () async {
    final topic = await repo.addMemo(title: '주제 1');
    final category = await repo.addMemo(title: '분류 1', parent: topic);
    final memo = await repo.addMemo(title: '메모 1', parent: category);

    final all = await repo.loadNodes();
    await repo.deleteMemo(topic, all);

    final loaded = await repo.loadNodes();
    expect(loaded, isEmpty);

    final pending = await repo.loadPendingDeleted();
    expect(pending.keys, containsAll([topic.id, category.id, memo.id]));
  });
}
