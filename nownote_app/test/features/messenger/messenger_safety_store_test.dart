import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/messenger/messenger_safety_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

ServerSettings _settings(String baseUrl, String ownerId) => ServerSettings(
  enabled: true,
  baseUrl: baseUrl,
  token: '',
  userToken: '',
  webSessionToken: '',
  ownerId: ownerId,
  deviceId: 'test-device',
  lastSyncedAt: null,
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('차단 목록은 재생성 후에도 유지되고 서버와 사용자별로 분리된다', () async {
    final prefs = await SharedPreferences.getInstance();
    final first = MessengerSafetyStore(prefs);
    final account = _settings('https://one.test', 'alice');

    await first.blockOwner(account, 'bob');

    final reopened = MessengerSafetyStore(prefs);
    expect(await reopened.blockedOwnerIds(account), {'bob'});
    expect(
      await reopened.blockedOwnerIds(_settings('https://one.test', 'eve')),
      isEmpty,
    );
    expect(
      await reopened.blockedOwnerIds(_settings('https://two.test', 'alice')),
      isEmpty,
    );

    await reopened.unblockOwner(account, 'bob');
    expect(await first.blockedOwnerIds(account), isEmpty);
  });

  test('이용규칙 동의는 계정별로 유지하고 버전이 바뀌면 다시 받는다', () async {
    final prefs = await SharedPreferences.getInstance();
    final store = MessengerSafetyStore(prefs);
    final account = _settings('https://one.test', 'alice');

    expect(await store.hasAcceptedTerms(account, version: 1), isFalse);
    await store.acceptTerms(account, version: 1);
    expect(
      await MessengerSafetyStore(prefs).hasAcceptedTerms(account, version: 1),
      isTrue,
    );
    expect(await store.hasAcceptedTerms(account, version: 2), isFalse);
    expect(
      await store.hasAcceptedTerms(
        _settings('https://one.test', 'eve'),
        version: 1,
      ),
      isFalse,
    );
  });
}
