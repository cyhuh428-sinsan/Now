import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/server_sync_service.dart';
import '../../widgets/app_bottom_nav.dart';

class GroupMessengerPage extends ConsumerStatefulWidget {
  const GroupMessengerPage({super.key});

  @override
  ConsumerState<GroupMessengerPage> createState() => _GroupMessengerPageState();
}

class _GroupMessengerPageState extends ConsumerState<GroupMessengerPage> {
  final _messageCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  Timer? _refreshTimer;
  ServerSettings? _settings;
  String _groupName = '';
  List<ServerMessengerRoom> _rooms = const [];
  List<ServerMessengerMessage> _messages = const [];
  int? _activeRoomId;
  bool _loading = true;
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAll();
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _refreshMessages(silent: true),
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _messageCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final settings = await ServerSettings.load();
      if (!settings.isConfigured) {
        setState(() {
          _settings = settings;
          _rooms = const [];
          _messages = const [];
          _loading = false;
          _error = '서버 설정이 필요합니다';
        });
        return;
      }
      final service = ref.read(serverSyncServiceProvider);
      final roomsResult = await service.loadMessengerRooms(settings);
      final activeRoomId = _resolveActiveRoomId(
        roomsResult.rooms,
        preferredId: _activeRoomId,
      );
      List<ServerMessengerMessage> messages = const [];
      ServerMessengerRoom? loadedRoom;
      if (activeRoomId != null) {
        final messagesResult = await service.loadMessengerMessages(
          settings,
          roomId: activeRoomId,
        );
        loadedRoom = messagesResult.room;
        messages = messagesResult.items;
      }
      if (!mounted) return;
      setState(() {
        _settings = settings;
        _groupName = roomsResult.groupName;
        _rooms = _mergeLoadedRoom(roomsResult.rooms, loadedRoom);
        _activeRoomId = activeRoomId;
        _messages = messages;
        _loading = false;
        _error = null;
      });
      await _markVisibleRead();
      _scrollToBottom();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = _friendlyError(e);
      });
    }
  }

  Future<void> _refreshMessages({bool silent = false}) async {
    final settings = _settings;
    final roomId = _activeRoomId;
    if (settings == null || roomId == null || _sending) return;
    try {
      final service = ref.read(serverSyncServiceProvider);
      final messagesResult = await service.loadMessengerMessages(
        settings,
        roomId: roomId,
      );
      if (!mounted) return;
      setState(() {
        _messages = messagesResult.items;
        if (messagesResult.room != null) {
          _rooms = _mergeLoadedRoom(_rooms, messagesResult.room);
        }
        if (!silent) _error = null;
      });
      await _markVisibleRead();
      _scrollToBottom();
    } catch (e) {
      if (!silent && mounted) {
        setState(() => _error = _friendlyError(e));
      }
    }
  }

  Future<void> _selectRoom(ServerMessengerRoom room) async {
    if (_activeRoomId == room.id) return;
    setState(() {
      _activeRoomId = room.id;
      _messages = const [];
      _loading = true;
      _error = null;
    });
    await _refreshMessages();
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _sendMessage() async {
    final settings = _settings;
    final roomId = _activeRoomId;
    final body = _messageCtrl.text.trim();
    if (settings == null || roomId == null || body.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      final sent = await ref.read(serverSyncServiceProvider).sendMessengerMessage(
            settings,
            roomId: roomId,
            body: body,
          );
      if (!mounted) return;
      _messageCtrl.clear();
      setState(() {
        _messages = [..._messages, sent];
      });
      await _loadAll();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = _friendlyError(e));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _markVisibleRead() async {
    final settings = _settings;
    final roomId = _activeRoomId;
    if (settings == null || roomId == null || _messages.isEmpty) return;
    final latestId = _messages
        .map((message) => message.id)
        .fold<int>(0, (max, id) => id > max ? id : max);
    if (latestId <= 0) return;
    try {
      await ref.read(serverSyncServiceProvider).markMessengerRoomRead(
            settings,
            roomId: roomId,
            lastReadMessageId: latestId,
          );
    } catch (_) {
      // 읽음 처리는 부가 상태라 화면 사용을 막지 않는다.
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollCtrl.hasClients) return;
      _scrollCtrl.animateTo(
        _scrollCtrl.position.maxScrollExtent,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
      );
    });
  }

  int? _resolveActiveRoomId(
    List<ServerMessengerRoom> rooms, {
    required int? preferredId,
  }) {
    if (rooms.isEmpty) return null;
    if (preferredId != null && rooms.any((room) => room.id == preferredId)) {
      return preferredId;
    }
    return rooms.first.id;
  }

  List<ServerMessengerRoom> _mergeLoadedRoom(
    List<ServerMessengerRoom> rooms,
    ServerMessengerRoom? loadedRoom,
  ) {
    if (loadedRoom == null) return rooms;
    return rooms
        .map((room) => room.id == loadedRoom.id ? loadedRoom : room)
        .toList();
  }

  String _friendlyError(Object error) {
    final text = error.toString().replaceFirst('Exception: ', '');
    if (text.contains('web session required') ||
        text.contains('invalid web session')) {
      return '메신저 세션이 필요합니다. 서버 설정의 앱/설치형 접속 토큰을 확인하세요.';
    }
    return text;
  }

  @override
  Widget build(BuildContext context) {
    final activeRoom = _rooms
        .where((room) => room.id == _activeRoomId)
        .cast<ServerMessengerRoom?>()
        .firstOrNull;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        title: const Text(
          '그룹 메신저',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
        actions: [
          IconButton(
            tooltip: '새로고침',
            icon: const Icon(Icons.refresh),
            onPressed: _loadAll,
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(selectedIndex: 4),
      body: SafeArea(
        child: Column(
          children: [
            _MessengerHeader(
              groupName: _groupName,
              rooms: _rooms,
              activeRoomId: _activeRoomId,
              onRoomTap: _selectRoom,
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                child: _ErrorBanner(message: _error!),
              ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _messages.isEmpty
                      ? const Center(
                          child: Text(
                            '아직 메시지가 없습니다',
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF9CA3AF),
                            ),
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollCtrl,
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) {
                            final message = _messages[index];
                            final mine =
                                message.senderOwnerId == _settings?.ownerId;
                            return _MessageBubble(
                              message: message,
                              mine: mine,
                            );
                          },
                        ),
            ),
            _Composer(
              controller: _messageCtrl,
              enabled: activeRoom != null && !_sending,
              sending: _sending,
              onSend: _sendMessage,
            ),
          ],
        ),
      ),
    );
  }
}

