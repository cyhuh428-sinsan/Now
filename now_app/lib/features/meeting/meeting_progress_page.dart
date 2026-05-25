import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:speech_to_text/speech_to_text.dart';
import 'package:file_picker/file_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:io';
import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_sound/flutter_sound.dart';
import 'package:path_provider/path_provider.dart';
import '../../llm/services/llm_settings_service.dart';
import '../home/home_page.dart';
import '../../llm/providers/llm_providers.dart';
import '../../services/feature_settings_service.dart';
import '../items/items_review_page.dart';

// ============================================================
// 모델
// ============================================================
class TranscriptSegmentItem {
  final String id;
  final String text;
  final String speakerLabel; // 'user' | 'other' | '파일'
  final DateTime timestamp;
  final String source;

  const TranscriptSegmentItem({
    required this.id,
    required this.text,
    required this.speakerLabel,
    required this.timestamp,
    required this.source,
  });
}

// ============================================================
// Providers
// ============================================================
final transcriptSegmentsProvider =
    StateProvider<List<TranscriptSegmentItem>>((ref) => []);
final meetingElapsedProvider =
    StateProvider<Duration>((ref) => Duration.zero);
final isListeningProvider = StateProvider<bool>((ref) => false);
final isExtractingProvider = StateProvider<bool>((ref) => false);
final pendingMeetingMetaProvider =
    StateProvider<Map<String, dynamic>?>((ref) => null);

// ============================================================
// 회의/면담/대화 진행 화면
// ============================================================
class MeetingProgressPage extends ConsumerStatefulWidget {
  final CalendarEventItem? event;
  final String recordType;           // 'meeting' | 'interview' | 'conversation' | 'memo'
  final String participantName;
  final String voiceInputMode;       // realtime | record_then_transcribe
  final DateTime? memoDate;
  final int silenceThresholdSeconds; // 화자 전환 침묵 기준 (기본 2초)

  const MeetingProgressPage({
    super.key,
    this.event,
    this.recordType = 'meeting',
    this.participantName = '',
    this.voiceInputMode = 'realtime',
    this.memoDate,
    this.silenceThresholdSeconds = 2,
  });

  @override
  ConsumerState<MeetingProgressPage> createState() =>
      _MeetingProgressPageState();
}

