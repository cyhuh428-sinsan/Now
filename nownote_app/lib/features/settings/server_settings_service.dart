import 'package:dio/dio.dart';
import 'package:now_core/now_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/network/dio_client.dart';
import '../tree/tree_repository.dart';

/// 사설 네트워크 연결 판정 절차에서 실패한 단계.
///
/// `docs/NOW_2_3_6_PRIVATE_NETWORK_CONNECTION.md`의 "클라이언트 판정 절차"를
/// 그대로 따른다: `/health` → `/health/ready` → `/api/v1/server` 순서로
/// 호출하고, 먼저 실패한 단계에서 멈춘다.
enum ProbeFailureStage { health, ready, serverInfo }

/// [ServerSettingsService.probeConnection]의 결과.
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

/// NowNote 쪽 서버 설정 화면이 쓰는 데이터 접근 계층.
///
/// Now의 `server_sync_service.dart`가 하던 역할 중 연결 테스트/로그인
/// 부분만 옮겨 놓았다(`ServerSettings` 읽기/쓰기, Dio 헤더 구성,
/// `ServerConnectionApi` 호출). 화면은 이 서비스만 보고
/// `ServerConnectionApi`/`ServerSettings`를 직접 부르지 않는다.
///
/// [dioBuilder]/[dioWithoutUserTokenBuilder]는 테스트에서 `HttpClientAdapter`를
/// 목으로 바꾼 Dio를 주입하기 위한 훅이다. 기본값은 실제 서버로 나가는 Dio를
/// 만든다. 헤더 구성은 `messenger_service.dart`의 `_defaultMessengerDio`와
/// 같은 규칙(구형 개인 서버 토큰, 사용자 토큰)을 따른다.
class ServerSettingsService {
  ServerSettingsService({
    Dio Function(ServerSettings settings)? dioBuilder,
    Dio Function(ServerSettings settings)? dioWithoutUserTokenBuilder,
  }) : _dioBuilder = dioBuilder ?? _defaultDio,
       _dioWithoutUserTokenBuilder =
           dioWithoutUserTokenBuilder ?? _defaultDioWithoutUserToken;

  final Dio Function(ServerSettings settings) _dioBuilder;
  final Dio Function(ServerSettings settings) _dioWithoutUserTokenBuilder;

  // U18의 서버 주소/토큰 저장 키(`server_settings.dart`)와 별도로 둔다.
  // now_core의 `ServerSettings`는 건드리지 않는다 — NowNote 로컬에서만 쓰는
  // "이전에 연결에 성공한 서버 정보" 저장소다.
  static const _knownServerNameKey = 'nownote_known_server_name';
  static const _knownApiVersionKey = 'nownote_known_api_version';

  Future<ServerSettings> loadSettings() => ServerSettings.load();

  Future<void> saveSettings(ServerSettings settings) => settings.save();

  Future<ServerConnectionResult> testConnection(
    ServerSettings settings, {
    String twoFactorCode = '',
  }) {
    return ServerConnectionApi.testConnection(
      dio: _dioBuilder(settings),
      dioWithoutUserToken: _dioWithoutUserTokenBuilder(settings),
      settings: settings,
      twoFactorCode: twoFactorCode,
    );
  }

  /// `docs/NOW_2_3_6_PRIVATE_NETWORK_CONNECTION.md`의 3단계 절차를 순서대로
  /// 실행한다. `/health` → `/health/ready` → `/api/v1/server` 순서로 호출하고
  /// 먼저 실패한 단계에서 멈춘다. 이 메서드는 사용자 토큰 검증이나 로그인은
  /// 하지 않는다 — 그 부분은 지금처럼 [testConnection]/[createWebSession]이
  /// 맡는다.
  Future<ConnectionProbeResult> probeConnection(ServerSettings settings) async {
    if (!settings.isConfigured) {
      return const ConnectionProbeResult(
        ok: false,
        failedStage: ProbeFailureStage.health,
        message: '서버 주소가 없습니다',
      );
    }

    final healthy = await _probeGet(settings, '/health');
    if (!healthy) {
      return const ConnectionProbeResult(
        ok: false,
        failedStage: ProbeFailureStage.health,
        message: '서버에 연결할 수 없습니다',
      );
    }

    final ready = await _probeGet(settings, '/health/ready');
    if (!ready) {
      return const ConnectionProbeResult(
        ok: false,
        failedStage: ProbeFailureStage.ready,
        message: '서버가 시작 중입니다. 잠시 후 다시 시도하세요',
      );
    }

    Map<String, dynamic>? data;
    try {
      final res = await _dioWithoutUserTokenBuilder(
        settings,
      ).get<Map<String, dynamic>>('/api/v1/server');
      if (res.statusCode != 200) {
        return const ConnectionProbeResult(
          ok: false,
          failedStage: ProbeFailureStage.serverInfo,
          message: '서버 정보를 확인할 수 없습니다',
        );
      }
      data = res.data;
    } catch (_) {
      return const ConnectionProbeResult(
        ok: false,
        failedStage: ProbeFailureStage.serverInfo,
        message: '서버 정보를 확인할 수 없습니다',
      );
    }

    final serverName = data?['server']?.toString() ?? '';
    final apiVersion = data?['api_version']?.toString() ?? '';

    final prefs = await SharedPreferences.getInstance();
    final knownName = prefs.getString(_knownServerNameKey);
    final knownApiVersion = prefs.getString(_knownApiVersionKey);
    final isFirstConnection = knownName == null || knownName.trim().isEmpty;
    final mismatch =
        !isFirstConnection &&
        (knownName != serverName || (knownApiVersion ?? '') != apiVersion);

    await prefs.setString(_knownServerNameKey, serverName);
    await prefs.setString(_knownApiVersionKey, apiVersion);

    return ConnectionProbeResult(
      ok: true,
      message: mismatch ? '이 주소는 다른 서버로 보입니다. 주소를 다시 확인하세요' : '연결 성공',
      serverMismatch: mismatch,
      serverName: serverName,
      apiVersion: apiVersion,
    );
  }

