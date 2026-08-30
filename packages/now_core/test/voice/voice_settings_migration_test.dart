import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/voice/voice_settings.dart';
import 'package:now_core/voice/voice_settings_migration.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('옛 Whisper 주소 이전', () {
    test('옛 키에 있던 주소를 새 저장소로 옮긴다', () async {
      FlutterSecureStorage.setMockInitialValues({
        VoiceSettingsMigration.legacyWhisperUrlKey: 'http://voice.test:9000',
      });

      final moved = await VoiceSettingsMigration().migrateIfNeeded();

      expect(moved, isTrue);
      expect((await VoiceSettingsStore().load()).sttBaseUrl,
          'http://voice.test:9000');
    });

    test('옮긴 주소는 정규화되어 새 규격 엔드포인트를 만든다', () async {
      FlutterSecureStorage.setMockInitialValues({
        VoiceSettingsMigration.legacyWhisperUrlKey: 'http://voice.test:9000/v1/',
      });

      await VoiceSettingsMigration().migrateIfNeeded();

      final loaded = await VoiceSettingsStore().load();
      expect(loaded.sttBaseUrl, 'http://voice.test:9000');
      expect(
        loaded.transcriptionsUrl,
        'http://voice.test:9000/v1/audio/transcriptions',
      );
    });

    test('옛 키를 지우지 않는다. 이전 결과를 확인하기 전에 원본을 없애지 않는다', () async {
      FlutterSecureStorage.setMockInitialValues({
        VoiceSettingsMigration.legacyWhisperUrlKey: 'http://voice.test:9000',
      });

      await VoiceSettingsMigration().migrateIfNeeded();

      expect(
        await const FlutterSecureStorage()
            .read(key: VoiceSettingsMigration.legacyWhisperUrlKey),
        'http://voice.test:9000',
      );
    });

    test('두 번 불러도 한 번만 옮긴다', () async {
      FlutterSecureStorage.setMockInitialValues({
        VoiceSettingsMigration.legacyWhisperUrlKey: 'http://voice.test:9000',
      });
      final migration = VoiceSettingsMigration();

      expect(await migration.migrateIfNeeded(), isTrue);
      expect(await migration.isDone(), isTrue);

      // 사용자가 이전 뒤에 주소를 바꿨다면 옛 값으로 되돌아가면 안 된다.
      await VoiceSettingsStore().save(
        VoiceSettings(sttBaseUrl: 'http://new.test:9100'),
      );

      expect(await migration.migrateIfNeeded(), isFalse);
      expect((await VoiceSettingsStore().load()).sttBaseUrl,
          'http://new.test:9100');
    });

    test('옛 키가 비어 있으면 옮기지 않고 표시만 남긴다', () async {
      final migration = VoiceSettingsMigration();

      expect(await migration.migrateIfNeeded(), isFalse);
      expect(await migration.isDone(), isTrue);
      expect((await VoiceSettingsStore().load()).sttBaseUrl, '');
    });

    test('옛 키가 공백뿐이면 옮기지 않는다', () async {
      FlutterSecureStorage.setMockInitialValues({
        VoiceSettingsMigration.legacyWhisperUrlKey: '   ',
      });

      expect(await VoiceSettingsMigration().migrateIfNeeded(), isFalse);
      expect((await VoiceSettingsStore().load()).sttBaseUrl, '');
    });

    test('새 저장소에 이미 주소가 있으면 옛 값으로 덮지 않는다', () async {
      FlutterSecureStorage.setMockInitialValues({
        VoiceSettingsMigration.legacyWhisperUrlKey: 'http://old.test:9000',
      });
      await VoiceSettingsStore().save(
        VoiceSettings(sttBaseUrl: 'http://new.test:9100', sttApiKey: 'key'),
      );

      expect(await VoiceSettingsMigration().migrateIfNeeded(), isFalse);

      final loaded = await VoiceSettingsStore().load();
      expect(loaded.sttBaseUrl, 'http://new.test:9100');
      expect(loaded.sttApiKey, 'key');
    });

    test('이전이 나머지 음성 설정을 건드리지 않는다', () async {
      FlutterSecureStorage.setMockInitialValues({
        VoiceSettingsMigration.legacyWhisperUrlKey: 'http://voice.test:9000',
      });
      await VoiceSettingsStore().save(
        VoiceSettings(
          ttsBaseUrl: 'http://tts.test:9100',
          ttsApiKey: 'tts-key',
          voiceId: 'F1',
          speed: 1.25,
        ),
      );

      expect(await VoiceSettingsMigration().migrateIfNeeded(), isTrue);

      final loaded = await VoiceSettingsStore().load();
      expect(loaded.sttBaseUrl, 'http://voice.test:9000');
      expect(loaded.ttsBaseUrl, 'http://tts.test:9100');
      expect(loaded.ttsApiKey, 'tts-key');
      expect(loaded.voiceId, 'F1');
      expect(loaded.speed, 1.25);
    });
  });
}
