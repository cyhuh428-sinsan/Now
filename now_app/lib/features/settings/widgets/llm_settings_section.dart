import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../llm/models/llm_config.dart';
import '../../../llm/services/llm_settings_service.dart';
import '../../../llm/providers/llm_providers.dart';

/// settings_page.dart 에서 import 후 ListView children에 삽입
/// 예:
///   const _SectionHeader(title: 'LLM 연동'),
///   const LlmSettingsSection(),

class LlmSettingsSection extends ConsumerStatefulWidget {
  const LlmSettingsSection({super.key});

  @override
  ConsumerState<LlmSettingsSection> createState() =>
      _LlmSettingsSectionState();
}

class _LlmSettingsSectionState extends ConsumerState<LlmSettingsSection> {
  LlmProvider _selectedProvider = LlmProvider.groq;
  final Map<LlmProvider, TextEditingController> _apiKeyControllers = {};
  final _ollamaUrlCtrl = TextEditingController();
  final _ollamaModelCtrl = TextEditingController();
  bool _isLoaded = false;
  bool _isTesting = false;
  String? _testResult;

  @override
  void initState() {
    super.initState();
    for (final p in LlmProvider.values) {
      _apiKeyControllers[p] = TextEditingController();
    }
    _loadSettings();
  }

  @override
  void dispose() {
    for (final c in _apiKeyControllers.values) {
      c.dispose();
    }
    _ollamaUrlCtrl.dispose();
    _ollamaModelCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    final service = ref.read(llmSettingsServiceProvider);
    final config = await service.loadConfig();
    if (!mounted) return;
    setState(() {
      _selectedProvider = config.provider;
      _ollamaUrlCtrl.text = config.ollamaUrl;
      _ollamaModelCtrl.text = config.ollamaModel;
      _isLoaded = true;
    });
    // 현재 선택된 LLM의 API Key만 로드
    final apiKey = await service.loadApiKey(config.provider);
    if (mounted) {
      _apiKeyControllers[config.provider]?.text = apiKey;
    }
  }

  Future<void> _saveProvider(LlmProvider provider) async {
    final service = ref.read(llmSettingsServiceProvider);
    await service.saveProvider(provider);
    // 해당 provider의 API Key 로드
    final apiKey = await service.loadApiKey(provider);
    if (mounted) {
      _apiKeyControllers[provider]?.text = apiKey;
    }
    ref.invalidate(llmConfigProvider);
  }

