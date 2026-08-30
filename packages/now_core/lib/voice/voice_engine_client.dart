import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';

import 'voice_settings.dart';

/// 음성 엔진 호출이 실패한 이유.
///
/// 화면에서 이 값으로 안내 문구나 다음 행동을 갈라 쓸 수 있다.
enum VoiceEngineErrorKind {
  /// 서버 주소가 설정되지 않았다.
  notConfigured,

  /// 보낸 요청 자체가 잘못됐다. 빈 문장, 없는 파일 등.
  invalidRequest,

  /// 401/403. API 키가 없거나 틀렸다.
  unauthorized,

  /// 503. 모델을 아직 올리는 중이다.
  modelLoading,

  /// 404. 주소나 API 버전이 맞지 않는다.
  notFound,

  /// 서버에 닿지 못했다.
  connectionFailed,

  /// 시간 안에 응답이 오지 않았다.
  timeout,

  /// 서버가 5xx로 답했다.
  serverError,

  /// 응답이 왔지만 기대한 형식이 아니다.
  invalidResponse,

  /// 위에 해당하지 않는 실패.
  unknown,
}

/// 음성 엔진 호출 실패. [message]는 사용자에게 그대로 보여도 되는 한국어 문구다.
class VoiceEngineException implements Exception {
  VoiceEngineException({
    required this.kind,
    required this.message,
    this.statusCode,
    this.detail,
    this.cause,
  });

  /// 실패 이유.
  final VoiceEngineErrorKind kind;

  /// 사용자에게 보여줄 한국어 문구.
  final String message;

  /// HTTP 상태 코드. 통신 전 실패면 null이다.
  final int? statusCode;

  /// 서버가 준 원문 설명. 로그용이며 사용자에게 보여줄 필요는 없다.
  final String? detail;

  /// 원인 예외.
  final Object? cause;

  /// 다시 시도해 볼 만한 실패인지.
  bool get isRetryable =>
      kind == VoiceEngineErrorKind.modelLoading ||
      kind == VoiceEngineErrorKind.timeout ||
      kind == VoiceEngineErrorKind.connectionFailed ||
      kind == VoiceEngineErrorKind.serverError;

  @override
  String toString() =>
      'VoiceEngineException(${kind.name}, status: $statusCode, $message'
      '${detail == null ? '' : ', detail: $detail'})';
}

/// TTS 보이스 하나.
class VoiceOption {
  const VoiceOption({
    required this.id,
    required this.name,
    this.gender = '',
    this.language = '',
  });

  factory VoiceOption.fromJson(Map<String, dynamic> json) {
    final id = (json['id'] ?? json['voice_id'] ?? json['name'] ?? '').toString();
    final name = (json['name'] ?? id).toString();
    return VoiceOption(
      id: id,
      name: name.isEmpty ? id : name,
      gender: (json['gender'] ?? '').toString(),
      language: (json['language'] ?? '').toString(),
    );
  }

  final String id;
  final String name;
  final String gender;
  final String language;

  @override
  String toString() => 'VoiceOption($id, $name, $gender, $language)';
}

/// `/health` 응답.
class VoiceEngineHealth {
  const VoiceEngineHealth({
    required this.status,
    required this.ready,
    this.engine = '',
    this.kind = '',
    this.model = '',
    this.uptimeSeconds,
    this.statusCode,
  });

  factory VoiceEngineHealth.fromJson(
    Map<String, dynamic> json, {
    int? statusCode,
  }) {
    final uptime = json['uptime_s'];
    return VoiceEngineHealth(
      status: (json['status'] ?? '').toString(),
      ready: json['ready'] == true,
      engine: (json['engine'] ?? '').toString(),
      kind: (json['kind'] ?? '').toString(),
      model: (json['model'] ?? '').toString(),
      uptimeSeconds: uptime is num ? uptime.toDouble() : null,
      statusCode: statusCode,
    );
  }

  /// 서버가 알려준 상태 문자열. 정상이면 `ok`.
  final String status;

  /// 모델이 올라와 실제로 쓸 수 있는지. false면 아직 못 쓴다.
  final bool ready;

  /// 엔진 이름. 예: `whisper`, `supertonic`.
  final String engine;

