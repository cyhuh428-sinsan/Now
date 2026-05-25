import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../llm/services/llm_settings_service.dart';

final sttTierProvider = StateProvider<String>((ref) => 'tier1');

// ============================================================
// 음성 입력 설정 상세 페이지
// ============================================================

class VoiceSettingsPage extends ConsumerStatefulWidget {
  const VoiceSettingsPage({super.key});

  @override
  ConsumerState<VoiceSettingsPage> createState() => _VoiceSettingsPageState();
}

class _VoiceSettingsPageState extends ConsumerState<VoiceSettingsPage> {
  final _urlCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    LlmSettingsService().loadWhisperUrl().then((url) {
      if (mounted) setState(() => _urlCtrl.text = url);
    });
    LlmSettingsService().loadSttTier().then((tier) {
      if (mounted) ref.read(sttTierProvider.notifier).state = tier;
    });
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    super.dispose();
  }

  Future<void> _saveUrl() async {
    await LlmSettingsService().saveWhisperUrl(_urlCtrl.text.trim());
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Whisper 서버 URL이 저장됐어요')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final sttTier = ref.watch(sttTierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left, size: 28, color: Color(0xFF111827)),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          '음성 입력',
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
          const _SectionHeader(title: '음성 인식 방식'),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: [
                _SttOptionTile(
                  title: '기기 내 STT',
                  subtitle: '무료 · 오프라인 지원',
                  description: '기기에 내장된 음성 인식을 사용합니다.\n인터넷 없이도 동작하지만 정확도가 낮을 수 있습니다.',
                  value: 'tier1',
                  groupValue: sttTier,
                  isAvailable: true,
                  onChanged: (v) {
                    ref.read(sttTierProvider.notifier).state = v!;
                    LlmSettingsService().saveSttTier(v);
                  },
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14),
                  child: Divider(height: 1, color: Color(0xFFE5E7EB)),
                ),
                _SttOptionTile(
                  title: 'OpenAI Whisper API',
                  subtitle: '높은 정확도 · 유료',
                  description: 'OpenAI의 Whisper 모델을 사용합니다.\n높은 정확도를 제공하지만 API 비용이 발생합니다.',
                  value: 'tier2_whisper',
                  groupValue: sttTier,
                  isAvailable: false,
                  onChanged: (_) {},
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14),
                  child: Divider(height: 1, color: Color(0xFFE5E7EB)),
                ),
                _SttOptionTile(
                  title: 'Google STT API',
                  subtitle: '실시간 스트리밍 · 유료',
                  description: 'Google Cloud Speech-to-Text를 사용합니다.\n실시간 스트리밍을 지원합니다.',
                  value: 'tier2_google',
                  groupValue: sttTier,
                  isAvailable: false,
                  onChanged: (_) {},
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 14),
                  child: Divider(height: 1, color: Color(0xFFE5E7EB)),
                ),
                _SttOptionTile(
                  title: '로컬 Whisper 서버',
                  subtitle: '높은 정확도 · 무료',
                  description: '자체 설치한 Whisper 서버를 사용합니다.\n서버 URL을 입력하면 활성화됩니다.',
                  value: 'tier2_local',
                  groupValue: sttTier,
                  isAvailable: true,
                  onChanged: (v) {
                    if (v == null) return;
                    ref.read(sttTierProvider.notifier).state = v;
                    LlmSettingsService().saveSttTier(v);
                  },
                ),
                if (sttTier == 'tier2_local')
                  Padding(
                    padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('서버 URL',
                            style: TextStyle(fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF6B7280))),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _urlCtrl,
                          decoration: InputDecoration(
                            hintText: 'http://192.168.0.x:8000',
                            hintStyle: const TextStyle(
                                fontSize: 13, color: Color(0xFF9CA3AF)),
                            filled: true,
                            fillColor: const Color(0xFFF9FAFB),
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
                            enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
                            focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: const BorderSide(color: Color(0xFF2563EB))),
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                          ),
                          style: const TextStyle(fontSize: 13),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _saveUrl,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                            child: const Text('저장',
                                style: TextStyle(color: Colors.white, fontSize: 13)),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// STT 옵션 타일
// ============================================================

class _SttOptionTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String description;
  final String value;
  final String groupValue;
  final bool isAvailable;
  final ValueChanged<String?> onChanged;

  const _SttOptionTile({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.value,
    required this.groupValue,
    required this.isAvailable,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: isAvailable ? () => onChanged(value) : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Radio<String>(
              value: value,
              groupValue: groupValue,
              onChanged: isAvailable ? onChanged : null,
              activeColor: const Color(0xFF2563EB),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w500,
                          color: isAvailable
                              ? const Color(0xFF111827)
                              : const Color(0xFF9CA3AF),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isAvailable
                              ? const Color(0xFF10B981).withOpacity(0.1)
                              : const Color(0xFF6B7280).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          isAvailable ? subtitle : '준비 중',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: isAvailable
                                ? const Color(0xFF10B981)
                                : const Color(0xFF9CA3AF),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    isAvailable ? description : '$subtitle\n$description',
                    style: TextStyle(
                      fontSize: 12,
                      color: isAvailable
                          ? const Color(0xFF6B7280)
                          : const Color(0xFFD1D5DB),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

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
