import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/router/app_router.dart';
import 'services/briefing_service.dart';

class NowApp extends ConsumerStatefulWidget {
  const NowApp({super.key});

  @override
  ConsumerState<NowApp> createState() => _NowAppState();
}

class _NowAppState extends ConsumerState<NowApp> {
  @override
  void initState() {
    super.initState();
    // 앱 오픈 시 브리핑 자동 생성
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(briefingServiceProvider).generateTodayBriefing();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    return MaterialApp.router(
      title: 'NOW',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      routerConfig: router,
    );
  }
}
