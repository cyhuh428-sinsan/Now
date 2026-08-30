import 'package:dio/dio.dart';

import 'server_settings.dart';

/// `/api/v1/users/{owner_id}` 응답으로 받는 사용자 프로필.
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

/// 사용자 프로필 조회/저장을 담당한다.
///
/// 화면을 갖지 않는다. Dio 인스턴스(헤더 구성 포함)는 호출하는 쪽이 만들어
/// 넘긴다 — `server/server_connection.dart`와 같은 패턴이다.
class ServerProfileApi {
  const ServerProfileApi._();

  /// `GET /api/v1/users/{owner_id}`로 사용자 프로필을 조회한다.
  static Future<ServerUserProfile> loadUserProfile({
    required Dio dio,
    required ServerSettings settings,
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    try {
      final ownerId = normalizeOwnerId(settings.ownerId);
      final res = await dio.get<Map<String, dynamic>>(
        '/api/v1/users/${Uri.encodeComponent(ownerId)}',
      );
      return _profileFromResponse(res.data);
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '사용자 프로필 조회 실패'));
    }
  }

  /// `PATCH /api/v1/users/{owner_id}`로 사용자 프로필을 저장한다.
  ///
  /// 서버에 아직 사용자 레코드가 없으면(404) 먼저 조회를 한 번 보내 만들고
  /// 다시 저장을 시도한다 — 기존 동작을 그대로 유지한다.
  static Future<ServerUserProfile> saveUserProfile({
    required Dio dio,
    required ServerSettings settings,
    required String? email,
    required String? displayName,
    required String timezone,
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final ownerId = normalizeOwnerId(settings.ownerId);
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
}

ServerUserProfile _profileFromResponse(Map<String, dynamic>? data) {
  final user = Map<String, dynamic>.from((data?['user'] as Map?) ?? const {});
  return ServerUserProfile.fromJson(user);
}

String? _blankToNull(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
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
