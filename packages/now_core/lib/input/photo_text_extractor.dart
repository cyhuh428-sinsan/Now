import 'dart:io';

import 'package:dio/dio.dart';

import '../llm/llm_image_input.dart';
import '../llm/llm_repository.dart';

/// 사진에서 글자를 읽어내지 못한 이유.
///
/// 화면은 이 값으로 안내 문구나 다음 행동을 갈라 쓸 수 있다.
/// [VoiceEngineErrorKind]와 같은 결로 만들었다.
enum PhotoTextErrorKind {
  /// LLM 설정이 비어 있다. 키나 서버 주소가 없다.
  notConfigured,

  /// 고른 provider가 이미지를 받지 못한다.
  providerUnsupported,

  /// 사진 파일을 찾을 수 없다.
  fileNotFound,

  /// 사진이 크기 제한을 넘었다.
  imageTooLarge,

  /// 사진 형식을 읽을 수 없다.
  unsupportedFormat,

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

  /// 응답은 왔는데 읽어낸 글자가 없다.
  noText,

  /// 위에 해당하지 않는 실패.
  unknown,
}

/// 사진 읽기 실패. [message]는 사용자에게 그대로 보여도 되는 한국어 문구다.
class PhotoTextExtractionException implements Exception {
  PhotoTextExtractionException({
    required this.kind,
    required this.message,
    this.statusCode,
    this.detail,
    this.cause,
  });

  /// 실패 이유.
  final PhotoTextErrorKind kind;

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
  /// 설정이 잘못됐거나 사진 자체가 문제면 같은 요청을 다시 보내도 같은 결과다.
  bool get isRetryable =>
      kind == PhotoTextErrorKind.timeout ||
      kind == PhotoTextErrorKind.connectionFailed ||
      kind == PhotoTextErrorKind.serverError;

  @override
  String toString() =>
      'PhotoTextExtractionException(${kind.name}, status: $statusCode, $message'
      '${detail == null ? '' : ', detail: $detail'})';
}

/// 사진 한 장에서 글자를 읽어낸다.
///
/// 화면을 만들지 않는다. 어디에 저장할지도 정하지 않는다. 읽어낸 텍스트를
/// 돌려줄 뿐이고, 그 뒤는 부르는 쪽이 정한다. Now는 도메인 판정으로 보내고
/// NowNote는 편집 중인 메모 본문에 넣는다.
///
/// 도메인 판정(살림·식사·건강)을 하지 않는다. 요약도 하지 않는다.
class PhotoTextExtractor {
  const PhotoTextExtractor(this._llm);

  final LlmRepository _llm;

  /// 사진 한 장에 허용하는 원본 바이트 상한. 근거는 [LlmImageInput.maxBytes].
  static const int maxImageBytes = LlmImageInput.maxBytes;

  /// 사진에 적힌 글자를 그대로 옮겨 적게 하는 프롬프트.
  ///
  /// 요약하거나 해석하면 영수증의 금액이 사라지고 손글씨 메모가 문장으로
  /// 바뀐다. 사용자가 사진을 찍은 이유는 적힌 그대로를 남기려는 것이다.
  static const String transcriptionPrompt = '''
이 사진에 보이는 글자를 그대로 옮겨 적으세요.

[규칙]
- 요약하거나 해석하지 마세요. 사진에 적힌 것을 그대로 옮깁니다.
- 인쇄물, 손글씨, 영수증, 화면 캡처 모두 적힌 그대로 옮깁니다.
- 줄바꿈과 항목 순서는 사진에 보이는 대로 유지하세요.
- 숫자, 금액, 날짜, 단위, 사람 이름은 고치지 말고 보이는 그대로 적으세요.
- 맞춤법이 틀려 있어도 고치지 마세요.
- 번져서 읽을 수 없는 글자는 [읽을 수 없음]으로 표시하세요.
- 설명, 머리말, 마무리 문장, 코드 블록 표시를 붙이지 마세요.
  옮겨 적은 글자만 답하세요.
- 사진에 글자가 하나도 없으면 아무것도 쓰지 말고 빈 응답을 주세요.
''';

  /// 사진 파일에서 글자를 읽어낸다.
  ///
  /// 실패하면 [PhotoTextExtractionException]을 던진다.
  Future<String> extractFromFile(File file) async {
    if (!file.existsSync()) {
      throw PhotoTextExtractionException(
        kind: PhotoTextErrorKind.fileNotFound,
        message: '사진 파일을 찾을 수 없습니다.',
        detail: file.path,
      );
    }
    final bytes = await file.readAsBytes();
    return extractFromBytes(bytes, filePath: file.path);
  }

