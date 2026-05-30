import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_note/services/note_encryption_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('now_note/encryption');

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('암호화 메모 접두어를 판별한다', () {
    expect(isEncryptedNoteContent('NOW_ENCRYPTED_V1:abc'), isTrue);
    expect(isEncryptedNoteContent('plain text'), isFalse);
    expect(isEncryptedNoteContent(null), isFalse);
  });

  test('복호화 요청을 Android 채널로 전달한다', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          expect(call.method, 'decryptNote');
          expect(call.arguments['content'], 'NOW_ENCRYPTED_V1:payload');
          expect(call.arguments['password'], 'secret');
          return 'plain';
        });

    final result = await NoteEncryptionService().decrypt(
      'NOW_ENCRYPTED_V1:payload',
      'secret',
    );

    expect(result, 'plain');
  });
}
