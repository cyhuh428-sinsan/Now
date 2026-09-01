import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/theme_mode_provider.dart';

/// 설정 허브 화면.
///
/// 위에 테마 선택(시스템/라이트/다크), 아래에 서버 설정/음성 설정/LLM Key 설정/도움말로
/// 가는 목록 타일을 둔다. 각 하위 화면은
/// `context.push`로 들어가는 별도 라우트다(뒤로가기 자동 생김).
class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('설정')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            '테마',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          SegmentedButton<ThemeMode>(
            segments: const [
              ButtonSegment(
                value: ThemeMode.system,
                label: Text('시스템'),
                icon: Icon(Icons.brightness_auto_outlined),
              ),
              ButtonSegment(
                value: ThemeMode.light,
                label: Text('라이트'),
                icon: Icon(Icons.light_mode_outlined),
              ),
              ButtonSegment(
                value: ThemeMode.dark,
                label: Text('다크'),
                icon: Icon(Icons.dark_mode_outlined),
              ),
            ],
            selected: {themeMode},
            onSelectionChanged: (selection) {
              ref
                  .read(themeModeProvider.notifier)
                  .setThemeMode(selection.first);
            },
          ),
          const SizedBox(height: 24),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.cloud_outlined),
                  title: const Text('서버 설정'),
                  subtitle: const Text('서버 연결, 로그인, 연결 테스트'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/settings/server'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.mic_none_outlined),
                  title: const Text('음성 설정'),
                  subtitle: const Text('STT/TTS 서버, 사진 읽기 LLM'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/settings/voice'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.key_outlined),
                  title: const Text('LLM Key 설정'),
                  subtitle: const Text('사진 읽기와 묻기용 LLM API Key'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/settings/voice'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.help_outline),
                  title: const Text('도움말'),
                  subtitle: const Text('NowNote 사용 안내'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/settings/help'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
