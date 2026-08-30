import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:now_core/now_core.dart';

import '../today/today_providers.dart';
import 'settings_providers.dart';

/// 연결 확인 결과를 어떤 색으로 보여줄지.
enum _HealthTone { ok, pending, failed }

class _HealthMessage {
  const _HealthMessage({required this.text, required this.tone});

  final String text;
  final _HealthTone tone;
}

/// 음성 설정 화면.
///
/// Now의 `voice_settings_page.dart`(약 137~183번째 줄의 연결 확인 로직)를
/// 참고했다. STT/TTS 서버 주소·API 키, 연결 확인에 더해 LLM 연동 설정까지
/// 한 화면에서 다룬다. LLM 설정은 원래 `photo_reading_settings_page.dart`에
/// 있던 것을 옮겨왔다 — 사진 읽기뿐 아니라 앞으로 묻기(Ask) 기능도 같은
/// LLM 설정을 쓴다. 별도 provider를 새로 만들지 않고
/// `today_providers.dart`에 이미 배선된
/// `llmSettingsServiceProvider`/`llmConfigProvider`/`llmRepositoryProvider`를
/// 그대로 쓴다.
class VoiceSettingsPage extends ConsumerStatefulWidget {
  const VoiceSettingsPage({super.key});

  @override
  ConsumerState<VoiceSettingsPage> createState() => _VoiceSettingsPageState();
}

class _VoiceSettingsPageState extends ConsumerState<VoiceSettingsPage> {
  final _sttUrlCtrl = TextEditingController();
  final _ttsUrlCtrl = TextEditingController();
  final _sttKeyCtrl = TextEditingController();
  final _ttsKeyCtrl = TextEditingController();

  VoiceSettings _settings = VoiceSettings.empty();
  bool _loaded = false;
  bool _saving = false;
  bool _checkingStt = false;
  bool _checkingTts = false;
  _HealthMessage? _sttHealth;
  _HealthMessage? _ttsHealth;

  final Map<LlmProvider, TextEditingController> _llmApiKeyControllers = {};
  final _ollamaUrlCtrl = TextEditingController();
  final _ollamaModelCtrl = TextEditingController();

  LlmProvider _selectedLlmProvider = LlmProvider.gemini;
  bool _llmLoaded = false;
  bool _llmTesting = false;
  String? _llmTestResult;
  bool _llmTestOk = false;

  @override
  void initState() {
    super.initState();
    for (final provider in LlmProvider.values) {
      _llmApiKeyControllers[provider] = TextEditingController();
    }
    _load();
    _loadLlm();
  }

