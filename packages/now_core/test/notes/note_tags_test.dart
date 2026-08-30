import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';

void main() {
  group('parseNoteTags', () {
    test('key=value 쌍을 세미콜론 기준으로 읽는다', () {
      expect(parseNoteTags('kind=tree;parent=abc;level=2'), {
        'kind': 'tree',
        'parent': 'abc',
        'level': '2',
      });
    });

    test('null과 빈 문자열은 빈 맵', () {
      expect(parseNoteTags(null), isEmpty);
      expect(parseNoteTags(''), isEmpty);
    });

    test('등호가 없는 조각은 버린다', () {
      expect(parseNoteTags('kind=tree;쓰레기;level=1'), {
        'kind': 'tree',
        'level': '1',
      });
    });

    test('등호가 맨 앞인 조각은 버린다', () {
      expect(parseNoteTags('=value;kind=tree'), {'kind': 'tree'});
    });

    test('값 안의 등호는 값에 남는다', () {
      expect(parseNoteTags('serverTags=a=b'), {'serverTags': 'a=b'});
    });

    test('값이 비어도 키는 남는다', () {
      expect(parseNoteTags('parent=;level=1'), {'parent': '', 'level': '1'});
    });

    test('같은 키가 겹치면 뒤가 이긴다', () {
      expect(parseNoteTags('level=1;level=3'), {'level': '3'});
    });
  });

  group('buildNoteTags', () {
    test('맵 순서대로 이어 붙인다', () {
      expect(
        buildNoteTags({'kind': 'tree', 'parent': '', 'level': '2'}),
        'kind=tree;parent=;level=2',
      );
    });

    test('빈 맵은 빈 문자열', () {
      expect(buildNoteTags({}), '');
    });

    test('parseNoteTags 의 역방향이다', () {
      const raw = 'kind=tree;parent=abc;level=2;voiceMode=realtime';
      expect(buildNoteTags(parseNoteTags(raw)), raw);
    });
  });

  group('buildTreeMemoTags', () {
    test('부모/단계/음성모드를 정해진 순서로 만든다', () {
      expect(
        buildTreeMemoTags(parentId: 'p1', level: 2, voiceMode: 'realtime'),
        'kind=tree;parent=p1;level=2;voiceMode=realtime',
      );
    });

    test('부모가 없으면 빈 값으로 남긴다', () {
      expect(
        buildTreeMemoTags(parentId: null, level: 1, voiceMode: 'realtime'),
        'kind=tree;parent=;level=1;voiceMode=realtime',
      );
    });

    test('음성모드가 없으면 항목 자체를 붙이지 않는다', () {
      expect(buildTreeMemoTags(level: 1), 'kind=tree;parent=;level=1');
    });

    test('만든 태그를 되읽으면 값이 그대로다', () {
      final parsed = parseNoteTags(
        buildTreeMemoTags(parentId: 'p1', level: 3, voiceMode: 'record'),
      );
      expect(parsed['kind'], 'tree');
      expect(parsed['parent'], 'p1');
      expect(parsed['level'], '3');
      expect(parsed['voiceMode'], 'record');
    });
  });

  group('mergeTreeMemoTagsFromServer', () {
    test('서버 태그가 key=value 형식이면 그 위에 덮어쓴다', () {
      expect(
        mergeTreeMemoTagsFromServer(
          rawTags: 'kind=note;parent=old;level=9;voiceMode=realtime',
          parentLocalId: 'p1',
          level: 2,
        ),
        'kind=tree;parent=p1;level=2;voiceMode=realtime',
      );
    });

    test('없던 키는 뒤에 붙고 있던 키는 자리를 지킨다', () {
      expect(
        mergeTreeMemoTagsFromServer(
          rawTags: 'voiceMode=realtime;level=9',
          parentLocalId: 'p1',
          level: 2,
        ),
        'voiceMode=realtime;level=2;kind=tree;parent=p1',
      );
    });

    test('서버 태그가 형식에 맞지 않으면 serverTags 로 보존한다', () {
      expect(
        mergeTreeMemoTagsFromServer(
          rawTags: 'work, shared',
          parentLocalId: 'p1',
          level: 2,
        ),
        'kind=tree;parent=p1;level=2;serverTags=work, shared',
      );
    });

    test('보존할 때 세미콜론은 쉼표로 바꾼다', () {
      expect(
        mergeTreeMemoTagsFromServer(rawTags: 'work;shared', level: 1),
        'kind=tree;parent=;level=1;serverTags=work,shared',
      );
    });

    test('서버 태그가 비면 serverTags 를 붙이지 않는다', () {
      expect(
        mergeTreeMemoTagsFromServer(rawTags: '   ', parentLocalId: '  ', level: 1),
        'kind=tree;parent=;level=1',
      );
      expect(
        mergeTreeMemoTagsFromServer(level: 1),
        'kind=tree;parent=;level=1',
      );
    });
  });

  group('noteTagsContainShared', () {
    test('원본 태그에서 shared 토큰을 찾는다', () {
      expect(noteTagsContainShared('kind=tree;shared'), isTrue);
    });

    test('serverTags 안의 shared 를 찾는다', () {
      expect(
        noteTagsContainShared('kind=tree;serverTags=work,shared'),
        isTrue,
      );
    });

    test('tags 안의 shared 를 찾는다', () {
      expect(noteTagsContainShared('kind=tree;tags=shared team'), isTrue);
    });

    test('대소문자를 가리지 않는다', () {
      expect(noteTagsContainShared('kind=tree;tags=SHARED'), isTrue);
    });

    test('공유 표시가 없으면 false', () {
      expect(noteTagsContainShared('kind=tree;parent=;level=1'), isFalse);
      expect(noteTagsContainShared(''), isFalse);
    });

    test('shared 가 다른 낱말에 붙어 있으면 토큰이 아니다', () {
      expect(noteTagsContainShared('kind=tree;tags=unshared'), isFalse);
    });

    test('키 이름이 shared 여도 등호로 잘려 토큰이 된다', () {
      expect(noteTagsContainShared('shared=true'), isTrue);
    });
  });
}
