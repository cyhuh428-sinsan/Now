import 'package:dio/dio.dart';
import 'package:drift/drift.dart';

import '../data/note_database.dart';
import '../notes/deleted_tree_memo.dart';
import '../notes/note_content.dart';
import '../notes/note_tags.dart';
import 'server_settings.dart';

/// `/api/v1/sync` 노트 동기화 결과.
class ServerSyncResult {
  final int uploaded;
  final int downloaded;
  final DateTime? syncedAt;
  final String message;

  const ServerSyncResult({
    required this.uploaded,
    this.downloaded = 0,
    this.syncedAt,
    required this.message,
  });
}

/// [ServerNoteSyncApi.syncNotes]의 결과.
///
/// 삭제 대기 계층 메모 목록의 실제 저장 방식(앱마다 다를 수 있다)은 이
/// 계층에 두지 않는다. 이 계층은 "이제 대기 목록에서 지워도 되는 id"만
/// 돌려주고, 실제로 지우는 것은 호출하는 쪽의 몫이다.
class ServerNoteSyncOutcome {
  final ServerSyncResult result;
  final Set<String> clearedDeletedTreeMemoIds;

  const ServerNoteSyncOutcome({
    required this.result,
    required this.clearedDeletedTreeMemoIds,
  });
}

/// 노트(일자별 메모 + 계층 메모) 동기화를 담당한다.
///
/// 화면을 갖지 않는다. Dio 인스턴스(헤더 구성 포함)는 호출하는 쪽이 만들어
/// 넘긴다 — `server/server_connection.dart`와 같은 패턴이다. 삭제 대기 계층
/// 메모 목록도 호출하는 쪽이 읽어서 넘긴다: 저장소 접근(예: 앱의
/// `SharedPreferences`)을 이 계층에 두지 않기 위해서다.
class ServerNoteSyncApi {
  const ServerNoteSyncApi._();

  /// `/api/v1/sync`로 로컬 노트를 올리고 서버 변경분을 받아 반영한다.
  static Future<ServerNoteSyncOutcome> syncNotes({
    required Dio dio,
    required NoteDatabase db,
    required ServerSettings settings,
    required Map<String, Map<String, dynamic>> pendingDeletedTreeMemos,
    bool fullSync = false,
  }) async {
    if (!settings.enabled) {
      return const ServerNoteSyncOutcome(
        result: ServerSyncResult(uploaded: 0, message: '서버 동기화가 꺼져 있습니다'),
        clearedDeletedTreeMemoIds: {},
      );
    }
    if (!settings.isConfigured) {
      return const ServerNoteSyncOutcome(
        result: ServerSyncResult(uploaded: 0, message: '서버 주소가 없습니다'),
        clearedDeletedTreeMemoIds: {},
      );
    }

    final notes = <Map<String, dynamic>>[
      ...await _dailyMemoPayloads(db, settings),
      ...await _treeMemoPayloads(db, settings),
    ];
    final deletedTreeNotes = _treeDeletedMemoPayloads(
      settings,
      pendingDeletedTreeMemos,
    );
    final deletedMemoIds = <String>{
      for (final item in deletedTreeNotes)
        if (item['local_id'] is String) item['local_id'] as String,
    };
    notes.addAll(deletedTreeNotes);
    if (shouldSkipServerSyncRequest(notes, fullSync, settings.lastSyncedAt)) {
      return const ServerNoteSyncOutcome(
        result: ServerSyncResult(uploaded: 0, message: '동기화할 메모가 없습니다'),
        clearedDeletedTreeMemoIds: {},
      );
    }

    final effectiveSyncPoint = fullSync
        ? null
        : settings.lastSyncedAt?.toIso8601String();
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '/api/v1/sync',
        data: {
          'owner_id': normalizeOwnerId(settings.ownerId),
          'device_id': settings.deviceId,
          'updated_after': effectiveSyncPoint,
          'include_deleted': true,
          'notes': notes,
        },
      );
      final pushedNotes = (res.data?['pushed_notes'] as List?) ?? const [];
      final pushed = pushedNotes.length;
      final pulledNotes = (res.data?['pulled_notes'] as List?) ?? const [];
      final pulled = pulledNotes.length;

      final clearedFromPull = await applyPulledNotes(
        db: db,
        settings: settings,
        pulledNotes: pulledNotes,
      );

      final serverTime = parseSyncTime(res.data?['server_time']?.toString());
      if (serverTime != null) {
        await settings.copyWith(lastSyncedAt: serverTime).save();
      }

