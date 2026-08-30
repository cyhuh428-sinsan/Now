import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

// 저장 키 이름은 Now 2.3.5부터 쓰던 값과 같다. 바꾸면 이미 기기에 저장된
// 서버 주소와 토큰을 잃는다.
const _serverEnabledKey = 'now_server_enabled';
const _serverBaseUrlKey = 'now_server_base_url';
const _serverTokenKey = 'now_server_token';
const _serverUserTokenKey = 'now_server_user_token';
const _serverWebSessionTokenKey = 'now_server_web_session_token';
const _serverOwnerIdKey = 'now_server_owner_id';
const _serverDeviceIdKey = 'now_server_device_id';
const _serverLastSyncedAtKey = 'now_server_last_synced_at';

const _secureStorage = FlutterSecureStorage();

/// 서버 연결 설정 값 객체.
///
/// 서버 주소·사용자 ID·기기 ID·마지막 동기화 시각은 [SharedPreferences]에 두고,
/// 접속 토큰(옛 개인 서버 토큰, 사용자 토큰, 메신저 세션 토큰)은
/// [FlutterSecureStorage]에 둔다. 옛 버전이 `SharedPreferences`에 평문으로
/// 남겨 둔 토큰이 있으면 [load]가 보안 저장소로 옮기고 평문 키는 지운다.
class ServerSettings {
  final bool enabled;
  final String baseUrl;
  final String token;
  final String userToken;
  final String webSessionToken;
  final String ownerId;
  final String deviceId;
  final DateTime? lastSyncedAt;

  const ServerSettings({
    required this.enabled,
    required this.baseUrl,
    required this.token,
    required this.userToken,
    required this.webSessionToken,
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
    final webSessionToken = await _loadSecureToken(
      prefs,
      key: _serverWebSessionTokenKey,
    );
    return ServerSettings(
      enabled: prefs.getBool(_serverEnabledKey) ?? false,
      baseUrl: prefs.getString(_serverBaseUrlKey) ?? '',
      token: token,
      userToken: userToken,
      webSessionToken: webSessionToken,
      ownerId: normalizeOwnerId(
        prefs.getString(_serverOwnerIdKey) ?? 'local_user',
      ),
      deviceId: prefs.getString(_serverDeviceIdKey) ?? '',
      lastSyncedAt: parseSyncTime(prefs.getString(_serverLastSyncedAtKey)),
    );
  }

  Future<void> save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_serverEnabledKey, enabled);
    await prefs.setString(_serverBaseUrlKey, normalizeBaseUrl(baseUrl));
    await _saveSecureToken(token.trim(), prefs, key: _serverTokenKey);
    await _saveSecureToken(
      userToken.trim(),
      prefs,
      key: _serverUserTokenKey,
    );
    await _saveSecureToken(
      webSessionToken.trim(),
      prefs,
      key: _serverWebSessionTokenKey,
    );
    await prefs.setString(_serverOwnerIdKey, normalizeOwnerId(ownerId));
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
    String? webSessionToken,
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
      webSessionToken: webSessionToken ?? this.webSessionToken,
      ownerId: ownerId ?? this.ownerId,
      deviceId: deviceId ?? this.deviceId,
      lastSyncedAt: clearLastSyncedAt
          ? null
          : (lastSyncedAt ?? this.lastSyncedAt),
    );
  }
}

/// 서버 주소를 정규화한다. 끝의 `/`만 뗀다.
///
/// 화면과 동기화 계층이 같은 규칙을 쓰도록 공개해 둔다.
String normalizeBaseUrl(String value) {
  final trimmed = value.trim();
  if (trimmed.endsWith('/')) {
    return trimmed.substring(0, trimmed.length - 1);
  }
  return trimmed;
}

/// 소유자 id가 비어 있으면 `local_user`로 맞춘다.
String normalizeOwnerId(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? 'local_user' : trimmed;
}

/// 서버가 준 시각 문자열을 파싱한다. 형식이 아니면 null.
DateTime? parseSyncTime(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.tryParse(value);
}

Future<String> _loadServerToken(SharedPreferences prefs) async {
  return _loadSecureToken(prefs, key: _serverTokenKey);
}

/// 보안 저장소에서 토큰을 읽는다.
///
/// 옛 버전이 `SharedPreferences`에 평문으로 남긴 토큰이 있으면 보안 저장소로
/// 옮기고 평문 값은 지운다(옛 토큰 이관).
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
