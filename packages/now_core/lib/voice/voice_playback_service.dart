import 'dart:async';
import 'dart:typed_data';

import 'audio_player.dart';
import 'voice_engine_client.dart';

/// 재생기가 지금 무엇을 하고 있는지.
enum VoicePlaybackStatus {
  /// 아무것도 하지 않는다.
  idle,

  /// 서버에서 오디오를 받아 오는 중이다. `speak`에서만 나온다.
  loading,

  /// 소리가 나는 중이다.
  playing,
}

/// 재생기의 한 순간. 화면이 이 값 하나만 보면 된다.
class VoicePlaybackState {
  const VoicePlaybackState({
    this.status = VoicePlaybackStatus.idle,
    this.id,
    this.errorMessage,
  });

  /// 아무것도 하지 않는 상태.
  static const VoicePlaybackState idle = VoicePlaybackState();

  /// 지금 하고 있는 일.
  final VoicePlaybackStatus status;

  /// 무엇을 재생하고 있는지 부르는 쪽이 붙인 이름. 메모 id 같은 것이다.
  /// 화면이 어느 줄에 표시를 켤지 고를 때 쓴다.
  final String? id;

  /// 마지막 실패 문구. 실패가 없으면 null이다.
  final String? errorMessage;

  /// 소리가 나는 중인지.
  bool get isPlaying => status == VoicePlaybackStatus.playing;

  /// 받아 오는 중인지.
  bool get isLoading => status == VoicePlaybackStatus.loading;

  /// 받아 오는 중이거나 소리가 나는 중인지.
  bool get isBusy => status != VoicePlaybackStatus.idle;

  /// [candidate]가 지금 재생 중인 것인지.
  bool isPlayingId(String candidate) => isPlaying && id == candidate;

  /// [candidate]가 지금 받아 오는 중이거나 재생 중인 것인지.
  bool isBusyWithId(String candidate) => isBusy && id == candidate;

  @override
  String toString() => 'VoicePlaybackState(${status.name}, id: $id'
      '${errorMessage == null ? '' : ', error: $errorMessage'})';
}

/// 문장을 오디오 바이트로 바꾸는 함수.
///
/// 실제로는 [VoiceEngineClient.synthesize]다. 함수로 갈라 둔 이유는 테스트에서
/// 서버 없이 규칙만 확인하기 위해서다.
typedef VoiceSynthesizer = Future<Uint8List> Function({
  required String text,
  String? voice,
  String? language,
  double? speed,
});

/// 합성된 오디오를 재생한다. 화면을 갖지 않는다.
///
/// 규칙은 하나다. **한 번에 하나만 재생한다.** 메모를 연달아 눌러도 소리가
/// 겹치지 않는다. 겹침은 두 곳에서 생길 수 있고 둘 다 막는다.
///
/// 1. 이미 소리가 나는 중에 다음 재생이 들어오는 경우.
///    새 재생을 시작하기 전에 앞의 것을 멈춘다.
/// 2. 합성 응답을 기다리는 중에 다음 재생이 들어오는 경우.
///    늦게 도착한 앞의 오디오는 버린다. 서버 왕복이 길어 이쪽이 더 흔하다.
///
/// 두 경우 모두 [_generation] 번호로 가른다. 요청이 들어올 때마다 번호가
/// 오르고, 자기 번호가 아니게 된 작업은 조용히 물러난다.
///
/// 임시 파일을 쓰지 않는다. [FlutterSoundAudioPlayer]가 바이트를 그대로
/// 재생하므로 디스크에 남는 것이 없다.
class VoicePlaybackService {
  VoicePlaybackService({AudioPlayer? player, VoiceSynthesizer? synthesizer})
      : _player = player ?? FlutterSoundAudioPlayer(),
        _synthesize = synthesizer;

