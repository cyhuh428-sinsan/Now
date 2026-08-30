import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:now_core/server/server_recording.dart';
import 'package:now_core/server/server_settings.dart';

/// 실제 서버를 부르지 않는다. dio 어댑터를 갈아 끼워 가짜 응답을 준다.
typedef FakeHandler = FutureOr<ResponseBody> Function(RequestOptions options);

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final FakeHandler handler;
  final List<RequestOptions> requests = <RequestOptions>[];

  RequestOptions get lastRequest => requests.last;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _jsonBody(Map<String, dynamic> data, {int status = 200}) {
  return ResponseBody.fromString(
    jsonEncode(data),
    status,
    headers: {
      Headers.contentTypeHeader: ['application/json; charset=utf-8'],
    },
  );
}

Dio _dioFor(String baseUrl, _FakeAdapter adapter) {
  return Dio(BaseOptions(baseUrl: baseUrl))..httpClientAdapter = adapter;
}

ServerSettings _settings({
  String baseUrl = 'http://server.test:8750',
  bool enabled = true,
}) {
  return ServerSettings(
    enabled: enabled,
    baseUrl: baseUrl,
    token: '',
    userToken: '',
    webSessionToken: '',
    ownerId: 'cyhuh',
    deviceId: 'android-unit-test',
    lastSyncedAt: null,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUpAll(() async {
    tempDir = await Directory.systemTemp.createTemp('now_core_recording_test');
  });

  tearDownAll(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  Future<File> makeRecordingFile({String name = 'sample.aac'}) async {
    final file = File('${tempDir.path}${Platform.pathSeparator}$name');
    await file.writeAsBytes(List<int>.filled(32, 9));
    return file;
  }

  group('uploadRecordingFile', () {
    test('서버 동기화가 꺼져 있으면 요청 없이 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final file = await makeRecordingFile();
      await expectLater(
        ServerRecordingApi.uploadRecordingFile(
          dio: dio,
          settings: _settings(enabled: false),
          filePath: file.path,
          localId: 'rec-1',
          noteLocalId: null,
          transcript: null,
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('서버 주소가 없으면 요청 없이 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      final file = await makeRecordingFile();
      await expectLater(
        ServerRecordingApi.uploadRecordingFile(
          dio: dio,
          settings: _settings(baseUrl: ''),
          filePath: file.path,
          localId: 'rec-1',
          noteLocalId: null,
          transcript: null,
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('녹음 파일이 없으면 요청 없이 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      await expectLater(
        ServerRecordingApi.uploadRecordingFile(
          dio: dio,
          settings: _settings(),
          filePath:
              '${tempDir.path}${Platform.pathSeparator}missing-file.aac',
          localId: 'rec-1',
          noteLocalId: null,
          transcript: null,
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('multipart로 필드를 채워 올리고 응답을 파싱한다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.method, 'POST');
        expect(options.path, '/api/v1/recordings');
        expect(options.data, isA<FormData>());
        final form = options.data as FormData;
        Object? fieldValue(String key) => form.fields
            .firstWhere((entry) => entry.key == key)
            .value;
        expect(fieldValue('owner_id'), 'cyhuh');
        expect(fieldValue('device_id'), 'android-unit-test');
        expect(fieldValue('local_id'), 'rec-1');
        expect(fieldValue('note_local_id'), 'note-9');
        expect(fieldValue('transcript'), '녹음 내용');
        expect(form.files.single.key, 'file');
        expect(form.files.single.value.filename, 'sample.aac');
        return _jsonBody({
          'local_id': 'rec-1',
          'file_name': 'sample.aac',
          'transcript': '녹음 내용',
        });
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final file = await makeRecordingFile();

      final result = await ServerRecordingApi.uploadRecordingFile(
        dio: dio,
        settings: _settings(),
        filePath: file.path,
        localId: 'rec-1',
        noteLocalId: 'note-9',
        transcript: '녹음 내용',
      );

      expect(result.localId, 'rec-1');
      expect(result.fileName, 'sample.aac');
      expect(result.transcript, '녹음 내용');
    });

    test('빈 문자열 noteLocalId/transcript는 null로 보내(빈 값으로 채워)진다', () async {
      final adapter = _FakeAdapter((options) {
        final form = options.data as FormData;
        String fieldValue(String key) =>
            form.fields.firstWhere((entry) => entry.key == key).value;
        // _blankToNull이 null로 바꾼 값은 FormData.fromMap을 지나며
        // 빈 문자열로 인코딩된다(널이 아니라 키 자체가 빠지는 것은 아니다).
        expect(fieldValue('note_local_id'), '');
        expect(fieldValue('transcript'), '');
        return _jsonBody({'local_id': 'rec-1', 'file_name': 'sample.aac'});
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final file = await makeRecordingFile();

      await ServerRecordingApi.uploadRecordingFile(
        dio: dio,
        settings: _settings(),
        filePath: file.path,
        localId: 'rec-1',
        noteLocalId: '   ',
        transcript: '',
      );
    });

    test('서버가 오류를 돌려주면 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return ResponseBody.fromString(
          jsonEncode({'detail': '업로드 실패'}),
          400,
          headers: {
            Headers.contentTypeHeader: ['application/json; charset=utf-8'],
          },
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);
      final file = await makeRecordingFile();

      try {
        await ServerRecordingApi.uploadRecordingFile(
          dio: dio,
          settings: _settings(),
          filePath: file.path,
          localId: 'rec-1',
          noteLocalId: null,
          transcript: null,
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('업로드 실패'));
      }
    });
  });

  group('loadRecordings', () {
    test('서버 주소가 없으면 요청 없이 예외를 던진다', () async {
      final adapter = _FakeAdapter((_) {
        fail('요청이 나가면 안 된다');
      });
      final dio = _dioFor('', adapter);
      await expectLater(
        ServerRecordingApi.loadRecordings(
          dio: dio,
          settings: _settings(baseUrl: ''),
        ),
        throwsA(isA<Exception>()),
      );
      expect(adapter.requests, isEmpty);
    });

    test('owner_id로 조회하고 목록을 파싱한다', () async {
      final adapter = _FakeAdapter((options) {
        expect(options.method, 'GET');
        expect(options.path, '/api/v1/recordings');
        expect(options.queryParameters['owner_id'], 'cyhuh');
        return ResponseBody.fromString(
          jsonEncode([
            {
              'id': 1,
              'owner_id': 'cyhuh',
              'device_id': 'android-unit-test',
              'local_id': 'rec-1',
              'note_local_id': 'note-9',
              'file_name': 'sample.aac',
              'content_type': 'audio/aac',
              'transcript': '녹음 내용',
              'created_at': '2026-08-19T00:00:00Z',
              'updated_at': '2026-08-19T00:00:00Z',
            },
            {
              'id': 2,
              'owner_id': 'cyhuh',
              'local_id': 'rec-2',
              'file_name': 'sample2.aac',
            },
          ]),
          200,
          headers: {
            Headers.contentTypeHeader: ['application/json; charset=utf-8'],
          },
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      final recordings = await ServerRecordingApi.loadRecordings(
        dio: dio,
        settings: _settings(),
      );

      expect(recordings, hasLength(2));
      expect(recordings.first.id, 1);
      expect(recordings.first.localId, 'rec-1');
      expect(recordings.first.hasTranscript, isTrue);
      expect(recordings.last.ownerId, 'cyhuh');
      expect(recordings.last.hasTranscript, isFalse);
    });

    test('서버가 오류를 돌려주면 예외 메시지에 상세를 담는다', () async {
      final adapter = _FakeAdapter((options) {
        return ResponseBody.fromString(
          jsonEncode({'detail': 'user inactive'}),
          403,
          headers: {
            Headers.contentTypeHeader: ['application/json; charset=utf-8'],
          },
        );
      });
      final dio = _dioFor('http://server.test:8750', adapter);

      try {
        await ServerRecordingApi.loadRecordings(
          dio: dio,
          settings: _settings(),
        );
        fail('예외가 나야 한다');
      } catch (e) {
        expect(e.toString(), contains('비활성 사용자'));
      }
    });
  });
}
