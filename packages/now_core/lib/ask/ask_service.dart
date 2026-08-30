/// 묻기 실행.
///
/// 메모를 쓰다 궁금한 것이 생겼을 때 그 자리에서 묻는다. 별도 대화 프로그램이
/// 아니다. 화면을 만들지 않고, 대화를 저장하지 않고, 메모를 저장하지도 않는다.
/// 질문을 보내고 답을 돌려주는 데까지다.
library;

import 'dart:io';

import 'package:dio/dio.dart';

import '../llm/llm_repository.dart';
import 'ask_answer_insertion.dart';
import 'ask_conversation.dart';
import 'ask_exception.dart';
import 'ask_limits.dart';
import 'ask_note_context.dart';
import 'ask_prompt.dart';

/// 묻기 한 번의 결과.
class AskResult {
  const AskResult({
    required this.answer,
    required this.conversation,
    required this.prompt,
  });

  /// 모델이 준 답. 앞뒤 공백만 뗀 그대로다.
  final String answer;

  /// 이번 질문과 답이 더해진 대화.
  ///
  /// 화면은 이 값을 상태로 갈아 끼운다. 실패했을 때는 결과가 없으므로 옛
  /// 대화가 그대로 남고, 실패한 질문이 대화에 끼어들지 않는다.
  final AskConversation conversation;

  /// 실제로 보낸 프롬프트. 무엇이 줄어 나갔는지 화면이 알려 줄 수 있다.
  final AskPrompt prompt;

  @override
  String toString() => 'AskResult(${answer.length}자, $conversation)';
}

/// 질문과 앞선 대화, 고른 맥락을 합쳐 LLM에 보낸다.
///
/// provider를 새로 만들지 않는다. 이미 있는 [LlmRepository]를 그대로 쓴다.
class AskService {
  const AskService(this._llm, {this.limits = const AskLimits()});

  final LlmRepository _llm;

  /// 길이 상한. 근거는 [AskLimits].
  final AskLimits limits;

  /// 답에 남길 출처 이름. provider 이름까지만 남긴다.
  ///
  /// 서버 주소나 키, 모델 식별자는 넣지 않는다. 메모는 동기화되어 서버로
  /// 올라가고 공유될 수 있다.
  String get sourceLabel => _llm.config.provider.displayName;

  /// 묻는다.
  ///
  /// [noteContext]를 넘기면 그 메모를 질문과 함께 보낸다. 넘기지 않으면
  /// 보내지 않는다. **붙일지 말지는 부르는 쪽이 정한다.**
  ///
  /// [conversation]을 넘기면 앞선 대화를 함께 보낸다. 길면 [limits] 기준으로
  /// 앞부분을 덜어 낸다.
  ///
  /// 실패하면 [AskException]을 던진다.
  Future<AskResult> ask({
    required String question,
    AskConversation conversation = const AskConversation.empty(),
    AskNoteContext? noteContext,
  }) async {
    // 설정이 비어 있으면 요청을 만들지 않는다. 빈 주소로 나간 요청은 네트워크
    // 오류로 돌아오고, 그러면 사용자는 무엇을 고쳐야 하는지 알 수 없다.
    if (!_llm.config.isConfigured) {
      throw AskException(
        kind: AskErrorKind.notConfigured,
        message: '먼저 설정에서 사용할 LLM을 지정해 주세요.',
      );
    }

    // 잠긴 메모 차단과 길이 검사는 여기서 함께 일어난다.
    final prompt = AskPromptBuilder(limits: limits).build(
      question: question,
      conversation: conversation,
      noteContext: noteContext,
    );

    final String raw;
    try {
      raw = await _llm.chat(prompt.text);
    } on LlmNotConfiguredException catch (error, stack) {
      Error.throwWithStackTrace(
        AskException(
          kind: AskErrorKind.notConfigured,
          message: error.message,
          cause: error,
        ),
        stack,
      );
    } on DioException catch (error, stack) {
      Error.throwWithStackTrace(_mapDioError(error), stack);
    } on AskException {
      rethrow;
    } catch (error, stack) {
      // 응답 모양이 달라 인덱싱이 깨진 경우가 여기로 온다.
      Error.throwWithStackTrace(
        AskException(
          kind: AskErrorKind.invalidResponse,
          message: '답을 해석할 수 없습니다. 잠시 후 다시 시도해 주세요.',
          detail: _shorten(error.toString()),
          cause: error,
        ),
        stack,
      );
    }

    final answer = raw.trim();
    if (answer.isEmpty) {
      throw AskException(
        kind: AskErrorKind.emptyAnswer,
        message: '답이 비어서 왔습니다. 질문을 조금 바꾸어 다시 물어 보세요.',
      );
    }

    return AskResult(
      answer: answer,
      // 프롬프트에 실린 것이 아니라 원래 대화에 이어 붙인다. 길이 때문에
      // 덜어 낸 앞부분은 화면에는 그대로 남아 있어야 한다.
      conversation: conversation.appendTurn(
        question: question.trim(),
        answer: answer,
      ),
      prompt: prompt,
    );
  }

