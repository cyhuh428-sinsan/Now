import 'package:dio/dio.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/database/app_database.dart';
import '../core/network/dio_client.dart';
import '../repositories/repository_providers.dart';

const _serverEnabledKey = 'now_server_enabled';
const _serverBaseUrlKey = 'now_server_base_url';
const _serverTokenKey = 'now_server_token';
const _serverDeviceIdKey = 'now_server_device_id';
const _serverLastSyncedAtKey = 'now_server_last_synced_at';

final serverSettingsProvider = FutureProvider.autoDispose<ServerSettings>((
  ref,
) async {
  return ServerSettings.load();
});

final serverSyncServiceProvider = Provider<ServerSyncService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return ServerSyncService(db);
});

class ServerSettings {
  final bool enabled;
  final String baseUrl;
  final String token;
  final String deviceId;
  final DateTime? lastSyncedAt;

  const ServerSettings({
    required this.enabled,
    required this.baseUrl,
    required this.token,
    required this.deviceId,
    required this.lastSyncedAt,
  });

  bool get isConfigured => baseUrl.trim().isNotEmpty;

  static Future<ServerSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    final deviceId = prefs.getString(_serverDeviceIdKey);
    if (deviceId == null || deviceId.isEmpty) {
      final generated = 'android_${DateTime.now().microsecondsSinceEpoch}';
      await prefs.setString(_serverDeviceIdKey, generated);
    }
    return ServerSettings(
      enabled: prefs.getBool(_serverEnabledKey) ?? false,
      baseUrl: prefs.getString(_serverBaseUrlKey) ?? '',
      token: prefs.getString(_serverTokenKey) ?? '',
      deviceId: prefs.getString(_serverDeviceIdKey) ?? '',
      lastSyncedAt: _parseSyncTime(prefs.getString(_serverLastSyncedAtKey)),
    );
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_serverEnabledKey, enabled);
    await prefs.setString(_serverBaseUrlKey, _normalizeBaseUrl(baseUrl));
    await prefs.setString(_serverTokenKey, token.trim());
    await prefs.setString(_serverDeviceIdKey, deviceId.trim());
    if (lastSyncedAt == null) {
      await prefs.remove(_serverLastSyncedAtKey);
    } else {
      await prefs.setString(
        _serverLastSyncedAtKey,
        lastSyncedAt!.toIso8601String(),
      );
    }
  }

  ServerSettings copyWith({
    bool? enabled,
    String? baseUrl,
    String? token,
    String? deviceId,
    DateTime? lastSyncedAt,
    bool clearLastSyncedAt = false,
  }) {
    return ServerSettings(
      enabled: enabled ?? this.enabled,
      baseUrl: baseUrl ?? this.baseUrl,
      token: token ?? this.token,
      deviceId: deviceId ?? this.deviceId,
      lastSyncedAt: clearLastSyncedAt
          ? null
          : (lastSyncedAt ?? this.lastSyncedAt),
    );
  }
}

class ServerConnectionResult {
  final bool ok;
  final String message;
  final String serverName;
  final Map<String, dynamic> capabilities;

  const ServerConnectionResult({
    required this.ok,
    required this.message,
    this.serverName = '',
    this.capabilities = const {},
  });
}

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

class ServerOpsResult {
  final String status;
  final List<Map<String, dynamic>> checks;

  const ServerOpsResult({required this.status, required this.checks});

  String get message {
    if (status == 'ok') return '운영 점검 정상';
    if (status == 'bad') return '운영 점검 주의 필요';
    return '운영 점검 확인 필요';
  }
}

class ServerSyncService {
  final AppDatabase _db;

  const ServerSyncService(this._db);

  Future<ServerConnectionResult> testConnection(ServerSettings settings) async {
    if (!settings.isConfigured) {
      return const ServerConnectionResult(ok: false, message: '서버 주소가 없습니다');
    }
    try {
      final dio = _dio(settings);
      final res = await dio.get<Map<String, dynamic>>('/api/v1/server');
      final name = res.data?['server']?.toString() ?? 'NowNote Server';
      final authRequired = res.data?['auth_required'] == true;
      final capabilities = Map<String, dynamic>.from(
        (res.data?['capabilities'] as Map?) ?? const {},
      );
      return ServerConnectionResult(
        ok: true,
        message: _serverConnectionMessage(name, authRequired, capabilities),
        serverName: name,
        capabilities: capabilities,
      );
    } on DioException catch (e) {
      return ServerConnectionResult(
        ok: false,
        message: _serverErrorMessage(e, fallback: '서버에 연결하지 못했습니다'),
      );
    } catch (e) {
      return ServerConnectionResult(ok: false, message: '$e');
    }
  }

  Future<ServerSyncResult> uploadNotes(ServerSettings settings) async {
    return syncNotes(settings);
  }

