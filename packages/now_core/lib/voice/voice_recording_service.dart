import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'audio_recorder.dart';

/// 녹음 파일을 어디에 둘지.
enum RecordingLocation {
  /// 앱 문서 폴더 아래 `recordings`. 회의/메모 전체 녹음이 여기 들어간다.
  /// 변환이 끝날 때까지 남겨 두어야 하므로 임시 폴더를 쓰지 않는다.
  documents,

  /// 임시 폴더. 30초 청크처럼 보내고 바로 버리는 파일이 들어간다.
  temporary,
}

/// 녹음 한 건의 결과.
class VoiceRecording {
  const VoiceRecording({required this.file, required this.byteLength});

  /// 녹음 파일.
  final File file;

  /// 파일 크기(바이트). 파일이 없으면 0이다.
  final int byteLength;

  /// 변환을 걸 필요가 없을 만큼 짧은 녹음인지.
  ///
  /// 마이크를 켰다가 바로 끈 경우가 여기 걸린다. 서버로 보내 봐야 빈 결과가
  /// 오므로 호출한 쪽에서 건너뛴다.
  bool get isTooShort => byteLength < VoiceRecordingService.minimumBytes;

  /// 파일이 남아 있는지.
  bool get exists => file.existsSync();

  /// 파일을 지운다. 없으면 조용히 지나간다.
  Future<void> delete() async {
    try {
      if (await file.exists()) await file.delete();
    } on Object {
      // 임시 파일 정리 실패는 사용자 동작에 영향이 없다.
    }
  }

  @override
  String toString() =>
      'VoiceRecording(${file.path}, $byteLength bytes, tooShort: $isTooShort)';
}

/// 녹음 폴더를 찾아 주는 함수. 테스트에서 임시 폴더로 바꿔 끼운다.
typedef RecordingDirectoryResolver = Future<Directory> Function(
  RecordingLocation location,
);

/// 녹음 시작/정지와 파일 규칙을 담는다. 화면을 갖지 않는다.
///
/// 앱 화면(`meeting_progress_page`, `memo_tree_page`)에 흩어져 있던 규칙을
/// 한 곳으로 모은 것이다. 옮긴 규칙은 세 가지다.
///
/// 1. 전체 녹음은 문서 폴더의 `recordings` 아래, 청크는 임시 폴더에 둔다.
/// 2. 파일 이름은 `<접두어>_<밀리초>.aac`다.
/// 3. [minimumBytes]보다 작은 녹음은 변환을 건너뛴다.
class VoiceRecordingService {
  VoiceRecordingService({
    AudioRecorder? recorder,
    RecordingDirectoryResolver? directoryResolver,
  })  : _recorder = recorder ?? FlutterSoundAudioRecorder(),
        _resolveDirectory = directoryResolver ?? _defaultDirectory;

  /// 변환을 거는 최소 크기. 앱이 쓰던 1000바이트 기준을 그대로 옮겼다.
  static const int minimumBytes = 1000;

  /// 녹음 파일 확장자.
  static const String fileExtension = 'aac';

  /// 문서 폴더 아래 녹음이 들어가는 하위 폴더 이름.
  static const String documentsFolderName = 'recordings';

  final AudioRecorder _recorder;
  final RecordingDirectoryResolver _resolveDirectory;

  String? _currentPath;

  /// 지금 녹음 중인지.
  bool get isRecording => _recorder.isRecording;

  /// 진행 중이거나 방금 끝난 녹음 파일 경로. 없으면 null.
  String? get currentPath => _currentPath;

  /// 녹음을 시작하고 파일 경로를 돌려준다.
  ///
  /// [namePrefix]는 파일 이름 앞에 붙는다. 예: `meeting`, `memo_tree`.
  Future<String> start({
    required String namePrefix,
    RecordingLocation location = RecordingLocation.documents,
  }) async {
    final directory = await _resolveDirectory(location);
    if (!await directory.exists()) {
      await directory.create(recursive: true);
    }
    final path = buildFilePath(directory.path, namePrefix);
    await _recorder.start(path);
    _currentPath = path;
    return path;
  }

  /// 녹음을 멈추고 결과를 돌려준다.
  ///
  /// 시작한 적이 없으면 null이다. [closeDevice]가 true면 녹음 장치도 닫는다.
  /// 청크 녹음처럼 곧바로 다음 녹음을 시작할 때는 false로 둔다.
  Future<VoiceRecording?> stop({bool closeDevice = true}) async {
    final path = _currentPath;
    try {
      await _recorder.stop();
      if (closeDevice) await _recorder.close();
    } on Object {
      // 장치 정리 실패로 이미 저장된 파일을 버리지 않는다.
    }
    if (path == null) return null;
    final file = File(path);
    final length = await file.exists() ? await file.length() : 0;
    return VoiceRecording(file: file, byteLength: length);
  }

  /// 녹음을 멈추고 파일까지 지운다. 취소 버튼이 이 동작을 쓴다.
  Future<void> discard({bool closeDevice = true}) async {
    final recording = await stop(closeDevice: closeDevice);
    await recording?.delete();
    _currentPath = null;
  }

  /// 녹음 장치를 닫는다. 화면을 떠날 때 부른다.
  Future<void> dispose() async {
    try {
      await _recorder.close();
    } on Object {
      // 이미 닫혀 있으면 그만이다.
    }
  }

  /// 녹음 파일 경로를 만든다. `<폴더>/<접두어>_<밀리초>.aac`.
  static String buildFilePath(
    String directoryPath,
    String namePrefix, {
    DateTime? now,
  }) {
    final stamp = (now ?? DateTime.now()).millisecondsSinceEpoch;
    final base = directoryPath.endsWith('/') || directoryPath.endsWith(r'\')
        ? directoryPath.substring(0, directoryPath.length - 1)
        : directoryPath;
    return '$base/${namePrefix}_$stamp.$fileExtension';
  }

  /// 크기만으로 변환을 건너뛸지 판단한다.
  static bool isTooShort(int byteLength) => byteLength < minimumBytes;

  static Future<Directory> _defaultDirectory(RecordingLocation location) async {
    switch (location) {
      case RecordingLocation.documents:
        final dir = await getApplicationDocumentsDirectory();
        return Directory('${dir.path}/$documentsFolderName');
      case RecordingLocation.temporary:
        return getTemporaryDirectory();
    }
  }
}
