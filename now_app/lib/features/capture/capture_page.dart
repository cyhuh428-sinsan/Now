import 'dart:io';
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../../repositories/repository_providers.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:uuid/uuid.dart';
import '../../core/database/app_database.dart';
import '../../repositories/local/capture_repository.dart';
import '../../llm/providers/llm_providers.dart';
import 'package:go_router/go_router.dart';

// ============================================================
// Providers
// ============================================================

final _chatMessagesProvider = StateProvider<List<_ChatMessage>>((ref) => []);

// ============================================================
// Capture 화면
// ============================================================

class CapturePage extends ConsumerStatefulWidget {
  const CapturePage({super.key});

  @override
  ConsumerState<CapturePage> createState() => _CapturePageState();
}

class _CapturePageState extends ConsumerState<CapturePage> {
  // 입력 상태
  _CaptureMode _mode = _CaptureMode.none;
  final _textController = TextEditingController();
  File? _selectedImage;

  // 처리 상태
  _ProcessStatus _status = _ProcessStatus.idle;
  List<_ExtractedResult> _results = [];
  String? _errorMessage;

  // STT
  final SpeechToText _speech = SpeechToText();
  bool _speechAvailable = false;
  bool _isListening = false;
  String _sttPartial = '';
  String _sttFinal = '';
  Timer? _silenceTimer;

  @override
  void initState() {
    super.initState();
    _initSpeech();
  }

  @override
  void dispose() {
    _textController.dispose();
    _silenceTimer?.cancel();
    _speech.stop();
    super.dispose();
  }

  // ── STT 초기화 ──
  void _initSpeech() async {
    _speechAvailable = await _speech.initialize(
      onStatus: (status) {
        if (!mounted) return;
        if ((status == 'done' || status == 'notListening') && _isListening) {
          _restartStt();
        }
      },
      onError: (error) {
        if (!mounted || !_isListening) return;
        final delay = error.errorMsg == 'error_busy'
            ? const Duration(milliseconds: 1500)
            : const Duration(milliseconds: 500);
        Future.delayed(delay, () {
          if (mounted && _isListening) _restartStt();
        });
      },
    );
  }

  void _restartStt() async {
    _speech.stop();
    await Future.delayed(const Duration(milliseconds: 100));
    if (mounted && _isListening) _startSttListening();
  }

  void _startSttListening() async {
    if (_speech.isListening) return;
    await _speech.listen(
      onResult: (result) {
        final text = result.recognizedWords.trim();
        if (text.isNotEmpty) {
          setState(() => _sttPartial = text);
          _resetSilenceTimer();
        }
        if (result.finalResult && text.isNotEmpty) {
          setState(() {
            _sttFinal = '$_sttFinal $text'.trim();
            _sttPartial = '';
          });
          _silenceTimer?.cancel();
        }
      },
      localeId: 'ko_KR',
      listenFor: const Duration(seconds: 300),
      pauseFor: const Duration(seconds: 10),
      listenOptions: SpeechListenOptions(
        partialResults: true,
        cancelOnError: false,
        listenMode: ListenMode.dictation,
      ),
    );
  }

  void _resetSilenceTimer() {
    _silenceTimer?.cancel();
    _silenceTimer = Timer(const Duration(seconds: 3), () {
      if (!mounted) return;
      if (_sttPartial.isNotEmpty) {
        setState(() {
          _sttFinal = '$_sttFinal $_sttPartial'.trim();
          _sttPartial = '';
        });
      }
    });
  }

  void _toggleVoice() {
    if (_isListening) {
      // 녹음 중지
      _speech.stop();
      _silenceTimer?.cancel();
      setState(() {
        _isListening = false;
        if (_sttPartial.isNotEmpty) {
          _sttFinal = '$_sttFinal $_sttPartial'.trim();
          _sttPartial = '';
        }
      });
    } else {
      // 녹음 시작
      setState(() {
        _isListening = true;
        _sttFinal = '';
        _sttPartial = '';
      });
      _startSttListening();
    }
  }