  /// 사진 바이트에서 글자를 읽어낸다.
  ///
  /// 파일이 아닌 곳(카메라 스트림, 내려받은 첨부)에서 온 이미지도 쓸 수 있다.
  Future<String> extractFromBytes(
    List<int> bytes, {
    String? mimeType,
    String? filePath,
  }) async {
    // 요청을 만들기 전에 막는다. 지원하지 않는 provider인데 텍스트만 조용히
    // 보내면 LLM이 보지도 않은 사진의 내용을 지어낸다.
    if (!_llm.supportsImageInput) {
      throw PhotoTextExtractionException(
        kind: PhotoTextErrorKind.providerUnsupported,
        message: LlmImageUnsupportedException(_llm.config.provider).message,
      );
    }

    final LlmImageInput image;
    try {
      image = LlmImageInput.fromBytes(
        bytes,
        mimeType: mimeType,
        filePath: filePath,
      );
    } on LlmImageException catch (error, stack) {
      Error.throwWithStackTrace(
        PhotoTextExtractionException(
          kind: switch (error.problem) {
            LlmImageProblem.tooLarge => PhotoTextErrorKind.imageTooLarge,
            LlmImageProblem.unsupportedFormat =>
              PhotoTextErrorKind.unsupportedFormat,
            LlmImageProblem.empty => PhotoTextErrorKind.unsupportedFormat,
          },
          message: error.message,
          cause: error,
        ),
        stack,
      );
    }

    final String raw;
    try {
      raw = await _llm.chatWithImage(transcriptionPrompt, image);
    } on LlmImageUnsupportedException catch (error, stack) {
      Error.throwWithStackTrace(
        PhotoTextExtractionException(
          kind: PhotoTextErrorKind.providerUnsupported,
          message: error.message,
          cause: error,
        ),
        stack,
      );
    } on LlmNotConfiguredException catch (error, stack) {
      Error.throwWithStackTrace(
        PhotoTextExtractionException(
          kind: PhotoTextErrorKind.notConfigured,
          message: error.message,
          cause: error,
        ),
        stack,
      );
    } on DioException catch (error, stack) {
      Error.throwWithStackTrace(_mapDioError(error), stack);
    } on PhotoTextExtractionException {
      rethrow;
    } catch (error, stack) {
      // 응답 모양이 달라 인덱싱이 깨진 경우가 여기로 온다.
      Error.throwWithStackTrace(
        PhotoTextExtractionException(
          kind: PhotoTextErrorKind.invalidResponse,
          message: '사진 읽기 응답을 해석할 수 없습니다.',
          detail: _shorten(error.toString()),
          cause: error,
        ),
        stack,
      );
    }

    final text = cleanUp(raw);
    if (text.isEmpty) {
      throw PhotoTextExtractionException(
        kind: PhotoTextErrorKind.noText,
        message: '사진에서 읽어낼 글자를 찾지 못했습니다. 더 밝은 곳에서 다시 찍어 보세요.',
      );
    }
    return text;
  }

  /// 모델이 붙이는 군더더기를 떼어 낸다.
  ///
  /// 프롬프트로 막아도 코드 블록으로 감싸 주는 모델이 있다.
  static String cleanUp(String raw) {
    var text = raw.trim();
    if (text.startsWith('```')) {
      final firstBreak = text.indexOf('\n');
      if (firstBreak > 0) {
        text = text.substring(firstBreak + 1);
      }
      if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3);
      }
      text = text.trim();
    }
    return text;
  }

  PhotoTextExtractionException _mapDioError(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return PhotoTextExtractionException(
          kind: PhotoTextErrorKind.timeout,
          message: '사진 읽기 응답이 시간 안에 오지 않았습니다. 잠시 후 다시 시도해 주세요.',
          cause: error,
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.badCertificate:
        return PhotoTextExtractionException(
          kind: PhotoTextErrorKind.connectionFailed,
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
          return PhotoTextExtractionException(
            kind: PhotoTextErrorKind.connectionFailed,
            message: 'LLM 서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
            detail: error.message,
            cause: error,
          );
        }
        return PhotoTextExtractionException(
          kind: PhotoTextErrorKind.unknown,
          message: '사진을 읽는 중 알 수 없는 문제가 생겼습니다.',
          detail: error.message,
          cause: error,
        );
    }
  }

  PhotoTextExtractionException _mapStatus(DioException error) {
    final status = error.response?.statusCode;
    final detail = _shorten(error.response?.data?.toString());

    if (status == 401 || status == 403) {
      return PhotoTextExtractionException(
        kind: PhotoTextErrorKind.unauthorized,
        message: 'LLM 인증에 실패했습니다. 설정에서 API 키를 확인해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status == 413) {
      return PhotoTextExtractionException(
        kind: PhotoTextErrorKind.imageTooLarge,
        message: '사진이 너무 커서 서버가 거절했습니다. 더 작게 찍어 다시 시도해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status == 404) {
      return PhotoTextExtractionException(
        kind: PhotoTextErrorKind.serverError,
        message: 'LLM 요청 경로를 찾을 수 없습니다. 설정의 서버 주소를 확인해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status != null && status >= 500) {
      return PhotoTextExtractionException(
        kind: PhotoTextErrorKind.serverError,
        message: 'LLM 서버가 오류로 답했습니다. 잠시 후 다시 시도해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    return PhotoTextExtractionException(
      kind: PhotoTextErrorKind.serverError,
      message: 'LLM이 사진 요청을 처리하지 못했습니다. 고른 모델이 사진을 받는지 확인해 주세요.',
      statusCode: status,
      detail: detail,
      cause: error,
    );
  }

  static String? _shorten(String? value, {int limit = 300}) {
    if (value == null || value.isEmpty) return null;
    return value.length <= limit ? value : '${value.substring(0, limit)}…';
  }
}
