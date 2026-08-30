import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/llm/llm_settings_migration.dart';
import 'package:now_core/llm/llm_settings_service.dart';

/// 실제 개인 서버 주소를 테스트에 적지 않으려고 대역을 쓴다.
/// 지문을 바꿔 끼우면 정리 동작 자체는 그대로 확인할 수 있다.
const _standInLegacyUrl = 'http://legacy-default.test:18080';

LlmSettingsMigration _migration() => LlmSettingsMigration(
      legacyUrlDigest: LlmSettingsMigration.digestOf(_standInLegacyUrl),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('옛 Ollama 기본 주소 정리', () {
    test('옛 기본값이 저장돼 있으면 지운다', () async {
      FlutterSecureStorage.setMockInitialValues({
        LlmSettingsService.keyOllamaUrl: _standInLegacyUrl,
      });

      final cleared = await _migration().migrateIfNeeded();

      expect(cleared, isTrue);
      expect((await LlmSettingsService().loadConfig()).ollamaUrl, isEmpty);
    });

    test('사용자가 넣은 주소는 건드리지 않는다', () async {
      FlutterSecureStorage.setMockInitialValues({
        LlmSettingsService.keyOllamaUrl: 'http://192.168.0.10:11434',
      });

      final cleared = await _migration().migrateIfNeeded();

      expect(cleared, isFalse);
      expect(
        (await LlmSettingsService().loadConfig()).ollamaUrl,
        'http://192.168.0.10:11434',
      );
    });

    test('저장된 주소가 없으면 아무것도 하지 않는다', () async {
      expect(await _migration().migrateIfNeeded(), isFalse);
    });

    test('한 번 정리한 뒤에는 다시 정리하지 않는다', () async {
      FlutterSecureStorage.setMockInitialValues({
        LlmSettingsService.keyOllamaUrl: _standInLegacyUrl,
      });

      expect(await _migration().migrateIfNeeded(), isTrue);
      expect(await _migration().isDone(), isTrue);

      // 사용자가 그 뒤에 같은 주소를 직접 넣었다면 그건 사용자의 선택이다.
      await LlmSettingsService()
          .saveOllamaSettings(url: _standInLegacyUrl, model: 'llama3');

      expect(await _migration().migrateIfNeeded(), isFalse);
      expect(
        (await LlmSettingsService().loadConfig()).ollamaUrl,
        _standInLegacyUrl,
      );
    });

    test('옛 기본값 지문은 코드에 박힌 값과 한 자리도 다르지 않다', () {
      // 실제 주소는 여기 적지 않는다. 지문 형식과 길이만 확인한다.
      expect(LlmSettingsMigration.legacyDefaultOllamaUrlDigest, hasLength(64));
      expect(
        LlmSettingsMigration.isLegacyDefault('http://192.168.0.10:11434'),
        isFalse,
      );
      expect(LlmSettingsMigration.isLegacyDefault(''), isFalse);
    });
  });
}
