import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/core/database/app_database.dart';
import 'package:now_note/features/travel/travel_page.dart';
import 'package:now_note/repositories/local/trip_repository.dart';
import 'package:now_note/repositories/repository_providers.dart';

void main() {
  group('TravelPage', () {
    late AppDatabase database;
    late TripRepository repository;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
      repository = TripRepository(database);
    });

    tearDown(() async {
      await database.close();
    });

    Future<void> pumpPage(WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWith((ref) => database),
          ],
          child: const MaterialApp(home: TravelPage()),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('shows empty state when there are no trips', (tester) async {
      await pumpPage(tester);

      expect(find.text('계획 중인 여행이 없어요'), findsOneWidget);
      expect(find.text('우측 상단 + 버튼으로 여행을 추가해보세요'), findsOneWidget);
    });

    testWidgets('groups trips into active planned and completed sections', (tester) async {
      final activeId = await repository.create(
        name: '도쿄 출장',
        destination: '도쿄',
        startDate: DateTime(2026, 4, 1),
        endDate: DateTime(2026, 4, 3),
      );
      await repository.updateStatus(activeId, 'on_trip');

      await repository.create(
        name: '부산 여행',
        destination: '부산',
        startDate: DateTime(2026, 5, 10),
        endDate: DateTime(2026, 5, 12),
      );

      final doneId = await repository.create(
        name: '제주 가족여행',
        destination: '제주',
        startDate: DateTime(2026, 3, 20),
        endDate: DateTime(2026, 3, 22),
      );
      await repository.updateStatus(doneId, 'completed');

      await pumpPage(tester);

      expect(find.text('✈️ 여행 중'), findsOneWidget);
      expect(find.text('📋 예정'), findsOneWidget);
      expect(find.text('✅ 완료'), findsOneWidget);

      expect(find.text('도쿄 출장'), findsOneWidget);
      expect(find.text('부산 여행'), findsOneWidget);
      expect(find.text('제주 가족여행'), findsOneWidget);
    });
  });
}