  /// [VoiceEngineClient]를 합성기로 물려 만든다.
  factory VoicePlaybackService.withEngine(
    VoiceEngineClient engine, {
    AudioPlayer? player,
  }) {
    return VoicePlaybackService(
      player: player,
      synthesizer: ({
        required String text,
        String? voice,
        String? language,
        double? speed,
      }) =>
          engine.synthesize(
        text: text,
        voice: voice,
        language: language,
        speed: speed,
      ),
    );
  }

  final AudioPlayer _player;
  final VoiceSynthesizer? _synthesize;

  final StreamController<VoicePlaybackState> _states =
      StreamController<VoicePlaybackState>.broadcast();

  VoicePlaybackState _state = VoicePlaybackState.idle;

  /// 지금 요청의 번호. 새 요청이 들어올 때마다 오른다.
  int _generation = 0;

  /// 재생이 끝나기를 기다리는 쪽에게 알릴 통로.
  Completer<void>? _completion;

  bool _disposed = false;

  /// 상태가 바뀔 때마다 흐른다. 화면이 여기 붙는다.
  ///
  /// 재생이 끝나면 [VoicePlaybackStatus.idle]이 흘러온다. 끝을 아는 방법이
  /// 이것이다. 지금 값이 필요하면 [state]를 본다.
  Stream<VoicePlaybackState> get states => _states.stream;

  /// 지금 상태.
  VoicePlaybackState get state => _state;

  /// 소리가 나는 중인지.
  bool get isPlaying => _state.isPlaying;

  /// 받아 오는 중이거나 소리가 나는 중인지.
  bool get isBusy => _state.isBusy;

  /// 지금 재생 중인 것의 이름. 없으면 null이다.
  String? get currentId => _state.id;

  /// 합성기가 붙어 있는지. 없으면 [speak]를 부를 수 없다.
  bool get canSpeak => _synthesize != null;

  /// 오디오 바이트를 재생한다.
  ///
  /// 앞에서 나던 소리는 멈춘다. 돌아오는 시점은 재생이 끝난 때가 아니라
  /// 재생이 시작된 때다. 끝까지 기다리려면 [awaitCompletion]을 쓴다.
  ///
  /// [id]는 화면이 어느 줄에 표시를 켤지 고를 때 쓰는 이름이다.
  /// [format]을 주지 않으면 바이트 앞머리를 보고 짐작한다.
  ///
  /// 실패하면 [VoicePlaybackException]을 던진다.
  Future<void> playBytes(
    List<int> bytes, {
    String? id,
    VoiceAudioFormat? format,
  }) async {
    final token = _beginRequest();
    await _stopPlayer();
    if (_isStale(token)) return;
    await _playResolved(token, bytes, id: id, format: format);
  }

  /// 문장을 합성해 재생한다.
  ///
  /// 합성을 기다리는 동안 다른 재생이 들어오면 이 요청은 물러난다. 늦게 도착한
  /// 오디오는 재생하지 않는다.
  ///
  /// 합성이 실패하면 `VoiceEngineException`을, 재생이 실패하면
  /// [VoicePlaybackException]을 던진다. 둘 다 `message`에 한국어 문구를 담는다.
  Future<void> speak({
    required String text,
    String? id,
    String? voice,
    String? language,
    double? speed,
  }) async {
    final synthesize = _synthesize;
    if (synthesize == null) {
      throw VoicePlaybackException(
        kind: VoicePlaybackErrorKind.notConfigured,
        message: '음성 합성이 준비되어 있지 않습니다. 설정에서 TTS 서버 주소를 입력해 주세요.',
      );
    }

    final token = _beginRequest();
    await _stopPlayer();
    if (_isStale(token)) return;

    _emit(VoicePlaybackState(status: VoicePlaybackStatus.loading, id: id));

    final Uint8List bytes;
    try {
      bytes = await synthesize(
        text: text,
        voice: voice,
        language: language,
        speed: speed,
      );
    } on VoiceEngineException catch (e) {
      _failIfCurrent(token, e.message);
      rethrow;
    } on Object catch (e) {
      _failIfCurrent(token, '소리를 준비하지 못했습니다.');
      throw VoicePlaybackException(
        kind: VoicePlaybackErrorKind.unknown,
        message: '소리를 준비하지 못했습니다.',
        detail: e.toString(),
        cause: e,
      );
    }

    // 기다리는 사이에 다른 재생이 들어왔다. 이 오디오는 버린다.
    if (_isStale(token)) return;
    await _playResolved(token, bytes, id: id);
  }

