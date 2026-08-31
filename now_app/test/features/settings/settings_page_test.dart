import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now/features/settings/settings_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SettingsPage', () {
    Future<void> pumpPage(
      WidgetTester tester, {
      required Map<String, Object> preferences,
    }) async {
      SharedPreferences.setMockInitialValues(preferences);

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(home: SettingsPage()),
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> scrollToText(WidgetTester tester, String text) async {
      await tester.scrollUntilVisible(
        find.text(text),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
    }

    testWidgets('shows section summaries using current settings', (
      tester,
    ) async {
      await pumpPage(
        tester,
        preferences: {
          'briefing_notification_enabled': true,
          'briefing_notification_hour': 7,
          'briefing_notification_minute': 30,
        },
      );

      expect(find.text('설정'), findsOneWidget);
      expect(find.text('브리핑 알림'), findsOneWidget);
      expect(find.text('매일 07:30 알림'), findsOneWidget);
      expect(find.text('음성 입력'), findsWidgets);
      expect(find.text('기기 내 STT · LLM 연동'), findsOneWidget);
      await scrollToText(tester, '반복 알림 설정');
      expect(find.text('루틴 관리'), findsWidgets);
      await scrollToText(tester, '날씨 설정');
      expect(find.text('날씨 설정'), findsOneWidget);
    });

    testWidgets('shows disabled notification summary and app info', (
      tester,
    ) async {
      await pumpPage(
        tester,
        preferences: {
          'briefing_notification_enabled': false,
          'briefing_notification_hour': 9,
          'briefing_notification_minute': 0,
        },
      );

      expect(find.text('알림 꺼짐'), findsOneWidget);
      await scrollToText(tester, '기능별 사용 설정');
      expect(find.text('기능별 사용 설정'), findsOneWidget);
      expect(find.text('화자 분리'), findsOneWidget);
      await scrollToText(tester, '앱 정보');
      expect(find.text('앱 정보'), findsOneWidget);
      expect(find.text('2.3.6 (23006)'), findsOneWidget);
    });
  });
}
