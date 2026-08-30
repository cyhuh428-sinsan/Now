import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'providers/theme_mode_provider.dart';
import 'router/app_router.dart';

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
