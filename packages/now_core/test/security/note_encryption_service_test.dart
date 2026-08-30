/// 메모 암호화 계층 테스트.
///
/// 실제 암호화는 네이티브가 한다. 여기서는 가짜 채널을 물려서
/// 어떤 메서드에 어떤 인자를 넘기는지, 응답을 어떻게 판정하는지만 본다.
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:now_core/now_core.dart';

/// 채널이 받은 호출을 기록하고 정해진 값을 돌려주는 가짜 채널.
class _FakeChannel {
  final MethodChannel channel;
  final List<MethodCall> calls = [];

  _FakeChannel(String name) : channel = MethodChannel(name);

  void reply(Future<Object?> Function(MethodCall call) handler) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          calls.add(call);
          return handler(call);
        });
  }

  void clear() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeChannel fake;
  late NoteEncryptionService service;

  setUp(() {
    fake = _FakeChannel('test/note_encryption');
    service = NoteEncryptionService(channel: fake.channel);
  });

  tearDown(() => fake.clear());

  test('기본 채널 이름은 네이티브와 맺은 계약을 그대로 쓴다', () {
    expect(noteEncryptionChannelName, 'now_note/encryption');
    expect(const NoteEncryptionService().channel.name, 'now_note/encryption');
  });

  group('encrypt', () {
    test('encryptNote를 plainText·password로 부른다', () async {
      fake.reply((_) async => 'NOW_ENCRYPTED_V1:payload');

      final result = await service.encrypt('비밀 메모', 'mypassword');

      expect(result, 'NOW_ENCRYPTED_V1:payload');
      expect(fake.calls, hasLength(1));
      expect(fake.calls.single.method, 'encryptNote');
      expect(fake.calls.single.method, noteEncryptMethod);
      expect(fake.calls.single.arguments, {
        'plainText': '비밀 메모',
        'password': 'mypassword',
      });
    });

    test('빈 문자열 응답은 실패다', () async {
      fake.reply((_) async => '');

      await expectLater(
        service.encrypt('test', 'key'),
        throwsA(
          isA<FormatException>().having(
            (e) => e.message,
            'message',
            '암호화 결과가 비어 있습니다.',
          ),
        ),
      );
    });

    test('null 응답은 실패다', () async {
      fake.reply((_) async => null);

      await expectLater(
        service.encrypt('test', 'key'),
        throwsA(isA<FormatException>()),
      );
    });
  });

  group('decrypt', () {
    test('decryptNote를 content·password로 부른다', () async {
      fake.reply((_) async => '원래 내용');

      final result = await service.decrypt('NOW_ENCRYPTED_V1:payload', 'secret');

      expect(result, '원래 내용');
      expect(fake.calls, hasLength(1));
      expect(fake.calls.single.method, 'decryptNote');
      expect(fake.calls.single.method, noteDecryptMethod);
      expect(fake.calls.single.arguments, {
        'content': 'NOW_ENCRYPTED_V1:payload',
        'password': 'secret',
      });
    });

    test('빈 문자열 응답은 정상이다. 내용이 빈 메모다', () async {
      fake.reply((_) async => '');

      expect(await service.decrypt('NOW_ENCRYPTED_V1:x', 'key'), '');
    });

    test('null 응답은 실패다', () async {
      fake.reply((_) async => null);

      await expectLater(
        service.decrypt('NOW_ENCRYPTED_V1:x', 'key'),
        throwsA(
          isA<FormatException>().having(
            (e) => e.message,
            'message',
            '복호화 결과가 비어 있습니다.',
          ),
        ),
      );
    });
  });

  test('빈 응답 판정은 encrypt와 decrypt가 서로 다르다', () async {
    fake.reply((_) async => '');

    expect(await service.decrypt('NOW_ENCRYPTED_V1:x', 'key'), '');
    await expectLater(
      service.encrypt('내용', 'key'),
      throwsA(isA<FormatException>()),
    );
  });
}
