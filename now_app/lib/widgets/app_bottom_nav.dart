import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// 앱 전체 공통 하단 탭바
/// selectedIndex: 0=홈, 1=일상, 2=살림, 3=여행, 4=기록
/// 설정은 홈 AppBar 아이콘으로 접근
class AppBottomNav extends StatelessWidget {
  final int selectedIndex;

  const AppBottomNav({super.key, required this.selectedIndex});

  void _onTap(BuildContext context, int index) {
    if (index == selectedIndex) return;
    switch (index) {
      case 0:
        context.go('/home');
        return;
      case 1:
        context.go('/life');
        return;
      case 2:
        context.go('/money');
        return;
      case 3:
        context.go('/travel');
        return;
      case 4:
        context.go('/meetings');
        return;
      default:
        return;
    }
  }

  @override
  Widget build(BuildContext context) {
    return BottomAppBar(
      color: Colors.white,
      elevation: 8,
      child: SizedBox(
        height: 60,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(icon: Icons.home_outlined, selectedIcon: Icons.home, label: '홈', index: 0, selectedIndex: selectedIndex, onTap: () => _onTap(context, 0)),
            _NavItem(icon: Icons.grid_view_outlined, selectedIcon: Icons.grid_view, label: '일상', index: 1, selectedIndex: selectedIndex, onTap: () => _onTap(context, 1)),
            _NavItem(icon: Icons.account_balance_wallet_outlined, selectedIcon: Icons.account_balance_wallet, label: '살림', index: 2, selectedIndex: selectedIndex, onTap: () => _onTap(context, 2)),
            _NavItem(icon: Icons.flight_outlined, selectedIcon: Icons.flight, label: '여행', index: 3, selectedIndex: selectedIndex, onTap: () => _onTap(context, 3)),
            _NavItem(icon: Icons.article_outlined, selectedIcon: Icons.article, label: '기록', index: 4, selectedIndex: selectedIndex, onTap: () => _onTap(context, 4)),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int index;
  final int selectedIndex;
  final VoidCallback onTap;

  const _NavItem({required this.icon, required this.selectedIcon, required this.label, required this.index, required this.selectedIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isSelected = index == selectedIndex;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 60,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(isSelected ? selectedIcon : icon, size: 22, color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF9CA3AF)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal, color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF9CA3AF))),
          ],
        ),
      ),
    );
  }
}

/// 각 페이지 Scaffold에서 사용하는 Capture FAB
class CaptureFab extends StatelessWidget {
  const CaptureFab({super.key});

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton(
      onPressed: () => context.push('/capture'),
      backgroundColor: const Color(0xFF2563EB),
      elevation: 4,
      shape: const CircleBorder(),
      child: const Icon(Icons.add, color: Colors.white, size: 28),
    );
  }
}
