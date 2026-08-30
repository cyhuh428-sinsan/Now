import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/voice/voice_engine_client.dart';
import 'package:now_core/voice/voice_settings.dart';

/// 실제 서버를 부르지 않는다. dio 어댑터를 갈아 끼워 가짜 응답을 준다.
typedef FakeHandler = FutureOr<ResponseBody> Function(RequestOptions options);

class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);

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

Dio dioWith(FakeAdapter adapter) => Dio()..httpClientAdapter = adapter;

ResponseBody jsonBody(Map<String, dynamic> data, {int status = 200}) {
  return ResponseBody.fromString(
    jsonEncode(data),
    status,
    headers: {
      Headers.contentTypeHeader: ['application/json; charset=utf-8'],
    },
  );
}

ResponseBody audioBody(List<int> bytes) {
  return ResponseBody.fromBytes(
    bytes,
    200,
    headers: {
      Headers.contentTypeHeader: ['audio/wav'],
      'x-engine': ['supertonic'],
      'x-sample-rate': ['44100'],
      'x-audio-duration': ['1.532'],
      'x-processing-seconds': ['0.211'],
    },
  );
}

VoiceSettings testSettings({
  String stt = 'http://stt.test:9000',
  String tts = 'http://tts.test:9100',
  String sttKey = 'stt-test-key',
  String ttsKey = 'tts-test-key',
  String voiceId = '',
}) {
  return VoiceSettings(
    sttBaseUrl: stt,
    sttApiKey: sttKey,
    ttsBaseUrl: tts,
    ttsApiKey: ttsKey,
    voiceId: voiceId,
  );
}

late Directory tempDir;

Future<File> makeAudioFile() async {
  final file = File('${tempDir.path}${Platform.pathSeparator}sample.wav');
  await file.writeAsBytes(List<int>.filled(64, 7));
  return file;
}

