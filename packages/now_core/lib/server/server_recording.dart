import 'dart:io';

import 'package:dio/dio.dart';

import 'server_settings.dart';

/// 녹음 업로드(`POST /api/v1/recordings`) 응답.
class ServerRecordingUploadResult {
  final String localId;
  final String fileName;
  final String? transcript;

  const ServerRecordingUploadResult({
    required this.localId,
    required this.fileName,
    required this.transcript,
  });

  factory ServerRecordingUploadResult.fromJson(Map<String, dynamic> json) {
    return ServerRecordingUploadResult(
      localId: json['local_id']?.toString() ?? '',
      fileName: json['file_name']?.toString() ?? '',
      transcript: json['transcript']?.toString(),
    );
  }
}

/// `/api/v1/recordings` 목록 조회 응답의 항목 하나.
class ServerRecording {
  final int id;
  final String ownerId;
  final String deviceId;
  final String localId;
  final String? noteLocalId;
  final String fileName;
  final String contentType;
  final String? transcript;
  final String? createdAt;
  final String? updatedAt;

  const ServerRecording({
    required this.id,
    required this.ownerId,
    required this.deviceId,
    required this.localId,
    required this.noteLocalId,
    required this.fileName,
    required this.contentType,
    required this.transcript,
    required this.createdAt,
    required this.updatedAt,
  });

  bool get hasTranscript => transcript?.trim().isNotEmpty == true;

  factory ServerRecording.fromJson(Map<String, dynamic> json) {
    return ServerRecording(
      id: int.tryParse(json['id']?.toString() ?? '') ?? 0,
      ownerId: json['owner_id']?.toString() ?? 'local_user',
      deviceId: json['device_id']?.toString() ?? '-',
      localId: json['local_id']?.toString() ?? '',
      noteLocalId: json['note_local_id']?.toString(),
      fileName: json['file_name']?.toString() ?? '',
      contentType: json['content_type']?.toString() ?? '',
      transcript: json['transcript']?.toString(),
      createdAt: json['created_at']?.toString(),
      updatedAt: json['updated_at']?.toString(),
    );
  }
}

/// 녹음 파일 업로드/목록 조회를 담당한다.
///
/// 화면을 갖지 않는다. Dio 인스턴스(헤더 구성 포함)는 호출하는 쪽이 만들어
/// 넘긴다 — `server/server_profile.dart`와 같은 패턴이다.
class ServerRecordingApi {
  const ServerRecordingApi._();

  /// `POST /api/v1/recordings`로 로컬 녹음 파일을 multipart로 올린다.
  static Future<ServerRecordingUploadResult> uploadRecordingFile({
    required Dio dio,
    required ServerSettings settings,
    required String filePath,
    required String localId,
    required String? noteLocalId,
    required String? transcript,
  }) async {
    if (!settings.enabled) {
      throw Exception('서버 동기화가 꺼져 있습니다');
    }
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    final file = File(filePath);
    if (!await file.exists()) {
      throw Exception('녹음 파일을 찾을 수 없습니다');
    }

    final fileName = file.uri.pathSegments.isEmpty
        ? 'recording.aac'
        : file.uri.pathSegments.last;
    try {
      final formData = FormData.fromMap({
        'owner_id': normalizeOwnerId(settings.ownerId),
        'device_id': settings.deviceId,
        'local_id': localId,
        'note_local_id': _blankToNull(noteLocalId),
        'transcript': _blankToNull(transcript),
        'file': await MultipartFile.fromFile(filePath, filename: fileName),
      });
      final res = await dio.post<Map<String, dynamic>>(
        '/api/v1/recordings',
        data: formData,
      );
      return ServerRecordingUploadResult.fromJson(
        res.data ?? const <String, dynamic>{},
      );
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '녹음 업로드 실패'));
    }
  }

  /// `GET /api/v1/recordings`로 녹음 목록을 조회한다.
  static Future<List<ServerRecording>> loadRecordings({
    required Dio dio,
    required ServerSettings settings,
  }) async {
    if (!settings.isConfigured) {
      throw Exception('서버 주소가 없습니다');
    }
    try {
      final ownerId = normalizeOwnerId(settings.ownerId);
      final res = await dio.get<List<dynamic>>(
        '/api/v1/recordings',
        queryParameters: {'owner_id': ownerId},
      );
      return (res.data ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                ServerRecording.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
    } on DioException catch (e) {
      throw Exception(_serverErrorMessage(e, fallback: '녹음 목록 조회 실패'));
    }
  }
}

String? _blankToNull(String? value) {
  final trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
}

// now_core와 now_app이 서로 다른 dio 버전을 해석할 수 있어 DioExceptionType은
// 보지 않는다. 상태 코드와 응답 본문만으로 메시지를 만든다.
// (server/server_connection.dart와 같은 이유로 같은 구현을 둔다.)
String _serverErrorMessage(
  DioException error, {
  String fallback = '요청에 실패했습니다',
}) {
  final status = error.response?.statusCode;
  final prefix = status == null ? '요청 실패' : 'HTTP $status';
  final body = error.response?.data;
  if (body == null) {
    return '$prefix: ${error.message ?? fallback}';
  }

  if (body is Map<String, dynamic>) {
    final detail = body['detail'];
    final message = body['message'];
    if (detail == 'user inactive') {
      return '$prefix: 비활성 사용자라 서버 기능을 사용할 수 없습니다.';
    }
    if (detail is String && detail.isNotEmpty) return '$prefix: $detail';
    if (message is String && message.isNotEmpty) return '$prefix: $message';
  }
  if (body is String && body.isNotEmpty) {
    final text = body.length > 180 ? body.substring(0, 180) : body;
    return '$prefix: $text';
  }
  return '$prefix: ${error.message ?? fallback}';
}
