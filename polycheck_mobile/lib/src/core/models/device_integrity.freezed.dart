// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'device_integrity.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DeviceIntegrityErrorPayload {

 DeviceIntegrityErrorCode get code; String? get message; int? get remainingMinutes; int? get remainingSeconds; ActiveDeviceKind? get activeDeviceKind; String? get activeSessionLastActiveAt;
/// Create a copy of DeviceIntegrityErrorPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DeviceIntegrityErrorPayloadCopyWith<DeviceIntegrityErrorPayload> get copyWith => _$DeviceIntegrityErrorPayloadCopyWithImpl<DeviceIntegrityErrorPayload>(this as DeviceIntegrityErrorPayload, _$identity);

  /// Serializes this DeviceIntegrityErrorPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DeviceIntegrityErrorPayload&&(identical(other.code, code) || other.code == code)&&(identical(other.message, message) || other.message == message)&&(identical(other.remainingMinutes, remainingMinutes) || other.remainingMinutes == remainingMinutes)&&(identical(other.remainingSeconds, remainingSeconds) || other.remainingSeconds == remainingSeconds)&&(identical(other.activeDeviceKind, activeDeviceKind) || other.activeDeviceKind == activeDeviceKind)&&(identical(other.activeSessionLastActiveAt, activeSessionLastActiveAt) || other.activeSessionLastActiveAt == activeSessionLastActiveAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,code,message,remainingMinutes,remainingSeconds,activeDeviceKind,activeSessionLastActiveAt);

@override
String toString() {
  return 'DeviceIntegrityErrorPayload(code: $code, message: $message, remainingMinutes: $remainingMinutes, remainingSeconds: $remainingSeconds, activeDeviceKind: $activeDeviceKind, activeSessionLastActiveAt: $activeSessionLastActiveAt)';
}


}

