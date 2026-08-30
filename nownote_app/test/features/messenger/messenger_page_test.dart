import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';
import 'package:nownote/features/messenger/messenger_page.dart';
import 'package:nownote/features/messenger/messenger_providers.dart';
import 'package:nownote/features/messenger/messenger_service.dart';

/// 실제 서버를 부르지 않는다. [MessengerService]를 상속해 원하는 값을
/// 돌려주는 가짜로 바꿔 끼운다 — `today_page_test.dart`가
/// `todayNoteDatabaseProvider`를 override하는 패턴과 같다.
class _FakeMessengerService extends MessengerService {
  _FakeMessengerService({
    required ServerSettings settings,
    List<ServerMessengerRoom> rooms = const [],
    String groupName = '',
    Map<int, List<ServerMessengerMessage>> messagesByRoom = const {},
  }) : _settings = settings,
       _rooms = rooms,
       _groupName = groupName,
       // messagesByRoom의 기본값(const {})은 불변이라 그대로 두면
       // sendMessage에서 [] 대입 시 UnsupportedError가 난다. 항상 가변
       // Map으로 복사해 둔다.
       _messagesByRoom = Map<int, List<ServerMessengerMessage>>.from(
         messagesByRoom,
       );

  final ServerSettings _settings;
  final List<ServerMessengerRoom> _rooms;
  final String _groupName;
  final Map<int, List<ServerMessengerMessage>> _messagesByRoom;

  final List<String> sentBodies = <String>[];
  final List<int> markedReadRoomIds = <int>[];
  int loadRoomsCallCount = 0;

  @override
  Future<ServerSettings> loadSettings() async => _settings;

  @override
  Future<ServerMessengerRoomsResult> loadRooms(ServerSettings settings) async {
    loadRoomsCallCount++;
    return ServerMessengerRoomsResult(groupName: _groupName, rooms: _rooms);
  }

  @override
  Future<ServerMessengerMessagesResult> loadMessages(
    ServerSettings settings, {
    required int roomId,
  }) async {
    final room = _rooms
        .where((r) => r.id == roomId)
        .cast<ServerMessengerRoom?>()
        .firstOrNullMatch();
    return ServerMessengerMessagesResult(
      room: room,
      items: _messagesByRoom[roomId] ?? const [],
    );
  }

  @override
  Future<ServerMessengerMessage> sendMessage(
    ServerSettings settings, {
    required int roomId,
    required String body,
  }) async {
    sentBodies.add(body);
    final sent = ServerMessengerMessage(
      id: 999,
      roomId: roomId,
      senderOwnerId: settings.ownerId,
      senderDisplayName: '나',
      body: body,
      createdAt: '2026-08-24T00:00:00Z',
    );
    _messagesByRoom[roomId] = [...(_messagesByRoom[roomId] ?? const []), sent];
    return sent;
  }

  @override
  Future<void> markRoomRead(
    ServerSettings settings, {
    required int roomId,
    required int lastReadMessageId,
  }) async {
    markedReadRoomIds.add(roomId);
  }
}

