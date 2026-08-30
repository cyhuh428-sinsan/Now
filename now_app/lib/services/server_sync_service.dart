import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:now_core/now_core.dart';
import '../core/network/dio_client.dart';
import '../repositories/repository_providers.dart';

// ServerSettings / ServerConnectionResult / ServerPublicReadiness는
// now_core로 옮겼다(2.3.6 P1). ServerSyncResult는 노트 동기화와 함께
// now_core로 옮겼다(2.3.6 P2). ServerUserProfile은 사용자 프로필과 함께
// now_core로 옮겼다(2.3.6 P3). 화면 코드가 이 파일 import 하나로 계속
// 그 타입들을 쓸 수 있도록 다시 내보낸다.
export 'package:now_core/now_core.dart'
    show
        ServerSettings,
        ServerConnectionResult,
        ServerPublicReadiness,
        ServerSyncResult,
        ServerUserProfile,
        ServerRecordingUploadResult,
        ServerRecording,
        ServerMessengerRoom,
        ServerMessengerMessage,
        ServerMessengerRoomsResult,
        ServerMessengerMessagesResult;

const _serverDeletedTreeMemosKey = 'now_server_deleted_tree_memos';

// U18의 서버 주소/토큰 저장 키(now_core의 `ServerSettings`)와 별도로 둔다.
// "이전에 연결에 성공한 서버 정보"는 Now 로컬에서만 쓰는 저장소다(NowNote의
// `server_settings_service.dart`가 자기 키를 따로 쓰는 것과 같은 이유).
const _knownServerNameKey = 'now_known_server_name';
const _knownApiVersionKey = 'now_known_api_version';

/// 사설 네트워크 연결 판정 절차에서 실패한 단계.
///
/// `docs/NOW_2_3_6_PRIVATE_NETWORK_CONNECTION.md`의 "클라이언트 판정 절차"를
/// 그대로 따른다: `/health` → `/health/ready` → `/api/v1/server` 순서로
/// 호출하고, 먼저 실패한 단계에서 멈춘다. NowNote의 `server_settings_service.dart`와
/// 같은 이름으로 둔다.
enum ProbeFailureStage { health, ready, serverInfo }

/// [ServerSyncService.probeConnection]의 결과.
///
/// [ok]가 true여도 [serverMismatch]가 true이면 이전에 저장해 둔 서버 정보와
/// 값이 달라 사용자에게 경고를 보여줘야 한다는 뜻이다 — 문서 원칙대로 연결을
/// 막지는 않는다.
class ConnectionProbeResult {
  final bool ok;
  final ProbeFailureStage? failedStage;
  final String message;
  final bool serverMismatch;
  final String serverName;
  final String apiVersion;

  const ConnectionProbeResult({
    required this.ok,
    this.failedStage,
    required this.message,
    this.serverMismatch = false,
    this.serverName = '',
    this.apiVersion = '',
  });
}

final serverSettingsProvider = FutureProvider.autoDispose<ServerSettings>((
  ref,
) async {
  return ServerSettings.load();
});

final serverSyncServiceProvider = Provider<ServerSyncService>((ref) {
  final db = ref.watch(noteDatabaseProvider);
  return ServerSyncService(db);
});

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

class ServerSyncService {
  final NoteDatabase _db;

  const ServerSyncService(this._db);

  // testConnection / createWebSession의 실제 요청과 사용자 토큰 검증
  // (_verifyUserToken)은 now_core의 ServerConnectionApi로 옮겼다(2.3.6 P1).
  // 헤더 구성(_dio / _dioWithoutUserToken)은 다른 메서드들도 같이 쓰므로
  // 여기 그대로 두고, 만든 Dio를 넘겨주기만 한다.
  Future<ServerConnectionResult> testConnection(
    ServerSettings settings, {
    String twoFactorCode = '',
  }) {
    return ServerConnectionApi.testConnection(
      dio: _dio(settings),
      dioWithoutUserToken: _dioWithoutUserToken(settings),
      settings: settings,
      twoFactorCode: twoFactorCode,
    );
  }

  Future<ServerSyncResult> uploadNotes(ServerSettings settings) async {
    return syncNotes(settings);
  }

  @visibleForTesting
  Future<void> applyPulledNotesForTest(
    ServerSettings settings,
    List<dynamic> pulledNotes,
  ) async {
    final cleared = await ServerNoteSyncApi.applyPulledNotes(
      db: _db,
      settings: settings,
      pulledNotes: pulledNotes,
    );
    if (cleared.isNotEmpty) {
      await _clearPendingDeletedTreeMemos(cleared);
    }
  }