class _MeetingProgressPageState extends ConsumerState<MeetingProgressPage> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final SpeechToText _speech = SpeechToText();
  final FlutterSoundRecorder _recorder = FlutterSoundRecorder();
  String _whisperUrl = '';
  Timer? _chunkTimer;
  bool _useWhisper = false;
  String? _fullRecordingPath;

  // STT 상태
  bool _speechAvailable = false;
  String _partialBuffer = '';       // 실시간 미리보기 텍스트
  String _lastFlushedSnapshot = ''; // 마지막 저장된 텍스트 스냅샷 (Delta 계산용)
  String _currentSpeaker = 'user';  // 현재 화자
  DateTime? _lastCommitTime;        // 마지막 저장 시각 (병합 판단용)
  
  // 타이머
  Timer? _watchdogTimer;
  Timer? _silenceTimer;             // 침묵 감지 타이머
  late int _silenceSeconds; // 화자 전환 침묵 기준 (런타임 변경 가능)

  // ============================================================
  // 초기화
  // ============================================================
  @override
  void initState() {
    super.initState();
    _loadWhisperUrl();
    _silenceSeconds = widget.silenceThresholdSeconds;
    _initSpeech();
    _startMeetingTimer();
  }

  void _initSpeech() async {
    _speechAvailable = await _speech.initialize(
      onStatus: (status) {
        debugPrint('[STT STATUS] $status');
        if (!mounted) return;
        if ((status == 'done' || status == 'notListening') &&
            ref.read(isListeningProvider)) {
          _restartEngine();
        }
      },
      onError: (error) {
        debugPrint('[STT ERROR] ${error.errorMsg} / permanent: ${error.permanent}');
        if (!mounted) return;
        if (!ref.read(isListeningProvider)) return;
        final delay = error.errorMsg == 'error_busy'
            ? const Duration(milliseconds: 1500)
            : const Duration(milliseconds: 500);
        Future.delayed(delay, () {
          if (mounted && ref.read(isListeningProvider)) _restartEngine();
        });
      },
    );
  }

  Future<void> _loadWhisperUrl() async {
    final url = await LlmSettingsService().loadWhisperUrl();
    final tier = await LlmSettingsService().loadSttTier();
    if (mounted) {
      setState(() {
        _whisperUrl = url;
        _useWhisper = tier == 'tier2_local' && url.isNotEmpty;
      });
    }
  }

  // STT 엔진 재시작 (stop → delay → listen)
  void _restartEngine() async {
    debugPrint('[ENGINE] 재시작 시도, buffer="${_partialBuffer.trim()}"');
    // ※ 버퍼 저장 안 함 - Watchdog이 침묵 감지 시 저장
    _speech.stop();
    await Future.delayed(const Duration(milliseconds: 50));
    if (!mounted || !ref.read(isListeningProvider)) return;
    _startListening();
  }

  // STT 리스닝 시작 (dictation 모드, 5분)
  void _startListening() async {
    if (_speech.isListening) return;
    try {
      await _speech.listen(
        onResult: (result) {
          final fullText = result.recognizedWords.trim();

          if (fullText.isNotEmpty) {
            _partialBuffer = fullText;  // 전체 텍스트 그대로 저장
            if (mounted) setState(() {});
            _resetSilenceTimer();       // 침묵 타이머 리셋
          }

          // finalResult 오면 즉시 확정
          if (result.finalResult && fullText.isNotEmpty) {
            _flushSttBuffer(clearAll: true, reason: 'final');
          }
        },
        localeId: 'ko_KR',
        listenFor: const Duration(seconds: 300),
        pauseFor: const Duration(seconds: 60),
        listenOptions: SpeechListenOptions(
          partialResults: true,
          cancelOnError: false,
          listenMode: ListenMode.dictation,
        ),
      );
    } catch (e) {
      debugPrint('[STT] startListening error: $e');
    }
  }

  // 침묵 감지 타이머 리셋 (N초 후 자동 저장)
  void _resetSilenceTimer() {
    _silenceTimer?.cancel();
    _silenceTimer = Timer(Duration(seconds: _silenceSeconds), () {
      if (!mounted) return;
      if (!ref.read(isListeningProvider)) return;
      _flushSttBuffer(clearAll: true, reason: 'silence', switchSpeaker: false);
    });
  }

  // STT 버퍼를 Delta로 계산해서 저장
  void _flushSttBuffer({
    required bool clearAll,
    required String reason,
    bool switchSpeaker = false,
  }) {
    final current = _partialBuffer.trim();
    if (current.isEmpty) return;

    // Delta 계산: 이전 스냅샷 이후의 새 텍스트만 추출
    String delta;
    if (_lastFlushedSnapshot.isNotEmpty &&
        current.startsWith(_lastFlushedSnapshot)) {
      delta = current.substring(_lastFlushedSnapshot.length).trim();
    } else {
      delta = current;
    }

    // 스냅샷 갱신
    _lastFlushedSnapshot = clearAll ? '' : current;

    debugPrint('[$reason] current=${current.length}자 delta=${delta.length}자');

    if (delta.isNotEmpty) {
      _commitDelta(delta, reason: reason, switchSpeaker: switchSpeaker);
    }

    if (clearAll) {
      _partialBuffer = '';
      _lastFlushedSnapshot = '';
      _silenceTimer?.cancel();
      if (mounted) setState(() {});
    }
  }

  // Delta 텍스트를 세그먼트로 저장 (병합 또는 신규)
  void _commitDelta(String delta, {
    required String reason,
    required bool switchSpeaker,
  }) {
    final now = DateTime.now();
    final list = [...ref.read(transcriptSegmentsProvider)];

    // 병합 조건: 3초 이내 + 같은 화자 + 마지막 텍스트 20자 미만
    final canMerge = list.isNotEmpty &&
        list.last.source == 'device_stt' &&
        list.last.speakerLabel == _currentSpeaker &&
        _lastCommitTime != null &&
        now.difference(_lastCommitTime!) <= const Duration(seconds: 3) &&
        list.last.text.trim().length < 20;

    if (canMerge) {
      // 마지막 세그먼트에 병합
      final last = list.last;
      final mergedText = '${last.text.trimRight()} ${delta.trimLeft()}'.trim();
      list[list.length - 1] = TranscriptSegmentItem(
        id: last.id,
        text: mergedText,
        speakerLabel: last.speakerLabel,
        timestamp: last.timestamp,
        source: last.source,
      );
      debugPrint('[MERGE] → "$mergedText"');
    } else {
      // 새 세그먼트 생성
      final segment = TranscriptSegmentItem(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        text: delta,
        speakerLabel: _currentSpeaker,
        timestamp: now,
        source: 'device_stt',
      );
      list.add(segment);
      debugPrint('[NEW SEG] speaker=$_currentSpeaker text="$delta"');
    }

    ref.read(transcriptSegmentsProvider.notifier).state = list;
    _lastCommitTime = now;

    if (switchSpeaker) {
      _currentSpeaker = _currentSpeaker == 'user' ? 'other' : 'user';
      debugPrint('[SWITCH] → $_currentSpeaker');
    }

    _scrollToBottom();
  }

  void _addTranscriptSegment(
    String text, {
    required String source,
    required String speakerLabel,
  }) {
    final segment = TranscriptSegmentItem(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      text: text,
      speakerLabel: speakerLabel,
      timestamp: DateTime.now(),
      source: source,
    );
    ref
        .read(transcriptSegmentsProvider.notifier)
        .update((state) => [...state, segment]);
    _scrollToBottom();
  }

  // Watchdog: 500ms마다 실행
  // 1) 엔진 생존 확인
  // 2) 침묵 N초 → 저장 + 화자 전환

  // 버퍼 내용을 말풍선으로 저장

  // ============================================================
  // 마이크 ON/OFF
  // ============================================================
  bool get _recordThenTranscribe =>
      widget.voiceInputMode == 'record_then_transcribe';

  Future<void> _toggleListening() async {
    final isListening = ref.read(isListeningProvider);

    if (isListening) {
      if (_recordThenTranscribe) {
        await _stopFullRecordingAndTranscribe();
      } else if (_useWhisper) {
        await _stopWhisperRecording();
      } else {
        if (_partialBuffer.trim().isNotEmpty) {
          _flushSttBuffer(clearAll: true, reason: 'mic_off');
        }
        _speech.stop();
        _silenceTimer?.cancel();
        _watchdogTimer?.cancel();
      }
      _currentSpeaker = 'user';
      _partialBuffer = '';
      _lastFlushedSnapshot = '';
      ref.read(isListeningProvider.notifier).state = false;
      return;
    }

    if (!_recordThenTranscribe && !_speechAvailable) {
      _speechAvailable = await _speech.initialize();
      if (!_speechAvailable) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('마이크 초기화 실패')),
          );
        }
        return;
      }
    }

    // 켜기
    _partialBuffer = '';
    _lastFlushedSnapshot = '';
    _currentSpeaker = 'user';
    ref.read(isListeningProvider.notifier).state = true;
    if (_recordThenTranscribe) {
      await _startFullRecording();
    } else if (_useWhisper) {
      await _startWhisperRecording();
    } else {
      _startListening();
    }
  }

  // ============================================================
  // Whisper STT — 30초 청크 녹음 → 서버 전송
  // ============================================================
  String? _currentChunkPath;

  Future<void> _startFullRecording() async {
    final dir = await getApplicationDocumentsDirectory();
    final folder = Directory('${dir.path}/recordings');
    if (!await folder.exists()) {
      await folder.create(recursive: true);
    }
    _fullRecordingPath =
        '${folder.path}/${widget.recordType}_${DateTime.now().millisecondsSinceEpoch}.aac';
    await _recorder.openRecorder();
    await _recorder.startRecorder(
      toFile: _fullRecordingPath,
      codec: Codec.aacADTS,
      bitRate: 128000,
      sampleRate: 16000,
    );
  }

  Future<void> _stopFullRecordingAndTranscribe() async {
    final path = _fullRecordingPath;
    try {
      await _recorder.stopRecorder();
      await _recorder.closeRecorder();
    } catch (e) {
      debugPrint('[RECORDER] stop error: $e');
    }

    if (path == null) return;
    final file = File(path);
    if (!await file.exists() || await file.length() < 1000) return;

    if (_whisperUrl.trim().isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('음성 파일은 저장됐지만 STT 서버가 설정되지 않았습니다.')),
        );
      }
      return;
    }

    ref.read(isExtractingProvider.notifier).state = true;
    try {
      final dio = Dio();
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(path, filename: 'audio.aac'),
      });
      final response = await dio.post(
        '$_whisperUrl/transcribe',
        data: formData,
        options: Options(receiveTimeout: const Duration(seconds: 120)),
      );
      final text = response.data['text'] as String? ?? '';
      if (text.trim().isNotEmpty) {
        _addTranscriptSegment(
          text.trim(),
          source: 'recording_stt',
          speakerLabel: _currentSpeaker,
        );
      }
    } catch (e) {
      debugPrint('[RECORDING_STT] 전송 오류: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('녹음 변환 중 오류가 발생했습니다: $e')),
        );
      }
    } finally {
      if (mounted) ref.read(isExtractingProvider.notifier).state = false;
    }
  }

  Future<void> _startWhisperRecording() async {
    await _recorder.openRecorder();
    await _startNewChunk();

    // 30초마다 청크 전송
    _chunkTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      if (!ref.read(isListeningProvider)) return;
      await _sendWhisperChunk();
    });
  }

  Future<void> _startNewChunk() async {
    final dir = await getTemporaryDirectory();
    _currentChunkPath = '${dir.path}/chunk_${DateTime.now().millisecondsSinceEpoch}.aac';
    await _recorder.startRecorder(
      toFile: _currentChunkPath,
      codec: Codec.aacADTS,
      bitRate: 128000,
      sampleRate: 16000,
    );
  }

  Future<void> _stopWhisperRecording() async {
    _chunkTimer?.cancel();
    await _sendWhisperChunk();
    await _recorder.closeRecorder();
  }

  Future<void> _sendWhisperChunk() async {
    await _recorder.stopRecorder();
    final path = _currentChunkPath;
    if (path == null) return;

    final file = File(path);
    if (!await file.exists() || await file.length() < 1000) {
      // 너무 짧으면 무시하고 재시작
      await _restartWhisperChunk();
      return;
    }

    try {
      final dio = Dio();
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(path, filename: 'audio.m4a'),
      });
      final response = await dio.post(
        '$_whisperUrl/transcribe',
        data: formData,
        options: Options(receiveTimeout: const Duration(seconds: 60)),
      );
      final text = response.data['text'] as String? ?? '';
      if (text.trim().isNotEmpty) {
        _commitDelta(text.trim(), reason: 'whisper', switchSpeaker: false);
      }
    } catch (e) {
      debugPrint('[WHISPER] 전송 오류: $e');
    } finally {
      try {
        await file.delete();
      } catch (_) {}
      if (ref.read(isListeningProvider)) {
        await _restartWhisperChunk();
      }
    }
  }

  Future<void> _restartWhisperChunk() async {
    if (!ref.read(isListeningProvider)) return;
    await _startNewChunk();
  }

  // ============================================================
  // 회의 타이머
  // ============================================================
  void _startMeetingTimer() {
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;
      final current = ref.read(meetingElapsedProvider);
      ref.read(meetingElapsedProvider.notifier).state =
          current + const Duration(seconds: 1);
      return true;
    });
  }

  // ============================================================
  // 텍스트 직접 입력
  // ============================================================
  void _addTextSegment() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    final segment = TranscriptSegmentItem(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      text: text,
      speakerLabel: _currentSpeaker,
      timestamp: DateTime.now(),
      source: 'text_input',
    );
    ref
        .read(transcriptSegmentsProvider.notifier)
        .update((state) => [...state, segment]);
    _textController.clear();
    _scrollToBottom();
  }

  // ============================================================
  // 스크롤
  // ============================================================
  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // ============================================================
  // 종료 다이얼로그 → 텍스트 수정 → LLM 전송
  // ============================================================
  void _endMeeting() async {
    if (ref.read(isListeningProvider)) {
      await _toggleListening();
    }
    if (!mounted) return;
    final segments = ref.read(transcriptSegmentsProvider);
    final endSummary = widget.recordType == 'memo'
        ? '총 ${segments.length}개의 메모 내용이 기록되었습니다.\n종료 후 내용을 수정하고 저장 방식을 선택합니다.'
        : '총 ${segments.length}개의 발언이 기록되었습니다.\n종료 후 내용을 수정하고 저장 방식을 선택합니다.';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          widget.recordType == 'interview'
              ? '면담을 종료할까요?'
              : widget.recordType == 'conversation'
                  ? '대화를 종료할까요?'
                  : widget.recordType == 'memo'
                      ? '메모를 종료할까요?'
                      : '회의를 종료할까요?',
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
        ),
        content: Text(
          endSummary,
          style: const TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('계속 진행',
                style: TextStyle(color: Color(0xFF6B7280))),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _showTextEditScreen(segments);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('종료 및 수정',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  // 전체 텍스트 수정 화면
  void _showTextEditScreen(List<TranscriptSegmentItem> segments) {
    final fullText = segments.map((s) => s.text).join('\n');
    final editController = TextEditingController(text: fullText);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
            16, 16, 16, MediaQuery.of(ctx).viewInsets.bottom + 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ▼▼▼ [수정된 헤더 부분] ▼▼▼
            Row(
              children: [
                const Text('내용 수정',
                    style: TextStyle(
                        fontSize: 17, fontWeight: FontWeight.bold)),
                const Spacer(),
                
                // [1. 공유 버튼 추가]
                IconButton(
                  icon: const Icon(Icons.share, size: 22, color: Color(0xFF4B5563)),
                  tooltip: '텍스트 공유',
                  onPressed: () async {
                    // 현재 입력창에 있는 내용 그대로 공유
                    if (editController.text.trim().isNotEmpty) {
                      await SharePlus.instance.share(
                        ShareParams(text: editController.text),
                      );
                    }
                  },
                ),
                
                // [2. 기존 닫기 버튼]
                IconButton(
                  icon: const Icon(Icons.close, size: 24, color: Color(0xFF111827)),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            // ▲▲▲ 여기까지 수정 ▲▲▲

            const Text('저장 전 내용을 수정할 수 있습니다.',
                style:
                    TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
            const SizedBox(height: 12),
            
            // ... (아래 텍스트 필드와 버튼 코드는 기존과 동일) ...
            Container(
              height: 300,
              decoration: BoxDecoration(
                color: const Color(0xFFF9FAFB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: TextField(
                controller: editController,
                maxLines: null,
                expands: true,
                style: const TextStyle(
                    fontSize: 14, color: Color(0xFF111827), height: 1.5),
                decoration: const InputDecoration(
                  contentPadding: EdgeInsets.all(12),
                  border: InputBorder.none,
                  hintText: '내용을 입력하세요...',
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        final editedSegments =
                            _segmentsFromEditedText(editController.text);
                        _saveWithoutAnalysis(editedSegments);
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF2563EB),
                        side: const BorderSide(color: Color(0xFF2563EB)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('분석 없이 저장',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        final editedSegments =
                            _segmentsFromEditedText(editController.text);
                        _extractAndNavigate(editedSegments);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('LLM 분석 후 저장',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  List<TranscriptSegmentItem> _segmentsFromEditedText(String text) {
    final editedLines = text
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    return editedLines
        .map((line) => TranscriptSegmentItem(
              id: DateTime.now().microsecondsSinceEpoch.toString(),
              text: line,
              speakerLabel: 'user',
              timestamp: DateTime.now(),
              source: 'edited',
            ))
        .toList();
  }

  void _saveWithoutAnalysis(List<TranscriptSegmentItem> segments) {
    ref.read(extractedItemsProvider.notifier).state = [];
    _navigateToReview(segments: segments, usedLlmAnalysis: false);
  }

  // ============================================================
  // LLM 추출 → 결과 화면 이동
  // ============================================================
  Future<void> _extractAndNavigate(
      List<TranscriptSegmentItem> segments) async {
    ref.read(isExtractingProvider.notifier).state = true;

    try {
      final llmRepo = await ref.read(llmRepositoryProvider.future);

      if (llmRepo == null) {
        _navigateToReview(segments: segments, usedLlmAnalysis: false);
        return;
      }

      // LLM에는 화자 정보 제외, 텍스트만 전달
      final textSegments = segments.map((s) => s.text).toList();
      final featureSettings = await FeatureSettingsService.load();
      final extracted = await llmRepo.extractItems(
        textSegments,
        recordType: widget.recordType,
        participantName: widget.participantName,
        includeSpeakerSeparation: featureSettings.speakerSeparationEnabled,
        includeVoiceEmotion: featureSettings.voiceEmotionEnabled,
      );

      ref.read(extractedItemsProvider.notifier).state = extracted
          .map((item) => ExtractedItemData(
                id: DateTime.now().millisecondsSinceEpoch.toString(),
                itemType: item.itemType == 'decision'
                    ? ItemType.decision
                    : ItemType.action,
                content: item.content,
                confidence: item.confidence,
                ownerLabel: item.ownerLabel,
                dueDate: item.dueDate,
                dueTime: item.dueTime,
              ))
          .toList();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('추출 중 오류가 발생했습니다: $e')),
        );
      }
      _navigateToReview(segments: segments, usedLlmAnalysis: false);
      return;
    } finally {
      if (mounted) ref.read(isExtractingProvider.notifier).state = false;
    }

    _navigateToReview(segments: segments, usedLlmAnalysis: true);
  }

  void _navigateToReview({
    required List<TranscriptSegmentItem> segments,
    required bool usedLlmAnalysis,
  }) {
    final name = widget.participantName;
    final rType = widget.recordType;
    final dt = widget.memoDate ?? DateTime.now();
    final mm = dt.month.toString().padLeft(2, '0');
    final dd = dt.day.toString().padLeft(2, '0');
    final hh = dt.hour.toString().padLeft(2, '0');
    final mi = dt.minute.toString().padLeft(2, '0');
    final stamp = '$mm${dd}_$hh$mi';
    final defaultTitle = rType == 'interview'
        ? (name.isNotEmpty ? '면담_$name' : '면담_$stamp')
        : rType == 'conversation'
            ? (name.isNotEmpty ? '대화_$name' : '대화_$stamp')
            : rType == 'memo'
                ? '메모_$stamp'
            : '회의_$stamp';

    ref.read(pendingMeetingMetaProvider.notifier).state = {
      'title': widget.event?.title ?? defaultTitle,
      'recordType': rType,
      'participantName': name,
      'segmentCount': segments.length,
      'date': (widget.memoDate ?? DateTime.now()).toIso8601String(),
      'usedLlmAnalysis': usedLlmAnalysis,
      'voiceInputMode': widget.voiceInputMode,
      'audioFilePath': _fullRecordingPath,
      'segments': segments
          .map((s) => {
                'id': s.id,
                'text': s.text,
                'speakerLabel': s.speakerLabel,
                'timestamp': s.timestamp,
                'source': s.source,
              })
          .toList(),
    };
    ref.read(transcriptSegmentsProvider.notifier).state = [];
    ref.read(meetingElapsedProvider.notifier).state = Duration.zero;
    context.pushReplacement('/items/review');
  }

  // ============================================================
  // 파일 업로드 (.txt / .md)
  // ============================================================
  Future<void> _pickAndUploadFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['txt', 'md'],
    );
    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (file.path == null) return;

    try {
      final text = await File(file.path!).readAsString();
      if (text.trim().isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('파일 내용이 비어있습니다')),
          );
        }
        return;
      }

      final lines = text
          .split('\n')
          .map((l) => l.trim())
          .where((l) => l.isNotEmpty)
          .toList();

      final newSegments = lines
          .map((line) => TranscriptSegmentItem(
                id: DateTime.now().microsecondsSinceEpoch.toString() +
                    line.hashCode.toString(),
                text: line,
                speakerLabel: '파일',
                timestamp: DateTime.now(),
                source: 'file',
              ))
          .toList();

      ref.read(transcriptSegmentsProvider.notifier).update(
            (state) => [...state, ...newSegments]);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${lines.length}개 항목을 불러왔습니다')),
        );
      }
      _scrollToBottom();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('파일을 읽을 수 없습니다')),
        );
      }
    }
  }

  // ============================================================
  // Dispose
  // ============================================================
  @override
  void dispose() {
    _speech.stop();
    _silenceTimer?.cancel();
    _watchdogTimer?.cancel();
    _chunkTimer?.cancel();
    _recorder.closeRecorder();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  // ============================================================
  // Build
  // ============================================================
  @override
  Widget build(BuildContext context) {
    final segments = ref.watch(transcriptSegmentsProvider);
    final elapsed = ref.watch(meetingElapsedProvider);
    final isListening = ref.watch(isListeningProvider);
    final isExtracting = ref.watch(isExtractingProvider);
    final isMemo = widget.recordType == 'memo';
    final now = DateTime.now();
    final month = now.month.toString().padLeft(2, '0');
    final day = now.day.toString().padLeft(2, '0');
    final hour = now.hour.toString().padLeft(2, '0');
    final minute = now.minute.toString().padLeft(2, '0');
    final stamp = '$month${day}_$hour$minute';
    final title = widget.event?.title ??
        (widget.recordType == 'interview'
            ? '면담_$stamp'
            : widget.recordType == 'conversation'
                ? '대화_$stamp'
                : widget.recordType == 'memo'
                    ? '메모_$stamp'
                    : '회의_$stamp');
    final analysisStatusText =
        isMemo ? '메모 분석 중...' : 'Action/Decision 추출 중...';
    final analysisCountText =
        isMemo ? '${segments.length}개 메모 내용 분석 중' : '${segments.length}개 발언 분석 중';

    // 추출 중 로딩
    if (isExtracting) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F9FA),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const CircularProgressIndicator(color: Color(0xFF2563EB)),
              const SizedBox(height: 20),
              Text(analysisStatusText,
                  style: const TextStyle(fontSize: 15, color: Color(0xFF6B7280))),
              const SizedBox(height: 8),
              Text(analysisCountText,
                  style: const TextStyle(
                      fontSize: 13, color: Color(0xFF9CA3AF))),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios,
              size: 18, color: Color(0xFF111827)),
          onPressed: () => showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              title: Text(
                widget.recordType == 'interview'
                    ? '면담을 나가시겠습니까?'
                    : widget.recordType == 'conversation'
                        ? '대화를 나가시겠습니까?'
                        : widget.recordType == 'memo'
                            ? '메모를 나가시겠습니까?'
                            : '회의를 나가시겠습니까?',
                style: const TextStyle(
                    fontSize: 17, fontWeight: FontWeight.bold),
              ),
              content: const Text('기록된 내용이 사라집니다.',
                  style:
                      TextStyle(fontSize: 14, color: Color(0xFF6B7280))),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('취소',
                      style: TextStyle(color: Color(0xFF6B7280))),
                ),
                TextButton(
                  onPressed: () {
                    ref
                        .read(transcriptSegmentsProvider.notifier)
                        .state = [];
                    ref.read(meetingElapsedProvider.notifier).state =
                        Duration.zero;
                    Navigator.pop(ctx);
                    context.pop();
                  },
                  child: const Text('나가기',
                      style: TextStyle(color: Color(0xFFEF4444))),
                ),
              ],
            ),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(
                widget.recordType == 'interview'
                    ? Icons.handshake_outlined
                    : widget.recordType == 'conversation'
                        ? Icons.chat_bubble_outline
                        : widget.recordType == 'memo'
                            ? Icons.edit_note
                        : Icons.groups_outlined,
                size: 16,
                color: const Color(0xFF6B7280),
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(title,
                    style: const TextStyle(
                        fontSize: 15,
                        color: Color(0xFF111827),
                        fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis),
              ),
            ]),
            _TimerText(elapsed: elapsed),
          ],
        ),
        actions: [
          TextButton(
            onPressed: _endMeeting,
            child: const Text('종료',
                style: TextStyle(
                    color: Color(0xFFEF4444),
                    fontWeight: FontWeight.w600)),
          ),
        ],
      ),
      body: Column(
        children: [
          // 듣는 중 상태 바 + 화자 변경 버튼
          if (isListening)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              color: const Color(0xFF2563EB).withValues(alpha: 0.08),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const _PulsingDot(),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '듣는 중... ${_currentSpeaker == "user" ? "나" : "상대방"}',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF2563EB)),
                    ),
                  ),
                  // 화자 변경 버튼 (수동)
                  GestureDetector(
                    onTap: () {
                      _flushSttBuffer(clearAll: true, reason: 'manual', switchSpeaker: true);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF2563EB)),
                      ),
                      child: const Row(children: [
                        Icon(Icons.swap_horiz, size: 14, color: Color(0xFF2563EB)),
                        SizedBox(width: 4),
                        Text('화자 변경',
                            style: TextStyle(
                                fontSize: 11,
                                color: Color(0xFF2563EB),
                                fontWeight: FontWeight.bold)),
                      ]),
                    ),
                  ),
                ],
              ),
            ),

          // 발언 목록
          Expanded(
            child: segments.isEmpty
                ? _EmptyTranscript(recordType: widget.recordType)
                : ListView.builder(
                    controller: _scrollController,
                    padding:
                        const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    itemCount: segments.length,
                    itemBuilder: (context, index) => _SegmentBubble(
                      segment: segments[index],
                      onEdit: (updated) {
                        final list = [
                          ...ref.read(transcriptSegmentsProvider)
                        ];
                        list[index] = updated;
                        ref
                            .read(transcriptSegmentsProvider.notifier)
                            .state = list;
                      },
                    ),
                  ),
          ),

          // 말하는 중 미리보기
          if (isListening && _partialBuffer.isNotEmpty)
            Container(
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 6),
              padding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF93C5FD)),
              ),
              child: Row(children: [
                const Icon(Icons.mic,
                    size: 14, color: Color(0xFF2563EB)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(_partialBuffer,
                      style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF374151),
                          fontStyle: FontStyle.italic)),
                ),
              ]),
            ),

          // 입력 영역
          _InputArea(
            controller: _textController,
            isListening: isListening,
            hintText: isMemo ? '메모 내용을 입력하세요' : '발언 내용을 입력하세요',
            onSend: _addTextSegment,
            onMic: () {
              _toggleListening();
            },
            onUpload: _pickAndUploadFile,
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 타이머 텍스트
// ============================================================
class _TimerText extends StatelessWidget {
  final Duration elapsed;
  const _TimerText({required this.elapsed});

  @override
  Widget build(BuildContext context) {
    final h = elapsed.inHours.toString().padLeft(2, '0');
    final m = (elapsed.inMinutes % 60).toString().padLeft(2, '0');
    final s = (elapsed.inSeconds % 60).toString().padLeft(2, '0');
    return Text('$h:$m:$s',
        style:
            const TextStyle(fontSize: 12, color: Color(0xFF6B7280)));
  }
}

// ============================================================
// 빈 화면
// ============================================================
class _EmptyTranscript extends StatelessWidget {
  final String recordType;
  const _EmptyTranscript({required this.recordType});

  @override
  Widget build(BuildContext context) {
    final label = recordType == 'interview'
        ? '면담'
        : recordType == 'conversation'
            ? '대화'
            : recordType == 'memo'
                ? '메모'
            : '회의';
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.record_voice_over_outlined,
              size: 48, color: Color(0xFFD1D5DB)),
          const SizedBox(height: 16),
          Text(
            '$label 내용을 기록해보세요\n마이크 버튼을 누르거나 직접 입력하세요',
            style: const TextStyle(
                fontSize: 14, color: Color(0xFF9CA3AF), height: 1.5),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ============================================================
// 깜빡이는 점
// ============================================================
class _PulsingDot extends StatefulWidget {
  const _PulsingDot();

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        duration: const Duration(milliseconds: 800), vsync: this)
      ..repeat(reverse: true);
    _animation =
        Tween<double>(begin: 0.4, end: 1.0).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _animation,
      child: Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(
            color: Color(0xFF2563EB), shape: BoxShape.circle),
      ),
    );
  }
}

