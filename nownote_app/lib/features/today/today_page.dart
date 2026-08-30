import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:now_core/now_core.dart';
import 'package:table_calendar/table_calendar.dart';

import '../ask/ask_sheet.dart';
import '../settings/settings_providers.dart';
import 'today_memo_repository.dart';
import 'today_providers.dart';

/// 오늘 메모 탭.
///
/// 월 달력에서 날짜를 고르고 그 날의 메모(문단 목록)를 보고 쓴다. 진입 시
/// 오늘 날짜가 선택된 상태로 연다. 하루에 메모는 하나이고 그 안에 문단이
/// 여러 개 쌓인다 — 날짜 하나에 카드를 여러 개 만들지 않는다.
///
/// 텍스트 / 음성(기기 내 인식) / 사진(LLM 추출 후 확인) 세 가지로 문단을
/// 넣을 수 있다. 넣은 문단은 즉시 저장된다.
class TodayMemoPage extends ConsumerStatefulWidget {
  const TodayMemoPage({super.key});

  @override
  ConsumerState<TodayMemoPage> createState() => _TodayMemoPageState();
}

class _TodayMemoPageState extends ConsumerState<TodayMemoPage> {
  late DateTime _focusedDay;
  final TextEditingController _textController = TextEditingController();
  final DeviceSpeechRecognizer _speech = SpeechToTextRecognizer();

  bool _isListening = false;
  bool _isPhotoBusy = false;
  String _draftSource = todayParagraphSourceText;
  String _voiceDraftBase = '';

  // 서버로 받아쓰기(녹음 후 변환). 기기 내 실시간 인식(`_toggleVoice`)과는
  // 별개의 진입점이다 — 서버 주소가 설정돼 있어야 쓸 수 있다.
  bool _isServerRecording = false;
  bool _isTranscribing = false;

  // 문단 읽어주기(TTS). 화면에 머무는 동안 하나만 만들어 모든 문단 카드가
  // 공유한다 — VoicePlaybackService의 "한 번에 하나만 재생" 규칙이 이
  // 인스턴스 하나로만 지켜진다.
  VoicePlaybackService? _playback;

  @override
  void initState() {
    super.initState();
    _focusedDay = DateTime.now();
  }

  @override
  void dispose() {
    _textController.dispose();
    _speech.stop();
    _playback?.dispose();
    super.dispose();
  }

