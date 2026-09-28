import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'messenger_providers.dart';
import 'messenger_safety_store.dart';

/// 메신저 화면.
///
/// Now의 그룹 메신저 화면(`now_app/lib/features/messenger/group_messenger_page.dart`)과
/// 같은 동작을 한다: 방 목록(가로 스크롤 chip), 메시지 목록(내 것은 오른쪽,
/// 남 것은 왼쪽), 5초 주기 자동 새로고침, 방 전환 시 재조회, 전송 후 목록
/// 전체 재조회, 보이는 메시지 읽음 처리, 서버 미설정/에러 상태 배너, 로딩
/// 스피너, 빈 상태 문구를 갖는다.
///
/// 다만 이 화면은 `context.push('/messenger')`로 들어오는 푸시 화면이라
/// `AppBottomNav` 같은 자체 탭 바를 넣지 않는다 — 기본 뒤로가기가 자동으로
/// 생긴다. 색상은 Now처럼 hex를 고정하지 않고 `Theme.of(context).colorScheme`을
/// 따른다 — NowNote는 다크 모드가 기본 요구사항이다.
class MessengerPage extends ConsumerStatefulWidget {
  const MessengerPage({super.key});

  @override
  ConsumerState<MessengerPage> createState() => _MessengerPageState();
}

