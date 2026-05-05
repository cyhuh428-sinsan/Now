import 'package:freezed_annotation/freezed_annotation.dart';

part 'app_exception.freezed.dart';

@freezed
class AppException with _$AppException {
  const factory AppException.network(String message) = NetworkException;
  const factory AppException.server(int statusCode, String code, String message) = ServerException;
  const factory AppException.conflict(String code) = ConflictException;         // 409
  const factory AppException.notYetAvailable(String feature) = NotYetAvailableException; // 503
  const factory AppException.unknown(String message) = UnknownException;
}