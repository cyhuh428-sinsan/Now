import 'package:dio/dio.dart';
import 'package:now_core/now_core.dart';

import '../../core/network/dio_client.dart';

/// NowNote 쪽 메신저 데이터 접근 계층.
///
/// Now의 `server_sync_service.dart`가 메신저 관련해서 하던 역할(`ServerSettings`
/// 읽기, 메신저용 Dio 헤더 구성, `ServerMessengerApi` 호출) 중 메신저 부분만
/// 옮겨 놓았다. 화면은 이 서비스만 보고, `ServerMessengerApi`/`ServerSettings`를
/// 직접 부르지 않는다.
///
/// [messengerDioBuilder]는 테스트에서 `HttpClientAdapter`를 목으로 바꾼 Dio를
/// 주입하기 위한 훅이다. 기본값은 실제 서버로 나가는 Dio를 만든다.
class MessengerService {
  MessengerService({Dio Function(ServerSettings settings)? messengerDioBuilder})
    : _messengerDioBuilder = messengerDioBuilder ?? _defaultMessengerDio;

  final Dio Function(ServerSettings settings) _messengerDioBuilder;

  Future<ServerSettings> loadSettings() => ServerSettings.load();

  Future<ServerMessengerRoomsResult> loadRooms(ServerSettings settings) {
    return ServerMessengerApi.loadMessengerRooms(
      dio: _messengerDioBuilder(settings),
      settings: settings,
    );
  }

  Future<ServerMessengerMessagesResult> loadMessages(
    ServerSettings settings, {
    required int roomId,
  }) {
    return ServerMessengerApi.loadMessengerMessages(
      dio: _messengerDioBuilder(settings),
      settings: settings,
      roomId: roomId,
    );
  }

  Future<ServerMessengerMessage> sendMessage(
    ServerSettings settings, {
    required int roomId,
    required String body,
  }) {
    return ServerMessengerApi.sendMessengerMessage(
      dio: _messengerDioBuilder(settings),
      settings: settings,
      roomId: roomId,
      body: body,
    );
  }

  Future<void> markRoomRead(
    ServerSettings settings, {
    required int roomId,
    required int lastReadMessageId,
  }) {
    return ServerMessengerApi.markMessengerRoomRead(
      dio: _messengerDioBuilder(settings),
      settings: settings,
      roomId: roomId,
      lastReadMessageId: lastReadMessageId,
    );
  }
}

/// Now의 `_dio`/`_messengerDio`(`server_sync_service.dart` 약 443~470번째 줄)와
/// 같은 헤더 구성이다: 구형 개인 서버 토큰(`Authorization`), 사용자 토큰
/// (`X-Now-User-Token`), 메신저 웹 세션 토큰(`X-Now-Web-Session`).
Dio _defaultMessengerDio(ServerSettings settings) {
  final dio = DioClient.create(baseUrl: normalizeBaseUrl(settings.baseUrl));
  if (settings.token.trim().isNotEmpty) {
    dio.options.headers['Authorization'] = 'Bearer ${settings.token.trim()}';
  }
  if (settings.userToken.trim().isNotEmpty) {
    dio.options.headers['X-Now-User-Token'] = settings.userToken.trim();
  }
  final sessionToken = settings.webSessionToken.trim();
  if (sessionToken.isNotEmpty) {
    dio.options.headers['X-Now-Web-Session'] = sessionToken;
  }
  return dio;
}