  // ── 사진 선택 ──
  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, imageQuality: 85);
    if (picked == null) return;
    setState(() {
      _selectedImage = File(picked.path);
      _mode = _CaptureMode.photo;
    });
  }

  // ── LLM 처리 ──
  Future<void> _process() async {
    if (_status == _ProcessStatus.processing) return;

    String inputText = '';
    if (_mode == _CaptureMode.text) {
      inputText = _textController.text.trim();
      if (inputText.isEmpty) return;
    } else if (_mode == _CaptureMode.photo) {
      if (_selectedImage == null) return;
      inputText = '[사진 입력] ${_selectedImage!.path}';
    } else if (_mode == _CaptureMode.voice) {
      inputText = _sttFinal.trim();
      if (inputText.isEmpty) return;
    }

    setState(() {
      _status = _ProcessStatus.processing;
      _errorMessage = null;
    });

    try {
      final llm = await ref.read(llmRepositoryProvider.future);
      if (llm == null) {
        setState(() {
          _status = _ProcessStatus.error;
          _errorMessage = 'LLM 설정을 먼저 완료해주세요';
        });
        return;
      }
      final response = await llm.chat(_buildCapturePrompt(inputText));
      final parsed = _parseResults(response);

      // ── confidence 기반 라우팅 ──
      // ≥ 0.85: 자동 저장, 0.60~0.85: 확인 요청, < 0.60: 검토 필요 표시
      final processed = <_ExtractedResult>[];
      int autoSavedCount = 0;
      for (final r in parsed) {
        if (r.confidence >= 0.85) {
          await _save(r);
          processed.add(_ExtractedResult(
            domain: r.domain,
            summary: r.summary,
            confidence: r.confidence,
            dataJson: r.dataJson,
            autoSaved: true,
          ));
          autoSavedCount++;
        } else {
          processed.add(r);
        }
      }

      if (mounted) {
        if (autoSavedCount > 0) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('$autoSavedCount건 자동 저장됐습니다')),
          );
        }
        setState(() {
          _results = processed;
          _status = _ProcessStatus.done;
        });
      }
    } catch (e) {
      setState(() {
        _status = _ProcessStatus.error;
        _errorMessage = '처리 중 오류가 발생했습니다.\n$e';
      });
    }
  }

  // ── LLM 프롬프트 ──
  String _buildCapturePrompt(String input) {
    final now = DateTime.now();
    final today =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return '''
다음 입력을 분석해서 해당하는 모든 도메인을 추출하세요.
하나의 입력에서 여러 도메인이 나올 수 있습니다.

[오늘 날짜] $today

[입력]
$input

[도메인 종류]
- 살림: 수입/지출 (금액이 포함된 경우)
- 식사: 식사 기록 (아침/점심/저녁/간식, 음식명, 금액)
- 건강: 수면/증상/약/병원/컨디션
- 일정: 날짜/시간/장소가 있는 약속
- 할일: 해야 할 일
- 메모: 아이디어/중요기록/생각

[추출 규칙]
- confidence는 0.0~1.0
- 날짜는 반드시 "YYYY-MM-DD" 형식
- 금액은 숫자만 (원 단위)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "captures": [
    {
      "domain": "살림",
      "summary": "한 줄 요약",
      "data": {
        "direction": "지출",
        "amount": 6000,
        "category": "식비",
        "memo": "스타벅스 아메리카노"
      },
      "confidence": 0.92
    },
    {
      "domain": "식사",
      "summary": "한 줄 요약",
      "data": {
        "mealType": "점심",
        "description": "김치찌개",
        "amount": 9000
      },
      "confidence": 0.90
    },
    {
      "domain": "건강",
      "summary": "한 줄 요약",
      "data": {
        "type": "hospital",
        "hospitalName": "서울내과",
        "department": "내과",
        "reason": "감기",
        "amount": 15000
      },
      "confidence": 0.88
    }
  ]
}
''';
  }

  // ── 결과 파싱 ──
  List<_ExtractedResult> _parseResults(String response) {
    try {
      final jsonMatch = RegExp(r'\{[\s\S]*\}').firstMatch(response);
      if (jsonMatch == null) return [];
      final decoded = jsonDecode(jsonMatch.group(0)!);
      final captures = decoded['captures'] as List<dynamic>? ?? [];
      return captures.map((item) {
        return _ExtractedResult(
          domain: item['domain'] as String? ?? '메모',
          summary: item['summary'] as String? ?? '',
          confidence: (item['confidence'] as num?)?.toDouble() ?? 0.5,
          dataJson: Map<String, dynamic>.from(item['data'] as Map? ?? {}),
        );
      }).toList();
    } catch (e) {
      return [
        _ExtractedResult(
          domain: '메모',
          summary: response,
          confidence: 0.5,
          dataJson: {'raw': response},
        )
      ];
    }
  }

  // ── 저장 ──
  Future<void> _save(_ExtractedResult result) async {
    try {
      final repo = ref.read(captureRepositoryProvider);
      final captureId = await repo.saveCaptureItem(
        sourceType: _mode == _CaptureMode.photo
            ? 'photo'
            : _mode == _CaptureMode.voice
                ? 'voice'
                : 'text',
        rawText: _mode == _CaptureMode.voice
            ? _sttFinal
            : _textController.text.isNotEmpty
                ? _textController.text
                : null,
        assetUri: _selectedImage?.path,
      );
      final extractedId = await repo.saveExtractedCapture(
        captureId: captureId,
        domain: result.domain,
        entities: result.dataJson,
        confidence: result.confidence,
      );
      switch (result.domain) {
        case '살림':
          final data = result.dataJson;
          await repo.saveTransaction(
            extractedId: extractedId,
            direction: data['direction'] as String? ?? '지출',
            amount: (data['amount'] as num?)?.toInt() ?? 0,
            category: data['category'] as String?,
            memo: data['memo'] as String?,
          );
        case '식사':
          final data = result.dataJson;
          final mealRepo = ref.read(mealRepositoryProvider);
          final mealTypeStr = (data['mealType'] as String? ?? '기타').toLowerCase();
          final mealType = mealTypeStr.contains('아침') ? 'breakfast'
              : mealTypeStr.contains('점심') ? 'lunch'
              : mealTypeStr.contains('저녁') ? 'dinner'
              : 'snack';
          final mealId = const Uuid().v4();
          await mealRepo.saveMeal(MealRecordsCompanion.insert(
            mealId: mealId,
            userId: 'local',
            eatenAt: Value(DateTime.now()),
            mealType: Value(mealType),
            description: Value(data['description'] as String?),
            amount: Value((data['amount'] as num?)?.toInt()),
            isAmountEstimated: const Value(false),
            extractedId: Value(extractedId),
          ));
        case '건강':
          final data = result.dataJson;
          final healthRepo = ref.read(healthRepositoryProvider);
          final healthType = data['type'] as String? ?? '';
          if (healthType == 'hospital') {
            final hospitalAmount = (data['amount'] as num?)?.toInt();
            await healthRepo.saveHospital(HospitalRecordsCompanion(
              hospitalId: Value(const Uuid().v4()),
              userId: const Value('local'),
              hospitalName: Value(data['hospitalName'] as String? ?? '병원'),
              department: Value(data['department'] as String?),
              reason: Value(data['reason'] as String?),
              diagnosis: const Value(null),
              amount: Value(hospitalAmount),
            ));
          } else {
            await repo.saveMemo(
              extractedId: extractedId,
              content: result.summary,
              tags: result.domain,
            );
          }
        default:
          await repo.saveMemo(
            extractedId: extractedId,
            content: result.summary,
            tags: result.domain,
          );
      }
      await repo.updateCaptureStatus(captureId, 'committed');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${result.domain} 저장됐습니다')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('저장 실패: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final chatMessages = ref.watch(_chatMessagesProvider);
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Color(0xFF111827)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          '기록하기',
          style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Color(0xFF111827)),
        ),
        centerTitle: true,
      ),
      body: _status == _ProcessStatus.done
          ? _ResultView(
              results: _results,
              onSave: _save,
              onReset: () => setState(() {
                _status = _ProcessStatus.idle;
                _results = [];
                _mode = _CaptureMode.none;
                _selectedImage = null;
                _sttFinal = '';
                _textController.clear();
              }),
            )
          : _buildInputBody(chatMessages),
    );
  }

  Widget _buildInputBody(List<_ChatMessage> chatMessages) {
    return Column(
      children: [
        // ── 입력 영역 ──
        Expanded(
          child: _InputView(
            mode: _mode,
            status: _status,
            textController: _textController,
            selectedImage: _selectedImage,
            errorMessage: _errorMessage,
            isListening: _isListening,
            sttPartial: _sttPartial,
            sttFinal: _sttFinal,
            speechAvailable: _speechAvailable,
            onVoiceTap: () {
              setState(() => _mode = _CaptureMode.voice);
            },
            onVoiceToggle: _toggleVoice,
            onPhotoTap: () => _showPhotoOptions(),
            onTextTap: () => setState(() => _mode = _CaptureMode.text),
            onProcess: _process,
            onSttEdited: (v) => setState(() => _sttFinal = v),
          ),
        ),

        // ── LLM 질문 버튼 ──
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: OutlinedButton.icon(
              onPressed: () => context.push('/llm/chat'),
              icon: const Icon(Icons.chat_bubble_outline, size: 16),
              label: const Text('LLM에게 질문하기'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF2563EB),
                side: const BorderSide(color: Color(0xFF2563EB)),
                minimumSize: const Size(double.infinity, 44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _showPhotoOptions() {
    showModalBottomSheet(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('카메라로 찍기'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('갤러리에서 선택'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
// 입력 화면
// ============================================================

class _InputView extends StatefulWidget {
  final _CaptureMode mode;
  final _ProcessStatus status;
  final TextEditingController textController;
  final File? selectedImage;
  final String? errorMessage;
  final bool isListening;
  final String sttPartial;
  final String sttFinal;
  final bool speechAvailable;
  final VoidCallback onVoiceTap;
  final VoidCallback onVoiceToggle;
  final VoidCallback onPhotoTap;
  final VoidCallback onTextTap;
  final VoidCallback onProcess;
  final ValueChanged<String>? onSttEdited;

  const _InputView({
    required this.mode,
    required this.status,
    required this.textController,
    required this.selectedImage,
    required this.errorMessage,
    required this.isListening,
    required this.sttPartial,
    required this.sttFinal,
    required this.speechAvailable,
    required this.onVoiceTap,
    required this.onVoiceToggle,
    required this.onPhotoTap,
    required this.onTextTap,
    required this.onProcess,
    this.onSttEdited,
  });

  @override
  State<_InputView> createState() => _InputViewState();
}

class _InputViewState extends State<_InputView> {
  late TextEditingController _sttEditCtrl;

  @override
  void initState() {
    super.initState();
    _sttEditCtrl = TextEditingController(text: widget.sttFinal);
  }

  @override
  void didUpdateWidget(_InputView oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 녹음 중지됐을 때 텍스트 업데이트
    if (oldWidget.isListening && !widget.isListening && widget.sttFinal.isNotEmpty) {
      _sttEditCtrl.text = widget.sttFinal;
    }
  }

  @override
  void dispose() {
    _sttEditCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mode = widget.mode;
    final status = widget.status;
    final errorMessage = widget.errorMessage;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '어떻게 기록할까요?',
            style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF111827)),
          ),
          const SizedBox(height: 6),
          const Text(
            '말하거나, 사진 찍거나, 직접 입력하세요.\nLLM이 자동으로 분류해서 저장합니다.',
            style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
          ),
          const SizedBox(height: 16),

          // 입력 방식 선택 버튼 3개
          Row(
            children: [
              _ModeButton(
                icon: Icons.mic_outlined,
                label: '음성',
                isSelected: mode == _CaptureMode.voice,
                onTap: widget.onVoiceTap,
              ),
              const SizedBox(width: 12),
              _ModeButton(
                icon: Icons.camera_alt_outlined,
                label: '사진',
                isSelected: mode == _CaptureMode.photo,
                onTap: widget.onPhotoTap,
              ),
              const SizedBox(width: 12),
              _ModeButton(
                icon: Icons.edit_outlined,
                label: '텍스트',
                isSelected: mode == _CaptureMode.text,
                onTap: widget.onTextTap,
              ),
            ],
          ),
          const SizedBox(height: 12),

          // 모드별 입력 영역
          Expanded(child: _buildModeContent(context)),

          if (errorMessage != null) ...[
            const SizedBox(height: 8),
            Text(errorMessage,
                style: const TextStyle(fontSize: 13, color: Color(0xFFEF4444))),
          ],

          const SizedBox(height: 8),

          if (mode != _CaptureMode.none)
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: status == _ProcessStatus.processing ? null : widget.onProcess,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: status == _ProcessStatus.processing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : const Text('분석하기',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildModeContent(BuildContext context) {
    final mode = widget.mode;
    final isListening = widget.isListening;
    final sttPartial = widget.sttPartial;
    final sttFinal = widget.sttFinal;
    final speechAvailable = widget.speechAvailable;
    final selectedImage = widget.selectedImage;
    final textController = widget.textController;
    if (mode == _CaptureMode.text) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: TextField(
          controller: textController,
          maxLines: null,
          expands: true,
          textAlignVertical: TextAlignVertical.top,
          decoration: const InputDecoration(
            hintText: '예: "병원 다녀왔어, 처방비 3만원 냈어"\n"내일 오전 10시 미팅 있어"\n"커피값 6천원"',
            hintStyle: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
            contentPadding: EdgeInsets.all(16),
            border: InputBorder.none,
          ),
        ),
      );
    }

    if (mode == _CaptureMode.photo && selectedImage != null) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.file(selectedImage, fit: BoxFit.cover),
        ),
      );
    }

    if (mode == _CaptureMode.voice) {
      return Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isListening
                ? const Color(0xFF2563EB)
                : const Color(0xFFE5E7EB),
          ),
        ),
        child: Column(
          children: [
            // 녹음 버튼
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: speechAvailable ? widget.onVoiceToggle : null,
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: isListening
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF2563EB),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isListening ? Icons.stop : Icons.mic,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      isListening
                          ? '녹음 중... (탭하면 중지)'
                          : sttFinal.isNotEmpty
                              ? '녹음 완료'
                              : speechAvailable
                                  ? '마이크 버튼을 눌러 시작'
                                  : '마이크를 사용할 수 없습니다',
                      style: TextStyle(
                        fontSize: 14,
                        color: isListening
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF6B7280),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // 실시간 텍스트 / 편집 가능 텍스트
            if (sttPartial.isNotEmpty || sttFinal.isNotEmpty)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: isListening
                      ? SingleChildScrollView(
                          child: Text(
                            sttFinal + (sttPartial.isNotEmpty ? ' $sttPartial' : ''),
                            style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
                          ),
                        )
                      : TextField(
                          controller: _sttEditCtrl,
                          maxLines: null,
                          expands: true,
                          style: const TextStyle(fontSize: 14, color: Color(0xFF111827)),
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            hintText: '내용을 수정할 수 있어요',
                            contentPadding: EdgeInsets.all(10),
                          ),
                          onChanged: (v) => widget.onSttEdited?.call(v),
                        ),
                ),
              ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }
}

// ============================================================
// LLM 채팅 인터페이스
// ============================================================

class _ChatView extends StatefulWidget {
  final List<_ChatMessage> messages;
  final TextEditingController controller;
  final bool isLoading;
  final VoidCallback onSend;

  const _ChatView({
    required this.messages,
    required this.controller,
    required this.isLoading,
    required this.onSend,
  });

  @override
  State<_ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<_ChatView> {
  final ScrollController _scroll = ScrollController();

  @override
  void didUpdateWidget(_ChatView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.messages.length != oldWidget.messages.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(
            _scroll.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 메시지 목록
        Expanded(
          child: widget.messages.isEmpty
              ? const Center(
                  child: Text(
                    'LLM에게 무엇이든 물어보세요',
                    style:
                        TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                  ),
                )
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  itemCount: widget.messages.length +
                      (widget.isLoading ? 1 : 0),
                  itemBuilder: (context, index) {
                    if (index == widget.messages.length) {
                      return const Align(
                        alignment: Alignment.centerLeft,
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 8),
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFF2563EB)),
                          ),
                        ),
                      );
                    }
                    final msg = widget.messages[index];
                    return _ChatBubble(message: msg);
                  },
                ),
        ),

        // 입력창
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: TextField(
                    controller: widget.controller,
                    onSubmitted: (_) => widget.onSend(),
                    decoration: const InputDecoration(
                      hintText: 'LLM에게 질문하기...',
                      hintStyle:
                          TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: widget.isLoading ? null : widget.onSend,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: widget.isLoading
                        ? const Color(0xFF9CA3AF)
                        : const Color(0xFF2563EB),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.send, color: Colors.white, size: 18),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ChatBubble extends StatelessWidget {
  final _ChatMessage message;
  const _ChatBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isUser
              ? const Color(0xFF2563EB)
              : Colors.white,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isUser ? 16 : 4),
            bottomRight: Radius.circular(isUser ? 4 : 16),
          ),
          border: isUser
              ? null
              : Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Text(
          message.text,
          style: TextStyle(
            fontSize: 14,
            color: isUser ? Colors.white : const Color(0xFF111827),
          ),
        ),
      ),
    );
  }
}