  Future<bool> _probeGet(ServerSettings settings, String path) async {
    try {
      final res = await _dioWithoutUserTokenBuilder(settings).get<dynamic>(path);
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<ServerSettings> createWebSession(
    ServerSettings settings, {
    required String password,
    String twoFactorCode = '',
  }) {
    return ServerConnectionApi.createWebSession(
      dioWithoutUserToken: _dioWithoutUserTokenBuilder(settings),
      settings: settings,
      password: password,
      twoFactorCode: twoFactorCode,
    );
  }

  /// 오늘 메모(`Meetings`/`TranscriptSegments`, `recordType='memo'`)와 계층 메모
  /// (`Memos`, `source='note_tree'`)를 서버와 맞춘다.
  ///
  /// 실제 payload 구성/요청/pull 반영은 now_core의 `ServerNoteSyncApi`가 한다
  /// (now_app의 `server_sync_service.dart`가 쓰는 것과 같은 계층) — NowNote와
  /// Now가 같은 스키마(`NoteDatabase`)를 쓰므로 그대로 재사용할 수 있다.
  /// 삭제 대기 계층 메모 저장소 접근만 [treeRepo]를 통해 이 계층에서 처리한다.
  Future<ServerSyncResult> syncNotes({
    required ServerSettings settings,
    required NoteDatabase db,
    required TreeMemoRepository treeRepo,
    bool fullSync = false,
  }) async {
    if (!settings.enabled) {
      return const ServerSyncResult(uploaded: 0, message: '서버 동기화가 꺼져 있습니다');
    }
    if (!settings.isConfigured) {
      return const ServerSyncResult(uploaded: 0, message: '서버 주소가 없습니다');
    }
    final pendingDeletedTreeMemos = await treeRepo.loadPendingDeleted();
    final outcome = await ServerNoteSyncApi.syncNotes(
      dio: _dioBuilder(settings),
      db: db,
      settings: settings,
      pendingDeletedTreeMemos: pendingDeletedTreeMemos,
      fullSync: fullSync,
    );
    if (outcome.clearedDeletedTreeMemoIds.isNotEmpty) {
      await treeRepo.clearPendingDeleted(outcome.clearedDeletedTreeMemoIds);
    }
    return outcome.result;
  }
}

/// Now의 `_dio`(`server_sync_service.dart` 약 443~453번째 줄)와 같은 헤더
/// 구성이다: 구형 개인 서버 토큰(`Authorization`), 사용자 토큰
/// (`X-Now-User-Token`).
Dio _defaultDio(ServerSettings settings) {
  final dio = DioClient.create(baseUrl: normalizeBaseUrl(settings.baseUrl));
  if (settings.token.trim().isNotEmpty) {
    dio.options.headers['Authorization'] = 'Bearer ${settings.token.trim()}';
  }
  if (settings.userToken.trim().isNotEmpty) {
    dio.options.headers['X-Now-User-Token'] = settings.userToken.trim();
  }
  return dio;
}

/// Now의 `_dioWithoutUserToken`(`server_sync_service.dart` 약 455~462번째
/// 줄)과 같다. 사용자 토큰 검증/로그인 요청에는 그 토큰을 미리 붙이지
/// 않는다.
Dio _defaultDioWithoutUserToken(ServerSettings settings) {
  final dio = DioClient.create(baseUrl: normalizeBaseUrl(settings.baseUrl));
  if (settings.token.trim().isNotEmpty) {
    dio.options.headers['Authorization'] = 'Bearer ${settings.token.trim()}';
  }
  return dio;
}
