/// NoteEncryptionService 확장 테스트 (2.3.5)
///
/// 검증 범위:
///   - isEncryptedNoteContent 엣지케이스
///   - encrypt 호출 → Android 채널 전달
///   - 채널 null 반환 시 FormatException
///   - decrypt null 반환 시 FormatException

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now/services/note_encryption_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('now_note/encryption');

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  group('isEncryptedNoteContent', () {
    test('NOW_ENCRYPTED_V1: 접두어가 있으면 true', () {
      expect(isEncryptedNoteContent('NOW_ENCRYPTED_V1:abc123'), isTrue);
    });

    test('접두어 없으면 false', () {
      expect(isEncryptedNoteContent('일반 메모 내용'), isFalse);
    });

    test('null이면 false', () {
      expect(isEncryptedNoteContent(null), isFalse);
    });

    test('빈 문자열이면 false', () {
      expect(isEncryptedNoteContent(''), isFalse);
    });

    test('접두어만 있어도 true', () {
      expect(isEncryptedNoteContent('NOW_ENCRYPTED_V1:'), isTrue);
    });
  });

  group('NoteEncryptionService.encrypt', () {
    test('encryptNote 메서드로 채널 호출', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
        expect(call.method, 'encryptNote');
        expect(call.arguments['plainText'], '비밀 메모');
        expect(call.arguments['password'], 'mypassword');
        return 'NOW_ENCRYPTED_V1:encrypted_payload';
      });

      final result = await NoteEncryptionService().encrypt('비밀 메모', 'mypassword');
      expect(result, 'NOW_ENCRYPTED_V1:encrypted_payload');
    });

    test('채널이 빈 문자열 반환 시 FormatException', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async => '');

      expect(
        () => NoteEncryptionService().encrypt('test', 'key'),
        throwsA(isA<FormatException>()),
      );
    });

    test('채널이 null 반환 시 FormatException', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async => null);

      expect(
        () => NoteEncryptionService().encrypt('test', 'key'),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('NoteEncryptionService.decrypt', () {
    test('decryptNote 메서드로 채널 호출', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
        expect(call.method, 'decryptNote');
        expect(call.arguments['content'], 'NOW_ENCRYPTED_V1:payload');
        expect(call.arguments['password'], 'secret');
        return '원래 내용';
      });

      final result = await NoteEncryptionService().decrypt(
        'NOW_ENCRYPTED_V1:payload',
        'secret',
      );
      expect(result, '원래 내용');
    });

    test('채널이 null 반환 시 FormatException', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async => null);

      expect(
        () => NoteEncryptionService().decrypt('NOW_ENCRYPTED_V1:x', 'key'),
        throwsA(isA<FormatException>()),
      );
    });

    test('빈 문자열 반환은 정상 처리 (빈 내용)', () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async => '');

      final result = await NoteEncryptionService().decrypt(
        'NOW_ENCRYPTED_V1:x',
        'key',
      );
      expect(result, '');
    });
  });
}