// ============================================================
// 입력 영역
// ============================================================
class _InputArea extends StatelessWidget {
  final TextEditingController controller;
  final bool isListening;
  final String hintText;
  final VoidCallback onSend;
  final VoidCallback onMic;
  final VoidCallback onUpload;

  const _InputArea({
    required this.controller,
    required this.isListening,
    required this.hintText,
    required this.onSend,
    required this.onMic,
    required this.onUpload,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          12, 8, 12, MediaQuery.of(context).viewInsets.bottom + 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
      ),
      child: Row(children: [
        GestureDetector(
          onTap: onUpload,
          child: Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
                color: Color(0xFFF3F4F6), shape: BoxShape.circle),
            child: const Icon(Icons.attach_file,
                color: Color(0xFF6B7280), size: 20),
          ),
        ),
        const SizedBox(width: 6),
        GestureDetector(
          onTap: onMic,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: isListening
                  ? const Color(0xFF2563EB)
                  : const Color(0xFFF3F4F6),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isListening ? Icons.mic : Icons.mic_none,
              color: isListening
                  ? Colors.white
                  : const Color(0xFF6B7280),
              size: 20,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: TextField(
            controller: controller,
            maxLines: null,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => onSend(),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: const TextStyle(
                  color: Color(0xFF9CA3AF), fontSize: 14),
              filled: true,
              fillColor: const Color(0xFFF9FAFB),
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide:
                    const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide:
                    const BorderSide(color: Color(0xFFE5E7EB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide:
                    const BorderSide(color: Color(0xFF2563EB)),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: onSend,
          child: Container(
            width: 42,
            height: 42,
            decoration: const BoxDecoration(
                color: Color(0xFF2563EB), shape: BoxShape.circle),
            child: const Icon(Icons.send,
                color: Colors.white, size: 18),
          ),
        ),
      ]),
    );
  }
}

