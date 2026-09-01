import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:nownote/features/settings/settings_page.dart';
import 'package:nownote/providers/theme_mode_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// SettingsPage가 `context.push`를 쓰므로 go_router가 있는 트리에서 띄운다.
Widget _wrapWithRouter() {
  final router = GoRouter(
    initialLocation: '/settings',
    routes: [
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsPage(),
      ),
      GoRoute(
        path: '/settings/server',
        builder: (context, state) => const Scaffold(body: Text('서버 설정 화면')),
      ),
      GoRoute(
        path: '/settings/voice',
        builder: (context, state) => const Scaffold(body: Text('음성 설정 화면')),
      ),
      GoRoute(
        path: '/settings/help',
        builder: (context, state) => const Scaffold(body: Text('도움말 화면')),
      ),
    ],
  );
  return ProviderScope(child: MaterialApp.router(routerConfig: router));
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
  });

  testWidgets('허브 화면에 테마 선택과 4개 목록 타일이 보인다', (tester) async {
    await tester.pumpWidget(_wrapWithRouter());
    await tester.pumpAndSettle();

    expect(find.text('시스템'), findsOneWidget);
    expect(find.text('라이트'), findsOneWidget);
    expect(find.text('다크'), findsOneWidget);

    expect(find.text('서버 설정'), findsOneWidget);
    expect(find.text('음성 설정'), findsOneWidget);
    expect(find.text('LLM Key 설정'), findsOneWidget);
    expect(find.text('도움말'), findsOneWidget);
  });

  testWidgets('테마를 다크로 바꾸면 themeModeProvider 값이 바뀐다', (tester) async {
    await tester.pumpWidget(_wrapWithRouter());
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(SettingsPage)),
    );
    expect(container.read(themeModeProvider), ThemeMode.system);

    await tester.tap(find.text('다크'));
    await tester.pumpAndSettle();

    expect(container.read(themeModeProvider), ThemeMode.dark);
  });

  testWidgets('서버 설정 타일을 누르면 서버 설정 화면으로 이동한다', (tester) async {
    await tester.pumpWidget(_wrapWithRouter());
    await tester.pumpAndSettle();

    await tester.tap(find.text('서버 설정'));
    await tester.pumpAndSettle();

    expect(find.text('서버 설정 화면'), findsOneWidget);
  });

  testWidgets('LLM Key 설정 타일을 누르면 LLM 설정이 포함된 음성 설정 화면으로 이동한다', (tester) async {
    await tester.pumpWidget(_wrapWithRouter());
    await tester.pumpAndSettle();

    await tester.tap(find.text('LLM Key 설정'));
    await tester.pumpAndSettle();

    expect(find.text('음성 설정 화면'), findsOneWidget);
  });
  testWidgets('음성 설정 타일을 누르면 음성 설정 화면으로 이동한다', (tester) async {
    await tester.pumpWidget(_wrapWithRouter());
    await tester.pumpAndSettle();

    await tester.tap(find.text('음성 설정'));
    await tester.pumpAndSettle();

    expect(find.text('음성 설정 화면'), findsOneWidget);
  });

  testWidgets('도움말 타일을 누르면 도움말 화면으로 이동한다', (tester) async {
    await tester.pumpWidget(_wrapWithRouter());
    await tester.pumpAndSettle();

    await tester.tap(find.text('도움말'));
    await tester.pumpAndSettle();

    expect(find.text('도움말 화면'), findsOneWidget);
  });

  test('테마를 바꾸고 저장하면 새 ProviderContainer(재시작)에서도 유지된다', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    await container.read(themeModeProvider.notifier).ready;

    await container
        .read(themeModeProvider.notifier)
        .setThemeMode(ThemeMode.dark);
    expect(container.read(themeModeProvider), ThemeMode.dark);

    final restartedContainer = ProviderContainer();
    addTearDown(restartedContainer.dispose);
    await restartedContainer.read(themeModeProvider.notifier).ready;

    expect(restartedContainer.read(themeModeProvider), ThemeMode.dark);
  });
}
