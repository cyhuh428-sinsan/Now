import 'package:drift/drift.dart';
import 'package:now_core/now_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/database/app_database.dart';

/// 2.3.6 노트 저장소 이전.
///
/// 노트 3테이블은 `AppDatabase`에서 `now_core`의 `NoteDatabase`로 옮겼다.
/// 이전 버전에서 올라오는 기기에는 옛 DB 파일에 데이터가 남아 있으므로
/// 첫 실행 때 한 번 옮긴다.
///
/// 옮긴 뒤에도 옛 테이블은 지우지 않는다. 이전 결과를 확인하기 전에
/// 원본을 없애지 않기 위해서다. 정리는 이후 버전에서 한다.
class NoteStoreMigrationService {
  static const _doneKey = 'note_store_migrated_v18';

  final AppDatabase _appDb;
  final NoteDatabase _noteDb;

  const NoteStoreMigrationService(this._appDb, this._noteDb);

  Future<bool> migrateIfNeeded() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_doneKey) ?? false) return false;

    var moved = false;
    for (final table in const ['meetings', 'transcript_segments', 'memos']) {
      moved = await _copyTable(table) || moved;
    }

    await prefs.setBool(_doneKey, true);
    return moved;
  }

  /// 옛 DB의 한 테이블을 새 DB로 복사한다.
  ///
  /// 옛 테이블이 없으면 조용히 건너뛴다. 새로 설치한 기기가 여기에 해당한다.
  Future<bool> _copyTable(String table) async {
    final List<QueryRow> rows;
    try {
      rows = await _appDb.customSelect('SELECT * FROM $table').get();
    } on Object {
      return false;
    }
    if (rows.isEmpty) return false;

    for (final row in rows) {
      final data = row.data;
      final columns = data.keys.toList();
      final placeholders = List.filled(columns.length, '?').join(', ');
      await _noteDb.customStatement(
        'INSERT OR IGNORE INTO $table (${columns.join(', ')}) '
        'VALUES ($placeholders)',
        columns.map((c) => data[c]).toList(),
      );
    }
    return true;
  }
}