      final clearedFromPush = <String>{};
      if (deletedMemoIds.isNotEmpty) {
        for (final item in pushedNotes) {
          if (item is! Map) continue;
          final noteType = item['note_type']?.toString();
          final deletedAt = item['deleted_at'];
          final localId = item['local_id']?.toString();
          if (noteType == 'tree' &&
              localId != null &&
              localId.isNotEmpty &&
              deletedAt != null &&
              deletedMemoIds.contains(localId)) {
            clearedFromPush.add(localId);
          }
        }
      }

      final emptySync = notes.isEmpty && pushed == 0 && pulled == 0;
      return ServerNoteSyncOutcome(
        result: ServerSyncResult(
          uploaded: pushed,
          downloaded: pulled,
          syncedAt: serverTime,
          message: emptySync
              ? '동기화할 메모가 없습니다'
              : '메모 업로드 $pushed건 · 서버 변경 $pulled건 확인',
        ),
        clearedDeletedTreeMemoIds: {...clearedFromPush, ...clearedFromPull},
      );
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '동기화 실패'));
    }
  }

  /// 서버에서 내려온 노트(`pulled_notes`)를 로컬 DB에 반영한다.
  ///
  /// 반영 중 삭제로 확정된 계층 메모 id를 돌려준다. 호출하는 쪽은 이 id를
  /// 삭제 대기 목록에서 지운다.
  static Future<Set<String>> applyPulledNotes({
    required NoteDatabase db,
    required ServerSettings settings,
    required List<dynamic> pulledNotes,
  }) async {
    final cleared = <String>{};
    if (pulledNotes.isEmpty) return cleared;
    for (final raw in pulledNotes) {
      if (raw is! Map) continue;
      final note = Map<String, dynamic>.from(raw);
      final noteType = note['note_type']?.toString();
      if (noteType == 'tree') {
        final clearedId = await _applyPulledTreeMemo(db, settings, note);
        if (clearedId != null) cleared.add(clearedId);
      } else if (noteType == 'daily') {
        await _applyPulledDailyMemo(db, note);
      }
    }
    return cleared;
  }
}

Future<List<Map<String, dynamic>>> _dailyMemoPayloads(
  NoteDatabase db,
  ServerSettings settings,
) async {
  final meetings =
      await (db.select(db.meetings)
            ..where((m) => m.recordType.equals('memo'))
            ..orderBy([(m) => OrderingTerm.desc(m.updatedAt)]))
          .get();

  final payloads = <Map<String, dynamic>>[];
  for (final meeting in meetings) {
    final segments =
        await (db.select(db.transcriptSegments)
              ..where((s) => s.meetingId.equals(meeting.meetingId))
              ..orderBy([(s) => OrderingTerm.asc(s.timestamp)]))
            .get();
    final content = segments.map((s) => s.content).join('\n\n').trim();
    payloads.add({
      'owner_id': normalizeOwnerId(settings.ownerId),
      'device_id': settings.deviceId,
      'local_id': meeting.meetingId,
      'note_type': 'daily',
      'title': meeting.title.isEmpty ? '일자 메모' : meeting.title,
      'content': content.isEmpty ? (meeting.summary ?? '') : content,
      'parent_local_id': null,
      'level': 1,
      'tags': 'recordType=memo',
      'source': 'now_app',
      'client_updated_at': meeting.updatedAt.toIso8601String(),
      'deleted_at': null,
    });
  }
  return payloads;
}

Future<List<Map<String, dynamic>>> _treeMemoPayloads(
  NoteDatabase db,
  ServerSettings settings,
) async {
  final memos =
      await (db.select(db.memos)
            ..where((m) => m.source.equals('note_tree'))
            ..orderBy([(m) => OrderingTerm.asc(m.createdAt)]))
          .get();

  return memos
      .where((memo) {
        final tags = parseNoteTags(memo.tags);
        return tags['deleted']?.toLowerCase() != 'true';
      })
      .map((memo) {
        final tags = parseNoteTags(memo.tags);
        final split = splitNoteContent(memo.content);
        final parent = tags['parent']?.trim();
        return {
          'owner_id': normalizeOwnerId(settings.ownerId),
          'device_id': settings.deviceId,
          'local_id': memo.memoId,
          'note_type': 'tree',
          'title': split.title,
          'content': split.body,
          'parent_local_id': parent == null || parent.isEmpty ? null : parent,
          'level': int.tryParse(tags['level'] ?? '1') ?? 1,
          'tags': memo.tags,
          'source': memo.source,
          'client_updated_at': memo.updatedAt.toIso8601String(),
          'deleted_at': null,
        };
      })
      .toList();
}

