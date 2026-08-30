import 'package:go_router/go_router.dart';

import '../features/messenger/messenger_page.dart';
import '../features/settings/help_page.dart';
import '../features/settings/server_settings_page.dart';
import '../features/settings/settings_page.dart';
import '../features/settings/voice_settings_page.dart';
import '../features/today/today_page.dart';
import '../features/tree/tree_page.dart';
import '../widgets/nownote_shell.dart';

/// NowNote 앱 라우팅 구조.
///
/// - `/today`, `/tree`: 하단 탭 2개. [StatefulShellRoute.indexedStack]으로
///   탭 상태를 유지하며 전환한다.
/// - `/messenger`, `/settings`: 상단 아이콘으로 진입하는 별도 라우트.
/// - `/settings/*`: 설정 허브에서 `context.push`로 들어가는 하위 화면.
///
/// 앱 실행 중에는 한 번만 만들어 재사용해야 한다(위젯 트리 재빌드마다
/// 새로 만들면 안 된다). 위젯 테스트에서는 테스트마다 새 인스턴스가
/// 필요하므로 함수로 제공한다.
GoRouter createAppRouter() => GoRouter(
  initialLocation: '/today',
  routes: <RouteBase>[
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return NowNoteShell(navigationShell: navigationShell);
      },
      branches: <StatefulShellBranch>[
        StatefulShellBranch(
          routes: <RouteBase>[
            GoRoute(
              path: '/today',
              builder: (context, state) => const TodayMemoPage(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: <RouteBase>[
            GoRoute(
              path: '/tree',
              builder: (context, state) => const TreeMemoPage(),
            ),
          ],
        ),
      ],
    ),
    GoRoute(
      path: '/messenger',
      builder: (context, state) => const MessengerPage(),
    ),
    GoRoute(
      path: '/settings',
      builder: (context, state) => const SettingsPage(),
    ),
    GoRoute(
      path: '/settings/server',
      builder: (context, state) => const ServerSettingsPage(),
    ),
    GoRoute(
      path: '/settings/voice',
      builder: (context, state) => const VoiceSettingsPage(),
    ),
    GoRoute(
      path: '/settings/help',
      builder: (context, state) => const HelpPage(),
    ),
  ],
);

