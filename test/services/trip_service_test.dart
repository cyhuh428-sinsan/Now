import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_app/core/database/app_database.dart';
import 'package:now_app/repositories/local/trip_repository.dart';
import 'package:now_app/services/trip_service.dart';

class _FakeTripLlm {
  _FakeTripLlm(this.reply);

  final String reply;
  String? lastPrompt;

  Future<String> chat(String prompt) async {
    lastPrompt = prompt;
    return reply;
  }
}

void main() {
  group('TripService', () {
    late AppDatabase database;
    late TripRepository repository;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
      repository = TripRepository(database);
    });

    tearDown(() async {
      await database.close();
    });

    test('suggestItinerary parses JSON and uses correct nights/days text', () async {
      final llm = _FakeTripLlm('''
{
  "dayPlans": [
    {"day": 1, "date": "4/1", "plans": ["오전: 도착", "오후: 체크인"]}
  ],
  "checklist": [
    {"category": "짐", "items": ["여권", "충전기"]}
  ]
}
''');
      final service = TripService(repository, llm);

      final result = await service.suggestItinerary(
        destination: '도쿄',
        startDate: DateTime(2026, 4, 1),
        endDate: DateTime(2026, 4, 3),
      );

      expect(llm.lastPrompt, contains('여행지: 도쿄'));
      expect(llm.lastPrompt, contains('기간: 2박 3일 (4/1 ~ 4/3)'));
      expect((result['dayPlans'] as List), hasLength(1));
      expect((result['checklist'] as List), hasLength(1));
    });

    test('suggestItinerary returns empty map when llm is null', () async {
      final service = TripService(repository, null);

      final result = await service.suggestItinerary(
        destination: '부산',
        startDate: DateTime(2026, 5, 10),
        endDate: DateTime(2026, 5, 11),
      );

      expect(result, isEmpty);
    });

    test('suggestItinerary returns empty map when llm response is not valid JSON', () async {
      final llm = _FakeTripLlm('추천 일정은 아래와 같습니다.');
      final service = TripService(repository, llm);

      final result = await service.suggestItinerary(
        destination: '제주',
        startDate: DateTime(2026, 6, 1),
        endDate: DateTime(2026, 6, 2),
      );

      expect(result, isEmpty);
    });
  });
}
