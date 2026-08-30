/// 묻기 실패 이유와 예외.
///
/// [VoiceEngineException], [PhotoTextExtractionException]과 같은 결로 만들었다.
/// 화면은 [AskErrorKind]로 안내 문구나 다음 행동을 갈라 쓸 수 있고,
/// [AskException.message]는 그대로 사용자에게 보여도 된다.
library;

/// 묻기가 실패한 이유.
enum AskErrorKind {
  /// LLM 설정이 비어 있다. 키나 서버 주소가 없다.
  notConfigured,

  /// 질문이 비어 있다. 요청을 만들지 않는다.
  emptyQuestion,

  /// 질문 하나가 한 번에 보낼 수 있는 길이를 넘었다.
  questionTooLong,

  /// 잠긴(암호화된) 메모를 맥락이나 질문에 넣으려 했다.
  ///
  /// 암호문을 그대로 LLM에 보내지 않기 위해 요청을 만들기 전에 막는다.
  lockedNote,

  /// 401/403. API 키가 없거나 틀렸다.
  unauthorized,

  /// 서버에 닿지 못했다.
  connectionFailed,

  /// 시간 안에 응답이 오지 않았다.
  timeout,

  /// 서버가 4xx/5xx로 답했다.
  serverError,

  /// 응답이 왔지만 기대한 형식이 아니다.
  invalidResponse,

  /// 응답은 왔는데 내용이 비어 있다.
  emptyAnswer,

  /// 위에 해당하지 않는 실패.
  unknown,
}

/// 묻기 실패. [message]는 사용자에게 그대로 보여도 되는 한국어 문구다.
class AskException implements Exception {
  AskException({
    required this.kind,
    required this.message,
    this.statusCode,
    this.detail,
    this.cause,
  });

  /// 실패 이유.
  final AskErrorKind kind;

  /// 사용자에게 보여줄 한국어 문구.
  final String message;

  /// HTTP 상태 코드. 통신 전 실패면 null이다.
  final int? statusCode;

  /// 서버가 준 원문 설명. 로그용이며 사용자에게 보여줄 필요는 없다.
  final String? detail;

  /// 원인 예외.
  final Object? cause;

  /// 다시 시도해 볼 만한 실패인지.
  ///
  /// 설정이 잘못됐거나 질문 자체가 문제면 같은 요청을 다시 보내도 같은 결과다.
  bool get isRetryable =>
      kind == AskErrorKind.timeout ||
      kind == AskErrorKind.connectionFailed ||
      kind == AskErrorKind.serverError;

  @override
  String toString() =>
      'AskException(${kind.name}, status: $statusCode, $message'
      '${detail == null ? '' : ', detail: $detail'})';
}
