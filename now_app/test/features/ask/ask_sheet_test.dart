import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:now/features/ask/ask_sheet.dart';
import 'package:now/llm/providers/llm_providers.dart';
import 'package:now/repositories/repository_providers.dart';

/// 실제 네트워크를 타지 않는 가짜 LlmRepository.
///
/// [answers]에 넣어 둔 순서대로 답을 돌려준다. 보낸 프롬프트는 [prompts]에
/// 쌓여서, 테스트가 맥락·대화가 실렸는지 들여다볼 수 있다.
class _FakeLlmRepository implements LlmRepository {
  _FakeLlmRepository(this.answers);

  final List<String> answers;
  final List<String> prompts = [];
  int _index = 0;

  @override
  LlmConfig get config =>
      const LlmConfig(provider: LlmProvider.gemini, apiKey: 'test-key');

  @override
  Future<String> chat(String prompt) async {
    prompts.add(prompt);
    if (_index >= answers.length) {
      throw StateError('예상보다 많은 질문이 왔습니다.');
    }
    return answers[_index++];
  }

  @override
  Future<List<LlmExtractedItem>> extractItems(
    List<String> segments, {
    String recordType = 'meeting',
    String participantName = '',
    bool includeSpeakerSeparation = false,
    bool includeVoiceEmotion = false,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) {
    throw UnimplementedError();
  }

  @override
  bool get supportsImageInput => false;

  @override
  Future<bool> testConnection() async => true;
}

/// 늘 [AskErrorKind.connectionFailed]로 실패하는 가짜 LlmRepository.
class _FailingLlmRepository implements LlmRepository {
  @override
  LlmConfig get config =>
      const LlmConfig(provider: LlmProvider.gemini, apiKey: 'test-key');

  @override
  Future<String> chat(String prompt) async {
    throw Exception('강제로 실패시킨다');
  }

  @override
  Future<List<LlmExtractedItem>> extractItems(
    List<String> segments, {
    String recordType = 'meeting',
    String participantName = '',
    bool includeSpeakerSeparation = false,
    bool includeVoiceEmotion = false,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<String> chatWithImage(String prompt, LlmImageInput image) {
    throw UnimplementedError();
  }

  @override
  bool get supportsImageInput => false;

  @override
  Future<bool> testConnection() async => true;
}

void main() {
  late NoteDatabase noteDatabase;

  setUp(() {
    noteDatabase = NoteDatabase.forTesting(NativeDatabase.memory());
  });

  tearDown(() async {
    await noteDatabase.close();
  });

  Future<void> pumpSheet(
    WidgetTester tester, {
    required LlmRepository llmRepository,
    String? noteContent,
    required ValueChanged<String> onInsertAnswer,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          llmRepositoryProvider.overrideWith((ref) async => llmRepository),
          noteDatabaseProvider.overrideWith((ref) => noteDatabase),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: AskSheet(
              noteContent: noteContent,
              onInsertAnswer: onInsertAnswer,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('AskSheet — 묻기', () {
    testWidgets('질문을 보내면 답이 대화 목록에 보인다', (tester) async {
      final fakeLlm = _FakeLlmRepository(['소금 대신 간장을 써도 됩니다.']);
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        onInsertAnswer: (_) {},
      );

      await tester.enterText(
        find.byType(TextField).first,
        '소금 대신 뭘 쓸 수 있어?',
      );
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      expect(find.text('소금 대신 뭘 쓸 수 있어?'), findsOneWidget);
      expect(find.text('소금 대신 간장을 써도 됩니다.'), findsOneWidget);
    });

    testWidgets('맥락 토글을 켜면 프롬프트에 메모 내용이 실린다', (tester) async {
      final fakeLlm = _FakeLlmRepository(['답']);
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        noteContent: '제목입니다\n오늘은 회의를 했다.',
        onInsertAnswer: (_) {},
      );

      // 기본값은 켬이다.
      await tester.enterText(find.byType(TextField).first, '질문');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      expect(fakeLlm.prompts.single, contains('오늘은 회의를 했다.'));
    });

    testWidgets('맥락 토글을 끄면 프롬프트에 메모 내용이 실리지 않는다', (tester) async {
      final fakeLlm = _FakeLlmRepository(['답']);
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        noteContent: '제목입니다\n오늘은 회의를 했다.',
        onInsertAnswer: (_) {},
      );

      await tester.tap(find.text('이 메모 같이 보내기'));
      await tester.pump();

      await tester.enterText(find.byType(TextField).first, '질문');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      expect(fakeLlm.prompts.single, isNot(contains('오늘은 회의를 했다.')));
    });

    testWidgets('맥락 파라미터가 없으면 토글 자체가 보이지 않는다', (tester) async {
      final fakeLlm = _FakeLlmRepository(['답']);
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        onInsertAnswer: (_) {},
      );

      expect(find.text('이 메모 같이 보내기'), findsNothing);
    });

    testWidgets('이어지는 질문에는 앞선 대화가 함께 간다', (tester) async {
      final fakeLlm = _FakeLlmRepository(['첫 번째 답', '두 번째 답']);
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        onInsertAnswer: (_) {},
      );

      await tester.enterText(find.byType(TextField).first, '첫 질문');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '두 번째 질문');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      expect(fakeLlm.prompts, hasLength(2));
      expect(fakeLlm.prompts[1], contains('첫 질문'));
      expect(fakeLlm.prompts[1], contains('첫 번째 답'));
      expect(find.text('첫 번째 답'), findsOneWidget);
      expect(find.text('두 번째 답'), findsOneWidget);
    });

    testWidgets('메모에 넣기를 누르면 콜백이 완성된 답 블록으로 불린다', (tester) async {
      final fakeLlm = _FakeLlmRepository(['이렇게 하세요.']);
      String? received;
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        onInsertAnswer: (block) => received = block,
      );

      await tester.enterText(find.byType(TextField).first, '어떻게 해?');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      await tester.tap(find.text('메모에 넣기'));
      await tester.pumpAndSettle();

      expect(received, isNotNull);
      expect(received, contains('이렇게 하세요.'));
      expect(received, contains('어떻게 해?'));
      expect(received, contains('묻기'));
    });

