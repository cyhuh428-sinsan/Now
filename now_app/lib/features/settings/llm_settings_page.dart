import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../llm/models/llm_config.dart';
import '../../llm/services/llm_settings_service.dart';
import '../../llm/providers/llm_providers.dart';
import '../../llm/ollama_llm_repository.dart';

// ============================================================
// LLM 연동 설정 상세 페이지
// ============================================================

class LlmSettingsPage extends ConsumerStatefulWidget {
  const LlmSettingsPage({super.key});

  @override
  ConsumerState<LlmSettingsPage> createState() => _LlmSettingsPageState();
}

class _LlmSettingsPageState extends ConsumerState<LlmSettingsPage> {
  LlmProvider _selectedProvider = LlmProvider.gemini;
  final Map<LlmProvider, TextEditingController> _apiKeyControllers = {};
  final _ollamaUrlCtrl = TextEditingController();
  final _ollamaModelCtrl = TextEditingController();
  bool _isLoaded = false;
  bool _isTesting = false;
  String? _testResult;

  // [추가할 변수]
  List<String> _ollamaModels = [];
  bool _isLoadingModels = false;

  // [추가할 함수] 모델 목록 가져오기
  Future<void> _fetchOllamaModels() async {
    setState(() => _isLoadingModels = true);
    try {
      // 임시 설정을 만들어서 리포지토리 생성
      final tempConfig = LlmConfig(
        provider: LlmProvider.ollama,
        ollamaUrl: _ollamaUrlCtrl.text.trim(), // 현재 입력된 URL 사용
        ollamaModel: '',
      );
      // 리포지토리 import 필요: import '../../llm/ollama_llm_repository.dart';
      final repo = OllamaLlmRepository(tempConfig);
      final models = await repo.getAvailableModels();

      if (mounted) {
        setState(() {
          _ollamaModels = models;
          // 목록은 있는데 현재 선택된 모델이 비어있으면 첫 번째 거 자동 선택
          if (models.isNotEmpty && !models.contains(_ollamaModelCtrl.text)) {
            if (_ollamaModelCtrl.text.isEmpty) {
              _ollamaModelCtrl.text = models.first;
            }
          }
        });
      }
    } catch (e) {
      print('모델 로드 실패: $e');
    } finally {
      if (mounted) setState(() => _isLoadingModels = false);
    }
  }

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
    for (final c in _apiKeyControllers.values) c.dispose();
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
    final apiKey = await service.loadApiKey(config.provider);
    if (mounted) {
      _apiKeyControllers[config.provider]?.text = apiKey;
    }
    
