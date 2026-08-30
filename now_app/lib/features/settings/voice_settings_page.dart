import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:now_core/now_core.dart';
import '../../llm/providers/llm_providers.dart';

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
  /// STT 주소 입력칸. 티어 목록 안과 「음성 엔진 서버」에서 같이 쓴다.
  final _urlCtrl = TextEditingController();
  final _ttsUrlCtrl = TextEditingController();

  /// 키 입력칸은 저장된 값을 다시 채우지 않는다. 새로 넣을 때만 쓴다.
  final _sttKeyCtrl = TextEditingController();
  final _ttsKeyCtrl = TextEditingController();

  final _store = VoiceSettingsStore();

  /// 저장된 설정. 키 값은 화면에 뿌리지 않고 여기서만 들고 있는다.
  VoiceSettings _settings = VoiceSettings.empty();

  bool _saving = false;
  bool _checkingStt = false;
  bool _checkingTts = false;
  _HealthMessage? _sttHealth;
  _HealthMessage? _ttsHealth;

  // ---- LLM 연동 상태 ----
  LlmProvider _selectedProvider = LlmProvider.gemini;
  final Map<LlmProvider, TextEditingController> _apiKeyControllers = {};
  final _ollamaUrlCtrl = TextEditingController();
  final _ollamaModelCtrl = TextEditingController();
  bool _llmLoaded = false;
  bool _isTestingLlm = false;
  String? _llmTestResult;
  List<String> _ollamaModels = [];
  bool _isLoadingOllamaModels = false;

  @override
  void initState() {
    super.initState();
    _loadVoiceSettings();
    LlmSettingsService().loadSttTier().then((tier) {
      if (mounted) ref.read(sttTierProvider.notifier).state = tier;
    });
    for (final p in LlmProvider.values) {
      _apiKeyControllers[p] = TextEditingController();
    }
    _loadLlmSettings();
  }

  Future<void> _fetchOllamaModels() async {
    setState(() => _isLoadingOllamaModels = true);
    try {
      final tempConfig = LlmConfig(
        provider: LlmProvider.ollama,
        ollamaUrl: _ollamaUrlCtrl.text.trim(),
        ollamaModel: '',
      );
      final repo = OllamaLlmRepository(tempConfig);
      final models = await repo.getAvailableModels();

      if (mounted) {
        setState(() {
          _ollamaModels = models;
          if (models.isNotEmpty && !models.contains(_ollamaModelCtrl.text)) {
            if (_ollamaModelCtrl.text.isEmpty) {
              _ollamaModelCtrl.text = models.first;
            }
          }
        });
      }
    } catch (e) {
      debugPrint('모델 로드 실패: $e');
    } finally {
      if (mounted) setState(() => _isLoadingOllamaModels = false);
    }
  }

  Future<void> _loadLlmSettings() async {
    final service = ref.read(llmSettingsServiceProvider);
    final config = await service.loadConfig();
    if (!mounted) return;
    setState(() {
      _selectedProvider = config.provider;
      _ollamaUrlCtrl.text = config.ollamaUrl;
      _ollamaModelCtrl.text = config.ollamaModel;
      _llmLoaded = true;
    });
    final apiKey = await service.loadApiKey(config.provider);
    if (mounted) {
      _apiKeyControllers[config.provider]?.text = apiKey;
    }

    if (config.provider == LlmProvider.ollama) {
      _fetchOllamaModels();
    }
  }

  Future<void> _saveLlmProvider(LlmProvider provider) async {
    final service = ref.read(llmSettingsServiceProvider);
    await service.saveProvider(provider);
    final apiKey = await service.loadApiKey(provider);
    if (mounted) {
      _apiKeyControllers[provider]?.text = apiKey;
    }
    ref.invalidate(llmConfigProvider);
  }

  Future<void> _saveLlmApiKey() async {
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

  Future<void> _testLlmConnection() async {
    await _saveLlmApiKey();
    setState(() {
      _isTestingLlm = true;
      _llmTestResult = null;
    });
    try {
      final repo = await ref.read(llmRepositoryProvider.future);
      if (repo == null) {
        // Ollama는 기본 주소를 두지 않는다. 주소가 비었으면 무엇을 넣어야
        // 하는지 알려 준다. 요청은 보내지 않는다.
        final needsOllamaUrl = _selectedProvider == LlmProvider.ollama &&
            _ollamaUrlCtrl.text.trim().isEmpty;
        setState(() => _llmTestResult = needsOllamaUrl
            ? '❌ ${OllamaLlmRepository.missingServerMessage}'
            : '❌ API Key 또는 설정이 없습니다');
        return;
      }
      final ok = await repo.testConnection();
      setState(() => _llmTestResult =
          ok ? '✅ 연결 성공!' : '❌ 연결 실패 — API Key를 확인해주세요');
    } catch (e) {
      setState(() => _llmTestResult = '❌ 오류: $e');
    } finally {
      if (mounted) setState(() => _isTestingLlm = false);
    }
  }

  Future<void> _loadVoiceSettings() async {
    try {
      final loaded = await _store.load();
      if (!mounted) return;
      setState(() {
        _settings = loaded;
        _urlCtrl.text = loaded.sttBaseUrl;
        _ttsUrlCtrl.text = loaded.ttsBaseUrl;
      });
    } on Object {
      // 저장소를 읽지 못해도 화면은 열려야 한다. 빈 값으로 시작한다.
    }
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _ttsUrlCtrl.dispose();
    _sttKeyCtrl.dispose();
    _ttsKeyCtrl.dispose();
    for (final c in _apiKeyControllers.values) {
      c.dispose();
    }
    _ollamaUrlCtrl.dispose();
    _ollamaModelCtrl.dispose();
    super.dispose();
  }

  /// 저장한다.
  ///
  /// 키 입력칸이 비어 있으면 이미 저장된 키를 그대로 둔다. 화면에 키를 다시
  /// 뿌리지 않기 때문에, 빈 칸을 "지우기"로 해석하면 주소만 고쳐도 키가
  /// 날아간다.
  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    final sttKey = _sttKeyCtrl.text.trim();
    final ttsKey = _ttsKeyCtrl.text.trim();
    final next = _settings.copyWith(
      sttBaseUrl: _urlCtrl.text,
      ttsBaseUrl: _ttsUrlCtrl.text,
      sttApiKey: sttKey.isEmpty ? _settings.sttApiKey : sttKey,
      ttsApiKey: ttsKey.isEmpty ? _settings.ttsApiKey : ttsKey,
    );
    try {
      await _store.save(next);
      if (!mounted) return;
      setState(() {
        _settings = next;
        _urlCtrl.text = next.sttBaseUrl;
        _ttsUrlCtrl.text = next.ttsBaseUrl;
        _sttKeyCtrl.clear();
        _ttsKeyCtrl.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('음성 서버 설정을 저장했어요')),
      );
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('음성 서버 설정을 저장하지 못했어요')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// 저장된 키를 지운다. 키를 화면에 뿌리지 않으므로 지우기는 따로 둔다.
  Future<void> _clearKey({required bool stt}) async {
    final next = stt
        ? _settings.copyWith(sttApiKey: '')
        : _settings.copyWith(ttsApiKey: '');
    await _store.save(next);
    if (!mounted) return;
    setState(() {
      _settings = next;
      if (stt) {
        _sttKeyCtrl.clear();
      } else {
        _ttsKeyCtrl.clear();
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${stt ? 'STT' : 'TTS'} API 키를 지웠어요')),
    );
  }

  /// 연결을 확인한다.
  ///
  /// 결과는 세 갈래다.
  /// - 모델까지 올라와 바로 쓸 수 있다.
  /// - 서버에는 닿았지만 모델을 아직 올리는 중이다(`ready:false`).
  /// - 서버에 닿지 못했다. 이때 문구는 [VoiceEngineException]이 들고 있는 것을
  ///   그대로 쓴다. 401·503·연결 실패·타임아웃이 각각 다른 문장이다.
  Future<void> _checkHealth({required bool stt}) async {
    final baseUrl = (stt ? _urlCtrl.text : _ttsUrlCtrl.text).trim();
    setState(() {
      if (stt) {
        _checkingStt = true;
        _sttHealth = null;
      } else {
        _checkingTts = true;
        _ttsHealth = null;
      }
    });

    _HealthMessage result;
    try {
      final health = await VoiceEngineClient(settings: _settings)
          .checkHealth(baseUrl);
      if (health.usable) {
        final detail = [
          if (health.engine.isNotEmpty) '엔진 ${health.engine}',
          if (health.model.isNotEmpty) '모델 ${health.model}',
        ].join(' · ');
        result = _HealthMessage(
          text: detail.isEmpty ? '연결됐어요. 바로 쓸 수 있어요.' : '연결됐어요. $detail',
          tone: _HealthTone.ok,
        );
      } else {
        result = const _HealthMessage(
          text: '서버에는 닿았지만 모델을 아직 올리는 중이에요. 잠시 후 다시 확인해 주세요.',
          tone: _HealthTone.pending,
        );
      }
    } on VoiceEngineException catch (e) {
      result = _HealthMessage(text: e.message, tone: _HealthTone.failed);
    } on Object {
      result = const _HealthMessage(
        text: '연결 확인 중 알 수 없는 문제가 생겼습니다.',
        tone: _HealthTone.failed,
      );
    }

    if (!mounted) return;
    setState(() {
      if (stt) {
        _checkingStt = false;
        _sttHealth = result;
      } else {
        _checkingTts = false;
        _ttsHealth = result;
      }
    });
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
                        _UrlField(controller: _urlCtrl),
                        const SizedBox(height: 6),
                        const Text(
                          'API 키와 연결 확인은 아래 「음성 엔진 서버」에서 합니다.',
                          style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _saving ? null : _save,
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
          const SizedBox(height: 20),
          const _SectionHeader(title: '음성 엔진 서버'),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '주소와 키는 이 기기에만 저장됩니다. 키는 저장한 뒤 다시 보이지 않습니다.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF6B7280), height: 1.4),
                ),
                const SizedBox(height: 14),
                const _FieldLabel('음성 인식(STT) 서버 주소'),
                const SizedBox(height: 6),
                _UrlField(controller: _urlCtrl),
                const SizedBox(height: 10),
                const _FieldLabel('음성 인식(STT) API 키'),
                const SizedBox(height: 6),
                _ApiKeyField(
                  controller: _sttKeyCtrl,
                  stored: _settings.sttApiKey.isNotEmpty,
                  onClear: () => _clearKey(stt: true),
                ),
                const SizedBox(height: 10),
                _HealthRow(
                  label: 'STT 연결 확인',
                  checking: _checkingStt,
                  message: _sttHealth,
                  onPressed: () => _checkHealth(stt: true),
                ),
                const SizedBox(height: 16),
                const Divider(height: 1, color: Color(0xFFE5E7EB)),
                const SizedBox(height: 16),
                const _FieldLabel('음성 합성(TTS) 서버 주소'),
                const SizedBox(height: 6),
                _UrlField(controller: _ttsUrlCtrl),
                const SizedBox(height: 10),
                const _FieldLabel('음성 합성(TTS) API 키'),
                const SizedBox(height: 6),
                _ApiKeyField(
                  controller: _ttsKeyCtrl,
                  stored: _settings.ttsApiKey.isNotEmpty,
                  onClear: () => _clearKey(stt: false),
                ),
                const SizedBox(height: 10),
                _HealthRow(
                  label: 'TTS 연결 확인',
                  checking: _checkingTts,
                  message: _ttsHealth,
                  onPressed: () => _checkHealth(stt: false),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('음성 서버 설정 저장',
                        style: TextStyle(color: Colors.white, fontSize: 13)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const _SectionHeader(title: 'LLM 연동'),
          if (!_llmLoaded)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else ...[
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                children: LlmProvider.values.map((provider) {
                  final isLast = provider == LlmProvider.values.last;
                  return Column(
                    children: [
                      _LlmOptionTile(
                        provider: provider,
                        isSelected: _selectedProvider == provider,
                        onTap: () {
                          setState(() => _selectedProvider = provider);
                          _saveLlmProvider(provider);
                        },
                      ),
                      if (!isLast)
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 14),
                          child: Divider(height: 1, color: Color(0xFFE5E7EB)),
                        ),
                    ],
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 20),
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
                      models: _ollamaModels,
                      isLoading: _isLoadingOllamaModels,
                      onRefresh: _fetchOllamaModels,
                    )
                  : _LlmApiKeyField(
                      provider: _selectedProvider,
                      controller: _apiKeyControllers[_selectedProvider]!,
                    ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saveLlmApiKey,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF2563EB),
                      side: const BorderSide(color: Color(0xFF2563EB)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('저장',
                        style: TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _isTestingLlm ? null : _testLlmConnection,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _isTestingLlm
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
            if (_llmTestResult != null) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _llmTestResult!.startsWith('✅')
                      ? const Color(0xFF10B981).withValues(alpha: 0.1)
                      : const Color(0xFFEF4444).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  _llmTestResult!,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: _llmTestResult!.startsWith('✅')
                        ? const Color(0xFF10B981)
                        : const Color(0xFFEF4444),
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

/// 연결 확인 결과를 어떤 색으로 보여줄지.
enum _HealthTone { ok, pending, failed }

/// 연결 확인 결과 한 줄.
class _HealthMessage {
  const _HealthMessage({required this.text, required this.tone});

  final String text;
  final _HealthTone tone;
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: Color(0xFF6B7280),
      ),
    );
  }
}

/// 주소 입력칸.
class _UrlField extends StatelessWidget {
  const _UrlField({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.url,
      autocorrect: false,
      decoration: InputDecoration(
        hintText: 'http://192.168.0.x:8000',
        hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
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
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      ),
      style: const TextStyle(fontSize: 13),
    );
  }
}

/// API 키 입력칸.
///
/// 입력 중에도 값이 보이지 않는다. 저장된 키는 다시 채우지 않고 «설정됨»으로만
/// 알린다. 지우고 싶으면 옆의 「키 지우기」를 쓴다.
class _ApiKeyField extends StatelessWidget {
  const _ApiKeyField({
    required this.controller,
    required this.stored,
    required this.onClear,
  });

  final TextEditingController controller;
  final bool stored;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: controller,
          obscureText: true,
          enableSuggestions: false,
          autocorrect: false,
          decoration: InputDecoration(
            hintText: stored ? '새 키를 입력하면 바뀝니다' : '서버에서 발급받은 키',
            hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
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
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          ),
          style: const TextStyle(fontSize: 13),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            Text(
              stored ? '설정됨' : '설정 안 됨',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: stored ? const Color(0xFF10B981) : const Color(0xFF9CA3AF),
              ),
            ),
            const Spacer(),
            if (stored)
              TextButton(
                onPressed: onClear,
                style: TextButton.styleFrom(
                  minimumSize: Size.zero,
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text('키 지우기', style: TextStyle(fontSize: 11)),
              ),
          ],
        ),
      ],
    );
  }
}

/// 연결 확인 버튼과 결과 한 줄.
class _HealthRow extends StatelessWidget {
  const _HealthRow({
    required this.label,
    required this.checking,
    required this.message,
    required this.onPressed,
  });

  final String label;
  final bool checking;
  final _HealthMessage? message;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final result = message;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 34,
          child: OutlinedButton(
            onPressed: checking ? null : onPressed,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            child: Text(
              checking ? '확인 중…' : label,
              style: const TextStyle(fontSize: 12),
            ),
          ),
        ),
        if (result != null) ...[
          const SizedBox(height: 6),
          Text(
            result.text,
            style: TextStyle(
              fontSize: 12,
              height: 1.4,
              color: switch (result.tone) {
                _HealthTone.ok => const Color(0xFF10B981),
                _HealthTone.pending => const Color(0xFFF59E0B),
                _HealthTone.failed => const Color(0xFFEF4444),
              },
            ),
          ),
        ],
      ],
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
            RadioGroup<String>(
              groupValue: groupValue,
              onChanged: isAvailable ? onChanged : (_) {},
              child: Radio<String>(
                value: value,
                enabled: isAvailable,
                activeColor: const Color(0xFF2563EB),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
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
                              ? const Color(0xFF10B981).withValues(alpha: 0.1)
                              : const Color(0xFF6B7280).withValues(alpha: 0.1),
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
            RadioGroup<LlmProvider>(
              groupValue: isSelected ? provider : null,
              onChanged: (_) => onTap(),
              child: Radio<LlmProvider>(
                value: provider,
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
// LLM API Key 입력 필드
// ============================================================

class _LlmApiKeyField extends StatefulWidget {
  final LlmProvider provider;
  final TextEditingController controller;

  const _LlmApiKeyField({required this.provider, required this.controller});

  @override
  State<_LlmApiKeyField> createState() => _LlmApiKeyFieldState();
}

class _LlmApiKeyFieldState extends State<_LlmApiKeyField> {
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
// Ollama 설정 필드 (드롭다운 + 새로고침)
// ============================================================

class _OllamaFields extends StatelessWidget {
  final TextEditingController urlCtrl;
  final TextEditingController modelCtrl;

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
                initialValue: models.contains(modelCtrl.text)
                    ? modelCtrl.text
                    : null,
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
                    LlmSettingsService().saveOllamaModel(newValue);
                  }
                },
              ),
            ),
            const SizedBox(width: 8),
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
