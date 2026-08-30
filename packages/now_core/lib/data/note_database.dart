import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'note_tables.dart';

part 'note_database.g.dart';

/// 노트 저장소.
///
/// Now와 NowNote가 같은 구조를 쓴다. DB 파일은 앱마다 따로 갖는다.
///
/// `Meetings`는 회의/인터뷰/대화 기록과 일자별 메모를 함께 담는다.
/// NowNote는 `recordType='memo'` 행만 사용한다.
@DriftDatabase(tables: [Meetings, TranscriptSegments, Memos])
class NoteDatabase extends _$NoteDatabase {
  NoteDatabase() : super(_openConnection());
  NoteDatabase.forTesting(super.executor);

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
        onCreate: (m) => m.createAll(),
      );
}

QueryExecutor _openConnection() {
  return driftDatabase(name: 'now_note_db');
}
