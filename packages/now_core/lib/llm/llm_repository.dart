import 'llm_config.dart';
import 'llm_image_input.dart';

/// LLM 추출 결과 아이템
class LlmExtractedItem {
  final String itemType; // action | decision
  final String content;
  final double confidence;
  final String? ownerLabel;
  final String? dueDate;
  final String? dueTime;

  const LlmExtractedItem({
    required this.itemType,
    required this.content,
    required this.confidence,
    this.ownerLabel,
    this.dueDate,
    this.dueTime,
  });
}

/// 설정이 없어서 요청을 보낼 수 없을 때 던진다.
///
/// 주소나 키가 비어 있으면 요청을 만들지 않는다. 빈 주소로 나간 요청은
/// 네트워크 오류로 돌아오고, 그러면 사용자는 무엇을 고쳐야 하는지 알 수 없다.
class LlmNotConfiguredException implements Exception {
  const LlmNotConfiguredException(this.message);

  /// 사용자에게 그대로 보여줄 수 있는 안내 문구.
  final String message;

  @override
  String toString() => message;
}

/// 고른 provider가 이미지를 받지 못할 때 던진다.
///
/// 이미지를 빼고 텍스트만 조용히 보내지 않는다. 그러면 LLM이 보지도 않은
/// 사진의 내용을 지어내고, 사용자는 왜 엉뚱한 답이 나왔는지 알 수 없다.
class LlmImageUnsupportedException implements Exception {
  LlmImageUnsupportedException(this.provider)
      : message = '${provider.displayName}은(는) 사진을 읽지 못합니다. '
            '설정에서 사진을 지원하는 LLM으로 바꿔 주세요.';

  /// 이미지를 받지 못하는 provider.
  final LlmProvider provider;

  /// 사용자에게 그대로 보여줄 수 있는 안내 문구.
  final String message;

  @override
  String toString() => message;
}

abstract class LlmRepository {
  /// 발언 세그먼트 목록에서 Action/Decision 추출
  Future<List<LlmExtractedItem>> extractItems(
    List<String> segments, {
    String recordType = 'meeting',
    String participantName = '',
    bool includeSpeakerSeparation = false,
    bool includeVoiceEmotion = false,
  });

  /// 단순 텍스트 프롬프트 전송 → 텍스트 응답 반환
  Future<String> chat(String prompt);

  /// 이 provider가 이미지를 함께 보낼 수 있는지.
  ///
  /// 화면은 사진 입력을 열기 전에 이 값을 봐야 한다. false인 채로 사진을
  /// 보내면 [chatWithImage]가 [LlmImageUnsupportedException]을 던진다.
  bool get supportsImageInput;

  /// 이미지 한 장과 프롬프트를 함께 보낸다 → 텍스트 응답 반환.
  ///
  /// [supportsImageInput]이 false면 요청을 만들지 않고
  /// [LlmImageUnsupportedException]을 던진다.
  Future<String> chatWithImage(String prompt, LlmImageInput image);

  /// 연결 테스트 (API Key 또는 Ollama URL 유효성 확인)
  Future<bool> testConnection();

  /// 현재 설정
  LlmConfig get config;
}
