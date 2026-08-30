import 'dart:typed_data';

import 'package:flutter_sound/flutter_sound.dart';

/// 재생할 오디오의 형식.
///
/// 음성 합성 서버는 44100Hz 16bit mono WAV를 준다. [wav]가 기본인 이유다.
/// 나머지는 `response_format`을 바꿔 부를 때를 위해 열어 둔 것이다.
enum VoiceAudioFormat {
  /// RIFF/WAVE. 선형 PCM 16bit.
  wav,

  /// MP3.
  mp3,

  /// OGG 컨테이너의 OPUS.
  opus,

  /// FLAC.
  flac,

  /// ADTS 컨테이너의 AAC. 앱이 녹음할 때 쓰는 형식이기도 하다.
  aac;

  /// 바이트 앞머리를 보고 형식을 짐작한다.
  ///
  /// 서버가 형식을 알려 주지 않는 경우를 위한 것이다. 판단이 서지 않으면
  /// [wav]로 둔다. 합성 서버가 주는 것이 WAV이기 때문이다.
  static VoiceAudioFormat detect(List<int> bytes) {
    if (_startsWithAscii(bytes, 'RIFF')) return VoiceAudioFormat.wav;
    if (_startsWithAscii(bytes, 'OggS')) return VoiceAudioFormat.opus;
    if (_startsWithAscii(bytes, 'fLaC')) return VoiceAudioFormat.flac;
    if (_startsWithAscii(bytes, 'ID3')) return VoiceAudioFormat.mp3;
    if (bytes.length >= 2 && bytes[0] == 0xFF) {
      // 0xFFFx는 MP3 프레임과 AAC ADTS 프레임이 함께 쓰는 동기 워드다.
      // 두 번째 바이트의 레이어 비트로 가른다. ADTS는 레이어가 00이다.
      final second = bytes[1];
      if (second & 0xE0 == 0xE0) {
        final isAdts = second & 0x06 == 0x00;
        return isAdts ? VoiceAudioFormat.aac : VoiceAudioFormat.mp3;
      }
    }
    return VoiceAudioFormat.wav;
  }

  static bool _startsWithAscii(List<int> bytes, String prefix) {
    if (bytes.length < prefix.length) return false;
    for (var i = 0; i < prefix.length; i++) {
      if (bytes[i] != prefix.codeUnitAt(i)) return false;
    }
    return true;
  }
}

/// 재생이 실패한 이유.
///
/// 화면에서 이 값으로 안내 문구나 다음 행동을 갈라 쓸 수 있다.
/// [VoiceEngineErrorKind]와 같은 방식이며, 통신이 아니라 재생 장치 쪽 실패를
/// 담는다는 점만 다르다.
enum VoicePlaybackErrorKind {
  /// 재생할 오디오가 비어 있다.
  emptyAudio,

  /// 합성기가 붙어 있지 않다. `speak`를 부를 수 없다.
  notConfigured,

  /// 재생 장치를 열지 못했다. 다른 앱이 잡고 있거나 권한이 없는 경우다.
  deviceUnavailable,

  /// 장치는 열렸지만 재생을 시작하지 못했다. 형식이 맞지 않는 경우가 많다.
  playbackFailed,

  /// 위에 해당하지 않는 실패.
  unknown,
}

/// 오디오 재생 실패. [message]는 사용자에게 그대로 보여도 되는 한국어 문구다.
///
/// `VoiceEngineException`과 같은 모양이다. 화면이 두 예외를 같은 방식으로
/// 다룰 수 있도록 필드 이름을 맞췄다.
class VoicePlaybackException implements Exception {
  VoicePlaybackException({
    required this.kind,
    required this.message,
    this.detail,
    this.cause,
  });

  /// 실패 이유.
  final VoicePlaybackErrorKind kind;

  /// 사용자에게 보여줄 한국어 문구.
  final String message;

  /// 원문 설명. 로그용이며 사용자에게 보여줄 필요는 없다.
  final String? detail;

  /// 원인 예외.
  final Object? cause;

  /// 다시 시도해 볼 만한 실패인지.
  bool get isRetryable =>
      kind == VoicePlaybackErrorKind.deviceUnavailable ||
      kind == VoicePlaybackErrorKind.playbackFailed;

  @override
  String toString() => 'VoicePlaybackException(${kind.name}, $message'
      '${detail == null ? '' : ', detail: $detail'})';
}

