import 'package:dio/dio.dart';

/// NowNote가 쓰는 최소 Dio 헬퍼.
///
/// now_app의 `lib/core/network/dio_client.dart`와 같은 timeout 값을 쓴다.
/// now_core는 Dio 구성(헤더 포함)을 호출부 책임으로 남겨 뒀으므로, 이 헬퍼는
/// now_core에 두지 않고 각 앱이 따로 갖는다.
class DioClient {
  const DioClient._();

  static Dio create({String? baseUrl}) {
    return Dio(
      BaseOptions(
        baseUrl: baseUrl ?? '',
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 60),
      ),
    );
  }
}
