import 'package:dio/dio.dart';

import 'server_settings.dart';

/// 연결 테스트(`testConnection`) 결과.
class ServerConnectionResult {
  final bool ok;
  final String message;
  final String serverName;
  final Map<String, dynamic> capabilities;
  final ServerPublicReadiness? publicReadiness;
  final String apiVersion;

  const ServerConnectionResult({
    required this.ok,
    required this.message,
    this.serverName = '',
    this.capabilities = const {},
    this.publicReadiness,
    this.apiVersion = '',
  });
}

/// [ServerConnectionApi.probeConnectionSteps]에서 판정에 실패한 단계.
enum ConnectionProbeStage { health, ready, serverInfo }

/// [ServerConnectionApi.probeConnectionSteps]의 결과.
class ConnectionProbeStepsResult {
  final bool ok;
  final ConnectionProbeStage? failedStage;
  final String message;
  final String serverName;
  final String apiVersion;

  const ConnectionProbeStepsResult({
    required this.ok,
    this.failedStage,
    required this.message,
    this.serverName = '',
    this.apiVersion = '',
  });
}

/// 서버가 `/api/v1/server` 응답에 담아 주는 공용 서버 준비 상태.
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

/// 서버 연결 테스트와 사용자 토큰/비밀번호 인증을 담당한다.
///
/// 화면을 갖지 않는다. Dio 인스턴스(헤더 구성 포함)는 호출하는 쪽이 만들어
/// 넘긴다 — 옛 개인 서버 호환용 `Authorization` 헤더나 `X-Now-User-Token`
/// 헤더를 붙이는 규칙은 이 계층이 아니라 호출하는 쪽(now_app)의 몫이다.
class ServerConnectionApi {
  const ServerConnectionApi._();

