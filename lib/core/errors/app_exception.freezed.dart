// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'app_exception.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
  'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models',
);

/// @nodoc
mixin _$AppException {
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String message) network,
    required TResult Function(int statusCode, String code, String message)
    server,
    required TResult Function(String code) conflict,
    required TResult Function(String feature) notYetAvailable,
    required TResult Function(String message) unknown,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String message)? network,
    TResult? Function(int statusCode, String code, String message)? server,
    TResult? Function(String code)? conflict,
    TResult? Function(String feature)? notYetAvailable,
    TResult? Function(String message)? unknown,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String message)? network,
    TResult Function(int statusCode, String code, String message)? server,
    TResult Function(String code)? conflict,
    TResult Function(String feature)? notYetAvailable,
    TResult Function(String message)? unknown,
    required TResult orElse(),
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(NetworkException value) network,
    required TResult Function(ServerException value) server,
    required TResult Function(ConflictException value) conflict,
    required TResult Function(NotYetAvailableException value) notYetAvailable,
    required TResult Function(UnknownException value) unknown,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(NetworkException value)? network,
    TResult? Function(ServerException value)? server,
    TResult? Function(ConflictException value)? conflict,
    TResult? Function(NotYetAvailableException value)? notYetAvailable,
    TResult? Function(UnknownException value)? unknown,
  }) => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(NetworkException value)? network,
    TResult Function(ServerException value)? server,
    TResult Function(ConflictException value)? conflict,
    TResult Function(NotYetAvailableException value)? notYetAvailable,
    TResult Function(UnknownException value)? unknown,
    required TResult orElse(),
  }) => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AppExceptionCopyWith<$Res> {
  factory $AppExceptionCopyWith(
    AppException value,
    $Res Function(AppException) then,
  ) = _$AppExceptionCopyWithImpl<$Res, AppException>;
}

/// @nodoc
class _$AppExceptionCopyWithImpl<$Res, $Val extends AppException>
    implements $AppExceptionCopyWith<$Res> {
  _$AppExceptionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
}

/// @nodoc
abstract class _$$NetworkExceptionImplCopyWith<$Res> {
  factory _$$NetworkExceptionImplCopyWith(
    _$NetworkExceptionImpl value,
    $Res Function(_$NetworkExceptionImpl) then,
  ) = __$$NetworkExceptionImplCopyWithImpl<$Res>;
  @useResult
  $Res call({String message});
}

/// @nodoc
class __$$NetworkExceptionImplCopyWithImpl<$Res>
    extends _$AppExceptionCopyWithImpl<$Res, _$NetworkExceptionImpl>
    implements _$$NetworkExceptionImplCopyWith<$Res> {
  __$$NetworkExceptionImplCopyWithImpl(
    _$NetworkExceptionImpl _value,
    $Res Function(_$NetworkExceptionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? message = null}) {
    return _then(
      _$NetworkExceptionImpl(
        null == message
            ? _value.message
            : message // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc

class _$NetworkExceptionImpl implements NetworkException {
  const _$NetworkExceptionImpl(this.message);

  @override
  final String message;

  @override
  String toString() {
    return 'AppException.network(message: $message)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NetworkExceptionImpl &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, message);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NetworkExceptionImplCopyWith<_$NetworkExceptionImpl> get copyWith =>
      __$$NetworkExceptionImplCopyWithImpl<_$NetworkExceptionImpl>(
        this,
        _$identity,
      );

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String message) network,
    required TResult Function(int statusCode, String code, String message)
    server,
    required TResult Function(String code) conflict,
    required TResult Function(String feature) notYetAvailable,
    required TResult Function(String message) unknown,
  }) {
    return network(message);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String message)? network,
    TResult? Function(int statusCode, String code, String message)? server,
    TResult? Function(String code)? conflict,
    TResult? Function(String feature)? notYetAvailable,
    TResult? Function(String message)? unknown,
  }) {
    return network?.call(message);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String message)? network,
    TResult Function(int statusCode, String code, String message)? server,
    TResult Function(String code)? conflict,
    TResult Function(String feature)? notYetAvailable,
    TResult Function(String message)? unknown,
    required TResult orElse(),
  }) {
    if (network != null) {
      return network(message);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(NetworkException value) network,
    required TResult Function(ServerException value) server,
    required TResult Function(ConflictException value) conflict,
    required TResult Function(NotYetAvailableException value) notYetAvailable,
    required TResult Function(UnknownException value) unknown,
  }) {
    return network(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(NetworkException value)? network,
    TResult? Function(ServerException value)? server,
    TResult? Function(ConflictException value)? conflict,
    TResult? Function(NotYetAvailableException value)? notYetAvailable,
    TResult? Function(UnknownException value)? unknown,
  }) {
    return network?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(NetworkException value)? network,
    TResult Function(ServerException value)? server,
    TResult Function(ConflictException value)? conflict,
    TResult Function(NotYetAvailableException value)? notYetAvailable,
    TResult Function(UnknownException value)? unknown,
    required TResult orElse(),
  }) {
    if (network != null) {
      return network(this);
    }
    return orElse();
  }
}

