import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:now_core/now_core.dart';

import '../settings/settings_providers.dart';
import 'tree_llm_providers.dart';
import 'tree_voice_providers.dart';

/// 새 메모 제목을 입력하는 하단 바.
///
/// 텍스트 / 음성(기기 내 실시간 인식) / 사진(LLM 추출) 세 가지 입력을
/// 한 줄 텍스트 필드로 모은다. [onSubmit]이 실제 저장을 담당하고, 이 위젯은
/// 입력값을 모으는 역할만 한다.
class TreeInputBar extends ConsumerStatefulWidget {
  const TreeInputBar({
    super.key,
    required this.hintText,
    required this.onSubmit,
  });

  final String hintText;
  final void Function(String text) onSubmit;

  @override
  ConsumerState<TreeInputBar> createState() => _TreeInputBarState();
}

class _TreeInputBarState extends ConsumerState<TreeInputBar> {
  final TextEditingController _controller = TextEditingController();
  final DeviceSpeechRecognizer _speech = SpeechToTextRecognizer();
  bool _isListening = false;
  bool _isReadingPhoto = false;

  // 서버로 받아쓰기(녹음 후 변환). 기기 내 실시간 인식(`_toggleVoice`)과는
  // 별개의 진입점이다 — 서버 주소가 설정돼 있어야 쓸 수 있다.
  bool _isServerRecording = false;
  bool _isTranscribing = false;

  @override
  void dispose() {
    _controller.dispose();
    if (_isListening) {
      _speech.stop();
    }
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    widget.onSubmit(text);
    _controller.clear();
  }

  Future<void> _toggleVoice() async {
    if (_isListening) {
      await _speech.stop();
      if (mounted) setState(() => _isListening = false);
      return;
    }

    final ready = await _speech.initialize(
      onStatus: (status) {
        if (!mounted) return;
        if (DeviceSpeechDefaults.isStoppedStatus(status)) {
          setState(() => _isListening = false);
        }
      },
      onError: (_) {
        if (!mounted) return;
        setState(() => _isListening = false);
      },
    );
    if (!ready) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('음성 인식을 시작할 수 없습니다.')),
      );
      return;
    }

    setState(() => _isListening = true);
    await _speech.listen(
      onResult: (outcome) {
        if (!mounted) return;
        _controller.text = outcome.text;
        _controller.selection = TextSelection.collapsed(
          offset: _controller.text.length,
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

    final recording = ref.read(treeVoiceRecordingServiceProvider);

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
        _showSnack('녹음 파일을 찾을 수 없습니다.');
      } else if (result.isTooShort) {
        await result.delete();
        _showSnack('녹음이 짧아 변환을 생략했어요.');
      } else {
        try {
          final settings = await ref.read(voiceSettingsStoreProvider).load();
          final buildClient = ref.read(voiceEngineClientBuilderProvider);
          final newText = (await buildClient(
            settings,
          ).transcribe(file: result.file)).trim();
          if (newText.isNotEmpty && mounted) {
            setState(() {
              final base = _controller.text.trim();
              _controller.text = base.isEmpty ? newText : '$base $newText';
              _controller.selection = TextSelection.collapsed(
                offset: _controller.text.length,
              );
            });
          }
        } on VoiceEngineException catch (e) {
          _showSnack(e.message);
        } catch (_) {
          _showSnack('음성 변환 중 문제가 생겼습니다.');
        } finally {
          await result.delete();
        }
      }

      if (mounted) setState(() => _isTranscribing = false);
      return;
    }

    try {
      await recording.start(namePrefix: 'tree_memo');
    } catch (_) {
      _showSnack('녹음을 시작할 수 없습니다.');
      return;
    }
    if (!mounted) return;
    setState(() => _isServerRecording = true);
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _pickPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 1600,
      maxHeight: 1600,
    );
    if (picked == null) return;

    setState(() => _isReadingPhoto = true);
    try {
      final llm = await ref.read(llmRepositoryProvider.future);
      if (llm == null) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('LLM 설정을 먼저 완료해주세요.')),
        );
        return;
      }
      final text =
          await PhotoTextExtractor(llm).extractFromFile(File(picked.path));
      if (!mounted) return;
      setState(() {
        _controller.text = text;
        _controller.selection = TextSelection.collapsed(
          offset: _controller.text.length,
        );
      });
    } on PhotoTextExtractionException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    } finally {
      if (mounted) setState(() => _isReadingPhoto = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 4,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('tree-input-field'),
                  controller: _controller,
                  decoration: InputDecoration(
                    hintText: widget.hintText,
                    isDense: true,
                    border: const OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => _submit(),
                ),
              ),
              IconButton(
                key: const Key('tree-input-mic'),
                tooltip: '음성으로 입력',
                icon: Icon(_isListening ? Icons.mic : Icons.mic_none),
                color: _isListening ? Colors.red : null,
                onPressed: (_isServerRecording || _isTranscribing)
                    ? null
                    : _toggleVoice,
              ),
              IconButton(
                key: const Key('tree-input-server-mic'),
                tooltip: _isServerRecording
                    ? '서버로 받아쓰기 중지(변환)'
                    : '서버로 받아쓰기 시작',
                icon: _isTranscribing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        _isServerRecording
                            ? Icons.fiber_manual_record
                            : Icons.cloud_upload_outlined,
                      ),
                color: _isServerRecording ? Colors.red : null,
                onPressed: _isListening || _isTranscribing
                    ? null
                    : _toggleServerDictation,
              ),
              IconButton(
                key: const Key('tree-input-camera'),
                tooltip: '사진으로 입력',
                icon: _isReadingPhoto
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.camera_alt_outlined),
                onPressed: _isReadingPhoto ? null : _pickPhoto,
              ),
              IconButton(
                key: const Key('tree-input-submit'),
                tooltip: '추가',
                icon: const Icon(Icons.add_circle),
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
