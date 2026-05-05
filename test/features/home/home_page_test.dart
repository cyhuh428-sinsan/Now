import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_app/core/database/app_database.dart';
import 'package:now_app/features/home/home_page.dart';
import 'package:now_app/repositories/repository_providers.dart';
import 'package:now_app/services/briefing_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await initializeDateFormatting('ko');
  });

  group('HomePage', () {
    late AppDatabase database;

    setUp(() {
      database = AppDatabase.forTesting(NativeDatabase.memory());
    });

    tearDown(() async {
      await database.close();
    });

    Future<void> pumpPage(WidgetTester tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWith((ref) => database),
            briefingServiceProvider.overrideWith(
              (ref) => BriefingService(database, null),
            ),
          ],
          child: const MaterialApp(home: HomePage()),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('shows empty-state cards when no data exists', (tester) async {
      await pumpPage(tester);

      expect(find.text('오늘 컨디션을 기록해보세요'), findsOneWidget);
      expect(find.text('오늘 할 일이 없습니다 🎉'), findsOneWidget);
      expect(find.text('오늘 일정이 없습니다'), findsOneWidget);
      expect(find.text('오늘 루틴'), findsNothing);
    });

    testWidgets('renders context routines actions events and briefing data',
        (tester) async {
      final now = DateTime.now();
      final startOfToday = DateTime(now.year, now.month, now.day);
      final todayKey =
          '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';

      await database.into(database.dailyContexts).insert(
            DailyContextsCompanion.insert(
              contextId: 'ctx-1',
              userId: 'local_user',
              recordedAt: Value(startOfToday.add(const Duration(hours: 7))),
              memo: '머리가 좀 맑아요',
              sleepHours: const Value(7.5),
              conditionScore: const Value(4),
            ),
          );

      await database.into(database.routineItems).insert(
            RoutineItemsCompanion.insert(
              routineId: 'routine-1',
              userId: 'local_user',
              name: '물 마시기',
              repeat: const Value('daily'),
              alertTime: const Value('08:30'),
              isEnabled: const Value(true),
              sortOrder: const Value(0),
            ),
          );

      await database.into(database.extractedItems).insert(
            ExtractedItemsCompanion.insert(
              itemId: 'item-1',
              meetingId: 'meeting-1',
              itemType: 'action',
              status: const Value('confirmed'),
              content: '제안서 보내기',
              dueTime: const Value('15:00'),
            ),
          );

      await database.into(database.calendarEvents).insert(
            CalendarEventsCompanion.insert(
              calendarEventId: 'event-1',
              userId: 'local_user',
              title: '고객 미팅',
              startTime: startOfToday.add(const Duration(hours: 10)),
              endTime: startOfToday.add(const Duration(hours: 11)),
            ),
          );

      await database.into(database.briefings).insert(
            BriefingsCompanion.insert(
              briefingId: 'briefing-1',
              userId: 'local_user',
              dateKey: todayKey,
              mustDoJson: const Value('["오후 일정 전 자료 재확인"]'),
              tasksJson: const Value('["제안서 초안 점검"]'),
              advice: const Value('집중이 필요한 하루예요'),
              adviceBasis: const Value('일정과 미완료 할 일 기준'),
            ),
          );

      await pumpPage(tester);

      expect(find.text('머리가 좀 맑아요'), findsOneWidget);
      expect(find.text('오늘 루틴'), findsOneWidget);
      expect(find.text('물 마시기'), findsOneWidget);
      expect(find.text('제안서 보내기'), findsOneWidget);
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -300));
      await tester.pumpAndSettle();
      expect(find.text('고객 미팅'), findsOneWidget);
      expect(find.text('오늘의 브리핑'), findsOneWidget);
      expect(find.text('집중이 필요한 하루예요'), findsOneWidget);
    });
  });
}