  Future<void> _toggleVoice() async {
    if (_isListening) {
      await _speech.stop();
      if (mounted) setState(() => _isListening = false);
      return;
    }

    final available = await _speech.initialize(
      onStatus: (status) {
        if (DeviceSpeechDefaults.isStoppedStatus(status) && mounted) {
          setState(() => _isListening = false);
        }
      },
      onError: (failure) {
        if (!mounted) return;
        setState(() => _isListening = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('음성 인식 오류: ${failure.message}')),
        );
      },
    );
    if (!available) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('음성 인식 엔진을 쓸 수 없습니다.')),
      );
      return;
    }

    _voiceDraftBase = _textController.text;
    setState(() {
      _isListening = true;
      _draftSource = todayParagraphSourceVoice;
    });

    await _speech.listen(
      onResult: (outcome) {
        final base = _voiceDraftBase.trim();
        final merged = base.isEmpty ? outcome.text : '$base ${outcome.text}';
        _textController.text = merged;
        _textController.selection = TextSelection.fromPosition(
          TextPosition(offset: _textController.text.length),
        );
      },
    );
  }

  /// 서버로 받아쓰기(녹음 후 변환).
  ///
  /// 기기 내 실시간 인식(`_toggleVoice`)과 달리 녹음이 끝난 뒤 서버로 보내
  /// 텍스트로 바꾼다. Now의 계층 메모 "녹음 후 변환" 흐름과 같은 방식이다.
  Future<void> _toggleServerDictation() async {
    if (_isTranscribing) return;

    final recording = ref.read(todayVoiceRecordingServiceProvider);

    if (_isServerRecording) {
      setState(() {
        _isServerRecording = false;
        _isTranscribing = true;
      });

      VoiceRecording? result;
      try {
        result = await recording.stop();
      } catch (_) {
        result = null;
      }

      if (result == null) {
        _showVoiceSnack('녹음 파일을 찾을 수 없습니다.');
      } else if (result.isTooShort) {
        await result.delete();
        _showVoiceSnack('녹음이 짧아 변환을 생략했어요.');
      } else {
        try {
          final settings = await ref.read(voiceSettingsStoreProvider).load();
          final buildClient = ref.read(voiceEngineClientBuilderProvider);
          final newText = (await buildClient(
            settings,
          ).transcribe(file: result.file)).trim();
          if (newText.isNotEmpty) {
            final base = _textController.text.trim();
            final merged = base.isEmpty ? newText : '$base $newText';
            _textController.text = merged;
            _textController.selection = TextSelection.fromPosition(
              TextPosition(offset: _textController.text.length),
            );
            if (mounted) {
              setState(() => _draftSource = todayParagraphSourceVoice);
            }
          }
        } on VoiceEngineException catch (e) {
          _showVoiceSnack(e.message);
        } catch (_) {
          _showVoiceSnack('음성 변환 중 문제가 생겼습니다.');
        } finally {
          await result.delete();
        }
      }

      if (mounted) setState(() => _isTranscribing = false);
      return;
    }

    try {
      await recording.start(namePrefix: 'today_memo');
    } catch (_) {
      _showVoiceSnack('녹음을 시작할 수 없습니다.');
      return;
    }
    if (!mounted) return;
    setState(() => _isServerRecording = true);
  }

  void _showVoiceSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  /// 이미 만든 재생 서비스가 있으면 그대로 돌려주고, 없으면 만든다.
  ///
  /// 처음 재생 버튼을 누를 때만 서버 설정을 읽는다 — 재생을 한 번도 안 쓰면
  /// 이 화면은 음성 설정을 전혀 건드리지 않는다.
  Future<VoicePlaybackService> _ensurePlayback() async {
    final existing = _playback;
    if (existing != null) return existing;
    final settings = await ref.read(voiceSettingsStoreProvider).load();
    final buildClient = ref.read(voiceEngineClientBuilderProvider);
    final buildPlayback = ref.read(todayVoicePlaybackServiceBuilderProvider);
    final playback = buildPlayback(buildClient(settings));
    _playback = playback;
    return playback;
  }

  /// 이미 만들어져 있으면 그 인스턴스를, 아직 없으면 null을 돌려준다.
  ///
  /// 문단 카드가 처음 그려질 때 재생 상태를 미리 물어보되, 그 과정에서
  /// 서버 설정을 새로 읽지는 않게 하려는 용도다.
  VoicePlaybackService? _currentPlayback() => _playback;

  Future<void> _submitText() async {
    final text = _textController.text;
    if (text.trim().isEmpty) return;

    final date = ref.read(selectedDateProvider);
    await ref
        .read(todayMemoRepositoryProvider)
        .appendParagraph(date: date, text: text, source: _draftSource);

    _textController.clear();
    if (!mounted) return;
    setState(() => _draftSource = todayParagraphSourceText);
    ref.read(todayMemoRefreshTickProvider.notifier).state++;
  }

  /// 묻기 — 지금까지 쌓인 그날의 문단을 맥락으로 삼아 LLM에 묻는다.
  ///
  /// 답을 메모에 넣으면 `_submitText`와 같은 방식(`appendParagraph`)으로 새
  /// 문단을 추가한다.
  void _openAskSheet() {
    final date = ref.read(selectedDateProvider);
    final paragraphs =
        ref.read(selectedDateParagraphsProvider).valueOrNull ??
        const <TodayMemoParagraph>[];
    final body = paragraphs.map((p) => p.text).join('\n');
    final noteContent = joinNoteContent(title: '오늘 메모', body: body);

    showAskSheet(
      context,
      noteContent: noteContent,
      onInsertAnswer: (block) async {
        await ref
            .read(todayMemoRepositoryProvider)
            .appendParagraph(
              date: date,
              text: block,
              source: todayParagraphSourceAsk,
            );
        ref.read(todayMemoRefreshTickProvider.notifier).state++;
      },
    );
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final XFile? picked = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
    );
    if (picked == null) return;
    if (!mounted) return;

    setState(() => _isPhotoBusy = true);

    final llm = await ref.read(llmRepositoryProvider.future);
    if (llm == null) {
      if (!mounted) return;
      setState(() => _isPhotoBusy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('LLM 설정을 먼저 완료해주세요.')),
      );
      return;
    }

    String extracted;
    try {
      extracted = await PhotoTextExtractor(
        llm,
      ).extractFromFile(File(picked.path));
    } on PhotoTextExtractionException catch (e) {
      if (!mounted) return;
      setState(() => _isPhotoBusy = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
      return;
    } catch (e) {
      if (!mounted) return;
      setState(() => _isPhotoBusy = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('사진을 읽는 중 문제가 생겼습니다.')),
      );
      return;
    }

    if (!mounted) return;
    setState(() => _isPhotoBusy = false);

    final confirmed = await _showPhotoReviewSheet(extracted);
    if (confirmed == null || confirmed.trim().isEmpty) return;

    final date = ref.read(selectedDateProvider);
    await ref
        .read(todayMemoRepositoryProvider)
        .appendParagraph(
          date: date,
          text: confirmed,
          source: todayParagraphSourcePhoto,
        );
    ref.read(todayMemoRefreshTickProvider.notifier).state++;
  }

  /// 사진에서 읽어낸 내용을 사용자가 고칠 수 있는 화면.
  ///
  /// 확인 없이 그대로 문단에 넣지 않는다 — 여기서 "넣기"를 눌러야 저장된다.
  Future<String?> _showPhotoReviewSheet(String extractedText) async {
    final controller = TextEditingController(text: extractedText);
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '사진에서 읽은 내용',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              const Text(
                '넣기 전에 내용을 확인하고 고칠 수 있습니다.',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                maxLines: 8,
                minLines: 4,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('취소'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(ctx).pop(controller.text),
                      child: const Text('문단으로 넣기'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final selectedDate = ref.watch(selectedDateProvider);
    final paragraphsAsync = ref.watch(selectedDateParagraphsProvider);
    final memoDatesAsync = ref.watch(memoDatesProvider);
    final memoDates = memoDatesAsync.valueOrNull ?? const <DateTime>{};

    return Column(
      children: [
        TableCalendar<int>(
          locale: 'ko_KR',
          firstDay: DateTime.utc(2020, 1, 1),
          lastDay: DateTime.utc(2035, 12, 31),
          focusedDay: _focusedDay,
          daysOfWeekHeight: 24,
          rowHeight: 40,
          calendarFormat: CalendarFormat.month,
          availableCalendarFormats: const {CalendarFormat.month: '월'},
          selectedDayPredicate: (day) => isSameDay(selectedDate, day),
          eventLoader: (day) =>
              memoDates.contains(TodayMemoRepository.normalizeDate(day))
              ? const <int>[1]
              : const <int>[],
          onDaySelected: (selected, focused) {
            setState(() => _focusedDay = focused);
            ref.read(selectedDateProvider.notifier).state =
                TodayMemoRepository.normalizeDate(selected);
          },
          onPageChanged: (focused) {
            _focusedDay = focused;
          },
        ),
        const Divider(height: 1),
        Expanded(
          child: paragraphsAsync.when(
            data: (paragraphs) => paragraphs.isEmpty
                ? const Center(child: Text('이 날의 메모가 없습니다.'))
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: paragraphs.length,
                    itemBuilder: (context, index) => _ParagraphTile(
                      paragraph: paragraphs[index],
                      ensurePlayback: _ensurePlayback,
                      currentPlayback: _currentPlayback,
                    ),
                  ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, stackTrace) =>
                Center(child: Text('메모를 불러오지 못했습니다.\n$error')),
          ),
        ),
        const Divider(height: 1),
        SafeArea(
          top: false,
          child: _TodayInputBar(
            controller: _textController,
            isListening: _isListening,
            isPhotoBusy: _isPhotoBusy,
            isServerRecording: _isServerRecording,
            isTranscribing: _isTranscribing,
            onSubmit: _submitText,
            onMic: (_isServerRecording || _isTranscribing)
                ? null
                : _toggleVoice,
            onServerMic: _isListening ? null : _toggleServerDictation,
            onCamera: _isPhotoBusy ? null : _pickPhoto,
            onAsk: _openAskSheet,
          ),
        ),
      ],
    );
  }
}

class _ParagraphTile extends StatefulWidget {
  const _ParagraphTile({
    required this.paragraph,
    required this.ensurePlayback,
    required this.currentPlayback,
  });

  final TodayMemoParagraph paragraph;

  /// 아직 재생 서비스가 없으면 만들어서 돌려준다(서버 설정을 읽는다).
  final Future<VoicePlaybackService> Function() ensurePlayback;

  /// 이미 만들어져 있으면 그 인스턴스를, 없으면 null을 돌려준다.
  final VoicePlaybackService? Function() currentPlayback;

  @override
  State<_ParagraphTile> createState() => _ParagraphTileState();
}

class _ParagraphTileState extends State<_ParagraphTile> {
  StreamSubscription<VoicePlaybackState>? _subscription;
  bool _isPlaying = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    // 이미 만들어진 재생 서비스가 있으면(다른 문단에서 먼저 만들었다면)
    // 지금 상태를 반영해 둔다. 없으면 재생 버튼을 누를 때 만든다 — 이
    // 화면에 진입만 해서는 음성 설정을 읽지 않는다.
    final existing = widget.currentPlayback();
    if (existing != null) _bind(existing);
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }

  void _bind(VoicePlaybackService service) {
    _subscription?.cancel();
    _subscription = service.states.listen(_onState);
    _onState(service.state);
  }

  void _onState(VoicePlaybackState state) {
    if (!mounted) return;
    final id = widget.paragraph.segmentId;
    setState(() {
      _isPlaying = state.isPlayingId(id);
      _isLoading = state.status == VoicePlaybackStatus.loading && state.id == id;
    });
  }

  Future<void> _togglePlayback() async {
    final service = await widget.ensurePlayback();
    _bind(service);

    if (_isPlaying || _isLoading) {
      await service.stop();
      return;
    }

    if (!service.canSpeak) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('읽어주기가 설정되어 있지 않습니다. 설정에서 TTS 서버 주소를 입력해 주세요.'),
        ),
      );
      return;
    }

    try {
      await service.speak(
        text: widget.paragraph.text,
        id: widget.paragraph.segmentId,
      );
    } on VoicePlaybackException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } on VoiceEngineException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_sourceIcon(widget.paragraph.source), size: 14),
                const SizedBox(width: 4),
                Text(
                  DateFormat('HH:mm').format(widget.paragraph.timestamp),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
                const Spacer(),
                IconButton(
                  tooltip: _isPlaying ? '읽어주기 중지' : '문단 읽어주기',
                  visualDensity: VisualDensity.compact,
                  icon: _isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(
                          _isPlaying
                              ? Icons.stop_circle_outlined
                              : Icons.volume_up_outlined,
                          color: _isPlaying ? colorScheme.primary : null,
                        ),
                  onPressed: _togglePlayback,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(widget.paragraph.text),
          ],
        ),
      ),
    );
  }

  IconData _sourceIcon(String source) {
    switch (source) {
      case todayParagraphSourceVoice:
        return Icons.mic;
      case todayParagraphSourcePhoto:
        return Icons.photo_camera_outlined;
      case todayParagraphSourceAsk:
        return Icons.help_outline;
      default:
        return Icons.edit_note;
    }
  }
}

