import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/settings/settings_providers.dart';
import 'package:nownote/features/today/today_memo_repository.dart';
import 'package:nownote/features/today/today_page.dart';
import 'package:nownote/features/today/today_providers.dart';

/// 플러그인 없이 규칙만 확인하기 위한 가짜 녹음 장치.
///
/// `now_core`의 `voice_recording_service_test.dart`와 같은 패턴이다.
class _FakeAudioRecorder implements AudioRecorder {
  _FakeAudioRecorder({this.payload = ''});

  String payload;
  bool _recording = false;
  final List<String> startedPaths = [];

  @override
  bool get isRecording => _recording;

  @override
  Future<void> open() async {}

  @override
  Future<void> start(String filePath) async {
    startedPaths.add(filePath);
    _recording = true;
    if (payload.isNotEmpty) {
      final file = File(filePath);
      file.parent.createSync(recursive: true);
      file.writeAsStringSync(payload);
    }
  }

  @override
  Future<void> stop() async {
    _recording = false;
  }

  @override
  Future<void> close() async {
    _recording = false;
  }
}

/// 플러그인 없이 규칙만 확인하기 위한 가짜 재생 장치.
///
/// `now_core`의 `voice_playback_service_test.dart`와 같은 패턴이다.
class _FakeAudioPlayer implements AudioPlayer {
  bool _playing = false;
  void Function()? _whenFinished;

  @override
  bool get isPlaying => _playing;

  @override
  Future<void> open() async {}

  @override
  Future<void> play(
    Uint8List bytes, {
    VoiceAudioFormat format = VoiceAudioFormat.wav,
    void Function()? whenFinished,
  }) async {
    _whenFinished = whenFinished;
    _playing = true;
  }

  @override
  Future<void> stop() async {
    _playing = false;
  }

  @override
  Future<void> close() async {
    _playing = false;
  }

  void finish() {
    _playing = false;
    final callback = _whenFinished;
    _whenFinished = null;
    callback?.call();
  }
}

/// `messenger_service_test.dart`/`voice_settings_page_test.dart`와 같은
/// `HttpClientAdapter` 목 패턴이다.
typedef _FakeHandler = FutureOr<ResponseBody> Function(RequestOptions options);

class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.handler);

  final _FakeHandler handler;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => handler(options);

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

/// 오늘 날짜와 다른, 이번 달 안에서 안전하게 고를 수 있는 날.
///
/// 달의 앞/뒤 끝(다른 달의 칸이 겹쳐 보이는 자리)을 피해 15/16일 중 오늘이
/// 아닌 쪽을 고른다. 어느 달이든 15/16일이 존재하고, 이 자리는 이전/다음
/// 달 칸과 겹치지 않는다.
DateTime _otherDayThisMonth(DateTime today) {
  final day = today.day == 15 ? 16 : 15;
  return DateTime(today.year, today.month, day);
}

Widget _wrap(NoteDatabase db, {List<Override> extraOverrides = const []}) {
  return ProviderScope(
    overrides: [
      todayNoteDatabaseProvider.overrideWithValue(db),
      ...extraOverrides,
    ],
    child: const MaterialApp(home: Scaffold(body: TodayMemoPage())),
  );
}

/// 서버 받아쓰기(녹음 후 변환) 버튼을 누르고, 그 결과로 생기는 진짜 비동기
/// 작업(실제 파일 I/O·Dio 요청)이 끝나기를 기다린다.
///
/// `pumpAndSettle()`은 프레임이 더 필요 없어지는 순간 바로 끝나 버려서,
/// 화면 갱신 없이 흐르는 실제 파일 I/O 구간(위젯 테스트의 가짜 시계로는
/// 진행시킬 수 없는 진짜 비동기)을 기다려 주지 못한다. `runAsync`로 감싼
/// 뒤 조건이 참이 될 때까지 실제 시간 간격을 두고 짧게 폴링한다.
Future<void> _tapAndWaitUntil(
  WidgetTester tester,
  Finder finder,
  bool Function() condition, {
  int maxTries = 50,
}) async {
  await tester.runAsync(() async {
    await tester.tap(finder);
    for (var i = 0; i < maxTries; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
      await tester.pump();
      if (condition()) break;
    }
  });
}