  /// 엔진 종류. 예: `stt`, `tts`.
  final String kind;

  /// 올라와 있는 모델 이름.
  final String model;

  /// 서버가 떠 있는 시간(초).
  final double? uptimeSeconds;

  /// 응답 HTTP 상태 코드. 모델 로딩 중이면 503이 온다.
  final int? statusCode;

  /// 바로 호출해도 되는 상태인지.
  bool get usable => ready && (status.isEmpty || status == 'ok');

  @override
  String toString() =>
      'VoiceEngineHealth($status, ready: $ready, engine: $engine, '
      'kind: $kind, model: $model, http: $statusCode)';
}

/// 음성 합성 결과. 바이트와 함께 서버가 헤더로 준 참고 정보를 담는다.
class VoiceSynthesisResult {
  const VoiceSynthesisResult({
    required this.bytes,
    this.contentType = '',
    this.engine = '',
    this.sampleRate,
    this.audioSeconds,
    this.processingSeconds,
  });

  /// 오디오 바이트. 기본 포맷은 WAV다.
  final Uint8List bytes;

  /// 응답 Content-Type. 예: `audio/wav`.
  final String contentType;

  /// 합성에 쓰인 엔진 (`x-engine`).
  final String engine;

  /// 표본율 (`x-sample-rate`). 확인된 값은 44100이다.
  final int? sampleRate;

  /// 오디오 길이(초) (`x-audio-duration`).
  final double? audioSeconds;

  /// 서버 처리 시간(초) (`x-processing-seconds`).
  final double? processingSeconds;
}

/// STT/TTS 엔진 HTTP 클라이언트. OpenAI Audio API 호환 규격을 따른다.
///
/// 화면을 갖지 않는다. 실패는 삼키지 않고 [VoiceEngineException]으로 던진다.
/// 합성 결과는 바이트로 돌려줄 뿐 재생하지 않는다.
class VoiceEngineClient {
  VoiceEngineClient({required VoiceSettings settings, Dio? dio})
      : _settings = settings,
        _dio = dio ?? Dio();

  /// STT 타임아웃. 변환 시간이 오디오 길이에 비례하므로 넉넉히 잡는다.
  static const Duration sttTimeout = Duration(seconds: 120);

  /// TTS 타임아웃.
  static const Duration ttsTimeout = Duration(seconds: 60);

  /// 목록/상태 조회 타임아웃.
  static const Duration shortTimeout = Duration(seconds: 15);

  /// 연결 타임아웃.
  static const Duration connectTimeout = Duration(seconds: 15);

  /// TTS가 받는 오디오 포맷.
  static const List<String> supportedAudioFormats = [
    'wav',
    'mp3',
    'opus',
    'flac',
    'pcm',
  ];

  final VoiceSettings _settings;
  final Dio _dio;

  VoiceSettings get settings => _settings;