// ============================================================
// 결과 화면
// ============================================================

class _ResultView extends StatefulWidget {
  final List<_ExtractedResult> results;
  final Future<void> Function(_ExtractedResult) onSave;
  final VoidCallback onReset;

  const _ResultView({
    required this.results,
    required this.onSave,
    required this.onReset,
  });

  @override
  State<_ResultView> createState() => _ResultViewState();
}

class _ResultViewState extends State<_ResultView> {
  final Set<int> _savingIndexes = {};

  @override
  Widget build(BuildContext context) {
    final results = widget.results;
    final onReset = widget.onReset;
    if (results.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('추출된 정보가 없습니다',
                style: TextStyle(fontSize: 15, color: Color(0xFF6B7280))),
            const SizedBox(height: 16),
            TextButton(onPressed: onReset, child: const Text('다시 시도')),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('추출 결과',
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827))),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.separated(
              itemCount: results.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final r = results[index];
                return _ConfidenceCard(
                  result: r,
                  isSaving: _savingIndexes.contains(index),
                  onSave: r.autoSaved
                      ? null
                      : () async {
                          setState(() => _savingIndexes.add(index));
                          await widget.onSave(r);
                          if (mounted) {
                            setState(() => _savingIndexes.remove(index));
                          }
                        },
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: onReset,
              child: const Text('다시 입력',
                  style: TextStyle(color: Color(0xFF6B7280))),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================
// Confidence 카드 위젯
// ============================================================

class _ConfidenceCard extends StatelessWidget {
  final _ExtractedResult result;
  final bool isSaving;
  final VoidCallback? onSave; // null = 자동저장됨

  const _ConfidenceCard({
    required this.result,
    required this.isSaving,
    required this.onSave,
  });

  // ── confidence 레벨 ──
  // 0 = high (≥0.85), 1 = medium (0.60~), 2 = low (<0.60)
  int get _level => result.confidence >= 0.85
      ? 0
      : result.confidence >= 0.60
          ? 1
          : 2;

  static const _borderColors = [
    Color(0xFF10B981), // high: 초록
    Color(0xFFF59E0B), // medium: 노랑
    Color(0xFFEF4444), // low: 빨강
  ];
  static const _badgeBgColors = [
    Color(0xFFD1FAE5),
    Color(0xFFFEF3C7),
    Color(0xFFFEE2E2),
  ];
  static const _badgeTextColors = [
    Color(0xFF065F46),
    Color(0xFF92400E),
    Color(0xFF991B1B),
  ];
  static const _badgeLabels = ['높음', '보통', '낮음'];
  static const _badgeIcons = [
    Icons.check_circle_outline,
    Icons.help_outline,
    Icons.warning_amber_outlined,
  ];

  @override
  Widget build(BuildContext context) {
    final lv = _level;
    final pct = (result.confidence * 100).toStringAsFixed(0);
    final isAutoSaved = result.autoSaved;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isAutoSaved
              ? const Color(0xFF10B981)
              : _borderColors[lv],
          width: isAutoSaved ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 도메인 + confidence 배지
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(result.domain,
                          style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF2563EB))),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: isAutoSaved
                            ? const Color(0xFFD1FAE5)
                            : _badgeBgColors[lv],
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isAutoSaved
                                ? Icons.check_circle
                                : _badgeIcons[lv],
                            size: 11,
                            color: isAutoSaved
                                ? const Color(0xFF065F46)
                                : _badgeTextColors[lv],
                          ),
                          const SizedBox(width: 3),
                          Text(
                            isAutoSaved
                                ? '자동저장됨'
                                : '신뢰도 $pct% · ${_badgeLabels[lv]}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: isAutoSaved
                                  ? const Color(0xFF065F46)
                                  : _badgeTextColors[lv],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(result.summary,
                    style: const TextStyle(
                        fontSize: 14, color: Color(0xFF111827))),
                // low confidence 경고 메시지
                if (!isAutoSaved && lv == 2) ...[
                  const SizedBox(height: 4),
                  const Text(
                    '신뢰도가 낮습니다. 내용을 확인 후 저장하세요.',
                    style: TextStyle(
                        fontSize: 11, color: Color(0xFFEF4444)),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          // 버튼 영역
          if (isAutoSaved)
            const Icon(Icons.check_circle,
                color: Color(0xFF10B981), size: 28)
          else
            ElevatedButton(
              onPressed: isSaving ? null : onSave,
              style: ElevatedButton.styleFrom(
                backgroundColor: lv == 2
                    ? const Color(0xFFEF4444)
                    : const Color(0xFF2563EB),
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 8),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: isSaving
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : Text(lv == 2 ? '저장(확인)' : '저장',
                      style: const TextStyle(
                          fontSize: 13, color: Colors.white)),
            ),
        ],
      ),
    );
  }
}

