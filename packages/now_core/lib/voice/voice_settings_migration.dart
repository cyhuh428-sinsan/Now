import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'voice_settings.dart';

/// 2.3.6 음성 설정 이전.
///
/// 2.3.5까지 STT 주소는 LLM 설정과 한 덩어리로 `whisper_server_url` 키에
/// 들어 있었다. 2.3.6부터는 [VoiceSettingsStore]가 들고 있는다. 이전 버전에서
/// 올라오는 기기에는 옛 키에 값이 남아 있으므로 첫 실행 때 한 번 옮긴다.
///
/// 옮긴 뒤에도 옛 키는 지우지 않는다. `note_store_migration_service`와 같은
/// 이유다. 이전 결과를 확인하기 전에 원본을 없애지 않는다. 정리는 이후
/// 버전에서 한다.
class VoiceSettingsMigration {
  VoiceSettingsMigration({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
    VoiceSettingsStore? store,
  })  : _storage = storage,
        _store = store ?? VoiceSettingsStore(storage: storage);

  /// 2.3.5까지 STT 주소가 들어 있던 키.
  static const String legacyWhisperUrlKey = 'whisper_server_url';

  /// 이전을 이미 했는지 표시하는 키.
  ///
  /// 원본과 대상이 모두 보안 저장소이므로 표시도 같은 저장소에 둔다.
  /// 저장소가 하나면 둘이 어긋날 일이 없다.
  static const String doneKey = 'voice_settings_migrated_v236';

  final FlutterSecureStorage _storage;
  final VoiceSettingsStore _store;

  /// 아직 옮기지 않았다면 한 번 옮긴다. 실제로 옮겼으면 true.
  ///
  /// 다음 경우에는 옮기지 않고 표시만 남긴다.
  /// - 이미 옮긴 적이 있다.
  /// - 옛 키가 비어 있다. 새로 설치한 기기가 여기 해당한다.
  /// - 새 저장소에 이미 STT 주소가 있다. 사용자가 새 화면에서 넣은 값이므로
  ///   옛 값으로 덮지 않는다.
  Future<bool> migrateIfNeeded() async {
    if (await isDone()) return false;

    final legacy = (await _storage.read(key: legacyWhisperUrlKey) ?? '').trim();
    var moved = false;

    if (legacy.isNotEmpty) {
      final current = await _store.load();
      if (current.sttBaseUrl.isEmpty) {
        await _store.save(current.copyWith(sttBaseUrl: legacy));
        moved = true;
      }
    }

    await _storage.write(key: doneKey, value: 'true');
    return moved;
  }

  /// 이전이 끝났는지.
  Future<bool> isDone() async =>
      (await _storage.read(key: doneKey)) == 'true';
}