extension _FirstWhereOrNull<T> on Iterable<T> {
  T? firstOrNullMatch() {
    final iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}

ServerSettings _configuredSettings({String ownerId = 'cyhuh'}) {
  return ServerSettings(
    enabled: true,
    baseUrl: 'http://server.test:8750',
    token: '',
    userToken: '',
    webSessionToken: '',
    ownerId: ownerId,
    deviceId: 'test-device',
    lastSyncedAt: null,
  );
}

ServerSettings _unconfiguredSettings() {
  return const ServerSettings(
    enabled: false,
    baseUrl: '',
    token: '',
    userToken: '',
    webSessionToken: '',
    ownerId: 'local_user',
    deviceId: '',
    lastSyncedAt: null,
  );
}

Widget _wrap(MessengerService service) {
  return ProviderScope(
    overrides: [messengerServiceProvider.overrideWithValue(service)],
    child: const MaterialApp(home: MessengerPage()),
  );
}

void main() {
  testWidgets('서버 설정이 없으면 안내 문구가 보이고 입력이 막힌다', (tester) async {
    final service = _FakeMessengerService(settings: _unconfiguredSettings());

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    expect(find.text('서버 설정이 필요합니다'), findsOneWidget);
    expect(find.text('아직 메시지가 없습니다'), findsOneWidget);

    final sendButton = tester
        .widgetList<IconButton>(find.byType(IconButton))
        .firstWhere((button) => button.icon is Icon);
    expect(sendButton.onPressed, isNull);

    final textField = tester.widget<TextField>(find.byType(TextField));
    expect(textField.enabled, isFalse);
  });

  testWidgets('방 목록이 chip으로 보이고 첫 방이 자동 선택된다', (tester) async {
    final rooms = [
      const ServerMessengerRoom(
        id: 1,
        roomType: 'group',
        name: '전체 채팅',
        groupName: '개발팀',
        lastMessageId: 1,
        lastReadMessageId: 0,
        unreadCount: 3,
        members: [],
      ),
      const ServerMessengerRoom(
        id: 2,
        roomType: 'group',
        name: '잡담방',
        groupName: '개발팀',
        lastMessageId: 0,
        lastReadMessageId: 0,
        unreadCount: 0,
        members: [],
      ),
    ];
    final service = _FakeMessengerService(
      settings: _configuredSettings(),
      rooms: rooms,
      groupName: '개발팀',
      messagesByRoom: {
        1: [
          const ServerMessengerMessage(
            id: 10,
            roomId: 1,
            senderOwnerId: 'cyhuh',
            senderDisplayName: '나',
            body: '첫 메시지',
            createdAt: '2026-08-24T00:00:00Z',
          ),
        ],
      },
    );

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    expect(find.text('그룹: 개발팀'), findsOneWidget);
    expect(find.text('전체 채팅'), findsOneWidget);
    expect(find.text('잡담방'), findsOneWidget);
    expect(find.text('3'), findsOneWidget); // 안읽은 수 배지
    expect(find.text('첫 메시지'), findsOneWidget);
    expect(service.markedReadRoomIds, contains(1));
  });

  testWidgets('다른 방을 탭하면 그 방의 메시지를 불러온다', (tester) async {
    final rooms = [
      const ServerMessengerRoom(
        id: 1,
        roomType: 'group',
        name: '전체 채팅',
        groupName: '개발팀',
        lastMessageId: 1,
        lastReadMessageId: 0,
        unreadCount: 0,
        members: [],
      ),
      const ServerMessengerRoom(
        id: 2,
        roomType: 'group',
        name: '잡담방',
        groupName: '개발팀',
        lastMessageId: 0,
        lastReadMessageId: 0,
        unreadCount: 0,
        members: [],
      ),
    ];
    final service = _FakeMessengerService(
      settings: _configuredSettings(),
      rooms: rooms,
      groupName: '개발팀',
      messagesByRoom: {
        1: [
          const ServerMessengerMessage(
            id: 10,
            roomId: 1,
            senderOwnerId: 'cyhuh',
            senderDisplayName: '나',
            body: '방1 메시지',
            createdAt: '2026-08-24T00:00:00Z',
          ),
        ],
        2: [
          const ServerMessengerMessage(
            id: 20,
            roomId: 2,
            senderOwnerId: 'jane',
            senderDisplayName: '제인',
            body: '방2 메시지',
            createdAt: '2026-08-24T00:01:00Z',
          ),
        ],
      },
    );

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    expect(find.text('방1 메시지'), findsOneWidget);
    expect(find.text('방2 메시지'), findsNothing);

    await tester.tap(find.text('잡담방'));
    await tester.pumpAndSettle();

    expect(find.text('방2 메시지'), findsOneWidget);
    expect(find.text('방1 메시지'), findsNothing);
  });

  testWidgets('메시지를 입력하고 보내면 목록에 추가되고 입력창이 비워진다', (tester) async {
    final rooms = [
      const ServerMessengerRoom(
        id: 1,
        roomType: 'group',
        name: '전체 채팅',
        groupName: '개발팀',
        lastMessageId: 0,
        lastReadMessageId: 0,
        unreadCount: 0,
        members: [],
      ),
    ];
    final service = _FakeMessengerService(
      settings: _configuredSettings(),
      rooms: rooms,
      groupName: '개발팀',
    );

    await tester.pumpWidget(_wrap(service));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '안녕하세요');
    await tester.pump();
    await tester.tap(find.byIcon(Icons.send));
    await tester.pumpAndSettle();

    expect(service.sentBodies, ['안녕하세요']);
    expect(find.text('안녕하세요'), findsOneWidget);

    final textField = tester.widget<TextField>(find.byType(TextField));
    expect(textField.controller?.text, isEmpty);
  });
}
