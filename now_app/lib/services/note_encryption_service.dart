import 'package:flutter/services.dart';

const encryptedNotePrefix = 'NOW_ENCRYPTED_V1:';

bool isEncryptedNoteContent(String? content) {
  return (content ?? '').startsWith(encryptedNotePrefix);
}

class NoteEncryptionService {
  static const MethodChannel _channel = MethodChannel('now_note/encryption');

  Future<String> encrypt(String plainText, String key) async {
    final result = await _channel.invokeMethod<String>('encryptNote', {
      'plainText': plainText,
      'password': key,
    });
    if (result == null || result.isEmpty) {
      throw const FormatException('암호화 결과가 비어 있습니다.');
    }
    return result;
  }

  Future<String> decrypt(String encryptedContent, String key) async {
    final result = await _channel.invokeMethod<String>('decryptNote', {
      'content': encryptedContent,
      'password': key,
    });
    if (result == null) {
      throw const FormatException('복호화 결과가 비어 있습니다.');
    }
    return result;
  }
}