  Future<ServerSyncResult> syncNotes(
    ServerSettings settings, {
    bool fullSync = false,
  }) async {
    if (!settings.enabled) {
      return const ServerSyncResult(uploaded: 0, message: '서버 동기화가 꺼져 있습니다');
    }
    if (!settings.isConfigured) {
      return const ServerSyncResult(uploaded: 0, message: '서버 주소가 없습니다');
    }

    final notes = <Map<String, dynamic>>[
      ...await _dailyMemoPayloads(settings),
      ...await _treeMemoPayloads(settings),
    ];
    if (notes.isEmpty && !fullSync && settings.lastSyncedAt == null) {
      return const ServerSyncResult(uploaded: 0, message: '동기화할 메모가 없습니다');
    }

    final dio = _dio(settings);
    final effectiveSyncPoint = fullSync
        ? null
        : settings.lastSyncedAt?.toIso8601String();
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '/api/v1/sync',
        data: {
          'owner_id': 'local_user',
          'device_id': settings.deviceId,
          'updated_after': effectiveSyncPoint,
          'include_deleted': true,
          'notes': notes,
        },
      );
      final pushed = (res.data?['pushed_notes'] as List?)?.length ?? 0;
      final pulledNotes = (res.data?['pulled_notes'] as List?) ?? const [];
      final pulled = pulledNotes.length;

      final serverTime = _parseSyncTime(res.data?['server_time']?.toString());
      if (serverTime != null) {
        await settings.copyWith(lastSyncedAt: serverTime).save();
      }

      final emptySync = notes.isEmpty && pushed == 0 && pulled == 0;
      return ServerSyncResult(
        uploaded: pushed,
        downloaded: pulled,
        syncedAt: serverTime,
        message: emptySync
            ? '동기화할 메모가 없습니다'
            : '메모 업로드 $pushed건 · 서버 변경 $pulled건 확인',
      );
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '동기화 실패'));
    }
  }

  Future<ServerOpsResult> loadOpsStatus(ServerSettings settings) async {
    if (!settings.isConfigured) {
      return const ServerOpsResult(status: 'warn', checks: []);
    }
    final dio = _dio(settings);
    final res = await dio.get<Map<String, dynamic>>('/api/v1/admin/ops');
    final checks = ((res.data?['checks'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    return ServerOpsResult(
      status: res.data?['status']?.toString() ?? 'warn',
      checks: checks,
    );
  }

  Future<List<Map<String, dynamic>>> _dailyMemoPayloads(
    ServerSettings settings,
  ) async {
    final meetings =
        await (_db.select(_db.meetings)
              ..where((m) => m.recordType.equals('memo'))
              ..orderBy([(m) => OrderingTerm.desc(m.updatedAt)]))
            .get();

    final payloads = <Map<String, dynamic>>[];
    for (final meeting in meetings) {
      final segments =
          await (_db.select(_db.transcriptSegments)
                ..where((s) => s.meetingId.equals(meeting.meetingId))
                ..orderBy([(s) => OrderingTerm.asc(s.timestamp)]))
              .get();
      final content = segments.map((s) => s.content).join('\n\n').trim();
      payloads.add({
        'owner_id': 'local_user',
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
    ServerSettings settings,
  ) async {
    final memos =
        await (_db.select(_db.memos)
              ..where((m) => m.source.equals('note_tree'))
              ..orderBy([(m) => OrderingTerm.asc(m.createdAt)]))
            .get();

    return memos.map((memo) {
      final tags = _parseTags(memo.tags);
      final lines = memo.content.split('\n');
      final title = lines.first.trim().isEmpty ? '제목 없음' : lines.first.trim();
      final body = lines.skip(1).join('\n').trim();
      final parent = tags['parent']?.trim();
      return {
        'owner_id': 'local_user',
        'device_id': settings.deviceId,
        'local_id': memo.memoId,
        'note_type': 'tree',
        'title': title,
        'content': body,
        'parent_local_id': parent == null || parent.isEmpty ? null : parent,
        'level': int.tryParse(tags['level'] ?? '1') ?? 1,
        'tags': memo.tags,
        'source': memo.source,
        'client_updated_at': memo.updatedAt.toIso8601String(),
        'deleted_at': null,
      };
    }).toList();
  }

  Dio _dio(ServerSettings settings) {
    final dio = DioClient.create(baseUrl: _normalizeBaseUrl(settings.baseUrl));
    if (settings.token.trim().isNotEmpty) {
      dio.options.headers['Authorization'] = 'Bearer ${settings.token.trim()}';
    }
    return dio;
  }
}

Map<String, String> _parseTags(String? raw) {
  final result = <String, String>{};
  for (final part in (raw ?? '').split(';')) {
    final index = part.indexOf('=');
    if (index <= 0) continue;
    result[part.substring(0, index)] = part.substring(index + 1);
  }
  return result;
}

String _normalizeBaseUrl(String value) {
  final trimmed = value.trim();
  if (trimmed.endsWith('/')) {
    return trimmed.substring(0, trimmed.length - 1);
  }
  return trimmed;
}

String _serverConnectionMessage(
  String name,
  bool authRequired,
  Map<String, dynamic> capabilities,
) {
  final sync = capabilities['sync'] == true ? '동기화 지원' : '동기화 미확인';
  final maxLevel = capabilities['max_tree_note_level'];
  final levelText = maxLevel is int ? '계층 $maxLevel단계' : '계층 확인';
  final authText = authRequired ? '토큰 필요' : '토큰 없음';
  return '$name 연결됨 · $authText · $sync · $levelText';
}

DateTime? _parseSyncTime(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

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
    if (detail is String && detail.isNotEmpty) return '$prefix: $detail';
    if (message is String && message.isNotEmpty) return '$prefix: $message';
  }
  if (body is String && body.isNotEmpty) {
    final text = body.length > 180 ? body.substring(0, 180) : body;
    return '$prefix: $text';
  }
  return '$prefix: ${error.message ?? fallback}';
}