  /// 재생을 멈춘다.
  ///
  /// 받아 오는 중이었다면 그 결과도 버린다.
  Future<void> stop() async {
    _beginRequest();
    await _stopPlayer();
    _emit(VoicePlaybackState.idle);
  }

  /// 지금 재생이 끝날 때까지 기다린다. 재생 중이 아니면 바로 돌아온다.
  ///
  /// 멈춰서 끝난 경우에도 돌아온다. 실패는 [playBytes]/[speak]가 이미 던졌으므로
  /// 여기서는 던지지 않는다.
  Future<void> awaitCompletion() async {
    final completion = _completion;
    if (completion == null || completion.isCompleted) return;
    await completion.future;
  }

  /// 재생기를 닫는다. 화면을 떠날 때 부른다.
  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    _generation++;
    _finishCompletion();
    try {
      await _player.close();
    } on Object {
      // 이미 닫혀 있으면 그만이다.
    }
    await _states.close();
  }

  // ----------------------------------------------------------------
  // 내부
  // ----------------------------------------------------------------

  /// 새 요청의 번호를 받는다. 앞선 요청은 이 시점부터 남의 것이 된다.
  int _beginRequest() {
    _generation++;
    _finishCompletion();
    _completion = Completer<void>();
    return _generation;
  }

  bool _isStale(int token) => _disposed || token != _generation;

  Future<void> _playResolved(
    int token,
    List<int> bytes, {
    String? id,
    VoiceAudioFormat? format,
  }) async {
    if (bytes.isEmpty) {
      const message = '재생할 소리가 없습니다.';
      _failIfCurrent(token, message);
      throw VoicePlaybackException(
        kind: VoicePlaybackErrorKind.emptyAudio,
        message: message,
      );
    }

    final data = bytes is Uint8List ? bytes : Uint8List.fromList(bytes);
    // 재생 중 상태를 먼저 알린다. 아주 짧은 오디오는 아래 await가 돌아오기
    // 전에 끝나기도 하는데, 그때 종료 알림이 뒤에 오도록 하기 위해서다.
    _emit(VoicePlaybackState(status: VoicePlaybackStatus.playing, id: id));
    try {
      await _player.play(
        data,
        format: format ?? VoiceAudioFormat.detect(data),
        whenFinished: () => _onFinished(token),
      );
    } on VoicePlaybackException catch (e) {
      _failIfCurrent(token, e.message);
      rethrow;
    } on Object catch (e) {
      const message = '소리를 재생하지 못했습니다.';
      _failIfCurrent(token, message);
      throw VoicePlaybackException(
        kind: VoicePlaybackErrorKind.playbackFailed,
        message: message,
        detail: e.toString(),
        cause: e,
      );
    }
  }

  Future<void> _stopPlayer() async {
    try {
      await _player.stop();
    } on Object {
      // 멈추기 실패로 다음 재생을 막지 않는다.
    }
  }

  void _onFinished(int token) {
    if (_isStale(token)) return;
    _emit(VoicePlaybackState.idle);
  }

  void _failIfCurrent(int token, String message) {
    if (_isStale(token)) return;
    _emit(VoicePlaybackState(errorMessage: message));
  }

  void _emit(VoicePlaybackState next) {
    if (_disposed) return;
    _state = next;
    if (!next.isBusy) _finishCompletion();
    if (!_states.isClosed) _states.add(next);
  }

  void _finishCompletion() {
    final completion = _completion;
    _completion = null;
    if (completion != null && !completion.isCompleted) {
      completion.complete();
    }
  }
}
