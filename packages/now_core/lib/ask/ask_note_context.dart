/// 질문에 붙이는 메모 맥락.
///
/// 붙일지 말지는 **부르는 쪽이 정한다.** 이 계층은 임의로 붙이지 않는다.
/// 화면에서 "이 메모 같이 보내기"를 켠 경우에만 [AskNoteContext]를 만들어
/// 넘긴다.
library;

import '../notes/note_content.dart';
import 'ask_exception.dart';
import 'ask_limits.dart';

/// 메모가 잘렸을 때 사이에 넣는 표시.
///
/// 표시 없이 앞뒤를 이어 붙이면 모델은 그 둘이 이어진 문장인 줄 알고
/// 없는 인과를 만들어 낸다.
const String askContextElision = '… (메모 중간 일부 생략) …';

/// 질문과 함께 보낼 메모 한 편.
class AskNoteContext {
  const AskNoteContext._({
    required this.title,
    required this.body,
    required this.truncated,
    required this.originalBodyChars,
  });

  /// 메모 제목.
  final String title;

  /// 보낼 본문. 길면 이미 줄여 둔 상태다.
  final String body;

  /// 본문을 줄였는지.
  final bool truncated;

  /// 줄이기 전 본문 글자 수.
  final int originalBodyChars;

  /// 제목과 본문으로 맥락을 만든다.
  ///
  /// 잠긴(암호화된) 메모면 [AskException]을 던진다. 본문이 길면 줄인다.
  ///
  /// ## 긴 메모를 줄이는 기준
  ///
  /// - **앞과 뒤를 남기고 가운데를 버린다.** 메모의 앞머리는 이 메모가
  ///   무엇에 대한 것인지 말하고, 끝은 사용자가 지금 쓰고 있던 자리다.
  ///   묻고 싶은 것이 생기는 곳은 대개 그 두 곳이다. 가운데는 이미 정리해 둔
  ///   내용이라 질문과의 관련이 가장 낮다.
  /// - **앞을 더 많이 남긴다.** 앞 60%, 뒤 40%로 나눈다. 주제와 전제가 앞에
  ///   있어서, 앞을 잃으면 뒤에 남은 문장도 무슨 말인지 알 수 없어진다.
  /// - **줄바꿈에서 끊는다.** 문장 중간에서 자르면 잘린 반쪽이 다른 뜻으로
  ///   읽힌다. 자를 자리 근처에 줄바꿈이 있으면 거기서 끊는다.
  /// - **잘렸다는 것을 프롬프트에 밝힌다.** 모델이 "메모에 그 얘기가 없다"고
  ///   단정하지 않게 한다.
  ///
  /// 요약해서 보내지 않는다. 요약하려면 LLM을 한 번 더 불러야 하고, 그러면
  /// 질문 하나에 요청이 두 번 나가며 요약이 틀리면 답도 함께 틀린다.
  factory AskNoteContext.fromNote({
    required String title,
    required String body,
    AskLimits limits = const AskLimits(),
  }) {
    assertNotEncrypted(title, what: '메모 제목');
    assertNotEncrypted(body, what: '메모 본문');

    final cleanTitle = noteTitleOrFallback(title);
    final cleanBody = body.trim();
    final shortened = shortenBody(cleanBody, limits.maxContextChars);

    return AskNoteContext._(
      title: cleanTitle,
      body: shortened,
      truncated: shortened.length != cleanBody.length,
      originalBodyChars: cleanBody.length,
    );
  }

  /// 저장된 메모 문자열(첫 줄 제목, 나머지 본문) 하나로 맥락을 만든다.
  factory AskNoteContext.fromContent(
    String content, {
    AskLimits limits = const AskLimits(),
  }) {
    assertNotEncrypted(content, what: '메모');
    final split = splitNoteContent(content);
    return AskNoteContext.fromNote(
      title: split.title,
      body: split.body,
      limits: limits,
    );
  }

  /// 더 짧게 줄인 맥락. 프롬프트가 상한을 넘을 때 쓴다.
  AskNoteContext shortenedTo(int maxChars) {
    if (body.length <= maxChars) return this;
    final shortened = shortenBody(body, maxChars);
    return AskNoteContext._(
      title: title,
      body: shortened,
      truncated: true,
      originalBodyChars: originalBodyChars,
    );
  }

  /// 프롬프트에 넣을 글자 수.
  int get charCount => title.length + body.length;

  bool get isEmpty => body.isEmpty && title.isEmpty;

  @override
  String toString() =>
      'AskNoteContext($title, ${body.length}자'
      '${truncated ? ', 줄임(원본 $originalBodyChars자)' : ''})';

  /// 잠긴 메모의 암호문이 섞여 있으면 [AskException]을 던진다.
  ///
  /// 복호화되지 않은 본문을 그대로 보내면 알아볼 수 없는 문자열이 외부
  /// 서버로 나간다. 답도 쓸모없고, 남의 서버에 남는 것은 사용자가 잠가 둔
  /// 메모의 암호문이다. 요청을 만들기 전에 막는다.
  ///
  /// 앞머리만 보지 않고 어디에 있든 찾는다. 제목 줄 뒤에 암호문이 붙은
  /// 저장 형태가 있어서, 앞머리만 보면 통과해 버린다.
  static void assertNotEncrypted(String? text, {required String what}) {
    if (text == null || text.isEmpty) return;
    if (!text.contains(encryptedNotePrefix)) return;
    throw AskException(
      kind: AskErrorKind.lockedNote,
      message: '잠긴 메모는 그대로 보낼 수 없습니다. 메모를 먼저 연 다음 다시 시도해 주세요.',
      detail: '$what에 암호문이 들어 있다',
    );
  }

  /// 앞뒤를 남기고 가운데를 덜어 낸다. 근거는 [AskNoteContext.fromNote].
  static String shortenBody(String body, int maxChars) {
    if (maxChars <= 0) return '';
    if (body.length <= maxChars) return body;

    final room = maxChars - askContextElision.length - 2;
    if (room <= 0) {
      return body.substring(0, maxChars);
    }

    final headLength = (room * 6) ~/ 10;
    final tailLength = room - headLength;

    final head = _cutHead(body, headLength);
    final tail = _cutTail(body, tailLength);
    return '$head\n$askContextElision\n$tail';
  }

  /// 앞에서 [length]글자를 가져오되 가까운 줄바꿈에서 끊는다.
  static String _cutHead(String body, int length) {
    final raw = body.substring(0, length);
    final lastBreak = raw.lastIndexOf('\n');
    // 너무 앞에서 끊으면 남는 것이 없다. 뒤쪽 30% 안에 있을 때만 쓴다.
    if (lastBreak > length * 0.7) {
      return raw.substring(0, lastBreak).trimRight();
    }
    return raw.trimRight();
  }

  /// 뒤에서 [length]글자를 가져오되 가까운 줄바꿈에서 끊는다.
  static String _cutTail(String body, int length) {
    final raw = body.substring(body.length - length);
    final firstBreak = raw.indexOf('\n');
    if (firstBreak >= 0 && firstBreak < length * 0.3) {
      return raw.substring(firstBreak + 1).trimLeft();
    }
    return raw.trimLeft();
  }
}
