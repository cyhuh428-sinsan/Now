import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/settings/mail_settings_status.dart';
import 'package:nownote/features/settings/settings_providers.dart';
import 'package:nownote/features/tree/tree_page.dart';
import 'package:nownote/features/tree/tree_providers.dart';
import 'package:nownote/features/tree/tree_voice_providers.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

/// [NoteEncryptionService]의 기본 채널을 흉내내는 가짜 핸들러.
///
/// 실제 안드로이드 네이티브 없이도 "올바른 키로만 원래 내용이 나온다"를
/// 재현한다. `password` 인자를 그대로 접두어에 실어 두었다가 복호화 시
/// 비교하는 방식으로, 안드로이드의 실제 AES-GCM 로직을 흉내내지는 않지만
/// 화면 쪽 성공/실패 분기를 검증하기에는 충분하다.
class _FakeEncryptionChannel {
  static const _channel = MethodChannel(noteEncryptionChannelName);

  void install() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, (call) async {
          switch (call.method) {
            case noteEncryptMethod:
              final plainText = call.arguments['plainText'] as String;
              final password = call.arguments['password'] as String;
              return '$encryptedNotePrefix$password::$plainText';
            case noteDecryptMethod:
              final content = call.arguments['content'] as String;
              final password = call.arguments['password'] as String;
              final payload = content.substring(encryptedNotePrefix.length);
              final separatorIndex = payload.indexOf('::');
              final storedPassword = payload.substring(0, separatorIndex);
              if (storedPassword != password) {
                throw PlatformException(
                  code: 'NOTE_ENCRYPTION_FAILED',
                  message: '암호 키가 일치하지 않습니다.',
                );
              }
              return payload.substring(separatorIndex + 2);
            default:
              throw MissingPluginException();
          }
        });
  }

  void uninstall() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, null);
  }
}