  /// 오디오 파일을 텍스트로 바꾼다. 응답의 `text`를 돌려준다.
  ///
  /// [responseFormat]은 `json`, `text`, `verbose_json`을 받는다.
  Future<String> transcribe({
    required File file,
    String? language,
    String responseFormat = 'json',
  }) async {
    const action = '음성 인식';
    final url = _settings.transcriptionsUrl;
    if (url.isEmpty) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.notConfigured,
        message: '$action 서버 주소가 설정되어 있지 않습니다. 설정에서 주소를 입력해 주세요.',
      );
    }
    if (!file.existsSync()) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.invalidRequest,
        message: '변환할 음성 파일을 찾을 수 없습니다.',
        detail: file.path,
      );
    }

    final lang = (language ?? _settings.language).trim();
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: _basename(file.path),
      ),
      if (lang.isNotEmpty) 'language': lang,
      'response_format': responseFormat,
    });

    final plain = responseFormat == 'text';
    final response = await _run<dynamic>(
      action: action,
      request: () => _dio.post<dynamic>(
        url,
        data: form,
        options: Options(
          headers: _authHeaders(_settings.sttApiKey),
          responseType: plain ? ResponseType.plain : ResponseType.json,
          sendTimeout: sttTimeout,
          receiveTimeout: sttTimeout,
        ),
      ),
    );

    final text = _extractTranscript(response.data, plain: plain);
    if (text == null) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.invalidResponse,
        message: '$action 서버 응답을 해석할 수 없습니다.',
        statusCode: response.statusCode,
        detail: _shorten(response.data.toString()),
      );
    }
    return text;
  }

  /// 문장을 오디오 바이트로 바꾼다. 재생은 호출한 쪽이 한다.
  Future<Uint8List> synthesize({
    required String text,
    String? voice,
    String? language,
    double? speed,
    String responseFormat = 'wav',
  }) async {
    final result = await synthesizeDetailed(
      text: text,
      voice: voice,
      language: language,
      speed: speed,
      responseFormat: responseFormat,
    );
    return result.bytes;
  }

  /// [synthesize]와 같지만 서버가 헤더로 준 참고 정보까지 돌려준다.
  Future<VoiceSynthesisResult> synthesizeDetailed({
    required String text,
    String? voice,
    String? language,
    double? speed,
    String responseFormat = 'wav',
  }) async {
    const action = '음성 합성';
    final url = _settings.speechUrl;
    if (url.isEmpty) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.notConfigured,
        message: '$action 서버 주소가 설정되어 있지 않습니다. 설정에서 주소를 입력해 주세요.',
      );
    }
    if (text.trim().isEmpty) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.invalidRequest,
        message: '읽어 줄 문장이 비어 있습니다.',
      );
    }

    final selectedVoice = (voice ?? _settings.voiceId).trim();
    final lang = (language ?? _settings.language).trim();
    final body = <String, dynamic>{
      'input': text,
      if (selectedVoice.isNotEmpty) 'voice': selectedVoice,
      if (lang.isNotEmpty) 'language': lang,
      'speed': VoiceSettings.clampSpeed(speed ?? _settings.speed),
      'response_format': responseFormat,
    };

    final response = await _run<List<int>>(
      action: action,
      request: () => _dio.post<List<int>>(
        url,
        data: body,
        options: Options(
          headers: {
            ..._authHeaders(_settings.ttsApiKey),
            Headers.contentTypeHeader: Headers.jsonContentType,
          },
          responseType: ResponseType.bytes,
          sendTimeout: ttsTimeout,
          receiveTimeout: ttsTimeout,
        ),
      ),
    );

    final bytes = response.data ?? const <int>[];
    final contentType = _header(response.headers, Headers.contentTypeHeader);
    if (contentType.startsWith('application/json')) {
      // 200으로 왔지만 오디오가 아니다. 오류 본문일 가능성이 크다.
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.invalidResponse,
        message: '$action 서버가 오디오 대신 다른 응답을 보냈습니다.',
        statusCode: response.statusCode,
        detail: _shorten(_decodeUtf8(bytes)),
      );
    }
    if (bytes.isEmpty) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.invalidResponse,
        message: '$action 서버가 빈 오디오를 보냈습니다.',
        statusCode: response.statusCode,
      );
    }

    return VoiceSynthesisResult(
      bytes: Uint8List.fromList(bytes),
      contentType: contentType,
      engine: _header(response.headers, 'x-engine'),
      sampleRate: int.tryParse(_header(response.headers, 'x-sample-rate')),
      audioSeconds:
          double.tryParse(_header(response.headers, 'x-audio-duration')),
      processingSeconds:
          double.tryParse(_header(response.headers, 'x-processing-seconds')),
    );
  }

  /// TTS 서버가 제공하는 보이스 목록을 읽는다.
  Future<List<VoiceOption>> loadVoices() async {
    const action = '보이스 목록';
    final url = _settings.voicesUrl;
    if (url.isEmpty) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.notConfigured,
        message: '음성 합성 서버 주소가 설정되어 있지 않습니다. 설정에서 주소를 입력해 주세요.',
      );
    }

    final response = await _run<dynamic>(
      action: action,
      request: () => _dio.get<dynamic>(
        url,
        options: Options(
          headers: _authHeaders(_settings.ttsApiKey),
          responseType: ResponseType.json,
          receiveTimeout: shortTimeout,
        ),
      ),
    );

    final data = _asJson(response.data);
    List<dynamic>? raw;
    if (data is Map<String, dynamic>) {
      final voices = data['voices'];
      if (voices is List) raw = voices;
    } else if (data is List) {
      raw = data;
    }
    if (raw == null) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.invalidResponse,
        message: '$action 응답을 해석할 수 없습니다.',
        statusCode: response.statusCode,
        detail: _shorten(response.data.toString()),
      );
    }

    return raw
        .whereType<Map>()
        .map((e) => VoiceOption.fromJson(Map<String, dynamic>.from(e)))
        .where((e) => e.id.isNotEmpty)
        .toList(growable: false);
  }

  /// 서버 상태를 확인한다. 인증 없이 부른다.
  ///
  /// 모델 로딩 중(503)은 예외로 던지지 않고 `ready == false`인 결과로 돌려준다.
  /// 상태 확인의 목적이 바로 그 구분이기 때문이다. 연결 실패나 타임아웃은
  /// 다른 호출과 같이 [VoiceEngineException]으로 던진다.
  Future<VoiceEngineHealth> checkHealth(String baseUrl) async {
    const action = '음성 서버 상태';
    final url = VoiceSettings.healthUrl(baseUrl);
    if (url.isEmpty) {
      throw VoiceEngineException(
        kind: VoiceEngineErrorKind.notConfigured,
        message: '$action 확인에 필요한 서버 주소가 없습니다. 설정에서 주소를 입력해 주세요.',
      );
    }

    final response = await _run<dynamic>(
      action: action,
      request: () => _dio.get<dynamic>(
        url,
        options: Options(
          responseType: ResponseType.json,
          receiveTimeout: shortTimeout,
          // 503은 "모델 로딩 중"이라는 정상 응답으로 받아 결과에 담는다.
          validateStatus: (status) => status == 200 || status == 503,
        ),
      ),
    );

    final data = _asJson(response.data);
    if (data is Map<String, dynamic>) {
      return VoiceEngineHealth.fromJson(
        data,
        statusCode: response.statusCode,
      );
    }
    if (response.statusCode == 503) {
      return VoiceEngineHealth(
        status: 'loading',
        ready: false,
        statusCode: response.statusCode,
      );
    }
    throw VoiceEngineException(
      kind: VoiceEngineErrorKind.invalidResponse,
      message: '$action 응답을 해석할 수 없습니다.',
      statusCode: response.statusCode,
      detail: _shorten(response.data.toString()),
    );
  }

  // --- 내부 ---

  Map<String, String> _authHeaders(String apiKey) {
    final key = apiKey.trim();
    if (key.isEmpty) return const {};
    return {'Authorization': 'Bearer $key'};
  }

  Future<Response<T>> _run<T>({
    required String action,
    required Future<Response<T>> Function() request,
  }) async {
    try {
      return await request();
    } on DioException catch (error, stack) {
      Error.throwWithStackTrace(_mapDioError(error, action), stack);
    } on VoiceEngineException {
      rethrow;
    } catch (error, stack) {
      Error.throwWithStackTrace(
        VoiceEngineException(
          kind: VoiceEngineErrorKind.unknown,
          message: '$action 중 알 수 없는 문제가 생겼습니다.',
          cause: error,
        ),
        stack,
      );
    }
  }

  VoiceEngineException _mapDioError(DioException error, String action) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      // transformTimeout은 dio 최신판에만 있다. 앱이 쓰는 버전에 맞춰 빼둔다.
        return VoiceEngineException(
          kind: VoiceEngineErrorKind.timeout,
          message: '$action 서버 응답이 시간 안에 오지 않았습니다. 잠시 후 다시 시도해 주세요.',
          cause: error,
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.badCertificate:
        return VoiceEngineException(
          kind: VoiceEngineErrorKind.connectionFailed,
          message: '$action 서버에 연결할 수 없습니다. 주소와 네트워크 상태를 확인해 주세요.',
          detail: error.message,
          cause: error,
        );
      case DioExceptionType.cancel:
        return VoiceEngineException(
          kind: VoiceEngineErrorKind.unknown,
          message: '$action 요청이 취소되었습니다.',
          cause: error,
        );
      case DioExceptionType.badResponse:
        return _mapStatus(error, action);
      // dio 버전마다 열거값이 달라 default로 받는다.
      // now_core와 now_app이 서로 다른 dio 버전을 해석할 수 있다.
      default:
        if (error.error is SocketException || error.error is HttpException) {
          return VoiceEngineException(
            kind: VoiceEngineErrorKind.connectionFailed,
            message: '$action 서버에 연결할 수 없습니다. 주소와 네트워크 상태를 확인해 주세요.',
            detail: error.message,
            cause: error,
          );
        }
        return VoiceEngineException(
          kind: VoiceEngineErrorKind.unknown,
          message: '$action 중 알 수 없는 문제가 생겼습니다.',
          detail: error.message,
          cause: error,
        );
    }
  }

  VoiceEngineException _mapStatus(DioException error, String action) {
    final status = error.response?.statusCode;
    final detail = _errorDetail(error.response?.data);
    final suffix = detail == null ? '' : ' (서버 응답: $detail)';

    if (status == 401 || status == 403) {
      return VoiceEngineException(
        kind: VoiceEngineErrorKind.unauthorized,
        message: '$action 서버 인증에 실패했습니다. API 키를 확인해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status == 503) {
      return VoiceEngineException(
        kind: VoiceEngineErrorKind.modelLoading,
        message: '$action 서버가 모델을 준비하는 중입니다. 잠시 후 다시 시도해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status == 404) {
      return VoiceEngineException(
        kind: VoiceEngineErrorKind.notFound,
        message: '$action 요청 경로를 찾을 수 없습니다. 서버 주소를 확인해 주세요.',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    if (status != null && status >= 500) {
      return VoiceEngineException(
        kind: VoiceEngineErrorKind.serverError,
        message: '$action 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.$suffix',
        statusCode: status,
        detail: detail,
        cause: error,
      );
    }
    return VoiceEngineException(
      kind: VoiceEngineErrorKind.invalidRequest,
      message: '$action 요청을 서버가 거부했습니다.$suffix',
      statusCode: status,
      detail: detail,
      cause: error,
    );
  }

  String? _errorDetail(Object? data) {
    final json = _asJson(data);
    if (json is Map) {
      final detail = json['detail'] ?? json['message'] ?? json['error'];
      if (detail is Map) {
        final inner = detail['message'];
        if (inner != null) return _shorten(inner.toString());
      }
      if (detail != null) return _shorten(detail.toString());
      return null;
    }
    if (json is String && json.trim().isNotEmpty) return _shorten(json);
    return null;
  }

  /// dio는 responseType에 따라 Map, String, 바이트를 준다. 셋 다 받아 넘긴다.
  Object? _asJson(Object? data) {
    if (data == null) return null;
    if (data is Map) return data;
    String? text;
    if (data is String) {
      text = data;
    } else if (data is List<int>) {
      // ResponseType.bytes로 받은 오류 본문. jsonDecode 결과는 List<dynamic>이라
      // 여기 걸리지 않는다.
      text = _decodeUtf8(data);
    } else if (data is List) {
      return data;
    }
    if (text == null) return null;
    final trimmed = text.trim();
    if (trimmed.isEmpty) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return jsonDecode(trimmed);
      } catch (_) {
        return trimmed;
      }
    }
    return trimmed;
  }

  String? _extractTranscript(Object? data, {required bool plain}) {
    final json = _asJson(data);
    if (json is Map) {
      final text = json['text'];
      if (text is String) return text.trim();
      return null;
    }
    if (json is String) {
      // response_format=text면 본문 자체가 결과다.
      if (plain) return json.trim();
      return json.trim().isEmpty ? null : json.trim();
    }
    return null;
  }

  String _decodeUtf8(List<int> bytes) {
    try {
      return utf8.decode(bytes);
    } catch (_) {
      return '';
    }
  }

  String _header(Headers headers, String name) =>
      headers.value(name)?.trim() ?? '';

  String _shorten(String value, {int max = 300}) {
    final trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    return '${trimmed.substring(0, max)}...';
  }

  static String _basename(String path) {
    final parts = path.split(RegExp(r'[\\/]'));
    return parts.isEmpty ? path : parts.last;
  }
}
