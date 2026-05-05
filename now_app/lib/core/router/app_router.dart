import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../features/home/home_page.dart';
import '../../features/meeting/meeting_start_page.dart';
import '../../features/meeting/meeting_progress_page.dart';
import '../../features/meeting/meetings_page.dart';
import '../../features/meeting/memo_start_page.dart';
import '../../features/meeting/memo_tree_page.dart';
// RecordPage는 meetings_page.dart에 포함
import '../../features/meeting/meeting_detail_page.dart';
import '../../features/items/items_review_page.dart';
import '../../features/settings/settings_page.dart';
import '../../features/meal/meal_page.dart';
import '../../features/money/money_page.dart';
import '../../features/life/life_page.dart';
import '../../features/health/health_page.dart';
import '../../features/settings/routine_management_page.dart';
import '../../features/settings/server_settings_page.dart';
import '../../features/settings/voice_settings_page.dart';
import '../../features/life/fashion/fashion_page.dart';
import '../../features/settings/weather_settings_page.dart';
import '../../features/life/weather/weather_page.dart';
import '../../features/life/subscription/subscription_page.dart';
import '../../features/settings/llm_settings_page.dart';
import '../../features/travel/travel_page.dart';
import '../../features/capture/capture_page.dart';
import '../../features/home/schedule_page.dart';

part 'app_router.g.dart';

@riverpod
GoRouter appRouter(AppRouterRef ref) {
  return GoRouter(
    initialLocation: '/home',
    routes: [
      GoRoute(path: '/home',     builder: (_, __) => const HomePage()),
      GoRoute(path: '/life',     builder: (_, __) => const LifePage()),
      GoRoute(path: '/life/meal', builder: (_, __) => const MealPage()),
      GoRoute(path: '/meal',      builder: (_, __) => const MealPage()), // 하위 호환
      GoRoute(
        path: '/health',
        builder: (context, state) => HealthPage(
          initialSheet: state.uri.queryParameters['sheet'],
        ),
      ),
      GoRoute(
        path: '/life/health',
        builder: (context, state) => HealthPage(
          initialSheet: state.uri.queryParameters['sheet'],
        ),
      ),
      GoRoute(path: '/meetings', builder: (_, __) => const MeetingsPage()),
      GoRoute(
        path: '/meetings/:id',
        builder: (context, state) => MeetingDetailPage(
          meeting: state.extra as MeetingSummary,
        ),
      ),
      GoRoute(
        path: '/meeting/start',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return MeetingStartPage(
            initialType: extra?['initialType'] as String?,
          );
        },
      ),
      GoRoute(
        path: '/meeting/progress',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return MeetingProgressPage(
            event: extra?['event'] as CalendarEventItem?,
            recordType: extra?['recordType'] as String? ?? 'meeting',
            participantName: extra?['participantName'] as String? ?? '',
            voiceInputMode:
                extra?['voiceInputMode'] as String? ?? 'realtime',
            memoDate: extra?['memoDate'] as DateTime?,
          );
        },
      ),
      GoRoute(
        path: '/items/review',
        builder: (context, state) => ItemsReviewPage(
          meetingId: state.extra as String?,
        ),
      ),
      GoRoute(path: '/settings', builder: (_, __) => const SettingsPage()),
      GoRoute(path: '/settings/routines', builder: (_, __) => const RoutineManagementPage()),
      GoRoute(path: '/settings/server', builder: (_, __) => const ServerSettingsPage()),
      GoRoute(path: '/settings/voice',    builder: (_, __) => const VoiceSettingsPage()),
      GoRoute(path: '/life/fashion',         builder: (_, __) => const FashionPage()),
      GoRoute(path: '/life/weather',         builder: (_, __) => const WeatherPage()),
      GoRoute(path: '/life/subscription',    builder: (_, __) => const SubscriptionPage()),
      GoRoute(path: '/money',  builder: (_, __) => const MoneyPage()),
      GoRoute(path: '/travel',               builder: (_, __) => const TravelPage()),
      GoRoute(
        path: '/travel/:id',
        builder: (context, state) => TripDetailPage(tripId: state.pathParameters['id']!),
      ),
      GoRoute(path: '/settings/llm',      builder: (_, __) => const LlmSettingsPage()),
      GoRoute(path: '/settings/weather',   builder: (_, __) => const WeatherSettingsPage()),
      GoRoute(path: '/capture',              builder: (_, __) => const CapturePage()),
      GoRoute(path: '/schedule',             builder: (_, __) => const SchedulePage()),
      GoRoute(
        path: '/memo/start',
        builder: (_, state) => MemoStartPage(
          initialDate: state.extra as DateTime?,
        ),
      ),
      GoRoute(path: '/memo/tree',              builder: (_, __) => const MemoTreePage()),
      GoRoute(path: '/llm/chat',               builder: (_, __) => const LlmChatPage()),
    ],
  );
}