  Future<void> _saveApiKey() async {
    final service = ref.read(llmSettingsServiceProvider);
    if (_selectedProvider == LlmProvider.ollama) {
      await service.saveOllamaSettings(
        url: _ollamaUrlCtrl.text.trim(),
        model: _ollamaModelCtrl.text.trim(),
      );
    } else {
      await service.saveApiKey(
        _selectedProvider,
        _apiKeyControllers[_selectedProvider]?.text.trim() ?? '',
      );
    }
    ref.invalidate(llmConfigProvider);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장되었습니다')),
      );
    }
  }

  Future<void> _testConnection() async {
    await _saveApiKey();
    setState(() {
      _isTesting = true;
      _testResult = null;
    });
    try {
      final repo = await ref.read(llmRepositoryProvider.future);
      if (repo == null) {
        setState(() => _testResult = '❌ API Key 또는 설정이 없습니다');
        return;
      }
      final ok = await repo.testConnection();
      setState(() =>
          _testResult = ok ? '✅ 연결 성공!' : '❌ 연결 실패 — API Key를 확인해주세요');
    } catch (e) {
      setState(() => _testResult = '❌ 오류: $e');
    } finally {
      if (mounted) setState(() => _isTesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isLoaded) {
      return const SizedBox(
        height: 52,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // LLM 선택 목록
          ...LlmProvider.values.map((provider) => _LlmOptionTile(
                provider: provider,
                isSelected: _selectedProvider == provider,
                onTap: () {
                  setState(() => _selectedProvider = provider);
                  _saveProvider(provider);
                },
              )),

          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14),
            child: Divider(height: 1, color: Color(0xFFE5E7EB)),
          ),

          // API Key / Ollama 설정 입력
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
            child: _selectedProvider == LlmProvider.ollama
                ? _OllamaFields(
                    urlCtrl: _ollamaUrlCtrl,
                    modelCtrl: _ollamaModelCtrl,
                  )
                : _ApiKeyField(
                    provider: _selectedProvider,
                    controller:
                        _apiKeyControllers[_selectedProvider]!,
                  ),
          ),

          // 저장 + 테스트 버튼
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saveApiKey,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF2563EB),
                      side: const BorderSide(color: Color(0xFF2563EB)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('저장'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isTesting ? null : _testConnection,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    child: _isTesting
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2),
                          )
                        : const Text('연결 테스트',
                            style: TextStyle(color: Colors.white)),
                  ),
                ),
              ],
            ),
          ),

          // 테스트 결과
          if (_testResult != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Text(
                _testResult!,
                style: TextStyle(
                  fontSize: 13,
                  color: _testResult!.startsWith('✅')
                      ? const Color(0xFF10B981)
                      : const Color(0xFFEF4444),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ============================================================
// LLM 선택 타일
// ============================================================

class _LlmOptionTile extends StatelessWidget {
  final LlmProvider provider;
  final bool isSelected;
  final VoidCallback onTap;

  const _LlmOptionTile({
    required this.provider,
    required this.isSelected,
    required this.onTap,
  });

  String get _emoji {
    return switch (provider) {
      LlmProvider.groq => '⚡',
      LlmProvider.deepSeek => '🔍',
      LlmProvider.gemini => '🌟',
      LlmProvider.openAi => '🤖',
      LlmProvider.claude => '🧠',
      LlmProvider.grok => '𝕏',
      LlmProvider.ollama => '🏠',
    };
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            SizedBox(
              width: 24,
              height: 24,
              child: Radio<LlmProvider>(
                value: provider,
                groupValue: isSelected ? provider : null,
                onChanged: (_) => onTap(),
                activeColor: const Color(0xFF2563EB),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
            const SizedBox(width: 10),
            Text(_emoji, style: const TextStyle(fontSize: 16)),
            const SizedBox(width: 8),
            Text(
              provider.displayName,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isSelected
                    ? const Color(0xFF2563EB)
                    : const Color(0xFF111827),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// API Key 입력 필드
// ============================================================

class _ApiKeyField extends StatefulWidget {
  final LlmProvider provider;
  final TextEditingController controller;

  const _ApiKeyField({
    required this.provider,
    required this.controller,
  });

  @override
  State<_ApiKeyField> createState() => _ApiKeyFieldState();
}

class _ApiKeyFieldState extends State<_ApiKeyField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      obscureText: _obscure,
      decoration: InputDecoration(
        labelText: '${widget.provider.displayName} API Key',
        hintText: 'sk-...',
        hintStyle:
            const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13),
        filled: true,
        fillColor: const Color(0xFFF9FAFB),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(0xFF2563EB)),
        ),
        suffixIcon: IconButton(
          icon: Icon(
              _obscure ? Icons.visibility_off : Icons.visibility,
              size: 18,
              color: const Color(0xFF9CA3AF)),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
    );
  }
}

// ============================================================
// Ollama 전용 입력 필드
// ============================================================

class _OllamaFields extends StatelessWidget {
  final TextEditingController urlCtrl;
  final TextEditingController modelCtrl;

  const _OllamaFields({
    required this.urlCtrl,
    required this.modelCtrl,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(
          controller: urlCtrl,
          decoration: InputDecoration(
            labelText: '서버 주소',
            hintText: 'http://192.168.0.10:11434',
            hintStyle:
                const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF2563EB)),
            ),
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: modelCtrl,
          decoration: InputDecoration(
            labelText: '모델명',
            hintText: 'llama3, mistral, qwen2.5 ...',
            hintStyle:
                const TextStyle(color: Color(0xFF9CA3AF), fontSize: 13),
            filled: true,
            fillColor: const Color(0xFFF9FAFB),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF2563EB)),
            ),
          ),
        ),
      ],
    );
  }
}
