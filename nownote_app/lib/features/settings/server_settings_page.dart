import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

import 'settings_providers.dart';

/// 서버 설정 화면.
///
/// Now의 `server_settings_page.dart`(약 1~148번째 줄) 중 서버 연결 부분만
/// 가져온다: 서버 주소, 사용자 ID, 기기 ID, 비밀번호+2단계 인증 코드로
/// 로그인(`createWebSession`), 연결 테스트(`testConnection`). 프로필 편집,
/// 분석 작업, 녹음 목록, 메모 전체 동기화는 NowNote 범위 밖이라 가져오지
/// 않는다.
///
/// 색상은 `Theme.of(context).colorScheme`을 쓴다 — NowNote는 다크 모드가
/// 기본 요구사항이다.
class ServerSettingsPage extends ConsumerStatefulWidget {
  const ServerSettingsPage({super.key});

  @override
  ConsumerState<ServerSettingsPage> createState() =>
      _ServerSettingsPageState();
}

class _ServerSettingsPageState extends ConsumerState<ServerSettingsPage> {
  final _baseUrlCtrl = TextEditingController();
  final _ownerIdCtrl = TextEditingController();
  final _deviceIdCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _twoFactorCodeCtrl = TextEditingController();

  bool _enabled = false;
  bool _loaded = false;
  bool _busy = false;
  String _userToken = '';
  String _webSessionToken = '';
  String _legacyToken = '';
  ServerConnectionResult? _connectionResult;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _baseUrlCtrl.dispose();
    _ownerIdCtrl.dispose();
    _deviceIdCtrl.dispose();
    _passwordCtrl.dispose();
    _twoFactorCodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final settings = await ref.read(serverSettingsServiceProvider).loadSettings();
    if (!mounted) return;
    setState(() {
      _enabled = settings.enabled;
      _baseUrlCtrl.text = settings.baseUrl;
      _ownerIdCtrl.text = settings.ownerId;
      _deviceIdCtrl.text = settings.deviceId;
      _userToken = settings.userToken;
      _webSessionToken = settings.webSessionToken;
      _legacyToken = settings.token;
      _loaded = true;
    });
  }

  ServerSettings _currentSettings() {
    return ServerSettings(
      enabled: _enabled,
      baseUrl: _baseUrlCtrl.text,
      token: _legacyToken,
      userToken: _userToken,
      webSessionToken: _webSessionToken,
      ownerId: _ownerIdCtrl.text,
      deviceId: _deviceIdCtrl.text,
      lastSyncedAt: null,
    );
  }

  Future<void> _save() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await ref.read(serverSettingsServiceProvider).saveSettings(settings);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('서버 설정을 저장했습니다')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _testConnection() async {
    setState(() => _busy = true);
    try {
      final service = ref.read(serverSettingsServiceProvider);
      final settings = _currentSettings();
      await service.saveSettings(settings);

      final probe = await service.probeConnection(settings);
      if (!probe.ok) {
        if (!mounted) return;
        setState(
          () => _connectionResult = ServerConnectionResult(
            ok: false,
            message: probe.message,
          ),
        );
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(probe.message),
            backgroundColor: Theme.of(context).colorScheme.errorContainer,
          ),
        );
        return;
      }
      if (probe.serverMismatch) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(probe.message),
            backgroundColor: Theme.of(context).colorScheme.tertiaryContainer,
          ),
        );
      }

      final result = await service.testConnection(
        settings,
        twoFactorCode: _twoFactorCodeCtrl.text,
      );
      if (result.ok) {
        final password = _passwordCtrl.text.trim();
        if (password.isNotEmpty) {
          final sessionSettings = await service.createWebSession(
            settings,
            password: password,
            twoFactorCode: _twoFactorCodeCtrl.text,
          );
          if (!mounted) return;
          setState(() {
            _webSessionToken = sessionSettings.webSessionToken;
            _passwordCtrl.clear();
          });
        }
      }
      if (!mounted) return;
      setState(() => _connectionResult = result);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message),
          backgroundColor: result.ok
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.errorContainer,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('연결 테스트 실패: $e'),
          backgroundColor: Theme.of(context).colorScheme.errorContainer,
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('서버 설정')),
      body: !_loaded
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _enabled,
                  onChanged: _busy
                      ? null
                      : (value) => setState(() => _enabled = value),
                  title: const Text('서버 동기화 사용'),
                  subtitle: const Text('꺼두면 이 기기 안에서만 사용합니다'),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _baseUrlCtrl,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: '서버 주소',
                    hintText: 'http://10.0.2.2:8750',
                    helperText: '포트 개방 없이 사설 네트워크(Tailscale 등)로 연결할 수 있습니다',
                    helperMaxLines: 2,
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _ownerIdCtrl,
                  decoration: const InputDecoration(
                    labelText: '사용자 ID',
                    hintText: 'local_user',
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
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordCtrl,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: '서버 비밀번호',
                    hintText: '메신저 세션 연결이 필요할 때 입력',
                    helperText: '연결 테스트 때만 사용하고 저장하지 않습니다',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _twoFactorCodeCtrl,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: const InputDecoration(
                    labelText: '2단계 인증 코드',
                    hintText: '필요한 경우 6자리 코드',
                    border: OutlineInputBorder(),
                    counterText: '',
                  ),
                ),
                if (_connectionResult != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _connectionResult!.ok
                          ? colorScheme.primaryContainer
                          : colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _connectionResult!.message,
                      style: TextStyle(
                        color: _connectionResult!.ok
                            ? colorScheme.onPrimaryContainer
                            : colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
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
              ],
            ),
    );
  }
}
