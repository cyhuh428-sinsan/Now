import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/llm/llm_image_input.dart';

/// 형식 판별에 쓰는 최소 바이트열. 실제 이미지가 아니어도 서명만 맞으면 된다.
final _jpeg = <int>[0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46];
final _png = <int>[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];
final _webp = <int>[
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x00, 0x00, 0x00, 0x00, // 크기
  0x57, 0x45, 0x42, 0x50, // WEBP
];
final _gif = <int>[0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

void main() {
  group('형식 판별', () {
    test('바이트 서명으로 JPEG/PNG/WebP/GIF를 알아낸다', () {
      expect(LlmImageInput.fromBytes(_jpeg).mimeType, 'image/jpeg');
      expect(LlmImageInput.fromBytes(_png).mimeType, 'image/png');
      expect(LlmImageInput.fromBytes(_webp).mimeType, 'image/webp');
      expect(LlmImageInput.fromBytes(_gif).mimeType, 'image/gif');
    });

    test('서명으로 못 알아내면 확장자를 본다', () {
      final image = LlmImageInput.fromBytes(
        const [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        filePath: '/tmp/받은사진.PNG',
      );
      expect(image.mimeType, 'image/png');
    });

    test('image/jpg로 들어와도 image/jpeg로 맞춘다', () {
      final image = LlmImageInput.fromBytes(_jpeg, mimeType: 'IMAGE/JPG');
      expect(image.mimeType, 'image/jpeg');
    });

    test('서명도 확장자도 모르면 형식 오류를 던진다', () {
      expect(
        () => LlmImageInput.fromBytes(
          const [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          filePath: '/tmp/문서.pdf',
        ),
        throwsA(isA<LlmImageException>().having(
          (e) => e.problem,
          'problem',
          LlmImageProblem.unsupportedFormat,
        )),
      );
    });

    test('빈 바이트는 만들 수 없다', () {
      expect(
        () => LlmImageInput.fromBytes(const []),
        throwsA(isA<LlmImageException>()
            .having((e) => e.problem, 'problem', LlmImageProblem.empty)),
      );
    });
  });

  group('크기 제한', () {
    test('상한과 같은 크기는 통과한다', () {
      final bytes = List<int>.filled(LlmImageInput.maxBytes, 0)
        ..setRange(0, _jpeg.length, _jpeg);
      final image = LlmImageInput.fromBytes(bytes);
      expect(image.byteLength, LlmImageInput.maxBytes);
    });

    test('상한을 1바이트 넘으면 만들지 못한다', () {
      final bytes = List<int>.filled(LlmImageInput.maxBytes + 1, 0)
        ..setRange(0, _jpeg.length, _jpeg);
      expect(
        () => LlmImageInput.fromBytes(bytes),
        throwsA(isA<LlmImageException>()
            .having((e) => e.problem, 'problem', LlmImageProblem.tooLarge)),
      );
    });

    test('크기 초과 안내에 실제 크기와 한도가 들어간다', () {
      final bytes = List<int>.filled(LlmImageInput.maxBytes + 1, 0)
        ..setRange(0, _jpeg.length, _jpeg);
      try {
        LlmImageInput.fromBytes(bytes);
        fail('예외가 나와야 한다');
      } on LlmImageException catch (e) {
        expect(e.message, contains('4.0MB'));
        expect(e.message, contains('사진이 너무 큽니다'));
      }
    });
  });

  group('요청에 실을 형태', () {
    test('base64Data는 순수 base64다', () {
      final image = LlmImageInput.fromBytes(_png);
      expect(image.base64Data, base64Encode(_png));
      expect(image.base64Data, isNot(startsWith('data:')));
    });

    test('dataUrl은 MIME 타입이 앞에 붙은 형태다', () {
      final image = LlmImageInput.fromBytes(_png);
      expect(image.dataUrl, 'data:image/png;base64,${base64Encode(_png)}');
    });
  });
}