/// 오디오 재생 장치. 화면을 갖지 않는다.
///
/// 겹치기 방지와 상태 알림 같은 규칙은 [AudioPlayer]가 아니라
/// `VoicePlaybackService`에 있다. 여기는 장치를 열고 닫는 일만 한다.
/// 인터페이스로 갈라 둔 이유는 [AudioRecorder]와 같다. 테스트에서 플러그인
/// 없이 규칙만 확인하기 위해서다.
abstract class AudioPlayer {
  /// 재생 장치를 연다.
  Future<void> open();

  /// [bytes]를 재생한다. 돌아오는 시점은 재생이 끝난 때가 아니라 재생이
  /// 시작된 때다. 끝은 [whenFinished]로 알린다.
  ///
  /// 장치가 이미 무언가를 재생 중이면 그것을 멈추고 이것을 재생한다.
  Future<void> play(
    Uint8List bytes, {
    VoiceAudioFormat format = VoiceAudioFormat.wav,
    void Function()? whenFinished,
  });

  /// 재생을 멈춘다. 장치는 열린 채로 둔다.
  ///
  /// 멈춘 재생의 [play] 완료 알림은 오지 않는다.
  Future<void> stop();

  /// 재생 장치를 닫는다.
  Future<void> close();

  /// 지금 재생 중인지.
  bool get isPlaying;
}

/// `flutter_sound` 기반 [AudioPlayer].
///
/// 새 플러그인을 들이지 않고 이미 있는 `flutter_sound`를 쓴다.
/// `FlutterSoundPlayer.startPlayer`가 `fromDataBuffer`로 바이트를 그대로
/// 받으므로 **임시 파일을 만들지 않는다.**
class FlutterSoundAudioPlayer implements AudioPlayer {
  FlutterSoundAudioPlayer({FlutterSoundPlayer? player})
      : _player = player ?? FlutterSoundPlayer();

  final FlutterSoundPlayer _player;
  bool _open = false;
  bool _playing = false;

  /// 재생 한 건을 가리키는 번호.
  ///
  /// 멈추거나 다음 재생이 시작되면 올라간다. 늦게 도착한 종료 알림이 새
  /// 재생의 상태를 건드리지 못하게 막는 장치다.
  int _token = 0;

  @override
  bool get isPlaying => _playing;

  @override
  Future<void> open() async {
    if (_open) return;
    try {
      await _player.openPlayer();
      _open = true;
    } on Object catch (e) {
      throw VoicePlaybackException(
        kind: VoicePlaybackErrorKind.deviceUnavailable,
        message: '소리를 낼 수 없습니다. 다른 앱이 오디오를 쓰고 있는지 확인해 주세요.',
        detail: e.toString(),
        cause: e,
      );
    }
  }

  @override
  Future<void> play(
    Uint8List bytes, {
    VoiceAudioFormat format = VoiceAudioFormat.wav,
    void Function()? whenFinished,
  }) async {
    await open();
    final token = ++_token;
    var finished = false;
    try {
      await _player.startPlayer(
        fromDataBuffer: bytes,
        codec: codecOf(format),
        whenFinished: () {
          if (token != _token) return;
          finished = true;
          _playing = false;
          whenFinished?.call();
        },
      );
    } on Object catch (e) {
      _playing = false;
      throw VoicePlaybackException(
        kind: VoicePlaybackErrorKind.playbackFailed,
        message: '소리를 재생하지 못했습니다.',
        detail: e.toString(),
        cause: e,
      );
    }
    // 아주 짧은 오디오는 위 await가 돌아오기 전에 끝나기도 한다.
    // 그때 재생 중으로 되돌리지 않는다.
    if (token != _token || finished) return;
    _playing = true;
  }

  @override
  Future<void> stop() async {
    _token++;
    _playing = false;
    if (!_open) return;
    await _player.stopPlayer();
  }

  @override
  Future<void> close() async {
    _token++;
    _playing = false;
    if (!_open) return;
    _open = false;
    await _player.closePlayer();
  }

  /// 형식을 `flutter_sound` 코덱으로 옮긴다.
  ///
  /// WAV는 [Codec.pcm16WAV]다. 헤더가 표본율과 채널 수를 들고 있으므로
  /// 44100Hz든 16000Hz든 따로 알려 줄 필요가 없다.
  static Codec codecOf(VoiceAudioFormat format) => switch (format) {
        VoiceAudioFormat.wav => Codec.pcm16WAV,
        VoiceAudioFormat.mp3 => Codec.mp3,
        VoiceAudioFormat.opus => Codec.opusOGG,
        VoiceAudioFormat.flac => Codec.flac,
        VoiceAudioFormat.aac => Codec.aacADTS,
      };
}
