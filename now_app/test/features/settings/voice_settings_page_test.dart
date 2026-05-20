import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/features/settings/voice_settings_page.dart';

void main() {
  group('VoiceSettingsPage', () {
    testWidgets('shows available and upcoming STT options', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(home: VoiceSettingsPage()),
        ),
      );

      expect(find.text('음성 인식 방식'), findsOneWidget);
      expect(find.text('기기 내 STT'), findsOneWidget);
      expect(find.text('OpenAI Whisper API'), findsOneWidget);
      expect(find.text('Google STT API'), findsOneWidget);
      expect(find.text('준비 중'), findsNWidgets(2));
      expect(find.textContaining('높은 정확도 · 유료'), findsOneWidget);
      expect(find.textContaining('실시간 스트리밍 · 유료'), findsOneWidget);
    });

    testWidgets('keeps default tier when tapping an unavailable option', (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: VoiceSettingsPage()),
        ),
      );

      expect(container.read(sttTierProvider), 'tier1');

      final whisperTile = find.ancestor(
        of: find.text('OpenAI Whisper API'),
        matching: find.byType(InkWell),
      );
      await tester.tap(whisperTile);
      await tester.pump();

      expect(container.read(sttTierProvider), 'tier1');
    });
  });
}
