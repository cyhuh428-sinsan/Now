import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/features/settings/settings_page.dart';
import 'package:now_note/llm/models/llm_config.dart';
import 'package:now_note/llm/providers/llm_providers.dart';
import 'package:now_note/llm/services/llm_settings_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeLlmSettingsService extends LlmSettingsService {
  final LlmConfig config;

  _FakeLlmSettingsService(this.config);

  @override
  Future<LlmConfig> loadConfig() async => config;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('SettingsPage', () {
    Future<void> pumpPage(
      WidgetTester tester, {
      required Map<String, Object> preferences,
      required LlmConfig llmConfig,
    }) async {
      SharedPreferences.setMockInitialValues(preferences);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            llmSettingsServiceProvider.overrideWith(
              (ref) => _FakeLlmSettingsService(llmConfig),
            ),
          ],
          child: const MaterialApp(home: SettingsPage()),
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
        llmConfig: const LlmConfig(
          provider: LlmProvider.ollama,
          ollamaUrl: 'http://localhost:11434',
          ollamaModel: 'llama3.1',
        ),
      );

      expect(find.text('설정'), findsOneWidget);
      expect(find.text('브리핑 알림'), findsOneWidget);
      expect(find.text('매일 07:30 알림'), findsOneWidget);
      expect(find.text('음성 입력'), findsWidgets);
      expect(find.text('LLM 연동'), findsWidgets);
      expect(find.text('로컬 Ollama'), findsOneWidget);
      await scrollToText(tester, '루틴 관리');
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
        llmConfig: const LlmConfig(
          provider: LlmProvider.groq,
          apiKey: 'test-key',
        ),
      );

      expect(find.text('알림 꺼짐'), findsOneWidget);
      expect(find.text('Groq'), findsOneWidget);
      await scrollToText(tester, '기능별 사용 설정');
      expect(find.text('기능별 사용 설정'), findsOneWidget);
      expect(find.text('화자 분리'), findsOneWidget);
      await scrollToText(tester, '앱 정보');
      expect(find.text('앱 정보'), findsOneWidget);
      expect(find.text('2.3.5 (23005)'), findsOneWidget);
    });
  });
}