class _MessengerHeader extends StatelessWidget {
  final String groupName;
  final List<ServerMessengerRoom> rooms;
  final int? activeRoomId;
  final ValueChanged<ServerMessengerRoom> onRoomTap;

  const _MessengerHeader({
    required this.groupName,
    required this.rooms,
    required this.activeRoomId,
    required this.onRoomTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            groupName.trim().isEmpty ? '그룹 확인 전' : '그룹: $groupName',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF6B7280),
            ),
          ),
          const SizedBox(height: 8),
          if (rooms.isEmpty)
            const Text(
              '참여 중인 채팅방이 없습니다',
              style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
            )
          else
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: rooms.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final room = rooms[index];
                  final selected = room.id == activeRoomId;
                  return ChoiceChip(
                    selected: selected,
                    label: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(room.name),
                        if (room.unreadCount > 0) ...[
                          const SizedBox(width: 6),
                          Text('${room.unreadCount}'),
                        ],
                      ],
                    ),
                    onSelected: (_) => onRoomTap(room),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final ServerMessengerMessage message;
  final bool mine;

  const _MessageBubble({required this.message, required this.mine});

  @override
  Widget build(BuildContext context) {
    final align = mine ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final color = mine ? const Color(0xFF2563EB) : Colors.white;
    final textColor = mine ? Colors.white : const Color(0xFF111827);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Text(
            message.senderDisplayName.isEmpty
                ? message.senderOwnerId
                : message.senderDisplayName,
            style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
          ),
          const SizedBox(height: 3),
          Container(
            constraints: const BoxConstraints(maxWidth: 300),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(14),
              border: mine
                  ? null
                  : Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Text(
              message.body,
              style: TextStyle(
                fontSize: 14,
                height: 1.4,
                color: textColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  final TextEditingController controller;
  final bool enabled;
  final bool sending;
  final VoidCallback onSend;

  const _Composer({
    required this.controller,
    required this.enabled,
    required this.sending,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              minLines: 1,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: enabled ? '그룹원에게 보낼 메시지' : '메신저를 사용할 수 없습니다',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                isDense: true,
              ),
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            tooltip: '보내기',
            onPressed: enabled && !sending ? onSend : null,
            icon: sending
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.send),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;

  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Text(
        message,
        style: const TextStyle(
          fontSize: 13,
          color: Color(0xFF991B1B),
          height: 1.35,
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