abstract class NetworkException implements AppException {
  const factory NetworkException(final String message) = _$NetworkExceptionImpl;

  String get message;

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NetworkExceptionImplCopyWith<_$NetworkExceptionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ServerExceptionImplCopyWith<$Res> {
  factory _$$ServerExceptionImplCopyWith(
    _$ServerExceptionImpl value,
    $Res Function(_$ServerExceptionImpl) then,
  ) = __$$ServerExceptionImplCopyWithImpl<$Res>;
  @useResult
  $Res call({int statusCode, String code, String message});
}

/// @nodoc
class __$$ServerExceptionImplCopyWithImpl<$Res>
    extends _$AppExceptionCopyWithImpl<$Res, _$ServerExceptionImpl>
    implements _$$ServerExceptionImplCopyWith<$Res> {
  __$$ServerExceptionImplCopyWithImpl(
    _$ServerExceptionImpl _value,
    $Res Function(_$ServerExceptionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? statusCode = null,
    Object? code = null,
    Object? message = null,
  }) {
    return _then(
      _$ServerExceptionImpl(
        null == statusCode
            ? _value.statusCode
            : statusCode // ignore: cast_nullable_to_non_nullable
                  as int,
        null == code
            ? _value.code
            : code // ignore: cast_nullable_to_non_nullable
                  as String,
        null == message
            ? _value.message
            : message // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc

class _$ServerExceptionImpl implements ServerException {
  const _$ServerExceptionImpl(this.statusCode, this.code, this.message);

  @override
  final int statusCode;
  @override
  final String code;
  @override
  final String message;

  @override
  String toString() {
    return 'AppException.server(statusCode: $statusCode, code: $code, message: $message)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ServerExceptionImpl &&
            (identical(other.statusCode, statusCode) ||
                other.statusCode == statusCode) &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, statusCode, code, message);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ServerExceptionImplCopyWith<_$ServerExceptionImpl> get copyWith =>
      __$$ServerExceptionImplCopyWithImpl<_$ServerExceptionImpl>(
        this,
        _$identity,
      );

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String message) network,
    required TResult Function(int statusCode, String code, String message)
    server,
    required TResult Function(String code) conflict,
    required TResult Function(String feature) notYetAvailable,
    required TResult Function(String message) unknown,
  }) {
    return server(statusCode, code, message);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String message)? network,
    TResult? Function(int statusCode, String code, String message)? server,
    TResult? Function(String code)? conflict,
    TResult? Function(String feature)? notYetAvailable,
    TResult? Function(String message)? unknown,
  }) {
    return server?.call(statusCode, code, message);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String message)? network,
    TResult Function(int statusCode, String code, String message)? server,
    TResult Function(String code)? conflict,
    TResult Function(String feature)? notYetAvailable,
    TResult Function(String message)? unknown,
    required TResult orElse(),
  }) {
    if (server != null) {
      return server(statusCode, code, message);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(NetworkException value) network,
    required TResult Function(ServerException value) server,
    required TResult Function(ConflictException value) conflict,
    required TResult Function(NotYetAvailableException value) notYetAvailable,
    required TResult Function(UnknownException value) unknown,
  }) {
    return server(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(NetworkException value)? network,
    TResult? Function(ServerException value)? server,
    TResult? Function(ConflictException value)? conflict,
    TResult? Function(NotYetAvailableException value)? notYetAvailable,
    TResult? Function(UnknownException value)? unknown,
  }) {
    return server?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(NetworkException value)? network,
    TResult Function(ServerException value)? server,
    TResult Function(ConflictException value)? conflict,
    TResult Function(NotYetAvailableException value)? notYetAvailable,
    TResult Function(UnknownException value)? unknown,
    required TResult orElse(),
  }) {
    if (server != null) {
      return server(this);
    }
    return orElse();
  }
}

