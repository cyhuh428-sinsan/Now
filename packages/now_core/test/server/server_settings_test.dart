import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:now_core/server/server_settings.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('순수 헬퍼', () {
    test('normalizeBaseUrl은 끝 슬래시만 뗀다', () {
      expect(normalizeBaseUrl('http://server.test:8750/'), 'http://server.test:8750');
      expect(normalizeBaseUrl('  http://server.test:8750  '), 'http://server.test:8750');
      expect(normalizeBaseUrl('http://server.test/api/'), 'http://server.test/api');
    });

    test('normalizeOwnerId는 빈 값을 local_user로 맞춘다', () {
      expect(normalizeOwnerId(''), 'local_user');
      expect(normalizeOwnerId('   '), 'local_user');
      expect(normalizeOwnerId(' cyhuh '), 'cyhuh');
    });

    test('parseSyncTime은 형식이 아니면 null이다', () {
      expect(parseSyncTime(null), isNull);
      expect(parseSyncTime(''), isNull);
      expect(parseSyncTime('not-a-date'), isNull);
      expect(parseSyncTime('2026-05-31T00:10:00'), DateTime.parse('2026-05-31T00:10:00'));
    });
  });

  group('저장/불러오기', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('save 후 load가 같은 값을 돌려준다', () async {
      final settings = ServerSettings(
        enabled: true,
        baseUrl: 'http://server.test:8750/',
        token: 'legacy-api-token',
        userToken: 'user-token-abc',
        webSessionToken: 'web-session-xyz',
        ownerId: 'cyhuh',
        deviceId: 'android-unit-test',
        lastSyncedAt: DateTime(2026, 5, 30, 12, 0, 0),
      );
      await settings.save();

      final loaded = await ServerSettings.load();
      expect(loaded.enabled, true);
      expect(loaded.baseUrl, 'http://server.test:8750'); // 정규화되어 저장된다
      expect(loaded.token, 'legacy-api-token');
      expect(loaded.userToken, 'user-token-abc');
      expect(loaded.webSessionToken, 'web-session-xyz');
      expect(loaded.ownerId, 'cyhuh');
      expect(loaded.deviceId, 'android-unit-test');
      expect(loaded.lastSyncedAt, DateTime(2026, 5, 30, 12, 0, 0));
    });

    test('설정이 없으면 ownerId는 local_user, deviceId는 자동 생성된다', () async {
      final loaded = await ServerSettings.load();
      expect(loaded.ownerId, 'local_user');
      expect(loaded.deviceId, isNotEmpty);
      expect(loaded.enabled, false);
      expect(loaded.isConfigured, false);
    });

    test('lastSyncedAt을 지우면 다음 load에서 null이다', () async {
      final settings = ServerSettings(
        enabled: true,
        baseUrl: 'http://server.test:8750',
        token: '',
        userToken: '',
        webSessionToken: '',
        ownerId: 'cyhuh',
        deviceId: 'android-unit-test',
        lastSyncedAt: DateTime(2026, 5, 30),
      );
      await settings.save();
      await settings.copyWith(clearLastSyncedAt: true).save();

      final loaded = await ServerSettings.load();
      expect(loaded.lastSyncedAt, isNull);
    });

    test('copyWith는 넘기지 않은 값을 그대로 유지한다', () {
      final settings = ServerSettings(
        enabled: true,
        baseUrl: 'http://server.test:8750',
        token: 't',
        userToken: 'u',
        webSessionToken: 'w',
        ownerId: 'cyhuh',
        deviceId: 'device-1',
        lastSyncedAt: DateTime(2026, 5, 30),
      );
      final next = settings.copyWith(userToken: 'u2');
      expect(next.userToken, 'u2');
      expect(next.baseUrl, settings.baseUrl);
      expect(next.ownerId, settings.ownerId);
      expect(next.lastSyncedAt, settings.lastSyncedAt);
    });
  });

  group('토큰은 보안 저장소에 저장된다', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('저장한 토큰이 SharedPreferences에 평문으로 남지 않는다', () async {
      final settings = ServerSettings(
        enabled: true,
        baseUrl: 'http://server.test:8750',
        token: 'legacy-api-token',
        userToken: 'user-token-abc',
        webSessionToken: 'web-session-xyz',
        ownerId: 'cyhuh',
        deviceId: 'android-unit-test',
        lastSyncedAt: null,
      );
      await settings.save();

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('now_server_token'), isNull);
      expect(prefs.getString('now_server_user_token'), isNull);
      expect(prefs.getString('now_server_web_session_token'), isNull);

      const storage = FlutterSecureStorage();
      expect(await storage.read(key: 'now_server_token'), 'legacy-api-token');
      expect(await storage.read(key: 'now_server_user_token'), 'user-token-abc');
      expect(
        await storage.read(key: 'now_server_web_session_token'),
        'web-session-xyz',
      );
    });

    test('빈 문자열로 저장하면 보안 저장소에서 지워진다', () async {
      final settings = ServerSettings(
        enabled: true,
        baseUrl: 'http://server.test:8750',
        token: 'legacy-api-token',
        userToken: '',
        webSessionToken: '',
        ownerId: 'cyhuh',
        deviceId: 'android-unit-test',
        lastSyncedAt: null,
      );
      await settings.save();

      const storage = FlutterSecureStorage();
      expect(await storage.read(key: 'now_server_user_token'), isNull);
      expect(await storage.read(key: 'now_server_web_session_token'), isNull);
      expect(await storage.read(key: 'now_server_token'), 'legacy-api-token');
    });
  });

  group('옛 토큰 이관', () {
    setUp(() {
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('SharedPreferences에 평문으로 남은 옛 토큰을 보안 저장소로 옮긴다', () async {
      // 2.3.5 이전 버전은 사용자 토큰을 SharedPreferences에 평문으로 저장했다.
      SharedPreferences.setMockInitialValues({
        'now_server_user_token': 'legacy-plain-user-token',
      });

      final loaded = await ServerSettings.load();
      expect(loaded.userToken, 'legacy-plain-user-token');

      // 평문 값은 지워지고, 보안 저장소로 옮겨져 있어야 한다.
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('now_server_user_token'), isNull);

      const storage = FlutterSecureStorage();
      expect(
        await storage.read(key: 'now_server_user_token'),
        'legacy-plain-user-token',
      );

      // 다시 불러와도 같은 값이 나온다(이관이 한 번만 일어나도 문제 없다).
      final loadedAgain = await ServerSettings.load();
      expect(loadedAgain.userToken, 'legacy-plain-user-token');
    });

    test('보안 저장소에 이미 값이 있으면 옛 평문 값을 쓰지 않는다', () async {
      FlutterSecureStorage.setMockInitialValues({
        'now_server_user_token': 'secure-value',
      });
      SharedPreferences.setMockInitialValues({
        'now_server_user_token': 'stale-legacy-value',
      });

      final loaded = await ServerSettings.load();
      expect(loaded.userToken, 'secure-value');
    });
  });
}
