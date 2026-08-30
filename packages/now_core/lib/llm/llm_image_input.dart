import 'dart:convert';
import 'dart:typed_data';

/// 이미지를 LLM에 실을 수 없는 이유.
enum LlmImageProblem {
  /// 바이트가 하나도 없다.
  empty,

  /// 크기 제한을 넘었다.
  tooLarge,

  /// provider들이 공통으로 받는 형식이 아니다.
  unsupportedFormat,
}

/// 이미지 자체가 요청에 실릴 수 없을 때 던진다.
///
/// [message]는 사용자에게 그대로 보여도 되는 한국어 문구다.
class LlmImageException implements Exception {
  const LlmImageException(this.problem, this.message);

  final LlmImageProblem problem;
  final String message;

  @override
  String toString() => message;
}

/// LLM 요청에 실을 이미지 한 장.
///
/// provider마다 요청 형식이 다르므로(어떤 곳은 data URL, 어떤 곳은 순수 base64)
/// 원본 바이트와 MIME 타입만 들고 있고, 형식 변환은 각 provider가 한다.
class LlmImageInput {
  LlmImageInput._(this.bytes, this.mimeType);

  /// 바이트에서 만든다. 크기와 형식을 여기서 검사한다.
  ///
  /// 검사를 생성 지점에 두면 크기를 넘긴 이미지가 애초에 만들어지지 않는다.
  /// provider 구현마다 같은 검사를 되풀이하지 않아도 된다.
  ///
  /// [mimeType]을 주지 않으면 바이트 앞부분의 서명으로 판별하고, 그것도
  /// 실패하면 [filePath]의 확장자를 본다.
  factory LlmImageInput.fromBytes(
    List<int> bytes, {
    String? mimeType,
    String? filePath,
  }) {
    if (bytes.isEmpty) {
      throw const LlmImageException(
        LlmImageProblem.empty,
        '사진 파일이 비어 있습니다.',
      );
    }
    if (bytes.length > maxBytes) {
      throw LlmImageException(
        LlmImageProblem.tooLarge,
        '사진이 너무 큽니다. ${_mb(bytes.length)}MB인데 '
        '${_mb(maxBytes)}MB까지만 보낼 수 있습니다. 더 작게 찍거나 잘라서 다시 시도해 주세요.',
      );
    }

    final resolved = (mimeType != null && mimeType.trim().isNotEmpty)
        ? _normalizeMime(mimeType)
        : sniffMimeType(bytes) ?? mimeTypeForPath(filePath ?? '');
    if (resolved == null || !supportedMimeTypes.contains(resolved)) {
      throw const LlmImageException(
        LlmImageProblem.unsupportedFormat,
        '읽을 수 없는 사진 형식입니다. JPEG, PNG, WebP, GIF만 보낼 수 있습니다.',
      );
    }

    return LlmImageInput._(Uint8List.fromList(bytes), resolved);
  }

  /// 한 장에 허용하는 원본 바이트 상한.
  ///
  /// 4MiB로 잡은 근거:
  /// - base64는 약 33% 커진다. 4MiB → 약 5.6MB. 여기가 가장 빡빡한 provider인
  ///   Claude의 이미지당 10MB(base64 기준) 제한 안에 든다.
  /// - Gemini는 텍스트까지 합쳐 요청 전체를 20MB로 제한한다. Groq도 이미지가
  ///   든 요청을 20MB로 제한한다. 5.6MB면 둘 다 여유가 있다.
  /// - 모델들은 어차피 긴 변 기준(예: Claude 1568px)으로 축소해서 본다.
  ///   그보다 큰 원본을 보내면 요금과 지연만 늘고 읽히는 내용은 같다.
  /// 앱은 촬영 단계에서 긴 변 1600px로 줄여 보내므로 실제로는 보통
  /// 1MB를 넘지 않는다. 이 상한은 그 앞단이 없을 때를 막는 마지막 방어선이다.
  static const int maxBytes = 4 * 1024 * 1024;

  /// 이미지를 받는 provider들이 공통으로 받아 주는 형식.
  static const List<String> supportedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];

  final Uint8List bytes;
  final String mimeType;

  int get byteLength => bytes.length;

  /// 순수 base64. Claude와 Gemini가 이 형태로 받는다.
  late final String base64Data = base64Encode(bytes);

  /// `data:image/jpeg;base64,...` 형태. OpenAI 호환 API들이 이 형태로 받는다.
  late final String dataUrl = 'data:$mimeType;base64,$base64Data';

  /// 바이트 앞부분의 서명으로 형식을 알아낸다. 확장자가 거짓일 수 있어서
  /// 확장자보다 이쪽을 먼저 본다.
  static String? sniffMimeType(List<int> bytes) {
    if (bytes.length >= 3 &&
        bytes[0] == 0xFF &&
        bytes[1] == 0xD8 &&
        bytes[2] == 0xFF) {
      return 'image/jpeg';
    }
    if (bytes.length >= 8 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47 &&
        bytes[4] == 0x0D &&
        bytes[5] == 0x0A &&
        bytes[6] == 0x1A &&
        bytes[7] == 0x0A) {
      return 'image/png';
    }
    if (bytes.length >= 12 &&
        bytes[0] == 0x52 && // R
        bytes[1] == 0x49 && // I
        bytes[2] == 0x46 && // F
        bytes[3] == 0x46 && // F
        bytes[8] == 0x57 && // W
        bytes[9] == 0x45 && // E
        bytes[10] == 0x42 && // B
        bytes[11] == 0x50) {
      // P
      return 'image/webp';
    }
    if (bytes.length >= 6 &&
        bytes[0] == 0x47 && // G
        bytes[1] == 0x49 && // I
        bytes[2] == 0x46 && // F
        bytes[3] == 0x38) {
      // 8
      return 'image/gif';
    }
    return null;
  }

  /// 확장자로 형식을 짐작한다. 서명 판별이 실패했을 때만 쓴다.
  static String? mimeTypeForPath(String path) {
    final lower = path.toLowerCase();
    final dot = lower.lastIndexOf('.');
    if (dot < 0) return null;
    return switch (lower.substring(dot + 1)) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      _ => null,
    };
  }

  static String _normalizeMime(String raw) {
    final value = raw.trim().toLowerCase();
    return value == 'image/jpg' ? 'image/jpeg' : value;
  }

  static String _mb(int bytes) => (bytes / (1024 * 1024)).toStringAsFixed(1);

  @override
  String toString() => 'LlmImageInput($mimeType, $byteLength bytes)';
}