  @override
  void dispose() {
    _sttUrlCtrl.dispose();
    _ttsUrlCtrl.dispose();
    _sttKeyCtrl.dispose();
    _ttsKeyCtrl.dispose();
    for (final controller in _llmApiKeyControllers.values) {
      controller.dispose();
    }
    _ollamaUrlCtrl.dispose();
    _ollamaModelCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final store = ref.read(voiceSettingsStoreProvider);
    final loaded = await store.load();
    if (!mounted) return;
    setState(() {
      _settings = loaded;
      _sttUrlCtrl.text = loaded.sttBaseUrl;
      _ttsUrlCtrl.text = loaded.ttsBaseUrl;
      _loaded = true;
    });
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    final sttKey = _sttKeyCtrl.text.trim();
    final ttsKey = _ttsKeyCtrl.text.trim();
    final next = _settings.copyWith(
      sttBaseUrl: _sttUrlCtrl.text,
      ttsBaseUrl: _ttsUrlCtrl.text,
      sttApiKey: sttKey.isEmpty ? _settings.sttApiKey : sttKey,
      ttsApiKey: ttsKey.isEmpty ? _settings.ttsApiKey : ttsKey,
    );
    try {
      await ref.read(voiceSettingsStoreProvider).save(next);
      if (!mounted) return;
      setState(() {
        _settings = next;
        _sttUrlCtrl.text = next.sttBaseUrl;
        _ttsUrlCtrl.text = next.ttsBaseUrl;
        _sttKeyCtrl.clear();
        _ttsKeyCtrl.clear();
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('음성 서버 설정을 저장했습니다')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _checkHealth({required bool stt}) async {
    final baseUrl = (stt ? _sttUrlCtrl.text : _ttsUrlCtrl.text).trim();
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
      final buildClient = ref.read(voiceEngineClientBuilderProvider);
      final health = await buildClient(_settings).checkHealth(baseUrl);
      if (health.usable) {
        final detail = [
          if (health.engine.isNotEmpty) '엔진 ${health.engine}',
          if (health.model.isNotEmpty) '모델 ${health.model}',
        ].join(' · ');
        result = _HealthMessage(
          text: detail.isEmpty ? '연결됐습니다. 바로 쓸 수 있습니다.' : '연결됐습니다. $detail',
          tone: _HealthTone.ok,
        );
      } else {
        result = const _HealthMessage(
          text: '서버에는 닿았지만 모델을 아직 올리는 중입니다. 잠시 후 다시 확인해 주세요.',
          tone: _HealthTone.pending,
        );
      }
    } on VoiceEngineException catch (e) {
      result = _HealthMessage(text: e.message, tone: _HealthTone.failed);
    } catch (_) {
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

  Future<void> _loadLlm() async {
    final service = ref.read(llmSettingsServiceProvider);
    final config = await service.loadConfig();
    if (!mounted) return;
    setState(() {
      _selectedLlmProvider = config.provider;
      _ollamaUrlCtrl.text = config.ollamaUrl;
      _ollamaModelCtrl.text = config.ollamaModel;
      _llmLoaded = true;
    });
    final apiKey = await service.loadApiKey(config.provider);
    if (mounted) {
      _llmApiKeyControllers[config.provider]?.text = apiKey;
    }
  }

  Future<void> _selectLlmProvider(LlmProvider provider) async {
    setState(() => _selectedLlmProvider = provider);
    final service = ref.read(llmSettingsServiceProvider);
    await service.saveProvider(provider);
    final apiKey = await service.loadApiKey(provider);
    if (mounted) {
      _llmApiKeyControllers[provider]?.text = apiKey;
    }
    ref.invalidate(llmConfigProvider);
  }

  Future<void> _saveLlm() async {
    final service = ref.read(llmSettingsServiceProvider);
    if (_selectedLlmProvider == LlmProvider.ollama) {
      await service.saveOllamaSettings(
        url: _ollamaUrlCtrl.text.trim(),
        model: _ollamaModelCtrl.text.trim(),
      );
    } else {
      await service.saveApiKey(
        _selectedLlmProvider,
        _llmApiKeyControllers[_selectedLlmProvider]?.text.trim() ?? '',
      );
    }
    ref.invalidate(llmConfigProvider);
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('사진 읽기 설정을 저장했습니다')));
  }

  Future<void> _testLlmConnection() async {
    await _saveLlm();
    setState(() {
      _llmTesting = true;
      _llmTestResult = null;
      _llmTestOk = false;
    });
    try {
      final repo = await ref.read(llmRepositoryProvider.future);
      if (repo == null) {
        final needsOllamaUrl =
            _selectedLlmProvider == LlmProvider.ollama &&
            _ollamaUrlCtrl.text.trim().isEmpty;
        setState(() {
          _llmTestOk = false;
          _llmTestResult = needsOllamaUrl
              ? OllamaLlmRepository.missingServerMessage
              : 'API Key 또는 설정이 없습니다';
        });
        return;
      }
      final ok = await repo.testConnection();
      setState(() {
        _llmTestOk = ok;
        _llmTestResult = ok ? '연결 성공' : '연결 실패 — API Key를 확인해 주세요';
      });
    } catch (e) {
      setState(() {
        _llmTestOk = false;
        _llmTestResult = '오류: $e';
      });
    } finally {
      if (mounted) setState(() => _llmTesting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('음성 설정')),
      body: !_loaded || !_llmLoaded
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '주소와 키는 이 기기에만 저장됩니다. 키는 저장한 뒤 다시 화면에 보이지 않습니다.',
                  style: TextStyle(
                    fontSize: 12,
                    color: colorScheme.onSurfaceVariant,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  '음성 인식(STT)',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _sttUrlCtrl,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: 'STT 서버 주소',
                    hintText: 'http://192.168.0.10:8000',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _sttKeyCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'STT API 키',
                    hintText: _settings.sttApiKey.isNotEmpty
                        ? '새 키를 입력하면 바뀝니다'
                        : '서버에서 발급받은 키',
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                _HealthRow(
                  label: 'STT 연결 확인',
                  checking: _checkingStt,
                  message: _sttHealth,
                  onPressed: () => _checkHealth(stt: true),
                ),
                const SizedBox(height: 20),
                const Divider(),
                const SizedBox(height: 12),
                Text(
                  '음성 합성(TTS)',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _ttsUrlCtrl,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: 'TTS 서버 주소',
                    hintText: 'http://192.168.0.10:8001',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _ttsKeyCtrl,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'TTS API 키',
                    hintText: _settings.ttsApiKey.isNotEmpty
                        ? '새 키를 입력하면 바뀝니다'
                        : '서버에서 발급받은 키',
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 10),
                _HealthRow(
                  label: 'TTS 연결 확인',
                  checking: _checkingTts,
                  message: _ttsHealth,
                  onPressed: () => _checkHealth(stt: false),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: const Icon(Icons.save_outlined, size: 18),
                    label: const Text('음성 서버 설정 저장'),
                  ),
                ),
                const SizedBox(height: 20),
                const Divider(),
                const SizedBox(height: 12),
                Text('LLM 연동', style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: 8),
                Text(
                  '사진 입력을 텍스트로 바꾸거나 앞으로 묻기(Ask) 기능에 쓸 LLM을 고릅니다.',
                  style: TextStyle(
                    fontSize: 12,
                    color: colorScheme.onSurfaceVariant,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 16),
                RadioGroup<LlmProvider>(
                  groupValue: _selectedLlmProvider,
                  onChanged: (value) {
                    if (value != null) _selectLlmProvider(value);
                  },
                  child: Card(
                    margin: EdgeInsets.zero,
                    child: Column(
                      children: LlmProvider.values.map((provider) {
                        final isLast = provider == LlmProvider.values.last;
                        return Column(
                          children: [
                            RadioListTile<LlmProvider>(
                              value: provider,
                              title: Text(provider.displayName),
                            ),
                            if (!isLast) const Divider(height: 1),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (_selectedLlmProvider == LlmProvider.ollama) ...[
                  TextField(
                    controller: _ollamaUrlCtrl,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Ollama 서버 주소',
                      hintText: 'http://192.168.0.10:11434',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _ollamaModelCtrl,
                    decoration: const InputDecoration(
                      labelText: '모델 이름',
                      hintText: 'llama3.1',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ] else
                  TextField(
                    controller: _llmApiKeyControllers[_selectedLlmProvider],
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: '${_selectedLlmProvider.displayName} API Key',
                      hintText: 'sk-...',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _saveLlm,
                        icon: const Icon(Icons.save_outlined, size: 18),
                        label: const Text('저장'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _llmTesting ? null : _testLlmConnection,
                        icon: _llmTesting
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.wifi_tethering, size: 18),
                        label: const Text('연결 테스트'),
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
                      color: _llmTestOk
                          ? colorScheme.primaryContainer
                          : colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _llmTestResult!,
                      style: TextStyle(
                        color: _llmTestOk
                            ? colorScheme.onPrimaryContainer
                            : colorScheme.onErrorContainer,
                      ),
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

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
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OutlinedButton(
          onPressed: checking ? null : onPressed,
          child: Text(checking ? '확인 중…' : label),
        ),
        if (result != null) ...[
          const SizedBox(height: 6),
          Text(
            result.text,
            style: TextStyle(
              fontSize: 12,
              height: 1.4,
              color: switch (result.tone) {
                _HealthTone.ok => colorScheme.primary,
                _HealthTone.pending => colorScheme.tertiary,
                _HealthTone.failed => colorScheme.error,
              },
            ),
          ),
        ],
      ],
    );
  }
}