List<Map<String, dynamic>> _treeDeletedMemoPayloads(
  ServerSettings settings,
  Map<String, Map<String, dynamic>> pendingDeletedTreeMemos,
) {
  final payloads = <Map<String, dynamic>>[];
  for (final entry in pendingDeletedTreeMemos.entries) {
    final deletedAt = DateTime.tryParse(
      entry.value['deleted_at']?.toString() ?? '',
    );
    if (deletedAt == null) continue;

    final level = int.tryParse(entry.value['level']?.toString() ?? '1') ?? 1;
    final parentRaw = entry.value['parent_local_id']?.toString() ?? '';
    final parentLocalId = parentRaw.isEmpty ? null : parentRaw;

    payloads.add({
      'owner_id': normalizeOwnerId(settings.ownerId),
      'device_id': settings.deviceId,
      'local_id': entry.key,
      'note_type': 'tree',
      'title': entry.value['title']?.toString() ?? defaultDeletedNoteTitle,
      'content': '',
      'parent_local_id': parentLocalId,
      'level': level,
      'tags': entry.value['tags']?.toString().isEmpty == true
          ? null
          : entry.value['tags']?.toString(),
      'source': entry.value['source']?.toString() ?? 'note_tree',
      'client_updated_at': deletedAt.toIso8601String(),
      'deleted_at': deletedAt.toIso8601String(),
    });
  }
  return payloads;
}

/// 계층 메모 한 건을 반영한다. 삭제로 확정되었으면 그 local_id를 돌려준다.
Future<String?> _applyPulledTreeMemo(
  NoteDatabase db,
  ServerSettings settings,
  Map<String, dynamic> note,
) async {
  final localId = note['local_id']?.toString() ?? '';
  if (localId.isEmpty) return null;

  final serverUpdatedAt = _noteUpdatedAt(note);
  final existing =
      await (db.select(db.memos)..where((m) => m.memoId.equals(localId)))
          .getSingleOrNull();
  if (existing != null &&
      serverUpdatedAt != null &&
      existing.updatedAt.isAfter(serverUpdatedAt)) {
    return null;
  }

  if (_isDeletedServerNote(note)) {
    await (db.delete(db.memos)..where((m) => m.memoId.equals(localId))).go();
    return localId;
  }

  final title = noteTitleOrFallback(note['title']?.toString());
  final body = note['content']?.toString().trim() ?? '';
  final content = body.isEmpty ? title : '$title\n$body';
  final updatedAt = serverUpdatedAt ?? DateTime.now();
  final createdAt =
      parseSyncTime(note['created_at']?.toString()) ??
      existing?.createdAt ??
      updatedAt;
  final tags = mergeTreeMemoTagsFromServer(
    rawTags: note['tags']?.toString(),
    parentLocalId: note['parent_local_id']?.toString(),
    level: int.tryParse(note['level']?.toString() ?? '') ?? 1,
  );

  final companion = MemosCompanion(
    memoId: Value(localId),
    userId: Value(normalizeOwnerId(settings.ownerId)),
    content: Value(content),
    tags: Value(tags),
    source: const Value('note_tree'),
    createdAt: Value(createdAt),
    updatedAt: Value(updatedAt),
  );

  if (existing == null) {
    await db.into(db.memos).insert(companion);
  } else {
    await (db.update(db.memos)..where((m) => m.memoId.equals(localId)))
        .write(companion);
  }
  return null;
}

