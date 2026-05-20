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
  final _userTokenCtrl = TextEditingController();
  final _twoFactorCodeCtrl = TextEditingController();
  final _ownerIdCtrl = TextEditingController();
  final _deviceIdCtrl = TextEditingController();
  final _displayNameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _timezoneCtrl = TextEditingController(text: 'Asia/Seoul');
  DateTime? _lastSyncedAt;
  bool _enabled = false;
  bool _loaded = false;
  bool _busy = false;
  ServerConnectionResult? _connectionResult;
  ServerOpsResult? _opsResult;
  ServerUserProfile? _profile;
  List<ServerAnalysisJob> _analysisJobs = const [];
  List<ServerRecording> _recordings = const [];

  @override
  void dispose() {
    _baseUrlCtrl.dispose();
    _tokenCtrl.dispose();
    _userTokenCtrl.dispose();
    _twoFactorCodeCtrl.dispose();
    _ownerIdCtrl.dispose();
    _deviceIdCtrl.dispose();
    _displayNameCtrl.dispose();
    _emailCtrl.dispose();
    _timezoneCtrl.dispose();
    super.dispose();
  }

  void _applySettings(ServerSettings settings) {
    if (_loaded) return;
    _enabled = settings.enabled;
    _baseUrlCtrl.text = settings.baseUrl;
    _tokenCtrl.text = settings.token;
    _userTokenCtrl.text = settings.userToken;
    _ownerIdCtrl.text = settings.ownerId;
    _deviceIdCtrl.text = settings.deviceId;
    if (_timezoneCtrl.text.trim().isEmpty) {
      _timezoneCtrl.text = 'Asia/Seoul';
    }
    _lastSyncedAt = settings.lastSyncedAt;
    _loaded = true;
  }

  ServerSettings _currentSettings() {
    return ServerSettings(
      enabled: _enabled,
      baseUrl: _baseUrlCtrl.text,
      token: _tokenCtrl.text,
      userToken: _userTokenCtrl.text,
      ownerId: _ownerIdCtrl.text,
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
          .testConnection(
            settings,
            twoFactorCode: _twoFactorCodeCtrl.text,
          );
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

  Future<void> _loadProfile() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await settings.save();
      final profile = await ref
          .read(serverSyncServiceProvider)
          .loadUserProfile(settings);
      if (mounted) {
        setState(() {
          _profile = profile;
          _displayNameCtrl.text = profile.displayName ?? '';
          _emailCtrl.text = profile.email ?? '';
          _timezoneCtrl.text = profile.timezone;
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('사용자 프로필을 불러왔습니다')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('프로필 조회 실패: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await settings.save();
      final profile = await ref
          .read(serverSyncServiceProvider)
          .saveUserProfile(
            settings,
            email: _emailCtrl.text,
            displayName: _displayNameCtrl.text,
            timezone: _timezoneCtrl.text,
          );
      if (mounted) {
        setState(() {
          _profile = profile;
          _displayNameCtrl.text = profile.displayName ?? '';
          _emailCtrl.text = profile.email ?? '';
          _timezoneCtrl.text = profile.timezone;
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('사용자 프로필을 저장했습니다')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('프로필 저장 실패: $e'),
            backgroundColor: const Color(0xFFEF4444),
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

  Future<void> _refreshAnalysisJobs() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await settings.save();
      final jobs = await ref
          .read(serverSyncServiceProvider)
          .loadAnalysisJobs(settings);
      if (mounted) {
        setState(() => _analysisJobs = jobs.take(5).toList());
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('분석 작업을 불러왔습니다')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('분석 작업 조회 실패: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createAnalysisJob() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await settings.save();
      final job = await ref
          .read(serverSyncServiceProvider)
          .createAnalysisJob(
            settings,
            jobType: 'daily_briefing',
            inputText: 'NowNote 모바일 앱 서버 분석 연결 점검',
          );
      if (mounted) {
        setState(
          () => _analysisJobs = [job, ..._analysisJobs].take(5).toList(),
        );
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('분석 작업을 등록했습니다')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('분석 작업 등록 실패: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refreshRecordings() async {
    setState(() => _busy = true);
    try {
      final settings = _currentSettings();
      await settings.save();
      final recordings = await ref
          .read(serverSyncServiceProvider)
          .loadRecordings(settings);
      if (mounted) {
        setState(() => _recordings = recordings.take(5).toList());
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('서버 녹음 목록을 불러왔습니다')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('녹음 목록 조회 실패: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _formatServerSyncTime(DateTime? value) {
    if (value == null) return '없음';
    final local = value.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}:${local.second.toString().padLeft(2, '0')}';
  }

  String _profileSummary(ServerUserProfile profile) {
    final twoFactor = profile.twoFactorEnabled ? '2단계 사용' : '2단계 미사용';
    final active = profile.isActive ? '활성' : '비활성';
    final lastSeen = profile.lastSeenAt == null
        ? '접속 기록 없음'
        : profile.lastSeenAt!;
    return '그룹 ${profile.groupName} · $twoFactor · $active · 최근 접속 $lastSeen';
  }

  String _profileOwnerIdText() {
    final ownerId = _ownerIdCtrl.text.trim();
    return ownerId.isEmpty ? 'local_user' : ownerId;
  }

  String _formatAnalysisTime(String? value) {
    final parsed = DateTime.tryParse(value ?? '');
    if (parsed == null) return '-';
    final local = parsed.toLocal();
    return '${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }

  String _formatServerTimeText(String? value) {
    final parsed = DateTime.tryParse(value ?? '');
    if (parsed == null) return '-';
    final local = parsed.toLocal();
    return '${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
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
                  const Text(
                    '서버 녹음',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '서버에 저장된 최근 녹음 파일을 확인합니다. 회의/대화/메모와 계층 메모에서 업로드된 원본 녹음의 상태 점검용입니다.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_recordings.isEmpty)
                    const Text(
                      '서버 녹음 목록을 불러오지 않았습니다.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    )
                  else
                    ..._recordings.map(
                      (recording) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _RecordingTile(
                          recording: recording,
                          timeText: _formatServerTimeText(recording.updatedAt),
                        ),
                      ),
                    ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _refreshRecordings,
                      icon: const Icon(Icons.graphic_eq_outlined, size: 18),
                      label: const Text('녹음 목록 새로고침'),
                    ),
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
                      helperText: '기기 보안 저장소에 저장합니다',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _userTokenCtrl,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: '사용자별 접속 토큰',
                      hintText: '공용 서버에서 발급한 사용자 토큰',
                      helperText: '공용 서버가 요구할 때 입력합니다. 기기 보안 저장소에 저장합니다',
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
                      helperText: '2단계 인증 사용자는 연결 테스트 때 입력합니다',
                      border: OutlineInputBorder(),
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _ownerIdCtrl,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      labelText: '사용자 ID',
                      hintText: 'local_user',
                      helperText: '서버에서 메모 소유자를 구분하는 값입니다',
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
              _ServerCard(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    '사용자 프로필',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '사용자 ID: ${_profileOwnerIdText()}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _displayNameCtrl,
                    decoration: const InputDecoration(
                      labelText: '표시 이름',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: '이메일',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _timezoneCtrl,
                    decoration: const InputDecoration(
                      labelText: '시간대',
                      hintText: 'Asia/Seoul',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_profile != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      _profileSummary(_profile!),
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: Color(0xFF6B7280),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : _loadProfile,
                          icon: const Icon(
                            Icons.person_search_outlined,
                            size: 18,
                          ),
                          label: const Text('불러오기'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _busy ? null : _saveProfile,
                          icon: const Icon(
                            Icons.manage_accounts_outlined,
                            size: 18,
                          ),
                          label: const Text('프로필 저장'),
                        ),
                      ),
                    ],
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
              const SizedBox(height: 14),
              _ServerCard(
                padding: const EdgeInsets.all(16),
                children: [
                  const Text(
                    '분석 작업',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    '서버 분석 큐의 최근 작업 상태를 확인합니다. 계층 메모 화면에서 선택 메모 분석을 등록할 수 있습니다.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_analysisJobs.isEmpty)
                    const Text(
                      '분석 작업을 불러오지 않았습니다.',
                      style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                    )
                  else
                    ..._analysisJobs.map(
                      (job) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _AnalysisJobTile(
                          job: job,
                          timeText: _formatAnalysisTime(job.updatedAt),
                          onTap: () => _showAnalysisJobDetail(context, job),
                        ),
                      ),
                    ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _busy ? null : _createAnalysisJob,
                          icon: const Icon(
                            Icons.auto_awesome_outlined,
                            size: 18,
                          ),
                          label: const Text('점검 작업 등록'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : _refreshAnalysisJobs,
                          icon: const Icon(Icons.refresh_outlined, size: 18),
                          label: const Text('작업 새로고침'),
                        ),
                      ),
                    ],
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

void _showAnalysisJobDetail(BuildContext context, ServerAnalysisJob job) {
  final resultText = job.resultJson?.trim().isNotEmpty == true
      ? job.resultJson!.trim()
      : job.resultPreview;
  showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('분석 작업 #${job.id}'),
      content: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _AnalysisDetailLine(label: '작업', value: job.jobType),
            _AnalysisDetailLine(label: '상태', value: job.status),
            _AnalysisDetailLine(
              label: '메모',
              value: job.noteLocalId ?? '연결 없음',
            ),
            const SizedBox(height: 12),
            Text(
              resultText,
              style: const TextStyle(
                fontSize: 13,
                height: 1.45,
                color: Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('닫기'),
        ),
      ],
    ),
  );
}

class _AnalysisDetailLine extends StatelessWidget {
  final String label;
  final String value;

  const _AnalysisDetailLine({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 42,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6B7280),
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF111827),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RecordingTile extends StatelessWidget {
  final ServerRecording recording;
  final String timeText;

  const _RecordingTile({required this.recording, required this.timeText});

  @override
  Widget build(BuildContext context) {
    final statusColor = recording.hasTranscript
        ? const Color(0xFF059669)
        : const Color(0xFFD97706);
    final statusText = recording.hasTranscript ? '텍스트 있음' : '원본만';
    final noteText = recording.noteLocalId?.trim().isEmpty == false
        ? recording.noteLocalId!
        : '연결 메모 없음';

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Icon(Icons.mic_none_outlined, size: 18, color: statusColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  recording.fileName.isEmpty
                      ? recording.localId
                      : recording.fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${recording.deviceId} · $noteText · $timeText',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF6B7280),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              statusText,
              style: TextStyle(
                color: statusColor,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AnalysisJobTile extends StatelessWidget {
  final ServerAnalysisJob job;
  final String timeText;
  final VoidCallback onTap;

  const _AnalysisJobTile({
    required this.job,
    required this.timeText,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(job.status);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFF9FAFB),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '#${job.id} · ${job.jobType} · $timeText',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    job.resultPreview,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      height: 1.3,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    job.noteLocalId ?? '메모 연결 없음',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 5,
              ),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                job.status,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    if (status == 'done') return const Color(0xFF059669);
    if (status == 'failed') return const Color(0xFFEF4444);
    if (status == 'running' || status == 'queued') {
      return const Color(0xFFD97706);
    }
    return const Color(0xFF6366F1);
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
          if (connection?.publicReadiness?.summary.isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              connection!.publicReadiness!.summary,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6B7280),
              ),
            ),
          ],
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