abstract class ServerException implements AppException {
  const factory ServerException(
    final int statusCode,
    final String code,
    final String message,
  ) = _$ServerExceptionImpl;

  int get statusCode;
  String get code;
  String get message;

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ServerExceptionImplCopyWith<_$ServerExceptionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$ConflictExceptionImplCopyWith<$Res> {
  factory _$$ConflictExceptionImplCopyWith(
    _$ConflictExceptionImpl value,
    $Res Function(_$ConflictExceptionImpl) then,
  ) = __$$ConflictExceptionImplCopyWithImpl<$Res>;
  @useResult
  $Res call({String code});
}

/// @nodoc
class __$$ConflictExceptionImplCopyWithImpl<$Res>
    extends _$AppExceptionCopyWithImpl<$Res, _$ConflictExceptionImpl>
    implements _$$ConflictExceptionImplCopyWith<$Res> {
  __$$ConflictExceptionImplCopyWithImpl(
    _$ConflictExceptionImpl _value,
    $Res Function(_$ConflictExceptionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? code = null}) {
    return _then(
      _$ConflictExceptionImpl(
        null == code
            ? _value.code
            : code // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc

class _$ConflictExceptionImpl implements ConflictException {
  const _$ConflictExceptionImpl(this.code);

  @override
  final String code;

  @override
  String toString() {
    return 'AppException.conflict(code: $code)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ConflictExceptionImpl &&
            (identical(other.code, code) || other.code == code));
  }

  @override
  int get hashCode => Object.hash(runtimeType, code);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ConflictExceptionImplCopyWith<_$ConflictExceptionImpl> get copyWith =>
      __$$ConflictExceptionImplCopyWithImpl<_$ConflictExceptionImpl>(
        this,
        _$identity,
      );

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String message) network,
    required TResult Function(int statusCode, String code, String message)
    server,
    required TResult Function(String code) conflict,
    required TResult Function(String feature) notYetAvailable,
    required TResult Function(String message) unknown,
  }) {
    return conflict(code);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String message)? network,
    TResult? Function(int statusCode, String code, String message)? server,
    TResult? Function(String code)? conflict,
    TResult? Function(String feature)? notYetAvailable,
    TResult? Function(String message)? unknown,
  }) {
    return conflict?.call(code);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String message)? network,
    TResult Function(int statusCode, String code, String message)? server,
    TResult Function(String code)? conflict,
    TResult Function(String feature)? notYetAvailable,
    TResult Function(String message)? unknown,
    required TResult orElse(),
  }) {
    if (conflict != null) {
      return conflict(code);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(NetworkException value) network,
    required TResult Function(ServerException value) server,
    required TResult Function(ConflictException value) conflict,
    required TResult Function(NotYetAvailableException value) notYetAvailable,
    required TResult Function(UnknownException value) unknown,
  }) {
    return conflict(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(NetworkException value)? network,
    TResult? Function(ServerException value)? server,
    TResult? Function(ConflictException value)? conflict,
    TResult? Function(NotYetAvailableException value)? notYetAvailable,
    TResult? Function(UnknownException value)? unknown,
  }) {
    return conflict?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(NetworkException value)? network,
    TResult Function(ServerException value)? server,
    TResult Function(ConflictException value)? conflict,
    TResult Function(NotYetAvailableException value)? notYetAvailable,
    TResult Function(UnknownException value)? unknown,
    required TResult orElse(),
  }) {
    if (conflict != null) {
      return conflict(this);
    }
    return orElse();
  }
}

