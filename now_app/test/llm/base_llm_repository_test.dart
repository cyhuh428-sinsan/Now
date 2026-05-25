import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/llm/base_llm_repository.dart';
import 'package:now_note/llm/interfaces/llm_repository.dart';
import 'package:now_note/llm/models/llm_config.dart';

class _FakeBaseLlmRepository extends BaseLlmRepository {
  @override
  final LlmConfig config;

  _FakeBaseLlmRepository({LlmConfig? config})
      : config = config ??
            const LlmConfig(provider: LlmProvider.groq, apiKey: 'test-key');

  @override
  Future<String> chat(String prompt) async => prompt;

  @override
  Future<List<LlmExtractedItem>> extractItems(
    List<String> segments, {
    String recordType = 'meeting',
    String participantName = '',
    bool includeSpeakerSeparation = false,
    bool includeVoiceEmotion = false,
  }) async {
    return [];
  }

  @override
  Future<bool> testConnection() async => true;
}

String _fmt(DateTime value) {
  final month = value.month.toString().padLeft(2, '0');
  final day = value.day.toString().padLeft(2, '0');
  return '${value.year}-$month-$day';
}

void main() {
  group('BaseLlmRepository', () {
    late _FakeBaseLlmRepository repository;

    setUp(() {
      repository = _FakeBaseLlmRepository();
    });

    test('buildPrompt adds the correct interview label and rules', () {
      final prompt = repository.buildPrompt(
        ['다음 주 월요일에 후속 미팅을 잡아주세요.'],
        recordType: 'interview',
        participantName: '홍길동',
      );

      expect(prompt, contains('면담 (홍길동) 기록'));
      expect(prompt, contains('면담에서 도출된 후속 조치'));
      expect(prompt, contains('반드시 아래 JSON 형식으로만 응답하세요'));
    });

    test('parseResponse extracts items and normalizes a relative due date', () {
      final tomorrow = _fmt(DateTime.now().add(const Duration(days: 1)));

      final items = repository.parseResponse('''
분석 결과입니다.
{
  "items": [
    {
      "itemType": "action",
      "content": "제안서 보내기",
      "confidence": 0.91,
      "ownerLabel": "신산",
      "dueDate": "내일",
      "dueTime": "09:00"
    }
  ]
}
''');

      expect(items, hasLength(1));
      expect(items.first.itemType, 'action');
      expect(items.first.content, '제안서 보내기');
      expect(items.first.ownerLabel, '신산');
      expect(items.first.dueDate, tomorrow);
      expect(items.first.dueTime, '09:00');
    });

    test('parseResponse drops invalid dates instead of keeping broken values', () {
      final items = repository.parseResponse('''
{
  "items": [
    {
      "itemType": "decision",
      "content": "출장 일정 확정",
      "confidence": 0.7,
      "dueDate": "2026-02-30",
      "dueTime": null
    }
  ]
}
''');

      expect(items, hasLength(1));
      expect(items.first.dueDate, isNull);
    });

    test('parseResponse returns an empty list when JSON is missing', () {
      final items = repository.parseResponse('LLM이 일반 텍스트만 반환했습니다.');
      expect(items, isEmpty);
    });
  });
}
