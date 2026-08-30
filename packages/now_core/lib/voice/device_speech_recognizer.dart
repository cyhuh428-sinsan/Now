import 'package:speech_to_text/speech_to_text.dart';

/// 기기 내 음성 인식이 돌려준 한 조각.
class SpeechRecognitionOutcome {
  const SpeechRecognitionOutcome({required this.text, required this.isFinal});

  /// 지금까지 인식된 전체 문장. 부분 결과도 전체 문장으로 온다.
  final String text;

  /// 엔진이 이 문장을 확정했는지.
  final bool isFinal;

  @override
  String toString() => 'SpeechRecognitionOutcome("$text", final: $isFinal)';
}

/// 기기 내 음성 인식 엔진이 알려주는 오류.
class SpeechRecognitionFailure {
  const SpeechRecognitionFailure({required this.message, required this.permanent});

  /// 엔진이 준 오류 코드/문구. 예: `error_busy`.
  final String message;

  /// 다시 시도해도 소용없는 오류인지.
  final bool permanent;

  @override
  String toString() =>
      'SpeechRecognitionFailure($message, permanent: $permanent)';
}

/// 기기 내 음성 인식. 화면을 갖지 않는다.
///
/// 인터페이스로 갈라 둔 이유는 테스트에서 플러그인 없이 호출 흐름을
/// 확인하기 위해서다. 실제 구현은 [SpeechToTextRecognizer]다.
abstract class DeviceSpeechRecognizer {
  /// 지금 듣고 있는지.
  bool get isListening;

  /// 엔진을 준비한다. 쓸 수 있으면 true.
  ///
  /// 마이크 권한은 이 호출 안에서 플랫폼이 묻는다. 별도 권한 요청 코드를
  /// 두지 않는 이유가 여기에 있다.
  Future<bool> initialize({
    void Function(String status)? onStatus,
    void Function(SpeechRecognitionFailure failure)? onError,
  });

  /// 인식을 시작한다.
  Future<void> listen({
    required void Function(SpeechRecognitionOutcome outcome) onResult,
    String localeId = DeviceSpeechDefaults.localeId,
    Duration listenFor = DeviceSpeechDefaults.listenFor,
    Duration pauseFor = DeviceSpeechDefaults.pauseFor,
    bool partialResults = true,
    bool dictation = false,
  });

  /// 인식을 멈춘다.
  Future<void> stop();
}

/// 기기 내 음성 인식 기본값. 앱 화면에 박혀 있던 값을 그대로 옮겼다.
abstract final class DeviceSpeechDefaults {
  /// 이 앱의 주 사용 언어.
  static const String localeId = 'ko_KR';

  /// 한 번에 듣는 최대 시간.
  static const Duration listenFor = Duration(seconds: 300);

  /// 이만큼 조용하면 엔진이 스스로 멈춘다.
  static const Duration pauseFor = Duration(seconds: 60);

  /// 엔진이 스스로 멈춘 뒤 다시 켜기까지 두는 간격.
  static const Duration restartDelay = Duration(milliseconds: 50);

  /// 엔진이 바쁘다고 답했을 때 다시 켜기까지 두는 간격.
  static const Duration busyRetryDelay = Duration(milliseconds: 1500);

  /// 그 밖의 오류 뒤 다시 켜기까지 두는 간격.
  static const Duration errorRetryDelay = Duration(milliseconds: 500);

  /// 엔진이 바쁠 때 주는 오류 코드.
  static const String busyError = 'error_busy';

  /// 오류 코드에 맞는 재시도 간격을 고른다.
  static Duration retryDelayFor(String errorMessage) =>
      errorMessage == busyError ? busyRetryDelay : errorRetryDelay;

  /// 엔진이 스스로 멈췄음을 알리는 상태 문자열인지.
  static bool isStoppedStatus(String status) =>
      status == 'done' || status == 'notListening';
}

/// `speech_to_text` 기반 [DeviceSpeechRecognizer].
class SpeechToTextRecognizer implements DeviceSpeechRecognizer {
  SpeechToTextRecognizer({SpeechToText? speech})
      : _speech = speech ?? SpeechToText();

  final SpeechToText _speech;

  @override
  bool get isListening => _speech.isListening;

  @override
  Future<bool> initialize({
    void Function(String status)? onStatus,
    void Function(SpeechRecognitionFailure failure)? onError,
  }) {
    return _speech.initialize(
      onStatus: onStatus,
      onError: onError == null
          ? null
          : (error) => onError(
                SpeechRecognitionFailure(
                  message: error.errorMsg,
                  permanent: error.permanent,
                ),
              ),
    );
  }

  @override
  Future<void> listen({
    required void Function(SpeechRecognitionOutcome outcome) onResult,
    String localeId = DeviceSpeechDefaults.localeId,
    Duration listenFor = DeviceSpeechDefaults.listenFor,
    Duration pauseFor = DeviceSpeechDefaults.pauseFor,
    bool partialResults = true,
    bool dictation = false,
  }) {
    // localeId/listenFor/pauseFor는 speech_to_text 7.4에서 SpeechListenOptions로
    // 옮겨 가며 여기 자리가 deprecated로 표시됐다. 다만 now_app이 해석하는
    // 7.3에는 아직 SpeechListenOptions 쪽 자리가 없다. 양쪽에서 다 컴파일되도록
    // 옛 자리를 그대로 쓰고 경고만 끈다.
    return _speech.listen(
      // ignore: deprecated_member_use
      localeId: localeId,
      // ignore: deprecated_member_use
      listenFor: listenFor,
      // ignore: deprecated_member_use
      pauseFor: pauseFor,
      onResult: (result) => onResult(
        SpeechRecognitionOutcome(
          text: result.recognizedWords.trim(),
          isFinal: result.finalResult,
        ),
      ),
      listenOptions: SpeechListenOptions(
        partialResults: partialResults,
        cancelOnError: false,
        listenMode: dictation ? ListenMode.dictation : ListenMode.confirmation,
      ),
    );
  }

  @override
  Future<void> stop() => _speech.stop();
}
