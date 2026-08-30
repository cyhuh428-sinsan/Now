import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

// STT/TTS 접속 설정(VoiceSettings)과 VoiceEngineClient를 만드는 방법은
// `features/settings/settings_providers.dart`가 이미 갖고 있다
// (voiceSettingsStoreProvider, voiceEngineClientBuilderProvider) — 음성
// 설정 화면과 같은 것을 그대로 쓴다. 여기서는 계층 메모 화면에서만 쓰는
// 녹음/재생 서비스 배선만 더한다. `today_providers.dart`의
// `todayVoiceRecordingServiceProvider`/`todayVoicePlaybackServiceBuilderProvider`와
// 같은 패턴이다.

/// 계층 메모 입력 바의 "녹음 후 서버로 변환" 받아쓰기가 쓰는
/// [VoiceRecordingService].
///
/// 위젯 테스트는 이 provider를 override해서 가짜 레코더를 쓰는 서비스로
/// 바꿔 끼울 수 있다.
final Provider<VoiceRecordingService> treeVoiceRecordingServiceProvider =
    Provider<VoiceRecordingService>((ref) => VoiceRecordingService());

/// 메모 읽어주기(TTS)가 [VoiceEngineClient]로부터 [VoicePlaybackService]를
/// 만드는 방법.
///
/// 기본값은 실제 오디오 재생 장치([VoicePlaybackService.withEngine])를 쓴다.
/// 위젯 테스트는 이 provider를 override해서 가짜 재생 장치로 만든 서비스를
/// 그대로 돌려주는 빌더로 바꿔 끼울 수 있다.
final Provider<VoicePlaybackService Function(VoiceEngineClient engine)>
treeVoicePlaybackServiceBuilderProvider =
    Provider<VoicePlaybackService Function(VoiceEngineClient engine)>(
      (ref) => (engine) => VoicePlaybackService.withEngine(engine),
    );