void main() {
  late NoteDatabase db;

  setUpAll(() async {
    // TableCalendar가 'ko_KR' 로케일로 요일/월 이름을 표시한다. intl은
    // 이 로케일 데이터를 미리 초기화해 두지 않으면 예외를 던진다.
    await initializeDateFormatting('ko_KR');
  });

  setUp(() {
    db = NoteDatabase.forTesting(NativeDatabase.memory());
    // 서버 받아쓰기/읽어주기 기본 경로가 `VoiceSettingsStore`(내부적으로
    // `FlutterSecureStorage`를 쓴다)를 건드린다. 목 초기값을 깔아 두지
    // 않으면 플랫폼 채널이 없어 예외가 난다.
    FlutterSecureStorage.setMockInitialValues({});
  });

  tearDown(() async {
    await db.close();
  });

  testWidgets('진입 시 오늘 날짜가 선택된 상태로 연다', (tester) async {
    await tester.pumpWidget(_wrap(db));
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(TodayMemoPage)),
    );
    final selected = container.read(selectedDateProvider);
    final today = TodayMemoRepository.normalizeDate(DateTime.now());
    expect(selected, today);
  });

  testWidgets('메모가 없는 날은 안내문이 보인다', (tester) async {
    await tester.pumpWidget(_wrap(db));
    await tester.pumpAndSettle();

    expect(find.text('이 날의 메모가 없습니다.'), findsOneWidget);
  });

  testWidgets('달력에서 날짜를 고르면 그 날짜의 메모가 보인다', (tester) async {
    final today = TodayMemoRepository.normalizeDate(DateTime.now());
    final otherDay = _otherDayThisMonth(today);

    final repo = TodayMemoRepository(db);
    await repo.appendParagraph(
      date: today,
      text: '오늘 메모 내용',
      source: todayParagraphSourceText,
    );
    await repo.appendParagraph(
      date: otherDay,
      text: '다른 날 메모 내용',
      source: todayParagraphSourceText,
    );

    await tester.pumpWidget(_wrap(db));
    await tester.pumpAndSettle();

    expect(find.text('오늘 메모 내용'), findsOneWidget);
    expect(find.text('다른 날 메모 내용'), findsNothing);

    await tester.tap(find.text('${otherDay.day}').first);
    await tester.pumpAndSettle();

    expect(find.text('다른 날 메모 내용'), findsOneWidget);
    expect(find.text('오늘 메모 내용'), findsNothing);
  });

  testWidgets('텍스트를 입력하고 보내면 문단이 추가되고 저장된다', (tester) async {
    await tester.pumpWidget(_wrap(db));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '새로 쓴 문단');
    await tester.tap(find.byTooltip('문단으로 넣기'));
    await tester.pumpAndSettle();

    expect(find.text('새로 쓴 문단'), findsOneWidget);

    final repo = TodayMemoRepository(db);
    final today = TodayMemoRepository.normalizeDate(DateTime.now());
    final paragraphs = await repo.paragraphsForDate(today);
    expect(paragraphs, hasLength(1));
    expect(paragraphs.single.text, '새로 쓴 문단');
    expect(paragraphs.single.source, todayParagraphSourceText);
  });

  testWidgets('음성·사진 입력 진입점이 화면에 있다', (tester) async {
    await tester.pumpWidget(_wrap(db));
    await tester.pumpAndSettle();

    expect(find.byTooltip('음성으로 입력'), findsOneWidget);
    expect(find.byTooltip('사진으로 입력'), findsOneWidget);
    expect(find.byTooltip('서버로 받아쓰기 시작'), findsOneWidget);
  });

  testWidgets('서버로 받아쓰기: 녹음 후 변환한 텍스트가 입력창에 들어간다', (tester) async {
    late Directory tempDir;
    // 임시 폴더 생성도 실제 파일 I/O다 — `runAsync`로 감싼다.
    await tester.runAsync(() async {
      tempDir = await Directory.systemTemp.createTemp('nownote_today_voice');
    });
    addTearDown(() {
      try {
        if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
      } on Object {
        // 방금 쓴 파일의 핸들이 아주 잠깐 남아 있을 수 있다 — 임시 폴더
        // 정리 실패는 테스트 결과에 영향이 없으므로 무시한다.
      }
    });

    final recorder = _FakeAudioRecorder(payload: 'a' * 2000);
    final recordingService = VoiceRecordingService(
      recorder: recorder,
      directoryResolver: (_) async => tempDir,
    );

    await tester.pumpWidget(
      _wrap(
        db,
        extraOverrides: [
          todayVoiceRecordingServiceProvider.overrideWithValue(
            recordingService,
          ),
          voiceEngineClientBuilderProvider.overrideWithValue(
            (settings) => VoiceEngineClient(
              settings: VoiceSettings(sttBaseUrl: 'http://test-stt'),
              dio: Dio()
                ..httpClientAdapter = _FakeAdapter(
                  (_) async => _jsonBody({'text': '서버가 돌려준 문장'}),
                ),
            ),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await _tapAndWaitUntil(
      tester,
      find.byTooltip('서버로 받아쓰기 시작'),
      () => find.byTooltip('서버로 받아쓰기 중지(변환)').evaluate().isNotEmpty,
    );
    expect(find.byTooltip('서버로 받아쓰기 중지(변환)'), findsOneWidget);
    expect(recorder.startedPaths, hasLength(1));

    await _tapAndWaitUntil(
      tester,
      find.byTooltip('서버로 받아쓰기 중지(변환)'),
      () =>
          tester
              .widgetList<TextField>(find.byType(TextField))
              .first
              .controller
              ?.text ==
          '서버가 돌려준 문장',
    );

    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.controller!.text, '서버가 돌려준 문장');
    expect(find.byTooltip('서버로 받아쓰기 시작'), findsOneWidget);
  });

  testWidgets('서버로 받아쓰기: 녹음이 짧으면 변환을 생략하고 안내한다', (tester) async {
    late Directory tempDir;
    await tester.runAsync(() async {
      tempDir = await Directory.systemTemp.createTemp(
        'nownote_today_voice_short',
      );
    });
    addTearDown(() {
      try {
        if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
      } on Object {
        // 임시 폴더 정리 실패는 테스트 결과에 영향이 없으므로 무시한다.
      }
    });

    final recorder = _FakeAudioRecorder(payload: 'a');
    final recordingService = VoiceRecordingService(
      recorder: recorder,
      directoryResolver: (_) async => tempDir,
    );

    await tester.pumpWidget(
      _wrap(
        db,
        extraOverrides: [
          todayVoiceRecordingServiceProvider.overrideWithValue(
            recordingService,
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await _tapAndWaitUntil(
      tester,
      find.byTooltip('서버로 받아쓰기 시작'),
      () => find.byTooltip('서버로 받아쓰기 중지(변환)').evaluate().isNotEmpty,
    );
    await _tapAndWaitUntil(
      tester,
      find.byTooltip('서버로 받아쓰기 중지(변환)'),
      () => find.text('녹음이 짧아 변환을 생략했어요.').evaluate().isNotEmpty,
    );

    expect(find.text('녹음이 짧아 변환을 생략했어요.'), findsOneWidget);
    final field = tester.widget<TextField>(find.byType(TextField));
    expect(field.controller!.text, isEmpty);
  });

  testWidgets('문단 읽어주기 버튼을 누르면 재생/정지 아이콘이 바뀐다', (tester) async {
    final repo = TodayMemoRepository(db);
    final today = TodayMemoRepository.normalizeDate(DateTime.now());
    await repo.appendParagraph(
      date: today,
      text: '읽어줄 문단',
      source: todayParagraphSourceText,
    );

    final fakePlayer = _FakeAudioPlayer();
    final playbackService = VoicePlaybackService(
      player: fakePlayer,
      synthesizer:
          ({
            required String text,
            String? voice,
            String? language,
            double? speed,
          }) async => Uint8List.fromList([1, 2, 3, 4]),
    );
    addTearDown(playbackService.dispose);

    await tester.pumpWidget(
      _wrap(
        db,
        extraOverrides: [
          todayVoicePlaybackServiceBuilderProvider.overrideWithValue(
            (engine) => playbackService,
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('문단 읽어주기'), findsOneWidget);

    await tester.tap(find.byTooltip('문단 읽어주기'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('읽어주기 중지'), findsOneWidget);
    expect(playbackService.isPlaying, isTrue);

    await tester.tap(find.byTooltip('읽어주기 중지'));
    await tester.pumpAndSettle();

    expect(find.byTooltip('문단 읽어주기'), findsOneWidget);
    expect(playbackService.isPlaying, isFalse);
  });
}
