import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/voice/voice_settings.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('주소 정규화', () {
    test('끝 슬래시를 뗀다', () {
      expect(
        VoiceSettings.normalizeBaseUrl('http://voice.test:9000/'),
        'http://voice.test:9000',
      );
      expect(
        VoiceSettings.normalizeBaseUrl('http://voice.test:9000///'),
        'http://voice.test:9000',
      );
    });

    test('앞뒤 공백을 뗀다', () {
      expect(
        VoiceSettings.normalizeBaseUrl('  http://voice.test:9000  '),
        'http://voice.test:9000',
      );
    });

    test('이미 붙은 /v1을 뗀다', () {
      expect(
        VoiceSettings.normalizeBaseUrl('http://voice.test:9000/v1'),
        'http://voice.test:9000',
      );
      expect(
        VoiceSettings.normalizeBaseUrl('http://voice.test:9000/v1/'),
        'http://voice.test:9000',
      );
      expect(
        VoiceSettings.normalizeBaseUrl('http://voice.test:9000/V1/'),
        'http://voice.test:9000',
      );
    });

    test('경로가 있는 주소는 유지한다', () {
      expect(
        VoiceSettings.normalizeBaseUrl('http://voice.test/engine/stt/'),
        'http://voice.test/engine/stt',
      );
    });

    test('빈 주소는 빈 문자열이다', () {
      expect(VoiceSettings.normalizeBaseUrl('   '), '');
    });
  });

  group('엔드포인트 조합', () {
    test('/v1이 한 번만 붙는다', () {
      final settings = VoiceSettings(
        sttBaseUrl: 'http://stt.test:9000/v1/',
        ttsBaseUrl: 'http://tts.test:9100/',
      );

      expect(
        settings.transcriptionsUrl,
        'http://stt.test:9000/v1/audio/transcriptions',
      );
      expect(settings.speechUrl, 'http://tts.test:9100/v1/audio/speech');
      expect(settings.voicesUrl, 'http://tts.test:9100/v1/voices');
    });

    test('health는 /v1 없이 붙는다', () {
      expect(
        VoiceSettings.healthUrl('http://stt.test:9000/v1/'),
        'http://stt.test:9000/health',
      );
    });

    test('주소가 없으면 엔드포인트도 빈 문자열이다', () {
      final settings = VoiceSettings.empty();
      expect(settings.transcriptionsUrl, '');
      expect(settings.speechUrl, '');
      expect(settings.voicesUrl, '');
      expect(settings.hasSttServer, isFalse);
      expect(settings.hasTtsServer, isFalse);
    });
  });

  group('값 객체', () {
    test('속도는 허용 범위로 맞춰진다', () {
      expect(VoiceSettings(speed: 0.1).speed, VoiceSettings.minSpeed);
      expect(VoiceSettings(speed: 9.0).speed, VoiceSettings.maxSpeed);
      expect(VoiceSettings(speed: 1.5).speed, 1.5);
    });

    test('기본 언어는 ko이고 보이스는 비어 있다', () {
      final settings = VoiceSettings.empty();
      expect(settings.language, 'ko');
      expect(settings.voiceId, '');
      expect(settings.speed, VoiceSettings.defaultSpeed);
    });

    test('copyWith가 나머지 값을 유지한다', () {
      final base = VoiceSettings(
        sttBaseUrl: 'http://stt.test:9000',
        sttApiKey: 'unit-test-token',
        language: 'ko',
      );
      final next = base.copyWith(voiceId: 'F1');

      expect(next.sttBaseUrl, base.sttBaseUrl);
      expect(next.sttApiKey, base.sttApiKey);
      expect(next.voiceId, 'F1');
      expect(next, isNot(base));
      expect(base.copyWith(), base);
    });

    test('toString에 API 키가 드러나지 않는다', () {
      final settings = VoiceSettings(sttApiKey: 'unit-test-token');
      expect(settings.toString(), isNot(contains('unit-test-token')));
      expect(settings.toString(), contains('설정됨'));
    });
  });

  group('보안 저장소 저장/로드', () {
    setUp(() {
      FlutterSecureStorage.setMockInitialValues({});
    });

    test('저장한 값을 다시 읽는다. 주소는 정규화되어 들어간다', () async {
      final store = VoiceSettingsStore();
      await store.save(
        VoiceSettings(
          sttBaseUrl: 'http://stt.test:9000/v1/',
          sttApiKey: 'stt-token',
          ttsBaseUrl: 'http://tts.test:9100/',
          ttsApiKey: 'tts-token',
          voiceId: 'F1',
          speed: 1.25,
          language: 'ko',
        ),
      );

      final loaded = await store.load();
      expect(loaded.sttBaseUrl, 'http://stt.test:9000');
      expect(loaded.sttApiKey, 'stt-token');
      expect(loaded.ttsBaseUrl, 'http://tts.test:9100');
      expect(loaded.ttsApiKey, 'tts-token');
      expect(loaded.voiceId, 'F1');
      expect(loaded.speed, 1.25);
      expect(loaded.language, 'ko');
      expect(loaded.transcriptionsUrl,
          'http://stt.test:9000/v1/audio/transcriptions');
    });

    test('저장된 값이 없으면 기본값을 준다', () async {
      final loaded = await VoiceSettingsStore().load();
      expect(loaded, VoiceSettings.empty());
    });

    test('clear가 저장된 값을 지운다', () async {
      final store = VoiceSettingsStore();
      await store.save(
        VoiceSettings(sttBaseUrl: 'http://stt.test:9000', sttApiKey: 'k'),
      );
      await store.clear();

      final loaded = await store.load();
      expect(loaded.sttBaseUrl, '');
      expect(loaded.sttApiKey, '');
    });
  });
}
