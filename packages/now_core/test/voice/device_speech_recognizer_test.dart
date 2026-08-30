import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/voice/device_speech_recognizer.dart';

/// 플러그인 없이 호출 흐름만 확인하기 위한 가짜 엔진.
class _FakeRecognizer implements DeviceSpeechRecognizer {
  _FakeRecognizer({this.available = true});

  final bool available;
  bool _listening = false;
  int listenCount = 0;
  int stopCount = 0;
  String? lastLocaleId;
  bool? lastDictation;
  void Function(SpeechRecognitionOutcome)? _onResult;
  void Function(String)? _onStatus;
  void Function(SpeechRecognitionFailure)? _onError;

  @override
  bool get isListening => _listening;

  @override
  Future<bool> initialize({
    void Function(String status)? onStatus,
    void Function(SpeechRecognitionFailure failure)? onError,
  }) async {
    _onStatus = onStatus;
    _onError = onError;
    return available;
  }

  @override
  Future<void> listen({
    required void Function(SpeechRecognitionOutcome outcome) onResult,
    String localeId = DeviceSpeechDefaults.localeId,
    Duration listenFor = DeviceSpeechDefaults.listenFor,
    Duration pauseFor = DeviceSpeechDefaults.pauseFor,
    bool partialResults = true,
    bool dictation = false,
  }) async {
    listenCount++;
    lastLocaleId = localeId;
    lastDictation = dictation;
    _onResult = onResult;
    _listening = true;
  }

  @override
  Future<void> stop() async {
    stopCount++;
    _listening = false;
  }

  void emit(String text, {bool isFinal = false}) =>
      _onResult?.call(SpeechRecognitionOutcome(text: text, isFinal: isFinal));

  void emitStatus(String status) => _onStatus?.call(status);

  void emitError(String message, {bool permanent = false}) => _onError?.call(
        SpeechRecognitionFailure(message: message, permanent: permanent),
      );
}

void main() {
  group('기본값', () {
    test('한국어 로케일과 앱이 쓰던 시간 값을 유지한다', () {
      expect(DeviceSpeechDefaults.localeId, 'ko_KR');
      expect(DeviceSpeechDefaults.listenFor, const Duration(seconds: 300));
      expect(DeviceSpeechDefaults.pauseFor, const Duration(seconds: 60));
    });

    test('엔진이 바쁠 때는 더 길게 기다렸다 다시 켠다', () {
      expect(
        DeviceSpeechDefaults.retryDelayFor('error_busy'),
        DeviceSpeechDefaults.busyRetryDelay,
      );
      expect(
        DeviceSpeechDefaults.retryDelayFor('error_no_match'),
        DeviceSpeechDefaults.errorRetryDelay,
      );
      expect(
        DeviceSpeechDefaults.busyRetryDelay >
            DeviceSpeechDefaults.errorRetryDelay,
        isTrue,
      );
    });

    test('done과 notListening은 엔진이 스스로 멈춘 상태다', () {
      expect(DeviceSpeechDefaults.isStoppedStatus('done'), isTrue);
      expect(DeviceSpeechDefaults.isStoppedStatus('notListening'), isTrue);
      expect(DeviceSpeechDefaults.isStoppedStatus('listening'), isFalse);
    });
  });

  group('인식 흐름', () {
    test('부분 결과와 확정 결과를 구분해 전달한다', () async {
      final recognizer = _FakeRecognizer();
      final received = <SpeechRecognitionOutcome>[];

      await recognizer.initialize();
      await recognizer.listen(onResult: received.add, dictation: true);

      recognizer.emit('안녕');
      recognizer.emit('안녕하세요', isFinal: true);

      expect(recognizer.isListening, isTrue);
      expect(recognizer.lastLocaleId, 'ko_KR');
      expect(recognizer.lastDictation, isTrue);
      expect(received.map((e) => e.text).toList(), ['안녕', '안녕하세요']);
      expect(received.first.isFinal, isFalse);
      expect(received.last.isFinal, isTrue);

      await recognizer.stop();
      expect(recognizer.isListening, isFalse);
      expect(recognizer.stopCount, 1);
    });

    test('초기화에 실패하면 false를 준다', () async {
      final recognizer = _FakeRecognizer(available: false);
      expect(await recognizer.initialize(), isFalse);
    });

    test('상태와 오류 콜백이 그대로 올라온다', () async {
      final recognizer = _FakeRecognizer();
      final statuses = <String>[];
      final failures = <SpeechRecognitionFailure>[];

      await recognizer.initialize(
        onStatus: statuses.add,
        onError: failures.add,
      );

      recognizer.emitStatus('done');
      recognizer.emitError('error_busy');

      expect(statuses, ['done']);
      expect(failures.single.message, 'error_busy');
      expect(failures.single.permanent, isFalse);
    });
  });
}