class _TodayInputBar extends StatelessWidget {
  const _TodayInputBar({
    required this.controller,
    required this.isListening,
    required this.isPhotoBusy,
    required this.isServerRecording,
    required this.isTranscribing,
    required this.onSubmit,
    required this.onMic,
    required this.onServerMic,
    required this.onCamera,
    required this.onAsk,
  });

  final TextEditingController controller;
  final bool isListening;
  final bool isPhotoBusy;
  final bool isServerRecording;
  final bool isTranscribing;
  final VoidCallback onSubmit;
  final VoidCallback? onMic;
  final VoidCallback? onServerMic;
  final VoidCallback? onCamera;
  final VoidCallback onAsk;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        children: [
          IconButton(
            tooltip: '묻기',
            icon: const Icon(Icons.help_outline),
            onPressed: onAsk,
          ),
          IconButton(
            tooltip: '사진으로 입력',
            icon: isPhotoBusy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.camera_alt_outlined),
            onPressed: onCamera,
          ),
          IconButton(
            tooltip: isListening ? '음성 입력 중지' : '음성으로 입력',
            icon: Icon(isListening ? Icons.mic : Icons.mic_none),
            color: isListening ? Theme.of(context).colorScheme.primary : null,
            onPressed: onMic,
          ),
          IconButton(
            tooltip: isServerRecording
                ? '서버로 받아쓰기 중지(변환)'
                : '서버로 받아쓰기 시작',
            icon: isTranscribing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(
                    isServerRecording
                        ? Icons.fiber_manual_record
                        : Icons.cloud_upload_outlined,
                  ),
            color: isServerRecording
                ? Theme.of(context).colorScheme.error
                : null,
            onPressed: isTranscribing ? null : onServerMic,
          ),
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: '오늘 기억할 것을 적어 보세요.',
                border: OutlineInputBorder(),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
              ),
              onSubmitted: (_) => onSubmit(),
            ),
          ),
          IconButton(
            tooltip: '문단으로 넣기',
            icon: const Icon(Icons.send),
            onPressed: onSubmit,
          ),
        ],
      ),
    );
  }
}
