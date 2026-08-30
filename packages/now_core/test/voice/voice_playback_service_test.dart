import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/voice/audio_player.dart';
import 'package:now_core/voice/voice_engine_client.dart';
import 'package:now_core/voice/voice_playback_service.dart';

/// 플러그인 없이 규칙만 확인하기 위한 가짜 재생 장치.
///
/// 실제로 소리를 내지 않는다. 무엇을 몇 번 재생했는지와 끝났다고 알릴 시점만
/// 시험이 직접 정한다.
class _FakeAudioPlayer implements AudioPlayer {
  int openCount = 0;
  int stopCount = 0;
  int closeCount = 0;
  bool _playing = false;

  /// 재생한 바이트를 순서대로 모은다.
  final List<Uint8List> played = [];

  /// 재생할 때 함께 받은 형식.
  final List<VoiceAudioFormat> formats = [];

  /// 재생 중 끝을 알릴 콜백. 마지막 재생의 것이다.
  void Function()? _whenFinished;

  /// [play]가 던질 예외. null이면 정상 재생한다.
  Object? failWith;

  /// [play] 안에서 기다릴 통로. 재생 시작이 늦는 상황을 만들 때 쓴다.
  Completer<void>? gate;

  @override
  bool get isPlaying => _playing;

  @override
  Future<void> open() async {
    openCount++;
  }

  @override
  Future<void> play(
    Uint8List bytes, {
    VoiceAudioFormat format = VoiceAudioFormat.wav,
    void Function()? whenFinished,
  }) async {
    await open();
    final waiting = gate;
    if (waiting != null) await waiting.future;
    final failure = failWith;
    if (failure != null) throw failure;
    played.add(bytes);
    formats.add(format);
    _whenFinished = whenFinished;
    _playing = true;
  }

  @override
  Future<void> stop() async {
    stopCount++;
    _playing = false;
  }

  @override
  Future<void> close() async {
    closeCount++;
    _playing = false;
  }

  /// 재생이 끝났다고 알린다.
  void finish() {
    _playing = false;
    final callback = _whenFinished;
    _whenFinished = null;
    callback?.call();
  }
}

/// 44100Hz 16bit mono WAV 헤더를 흉내 낸 바이트. 형식 판정 확인용이다.
Uint8List _wavBytes([int payload = 8]) {
  final header = <int>[
    0x52, 0x49, 0x46, 0x46, // RIFF
    0, 0, 0, 0,
    0x57, 0x41, 0x56, 0x45, // WAVE
  ];
  return Uint8List.fromList([...header, ...List<int>.filled(payload, 1)]);
}

