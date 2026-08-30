import 'package:dio/dio.dart';

import 'server_settings.dart';

/// `/api/v1/messenger/rooms` 목록 응답의 방 하나.
class ServerMessengerRoom {
  final int id;
  final String roomType;
  final String name;
  final String groupName;
  final int lastMessageId;
  final int lastReadMessageId;
  final int unreadCount;
  final List<String> members;

  const ServerMessengerRoom({
    required this.id,
    required this.roomType,
    required this.name,
    required this.groupName,
    required this.lastMessageId,
    required this.lastReadMessageId,
    required this.unreadCount,
    required this.members,
  });

  factory ServerMessengerRoom.fromJson(Map<String, dynamic> json) {
    final rawMembers = (json['members'] as List?) ?? const [];
    return ServerMessengerRoom(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      roomType: json['room_type']?.toString() ?? '',
      name: json['name']?.toString() ?? '채팅방',
      groupName: json['group_name']?.toString() ?? '',
      lastMessageId:
          int.tryParse(json['last_message_id']?.toString() ?? '') ?? 0,
      lastReadMessageId:
          int.tryParse(json['last_read_message_id']?.toString() ?? '') ?? 0,
      unreadCount: int.tryParse(json['unread_count']?.toString() ?? '') ?? 0,
      members: rawMembers
          .map((item) {
            if (item is Map) {
              return item['owner_id']?.toString() ??
                  item['ownerId']?.toString() ??
                  '';
            }
            return item.toString();
          })
          .where((item) => item.trim().isNotEmpty)
          .toList(),
    );
  }
}

/// `/api/v1/messenger/rooms/{room_id}/messages` 응답의 메시지 하나.
class ServerMessengerMessage {
  final int id;
  final int roomId;
  final String senderOwnerId;
  final String senderDisplayName;
  final String body;
  final String createdAt;

  const ServerMessengerMessage({
    required this.id,
    required this.roomId,
    required this.senderOwnerId,
    required this.senderDisplayName,
    required this.body,
    required this.createdAt,
  });

  factory ServerMessengerMessage.fromJson(Map<String, dynamic> json) {
    return ServerMessengerMessage(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      roomId: int.tryParse(json['room_id']?.toString() ?? '') ?? 0,
      senderOwnerId: json['sender_owner_id']?.toString() ?? '',
      senderDisplayName:
          json['sender_display_name']?.toString() ??
          json['sender_owner_id']?.toString() ??
          '',
      body: json['body']?.toString() ?? '',
      createdAt: json['created_at']?.toString() ?? '',
    );
  }
}

/// `loadMessengerRooms` 결과.
class ServerMessengerRoomsResult {
  final String groupName;
  final List<ServerMessengerRoom> rooms;

  const ServerMessengerRoomsResult({
    required this.groupName,
    required this.rooms,
  });
}

/// `loadMessengerMessages` 결과.
class ServerMessengerMessagesResult {
  final ServerMessengerRoom? room;
  final List<ServerMessengerMessage> items;

  const ServerMessengerMessagesResult({
    required this.room,
    required this.items,
  });
}

/// 메신저 방/메시지 조회, 전송, 읽음 처리를 담당한다.
///
/// 화면을 갖지 않는다. Dio 인스턴스(헤더 구성 포함)는 호출하는 쪽이 만들어
/// 넘긴다 — `server/server_recording.dart`와 같은 패턴이다. 메신저 전용
/// 헤더(`X-Now-Web-Session`)를 채우는 `_messengerDio` 구성은 이 계층이 정하지
/// 않는다 — now_app이 공유 Dio 헬퍼로 그대로 둔다(2.3.6 P1~P4와 같은 이유).
class ServerMessengerApi {
  const ServerMessengerApi._();

