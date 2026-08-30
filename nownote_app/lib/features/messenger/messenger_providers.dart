import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'messenger_service.dart';

/// 메신저 화면이 쓰는 [MessengerService].
///
/// 오늘 메모/계층 메모 탭의 provider 패턴(`today_providers.dart`,
/// `tree_providers.dart`)을 따라 서비스 하나를 provider로 노출한다. 위젯
/// 테스트는 이 provider를 override해서 목 Dio를 쓰는 [MessengerService]로
/// 바꿔 끼울 수 있다.
final Provider<MessengerService> messengerServiceProvider =
    Provider<MessengerService>((ref) => MessengerService());
