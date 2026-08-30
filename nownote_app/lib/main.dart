import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:now_core/now_core.dart';

import 'features/settings/settings_providers.dart';
import 'features/tree/tree_repository.dart';
import 'providers/theme_mode_provider.dart';
import 'router/app_router.dart';
import 'shared/note_database_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('ko', null); // 한국어 날짜 포맷 (오늘 메모 화면의 달력이 씀)
  runApp(const ProviderScope(child: NowNoteApp()));
}

class NowNoteApp extends ConsumerStatefulWidget {
  const NowNoteApp({super.key});

  @override
  ConsumerState<NowNoteApp> createState() => _NowNoteAppState();
}

class _NowNoteAppState extends ConsumerState<NowNoteApp> {
  // 앱(위젯 트리) 생명주기 동안 라우터를 한 번만 만든다.
  // 매 build마다 새로 만들면 탭/네비게이션 상태가 초기화된다.
  late final GoRouter _router = createAppRouter();

  @override
  void initState() {
    super.initState();
    // 시작할 때 한 번 조용히 맞춰 본다. 실패해도 화면에 오류를 띄우지 않는다 —
    // 설정 화면의 "지금 동기화"로 다시 시도할 수 있다.
    WidgetsBinding.instance.addPostFrameCallback((_) => _syncOnStartup());
  }

  Future<void> _syncOnStartup() async {
    try {
      final settings = await ServerSettings.load();
      if (!settings.enabled || !settings.isConfigured) return;
      final service = ref.read(serverSettingsServiceProvider);
      final db = ref.read(noteDatabaseProvider);
      await service.syncNotes(
        settings: settings,
        db: db,
        treeRepo: TreeMemoRepository(db),
      );
    } catch (_) {
      // 조용히 넘어간다.
    }
  }

  @override
  Widget build(BuildContext context) {
    final ThemeMode themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'NowNote',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.indigo),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.indigo,
        brightness: Brightness.dark,
      ),
      themeMode: themeMode,
      routerConfig: _router,
    );
  }
}
