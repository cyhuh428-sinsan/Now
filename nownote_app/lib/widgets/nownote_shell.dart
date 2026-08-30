import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// 오늘 메모 / 계층 메모 2탭 셸.
///
/// [StatefulShellRoute.indexedStack]과 함께 사용해 탭을 오갈 때
/// 각 탭의 화면 상태(스크롤 위치 등)가 초기화되지 않도록 한다.
/// 상단 앱바에 메신저·설정 진입 아이콘을 둔다.
class NowNoteShell extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const NowNoteShell({super.key, required this.navigationShell});

  static const List<String> _titles = <String>['오늘 메모', '계층 메모'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[navigationShell.currentIndex]),
        actions: <Widget>[
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline),
            tooltip: '메신저',
            onPressed: () => context.push('/messenger'),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: '설정',
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: (int index) => navigationShell.goBranch(
          index,
          initialLocation: index == navigationShell.currentIndex,
        ),
        destinations: const <NavigationDestination>[
          NavigationDestination(
            icon: Icon(Icons.today_outlined),
            selectedIcon: Icon(Icons.today),
            label: '오늘 메모',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_tree_outlined),
            selectedIcon: Icon(Icons.account_tree),
            label: '계층 메모',
          ),
        ],
      ),
    );
  }
}
