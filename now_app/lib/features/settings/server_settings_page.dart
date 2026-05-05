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
  bool _enabled = false;
  bool _loaded = false;
  bool _busy = false;

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
    _loaded = true;
  }

  ServerSettings _currentSettings() {
    return ServerSettings(
      enabled: _enabled,
      baseUrl: _baseUrlCtrl.text,
      token: _tokenCtrl.text,
      deviceId: _deviceIdCtrl.text,
    );
  }

  Future<void> _save() async {
    final settings = _currentSettings();
    await settings.save();
    ref.invalidate(serverSettingsProvider);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('서버 설정을 저장했습니다')),
      );
    }
  }

  Future<void> _testConnection() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await settings.save();
      final result =
          await ref.read(serverSyncServiceProvider).testConnection(settings);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message),
            backgroundColor:
                result.ok ? const Color(0xFF059669) : const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _uploadNotes() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await settings.save();
      final result =
          await ref.read(serverSyncServiceProvider).uploadNotes(settings);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result.message)),
        );
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

  @override
  Widget build(BuildContext context) {
    final settingsAsync = ref.watch(serverSettingsProvider);
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon:
              const Icon(Icons.chevron_left, color: Color(0xFF111827), size: 28),
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
                      hintText: 'http://192.168.0.10:8080',
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
                    '현재는 일자별 메모와 계층 메모를 서버로 업로드합니다. 내려받기와 충돌 병합은 다음 단계에서 연결합니다.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: _busy ? null : _uploadNotes,
                      icon: _busy
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.cloud_upload_outlined, size: 18),
                      label: const Text('메모 서버 업로드'),
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