// ============================================================
// 공통 위젯
// ============================================================

class _ModeButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _ModeButton({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: isSelected
                ? const Color(0xFFEFF6FF)
                : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected
                  ? const Color(0xFF2563EB)
                  : const Color(0xFFE5E7EB),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon,
                  size: 24,
                  color: isSelected
                      ? const Color(0xFF2563EB)
                      : const Color(0xFF9CA3AF)),
              const SizedBox(height: 4),
              Text(label,
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: isSelected
                          ? FontWeight.w600
                          : FontWeight.normal,
                      color: isSelected
                          ? const Color(0xFF2563EB)
                          : const Color(0xFF6B7280))),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================
// 상태 열거형 및 모델
// ============================================================

enum _CaptureMode { none, voice, photo, text }

enum _ProcessStatus { idle, processing, done, error }

class _ExtractedResult {
  final String domain;
  final String summary;
  final double confidence;
  final Map<String, dynamic> dataJson;
  final bool autoSaved;

  const _ExtractedResult({
    required this.domain,
    required this.summary,
    required this.confidence,
    required this.dataJson,
    this.autoSaved = false,
  });
}

class _ChatMessage {
  final String text;
  final bool isUser;
  const _ChatMessage({required this.text, required this.isUser});
}

// ============================================================
// LLM 채팅 전용 페이지
// ============================================================

