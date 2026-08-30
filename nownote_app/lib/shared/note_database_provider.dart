import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

/// 앱 전체가 공유하는 [NoteDatabase] 하나.
///
/// 오늘 메모 탭과 계층 메모 탭이 같은 sqlite 파일(`now_note_db`)을 다룬다.
/// U15와 U16이 각자 화면 디렉터리 안에서만 작업하며 이 provider를 따로
/// 만들었다가(`today_providers.dart`의 `todayNoteDatabaseProvider`,
/// `tree_providers.dart`의 `noteDatabaseProvider`) 통합 검증에서 발견돼
/// 이 파일로 합쳤다. 인스턴스를 두 개 두면 한쪽에 저장한 값이 다른 쪽
/// 화면에 바로 보이지 않는다(각자 다른 Dart 객체가 자기 캐시/스트림을
/// 갖기 때문에, 같은 파일을 봐도 변경 알림이 서로에게 전달되지 않는다).
final noteDatabaseProvider = Provider<NoteDatabase>((ref) {
  final db = NoteDatabase();
  ref.onDispose(db.close);
  return db;
});