  Future<ServerSettings> createWebSession(
    ServerSettings settings, {
    required String password,
    String twoFactorCode = '',
  }) {
    return ServerConnectionApi.createWebSession(
      dioWithoutUserToken: _dioWithoutUserToken(settings),
      settings: settings,
      password: password,
      twoFactorCode: twoFactorCode,
    );
  }

  /// `docs/NOW_2_3_6_PRIVATE_NETWORK_CONNECTION.md`의 3단계 절차를 순서대로
  /// 실행한다. `/health` → `/health/ready` → `/api/v1/server` 순서로 호출하고
  /// 먼저 실패한 단계에서 멈춘다. 사용자 토큰 검증이나 로그인은 하지 않는다 —
  /// 그 부분은 지금처럼 [testConnection]/[createWebSession]이 맡는다.
  ///
  /// 3단계 자체는 now_core의 `ServerConnectionApi.probeConnectionSteps`를 그대로
  /// 쓴다(NowNote도 같은 함수를 쓴다 — 어느 클라이언트로 연결해도 판정 기준이
  /// 같아야 한다). "이전에 저장해 둔 서버와 다른가" 비교와 그 저장만 여기서 한다.
  Future<ConnectionProbeResult> probeConnection(ServerSettings settings) async {
    final steps = await ServerConnectionApi.probeConnectionSteps(
      dioWithoutUserToken: _dioWithoutUserToken(settings),
      settings: settings,
    );
    if (!steps.ok) {
      return ConnectionProbeResult(
        ok: false,
        failedStage: _toProbeFailureStage(steps.failedStage),
        message: steps.message,
      );
    }

    final prefs = await SharedPreferences.getInstance();
    final knownName = prefs.getString(_knownServerNameKey);
    final knownApiVersion = prefs.getString(_knownApiVersionKey);
    final isFirstConnection = knownName == null || knownName.trim().isEmpty;
    final mismatch =
        !isFirstConnection &&
        (knownName != steps.serverName ||
            (knownApiVersion ?? '') != steps.apiVersion);

    await prefs.setString(_knownServerNameKey, steps.serverName);
    await prefs.setString(_knownApiVersionKey, steps.apiVersion);

    return ConnectionProbeResult(
      ok: true,
      message: mismatch ? '이 주소는 다른 서버로 보입니다. 주소를 다시 확인하세요' : '연결 성공',
      serverMismatch: mismatch,
      serverName: steps.serverName,
      apiVersion: steps.apiVersion,
    );
  }

  ProbeFailureStage? _toProbeFailureStage(ConnectionProbeStage? stage) {
    switch (stage) {
      case ConnectionProbeStage.health:
        return ProbeFailureStage.health;
      case ConnectionProbeStage.ready:
        return ProbeFailureStage.ready;
      case ConnectionProbeStage.serverInfo:
        return ProbeFailureStage.serverInfo;
      case null:
        return null;
    }
  }