abstract class ConflictException implements AppException {
  const factory ConflictException(final String code) = _$ConflictExceptionImpl;

  String get code;

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ConflictExceptionImplCopyWith<_$ConflictExceptionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$NotYetAvailableExceptionImplCopyWith<$Res> {
  factory _$$NotYetAvailableExceptionImplCopyWith(
    _$NotYetAvailableExceptionImpl value,
    $Res Function(_$NotYetAvailableExceptionImpl) then,
  ) = __$$NotYetAvailableExceptionImplCopyWithImpl<$Res>;
  @useResult
  $Res call({String feature});
}

/// @nodoc
class __$$NotYetAvailableExceptionImplCopyWithImpl<$Res>
    extends _$AppExceptionCopyWithImpl<$Res, _$NotYetAvailableExceptionImpl>
    implements _$$NotYetAvailableExceptionImplCopyWith<$Res> {
  __$$NotYetAvailableExceptionImplCopyWithImpl(
    _$NotYetAvailableExceptionImpl _value,
    $Res Function(_$NotYetAvailableExceptionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? feature = null}) {
    return _then(
      _$NotYetAvailableExceptionImpl(
        null == feature
            ? _value.feature
            : feature // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc

class _$NotYetAvailableExceptionImpl implements NotYetAvailableException {
  const _$NotYetAvailableExceptionImpl(this.feature);

  @override
  final String feature;

  @override
  String toString() {
    return 'AppException.notYetAvailable(feature: $feature)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$NotYetAvailableExceptionImpl &&
            (identical(other.feature, feature) || other.feature == feature));
  }

  @override
  int get hashCode => Object.hash(runtimeType, feature);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$NotYetAvailableExceptionImplCopyWith<_$NotYetAvailableExceptionImpl>
  get copyWith =>
      __$$NotYetAvailableExceptionImplCopyWithImpl<
        _$NotYetAvailableExceptionImpl
      >(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String message) network,
    required TResult Function(int statusCode, String code, String message)
    server,
    required TResult Function(String code) conflict,
    required TResult Function(String feature) notYetAvailable,
    required TResult Function(String message) unknown,
  }) {
    return notYetAvailable(feature);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String message)? network,
    TResult? Function(int statusCode, String code, String message)? server,
    TResult? Function(String code)? conflict,
    TResult? Function(String feature)? notYetAvailable,
    TResult? Function(String message)? unknown,
  }) {
    return notYetAvailable?.call(feature);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String message)? network,
    TResult Function(int statusCode, String code, String message)? server,
    TResult Function(String code)? conflict,
    TResult Function(String feature)? notYetAvailable,
    TResult Function(String message)? unknown,
    required TResult orElse(),
  }) {
    if (notYetAvailable != null) {
      return notYetAvailable(feature);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(NetworkException value) network,
    required TResult Function(ServerException value) server,
    required TResult Function(ConflictException value) conflict,
    required TResult Function(NotYetAvailableException value) notYetAvailable,
    required TResult Function(UnknownException value) unknown,
  }) {
    return notYetAvailable(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(NetworkException value)? network,
    TResult? Function(ServerException value)? server,
    TResult? Function(ConflictException value)? conflict,
    TResult? Function(NotYetAvailableException value)? notYetAvailable,
    TResult? Function(UnknownException value)? unknown,
  }) {
    return notYetAvailable?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(NetworkException value)? network,
    TResult Function(ServerException value)? server,
    TResult Function(ConflictException value)? conflict,
    TResult Function(NotYetAvailableException value)? notYetAvailable,
    TResult Function(UnknownException value)? unknown,
    required TResult orElse(),
  }) {
    if (notYetAvailable != null) {
      return notYetAvailable(this);
    }
    return orElse();
  }
}