void main() {
  setUpAll(() async {
    tempDir = await Directory.systemTemp.createTemp('now_core_voice_test');
  });

  tearDownAll(() async {
    if (tempDir.existsSync()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('transcribe', () {
    test('정상 응답에서 text를 뽑는다', () async {
      final adapter = FakeAdapter(
        (_) => jsonBody({
          'text': '연결 확인',
          'language': 'ko',
          'duration': 1.532,
          'engine': 'whisper',
          'processing_s': 1.411,
        }),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      final text = await client.transcribe(file: await makeAudioFile());

      expect(text, '연결 확인');
      expect(adapter.lastRequest.method, 'POST');
      expect(
        adapter.lastRequest.uri.toString(),
        'http://stt.test:9000/v1/audio/transcriptions',
      );
      expect(
        adapter.lastRequest.headers['Authorization'],
        'Bearer stt-test-key',
      );
      expect(adapter.lastRequest.data, isA<FormData>());
      final form = adapter.lastRequest.data as FormData;
      expect(form.fields.any((e) => e.key == 'language' && e.value == 'ko'),
          isTrue);
      expect(form.files.single.key, 'file');
    });

    test('끝 슬래시와 중복 /v1이 있어도 경로가 하나만 붙는다', () async {
      final adapter = FakeAdapter((_) => jsonBody({'text': '연결 확인'}));
      final client = VoiceEngineClient(
        settings: testSettings(stt: 'http://stt.test:9000/v1/'),
        dio: dioWith(adapter),
      );

      await client.transcribe(file: await makeAudioFile());

      expect(
        adapter.lastRequest.uri.toString(),
        'http://stt.test:9000/v1/audio/transcriptions',
      );
    });

    test('response_format=text면 본문 문자열이 결과다', () async {
      final adapter = FakeAdapter(
        (_) => ResponseBody.fromString(
          '연결 확인',
          200,
          headers: {
            Headers.contentTypeHeader: ['text/plain; charset=utf-8'],
          },
        ),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      final text = await client.transcribe(
        file: await makeAudioFile(),
        responseFormat: 'text',
      );

      expect(text, '연결 확인');
    });

    test('주소가 없으면 notConfigured로 던진다', () async {
      final client = VoiceEngineClient(settings: VoiceSettings.empty());

      await expectLater(
        client.transcribe(file: await makeAudioFile()),
        throwsA(
          isA<VoiceEngineException>().having(
            (e) => e.kind,
            'kind',
            VoiceEngineErrorKind.notConfigured,
          ),
        ),
      );
    });

    test('없는 파일이면 invalidRequest로 던진다', () async {
      final client = VoiceEngineClient(settings: testSettings());

      await expectLater(
        client.transcribe(
          file: File('${tempDir.path}${Platform.pathSeparator}nope.wav'),
        ),
        throwsA(
          isA<VoiceEngineException>().having(
            (e) => e.kind,
            'kind',
            VoiceEngineErrorKind.invalidRequest,
          ),
        ),
      );
    });

    test('text가 없는 응답은 invalidResponse다', () async {
      final adapter = FakeAdapter((_) => jsonBody({'language': 'ko'}));
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.transcribe(file: await makeAudioFile()),
        throwsA(
          isA<VoiceEngineException>().having(
            (e) => e.kind,
            'kind',
            VoiceEngineErrorKind.invalidResponse,
          ),
        ),
      );
    });
  });

  group('synthesize', () {
    test('오디오 바이트를 그대로 돌려준다', () async {
      final wav = List<int>.generate(128, (i) => i % 256);
      final adapter = FakeAdapter((_) => audioBody(wav));
      final client = VoiceEngineClient(
        settings: testSettings(voiceId: 'F1'),
        dio: dioWith(adapter),
      );

      final bytes = await client.synthesize(text: '연결 확인');

      expect(bytes, isA<Uint8List>());
      expect(bytes.length, 128);
      expect(bytes.take(4), [0, 1, 2, 3]);
      expect(
        adapter.lastRequest.uri.toString(),
        'http://tts.test:9100/v1/audio/speech',
      );
      expect(adapter.lastRequest.responseType, ResponseType.bytes);
      expect(
        adapter.lastRequest.headers['Authorization'],
        'Bearer tts-test-key',
      );

      final body = adapter.lastRequest.data as Map<String, dynamic>;
      expect(body['input'], '연결 확인');
      expect(body['voice'], 'F1');
      expect(body['language'], 'ko');
      expect(body['speed'], 1.0);
      expect(body['response_format'], 'wav');
    });

    test('헤더의 참고 정보를 함께 준다', () async {
      final adapter = FakeAdapter((_) => audioBody(List<int>.filled(16, 1)));
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      final result = await client.synthesizeDetailed(text: '연결 확인');

      expect(result.contentType, startsWith('audio/wav'));
      expect(result.engine, 'supertonic');
      expect(result.sampleRate, 44100);
      expect(result.audioSeconds, 1.532);
      expect(result.processingSeconds, 0.211);
    });

    test('속도는 서버 허용 범위로 맞춰서 보낸다', () async {
      final adapter = FakeAdapter((_) => audioBody(List<int>.filled(4, 1)));
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await client.synthesize(text: '연결 확인', speed: 9.0);

      final body = adapter.lastRequest.data as Map<String, dynamic>;
      expect(body['speed'], VoiceSettings.maxSpeed);
    });

    test('빈 문장은 invalidRequest로 던진다', () async {
      final client = VoiceEngineClient(settings: testSettings());

      await expectLater(
        client.synthesize(text: '   '),
        throwsA(
          isA<VoiceEngineException>().having(
            (e) => e.kind,
            'kind',
            VoiceEngineErrorKind.invalidRequest,
          ),
        ),
      );
    });

    test('오디오 대신 JSON이 오면 invalidResponse다', () async {
      final adapter = FakeAdapter((_) => jsonBody({'detail': 'no voice'}));
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.synthesize(text: '연결 확인'),
        throwsA(
          isA<VoiceEngineException>().having(
            (e) => e.kind,
            'kind',
            VoiceEngineErrorKind.invalidResponse,
          ),
        ),
      );
    });
  });

  group('loadVoices', () {
    test('보이스 목록을 파싱한다', () async {
      final adapter = FakeAdapter(
        (_) => jsonBody({
          'engine': 'supertonic',
          'voices': [
            {
              'id': 'F1',
              'name': 'F1',
              'gender': 'female',
              'language': 'multilingual',
            },
            {'id': 'M1', 'name': 'M1', 'gender': 'male'},
          ],
        }),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      final voices = await client.loadVoices();

      expect(voices, hasLength(2));
      expect(voices.first.id, 'F1');
      expect(voices.first.gender, 'female');
      expect(voices.first.language, 'multilingual');
      expect(voices.last.id, 'M1');
      expect(
        adapter.lastRequest.uri.toString(),
        'http://tts.test:9100/v1/voices',
      );
    });
  });

  group('checkHealth', () {
    test('인증 헤더 없이 /health를 부른다', () async {
      final adapter = FakeAdapter(
        (_) => jsonBody({
          'status': 'ok',
          'engine': 'whisper',
          'kind': 'stt',
          'model': 'base',
          'ready': true,
          'uptime_s': 900011.3,
        }),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      final health = await client.checkHealth('http://stt.test:9000/v1/');

      expect(health.status, 'ok');
      expect(health.ready, isTrue);
      expect(health.usable, isTrue);
      expect(health.engine, 'whisper');
      expect(health.kind, 'stt');
      expect(health.model, 'base');
      expect(health.uptimeSeconds, 900011.3);
      expect(
        adapter.lastRequest.uri.toString(),
        'http://stt.test:9000/health',
      );
      expect(adapter.lastRequest.headers.containsKey('Authorization'), isFalse);
    });

    test('503은 예외가 아니라 ready=false 결과로 준다', () async {
      final adapter = FakeAdapter(
        (_) => jsonBody(
          {'status': 'loading', 'ready': false, 'engine': 'whisper'},
          status: 503,
        ),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      final health = await client.checkHealth('http://stt.test:9000');

      expect(health.ready, isFalse);
      expect(health.usable, isFalse);
      expect(health.statusCode, 503);
    });

    test('연결 실패는 connectionFailed로 던진다', () async {
      final adapter = FakeAdapter(
        (options) => throw DioException.connectionError(
          requestOptions: options,
          reason: 'failed to connect',
          error: const SocketException('failed to connect'),
        ),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.checkHealth('http://stt.test:9000'),
        throwsA(
          isA<VoiceEngineException>()
              .having(
                (e) => e.kind,
                'kind',
                VoiceEngineErrorKind.connectionFailed,
              )
              .having((e) => e.isRetryable, 'isRetryable', isTrue),
        ),
      );
    });
  });

  group('실패 구분', () {
    test('401은 unauthorized다', () async {
      final adapter = FakeAdapter(
        (_) => jsonBody({'detail': 'Invalid API key'}, status: 401),
      );
      final client = VoiceEngineClient(
        settings: testSettings(sttKey: ''),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.transcribe(file: await makeAudioFile()),
        throwsA(
          isA<VoiceEngineException>()
              .having((e) => e.kind, 'kind', VoiceEngineErrorKind.unauthorized)
              .having((e) => e.statusCode, 'statusCode', 401)
              .having((e) => e.message, 'message', contains('API 키'))
              .having((e) => e.isRetryable, 'isRetryable', isFalse),
        ),
      );
      expect(
        adapter.lastRequest.headers.containsKey('Authorization'),
        isFalse,
        reason: '키가 비면 인증 헤더를 붙이지 않는다',
      );
    });

    test('503은 modelLoading이다', () async {
      final adapter = FakeAdapter(
        (_) => jsonBody({'detail': 'model is loading'}, status: 503),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.synthesize(text: '연결 확인'),
        throwsA(
          isA<VoiceEngineException>()
              .having((e) => e.kind, 'kind', VoiceEngineErrorKind.modelLoading)
              .having((e) => e.statusCode, 'statusCode', 503)
              .having((e) => e.isRetryable, 'isRetryable', isTrue),
        ),
      );
    });

    test('타임아웃은 timeout이다', () async {
      final adapter = FakeAdapter(
        (options) => throw DioException.receiveTimeout(
          timeout: VoiceEngineClient.sttTimeout,
          requestOptions: options,
        ),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.transcribe(file: await makeAudioFile()),
        throwsA(
          isA<VoiceEngineException>()
              .having((e) => e.kind, 'kind', VoiceEngineErrorKind.timeout)
              .having((e) => e.statusCode, 'statusCode', isNull),
        ),
      );
      expect(adapter.lastRequest.receiveTimeout, VoiceEngineClient.sttTimeout);
    });

    test('TTS 타임아웃은 60초로 건다', () async {
      final adapter = FakeAdapter((_) => audioBody(List<int>.filled(4, 1)));
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await client.synthesize(text: '연결 확인');

      expect(adapter.lastRequest.receiveTimeout, VoiceEngineClient.ttsTimeout);
      expect(VoiceEngineClient.ttsTimeout, const Duration(seconds: 60));
      expect(VoiceEngineClient.sttTimeout, const Duration(seconds: 120));
    });

    test('404는 notFound다. 옛 규격 서버를 가리키는 경우다', () async {
      final adapter = FakeAdapter((_) => jsonBody({}, status: 404));
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.loadVoices(),
        throwsA(
          isA<VoiceEngineException>()
              .having((e) => e.kind, 'kind', VoiceEngineErrorKind.notFound)
              .having((e) => e.statusCode, 'statusCode', 404),
        ),
      );
    });

    test('500은 serverError다', () async {
      final adapter = FakeAdapter(
        (_) => jsonBody({'detail': 'boom'}, status: 500),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.synthesize(text: '연결 확인'),
        throwsA(
          isA<VoiceEngineException>()
              .having((e) => e.kind, 'kind', VoiceEngineErrorKind.serverError)
              .having((e) => e.detail, 'detail', 'boom'),
        ),
      );
    });

    test('400은 invalidRequest다', () async {
      final adapter = FakeAdapter(
        (_) => jsonBody({'detail': 'input is required'}, status: 400),
      );
      final client = VoiceEngineClient(
        settings: testSettings(),
        dio: dioWith(adapter),
      );

      await expectLater(
        client.synthesize(text: '연결 확인'),
        throwsA(
          isA<VoiceEngineException>()
              .having((e) => e.kind, 'kind', VoiceEngineErrorKind.invalidRequest)
              .having((e) => e.statusCode, 'statusCode', 400),
        ),
      );
    });
  });
}