/// @nodoc
abstract mixin class $DeviceIntegrityErrorPayloadCopyWith<$Res>  {
  factory $DeviceIntegrityErrorPayloadCopyWith(DeviceIntegrityErrorPayload value, $Res Function(DeviceIntegrityErrorPayload) _then) = _$DeviceIntegrityErrorPayloadCopyWithImpl;
@useResult
$Res call({
 DeviceIntegrityErrorCode code, String? message, int? remainingMinutes, int? remainingSeconds, ActiveDeviceKind? activeDeviceKind, String? activeSessionLastActiveAt
});




}
/// @nodoc
class _$DeviceIntegrityErrorPayloadCopyWithImpl<$Res>
    implements $DeviceIntegrityErrorPayloadCopyWith<$Res> {
  _$DeviceIntegrityErrorPayloadCopyWithImpl(this._self, this._then);

  final DeviceIntegrityErrorPayload _self;
  final $Res Function(DeviceIntegrityErrorPayload) _then;

/// Create a copy of DeviceIntegrityErrorPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? code = null,Object? message = freezed,Object? remainingMinutes = freezed,Object? remainingSeconds = freezed,Object? activeDeviceKind = freezed,Object? activeSessionLastActiveAt = freezed,}) {
  return _then(DeviceIntegrityErrorPayload(
code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as DeviceIntegrityErrorCode,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,remainingMinutes: freezed == remainingMinutes ? _self.remainingMinutes : remainingMinutes // ignore: cast_nullable_to_non_nullable
as int?,remainingSeconds: freezed == remainingSeconds ? _self.remainingSeconds : remainingSeconds // ignore: cast_nullable_to_non_nullable
as int?,activeDeviceKind: freezed == activeDeviceKind ? _self.activeDeviceKind : activeDeviceKind // ignore: cast_nullable_to_non_nullable
as ActiveDeviceKind?,activeSessionLastActiveAt: freezed == activeSessionLastActiveAt ? _self.activeSessionLastActiveAt : activeSessionLastActiveAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [DeviceIntegrityErrorPayload].
extension DeviceIntegrityErrorPayloadPatterns on DeviceIntegrityErrorPayload {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DeviceIntegrityErrorPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DeviceIntegrityErrorPayload() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DeviceIntegrityErrorPayload value)  $default,){
final _that = this;
switch (_that) {
case _DeviceIntegrityErrorPayload():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DeviceIntegrityErrorPayload value)?  $default,){
final _that = this;
switch (_that) {
case _DeviceIntegrityErrorPayload() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( DeviceIntegrityErrorCode code,  String? message,  int? remainingMinutes,  int? remainingSeconds,  ActiveDeviceKind? activeDeviceKind,  String? activeSessionLastActiveAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DeviceIntegrityErrorPayload() when $default != null:
return $default(_that.code,_that.message,_that.remainingMinutes,_that.remainingSeconds,_that.activeDeviceKind,_that.activeSessionLastActiveAt);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( DeviceIntegrityErrorCode code,  String? message,  int? remainingMinutes,  int? remainingSeconds,  ActiveDeviceKind? activeDeviceKind,  String? activeSessionLastActiveAt)  $default,) {final _that = this;
switch (_that) {
case _DeviceIntegrityErrorPayload():
return $default(_that.code,_that.message,_that.remainingMinutes,_that.remainingSeconds,_that.activeDeviceKind,_that.activeSessionLastActiveAt);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( DeviceIntegrityErrorCode code,  String? message,  int? remainingMinutes,  int? remainingSeconds,  ActiveDeviceKind? activeDeviceKind,  String? activeSessionLastActiveAt)?  $default,) {final _that = this;
switch (_that) {
case _DeviceIntegrityErrorPayload() when $default != null:
return $default(_that.code,_that.message,_that.remainingMinutes,_that.remainingSeconds,_that.activeDeviceKind,_that.activeSessionLastActiveAt);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [DeviceIntegrityErrorCodeConverter(), ActiveDeviceKindConverter()])
class _DeviceIntegrityErrorPayload implements DeviceIntegrityErrorPayload {
  const _DeviceIntegrityErrorPayload({required this.code, this.message, this.remainingMinutes, this.remainingSeconds, this.activeDeviceKind, this.activeSessionLastActiveAt});
  factory _DeviceIntegrityErrorPayload.fromJson(Map<String, dynamic> json) => _$DeviceIntegrityErrorPayloadFromJson(json);

@override final  DeviceIntegrityErrorCode code;
@override final  String? message;
@override final  int? remainingMinutes;
@override final  int? remainingSeconds;
@override final  ActiveDeviceKind? activeDeviceKind;
@override final  String? activeSessionLastActiveAt;

/// Create a copy of DeviceIntegrityErrorPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DeviceIntegrityErrorPayloadCopyWith<_DeviceIntegrityErrorPayload> get copyWith => __$DeviceIntegrityErrorPayloadCopyWithImpl<_DeviceIntegrityErrorPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DeviceIntegrityErrorPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DeviceIntegrityErrorPayload&&(identical(other.code, code) || other.code == code)&&(identical(other.message, message) || other.message == message)&&(identical(other.remainingMinutes, remainingMinutes) || other.remainingMinutes == remainingMinutes)&&(identical(other.remainingSeconds, remainingSeconds) || other.remainingSeconds == remainingSeconds)&&(identical(other.activeDeviceKind, activeDeviceKind) || other.activeDeviceKind == activeDeviceKind)&&(identical(other.activeSessionLastActiveAt, activeSessionLastActiveAt) || other.activeSessionLastActiveAt == activeSessionLastActiveAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,code,message,remainingMinutes,remainingSeconds,activeDeviceKind,activeSessionLastActiveAt);

@override
String toString() {
  return 'DeviceIntegrityErrorPayload(code: $code, message: $message, remainingMinutes: $remainingMinutes, remainingSeconds: $remainingSeconds, activeDeviceKind: $activeDeviceKind, activeSessionLastActiveAt: $activeSessionLastActiveAt)';
}


}

/// @nodoc
abstract mixin class _$DeviceIntegrityErrorPayloadCopyWith<$Res> implements $DeviceIntegrityErrorPayloadCopyWith<$Res> {
  factory _$DeviceIntegrityErrorPayloadCopyWith(_DeviceIntegrityErrorPayload value, $Res Function(_DeviceIntegrityErrorPayload) _then) = __$DeviceIntegrityErrorPayloadCopyWithImpl;
@override @useResult
$Res call({
 DeviceIntegrityErrorCode code, String? message, int? remainingMinutes, int? remainingSeconds, ActiveDeviceKind? activeDeviceKind, String? activeSessionLastActiveAt
});




}
/// @nodoc
class __$DeviceIntegrityErrorPayloadCopyWithImpl<$Res>
    implements _$DeviceIntegrityErrorPayloadCopyWith<$Res> {
  __$DeviceIntegrityErrorPayloadCopyWithImpl(this._self, this._then);

  final _DeviceIntegrityErrorPayload _self;
  final $Res Function(_DeviceIntegrityErrorPayload) _then;

/// Create a copy of DeviceIntegrityErrorPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? code = null,Object? message = freezed,Object? remainingMinutes = freezed,Object? remainingSeconds = freezed,Object? activeDeviceKind = freezed,Object? activeSessionLastActiveAt = freezed,}) {
  return _then(_DeviceIntegrityErrorPayload(
code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as DeviceIntegrityErrorCode,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,remainingMinutes: freezed == remainingMinutes ? _self.remainingMinutes : remainingMinutes // ignore: cast_nullable_to_non_nullable
as int?,remainingSeconds: freezed == remainingSeconds ? _self.remainingSeconds : remainingSeconds // ignore: cast_nullable_to_non_nullable
as int?,activeDeviceKind: freezed == activeDeviceKind ? _self.activeDeviceKind : activeDeviceKind // ignore: cast_nullable_to_non_nullable
as ActiveDeviceKind?,activeSessionLastActiveAt: freezed == activeSessionLastActiveAt ? _self.activeSessionLastActiveAt : activeSessionLastActiveAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