  /// `GET /api/v1/messenger/rooms`로 방 목록을 조회한다.
  static Future<ServerMessengerRoomsResult> loadMessengerRooms({
    required Dio dio,
    required ServerSettings settings,
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    try {
      final ownerId = normalizeOwnerId(settings.ownerId);
      final res = await dio.get<Map<String, dynamic>>(
        '/api/v1/messenger/rooms',
        queryParameters: {'owner_id': ownerId},
      );
      final rooms = ((res.data?['rooms'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (item) => ServerMessengerRoom.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .where((room) => room.id > 0)
          .toList();
      return ServerMessengerRoomsResult(
        groupName: res.data?['group_name']?.toString() ?? '',
        rooms: rooms,
      );
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '메신저 방 조회 실패'));
    }
  }

  /// `GET /api/v1/messenger/rooms/{room_id}/messages`로 메시지 목록을 조회한다.
  static Future<ServerMessengerMessagesResult> loadMessengerMessages({
    required Dio dio,
    required ServerSettings settings,
    required int roomId,
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    try {
      final ownerId = normalizeOwnerId(settings.ownerId);
      final res = await dio.get<Map<String, dynamic>>(
        '/api/v1/messenger/rooms/$roomId/messages',
        queryParameters: {'owner_id': ownerId, 'limit': 100},
      );
      final rawRoom = res.data?['room'];
      final messages = ((res.data?['items'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (item) => ServerMessengerMessage.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList();
      return ServerMessengerMessagesResult(
        room: rawRoom is Map
            ? ServerMessengerRoom.fromJson(Map<String, dynamic>.from(rawRoom))
            : null,
        items: messages,
      );
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '메신저 메시지 조회 실패'));
    }
  }

  /// `POST /api/v1/messenger/rooms/{room_id}/messages`로 메시지를 보낸다.
  static Future<ServerMessengerMessage> sendMessengerMessage({
    required Dio dio,
    required ServerSettings settings,
    required int roomId,
    required String body,
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final trimmed = body.trim();
    if (trimmed.isEmpty) {
      throw Exception('메시지를 입력하세요');
    }
    try {
      final res = await dio.post<Map<String, dynamic>>(
        '/api/v1/messenger/rooms/$roomId/messages',
        data: {
          'owner_id': normalizeOwnerId(settings.ownerId),
          'body': trimmed,
        },
      );
      final item = res.data?['item'];
      if (item is! Map) {
        throw Exception('서버 응답에 메시지가 없습니다');
      }
      return ServerMessengerMessage.fromJson(Map<String, dynamic>.from(item));
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '메신저 메시지 전송 실패'));
    }
  }

  /// `POST /api/v1/messenger/rooms/{room_id}/read`로 읽음 위치를 갱신한다.
  static Future<void> markMessengerRoomRead({
    required Dio dio,
    required ServerSettings settings,
    required int roomId,
    required int lastReadMessageId,
  }) async {
    if (!settings.isConfigured || lastReadMessageId <= 0) return;
    try {
      await dio.post<Map<String, dynamic>>(
        '/api/v1/messenger/rooms/$roomId/read',
        data: {
          'owner_id': normalizeOwnerId(settings.ownerId),
          'last_read_message_id': lastReadMessageId,
        },
      );
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '메신저 읽음 처리 실패'));
    }
  }
}

// now_core와 now_app이 서로 다른 dio 버전을 해석할 수 있어 DioExceptionType은
// 보지 않는다. 상태 코드와 응답 본문만으로 메시지를 만든다.
// (server/server_connection.dart와 같은 이유로 같은 구현을 둔다.)
String _serverErrorMessage(
  DioException error, {
  String fallback = '요청에 실패했습니다',
}) {
  final status = error.response?.statusCode;
  final prefix = status == null ? '요청 실패' : 'HTTP $status';
  final body = error.response?.data;
  if (body == null) {
    return '$prefix: ${error.message ?? fallback}';
  }

  if (body is Map<String, dynamic>) {
    final detail = body['detail'];
    final message = body['message'];
    if (detail == 'user inactive') {
      return '$prefix: 비활성 사용자라 서버 기능을 사용할 수 없습니다.';
    }
    if (detail is String && detail.isNotEmpty) return '$prefix: $detail';
    if (message is String && message.isNotEmpty) return '$prefix: $message';
  }
  if (body is String && body.isNotEmpty) {
    final text = body.length > 180 ? body.substring(0, 180) : body;
    return '$prefix: $text';
  }
  return '$prefix: ${error.message ?? fallback}';
}