void main() {
  group('VoiceAudioFormat.detect', () {
    test('RIFF로 시작하면 wav다', () {
      expect(VoiceAudioFormat.detect(_wavBytes()), VoiceAudioFormat.wav);
    });

    test('ID3로 시작하면 mp3다', () {
      final bytes = Uint8List.fromList([0x49, 0x44, 0x33, 0x04, 0, 0]);
      expect(VoiceAudioFormat.detect(bytes), VoiceAudioFormat.mp3);
    });

    test('OggS로 시작하면 opus다', () {
      final bytes = Uint8List.fromList([0x4F, 0x67, 0x67, 0x53, 0, 0]);
      expect(VoiceAudioFormat.detect(bytes), VoiceAudioFormat.opus);
    });

    test('fLaC로 시작하면 flac다', () {
      final bytes = Uint8List.fromList([0x66, 0x4C, 0x61, 0x43, 0, 0]);
      expect(VoiceAudioFormat.detect(bytes), VoiceAudioFormat.flac);
    });

    test('ADTS 동기 워드는 aac, MP3 프레임 헤더는 mp3로 가른다', () {
      expect(
        VoiceAudioFormat.detect(Uint8List.fromList([0xFF, 0xF1, 0x50, 0x80])),
        VoiceAudioFormat.aac,
      );
      expect(
        VoiceAudioFormat.detect(Uint8List.fromList([0xFF, 0xFB, 0x90, 0x00])),
        VoiceAudioFormat.mp3,
      );
    });

    test('알 수 없는 바이트는 wav로 둔다. 합성 서버가 주는 것이 wav다', () {
      expect(VoiceAudioFormat.detect(const [1, 2, 3]), VoiceAudioFormat.wav);
      expect(VoiceAudioFormat.detect(const []), VoiceAudioFormat.wav);
    });
  });

  group('바이트 재생', () {
    late _FakeAudioPlayer player;
    late VoicePlaybackService service;

    setUp(() {
      player = _FakeAudioPlayer();
      service = VoicePlaybackService(player: player);
    });

    tearDown(() => service.dispose());

    test('바이트를 그대로 넘긴다. 임시 파일을 만들지 않는다', () async {
      final bytes = _wavBytes();
      await service.playBytes(bytes);

      expect(player.played, hasLength(1));
      expect(player.played.single, bytes);
      expect(player.formats.single, VoiceAudioFormat.wav);
    });

    test('형식을 주지 않으면 바이트를 보고 짐작한다', () async {
      await service.playBytes([0x49, 0x44, 0x33, 0x04, 0, 0]);
      expect(player.formats.single, VoiceAudioFormat.mp3);
    });

    test('형식을 주면 짐작하지 않고 그것을 쓴다', () async {
      await service.playBytes(_wavBytes(), format: VoiceAudioFormat.aac);
      expect(player.formats.single, VoiceAudioFormat.aac);
    });

    test('재생을 시작하면 playing, 끝나면 idle이다', () async {
      final seen = <VoicePlaybackStatus>[];
      final sub = service.states.listen((s) => seen.add(s.status));

      await service.playBytes(_wavBytes(), id: 'memo-1');
      expect(service.isPlaying, isTrue);
      expect(service.currentId, 'memo-1');
      expect(service.state.isPlayingId('memo-1'), isTrue);

      player.finish();
      await Future<void>.delayed(Duration.zero);

      expect(service.isPlaying, isFalse);
      expect(service.currentId, isNull);
      expect(seen, [VoicePlaybackStatus.playing, VoicePlaybackStatus.idle]);
      await sub.cancel();
    });

    test('빈 바이트는 이유를 담은 예외로 던진다', () async {
      await expectLater(
        service.playBytes(const <int>[]),
        throwsA(isA<VoicePlaybackException>().having(
          (e) => e.kind,
          'kind',
          VoicePlaybackErrorKind.emptyAudio,
        )),
      );
      expect(player.played, isEmpty);
      expect(service.isBusy, isFalse);
      expect(service.state.errorMessage, isNotNull);
    });

    test('장치가 실패하면 VoicePlaybackException으로 감싸 던지고 idle로 돌아온다', () async {
      player.failWith = StateError('device gone');

      await expectLater(
        service.playBytes(_wavBytes()),
        throwsA(isA<VoicePlaybackException>()
            .having((e) => e.kind, 'kind', VoicePlaybackErrorKind.playbackFailed)
            .having((e) => e.message, 'message', isNotEmpty)
            .having((e) => e.cause, 'cause', isA<StateError>())),
      );
      expect(service.isBusy, isFalse);
    });

    test('장치가 이미 VoicePlaybackException을 던지면 그대로 올린다', () async {
      player.failWith = VoicePlaybackException(
        kind: VoicePlaybackErrorKind.deviceUnavailable,
        message: '소리를 낼 수 없습니다.',
      );

      await expectLater(
        service.playBytes(_wavBytes()),
        throwsA(isA<VoicePlaybackException>().having(
          (e) => e.kind,
          'kind',
          VoicePlaybackErrorKind.deviceUnavailable,
        )),
      );
    });

    test('awaitCompletion은 재생이 끝날 때 돌아온다', () async {
      await service.playBytes(_wavBytes());

      var done = false;
      final waiting = service.awaitCompletion().then((_) => done = true);
      await Future<void>.delayed(Duration.zero);
      expect(done, isFalse, reason: '아직 재생 중이다');

      player.finish();
      await waiting;
      expect(done, isTrue);
    });

    test('재생 중이 아니면 awaitCompletion은 바로 돌아온다', () async {
      await service.awaitCompletion();
    });
  });

  group('한 번에 하나만 재생한다', () {
    late _FakeAudioPlayer player;
    late VoicePlaybackService service;

    setUp(() {
      player = _FakeAudioPlayer();
      service = VoicePlaybackService(player: player);
    });

    tearDown(() => service.dispose());

    test('다음 재생은 앞의 것을 멈추고 시작한다', () async {
      await service.playBytes(_wavBytes(4), id: 'memo-1');
      expect(service.currentId, 'memo-1');

      await service.playBytes(_wavBytes(9), id: 'memo-2');

      expect(player.stopCount, greaterThanOrEqualTo(1));
      expect(player.played, hasLength(2));
      expect(service.currentId, 'memo-2');
      expect(service.isPlaying, isTrue);
    });

    test('멈춘 재생의 종료 알림이 새 재생의 상태를 건드리지 않는다', () async {
      await service.playBytes(_wavBytes(4), id: 'memo-1');
      final stale = player._whenFinished!;

      await service.playBytes(_wavBytes(9), id: 'memo-2');
      stale();
      await Future<void>.delayed(Duration.zero);

      expect(service.isPlaying, isTrue, reason: '두 번째 재생은 아직 진행 중이다');
      expect(service.currentId, 'memo-2');
    });

    test('stop은 재생을 멈추고 idle로 돌린다', () async {
      await service.playBytes(_wavBytes(), id: 'memo-1');
      await service.stop();

      expect(player.stopCount, greaterThanOrEqualTo(1));
      expect(service.isBusy, isFalse);
      expect(service.currentId, isNull);
    });

    test('연달아 세 번 눌러도 마지막 하나만 재생 중으로 남는다', () async {
      await service.playBytes(_wavBytes(1), id: 'a');
      await service.playBytes(_wavBytes(2), id: 'b');
      await service.playBytes(_wavBytes(3), id: 'c');

      expect(player.played, hasLength(3));
      expect(service.currentId, 'c');
      expect(service.state.isPlayingId('a'), isFalse);
      expect(service.state.isPlayingId('b'), isFalse);
    });
  });

  group('합성 후 재생', () {
    late _FakeAudioPlayer player;

    setUp(() => player = _FakeAudioPlayer());

    test('합성한 바이트를 재생한다', () async {
      final service = VoicePlaybackService(
        player: player,
        synthesizer: ({
          required String text,
          String? voice,
          String? language,
          double? speed,
        }) async =>
            _wavBytes(),
      );
      addTearDown(service.dispose);

      await service.speak(text: '안녕하세요', id: 'memo-1');

      expect(player.played, hasLength(1));
      expect(service.currentId, 'memo-1');
    });

    test('합성을 기다리는 동안은 loading이다', () async {
      final gate = Completer<Uint8List>();
      final service = VoicePlaybackService(
        player: player,
        synthesizer: ({
          required String text,
          String? voice,
          String? language,
          double? speed,
        }) =>
            gate.future,
      );
      addTearDown(service.dispose);

      final pending = service.speak(text: '안녕하세요', id: 'memo-1');
      await Future<void>.delayed(Duration.zero);

      expect(service.state.isLoading, isTrue);
      expect(service.state.isBusyWithId('memo-1'), isTrue);
      expect(player.played, isEmpty);

      gate.complete(_wavBytes());
      await pending;
      expect(service.isPlaying, isTrue);
    });

    test('기다리는 사이 다른 재생이 들어오면 늦게 온 오디오는 버린다', () async {
      final gate = Completer<Uint8List>();
      final service = VoicePlaybackService(
        player: player,
        synthesizer: ({
          required String text,
          String? voice,
          String? language,
          double? speed,
        }) =>
            gate.future,
      );
      addTearDown(service.dispose);

      final pending = service.speak(text: '첫 번째', id: 'memo-1');
      await Future<void>.delayed(Duration.zero);

      final second = _wavBytes(9);
      await service.playBytes(second, id: 'memo-2');

      gate.complete(_wavBytes(4));
      await pending;
      await Future<void>.delayed(Duration.zero);

      expect(player.played, hasLength(1), reason: '늦게 온 합성 결과는 재생하지 않는다');
      expect(player.played.single, second);
      expect(service.currentId, 'memo-2');
    });

    test('합성 실패는 VoiceEngineException 그대로 올리고 idle로 돌아온다', () async {
      final service = VoicePlaybackService(
        player: player,
        synthesizer: ({
          required String text,
          String? voice,
          String? language,
          double? speed,
        }) async =>
            throw VoiceEngineException(
              kind: VoiceEngineErrorKind.timeout,
              message: '시간 안에 응답이 오지 않았습니다.',
            ),
      );
      addTearDown(service.dispose);

      await expectLater(
        service.speak(text: '안녕하세요'),
        throwsA(isA<VoiceEngineException>()),
      );
      expect(service.isBusy, isFalse);
      expect(service.state.errorMessage, '시간 안에 응답이 오지 않았습니다.');
      expect(player.played, isEmpty);
    });

    test('합성기가 없으면 speak는 notConfigured로 던진다', () async {
      final service = VoicePlaybackService(player: player);
      addTearDown(service.dispose);

      expect(service.canSpeak, isFalse);
      await expectLater(
        service.speak(text: '안녕하세요'),
        throwsA(isA<VoicePlaybackException>().having(
          (e) => e.kind,
          'kind',
          VoicePlaybackErrorKind.notConfigured,
        )),
      );
    });
  });

  group('정리', () {
    test('dispose는 장치를 닫고 상태 스트림을 닫는다', () async {
      final player = _FakeAudioPlayer();
      final service = VoicePlaybackService(player: player);

      await service.playBytes(_wavBytes());
      await service.dispose();

      expect(player.closeCount, 1);
      // 두 번 불러도 문제가 없다.
      await service.dispose();
      expect(player.closeCount, 1);
    });

    test('dispose를 기다리던 awaitCompletion은 풀린다', () async {
      final player = _FakeAudioPlayer();
      final service = VoicePlaybackService(player: player);

      await service.playBytes(_wavBytes());
      final waiting = service.awaitCompletion();
      await service.dispose();
      await waiting;
    });
  });

  group('FlutterSoundAudioPlayer 코덱 대응', () {
    test('wav는 pcm16WAV로 간다. 헤더가 표본율을 들고 있어 따로 주지 않는다', () {
      expect(
        FlutterSoundAudioPlayer.codecOf(VoiceAudioFormat.wav).name,
        'pcm16WAV',
      );
    });

    test('나머지 형식도 각자의 코덱으로 간다', () {
      expect(FlutterSoundAudioPlayer.codecOf(VoiceAudioFormat.mp3).name, 'mp3');
      expect(
        FlutterSoundAudioPlayer.codecOf(VoiceAudioFormat.opus).name,
        'opusOGG',
      );
      expect(
        FlutterSoundAudioPlayer.codecOf(VoiceAudioFormat.flac).name,
        'flac',
      );
      expect(
        FlutterSoundAudioPlayer.codecOf(VoiceAudioFormat.aac).name,
        'aacADTS',
      );
    });
  });

  group('VoicePlaybackException', () {
    test('다시 시도해 볼 만한 실패를 가른다', () {
      bool retryable(VoicePlaybackErrorKind kind) => VoicePlaybackException(
            kind: kind,
            message: 'x',
          ).isRetryable;

      expect(retryable(VoicePlaybackErrorKind.deviceUnavailable), isTrue);
      expect(retryable(VoicePlaybackErrorKind.playbackFailed), isTrue);
      expect(retryable(VoicePlaybackErrorKind.emptyAudio), isFalse);
      expect(retryable(VoicePlaybackErrorKind.notConfigured), isFalse);
    });

    test('toString에 이유와 문구가 담긴다', () {
      final e = VoicePlaybackException(
        kind: VoicePlaybackErrorKind.playbackFailed,
        message: '소리를 재생하지 못했습니다.',
        detail: 'codec mismatch',
      );
      expect(e.toString(), contains('playbackFailed'));
      expect(e.toString(), contains('소리를 재생하지 못했습니다.'));
      expect(e.toString(), contains('codec mismatch'));
    });
  });
}
