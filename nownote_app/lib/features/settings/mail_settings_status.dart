import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

import '../../core/network/dio_client.dart';

class MailSettingsStatus {
  const MailSettingsStatus({
    required this.enabled,
    this.senderEmail = '',
    this.lastTestedAt,
    this.message = '',
  });

  final bool enabled;
  final String senderEmail;
  final DateTime? lastTestedAt;
  final String message;
}

class MailSettingsStatusService {
  const MailSettingsStatusService({
    Dio Function(ServerSettings settings)? dioBuilder,
  }) : _dioBuilder = dioBuilder ?? _defaultDio;

  final Dio Function(ServerSettings settings) _dioBuilder;

  Future<MailSettingsStatus> load() async {
    final settings = await ServerSettings.load();
    if (!settings.enabled ||
        !settings.isConfigured ||
        settings.userToken.trim().isEmpty) {
      return const MailSettingsStatus(
        enabled: false,
        message: '서버 연결 테스트 후 사용할 수 있습니다.',
      );
    }

    try {
      final response = await _dioBuilder(
        settings,
      ).get<Map<String, dynamic>>('/api/v1/mail/settings/status');
      final data = response.data ?? const <String, dynamic>{};
      return MailSettingsStatus(
        enabled: data['enabled'] == true,
        senderEmail: (data['sender_email'] ?? '').toString(),
        lastTestedAt: DateTime.tryParse(
          (data['last_tested_at'] ?? '').toString(),
        ),
        message: (data['message'] ?? '').toString(),
      );
    } catch (_) {
      return const MailSettingsStatus(
        enabled: false,
        message: '메일 설정 상태를 확인할 수 없습니다.',
      );
    }
  }
}

final mailSettingsStatusServiceProvider = Provider<MailSettingsStatusService>(
  (ref) => const MailSettingsStatusService(),
);

final mailSettingsStatusProvider = FutureProvider<MailSettingsStatus>(
  (ref) => ref.watch(mailSettingsStatusServiceProvider).load(),
);

Dio _defaultDio(ServerSettings settings) {
  final dio = DioClient.create(baseUrl: normalizeBaseUrl(settings.baseUrl));
  if (settings.token.trim().isNotEmpty) {
    dio.options.headers['Authorization'] = 'Bearer ${settings.token.trim()}';
  }
  if (settings.userToken.trim().isNotEmpty) {
    dio.options.headers['X-Now-User-Token'] = settings.userToken.trim();
  }
  return dio;
}
