import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';

void main() {
  group('buildDeletedTreeMemoEntry', () {
    test('삭제 시각과 값들을 담는다', () {
      final entry = buildDeletedTreeMemoEntry(
        deletedAt: DateTime.utc(2026, 1, 2, 3, 4, 5),
        level: 2,
        parentLocalId: 'p1',
        tags: 'kind=tree;level=2',
        title: '제목',
        content: '제목\n본문',
      );
      expect(entry['deleted_at'], '2026-01-02T03:04:05.000Z');
      expect(entry['level'], 2);
      expect(entry['parent_local_id'], 'p1');
      expect(entry['tags'], 'kind=tree;level=2');
      expect(entry['title'], '제목');
      expect(entry['content'], '제목\n본문');
      expect(entry['source'], 'note_tree');
    });

    test('빠진 값은 기본값으로 채운다', () {
      final entry = buildDeletedTreeMemoEntry(
        deletedAt: DateTime.utc(2026, 1, 1),
        level: 1,
      );
      expect(entry['parent_local_id'], '');
      expect(entry['tags'], '');
      expect(entry['title'], defaultDeletedNoteTitle);
      expect(entry['content'], '');
    });
  });

  group('normalizeDeletedTreeMemos', () {
    test('맵이 아니면 빈 맵', () {
      expect(normalizeDeletedTreeMemos(null), isEmpty);
      expect(normalizeDeletedTreeMemos('문자열'), isEmpty);
      expect(normalizeDeletedTreeMemos(<Object>[1, 2]), isEmpty);
    });

    test('항목을 문자열 키 맵으로 맞춘다', () {
      final result = normalizeDeletedTreeMemos({
        'm1': {'level': 2, 'title': '제목'},
      });
      expect(result.keys, ['m1']);
      expect(result['m1'], isA<Map<String, dynamic>>());
      expect(result['m1']!['level'], 2);
      expect(result['m1']!['title'], '제목');
    });

    test('값이 맵이 아닌 항목은 버린다', () {
      final result = normalizeDeletedTreeMemos({
        'm1': '망가진 값',
        'm2': {'level': 1},
      });
      expect(result.keys, ['m2']);
    });

    test('키가 비었으면 버린다', () {
      final result = normalizeDeletedTreeMemos({
        '': {'level': 1},
        'm2': {'level': 1},
      });
      expect(result.keys, ['m2']);
    });

    test('항목 안의 null 키는 버린다', () {
      final result = normalizeDeletedTreeMemos({
        'm1': {null: 'x', 'level': 1},
      });
      expect(result['m1'], {'level': 1});
    });
  });

  group('removeDeletedTreeMemos', () {
    test('주어진 id를 지운다', () {
      final current = <String, Map<String, dynamic>>{
        'm1': {'level': 1},
        'm2': {'level': 1},
      };
      removeDeletedTreeMemos(current, {'m1', '없는id'});
      expect(current.keys, ['m2']);
    });
  });
}
