import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// 음성 엔진(STT/TTS) 접속 설정 값 객체.
///
/// 주소와 API 키는 사용자가 설정 화면에서 넣는다. 기본값으로 박아 두지 않는다.
/// 키가 들어가므로 저장은 [FlutterSecureStorage]를 쓴다.
class VoiceSettings {
  VoiceSettings({
    String sttBaseUrl = '',
    this.sttApiKey = '',
    String ttsBaseUrl = '',
    this.ttsApiKey = '',
    this.voiceId = '',
    double speed = defaultSpeed,
    this.language = defaultLanguage,
  })  : sttBaseUrl = normalizeBaseUrl(sttBaseUrl),
        ttsBaseUrl = normalizeBaseUrl(ttsBaseUrl),
        speed = clampSpeed(speed);

  /// 설정이 하나도 없는 상태.
  factory VoiceSettings.empty() => VoiceSettings();

  /// 말하기 속도 기본값.
  static const double defaultSpeed = 1.0;

  /// 서버가 받는 말하기 속도 하한.
  static const double minSpeed = 0.25;

  /// 서버가 받는 말하기 속도 상한.
  static const double maxSpeed = 4.0;

  /// 언어 기본값. 이 앱의 주 사용 언어다.
  static const String defaultLanguage = 'ko';

  /// STT 서버 주소. 끝 슬래시와 `/v1`이 제거된 형태로 보관한다.
  final String sttBaseUrl;

  /// STT 서버 API 키. 비어 있으면 인증 헤더를 붙이지 않는다.
  final String sttApiKey;

  /// TTS 서버 주소. 끝 슬래시와 `/v1`이 제거된 형태로 보관한다.
  final String ttsBaseUrl;

  /// TTS 서버 API 키. 비어 있으면 인증 헤더를 붙이지 않는다.
  final String ttsApiKey;

  /// 사용할 보이스 id. 비어 있으면 서버 기본 보이스를 쓴다.
  final String voiceId;

  /// 말하기 속도. [minSpeed] ~ [maxSpeed] 범위로 맞춰서 보관한다.
  final double speed;

  /// 인식/합성 언어 코드. 예: `ko`.
  final String language;

  /// STT를 쓸 수 있는 상태인지.
  bool get hasSttServer => sttBaseUrl.isNotEmpty;

  /// TTS를 쓸 수 있는 상태인지.
  bool get hasTtsServer => ttsBaseUrl.isNotEmpty;

  /// 음성 인식 엔드포인트.
  String get transcriptionsUrl =>
      resolveEndpoint(sttBaseUrl, '/v1/audio/transcriptions');

  /// 음성 합성 엔드포인트.
  String get speechUrl => resolveEndpoint(ttsBaseUrl, '/v1/audio/speech');

  /// 보이스 목록 엔드포인트.
  String get voicesUrl => resolveEndpoint(ttsBaseUrl, '/v1/voices');

  /// 주소를 정규화한다.
  ///
  /// - 앞뒤 공백을 없앤다.
  /// - 끝의 `/`를 모두 뗀다.
  /// - 끝에 `/v1`이 붙어 있으면 뗀다. 엔드포인트를 만들 때 다시 붙이므로
  ///   그대로 두면 `/v1/v1/...`이 된다.
  static String normalizeBaseUrl(String raw) {
    var value = raw.trim();
    if (value.isEmpty) return '';
    value = _stripTrailingSlashes(value);
    while (value.toLowerCase().endsWith('/v1')) {
      value = _stripTrailingSlashes(
        value.substring(0, value.length - '/v1'.length),
      );
    }
    return value;
  }

  /// 정규화한 주소 뒤에 [path]를 붙인다. 주소가 비면 빈 문자열을 준다.
  static String resolveEndpoint(String baseUrl, String path) {
    final base = normalizeBaseUrl(baseUrl);
    if (base.isEmpty) return '';
    final suffix = path.startsWith('/') ? path : '/$path';
    return '$base$suffix';
  }

  /// 상태 확인 엔드포인트. 인증이 필요 없고 `/v1`을 붙이지 않는다.
  static String healthUrl(String baseUrl) =>
      resolveEndpoint(baseUrl, '/health');

  /// 서버가 받는 범위로 속도를 맞춘다.
  static double clampSpeed(double value) {
    if (value.isNaN) return defaultSpeed;
    return value.clamp(minSpeed, maxSpeed).toDouble();
  }

  static String _stripTrailingSlashes(String value) {
    var end = value.length;
    while (end > 0 && value[end - 1] == '/') {
      end--;
    }
    return value.substring(0, end);
  }

