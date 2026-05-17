import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../llm/providers/llm_providers.dart';
import '../../services/notification_service.dart';
import '../../services/backup_service.dart';
import '../../repositories/repository_providers.dart';

// ============================================================
// 설정 화면 — 현재값 요약만 표시, 상세는 각 페이지에서
// ============================================================

class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final llmConfig = ref.watch(llmConfigProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left, color: Color(0xFF111827), size: 28),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          '설정',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── 브리핑 알림 ──
          const _SectionHeader(title: '브리핑 알림'),
          const _BriefingNotificationCard(),
          const SizedBox(height: 20),

          // ── 음성 입력 ──
          const _SectionHeader(title: '음성 입력'),
          _SettingsCard(
            children: [
              _NavTile(
                icon: Icons.mic_outlined,
                iconColor: const Color(0xFF2563EB),
                title: '음성 입력',
                summary: '기기 내 STT',
                onTap: () => context.push('/settings/voice'),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── LLM 연동 ──
          const _SectionHeader(title: 'LLM 연동'),
          _SettingsCard(
            children: [
              _NavTile(
                icon: Icons.auto_awesome_outlined,
                iconColor: const Color(0xFF7C3AED),
                title: 'LLM 연동',
                summary: llmConfig.when(
                  data: (config) => config.provider.displayName,
                  loading: () => '...',
                  error: (_, __) => '미설정',
                ),
                onTap: () => context.push('/settings/llm'),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── 서버 동기화 ──
          const _SectionHeader(title: '서버 동기화'),
          _SettingsCard(
            children: [
              _NavTile(
                icon: Icons.cloud_outlined,
                iconColor: const Color(0xFF2563EB),
                title: 'NowNote 서버',
                summary: '동기화/녹음/분석',
                onTap: () => context.push('/settings/server'),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── 루틴 관리 ──
          const _SectionHeader(title: '루틴 관리'),
          _SettingsCard(
            children: [
              _NavTile(
                icon: Icons.repeat_outlined,
                iconColor: const Color(0xFF10B981),
                title: '루틴 관리',
                summary: '반복 알림 설정',
                onTap: () => context.push('/settings/routines'),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── 날씨 설정 ──
          const _SectionHeader(title: '날씨'),
          _SettingsCard(
            children: [
              _NavTile(
                icon: Icons.wb_sunny_outlined,
                iconColor: const Color(0xFF06B6D4),
                title: '날씨 설정',
                summary: 'OpenWeatherMap',
                onTap: () => context.push('/settings/weather'),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── 사용 안내 ──
          const _SectionHeader(title: '사용 안내'),
          _SettingsCard(
            children: [
              _NavTile(
                icon: Icons.help_outline,
                iconColor: const Color(0xFF6366F1),
                title: 'NowNote 사용 안내',
                summary: '로컬/서버 기준',
                onTap: () => context.push('/settings/help'),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // ── 기능별 사용 설정 ──
          const _SectionHeader(title: '기능별 사용 설정'),
          const _FeatureToggleCard(),
          const SizedBox(height: 20),

          // ── 데이터 관리 ──
          const _SectionHeader(title: '데이터 관리'),
          const _BackupCard(),
          const SizedBox(height: 20),

          // ── 앱 정보 ──
          const _SectionHeader(title: '앱 정보'),
          _SettingsCard(
            children: [
              const _InfoTile(
                icon: Icons.info_outline,
                title: '버전',
                trailing: Text(
                  '1.0.0 (1차)',
                  style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                ),
              ),
              const _Divider(),
              _InfoTile(
                icon: Icons.description_outlined,
                title: '오픈소스 라이센스',
                trailing: const Icon(Icons.arrow_forward_ios,
                    size: 14, color: Color(0xFF9CA3AF)),
                onTap: () => showLicensePage(context: context),
              ),
            ],
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ============================================================
// 기능별 사용 설정 카드
// ============================================================

class _FeatureToggleCard extends StatefulWidget {
  const _FeatureToggleCard();

  @override
  State<_FeatureToggleCard> createState() => _FeatureToggleCardState();
}

class _FeatureToggleCardState extends State<_FeatureToggleCard> {
  static const _speakerSeparationKey = 'feature_speaker_separation_enabled';
  static const _voiceEmotionKey = 'feature_voice_emotion_enabled';

  bool _loading = true;
  bool _speakerSeparation = false;
  bool _voiceEmotion = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _speakerSeparation = prefs.getBool(_speakerSeparationKey) ?? false;
      _voiceEmotion = prefs.getBool(_voiceEmotionKey) ?? false;
      _loading = false;
    });
  }

  Future<void> _save(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  @override
  Widget build(BuildContext context) {
    return _SettingsCard(
      children: [
        _FeatureSwitchTile(
          icon: Icons.people_outline,
          title: '화자 분리',
          subtitle: '회의와 대화 분석에서 사람별 발언 구분',
          value: _speakerSeparation,
          enabled: !_loading,
          onChanged: (value) {
            setState(() => _speakerSeparation = value);
            _save(_speakerSeparationKey, value);
          },
        ),
        const _Divider(),
        _FeatureSwitchTile(
          icon: Icons.emoji_emotions_outlined,
          title: '음성 감정 분석',
          subtitle: '음성 기록 분석에서 감정 단서 포함',
          value: _voiceEmotion,
          enabled: !_loading,
          onChanged: (value) {
            setState(() => _voiceEmotion = value);
            _save(_voiceEmotionKey, value);
          },
        ),
      ],
    );
  }
}

class _FeatureSwitchTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  const _FeatureSwitchTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      value: value,
      onChanged: enabled ? onChanged : null,
      secondary: Icon(icon, size: 20, color: const Color(0xFF6B7280)),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w500,
          color: Color(0xFF111827),
        ),
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
      ),
      activeThumbColor: const Color(0xFF2563EB),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
    );
  }
}

// ============================================================
// ============================================================
// 브리핑 알림 카드
// ============================================================

class _BriefingNotificationCard extends ConsumerWidget {
  const _BriefingNotificationCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(briefingSettingsProvider);
    return settingsAsync.when(
      data: (s) => _SettingsCard(
        children: [
          // ON/OFF 토글
          SwitchListTile(
            value: s.enabled,
            onChanged: (v) async {
              if (v) await NotificationService.requestPermission();
              ref.read(briefingSettingsProvider.notifier).saveSettings(enabled: v);
            },
            title: const Text('매일 아침 브리핑',
                style: TextStyle(fontSize: 15, color: Color(0xFF111827))),
            subtitle: Text(
              s.enabled ? '매일 ${s.hour.toString().padLeft(2, '0')}:${s.minute.toString().padLeft(2, '0')} 알림' : '알림 꺼짐',
              style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
            activeThumbColor: const Color(0xFF2563EB),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          ),
          // 시간 선택 (활성화 시만 표시)
          if (s.enabled) ...[
            const Divider(height: 1, indent: 16, endIndent: 16),
            ListTile(
              leading: const Icon(Icons.access_time_outlined,
                  color: Color(0xFF6B7280), size: 20),
              title: const Text('알림 시간',
                  style: TextStyle(fontSize: 15, color: Color(0xFF111827))),
              trailing: Text(
                '${s.hour.toString().padLeft(2, '0')}:${s.minute.toString().padLeft(2, '0')}',
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF2563EB)),
              ),
              onTap: () async {
                final picked = await showTimePicker(
                  context: context,
                  initialTime: TimeOfDay(hour: s.hour, minute: s.minute),
                  builder: (context, child) => MediaQuery(
                    data: MediaQuery.of(context)
                        .copyWith(alwaysUse24HourFormat: true),
                    child: child!,
                  ),
                );
                if (picked != null) {
                  ref.read(briefingSettingsProvider.notifier).saveSettings(
                        hour: picked.hour,
                        minute: picked.minute,
                      );
                }
              },
            ),
          ],
        ],
      ),
      loading: () => const _SettingsCard(children: [
        SizedBox(height: 60, child: Center(child: CircularProgressIndicator()))
      ]),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

// 섹션 헤더
// ============================================================

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFF6B7280),
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

// ============================================================
// 설정 카드 컨테이너
// ============================================================

class _SettingsCard extends StatelessWidget {
  final List<Widget> children;
  const _SettingsCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(children: children),
    );
  }
}

// ============================================================
// 이동형 타일 (현재값 요약 + >)
// ============================================================

class _NavTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String summary;
  final VoidCallback onTap;

  const _NavTile({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.summary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 18, color: iconColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF111827),
                ),
              ),
            ),
            Text(
              summary,
              style: const TextStyle(
                  fontSize: 13, color: Color(0xFF9CA3AF)),
            ),
            const SizedBox(width: 6),
            const Icon(Icons.arrow_forward_ios,
                size: 14, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 정보형 타일
// ============================================================

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _InfoTile({
    required this.icon,
    required this.title,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: const Color(0xFF6B7280)),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF111827),
                ),
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 14),
      child: Divider(height: 1, color: Color(0xFFE5E7EB)),
    );
  }
}

// ============================================================
// 데이터 백업/복원 카드
// ============================================================

class _BackupCard extends ConsumerStatefulWidget {
  const _BackupCard();
  @override
  ConsumerState<_BackupCard> createState() => _BackupCardState();
}

class _BackupCardState extends ConsumerState<_BackupCard> {
  bool _exporting = false;
  bool _importing = false;
  String _dbSize = '-';

  @override
  void initState() {
    super.initState();
    _loadDbSize();
  }

  Future<void> _loadDbSize() async {
    final size = await BackupService.dbFileSize();
    if (mounted) setState(() => _dbSize = size);
  }

  Future<void> _export() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      await BackupService.exportDb();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('내보내기 실패: $e'),
              backgroundColor: const Color(0xFFEF4444)),
        );
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _import() async {
    if (_importing) return;

    // 확인 다이얼로그
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('데이터 가져오기',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: const Text(
          '백업 파일로 복원하면 현재 데이터가 모두 교체됩니다.\n가져오기 후 앱이 종료되며 재시작이 필요합니다.\n\n계속하시겠습니까?',
          style: TextStyle(fontSize: 14),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소')),
          TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('가져오기',
                  style: TextStyle(color: Color(0xFFEF4444)))),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _importing = true);
    try {
      final db = ref.read(appDatabaseProvider);
      final success = await BackupService.importDb(db);
      if (!success) {
        setState(() => _importing = false);
        return;
      }
      // 가져오기 성공 → 앱 종료 안내
      if (mounted) {
        await showDialog(
          context: context,
          barrierDismissible: false,
          builder: (_) => AlertDialog(
            title: const Text('가져오기 완료',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            content: const Text(
              '백업 데이터를 성공적으로 가져왔습니다.\n앱을 종료합니다. 다시 실행해주세요.',
              style: TextStyle(fontSize: 14),
            ),
            actions: [
              TextButton(
                onPressed: () async {
                  Navigator.pop(context);
                  await BackupService.restartApp();
                },
                child: const Text('앱 종료',
                    style: TextStyle(color: Color(0xFF2563EB))),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('가져오기 실패: $e'),
              backgroundColor: const Color(0xFFEF4444)),
        );
        setState(() => _importing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SettingsCard(
      children: [
        // 내보내기
        InkWell(
          onTap: _export,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: _exporting
                      ? const Center(
                          child: SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFF2563EB))))
                      : const Icon(Icons.upload_outlined,
                          size: 18, color: Color(0xFF2563EB)),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('백업 내보내기',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF111827))),
                      Text('로컬 DB를 사용자가 선택한 위치에 저장합니다',
                          style: TextStyle(
                              fontSize: 12, color: Color(0xFF9CA3AF))),
                    ],
                  ),
                ),
                Text(_dbSize,
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF9CA3AF))),
                const SizedBox(width: 6),
                const Icon(Icons.arrow_forward_ios,
                    size: 14, color: Color(0xFF9CA3AF)),
              ],
            ),
          ),
        ),
        const _Divider(),
        // 가져오기
        InkWell(
          onTap: _import,
          borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: const Color(0xFF059669).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: _importing
                      ? const Center(
                          child: SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFF059669))))
                      : const Icon(Icons.download_outlined,
                          size: 18, color: Color(0xFF059669)),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('백업 가져오기',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF111827))),
                      Text('현재 데이터를 .db 백업 파일로 교체합니다',
                          style: TextStyle(
                              fontSize: 12, color: Color(0xFF9CA3AF))),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_ios,
                    size: 14, color: Color(0xFF9CA3AF)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
