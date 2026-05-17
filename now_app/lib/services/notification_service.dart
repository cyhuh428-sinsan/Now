import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz;

// ============================================================
// 알림 서비스
// ============================================================

const _briefingNotificationId = 1001;
const _briefingChannelId = 'briefing_channel';
const _briefingChannelName = '브리핑 알림';
const _prefKeyEnabled = 'briefing_notification_enabled';
const _prefKeyHour = 'briefing_notification_hour';
const _prefKeyMinute = 'briefing_notification_minute';

class NotificationService {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  // ── 초기화 ──
  static Future<void> init() async {
    if (_initialized) return;
    tz.initializeTimeZones();

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _plugin.initialize(
      initSettings,
      onDidReceiveNotificationResponse: (details) {
        // 알림 탭 시 처리 (main.dart에서 라우팅)
      },
    );
    _initialized = true;
  }

  // ── 권한 요청 ──
  static Future<bool> requestPermission() async {
    final android = _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    final granted = await android?.requestNotificationsPermission();
    return granted ?? false;
  }

  // ── 브리핑 알림 예약 ──
  static Future<void> scheduleBriefing(int hour, int minute) async {
    await _plugin.cancel(_briefingNotificationId);

    final now = tz.TZDateTime.now(tz.local);
    var scheduled = tz.TZDateTime(
        tz.local, now.year, now.month, now.day, hour, minute);
    if (scheduled.isBefore(now)) {
      scheduled = scheduled.add(const Duration(days: 1));
    }

    await _plugin.zonedSchedule(
      _briefingNotificationId,
      '✨ 오늘의 브리핑',
      '오늘 일정과 할 일을 확인해보세요',
      scheduled,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _briefingChannelId,
          _briefingChannelName,
          channelDescription: '매일 아침 브리핑 알림',
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      matchDateTimeComponents: DateTimeComponents.time, // 매일 반복
    );
  }

  // ── 브리핑 알림 취소 ──
  static Future<void> cancelBriefing() async {
    await _plugin.cancel(_briefingNotificationId);
  }

  // ── 설정 저장/로드 ──
  static Future<void> saveSettings({
    required bool enabled,
    required int hour,
    required int minute,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_prefKeyEnabled, enabled);
    await prefs.setInt(_prefKeyHour, hour);
    await prefs.setInt(_prefKeyMinute, minute);

    if (enabled) {
      await scheduleBriefing(hour, minute);
    } else {
      await cancelBriefing();
    }
  }

  static Future<({bool enabled, int hour, int minute})>
      loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    return (
      enabled: prefs.getBool(_prefKeyEnabled) ?? true,
      hour: prefs.getInt(_prefKeyHour) ?? 9,
      minute: prefs.getInt(_prefKeyMinute) ?? 0,
    );
  }
}

// ============================================================
// Provider
// ============================================================

final briefingSettingsProvider = AsyncNotifierProvider<
    BriefingSettingsNotifier,
    ({bool enabled, int hour, int minute})>(BriefingSettingsNotifier.new);

class BriefingSettingsNotifier
    extends AsyncNotifier<({bool enabled, int hour, int minute})> {
  @override
  Future<({bool enabled, int hour, int minute})> build() async {
    return NotificationService.loadSettings();
  }

  Future<void> saveSettings({bool? enabled, int? hour, int? minute}) async {
    final current = await future;
    final next = (
      enabled: enabled ?? current.enabled,
      hour: hour ?? current.hour,
      minute: minute ?? current.minute,
    );
    await NotificationService.saveSettings(
      enabled: next.enabled,
      hour: next.hour,
      minute: next.minute,
    );
    state = AsyncData(next);
  }
}