class _MessengerPageState extends ConsumerState<MessengerPage> {
  static const _termsVersion = 1;
  final _messageCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  late final Future<MessengerSafetyStore> _safetyStore =
      SharedPreferences.getInstance().then(MessengerSafetyStore.new);
  Timer? _refreshTimer;
  ServerSettings? _settings;
  String _groupName = '';
  List<ServerMessengerRoom> _rooms = const [];
  List<ServerMessengerMessage> _messages = const [];
  Set<String> _blockedOwnerIds = const {};
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
      final service = ref.read(messengerServiceProvider);
      final settings = await service.loadSettings();
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
      final roomsResult = await service.loadRooms(settings);
      final blockedOwnerIds = await (await _safetyStore).blockedOwnerIds(
        settings,
      );
      final activeRoomId = _resolveActiveRoomId(
        roomsResult.rooms,
        preferredId: _activeRoomId,
      );
      List<ServerMessengerMessage> messages = const [];
      ServerMessengerRoom? loadedRoom;
      if (activeRoomId != null) {
        final messagesResult = await service.loadMessages(
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
        _blockedOwnerIds = blockedOwnerIds;
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
      final service = ref.read(messengerServiceProvider);
      final messagesResult = await service.loadMessages(
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
    if (settings == null || roomId == null || body.isEmpty || _sending) {
      return;
    }
    try {
      final safetyStore = await _safetyStore;
      if (!await safetyStore.hasAcceptedTerms(
        settings,
        version: _termsVersion,
      )) {
        if (!mounted) return;
        final accepted = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('메신저 이용규칙'),
            content: const SingleChildScrollView(
              child: Text(
                '메신저에서 괴롭힘, 위협, 불법 콘텐츠, 성적 착취물, 타인의 개인정보 무단 공유를 금지합니다. '
                '문제 메시지와 사용자를 신고하거나 차단할 수 있으며, 운영자는 신고를 검토해 메시지를 숨기거나 이용을 제한할 수 있습니다.',
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('취소'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('동의하고 보내기'),
              ),
            ],
          ),
        );
        if (accepted != true || !mounted) return;
        await safetyStore.acceptTerms(settings, version: _termsVersion);
      }
      if (!mounted) return;
      setState(() {
        _sending = true;
        _error = null;
      });
      final sent = await ref
          .read(messengerServiceProvider)
          .sendMessage(settings, roomId: roomId, body: body);
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
      await ref
          .read(messengerServiceProvider)
          .markRoomRead(settings, roomId: roomId, lastReadMessageId: latestId);
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
      return '메신저 세션이 필요합니다. 설정 > NowNote 서버에서 연결 테스트를 다시 실행하세요.';
    }
    return text;
  }

  Future<void> _blockUser(ServerMessengerMessage message) async {
    final settings = _settings;
    if (settings == null || message.senderOwnerId == settings.ownerId) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('사용자 차단'),
        content: Text('${message.senderDisplayName}님의 메시지를 이 기기에서 숨깁니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('차단'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await (await _safetyStore).blockOwner(settings, message.senderOwnerId);
    if (mounted) {
      setState(
        () => _blockedOwnerIds = {..._blockedOwnerIds, message.senderOwnerId},
      );
    }
  }

  void _showMessageActions(ServerMessengerMessage message) {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: const Text('메시지 신고'),
              onTap: () {
                Navigator.pop(sheetContext);
                _showReportDialog(message, 'message');
              },
            ),
            ListTile(
              leading: const Icon(Icons.person_off_outlined),
              title: const Text('사용자 신고'),
              onTap: () {
                Navigator.pop(sheetContext);
                _showReportDialog(message, 'user');
              },
            ),
            ListTile(
              leading: const Icon(Icons.block),
              title: const Text('사용자 차단'),
              onTap: () {
                Navigator.pop(sheetContext);
                _blockUser(message);
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showReportDialog(ServerMessengerMessage message, String target) {
    final settings = _settings;
    if (settings == null) return;
    showDialog<void>(
      context: context,
      builder: (_) => _ReportDialog(
        target: target,
        onSubmit: (reason, description) => ref
            .read(messengerServiceProvider)
            .reportMessage(
              settings,
              roomId: message.roomId,
              messageId: message.id,
              target: target,
              reason: reason,
              description: description,
            ),
      ),
    );
  }

  Future<void> _showBlockedUsers() async {
    final settings = _settings;
    if (settings == null) return;
    await showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ListTile(title: Text('차단 목록')),
            if (_blockedOwnerIds.isEmpty)
              const ListTile(title: Text('차단한 사용자가 없습니다')),
            for (final ownerId in _blockedOwnerIds.toList()..sort())
              ListTile(
                title: Text(ownerId),
                trailing: TextButton(
                  onPressed: () async {
                    await (await _safetyStore).unblockOwner(settings, ownerId);
                    if (!mounted) return;
                    setState(
                      () =>
                          _blockedOwnerIds = {..._blockedOwnerIds}
                            ..remove(ownerId),
                    );
                    if (sheetContext.mounted) {
                      Navigator.pop(sheetContext);
                    }
                  },
                  child: const Text('차단 해제'),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final visibleMessages = _messages
        .where((message) => !_blockedOwnerIds.contains(message.senderOwnerId))
        .toList();
    final activeRoom = _rooms
        .where((room) => room.id == _activeRoomId)
        .cast<ServerMessengerRoom?>()
        .firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('메신저'),
        actions: [
          IconButton(
            tooltip: '차단 목록',
            onPressed: _settings == null ? null : _showBlockedUsers,
            icon: const Icon(Icons.block),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _MessengerHeader(
              groupName: _groupName,
              rooms: _rooms,
              activeRoomId: _activeRoomId,
              showUnreadCounts: _blockedOwnerIds.isEmpty,
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
                  : visibleMessages.isEmpty
                  ? Center(
                      child: Text(
                        '아직 메시지가 없습니다',
                        style: TextStyle(
                          fontSize: 14,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                      ),
                    )
                  : ListView.builder(
                      controller: _scrollCtrl,
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                      itemCount: visibleMessages.length,
                      itemBuilder: (context, index) {
                        final message = visibleMessages[index];
                        final mine =
                            message.senderOwnerId == _settings?.ownerId;
                        return _MessageBubble(
                          message: message,
                          mine: mine,
                          onActions: mine
                              ? null
                              : () => _showMessageActions(message),
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
  final bool showUnreadCounts;
  final ValueChanged<ServerMessengerRoom> onRoomTap;

  const _MessengerHeader({
    required this.groupName,
    required this.rooms,
    required this.activeRoomId,
    required this.showUnreadCounts,
    required this.onRoomTap,
  });

  @override
  Widget build(BuildContext context) {
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            groupName.trim().isEmpty ? '그룹 확인 전' : '그룹: $groupName',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          if (rooms.isEmpty)
            Text(
              '참여 중인 채팅방이 없습니다',
              style: TextStyle(fontSize: 13, color: onSurfaceVariant),
            )
          else
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: rooms.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final room = rooms[index];
                  final selected = room.id == activeRoomId;
                  return ChoiceChip(
                    selected: selected,
                    label: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(room.name),
                        if (showUnreadCounts && room.unreadCount > 0) ...[
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
  final VoidCallback? onActions;

  const _MessageBubble({
    required this.message,
    required this.mine,
    this.onActions,
  });

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final align = mine ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final color = mine ? colorScheme.primary : colorScheme.surfaceContainerHigh;
    final textColor = mine ? colorScheme.onPrimary : colorScheme.onSurface;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Text(
            message.senderDisplayName.isEmpty
                ? message.senderOwnerId
                : message.senderDisplayName,
            style: TextStyle(fontSize: 11, color: colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 3),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              GestureDetector(
                onLongPress: onActions,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 270),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 9,
                  ),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(14),
                    border: mine
                        ? null
                        : Border.all(color: colorScheme.outlineVariant),
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
              ),
              if (onActions != null)
                IconButton(
                  tooltip: '메시지 옵션',
                  onPressed: onActions,
                  icon: const Icon(Icons.more_vert),
                ),
            ],
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
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        color: colorScheme.surface,
        border: Border(top: BorderSide(color: colorScheme.outlineVariant)),
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
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colorScheme.error),
      ),
      child: Text(
        message,
        style: TextStyle(
          fontSize: 13,
          color: colorScheme.onErrorContainer,
          height: 1.35,
        ),
      ),
    );
  }
}

class _ReportDialog extends StatefulWidget {
  const _ReportDialog({required this.target, required this.onSubmit});

  final String target;
  final Future<void> Function(String reason, String description) onSubmit;

  @override
  State<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<_ReportDialog> {
  final _descriptionCtrl = TextEditingController();
  String _reason = 'harassment';
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _descriptionCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.onSubmit(_reason, _descriptionCtrl.text.trim());
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.pop(context);
      messenger.showSnackBar(const SnackBar(content: Text('신고가 접수되었습니다')));
    } catch (error) {
      if (mounted) {
        setState(
          () => _error = error.toString().replaceFirst('Exception: ', ''),
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.target == 'user' ? '사용자 신고' : '메시지 신고'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _reason,
              decoration: const InputDecoration(labelText: '신고 사유'),
              items: const [
                DropdownMenuItem(value: 'harassment', child: Text('괴롭힘 또는 위협')),
                DropdownMenuItem(value: 'sexual', child: Text('성적 콘텐츠')),
                DropdownMenuItem(value: 'violence', child: Text('폭력')),
                DropdownMenuItem(value: 'other', child: Text('기타')),
              ],
              onChanged: _submitting
                  ? null
                  : (value) => setState(() => _reason = value ?? 'other'),
            ),
            TextField(
              controller: _descriptionCtrl,
              maxLength: 500,
              maxLines: 3,
              decoration: const InputDecoration(labelText: '추가 설명 (선택)'),
            ),
            if (_error != null)
              Text(
                _error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context),
          child: const Text('취소'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: const Text('신고 제출'),
        ),
      ],
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