  VoiceSettings copyWith({
    String? sttBaseUrl,
    String? sttApiKey,
    String? ttsBaseUrl,
    String? ttsApiKey,
    String? voiceId,
    double? speed,
    String? language,
  }) {
    return VoiceSettings(
      sttBaseUrl: sttBaseUrl ?? this.sttBaseUrl,
      sttApiKey: sttApiKey ?? this.sttApiKey,
      ttsBaseUrl: ttsBaseUrl ?? this.ttsBaseUrl,
      ttsApiKey: ttsApiKey ?? this.ttsApiKey,
      voiceId: voiceId ?? this.voiceId,
      speed: speed ?? this.speed,
      language: language ?? this.language,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is VoiceSettings &&
        other.sttBaseUrl == sttBaseUrl &&
        other.sttApiKey == sttApiKey &&
        other.ttsBaseUrl == ttsBaseUrl &&
        other.ttsApiKey == ttsApiKey &&
        other.voiceId == voiceId &&
        other.speed == speed &&
        other.language == language;
  }

  @override
  int get hashCode => Object.hash(
        sttBaseUrl,
        sttApiKey,
        ttsBaseUrl,
        ttsApiKey,
        voiceId,
        speed,
        language,
      );

  /// 키 값은 로그에 남지 않도록 가린다.
  @override
  String toString() {
    return 'VoiceSettings(stt: $sttBaseUrl, sttKey: ${_mask(sttApiKey)}, '
        'tts: $ttsBaseUrl, ttsKey: ${_mask(ttsApiKey)}, '
        'voice: $voiceId, speed: $speed, language: $language)';
  }

  static String _mask(String key) => key.isEmpty ? '(없음)' : '(설정됨)';
}

/// [VoiceSettings]를 보안 저장소에 읽고 쓴다.
///
/// API 키가 들어가므로 `shared_preferences`를 쓰지 않는다.
class VoiceSettingsStore {
  VoiceSettingsStore({FlutterSecureStorage storage = const FlutterSecureStorage()})
      : _storage = storage;

  static const String keySttBaseUrl = 'voice_stt_base_url';
  static const String keySttApiKey = 'voice_stt_api_key';
  static const String keyTtsBaseUrl = 'voice_tts_base_url';
  static const String keyTtsApiKey = 'voice_tts_api_key';
  static const String keyVoiceId = 'voice_voice_id';
  static const String keySpeed = 'voice_speed';
  static const String keyLanguage = 'voice_language';

  final FlutterSecureStorage _storage;

  /// 저장된 설정을 읽는다. 값이 없으면 기본값으로 채운다.
  Future<VoiceSettings> load() async {
    final speedRaw = await _storage.read(key: keySpeed);
    return VoiceSettings(
      sttBaseUrl: await _storage.read(key: keySttBaseUrl) ?? '',
      sttApiKey: await _storage.read(key: keySttApiKey) ?? '',
      ttsBaseUrl: await _storage.read(key: keyTtsBaseUrl) ?? '',
      ttsApiKey: await _storage.read(key: keyTtsApiKey) ?? '',
      voiceId: await _storage.read(key: keyVoiceId) ?? '',
      speed: double.tryParse(speedRaw ?? '') ?? VoiceSettings.defaultSpeed,
      language:
          await _storage.read(key: keyLanguage) ?? VoiceSettings.defaultLanguage,
    );
  }

  /// 설정을 저장한다. 주소는 정규화된 형태로 들어간다.
  Future<void> save(VoiceSettings settings) async {
    await _storage.write(key: keySttBaseUrl, value: settings.sttBaseUrl);
    await _storage.write(key: keySttApiKey, value: settings.sttApiKey);
    await _storage.write(key: keyTtsBaseUrl, value: settings.ttsBaseUrl);
    await _storage.write(key: keyTtsApiKey, value: settings.ttsApiKey);
    await _storage.write(key: keyVoiceId, value: settings.voiceId);
    await _storage.write(key: keySpeed, value: settings.speed.toString());
    await _storage.write(key: keyLanguage, value: settings.language);
  }

  /// 저장된 음성 설정을 모두 지운다.
  Future<void> clear() async {
    for (final key in const [
      keySttBaseUrl,
      keySttApiKey,
      keyTtsBaseUrl,
      keyTtsApiKey,
      keyVoiceId,
      keySpeed,
      keyLanguage,
    ]) {
      await _storage.delete(key: key);
    }
  }
}