// ============================================================
// 말풍선 (탭=화자토글, 롱프레스=텍스트편집)
// ============================================================
class _SegmentBubble extends StatefulWidget {
  final TranscriptSegmentItem segment;
  final void Function(TranscriptSegmentItem) onEdit;

  const _SegmentBubble({required this.segment, required this.onEdit});

  @override
  State<_SegmentBubble> createState() => _SegmentBubbleState();
}

class _SegmentBubbleState extends State<_SegmentBubble> {
  bool _isEditing = false;
  late TextEditingController _editController;

  @override
  void initState() {
    super.initState();
    _editController =
        TextEditingController(text: widget.segment.text);
  }

  @override
  void dispose() {
    _editController.dispose();
    super.dispose();
  }

  void _saveEdit() {
    final text = _editController.text.trim();
    if (text.isNotEmpty) {
      widget.onEdit(TranscriptSegmentItem(
        id: widget.segment.id,
        text: text,
        speakerLabel: widget.segment.speakerLabel,
        timestamp: widget.segment.timestamp,
        source: widget.segment.source,
      ));
    }
    setState(() => _isEditing = false);
  }

  @override
  Widget build(BuildContext context) {
    final isUser = widget.segment.speakerLabel == 'user';
    final isFile = widget.segment.speakerLabel == '파일';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        children: [
          // 상대방/파일: 왼쪽 아이콘
          if (!isUser) ...[
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: isFile
                    ? const Color(0xFF10B981)
                    : const Color(0xFF6B7280),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isFile ? Icons.insert_drive_file : Icons.people,
                size: 16,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 8),
          ],

          // 말풍선
          Flexible(
            child: GestureDetector(
              onTap: isFile
                  ? null
                  : () {
                      // 탭: 화자 토글
                      widget.onEdit(TranscriptSegmentItem(
                        id: widget.segment.id,
                        text: widget.segment.text,
                        speakerLabel: isUser ? 'other' : 'user',
                        timestamp: widget.segment.timestamp,
                        source: widget.segment.source,
                      ));
                    },
              onLongPress: () {
                // 롱프레스: 텍스트 편집
                _editController.text = widget.segment.text;
                setState(() => _isEditing = true);
              },
              child: Column(
                crossAxisAlignment: isUser
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  _isEditing
                      ? Container(
                          constraints:
                              const BoxConstraints(maxWidth: 260),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: const Color(0xFF2563EB),
                                width: 1.5),
                          ),
                          child: Row(children: [
                            Expanded(
                              child: TextField(
                                controller: _editController,
                                autofocus: true,
                                maxLines: null,
                                style:
                                    const TextStyle(fontSize: 14),
                                decoration: const InputDecoration(
                                    border: InputBorder.none,
                                    isDense: true),
                                onSubmitted: (_) => _saveEdit(),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.check,
                                  size: 18,
                                  color: Color(0xFF2563EB)),
                              onPressed: _saveEdit,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ]),
                        )
                      : Container(
                          constraints:
                              const BoxConstraints(maxWidth: 260),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: isUser
                                ? const Color(0xFFDBEAFE)
                                : isFile
                                    ? const Color(0xFFD1FAE5)
                                    : Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isUser
                                  ? const Color(0xFF93C5FD)
                                  : isFile
                                      ? const Color(0xFF6EE7B7)
                                      : const Color(0xFFE5E7EB),
                            ),
                          ),
                          child: Text(
                            widget.segment.text,
                            style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF111827),
                                height: 1.4),
                          ),
                        ),
                ],
              ),
            ),
          ),

          // 나: 오른쪽 아이콘
          if (isUser) ...[
            const SizedBox(width: 8),
            Container(
              width: 30,
              height: 30,
              decoration: const BoxDecoration(
                color: Color(0xFF2563EB),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.person,
                  size: 16, color: Colors.white),
            ),
          ],
        ],
      ),
    );
  }
}
