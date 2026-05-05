import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../widgets/app_bottom_nav.dart';

// ============================================================
// 일상 탭 메인 — 6개 카드 (건강 추가)
// ============================================================

class LifePage extends StatelessWidget {
  const LifePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        title: const Text(
          '일상',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
        child: ListView(
          children: [
            _LifeCard(
              emoji: '🍽️',
              title: '식사',
              subtitle: '오늘 먹은 것을 기록하고\n식비를 관리합니다',
              color: const Color(0xFFF59E0B),
              onTap: () => context.push('/life/meal'),
            ),
            const SizedBox(height: 10),
            _LifeCard(
              emoji: '👗',
              title: '패션',
              subtitle: '오늘 착장을 기록하고\nLLM이 패션을 제안합니다',
              color: const Color(0xFFEC4899),
              onTap: () => context.push('/life/fashion'),
            ),
            const SizedBox(height: 10),
            _LifeCard(
              emoji: '🌤️',
              title: '날씨와 준비물',
              subtitle: '오늘 날씨에 맞는\n준비물을 알려드립니다',
              color: const Color(0xFF06B6D4),
              onTap: () => context.push('/life/weather'),
            ),
            const SizedBox(height: 10),
            _LifeCard(
              emoji: '💳',
              title: '결제',
              subtitle: '구독 서비스와 정기결제를\n한눈에 관리합니다',
              color: const Color(0xFF8B5CF6),
              onTap: () => context.push('/life/subscription'),
            ),

            const SizedBox(height: 10),
            // 건강 (기존 독립 탭 → 일상 서브탭으로 이동)
            _LifeCard(
              emoji: '❤️',
              title: '건강',
              subtitle: '수면·약·운동·병원을 기록하고\nAI가 건강 상태를 분석합니다',
              color: const Color(0xFFEF4444),
              onTap: () => context.push('/health'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
      extendBody: true,
      floatingActionButton: const CaptureFab(),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      bottomNavigationBar: const AppBottomNav(selectedIndex: 1),
    );
  }
}

// ============================================================
// 라이프 카드
// ============================================================

class _LifeCard extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  final Color color;
  final String? badge;
  final VoidCallback? onTap;

  const _LifeCard({
    required this.emoji,
    required this.title,
    required this.subtitle,
    required this.color,
    this.badge,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isEnabled = onTap != null;

    return Opacity(
      opacity: isEnabled ? 1.0 : 0.6,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Center(
                  child: Text(emoji, style: const TextStyle(fontSize: 24)),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF111827),
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 7),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFF6B7280).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              badge!,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6B7280),
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              if (isEnabled)
                Icon(Icons.chevron_right, size: 20, color: color),
            ],
          ),
        ),
      ),
    );
  }
}
