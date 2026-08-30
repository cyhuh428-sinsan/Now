/// 받은 답을 메모 본문에 넣을 형태로 다듬는다.
///
/// 실제로 메모를 저장하는 것은 화면의 일이다. 이 계층은 **넣을 문자열을
/// 만들어 주는 데까지**다.
library;

/// 답 앞에 붙는 머리줄의 표시.
const String askInsertionMarker = '묻기';

/// 머리줄에 실을 질문의 최대 길이. 넘으면 뒤를 줄인다.
const int askInsertionQuestionChars = 80;

/// 답을 메모에 넣을 형태로 만든다.
///
/// ## 이런 모양으로 정한 근거
///
/// ```
/// > 묻기 — 소금 대신 쓸 수 있는 게 뭐가 있지?
/// > 출처: 로컬 Ollama
///
/// 간장, 된장, 다시마 우린 물로 짠맛을 낼 수 있다.
/// ```
///
/// - **머리줄을 붙인다.** 몇 달 뒤에 이 메모를 다시 읽는 사람은 어느 문장을
///   자기가 썼고 어느 문장이 기계가 준 것인지 구분할 수 있어야 한다.
///   구분이 없으면 확인하지 않은 문장을 자기가 확인한 것으로 착각한다.
/// - **질문을 함께 남긴다.** 답만 남기면 "네, 됩니다" 같은 문장이 뒤에 홀로
///   남아 무엇에 대한 답인지 알 수 없다. 질문까지 있어야 붙여 넣은 덩어리가
///   혼자서 말이 된다.
/// - **출처는 provider 이름까지만 남긴다.** 모델마다 정확도가 다르므로 어디서
///   온 답인지는 남길 값이 있다. 서버 주소나 키, 모델 식별자는 넣지 않는다.
///   메모는 공유될 수 있고 동기화되어 서버에 올라간다.
/// - **답 본문은 손대지 않는다.** 줄마다 `>` 를 붙여 통째로 인용하면 답 안의
///   코드 블록과 목록이 깨진다. 머리줄만 인용 표시로 두고 본문은 그대로 둔다.
/// - **머리줄은 마크다운 인용으로 쓴다.** 마크다운을 그리는 화면에서는 옅게
///   보이고, 그리지 않는 화면에서도 `>` 한 글자라 읽는 데 방해되지 않는다.
///
/// 답 자체는 다듬지 않는다. 앞뒤 공백만 떼고 그대로 쓴다. 여기서 문장을
/// 고치면 사용자가 화면에서 본 답과 메모에 들어간 답이 달라진다.
String buildAskInsertionBlock(
  String answer, {
  String? question,
  String? sourceLabel,
}) {
  final body = answer.trim();
  if (body.isEmpty) return '';

  final lines = <String>[];
  final head = _oneLine(question);
  if (head.isEmpty) {
    lines.add('> $askInsertionMarker');
  } else {
    lines.add('> $askInsertionMarker — $head');
  }
  final source = _oneLine(sourceLabel);
  if (source.isNotEmpty) {
    lines.add('> 출처: $source');
  }

  return '${lines.join('\n')}\n\n$body';
}

/// [buildAskInsertionBlock]이 만든 덩어리를 메모 본문 끝에 이어 붙인다.
///
/// 사이에 빈 줄을 하나 둔다. 빈 줄이 없으면 마크다운에서 앞 문단과 머리줄이
/// 한 문단으로 붙어 버린다.
String appendAskAnswerToNote(String noteBody, String block) {
  final trimmedBlock = block.trim();
  if (trimmedBlock.isEmpty) return noteBody;
  final base = noteBody.trimRight();
  if (base.isEmpty) return trimmedBlock;
  return '$base\n\n$trimmedBlock';
}

/// 질문·출처를 한 줄로 만든다. 길면 뒤를 줄인다.
String _oneLine(String? value) {
  final text = (value ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
  if (text.length <= askInsertionQuestionChars) return text;
  return '${text.substring(0, askInsertionQuestionChars).trimRight()}…';
}
