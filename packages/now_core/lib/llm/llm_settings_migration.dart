import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'llm_settings_service.dart';

/// 2.3.6 Ollama 주소 정리.
///
/// 2.3.5까지 `LlmConfig`와 `LlmSettingsService`는 개발자 개인 서버 주소를
/// Ollama 주소 **기본값**으로 들고 있었다. 그 값은 저장소에 쓰이지 않고 읽기
/// 실패 시의 대체값으로만 쓰였지만, 설정 화면이 그 대체값을 입력칸에 채워
/// 넣었기 때문에 사용자가 Ollama를 고른 상태에서 저장이나 연결 테스트를
/// 누르면 그대로 저장됐다. 그런 기기는 설정한 적 없는 남의 서버로 계속
/// 요청을 보낸다.
///
/// 그래서 저장된 값이 **그 옛 기본값과 정확히 같을 때만** 지운다. 사용자가
/// 직접 넣은 주소는 건드리지 않는다. 옛 기본값을 손으로 골라 넣었을 사람은
/// 없으므로 값이 같다면 자동으로 채워진 것이다.
///
/// 비교는 SHA-256 지문으로 한다. 지우려는 대상이 개인 서버 주소이므로 그
/// 문자열을 공개 저장소에 그대로 남기지 않는다. 지문은 되돌릴 수 없고,
/// 같은 값인지 확인하는 데는 충분하다.
class LlmSettingsMigration {
  LlmSettingsMigration({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
    String legacyUrlDigest = legacyDefaultOllamaUrlDigest,
  })  : _storage = storage,
        _legacyUrlDigest = legacyUrlDigest;

  /// 2.3.5까지 코드에 박혀 있던 Ollama 주소 기본값의 SHA-256 지문.
  static const String legacyDefaultOllamaUrlDigest =
      '3799f1e8d9a087461aab890dce24dd88cfe862b164596f95cc69aa2c5075f786';

  /// 정리를 이미 했는지 표시하는 키.
  ///
  /// 대상과 표시가 모두 보안 저장소에 있어야 둘이 어긋나지 않는다.
  /// `VoiceSettingsMigration`과 같은 이유다.
  static const String doneKey = 'llm_ollama_url_default_cleared_v236';

  final FlutterSecureStorage _storage;

  /// 지울 대상의 지문. 실제 주소를 테스트에 적지 않으려고 바꿔 낄 수 있게 뒀다.
  final String _legacyUrlDigest;

  /// 아직 정리하지 않았다면 한 번 정리한다. 실제로 지웠으면 true.
  ///
  /// 다음 경우에는 지우지 않고 표시만 남긴다.
  /// - 이미 정리한 적이 있다.
  /// - 저장된 주소가 없다. 새로 설치한 기기가 여기 해당한다.
  /// - 저장된 주소가 옛 기본값이 아니다. 사용자가 넣은 값이다.
  Future<bool> migrateIfNeeded() async {
    if (await isDone()) return false;

    final stored =
        (await _storage.read(key: LlmSettingsService.keyOllamaUrl) ?? '').trim();
    var cleared = false;

    if (stored.isNotEmpty && digestOf(stored) == _legacyUrlDigest) {
      await _storage.delete(key: LlmSettingsService.keyOllamaUrl);
      cleared = true;
    }

    await _storage.write(key: doneKey, value: 'true');
    return cleared;
  }

  /// 주소의 SHA-256 지문. 앞뒤 공백은 떼고 계산한다.
  static String digestOf(String url) =>
      sha256.convert(utf8.encode(url.trim())).toString();

  /// 주어진 주소가 2.3.5의 개인 서버 기본값인지.
  static bool isLegacyDefault(String url) =>
      digestOf(url) == legacyDefaultOllamaUrlDigest;

  /// 정리가 끝났는지.
  Future<bool> isDone() async => (await _storage.read(key: doneKey)) == 'true';
}
