import '../models/llm_config.dart';

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

abstract class LlmRepository {
  /// 발언 세그먼트 목록에서 Action/Decision 추출
  Future<List<LlmExtractedItem>> extractItems(List<String> segments, {String recordType, String participantName});

  /// 단순 텍스트 프롬프트 전송 → 텍스트 응답 반환
  Future<String> chat(String prompt);

  /// 연결 테스트 (API Key 또는 Ollama URL 유효성 확인)
  Future<bool> testConnection();

  /// 현재 설정
  LlmConfig get config;
}