Future<void> _applyPulledDailyMemo(
  NoteDatabase db,
  Map<String, dynamic> note,
) async {
  final localId = note['local_id']?.toString() ?? '';
  if (localId.isEmpty) return;

  final serverUpdatedAt = _noteUpdatedAt(note);
  final existing =
      await (db.select(db.meetings)..where((m) => m.meetingId.equals(localId)))
          .getSingleOrNull();
  if (existing != null &&
      serverUpdatedAt != null &&
      existing.updatedAt.isAfter(serverUpdatedAt)) {
    return;
  }

  if (_isDeletedServerNote(note)) {
    await (db.delete(db.meetings)..where((m) => m.meetingId.equals(localId)))
        .go();
    await (db.delete(db.transcriptSegments)
          ..where((s) => s.meetingId.equals(localId)))
        .go();
    return;
  }

  final content = note['content']?.toString().trim() ?? '';
  final updatedAt = serverUpdatedAt ?? DateTime.now();
  final startedAt = _dailyDateFromServerNote(note) ?? updatedAt;
  final createdAt = existing?.createdAt ?? updatedAt;
  final title = noteTitleOrFallback(
    note['title']?.toString(),
    fallback: '오늘 메모',
  );

  final companion = MeetingsCompanion(
    meetingId: Value(localId),
    title: Value(title),
    status: const Value('closed'),
    recordType: const Value('memo'),
    participantName: const Value(null),
    startedAt: Value(startedAt),
    endedAt: Value(updatedAt),
    summary: Value(content),
    segmentCount: Value(content.isEmpty ? 0 : 1),
    actionCount: const Value(0),
    decisionCount: const Value(0),
    isImportant: existing == null
        ? const Value(false)
        : Value(existing.isImportant),
    createdAt: Value(createdAt),
    updatedAt: Value(updatedAt),
  );

  if (existing == null) {
    await db.into(db.meetings).insert(companion);
  } else {
    await (db.update(db.meetings)..where((m) => m.meetingId.equals(localId)))
        .write(companion);
    await (db.delete(db.transcriptSegments)
          ..where((s) => s.meetingId.equals(localId)))
        .go();
  }

  if (content.isNotEmpty) {
    await db.into(db.transcriptSegments).insert(
          TranscriptSegmentsCompanion.insert(
            segmentId: '${localId}_server',
            meetingId: localId,
            speaker: const Value('user'),
            timestamp: Value(startedAt),
            content: content,
            source: const Value('server_sync'),
            createdAt: Value(updatedAt),
          ),
          mode: InsertMode.replace,
        );
  }
}

/// 로컬에 보낼 노트가 없고 이미 한 번이라도 동기화한 적이 있다면 요청 자체를
/// 건너뛴다. 매번 빈 요청을 보내지 않기 위해서다. 첫 동기화(`lastSyncedAt`이
/// 없음)이거나 전체 동기화 요청이면 건너뛰지 않는다 — 서버가 내려줄 변경분을
/// 받아야 하기 때문이다.
bool shouldSkipServerSyncRequest(
  List<Map<String, dynamic>> notes,
  bool fullSync,
  DateTime? lastSyncedAt,
) {
  if (fullSync || lastSyncedAt == null) return false;
  return notes.isEmpty;
}

bool _isDeletedServerNote(Map<String, dynamic> note) {
  final raw = note['deleted_at'];
  // 서버는 이 값을 ISO 문자열 또는 null로만 보낸다(datetime | None 스키마).
  // 문자열이 아닌 값(예: false, 0)까지 toString()으로 판정하면 falsy 값도
  // "삭제됨"으로 오인해 로컬 메모를 지울 수 있으므로 문자열일 때만 본다.
  return raw is String && raw.trim().isNotEmpty;
}

DateTime? _noteUpdatedAt(Map<String, dynamic> note) {
  return parseSyncTime(note['client_updated_at']?.toString()) ??
      parseSyncTime(note['updated_at']?.toString()) ??
      parseSyncTime(note['created_at']?.toString());
}

DateTime? _dailyDateFromServerNote(Map<String, dynamic> note) {
  final localId = note['local_id']?.toString() ?? '';
  final match = RegExp(r'^daily:(\d{4})-(\d{2})-(\d{2})$').firstMatch(localId);
  if (match != null) {
    final year = int.tryParse(match.group(1)!);
    final month = int.tryParse(match.group(2)!);
    final day = int.tryParse(match.group(3)!);
    if (year != null && month != null && day != null) {
      return DateTime(year, month, day);
    }
  }
  return _noteUpdatedAt(note);
}

// now_core와 now_app이 서로 다른 dio 버전을 해석할 수 있어 DioExceptionType은
// 보지 않는다. 상태 코드와 응답 본문만으로 메시지를 만든다.
// (server/server_connection.dart와 같은 이유로 같은 구현을 둔다.)
String _serverErrorMessage(
  DioException error, {
  String fallback = '요청에 실패했습니다',
}) {
  final status = error.response?.statusCode;
  final prefix = status == null ? '요청 실패' : 'HTTP $status';
  final body = error.response?.data;
  if (body == null) {
    return '$prefix: ${error.message ?? fallback}';
  }

  if (body is Map<String, dynamic>) {
    final detail = body['detail'];
    final message = body['message'];
    if (detail == 'user inactive') {
      return '$prefix: 비활성 사용자라 서버 기능을 사용할 수 없습니다.';
    }
    if (detail is String && detail.isNotEmpty) return '$prefix: $detail';
    if (message is String && message.isNotEmpty) return '$prefix: $message';
  }
  if (body is String && body.isNotEmpty) {
    final text = body.length > 180 ? body.substring(0, 180) : body;
    return '$prefix: $text';
  }
  return '$prefix: ${error.message ?? fallback}';
}
