import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

import 'server_settings_service.dart';

/// 서버 설정 화면이 쓰는 [ServerSettingsService].
///
/// 오늘 메모/메신저 탭의 provider 패턴(`today_providers.dart`,
/// `messenger_providers.dart`)을 따라 서비스 하나를 provider로 노출한다.
/// 위젯 테스트는 이 provider를 override해서 목 Dio를 쓰는
/// [ServerSettingsService]로 바꿔 끼울 수 있다.
final Provider<ServerSettingsService> serverSettingsServiceProvider =
    Provider<ServerSettingsService>((ref) => ServerSettingsService());

/// 음성 설정 화면이 STT/TTS 연결 확인에 쓰는 [VoiceEngineClient]를 만든다.
///
/// 기본값은 실제 서버로 나가는 Dio를 쓴다. 위젯 테스트는 이 provider를
/// override해서 목 Dio로 감싼 [VoiceEngineClient]를 돌려주는 빌더로
/// 바꿔 끼울 수 있다.
final Provider<VoiceEngineClient Function(VoiceSettings settings)>
voiceEngineClientBuilderProvider =
    Provider<VoiceEngineClient Function(VoiceSettings settings)>(
      (ref) => (settings) => VoiceEngineClient(settings: settings),
    );

/// 음성 설정 화면이 쓰는 [VoiceSettingsStore].
final Provider<VoiceSettingsStore> voiceSettingsStoreProvider =
    Provider<VoiceSettingsStore>((ref) => VoiceSettingsStore());