Future<void> _insertMemo(
  NoteDatabase db, {
  required String id,
  required String title,
  required int level,
  String? parentId,
  String body = '',
  bool encrypted = false,
}) async {
  // 암호화된 메모도 제목(첫 줄)은 평문으로 남는다. 실제로 잠기는 것은 본문뿐이다
  // (now_app의 NoteEncryptionService 사용부: joinNoteContent(title: 그대로,
  // body: 암호문)). 그래서 title은 그대로 두고 body만 암호문 접두사로 채운다.
  final content = joinNoteContent(
    title: title,
    body: encrypted ? '$encryptedNotePrefix-cipher-text-' : body,
  );
  final tags = buildTreeMemoTags(parentId: parentId, level: level);
  await db
      .into(db.memos)
      .insert(
        MemosCompanion.insert(
          memoId: id,
          userId: 'local_user',
          content: content,
          tags: Value(tags),
          source: const Value('note_tree'),
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );
}

/// 이미 암호화된(접두어가 붙은) 본문을 그대로 심는다.
///
/// `_insertMemo`의 `encrypted: true`는 아무 암호문이나 채우지만, 이 테스트
/// 파일의 가짜 채널은 `mykey::비밀 내용` 같은 특정 형식을 요구하므로 별도로 둔다.
Future<void> _insertEncryptedMemo(
  NoteDatabase db, {
  required String id,
  required String title,
  required int level,
  String? parentId,
  required String rawEncryptedBody,
}) async {
  final content = joinNoteContent(
    title: title,
    body: '$encryptedNotePrefix$rawEncryptedBody',
  );
  final tags = buildTreeMemoTags(parentId: parentId, level: level);
  await db
      .into(db.memos)
      .insert(
        MemosCompanion.insert(
          memoId: id,
          userId: 'local_user',
          content: content,
          tags: Value(tags),
          source: const Value('note_tree'),
          createdAt: Value(DateTime.now()),
          updatedAt: Value(DateTime.now()),
        ),
      );
}

void main() {
  late NoteDatabase db;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    // 서버 받아쓰기/읽어주기 기본 경로가 `VoiceSettingsStore`(내부적으로
    // `FlutterSecureStorage`를 쓴다)를 건드린다. 목 초기값을 깔아 두지
    // 않으면 플랫폼 채널이 없어 예외가 난다.
    FlutterSecureStorage.setMockInitialValues({});
    db = NoteDatabase.forTesting(NativeDatabase.memory());
  });

  tearDown(() async {
    await db.close();
  });

  Widget wrap({List<Override> extraOverrides = const []}) {
    return ProviderScope(
      overrides: [
        noteDatabaseProvider.overrideWithValue(db),
        ...extraOverrides,
      ],
      child: const MaterialApp(home: TreeMemoPage()),
    );
  }

  testWidgets('3단계 트리를 들여쓰기로 보여준다', (tester) async {
    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertMemo(
      db,
      id: 'm1',
      title: '메모 1',
      level: 3,
      parentId: 'c1',
      body: '본문',
    );

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    // 아직 펼치지 않았으므로 최상위(주제)만 보인다.
    expect(find.text('주제 1'), findsOneWidget);
    expect(find.text('분류 1'), findsNothing);
    expect(find.text('메모 1'), findsNothing);

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    expect(find.text('분류 1'), findsOneWidget);
    expect(find.text('메모 1'), findsNothing);

    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();
    expect(find.text('메모 1'), findsOneWidget);

    final rootTile = tester.widget<ListTile>(
      find.byKey(const Key('tree-node-t1')),
    );
    final categoryTile = tester.widget<ListTile>(
      find.byKey(const Key('tree-node-c1')),
    );
    final memoTile = tester.widget<ListTile>(
      find.byKey(const Key('tree-node-m1')),
    );

    final rootLeft = (rootTile.contentPadding as EdgeInsets).left;
    final categoryLeft = (categoryTile.contentPadding as EdgeInsets).left;
    final memoLeft = (memoTile.contentPadding as EdgeInsets).left;

    expect(categoryLeft, greaterThan(rootLeft));
    expect(memoLeft, greaterThan(categoryLeft));

    expect(find.text('주제'), findsOneWidget);
    expect(find.text('분류'), findsOneWidget);
    expect(find.text('메모'), findsOneWidget);
  });

  testWidgets('암호화된 메모는 잠긴 표시로만 보인다', (tester) async {
    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertMemo(
      db,
      id: 'm1',
      title: '비밀 메모',
      level: 3,
      parentId: 'c1',
      encrypted: true,
    );

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();

    final memoTileFinder = find.byKey(const Key('tree-node-m1'));
    expect(memoTileFinder, findsOneWidget);
    expect(
      find.descendant(of: memoTileFinder, matching: find.byIcon(Icons.lock)),
      findsOneWidget,
    );

    await tester.tap(memoTileFinder);
    await tester.pumpAndSettle();
    // 잠긴 상태에서는 안내 문구와 "복호화" 버튼만 보이고 실제 내용은 보이지 않는다.
    expect(find.text('암호화된 메모입니다. 복호화 버튼을 눌러 키를 입력하세요.'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, '복호화'), findsOneWidget);
  });

  testWidgets('올바른 키로 복호화하면 내용이 보인다', (tester) async {
    final fake = _FakeEncryptionChannel()..install();
    addTearDown(fake.uninstall);

    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    // 이 테스트의 가짜 채널은 `mykey::비밀 내용` 형식을 쓴다.
    await _insertEncryptedMemo(
      db,
      id: 'm1',
      title: '비밀 메모',
      level: 3,
      parentId: 'c1',
      rawEncryptedBody: 'mykey::비밀 내용',
    );

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-m1')));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, '복호화'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('tree-encryption-key-field')),
      'mykey',
    );
    await tester.tap(find.widgetWithText(FilledButton, '확인'));
    await tester.pumpAndSettle();

    expect(find.text('비밀 내용'), findsOneWidget);
  });

  testWidgets('틀린 키로 복호화하면 실패 안내가 뜬다', (tester) async {
    final fake = _FakeEncryptionChannel()..install();
    addTearDown(fake.uninstall);

    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertEncryptedMemo(
      db,
      id: 'm1',
      title: '비밀 메모',
      level: 3,
      parentId: 'c1',
      rawEncryptedBody: 'mykey::비밀 내용',
    );

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-m1')));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, '복호화'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('tree-encryption-key-field')),
      '틀린키',
    );
    await tester.tap(find.widgetWithText(FilledButton, '확인'));
    await tester.pumpAndSettle();

    expect(find.text('복호화 실패: 암호 키를 확인하세요.'), findsOneWidget);
  });

  testWidgets('암호화 버튼을 누르면 암호화해서 저장한다', (tester) async {
    final fake = _FakeEncryptionChannel()..install();
    addTearDown(fake.uninstall);

    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertMemo(
      db,
      id: 'm1',
      title: '메모 1',
      level: 3,
      parentId: 'c1',
      body: '평문 내용',
    );

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-m1')));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(OutlinedButton, '암호화'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('tree-encryption-key-field')),
      'mykey',
    );
    await tester.tap(find.widgetWithText(FilledButton, '확인'));
    await tester.pumpAndSettle();

    final nodes = await TreeMemoPageTestAccess(db).loadNodes();
    final saved = nodes.singleWhere((n) => n.id == 'm1');
    expect(saved.isEncrypted, isTrue);
  });

  testWidgets('새 주제를 텍스트로 추가할 수 있다', (tester) async {
    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('tree-input-field')), '새 주제');
    await tester.tap(find.byKey(const Key('tree-input-submit')));
    await tester.pumpAndSettle();

    expect(find.text('새 주제'), findsOneWidget);

    final nodes = await TreeMemoPageTestAccess(db).loadNodes();
    expect(nodes, hasLength(1));
    expect(nodes.single.level, 1);
  });

  testWidgets('길게 눌러 삭제하면 삭제 대기로 옮기고 목록에서 사라진다', (tester) async {
    await _insertMemo(db, id: 't1', title: '지울 주제', level: 1);

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    expect(find.text('지울 주제'), findsOneWidget);

    await tester.longPress(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();

    await tester.tap(find.text('삭제'));
    await tester.pumpAndSettle();

    // 확인 다이얼로그의 "삭제" 버튼(FilledButton)을 누른다.
    await tester.tap(find.widgetWithText(FilledButton, '삭제'));
    await tester.pumpAndSettle();

    expect(find.text('지울 주제'), findsNothing);
  });

  testWidgets('서버로 받아쓰기: 녹음 후 변환한 텍스트가 입력창에 들어간다', (tester) async {
    late Directory tempDir;
    // 임시 폴더 생성도 실제 파일 I/O다 — `runAsync`로 감싼다.
    await tester.runAsync(() async {
      tempDir = await Directory.systemTemp.createTemp('nownote_tree_voice');
    });
    addTearDown(() {
      try {
        if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
      } on Object {
        // 임시 폴더 정리 실패는 테스트 결과에 영향이 없으므로 무시한다.
      }
    });

    final recorder = _FakeAudioRecorder(payload: 'a' * 2000);
    final recordingService = VoiceRecordingService(
      recorder: recorder,
      directoryResolver: (_) async => tempDir,
    );

    await tester.pumpWidget(
      wrap(
        extraOverrides: [
          treeVoiceRecordingServiceProvider.overrideWithValue(recordingService),
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
      find.byKey(const Key('tree-input-server-mic')),
      () => find.byTooltip('서버로 받아쓰기 중지(변환)').evaluate().isNotEmpty,
    );
    expect(recorder.startedPaths, hasLength(1));

    await _tapAndWaitUntil(
      tester,
      find.byKey(const Key('tree-input-server-mic')),
      () =>
          tester
              .widgetList<TextField>(find.byKey(const Key('tree-input-field')))
              .first
              .controller
              ?.text ==
          '서버가 돌려준 문장',
    );

    final field = tester.widget<TextField>(
      find.byKey(const Key('tree-input-field')),
    );
    expect(field.controller!.text, '서버가 돌려준 문장');
  });

  testWidgets('메모를 열면 읽어주기 버튼으로 재생/정지를 전환할 수 있다', (tester) async {
    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertMemo(
      db,
      id: 'm1',
      title: '메모 1',
      level: 3,
      parentId: 'c1',
      body: '읽을 내용',
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
      wrap(
        extraOverrides: [
          treeVoicePlaybackServiceBuilderProvider.overrideWithValue(
            (engine) => playbackService,
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-m1')));
    await tester.pumpAndSettle();

    final playButton = find.byKey(const Key('tree-memo-playback-m1'));
    expect(playButton, findsOneWidget);
    expect(find.byTooltip('메모 읽어주기'), findsOneWidget);

    await tester.tap(playButton);
    await tester.pumpAndSettle();

    expect(find.byTooltip('읽어주기 중지'), findsOneWidget);
    expect(playbackService.isPlaying, isTrue);

    await tester.tap(playButton);
    await tester.pumpAndSettle();

    expect(find.byTooltip('메모 읽어주기'), findsOneWidget);
    expect(playbackService.isPlaying, isFalse);
  });

  testWidgets('암호화된 메모는 잠긴 상태에서 읽어주기 버튼이 없고, 복호화 후에만 나타난다', (tester) async {
    final fake = _FakeEncryptionChannel()..install();
    addTearDown(fake.uninstall);

    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertEncryptedMemo(
      db,
      id: 'm1',
      title: '비밀 메모',
      level: 3,
      parentId: 'c1',
      rawEncryptedBody: 'mykey::비밀 내용',
    );

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-m1')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('tree-memo-playback-m1')), findsNothing);

    await tester.tap(find.widgetWithText(FilledButton, '복호화'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('tree-encryption-key-field')),
      'mykey',
    );
    await tester.tap(find.widgetWithText(FilledButton, '확인'));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('tree-memo-playback-m1')), findsOneWidget);
  });
  testWidgets('메모 편집 메뉴는 2.3.7 액션 그룹을 보여준다', (tester) async {
    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertMemo(
      db,
      id: 'm1',
      title: '메모 1',
      level: 3,
      parentId: 'c1',
      body: '찾을 본문',
    );

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-m1')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-editor-menu-button')));
    await tester.pumpAndSettle();

    for (final group in ['편집', '찾기', '삽입', '형식', '메모', '보안', '출력']) {
      expect(find.text(group), findsWidgets);
    }
    expect(find.text('본문 찾기'), findsOneWidget);
    expect(find.text('바꾸기'), findsOneWidget);
    expect(find.text('메일 보내기'), findsOneWidget);
  });

  testWidgets('메일 보내기는 서버 메일 상태가 꺼져 있으면 비활성화된다', (tester) async {
    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertMemo(db, id: 'm1', title: '메모 1', level: 3, parentId: 'c1');

    await tester.pumpWidget(wrap());
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-m1')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-editor-menu-button')));
    await tester.pumpAndSettle();

    final mailTile = tester.widget<ListTile>(
      find.descendant(
        of: find.byKey(const Key('tree-editor-action-send-mail')),
        matching: find.byType(ListTile),
      ),
    );
    expect(mailTile.enabled, isFalse);
  });

  testWidgets('메일 보내기는 서버 메일 상태가 켜져 있으면 활성화된다', (tester) async {
    await _insertMemo(db, id: 't1', title: '주제 1', level: 1);
    await _insertMemo(db, id: 'c1', title: '분류 1', level: 2, parentId: 't1');
    await _insertMemo(db, id: 'm1', title: '메모 1', level: 3, parentId: 'c1');

    await tester.pumpWidget(
      wrap(
        extraOverrides: [
          mailSettingsStatusProvider.overrideWith(
            (ref) async => const MailSettingsStatus(enabled: true),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-node-t1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-c1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('tree-node-m1')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('tree-editor-menu-button')));
    await tester.pumpAndSettle();

    final mailTile = tester.widget<ListTile>(
      find.descendant(
        of: find.byKey(const Key('tree-editor-action-send-mail')),
        matching: find.byType(ListTile),
      ),
    );
    expect(mailTile.enabled, isTrue);
  });
}

/// 테스트에서 저장 결과를 직접 확인하기 위한 얕은 래퍼.
class TreeMemoPageTestAccess {
  TreeMemoPageTestAccess(this._db);
  final NoteDatabase _db;

  Future<List<TreeMemoNode>> loadNodes() async {
    final rows = await (_db.select(
      _db.memos,
    )..where((m) => m.source.equals('note_tree'))).get();
    return rows.map(TreeMemoNode.fromMemo).toList();
  }
}
