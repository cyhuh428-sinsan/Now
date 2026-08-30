import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/voice/audio_recorder.dart';
import 'package:now_core/voice/voice_recording_service.dart';

/// 플러그인 없이 규칙만 확인하기 위한 가짜 녹음 장치.
///
/// 실제 오디오 대신 [payload]를 파일에 쓴다. 크기 판정을 확인하기 위해서다.
class _FakeAudioRecorder implements AudioRecorder {
  _FakeAudioRecorder({this.payload = ''});

  String payload;
  bool opened = false;
  bool closed = false;
  int openCount = 0;
  int closeCount = 0;
  final List<String> startedPaths = [];
  bool _recording = false;

  @override
  bool get isRecording => _recording;

  @override
  Future<void> open() async {
    opened = true;
    openCount++;
  }

  @override
  Future<void> start(String filePath) async {
    await open();
    startedPaths.add(filePath);
    _recording = true;
    if (payload.isNotEmpty) {
      File(filePath).writeAsStringSync(payload);
    }
  }

  @override
  Future<void> stop() async {
    _recording = false;
  }

  @override
  Future<void> close() async {
    _recording = false;
    closed = true;
    closeCount++;
  }
}

void main() {
  late Directory root;

  setUp(() {
    root = Directory.systemTemp.createTempSync('now_core_recording_test');
  });

  tearDown(() {
    if (root.existsSync()) root.deleteSync(recursive: true);
  });

  Future<Directory> resolver(RecordingLocation location) async {
    return Directory('${root.path}/${location.name}');
  }

  group('파일 경로 규칙', () {
    test('접두어와 밀리초로 이름을 만든다', () {
      final path = VoiceRecordingService.buildFilePath(
        '/tmp/recordings',
        'memo_tree',
        now: DateTime.fromMillisecondsSinceEpoch(1700000000000),
      );

      expect(path, '/tmp/recordings/memo_tree_1700000000000.aac');
    });

    test('폴더 경로 끝 슬래시가 겹치지 않는다', () {
      final path = VoiceRecordingService.buildFilePath(
        '/tmp/recordings/',
        'meeting',
        now: DateTime.fromMillisecondsSinceEpoch(1),
      );

      expect(path, '/tmp/recordings/meeting_1.aac');
    });
  });

  group('짧은 녹음 판정', () {
    test('1000바이트 미만은 건너뛴다', () {
      expect(VoiceRecordingService.isTooShort(0), isTrue);
      expect(VoiceRecordingService.isTooShort(999), isTrue);
      expect(VoiceRecordingService.isTooShort(1000), isFalse);
      expect(VoiceRecordingService.isTooShort(4096), isFalse);
    });
  });

  group('녹음 시작/정지', () {
    test('시작하면 폴더를 만들고 경로를 돌려준다', () async {
      final recorder = _FakeAudioRecorder();
      final service = VoiceRecordingService(
        recorder: recorder,
        directoryResolver: resolver,
      );

      final path = await service.start(namePrefix: 'meeting');

      expect(path, startsWith('${root.path}/documents'));
      expect(path, endsWith('.aac'));
      expect(path, contains('meeting_'));
      expect(Directory('${root.path}/documents').existsSync(), isTrue);
      expect(recorder.startedPaths, [path]);
      expect(service.currentPath, path);
      expect(service.isRecording, isTrue);
    });

    test('청크는 임시 폴더에 둔다', () async {
      final service = VoiceRecordingService(
        recorder: _FakeAudioRecorder(),
        directoryResolver: resolver,
      );

      final path = await service.start(
        namePrefix: 'chunk',
        location: RecordingLocation.temporary,
      );

      expect(path, startsWith('${root.path}/temporary'));
    });

    test('충분히 긴 녹음은 변환 대상이다', () async {
      final service = VoiceRecordingService(
        recorder: _FakeAudioRecorder(payload: 'a' * 2000),
        directoryResolver: resolver,
      );

      await service.start(namePrefix: 'meeting');
      final recording = await service.stop();

      expect(recording, isNotNull);
      expect(recording!.byteLength, 2000);
      expect(recording.isTooShort, isFalse);
      expect(recording.exists, isTrue);
    });

    test('짧은 녹음은 tooShort로 표시된다', () async {
      final service = VoiceRecordingService(
        recorder: _FakeAudioRecorder(payload: 'a' * 10),
        directoryResolver: resolver,
      );

      await service.start(namePrefix: 'meeting');
      final recording = await service.stop();

      expect(recording!.byteLength, 10);
      expect(recording.isTooShort, isTrue);
    });

    test('파일이 만들어지지 않았으면 크기가 0이다', () async {
      final service = VoiceRecordingService(
        recorder: _FakeAudioRecorder(),
        directoryResolver: resolver,
      );

      await service.start(namePrefix: 'meeting');
      final recording = await service.stop();

      expect(recording!.byteLength, 0);
      expect(recording.isTooShort, isTrue);
      expect(recording.exists, isFalse);
    });

    test('시작한 적이 없으면 결과가 null이다', () async {
      final service = VoiceRecordingService(
        recorder: _FakeAudioRecorder(),
        directoryResolver: resolver,
      );

      expect(await service.stop(), isNull);
    });

    test('closeDevice가 false면 장치를 닫지 않는다', () async {
      final recorder = _FakeAudioRecorder(payload: 'a' * 2000);
      final service = VoiceRecordingService(
        recorder: recorder,
        directoryResolver: resolver,
      );

      await service.start(
        namePrefix: 'chunk',
        location: RecordingLocation.temporary,
      );
      await service.stop(closeDevice: false);

      expect(recorder.closeCount, 0);

      await service.start(
        namePrefix: 'chunk',
        location: RecordingLocation.temporary,
      );
      await service.stop();

      expect(recorder.closeCount, 1);
      expect(recorder.startedPaths.length, 2);
    });
  });

  group('취소', () {
    test('discard는 파일을 지운다', () async {
      final service = VoiceRecordingService(
        recorder: _FakeAudioRecorder(payload: 'a' * 2000),
        directoryResolver: resolver,
      );

      final path = await service.start(namePrefix: 'meeting');
      expect(File(path).existsSync(), isTrue);

      await service.discard();

      expect(File(path).existsSync(), isFalse);
      expect(service.currentPath, isNull);
    });

    test('delete는 파일이 없어도 예외를 던지지 않는다', () async {
      final recording = VoiceRecording(
        file: File('${root.path}/없는파일.aac'),
        byteLength: 0,
      );

      await expectLater(recording.delete(), completes);
    });
  });
}