  /// 답을 메모에 넣을 문자열로 만든다. 형태의 근거는
  /// [buildAskInsertionBlock].
  ///
  /// 저장은 화면이 한다.
  String insertionBlock(String answer, {String? question}) =>
      buildAskInsertionBlock(
        answer,
        question: question,
        sourceLabel: sourceLabel,
      );

  AskException _mapDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return AskException(
          kind: AskErrorKind.timeout,
          message: '답이 시간 안에 오지 않았습니다. 잠시 후 다시 시도해 주세요.',
          cause: error,
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.badCertificate:
        return AskException(
          kind: AskErrorKind.connectionFailed,
          message: 'LLM 서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
          detail: error.message,
          cause: error,
        );
      case DioExceptionType.badResponse:
        return _mapStatus(error);
      // dio 버전마다 열거값이 달라 default로 받는다.
      // now_core와 now_app이 서로 다른 dio 버전을 해석할 수 있다.
      default:
        if (error.error is SocketException || error.error is HttpException) {
          return AskException(
            kind: AskErrorKind.connectionFailed,
            message: 'LLM 서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
            detail: error.message,
            cause: error,
          );
        }
        return AskException(
          kind: AskErrorKind.unknown,
          message: '묻는 중 알 수 없는 문제가 생겼습니다.',
          detail: error.message,
          cause: error,
        );
    }
  }

  AskException _mapStatus(DioException error) {
    final status = error.response?.statusCode;
    final detail = _shorten(error.response?.data?.toString());

    if (status == 401 || status == 403) {
      return AskException(
        kind: AskErrorKind.unauthorized,
        message: 'LLM 인증에 실패했습니다. 설정에서 API 키를 확인해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status == 404) {
      return AskException(
        kind: AskErrorKind.serverError,
        message: 'LLM 주소를 찾을 수 없습니다. 설정에서 서버 주소와 모델을 확인해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status == 408 || status == 504) {
      return AskException(
        kind: AskErrorKind.timeout,
        message: '답이 시간 안에 오지 않았습니다. 잠시 후 다시 시도해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status == 413 || status == 422) {
      return AskException(
        kind: AskErrorKind.serverError,
        message: '보낸 내용이 너무 길어 서버가 거절했습니다. 메모를 함께 보내지 않거나 대화를 새로 시작해 보세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status == 429) {
      return AskException(
        kind: AskErrorKind.serverError,
        message: '요청이 몰려 잠시 거절됐습니다. 잠시 후 다시 시도해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    return AskException(
      kind: AskErrorKind.serverError,
      message: 'LLM 서버가 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      statusCode: status,
      detail: detail,
      cause: error,
    );
  }
}

/// 로그에 남길 만큼만 남긴다. 응답 본문 전체를 들고 다니지 않는다.
String? _shorten(String? value, {int max = 200}) {
  if (value == null) return null;
  final text = value.trim();
  if (text.isEmpty) return null;
  return text.length <= max ? text : '${text.substring(0, max)}…';
}
