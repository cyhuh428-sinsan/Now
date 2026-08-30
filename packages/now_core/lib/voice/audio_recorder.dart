import 'package:flutter_sound/flutter_sound.dart';

/// 오디오 녹음 장치. 화면을 갖지 않는다.
///
/// 녹음 규칙(파일 위치, 이름, 너무 짧은 녹음 판정)은 [AudioRecorder]가 아니라
/// `VoiceRecordingService`에 있다. 여기는 장치를 열고 닫는 일만 한다.
/// 인터페이스로 갈라 둔 이유는 테스트에서 플러그인 없이 규칙만 확인하기
/// 위해서다.
abstract class AudioRecorder {
  /// 녹음 장치를 연다. 플랫폼에 따라 이 시점에 마이크 권한을 묻는다.
  Future<void> open();

  /// [filePath]에 녹음을 시작한다.
  Future<void> start(String filePath);

  /// 녹음을 멈춘다. 장치는 열린 채로 둔다.
  Future<void> stop();

  /// 녹음 장치를 닫는다.
  Future<void> close();

  /// 지금 녹음 중인지.
  bool get isRecording;
}

/// `flutter_sound` 기반 [AudioRecorder].
///
/// 코덱과 표본율은 앱 화면에 흩어져 있던 값을 그대로 옮긴 것이다.
/// 서버가 받는 형식이므로 임의로 바꾸지 않는다.
class FlutterSoundAudioRecorder implements AudioRecorder {
  FlutterSoundAudioRecorder({FlutterSoundRecorder? recorder})
      : _recorder = recorder ?? FlutterSoundRecorder();

  /// 녹음 코덱. AAC ADTS.
  static const Codec codec = Codec.aacADTS;

  /// 비트레이트.
  static const int bitRate = 128000;

  /// 표본율. STT 서버가 기대하는 값이다.
  static const int sampleRate = 16000;

  final FlutterSoundRecorder _recorder;
  bool _open = false;
  bool _recording = false;

  @override
  bool get isRecording => _recording;

  @override
  Future<void> open() async {
    if (_open) return;
    await _recorder.openRecorder();
    _open = true;
  }

  @override
  Future<void> start(String filePath) async {
    await open();
    await _recorder.startRecorder(
      toFile: filePath,
      codec: codec,
      bitRate: bitRate,
      sampleRate: sampleRate,
    );
    _recording = true;
  }

  @override
  Future<void> stop() async {
    if (!_recording) return;
    _recording = false;
    await _recorder.stopRecorder();
  }

  @override
  Future<void> close() async {
    _recording = false;
    if (!_open) return;
    _open = false;
    await _recorder.closeRecorder();
  }
}