class LlmChatPage extends ConsumerStatefulWidget {
  const LlmChatPage({super.key});

  @override
  ConsumerState<LlmChatPage> createState() => _LlmChatPageState();
}

class _LlmChatPageState extends ConsumerState<LlmChatPage> {
  final _ctrl = TextEditingController();
  final _scroll = ScrollController();
  bool _loading = false;

  @override
  void dispose() {
    _ctrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final question = _ctrl.text.trim();
    if (question.isEmpty || _loading) return;

    _ctrl.clear();
    final messages = [...ref.read(_chatMessagesProvider)];
    messages.add(_ChatMessage(text: question, isUser: true));
    ref.read(_chatMessagesProvider.notifier).state = messages;
    setState(() => _loading = true);

    try {
      final llm = await ref.read(llmRepositoryProvider.future);
      if (llm == null) {
        final m = [...ref.read(_chatMessagesProvider)];
        m.add(const _ChatMessage(text: 'LLM 설정을 먼저 완료해주세요', isUser: false));
        ref.read(_chatMessagesProvider.notifier).state = m;
      } else {
        final response = await llm.chat(question);
        final m = [...ref.read(_chatMessagesProvider)];
        m.add(_ChatMessage(text: response, isUser: false));
        ref.read(_chatMessagesProvider.notifier).state = m;
      }
    } catch (e) {
      final m = [...ref.read(_chatMessagesProvider)];
      m.add(_ChatMessage(text: '오류: $e', isUser: false));
      ref.read(_chatMessagesProvider.notifier).state = m;
    } finally {
      if (mounted) setState(() => _loading = false);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) {
          _scroll.animateTo(_scroll.position.maxScrollExtent,
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOut);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(_chatMessagesProvider);
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left, color: Color(0xFF111827)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'LLM 질문',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
        ),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: () {
              ref.read(_chatMessagesProvider.notifier).state = [];
            },
            child: const Text('초기화', style: TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
          ),
        ],
      ),
      body: Column(
        children: [
          // 메시지 목록
          Expanded(
            child: messages.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.chat_bubble_outline, size: 48, color: Color(0xFFD1D5DB)),
                        SizedBox(height: 12),
                        Text('LLM에게 무엇이든 물어보세요', style: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF))),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                    itemCount: messages.length + (_loading ? 1 : 0),
                    itemBuilder: (_, i) {
                      if (i == messages.length) {
                        return const Align(
                          alignment: Alignment.centerLeft,
                          child: Padding(
                            padding: EdgeInsets.symmetric(vertical: 8),
                            child: SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB)),
                            ),
                          ),
                        );
                      }
                      return _ChatBubble(message: messages[i]);
                    },
                  ),
          ),

          // 입력창
          Container(
            color: Colors.white,
            padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.of(context).viewInsets.bottom + 12),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: TextField(
                      controller: _ctrl,
                      onSubmitted: (_) => _send(),
                      maxLines: null,
                      decoration: const InputDecoration(
                        hintText: 'LLM에게 질문하기...',
                        hintStyle: TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
                        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _loading ? null : _send,
                  child: Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(
                      color: _loading ? const Color(0xFFE5E7EB) : const Color(0xFF2563EB),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.send_rounded, size: 18,
                      color: _loading ? const Color(0xFF9CA3AF) : Colors.white,
                    ),
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
