import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/server_sync_service.dart';

class ServerSettingsPage extends ConsumerStatefulWidget {
  const ServerSettingsPage({super.key});

  @override
  ConsumerState<ServerSettingsPage> createState() => _ServerSettingsPageState();
}

class _ServerSettingsPageState extends ConsumerState<ServerSettingsPage> {
  final _baseUrlCtrl = TextEditingController();
  final _tokenCtrl = TextEditingController();
  final _deviceIdCtrl = TextEditingController();
  DateTime? _lastSyncedAt;
  bool _enabled = false;
  bool _loaded = false;
  bool _busy = false;
  ServerConnectionResult? _connectionResult;
  ServerOpsResult? _opsResult;

  @override
  void dispose() {
    _baseUrlCtrl.dispose();
    _tokenCtrl.dispose();
    _deviceIdCtrl.dispose();
    super.dispose();
  }

  void _applySettings(ServerSettings settings) {
    if (_loaded) return;
    _enabled = settings.enabled;
    _baseUrlCtrl.text = settings.baseUrl;
    _tokenCtrl.text = settings.token;
    _deviceIdCtrl.text = settings.deviceId;
    _lastSyncedAt = settings.lastSyncedAt;
    _loaded = true;
  }

  ServerSettings _currentSettings() {
    return ServerSettings(
      enabled: _enabled,
      baseUrl: _baseUrlCtrl.text,
      token: _tokenCtrl.text,
      deviceId: _deviceIdCtrl.text,
      lastSyncedAt: _lastSyncedAt,
    );
  }

  Future<void> _save() async {
    final settings = _currentSettings();
    await settings.save();
    ref.invalidate(serverSettingsProvider);
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('서버 설정을 저장했습니다')));
    }
  }

  Future<void> _testConnection() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await settings.save();
      final result = await ref
          .read(serverSyncServiceProvider)
          .testConnection(settings);
      ServerOpsResult? opsResult;
      if (result.ok) {
        opsResult = await ref
            .read(serverSyncServiceProvider)
            .loadOpsStatus(settings);
      }
      if (mounted) {
        setState(() {
          _connectionResult = result;
          _opsResult = opsResult;
          _lastSyncedAt = settings.lastSyncedAt;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message),
            backgroundColor: result.ok
                ? const Color(0xFF059669)
                : const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _syncNotes({required bool fullSync}) async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings().copyWith(clearLastSyncedAt: fullSync);
      await settings.save();

      final result = await ref
          .read(serverSyncServiceProvider)
          .syncNotes(settings, fullSync: fullSync);

      if (mounted) {
        _lastSyncedAt = result.syncedAt ?? settings.lastSyncedAt;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(result.message)));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('동기화 실패: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmFullSync() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('전체 다시 동기화'),
        content: const Text('서버에 메모 전체를 다시 전송하고 마지막 동기화 시점을 초기화합니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('진행'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _syncNotes(fullSync: true);
    }
  }

  String _formatServerSyncTime(DateTime? value) {
    if (value == null) return '없음';
    final local = value.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}:${local.second.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(serverSettingsProvider);
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.chevron_left,
            color: Color(0xFF111827),
            size: 28,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'NowNote 서버',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: settingsAsync.when(
        data: (settings) {
          _applySettings(settings);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _ServerCard(
                children: [
                  SwitchListTile(
                    value: _enabled,
                    onChanged: _busy
                        ? null
                        : (value) => setState(() => _enabled = value),
                    title: const Text('서버 동기화 사용'),
                    subtitle: const Text('꺼두면 기기 로컬에서만 사용합니다'),
                    activeThumbColor: const Color(0xFF2563EB),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _ServerCard(
                padding: const EdgeInsets.all(16),
                children: [
                  TextField(
                    controller: _baseUrlCtrl,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: '서버 주소',
                      hintText: 'http://10.0.2.2:8750',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _tokenCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'API 토큰',
                      hintText: '서버 NOW_API_TOKEN 값',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _deviceIdCtrl,
                    decoration: const InputDecoration(
                      labelText: '기기 ID',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
              if (_connectionResult != null || _opsResult != null) ...[
                const SizedBox(height: 14),
                _ServerStatusCard(
                  connectionResult: _connectionResult,
                  opsResult: _opsResult,
                ),
              ],
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _testConnection,
                      icon: const Icon(Icons.wifi_tethering, size: 18),
                      label: const Text('연결 테스트'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _busy ? null : _save,
                      icon: const Icon(Icons.save_outlined, size: 18),
                      label: const Text('저장'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              _ServerCard(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    '메모 동기화',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '일자별 메모와 계층 메모를 서버와 통합 동기화합니다. 마지막 동기화 기준으로 증분 동기화를 진행하고, 필요한 경우 전체 동기화를 선택하세요.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _busy
                              ? null
                              : () => _syncNotes(fullSync: false),
                          icon: _busy
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(
                                  Icons.cloud_upload_outlined,
                                  size: 18,
                                ),
                          label: const Text('메모 동기화'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : _confirmFullSync,
                          icon: const Icon(Icons.refresh_outlined, size: 18),
                          label: const Text('전체 다시 동기화'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '마지막 동기화: ${_formatServerSyncTime(_lastSyncedAt)}',
                    style: const TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('설정 로드 실패: $e')),
      ),
    );
  }
}

class _ServerCard extends StatelessWidget {
  final List<Widget> children;
  final EdgeInsetsGeometry? padding;

  const _ServerCard({required this.children, this.padding});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    );
  }
}

class _ServerStatusCard extends StatelessWidget {
  final ServerConnectionResult? connectionResult;
  final ServerOpsResult? opsResult;

  const _ServerStatusCard({
    required this.connectionResult,
    required this.opsResult,
  });

  @override
  Widget build(BuildContext context) {
    final connection = connectionResult;
    final ops = opsResult;
    final color = _statusColor(connection?.ok == true ? ops?.status : 'bad');
    return _ServerCard(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          children: [
            Icon(
              connection?.ok == true
                  ? Icons.cloud_done_outlined
                  : Icons.cloud_off_outlined,
              size: 20,
              color: color,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                connection?.message ?? '연결 테스트 전',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF111827),
                ),
              ),
            ),
          ],
        ),
        if (ops != null) ...[
          const SizedBox(height: 12),
          Text(
            ops.message,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 8),
          ...ops.checks.take(4).map((check) {
            final status = check['status']?.toString() ?? 'info';
            return Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    margin: const EdgeInsets.only(top: 6, right: 8),
                    decoration: BoxDecoration(
                      color: _statusColor(status),
                      shape: BoxShape.circle,
                    ),
                  ),
                  Expanded(
                    child: Text(
                      '${check['name'] ?? '-'} · ${check['message'] ?? ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ],
    );
  }

  Color _statusColor(String? status) {
    if (status == 'ok') return const Color(0xFF059669);
    if (status == 'bad') return const Color(0xFFEF4444);
    if (status == 'warn') return const Color(0xFFD97706);
    return const Color(0xFF6366F1);
  }
}