  /// `GET /api/v1/server`로 서버 상태를 확인한다.
  ///
  /// 이 경로는 인증 없이 열려 있다. 사용자 토큰이 설정돼 있으면 이어서
  /// [dioWithoutUserToken]으로 토큰을 검증한다.
  static Future<ServerConnectionResult> testConnection({
    required Dio dio,
    required Dio dioWithoutUserToken,
    required ServerSettings settings,
    String twoFactorCode = '',
  }) async {
    if (!settings.isConfigured) {
      return const ServerConnectionResult(ok: false, message: '서버 주소가 없습니다');
    }
    try {
      final res = await dio.get<Map<String, dynamic>>('/api/v1/server');
      final name = res.data?['server']?.toString() ?? 'NowNote Server';
      final apiVersion = res.data?['api_version']?.toString() ?? '';
      final authRequired = res.data?['auth_required'] == true;
      final capabilities = Map<String, dynamic>.from(
        (res.data?['capabilities'] as Map?) ?? const {},
      );
      final publicReadiness = _publicReadinessFromResponse(res.data);
      if (settings.userToken.trim().isNotEmpty) {
        await _verifyUserToken(
          dioWithoutUserToken: dioWithoutUserToken,
          settings: settings,
          twoFactorCode: twoFactorCode,
        );
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
        apiVersion: apiVersion,
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

  /// `docs/NOW_2_3_6_PRIVATE_NETWORK_CONNECTION.md`의 3단계 판정 절차.
  ///
  /// `/health` → `/health/ready` → `/api/v1/server` 순서로 호출하고 먼저
  /// 실패한 단계에서 멈춘다. 이 세 경로는 인증이 없으므로 [dioWithoutUserToken]으로
  /// 부른다.
  ///
  /// "이 서버가 이전에 연결한 그 서버가 맞는지"(재연결 시 이름 불일치 경고)는
  /// 여기서 판단하지 않는다 — 그 정보를 어디에 저장할지는 앱마다 다르므로
  /// (NowNote·Now 앱이 각자 다른 저장소 키를 쓴다) 호출하는 쪽이
  /// [ConnectionProbeStepsResult.serverName]/[apiVersion]을 받아 직접 비교하고
  /// 저장한다(`note_sync.dart`류 계층이 저장소 접근을 밖에 두는 것과 같은 이유).
  static Future<ConnectionProbeStepsResult> probeConnectionSteps({
    required Dio dioWithoutUserToken,
    required ServerSettings settings,
  }) async {
    if (!settings.isConfigured) {
      return const ConnectionProbeStepsResult(
        ok: false,
        failedStage: ConnectionProbeStage.health,
        message: '서버 주소가 없습니다',
      );
    }

    final healthy = await _probeGet(dioWithoutUserToken, '/health');
    if (!healthy) {
      return const ConnectionProbeStepsResult(
        ok: false,
        failedStage: ConnectionProbeStage.health,
        message: '서버에 연결할 수 없습니다',
      );
    }

    final ready = await _probeGet(dioWithoutUserToken, '/health/ready');
    if (!ready) {
      return const ConnectionProbeStepsResult(
        ok: false,
        failedStage: ConnectionProbeStage.ready,
        message: '서버가 시작 중입니다. 잠시 후 다시 시도하세요',
      );
    }

    Map<String, dynamic>? data;
    try {
      final res = await dioWithoutUserToken.get<Map<String, dynamic>>(
        '/api/v1/server',
      );
      if (res.statusCode != 200) {
        return const ConnectionProbeStepsResult(
          ok: false,
          failedStage: ConnectionProbeStage.serverInfo,
          message: '서버 정보를 확인할 수 없습니다',
        );
      }
      data = res.data;
    } catch (_) {
      return const ConnectionProbeStepsResult(
        ok: false,
        failedStage: ConnectionProbeStage.serverInfo,
        message: '서버 정보를 확인할 수 없습니다',
      );
    }

    return ConnectionProbeStepsResult(
      ok: true,
      message: '연결 성공',
      serverName: data?['server']?.toString() ?? '',
      apiVersion: data?['api_version']?.toString() ?? '',
    );
  }

  static Future<bool> _probeGet(Dio dio, String path) async {
    try {
      final res = await dio.get<dynamic>(path);
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// 서버 비밀번호로 메신저 세션 토큰을 발급받아 [settings]에 반영하고 저장한다.
  static Future<ServerSettings> createWebSession({
    required Dio dioWithoutUserToken,
    required ServerSettings settings,
    required String password,
    String twoFactorCode = '',
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final trimmedPassword = password.trim();
    if (trimmedPassword.isEmpty) {
      throw Exception('서버 비밀번호를 입력하세요');
    }
    try {
      final data = <String, dynamic>{
        'owner_id': normalizeOwnerId(settings.ownerId),
        'password': trimmedPassword,
        'device_id': settings.deviceId.trim().isEmpty
            ? 'android'
            : settings.deviceId.trim(),
      };
      final code = twoFactorCode.trim();
      if (code.isNotEmpty) {
        data['two_factor_code'] = code;
      }
      final res = await dioWithoutUserToken.post<Map<String, dynamic>>(
        '/api/v1/auth/web-login',
        data: data,
      );
      final sessionToken = res.data?['session_token']?.toString() ?? '';
      if (sessionToken.trim().isEmpty) {
        throw Exception('서버 응답에 메신저 세션이 없습니다');
      }
      final nextSettings = settings.copyWith(webSessionToken: sessionToken);
      await nextSettings.save();
      return nextSettings;
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '메신저 세션 연결 실패'));
    }
  }

  static Future<void> _verifyUserToken({
    required Dio dioWithoutUserToken,
    required ServerSettings settings,
    required String twoFactorCode,
  }) async {
    final data = <String, dynamic>{
      'owner_id': normalizeOwnerId(settings.ownerId),
      'access_token': settings.userToken.trim(),
    };
    final code = twoFactorCode.trim();
    if (code.isNotEmpty) {
      data['two_factor_code'] = code;
    }
    await dioWithoutUserToken.post<Map<String, dynamic>>(
      '/api/v1/auth/token-login',
      data: data,
    );
  }
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

// now_core와 now_app이 서로 다른 dio 버전을 해석할 수 있어 DioExceptionType은
// 보지 않는다. 상태 코드와 응답 본문만으로 메시지를 만든다.
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