    if (config.provider == LlmProvider.ollama) {
      _fetchOllamaModels();
    }
  }

  Future<void> _saveProvider(LlmProvider provider) async {
    final service = ref.read(llmSettingsServiceProvider);
    await service.saveProvider(provider);
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
      setState(() => _testResult =
          ok ? '✅ 연결 성공!' : '❌ 연결 실패 — API Key를 확인해주세요');
    } catch (e) {
      setState(() => _testResult = '❌ 오류: $e');
    } finally {
      if (mounted) setState(() => _isTesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios,
              size: 18, color: Color(0xFF111827)),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'LLM 연동',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF111827),
          ),
        ),
      ),
      body: !_isLoaded
          ? const Center(
              child: CircularProgressIndicator(strokeWidth: 2))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // LLM 선택
                const _SectionHeader(title: 'LLM 선택'),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    children: LlmProvider.values.map((provider) {
                      final isLast =
                          provider == LlmProvider.values.last;
                      return Column(
                        children: [
                          _LlmOptionTile(
                            provider: provider,
                            isSelected: _selectedProvider == provider,
                            onTap: () {
                              setState(
                                  () => _selectedProvider = provider);
                              _saveProvider(provider);
                            },
                          ),
                          if (!isLast)
                            const Padding(
                              padding:
                                  EdgeInsets.symmetric(horizontal: 14),
                              child: Divider(
                                  height: 1,
                                  color: Color(0xFFE5E7EB)),
                            ),
                        ],
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 20),

                // API Key 입력
                _SectionHeader(
                  title: _selectedProvider == LlmProvider.ollama
                      ? 'Ollama 설정'
                      : 'API Key',
                ),
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: _selectedProvider == LlmProvider.ollama
                      ? _OllamaFields(
                          urlCtrl: _ollamaUrlCtrl,
                          modelCtrl: _ollamaModelCtrl,
                          // ▼ 이 3줄을 추가해서 데이터를 넘겨줘야 합니다!
                          models: _ollamaModels,
                          isLoading: _isLoadingModels,
                          onRefresh: _fetchOllamaModels,
                        )
                      : _ApiKeyField(
                          provider: _selectedProvider,
                          controller:
                              _apiKeyControllers[_selectedProvider]!,
                        ),
                ),
                const SizedBox(height: 16),

                // 저장 + 테스트 버튼
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _saveApiKey,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF2563EB),
                          side: const BorderSide(
                              color: Color(0xFF2563EB)),
                          padding:
                              const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text('저장',
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _isTesting ? null : _testConnection,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF2563EB),
                          padding:
                              const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10)),
                        ),
                        child: _isTesting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('연결 테스트',
                                style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white)),
                      ),
                    ),
                  ],
                ),

                // 테스트 결과
                if (_testResult != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: _testResult!.startsWith('✅')
                          ? const Color(0xFF10B981).withOpacity(0.1)
                          : const Color(0xFFEF4444).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _testResult!,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: _testResult!.startsWith('✅')
                            ? const Color(0xFF10B981)
                            : const Color(0xFFEF4444),
                      ),
                    ),
                  ),
                ],
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

  String get _emoji => switch (provider) {
        LlmProvider.groq => '⚡',
        LlmProvider.deepSeek => '🔍',
        LlmProvider.gemini => '🌟',
        LlmProvider.openAi => '🤖',
        LlmProvider.claude => '🧠',
        LlmProvider.grok => '𝕏',
        LlmProvider.ollama => '🏠',
      };

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Radio<LlmProvider>(
              value: provider,
              groupValue: isSelected ? provider : null,
              onChanged: (_) => onTap(),
              activeColor: const Color(0xFF2563EB),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
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

  const _ApiKeyField({required this.provider, required this.controller});

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
            const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
// Ollama 설정 필드 (수정됨: 드롭다운 + 새로고침)
// ============================================================

class _OllamaFields extends StatelessWidget {
  final TextEditingController urlCtrl;
  final TextEditingController modelCtrl;
  
  // [추가된 변수들] 부모로부터 받아올 데이터
  final List<String> models;
  final bool isLoading;
  final VoidCallback onRefresh;

  const _OllamaFields({
    required this.urlCtrl,
    required this.modelCtrl,
    required this.models,
    required this.isLoading,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 1. 서버 주소 입력 (기존과 동일)
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
                const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
        const SizedBox(height: 12),

        // 2. 모델 선택 (드롭다운 + 새로고침 버튼)
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                decoration: InputDecoration(
                  labelText: '사용할 모델',
                  filled: true,
                  fillColor: const Color(0xFFF9FAFB),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 12),
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
                // 현재 컨트롤러 값이 목록에 있으면 선택, 없으면 null
                value: models.contains(modelCtrl.text)
                    ? modelCtrl.text
                    : null,
                // 목록이 비었을 때 보여줄 임시 아이템
                items: models.isEmpty
                    ? [
                        if (modelCtrl.text.isNotEmpty)
                          DropdownMenuItem(
                            value: modelCtrl.text,
                            child: Text(modelCtrl.text),
                          )
                      ]
                    : models.map((m) {
                        return DropdownMenuItem(
                          value: m,
                          child: Text(
                            m, 
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 14),
                          ),
                        );
                      }).toList(),
                onChanged: (newValue) {
                  if (newValue != null) {
                    modelCtrl.text = newValue;
                    // 선택하자마자 저장 (서비스 호출)
                    LlmSettingsService().saveOllamaModel(newValue);
                  }
                },
              ),
            ),
            const SizedBox(width: 8),
            // 새로고침 버튼
            IconButton(
              onPressed: onRefresh,
              icon: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh, color: Color(0xFF6B7280)),
              tooltip: '모델 목록 갱신',
            ),
          ],
        ),
      ],
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