  // syncNotes()의 실제 payload 구성/요청/pull 반영은 now_core의
  // ServerNoteSyncApi로 옮겼다(2.3.6 P2). 삭제 대기 계층 메모 저장소
  // (SharedPreferences) 접근만 이 계층에 남긴다 — now_core가 그 저장소
  // 접근 방식을 정하지 않도록 하기 위해서다(M2와 같은 판단).
  Future<ServerSyncResult> syncNotes(
    ServerSettings settings, {
    bool fullSync = false,
  }) async {
    final pendingDeletedTreeMemos = await _loadDeletedTreeMemos();
    final outcome = await ServerNoteSyncApi.syncNotes(
      dio: _dio(settings),
      db: _db,
      settings: settings,
      pendingDeletedTreeMemos: pendingDeletedTreeMemos,
      fullSync: fullSync,
    );
    if (outcome.clearedDeletedTreeMemoIds.isNotEmpty) {
      await _clearPendingDeletedTreeMemos(outcome.clearedDeletedTreeMemoIds);
    }
    return outcome.result;
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
    current[memoId] = buildDeletedTreeMemoEntry(
      deletedAt: deletedAt ?? DateTime.now(),
      level: level,
      parentLocalId: parentLocalId,
      tags: tags,
      title: title,
      content: content,
    );
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

  // loadUserProfile / saveUserProfile의 실제 요청/응답 처리는 now_core의
  // ServerProfileApi로 옮겼다(2.3.6 P3). 헤더 구성(_dio)은 다른 메서드들도
  // 같이 쓰므로 여기 그대로 두고, 만든 Dio를 넘겨주기만 한다.
  Future<ServerUserProfile> loadUserProfile(ServerSettings settings) {
    return ServerProfileApi.loadUserProfile(
      dio: _dio(settings),
      settings: settings,
    );
  }

  Future<ServerUserProfile> saveUserProfile(
    ServerSettings settings, {
    required String? email,
    required String? displayName,
    required String timezone,
  }) {
    return ServerProfileApi.saveUserProfile(
      dio: _dio(settings),
      settings: settings,
      email: email,
      displayName: displayName,
      timezone: timezone,
    );
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

  // uploadRecordingFile / loadRecordings의 실제 요청/응답 처리는 now_core의
  // ServerRecordingApi로 옮겼다(2.3.6 P4). 헤더 구성(_dio)은 다른 메서드들도
  // 같이 쓰므로 여기 그대로 두고, 만든 Dio를 넘겨주기만 한다.
  Future<ServerRecordingUploadResult> uploadRecordingFile(
    ServerSettings settings, {
    required String filePath,
    required String localId,
    required String? noteLocalId,
    required String? transcript,
  }) {
    return ServerRecordingApi.uploadRecordingFile(
      dio: _dio(settings),
      settings: settings,
      filePath: filePath,
      localId: localId,
      noteLocalId: noteLocalId,
      transcript: transcript,
    );
  }

  Future<List<ServerRecording>> loadRecordings(ServerSettings settings) {
    return ServerRecordingApi.loadRecordings(
      dio: _dio(settings),
      settings: settings,
    );
  }

  // loadMessengerRooms / loadMessengerMessages / sendMessengerMessage /
  // markMessengerRoomRead의 실제 요청/응답 처리는 now_core의
  // ServerMessengerApi로 옮겼다(2.3.6 P5). 메신저 전용 헤더 구성(_messengerDio)은
  // 다른 메서드들이 쓰는 _dio와 같은 이유로 여기 그대로 두고, 만든 Dio를
  // 넘겨주기만 한다.
  Future<ServerMessengerRoomsResult> loadMessengerRooms(
    ServerSettings settings,
  ) {
    return ServerMessengerApi.loadMessengerRooms(
      dio: _messengerDio(settings),
      settings: settings,
    );
  }

  Future<ServerMessengerMessagesResult> loadMessengerMessages(
    ServerSettings settings, {
    required int roomId,
  }) {
    return ServerMessengerApi.loadMessengerMessages(
      dio: _messengerDio(settings),
      settings: settings,
      roomId: roomId,
    );
  }

  Future<ServerMessengerMessage> sendMessengerMessage(
    ServerSettings settings, {
    required int roomId,
    required String body,
  }) {
    return ServerMessengerApi.sendMessengerMessage(
      dio: _messengerDio(settings),
      settings: settings,
      roomId: roomId,
      body: body,
    );
  }

  Future<void> markMessengerRoomRead(
    ServerSettings settings, {
    required int roomId,
    required int lastReadMessageId,
  }) {
    return ServerMessengerApi.markMessengerRoomRead(
      dio: _messengerDio(settings),
      settings: settings,
      roomId: roomId,
      lastReadMessageId: lastReadMessageId,
    );
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
        return normalizeDeletedTreeMemos(decoded);
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
    removeDeletedTreeMemos(current, memoIds);
    if (current.isEmpty) {
      await prefs.remove(_serverDeletedTreeMemosKey);
      return;
    }
    await prefs.setString(_serverDeletedTreeMemosKey, jsonEncode(current));
  }

  Dio _dio(ServerSettings settings) {
    final dio = DioClient.create(baseUrl: _normalizeBaseUrl(settings.baseUrl));
    if (settings.token.trim().isNotEmpty) {
      // 구형 개인 서버 호환용 NOW_API_TOKEN 흐름이다.
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
      // 구형 개인 서버 호환용 NOW_API_TOKEN 흐름이다.
      dio.options.headers['Authorization'] = 'Bearer ${settings.token.trim()}';
    }
    return dio;
  }

  Dio _messengerDio(ServerSettings settings) {
    final dio = _dio(settings);
    final sessionToken = settings.webSessionToken.trim();
    if (sessionToken.isNotEmpty) {
      dio.options.headers['X-Now-Web-Session'] = sessionToken;
    }
    return dio;
  }
}

// syncNotes()의 판단 규칙(_shouldSkipServerSyncRequest)은 now_core의
// shouldSkipServerSyncRequest로 옮겼다(2.3.6 P2). 기존 테스트가 이 이름으로
// 계속 부를 수 있도록 위임만 남긴다.
@visibleForTesting
bool shouldSkipServerSyncRequestForTest(
  List<Map<String, dynamic>> notes,
  bool fullSync,
  DateTime? lastSyncedAt,
) {
  return shouldSkipServerSyncRequest(notes, fullSync, lastSyncedAt);
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

String? _blankToNull(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
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
