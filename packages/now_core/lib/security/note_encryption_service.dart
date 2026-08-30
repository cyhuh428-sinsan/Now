/// 메모 암호화.
///
/// 실제 암·복호화는 네이티브 쪽에서 한다. 여기서는 MethodChannel로 넘기고
/// 결과만 확인한다. Now와 NowNote가 같은 채널을 쓰므로 채널 이름은 계약이다.
library;

import 'package:flutter/services.dart';

/// 네이티브 암호화 구현이 받는 채널 이름.
///
/// 안드로이드 `MainActivity` 가 이 이름으로 핸들러를 건다. 두 앱이 같이 쓰므로
/// 바꾸면 양쪽 네이티브 코드가 함께 깨진다.
const noteEncryptionChannelName = 'now_note/encryption';

/// 암호화 요청 메서드 이름.
const noteEncryptMethod = 'encryptNote';

/// 복호화 요청 메서드 이름.
const noteDecryptMethod = 'decryptNote';

/// 메모 본문을 네이티브 암호화 구현에 넘긴다.
class NoteEncryptionService {
  /// 요청을 보낼 채널. 기본값은 [noteEncryptionChannelName] 채널이다.
  ///
  /// 테스트에서 가짜 채널을 물릴 수 있게 열어 둔다.
  final MethodChannel channel;

  const NoteEncryptionService({
    this.channel = const MethodChannel(noteEncryptionChannelName),
  });

  /// 본문을 암호화한다.
  ///
  /// 빈 결과는 실패로 본다. 암호문은 최소한 접두어를 달고 오기 때문이다.
  Future<String> encrypt(String plainText, String key) async {
    final result = await channel.invokeMethod<String>(noteEncryptMethod, {
      'plainText': plainText,
      'password': key,
    });
    if (result == null || result.isEmpty) {
      throw const FormatException('암호화 결과가 비어 있습니다.');
    }
    return result;
  }

  /// 본문을 복호화한다.
  ///
  /// 빈 문자열은 정상이다. 내용이 빈 메모를 암호화한 경우가 있다.
  /// null만 실패로 본다.
  Future<String> decrypt(String encryptedContent, String key) async {
    final result = await channel.invokeMethod<String>(noteDecryptMethod, {
      'content': encryptedContent,
      'password': key,
    });
    if (result == null) {
      throw const FormatException('복호화 결과가 비어 있습니다.');
    }
    return result;
  }
}
