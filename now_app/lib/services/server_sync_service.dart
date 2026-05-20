import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/database/app_database.dart';
import '../core/network/dio_client.dart';
import '../repositories/repository_providers.dart';

const _serverEnabledKey = 'now_server_enabled';
const _serverBaseUrlKey = 'now_server_base_url';
const _serverTokenKey = 'now_server_token';
const _serverUserTokenKey = 'now_server_user_token';
const _serverOwnerIdKey = 'now_server_owner_id';
const _serverDeviceIdKey = 'now_server_device_id';
const _serverLastSyncedAtKey = 'now_server_last_synced_at';
const _serverDeletedTreeMemosKey = 'now_server_deleted_tree_memos';

const _secureStorage = FlutterSecureStorage();

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
  final String userToken;
  final String ownerId;
  final String deviceId;
  final DateTime? lastSyncedAt;

  const ServerSettings({
    required this.enabled,
    required this.baseUrl,
    required this.token,
    required this.userToken,
    required this.ownerId,
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
    final ownerId = prefs.getString(_serverOwnerIdKey);
    if (ownerId == null || ownerId.trim().isEmpty) {
      await prefs.setString(_serverOwnerIdKey, 'local_user');
    }
    final token = await _loadServerToken(prefs);
    final userToken = await _loadSecureToken(
      prefs,
      key: _serverUserTokenKey,
    );
    return ServerSettings(
      enabled: prefs.getBool(_serverEnabledKey) ?? false,
      baseUrl: prefs.getString(_serverBaseUrlKey) ?? '',
      token: token,
      userToken: userToken,
      ownerId: _normalizeOwnerId(
        prefs.getString(_serverOwnerIdKey) ?? 'local_user',
      ),
      deviceId: prefs.getString(_serverDeviceIdKey) ?? '',
      lastSyncedAt: _parseSyncTime(prefs.getString(_serverLastSyncedAtKey)),
    );
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_serverEnabledKey, enabled);
    await prefs.setString(_serverBaseUrlKey, _normalizeBaseUrl(baseUrl));
    await _saveSecureToken(token.trim(), prefs, key: _serverTokenKey);
    await _saveSecureToken(
      userToken.trim(),
      prefs,
      key: _serverUserTokenKey,
    );
    await prefs.setString(_serverOwnerIdKey, _normalizeOwnerId(ownerId));
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
    String? userToken,
    String? ownerId,
    String? deviceId,
    DateTime? lastSyncedAt,
    bool clearLastSyncedAt = false,
  }) {
    return ServerSettings(
      enabled: enabled ?? this.enabled,
      baseUrl: baseUrl ?? this.baseUrl,
      token: token ?? this.token,
      userToken: userToken ?? this.userToken,
      ownerId: ownerId ?? this.ownerId,
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
  final ServerPublicReadiness? publicReadiness;

  const ServerConnectionResult({
    required this.ok,
    required this.message,
    this.serverName = '',
    this.capabilities = const {},
    this.publicReadiness,
  });
}

class ServerPublicReadiness {
  final String status;
  final List<String> remaining;

  const ServerPublicReadiness({
    required this.status,
    required this.remaining,
  });

  factory ServerPublicReadiness.fromJson(Map<String, dynamic> json) {
    return ServerPublicReadiness(
      status: json['status']?.toString() ?? '',
      remaining: ((json['remaining'] as List?) ?? const [])
          .map((item) => item.toString())
          .where((item) => item.trim().isNotEmpty)
          .toList(),
    );
  }

  String get summary {
    if (status == 'ready') return '공용 서버 준비 완료';
    if (status == 'planned') {
      return '공용 서버 준비 중 · 남은 항목 ${remaining.length}개';
    }
    return '';
  }
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

class ServerAnalysisJob {
  final int id;
  final String jobType;
  final String status;
  final String? noteLocalId;
  final String? inputText;
  final String? resultJson;
  final String? errorMessage;
  final String? updatedAt;

  const ServerAnalysisJob({
    required this.id,
    required this.jobType,
    required this.status,
    required this.noteLocalId,
    required this.inputText,
    required this.resultJson,
    required this.errorMessage,
    required this.updatedAt,
  });

  factory ServerAnalysisJob.fromJson(Map<String, dynamic> json) {
    return ServerAnalysisJob(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      jobType: json['job_type']?.toString() ?? '-',
      status: json['status']?.toString() ?? '-',
      noteLocalId: json['note_local_id']?.toString(),
      inputText: json['input_text']?.toString(),
      resultJson: json['result_json']?.toString(),
      errorMessage: json['error_message']?.toString(),
      updatedAt: json['updated_at']?.toString(),
    );
  }

  String get resultPreview {
    final error = errorMessage?.trim() ?? '';
    if (error.isNotEmpty) return error;

    final result = resultJson?.trim() ?? '';
    if (result.isEmpty) {
      final input = inputText?.trim() ?? '';
      return input.isEmpty ? '결과 없음' : input;
    }

    try {
      final decoded = jsonDecode(result);
      if (decoded is Map) {
        for (final key in [
          'summary',
          'advice',
          'search_text',
          'result',
          'adviceBasis',
        ]) {
          final value = decoded[key];
          if (value is String && value.trim().isNotEmpty) {
            return value.trim();
          }
        }
        for (final key in ['keywords', 'index_terms', 'mustDo', 'tasks']) {
          final value = decoded[key];
          if (value is List && value.isNotEmpty) {
            return value.map((item) => item.toString()).join(', ');
          }
        }
      }
    } catch (_) {}

    return result;
  }
}

class ServerRecordingUploadResult {
  final String localId;
  final String fileName;
  final String? transcript;

  const ServerRecordingUploadResult({
    required this.localId,
    required this.fileName,
    required this.transcript,
  });

  factory ServerRecordingUploadResult.fromJson(Map<String, dynamic> json) {
    return ServerRecordingUploadResult(
      localId: json['local_id']?.toString() ?? '',
      fileName: json['file_name']?.toString() ?? '',
      transcript: json['transcript']?.toString(),
    );
  }
}

class ServerRecording {
  final int id;
  final String ownerId;
  final String deviceId;
  final String localId;
  final String? noteLocalId;
  final String fileName;
  final String contentType;
  final String? transcript;
  final String? createdAt;
  final String? updatedAt;

  const ServerRecording({
    required this.id,
    required this.ownerId,
    required this.deviceId,
    required this.localId,
    required this.noteLocalId,
    required this.fileName,
    required this.contentType,
    required this.transcript,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get hasTranscript => transcript?.trim().isNotEmpty == true;

  factory ServerRecording.fromJson(Map<String, dynamic> json) {
    return ServerRecording(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      ownerId: json['owner_id']?.toString() ?? 'local_user',
      deviceId: json['device_id']?.toString() ?? '-',
      localId: json['local_id']?.toString() ?? '',
      noteLocalId: json['note_local_id']?.toString(),
      fileName: json['file_name']?.toString() ?? '',
      contentType: json['content_type']?.toString() ?? '',
      transcript: json['transcript']?.toString(),
      createdAt: json['created_at']?.toString(),
      updatedAt: json['updated_at']?.toString(),
    );
  }
}

class ServerUserProfile {
  final String ownerId;
  final String? email;
  final String? displayName;
  final String timezone;
  final String groupName;
  final bool twoFactorEnabled;
  final bool isActive;
  final String? lastSeenAt;

  const ServerUserProfile({
    required this.ownerId,
    required this.email,
    required this.displayName,
    required this.timezone,
    required this.groupName,
    required this.twoFactorEnabled,
    required this.isActive,
    required this.lastSeenAt,
  });

  factory ServerUserProfile.fromJson(Map<String, dynamic> json) {
    return ServerUserProfile(
      ownerId: json['owner_id']?.toString() ?? 'local_user',
      email: json['email']?.toString(),
      displayName: json['display_name']?.toString(),
      timezone: json['timezone']?.toString() ?? 'Asia/Seoul',
      groupName: json['group_name']?.toString() ?? '사용자',
      twoFactorEnabled: json['two_factor_enabled'] == true,
      isActive: json['is_active'] != false,
      lastSeenAt: json['last_seen_at']?.toString(),
    );
  }
}

class ServerSyncService {
  final AppDatabase _db;

  const ServerSyncService(this._db);

  Future<ServerConnectionResult> testConnection(
    ServerSettings settings, {
    String twoFactorCode = '',
  }) async {
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
      final publicReadiness = _publicReadinessFromResponse(res.data);
      if (settings.userToken.trim().isNotEmpty) {
        await _verifyUserToken(settings, twoFactorCode: twoFactorCode);
      }
      return ServerConnectionResult(
        ok: true,
        message: _serverConnectionMessage(
          name,
          authRequired,
          capabilities,
          publicReadiness,
        ),
        serverName: name,
        capabilities: capabilities,
        publicReadiness: publicReadiness,
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

  Future<void> _verifyUserToken(
    ServerSettings settings, {
    required String twoFactorCode,
  }) async {
    final data = <String, dynamic>{
      'owner_id': _normalizeOwnerId(settings.ownerId),
      'access_token': settings.userToken.trim(),
    };
    final code = twoFactorCode.trim();
    if (code.isNotEmpty) {
      data['two_factor_code'] = code;
    }
    await _dioWithoutUserToken(settings).post<Map<String, dynamic>>(
      '/api/v1/auth/token-login',
      data: data,
    );
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
    final deletedTreeNotes = await _treeDeletedMemoPayloads(settings);
    final deletedMemoIds = <String>{
      for (final item in deletedTreeNotes)
        if (item['local_id'] is String) item['local_id'] as String,
    };
    notes.addAll(deletedTreeNotes);
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
          'owner_id': _normalizeOwnerId(settings.ownerId),
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

      final serverTime = _parseSyncTime(res.data?['server_time']?.toString());
      if (serverTime != null) {
        await settings.copyWith(lastSyncedAt: serverTime).save();
      }
      if (deletedMemoIds.isNotEmpty) {
        final syncedDeletedIds = <String>{};
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
            syncedDeletedIds.add(localId);
          }
        }
        if (syncedDeletedIds.isNotEmpty) {
          await _clearPendingDeletedTreeMemos(syncedDeletedIds);
        }
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

  Future<void> markTreeMemoDeleted(
    String memoId, {
    required int level,
    String? parentLocalId,
    String? tags,
    String? title,
    String? content,
    DateTime? deletedAt,
  }) async {
    if (memoId.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final current = await _loadDeletedTreeMemos(prefs);
    final now = deletedAt ?? DateTime.now();
    current[memoId] = {
      'deleted_at': now.toIso8601String(),
      'level': level,
      'parent_local_id': parentLocalId ?? '',
      'tags': tags ?? '',
      'title': title ?? '삭제된 메모',
      'content': content ?? '',
      'source': 'note_tree',
    };
    await prefs.setString(_serverDeletedTreeMemosKey, jsonEncode(current));
  }

  Future<Map<String, Map<String, dynamic>>> getDeletedTreeMemoPendings() async {
    return _loadDeletedTreeMemos();
  }

  Future<void> clearDeletedTreeMemoPendings(Set<String> memoIds) async {
    await _clearPendingDeletedTreeMemos(memoIds);
  }

  Future<void> clearAllDeletedTreeMemoPendings() async {
    final current = await _loadDeletedTreeMemos();
    if (current.isEmpty) return;
    await _clearPendingDeletedTreeMemos(current.keys.toSet());
  }

  Future<ServerUserProfile> loadUserProfile(ServerSettings settings) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final dio = _dio(settings);
    try {
      final ownerId = _normalizeOwnerId(settings.ownerId);
      final res = await dio.get<Map<String, dynamic>>(
        '/api/v1/users/${Uri.encodeComponent(ownerId)}',
      );
      return _profileFromResponse(res.data);
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '사용자 프로필 조회 실패'));
    }
  }

  Future<ServerUserProfile> saveUserProfile(
    ServerSettings settings, {
    required String? email,
    required String? displayName,
    required String timezone,
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final dio = _dio(settings);
    final ownerId = _normalizeOwnerId(settings.ownerId);
    final path = '/api/v1/users/${Uri.encodeComponent(ownerId)}';
    final data = {
      'email': _blankToNull(email),
      'display_name': _blankToNull(displayName),
      'timezone': timezone.trim().isEmpty ? 'Asia/Seoul' : timezone.trim(),
    };
    try {
      final res = await dio.patch<Map<String, dynamic>>(path, data: data);
      return _profileFromResponse(res.data);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        await dio.get<Map<String, dynamic>>(path);
        final res = await dio.patch<Map<String, dynamic>>(path, data: data);
        return _profileFromResponse(res.data);
      }
      throw Exception(_serverErrorMessage(e, fallback: '사용자 프로필 저장 실패'));
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

  Future<List<ServerAnalysisJob>> loadAnalysisJobs(
    ServerSettings settings,
  ) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final dio = _dio(settings);
    try {
      final ownerId = _normalizeOwnerId(settings.ownerId);
      final res = await dio.get<List<dynamic>>(
        '/api/v1/analysis/jobs',
        queryParameters: {'owner_id': ownerId},
      );
      return (res.data ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                ServerAnalysisJob.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '분석 작업 조회 실패'));
    }
  }

  Future<ServerAnalysisJob> createAnalysisJob(
    ServerSettings settings, {
    required String jobType,
    String? noteLocalId,
    String? inputText,
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final dio = _dio(settings);
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '/api/v1/analysis/jobs',
        data: {
          'owner_id': _normalizeOwnerId(settings.ownerId),
          'job_type': jobType,
          'note_local_id': _blankToNull(noteLocalId),
          'input_text': _blankToNull(inputText),
        },
      );
      return ServerAnalysisJob.fromJson(res.data ?? const <String, dynamic>{});
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '분석 작업 생성 실패'));
    }
  }

  Future<ServerRecordingUploadResult> uploadRecordingFile(
    ServerSettings settings, {
    required String filePath,
    required String localId,
    required String? noteLocalId,
    required String? transcript,
  }) async {
    if (!settings.enabled) {
      throw Exception('서버 동기화가 꺼져 있습니다');
    }
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final file = File(filePath);
    if (!await file.exists()) {
      throw Exception('녹음 파일을 찾을 수 없습니다');
    }

    final dio = _dio(settings);
    final fileName = file.uri.pathSegments.isEmpty
        ? 'recording.aac'
        : file.uri.pathSegments.last;
    try {
      final formData = FormData.fromMap({
        'owner_id': _normalizeOwnerId(settings.ownerId),
        'device_id': settings.deviceId,
        'local_id': localId,
        'note_local_id': _blankToNull(noteLocalId),
        'transcript': _blankToNull(transcript),
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
      });
      final res = await dio.post<Map<String, dynamic>>(
        '/api/v1/recordings',
        data: formData,
      );
      return ServerRecordingUploadResult.fromJson(
        res.data ?? const <String, dynamic>{},
      );
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '녹음 업로드 실패'));
    }
  }

  Future<List<ServerRecording>> loadRecordings(ServerSettings settings) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final dio = _dio(settings);
    try {
      final ownerId = _normalizeOwnerId(settings.ownerId);
      final res = await dio.get<List<dynamic>>(
        '/api/v1/recordings',
        queryParameters: {'owner_id': ownerId},
      );
      return (res.data ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                ServerRecording.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '녹음 목록 조회 실패'));
    }
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
        'owner_id': _normalizeOwnerId(settings.ownerId),
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

    return memos
        .where((memo) {
          final tags = _parseTags(memo.tags);
          return tags['deleted']?.toLowerCase() != 'true';
        })
        .map((memo) {
          final tags = _parseTags(memo.tags);
          final lines = memo.content.split('\n');
          final title = lines.first.trim().isEmpty
              ? '제목 없음'
              : lines.first.trim();
          final body = lines.skip(1).join('\n').trim();
          final parent = tags['parent']?.trim();
          return {
            'owner_id': _normalizeOwnerId(settings.ownerId),
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
        })
        .toList();
  }

  Future<List<Map<String, dynamic>>> _treeDeletedMemoPayloads(
    ServerSettings settings,
  ) async {
    final deleted = await _loadDeletedTreeMemos();
    final payloads = <Map<String, dynamic>>[];
    for (final entry in deleted.entries) {
      final deletedAt = DateTime.tryParse(
        entry.value['deleted_at']?.toString() ?? '',
      );
      if (deletedAt == null) continue;

      final level = int.tryParse(entry.value['level']?.toString() ?? '1') ?? 1;
      final parentRaw = entry.value['parent_local_id']?.toString() ?? '';
      final parentLocalId = parentRaw.isEmpty ? null : parentRaw;

      payloads.add({
        'owner_id': _normalizeOwnerId(settings.ownerId),
        'device_id': settings.deviceId,
        'local_id': entry.key,
        'note_type': 'tree',
        'title': entry.value['title']?.toString() ?? '삭제된 메모',
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

  Future<Map<String, Map<String, dynamic>>> _loadDeletedTreeMemos([
    SharedPreferences? prefs,
  ]) async {
    final pref = prefs ?? await SharedPreferences.getInstance();
    final raw = pref.getString(_serverDeletedTreeMemosKey);
    if (raw == null || raw.isEmpty) return {};

    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map) {
        final result = <String, Map<String, dynamic>>{};
        decoded.forEach((key, value) {
          final memoId = key?.toString() ?? '';
          if (memoId.isEmpty || value is! Map) return;
          final item = <String, dynamic>{};
          value.forEach((k, v) {
            if (k != null) {
              item[k.toString()] = v;
            }
          });
          result[memoId] = item;
        });
        return result;
      }
    } catch (_) {
      // 복구 목적: 손상된 저장 데이터를 즉시 초기화
      await pref.remove(_serverDeletedTreeMemosKey);
    }
    return {};
  }

  Future<void> _clearPendingDeletedTreeMemos(Set<String> memoIds) async {
    if (memoIds.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final current = await _loadDeletedTreeMemos(prefs);
    if (current.isEmpty) return;
    memoIds.forEach(current.remove);
    if (current.isEmpty) {
      await prefs.remove(_serverDeletedTreeMemosKey);
      return;
    }
    await prefs.setString(_serverDeletedTreeMemosKey, jsonEncode(current));
  }

  Dio _dio(ServerSettings settings) {
    final dio = DioClient.create(baseUrl: _normalizeBaseUrl(settings.baseUrl));
    if (settings.token.trim().isNotEmpty) {
      dio.options.headers['Authorization'] = 'Bearer ${settings.token.trim()}';
    }
    if (settings.userToken.trim().isNotEmpty) {
      dio.options.headers['X-Now-User-Token'] = settings.userToken.trim();
    }
    return dio;
  }

  Dio _dioWithoutUserToken(ServerSettings settings) {
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

String _normalizeOwnerId(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? 'local_user' : trimmed;
}

Future<String> _loadServerToken(SharedPreferences prefs) async {
  return _loadSecureToken(prefs, key: _serverTokenKey);
}

Future<String> _loadSecureToken(
  SharedPreferences prefs, {
  required String key,
}) async {
  final secureToken = await _secureStorage.read(key: key);
  if (secureToken != null && secureToken.isNotEmpty) {
    await prefs.remove(key);
    return secureToken;
  }

  final legacyToken = prefs.getString(key)?.trim() ?? '';
  if (legacyToken.isNotEmpty) {
    await _secureStorage.write(key: key, value: legacyToken);
    await prefs.remove(key);
  }
  return legacyToken;
}

Future<void> _saveSecureToken(
  String token,
  SharedPreferences prefs, {
  required String key,
}) async {
  await prefs.remove(key);
  if (token.isEmpty) {
    await _secureStorage.delete(key: key);
    return;
  }
  await _secureStorage.write(key: key, value: token);
}

String? _blankToNull(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
}

ServerUserProfile _profileFromResponse(Map<String, dynamic>? data) {
  final user = Map<String, dynamic>.from((data?['user'] as Map?) ?? const {});
  return ServerUserProfile.fromJson(user);
}

ServerPublicReadiness? _publicReadinessFromResponse(
  Map<String, dynamic>? data,
) {
  final raw = data?['public_server_readiness'];
  if (raw is! Map) return null;
  return ServerPublicReadiness.fromJson(Map<String, dynamic>.from(raw));
}

String _serverConnectionMessage(
  String name,
  bool authRequired,
  Map<String, dynamic> capabilities,
  ServerPublicReadiness? publicReadiness,
) {
  final sync = capabilities['sync'] == true ? '동기화 지원' : '동기화 미확인';
  final maxLevel = capabilities['max_tree_note_level'];
  final levelText = maxLevel is int ? '계층 $maxLevel단계' : '계층 확인';
  final userText = capabilities['user_profile'] == true
      ? '사용자 프로필'
      : '사용자 미확인';
  final timezoneText = capabilities['user_timezone'] == true ? '시간대' : '시간대 미확인';
  final groupText = capabilities['user_groups'] == true ? '사용자 그룹' : '그룹 미확인';
  final twoFactorText = capabilities['two_factor_status'] == true
      ? '2단계 상태'
      : '2단계 미확인';
  final twoFactorAuth = capabilities['two_factor_auth'];
  final twoFactorAuthText = twoFactorAuth == 'token_code'
      ? '2단계 인증'
      : (twoFactorAuth == 'planned' ? '2단계 예정' : '2단계 인증 미확인');
  final backupText = capabilities['backup_export'] == true ? '백업' : '백업 미확인';
  final backupVerifyText = capabilities['backup_verify'] == true
      ? '백업 검증'
      : '검증 미확인';
  final publicReadinessText = publicReadiness?.summary ?? '';
  final authText = authRequired ? '토큰 필요' : '토큰 선택';
  return [
    '$name 연결됨',
    authText,
    sync,
    levelText,
    userText,
    timezoneText,
    groupText,
    twoFactorText,
    twoFactorAuthText,
    backupText,
    backupVerifyText,
    publicReadinessText,
  ].where((item) => item.isNotEmpty).join(' · ');
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
