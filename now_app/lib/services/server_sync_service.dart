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

final serverSettingsProvider =
    FutureProvider.autoDispose<ServerSettings>((ref) async {
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

  const ServerSettings({
    required this.enabled,
    required this.baseUrl,
    required this.token,
    required this.deviceId,
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
    );
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_serverEnabledKey, enabled);
    await prefs.setString(_serverBaseUrlKey, _normalizeBaseUrl(baseUrl));
    await prefs.setString(_serverTokenKey, token.trim());
    await prefs.setString(_serverDeviceIdKey, deviceId.trim());
  }

  ServerSettings copyWith({
    bool? enabled,
    String? baseUrl,
    String? token,
    String? deviceId,
  }) {
    return ServerSettings(
      enabled: enabled ?? this.enabled,
      baseUrl: baseUrl ?? this.baseUrl,
      token: token ?? this.token,
      deviceId: deviceId ?? this.deviceId,
    );
  }
}

class ServerConnectionResult {
  final bool ok;
  final String message;

  const ServerConnectionResult({required this.ok, required this.message});
}

class ServerSyncResult {
  final int uploaded;
  final String message;

  const ServerSyncResult({required this.uploaded, required this.message});
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
      return ServerConnectionResult(
        ok: true,
        message: authRequired ? '$name 연결됨 · 토큰 필요' : '$name 연결됨',
      );
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 401) {
        return const ServerConnectionResult(ok: false, message: '토큰이 맞지 않습니다');
      }
      return ServerConnectionResult(
        ok: false,
        message: e.message ?? '서버에 연결하지 못했습니다',
      );
    } catch (e) {
      return ServerConnectionResult(ok: false, message: '$e');
    }
  }

  Future<ServerSyncResult> uploadNotes(ServerSettings settings) async {
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
    if (notes.isEmpty) {
      return const ServerSyncResult(uploaded: 0, message: '업로드할 메모가 없습니다');
    }

    final dio = _dio(settings);
    await dio.post('/api/v1/notes/sync', data: {'notes': notes});
    return ServerSyncResult(
      uploaded: notes.length,
      message: '메모 ${notes.length}건 업로드 완료',
    );
  }

  Future<List<Map<String, dynamic>>> _dailyMemoPayloads(
    ServerSettings settings,
  ) async {
    final meetings = await (_db.select(_db.meetings)
          ..where((m) => m.recordType.equals('memo'))
          ..orderBy([(m) => OrderingTerm.desc(m.updatedAt)]))
        .get();

    final payloads = <Map<String, dynamic>>[];
    for (final meeting in meetings) {
      final segments = await (_db.select(_db.transcriptSegments)
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
    final memos = await (_db.select(_db.memos)
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