    testWidgets('실패하면 오류 문구를 보여주고 대화 목록은 그대로 둔다', (tester) async {
      await pumpSheet(
        tester,
        llmRepository: _FailingLlmRepository(),
        onInsertAnswer: (_) {},
      );

      await tester.enterText(find.byType(TextField).first, '질문');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      // 실패한 질문은 대화에 남지 않는다 — 여전히 빈 대화 안내가 보인다.
      expect(
        find.textContaining('메모를 쓰다 궁금한 것이 생기면 물어보세요.'),
        findsOneWidget,
      );
      expect(
        find.textContaining('답을 해석할 수 없습니다. 잠시 후 다시 시도해 주세요.'),
        findsOneWidget,
      );
    });

    testWidgets('잠긴 메모를 맥락으로 넘기면 안내 문구를 보여준다', (tester) async {
      final fakeLlm = _FakeLlmRepository(['답']);
      final locked = joinNoteContent(
        title: '제목',
        body: '$encryptedNotePrefix암호문',
      );
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        noteContent: locked,
        onInsertAnswer: (_) {},
      );

      await tester.enterText(find.byType(TextField).first, '질문');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pumpAndSettle();

      expect(find.textContaining('잠긴 메모는 그대로 보낼 수 없습니다'), findsOneWidget);
    });
  });

  group('AskSheet — 내 메모 찾기', () {
    testWidgets('찾기 탭으로 전환하면 검색 입력창이 보인다', (tester) async {
      final fakeLlm = _FakeLlmRepository(['답']);
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        onInsertAnswer: (_) {},
      );

      expect(find.text('내 메모에서 찾기'), findsNothing);

      await tester.tap(find.text('내 메모 찾기'));
      await tester.pumpAndSettle();

      expect(find.text('내 메모에서 찾기'), findsOneWidget);
    });

    testWidgets('메모 본문을 검색하면 결과 목록에 보인다', (tester) async {
      await noteDatabase.into(noteDatabase.memos).insert(
            MemosCompanion.insert(
              memoId: 'm1',
              userId: 'local_user',
              content: joinNoteContent(title: '장보기', body: '두부와 계란을 산다'),
            ),
          );

      final fakeLlm = _FakeLlmRepository(['답']);
      await pumpSheet(
        tester,
        llmRepository: fakeLlm,
        onInsertAnswer: (_) {},
      );

      await tester.tap(find.text('내 메모 찾기'));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '두부');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();

      expect(find.text('장보기'), findsOneWidget);
      expect(find.textContaining('두부와 계란을 산다'), findsOneWidget);
    });
  });
}
