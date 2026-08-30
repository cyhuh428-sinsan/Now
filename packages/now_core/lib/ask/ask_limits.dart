/// 묻기 한 번에 보낼 수 있는 길이 상한.
///
/// LLM마다 한 번에 받을 수 있는 길이가 다르다. 무한정 쌓아 보내면 요청이
/// 실패하고, 실패한 이유가 "너무 길다"라는 것을 사용자는 알 수 없다.
/// 그래서 보내기 전에 이쪽에서 줄인다.
///
/// ## 숫자를 이렇게 잡은 근거
///
/// 가장 좁은 쪽에 맞춘다. 지원하는 provider 중 가장 좁은 것은 로컬 Ollama다.
/// Ollama는 모델 파일이 정하지 않으면 기본 컨텍스트가 4096 토큰이고, 예전
/// 빌드는 2048이었다. 이 앱의 Ollama 호출은 `num_ctx`를 따로 올리지 않으므로
/// 그 기본값을 그대로 받는다.
///
/// - 전체 4096 토큰에서 답변 자리로 1024 토큰을 남긴다. 답이 잘려 오면
///   사용자에게는 그냥 이상한 답으로 보인다.
/// - 남는 프롬프트 자리는 약 3000 토큰이다.
/// - 한국어는 토크나이저에 따라 글자당 1~3 토큰까지 나온다. 정확히 셀 방법이
///   없으므로 안전한 쪽으로 **글자 수 = 토큰 수**로 본다.
/// - 그래서 프롬프트 전체를 [maxPromptChars] 글자로 묶는다.
///
/// 토큰을 정확히 세지 않는 이유는, provider마다 토크나이저가 다르고 이
/// 패키지에 토크나이저를 넣으면 provider가 늘 때마다 같이 늘어나기 때문이다.
/// 글자 수는 어느 provider에서도 같은 값이고 과소평가하지 않는다.
class AskLimits {
  const AskLimits({
    this.maxQuestionChars = 1000,
    this.maxContextChars = 1200,
    this.maxHistoryChars = 1200,
    this.maxHistoryMessages = 20,
    this.maxPromptChars = 4000,
    this.minContextChars = 200,
  });

  /// 질문 하나에 허용하는 글자 수.
  ///
  /// 넘으면 잘라 보내지 않고 [AskErrorKind.questionTooLong]으로 막는다.
  /// 질문을 몰래 자르면 사용자가 묻지 않은 것에 답이 온다.
  final int maxQuestionChars;

  /// 참고로 붙이는 메모 맥락에 허용하는 글자 수.
  final int maxContextChars;

  /// 앞선 대화에 허용하는 글자 수.
  final int maxHistoryChars;

  /// 앞선 대화에 남기는 최대 발언 수.
  ///
  /// 글자 상한만으로도 묶이지만, 짧은 발언이 수백 개 쌓이면 프롬프트가
  /// 목록처럼 길어지고 모델이 마지막 질문을 놓친다. 10번 주고받은 것까지만
  /// 남긴다.
  final int maxHistoryMessages;

  /// 완성된 프롬프트 전체에 허용하는 글자 수.
  final int maxPromptChars;

  /// 맥락을 줄일 때 더 줄이지 않는 하한.
  ///
  /// 이보다 짧게 자른 메모는 무슨 말인지 알 수 없어 붙이는 의미가 없다.
  final int minContextChars;
}