abstract class NotYetAvailableException implements AppException {
  const factory NotYetAvailableException(final String feature) =
      _$NotYetAvailableExceptionImpl;

  String get feature;

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$NotYetAvailableExceptionImplCopyWith<_$NotYetAvailableExceptionImpl>
  get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$UnknownExceptionImplCopyWith<$Res> {
  factory _$$UnknownExceptionImplCopyWith(
    _$UnknownExceptionImpl value,
    $Res Function(_$UnknownExceptionImpl) then,
  ) = __$$UnknownExceptionImplCopyWithImpl<$Res>;
  @useResult
  $Res call({String message});
}

/// @nodoc
class __$$UnknownExceptionImplCopyWithImpl<$Res>
    extends _$AppExceptionCopyWithImpl<$Res, _$UnknownExceptionImpl>
    implements _$$UnknownExceptionImplCopyWith<$Res> {
  __$$UnknownExceptionImplCopyWithImpl(
    _$UnknownExceptionImpl _value,
    $Res Function(_$UnknownExceptionImpl) _then,
  ) : super(_value, _then);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({Object? message = null}) {
    return _then(
      _$UnknownExceptionImpl(
        null == message
            ? _value.message
            : message // ignore: cast_nullable_to_non_nullable
                  as String,
      ),
    );
  }
}

/// @nodoc

class _$UnknownExceptionImpl implements UnknownException {
  const _$UnknownExceptionImpl(this.message);

  @override
  final String message;

  @override
  String toString() {
    return 'AppException.unknown(message: $message)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UnknownExceptionImpl &&
            (identical(other.message, message) || other.message == message));
  }

  @override
  int get hashCode => Object.hash(runtimeType, message);

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UnknownExceptionImplCopyWith<_$UnknownExceptionImpl> get copyWith =>
      __$$UnknownExceptionImplCopyWithImpl<_$UnknownExceptionImpl>(
        this,
        _$identity,
      );

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String message) network,
    required TResult Function(int statusCode, String code, String message)
    server,
    required TResult Function(String code) conflict,
    required TResult Function(String feature) notYetAvailable,
    required TResult Function(String message) unknown,
  }) {
    return unknown(message);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String message)? network,
    TResult? Function(int statusCode, String code, String message)? server,
    TResult? Function(String code)? conflict,
    TResult? Function(String feature)? notYetAvailable,
    TResult? Function(String message)? unknown,
  }) {
    return unknown?.call(message);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String message)? network,
    TResult Function(int statusCode, String code, String message)? server,
    TResult Function(String code)? conflict,
    TResult Function(String feature)? notYetAvailable,
    TResult Function(String message)? unknown,
    required TResult orElse(),
  }) {
    if (unknown != null) {
      return unknown(message);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(NetworkException value) network,
    required TResult Function(ServerException value) server,
    required TResult Function(ConflictException value) conflict,
    required TResult Function(NotYetAvailableException value) notYetAvailable,
    required TResult Function(UnknownException value) unknown,
  }) {
    return unknown(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(NetworkException value)? network,
    TResult? Function(ServerException value)? server,
    TResult? Function(ConflictException value)? conflict,
    TResult? Function(NotYetAvailableException value)? notYetAvailable,
    TResult? Function(UnknownException value)? unknown,
  }) {
    return unknown?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(NetworkException value)? network,
    TResult Function(ServerException value)? server,
    TResult Function(ConflictException value)? conflict,
    TResult Function(NotYetAvailableException value)? notYetAvailable,
    TResult Function(UnknownException value)? unknown,
    required TResult orElse(),
  }) {
    if (unknown != null) {
      return unknown(this);
    }
    return orElse();
  }
}

abstract class UnknownException implements AppException {
  const factory UnknownException(final String message) = _$UnknownExceptionImpl;

  String get message;

  /// Create a copy of AppException
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UnknownExceptionImplCopyWith<_$UnknownExceptionImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
