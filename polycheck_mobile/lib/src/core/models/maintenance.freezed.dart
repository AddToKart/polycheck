// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'maintenance.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$MaintenanceBlockBody {

 String get code; String get message; String? get estimatedEnd;
/// Create a copy of MaintenanceBlockBody
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MaintenanceBlockBodyCopyWith<MaintenanceBlockBody> get copyWith => _$MaintenanceBlockBodyCopyWithImpl<MaintenanceBlockBody>(this as MaintenanceBlockBody, _$identity);

  /// Serializes this MaintenanceBlockBody to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MaintenanceBlockBody&&(identical(other.code, code) || other.code == code)&&(identical(other.message, message) || other.message == message)&&(identical(other.estimatedEnd, estimatedEnd) || other.estimatedEnd == estimatedEnd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,code,message,estimatedEnd);

@override
String toString() {
  return 'MaintenanceBlockBody(code: $code, message: $message, estimatedEnd: $estimatedEnd)';
}


}

/// @nodoc
abstract mixin class $MaintenanceBlockBodyCopyWith<$Res>  {
  factory $MaintenanceBlockBodyCopyWith(MaintenanceBlockBody value, $Res Function(MaintenanceBlockBody) _then) = _$MaintenanceBlockBodyCopyWithImpl;
@useResult
$Res call({
 String code, String message, String? estimatedEnd
});




}
/// @nodoc
class _$MaintenanceBlockBodyCopyWithImpl<$Res>
    implements $MaintenanceBlockBodyCopyWith<$Res> {
  _$MaintenanceBlockBodyCopyWithImpl(this._self, this._then);

  final MaintenanceBlockBody _self;
  final $Res Function(MaintenanceBlockBody) _then;

/// Create a copy of MaintenanceBlockBody
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? code = null,Object? message = null,Object? estimatedEnd = freezed,}) {
  return _then(MaintenanceBlockBody(
code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,estimatedEnd: freezed == estimatedEnd ? _self.estimatedEnd : estimatedEnd // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [MaintenanceBlockBody].
extension MaintenanceBlockBodyPatterns on MaintenanceBlockBody {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MaintenanceBlockBody value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MaintenanceBlockBody() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MaintenanceBlockBody value)  $default,){
final _that = this;
switch (_that) {
case _MaintenanceBlockBody():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MaintenanceBlockBody value)?  $default,){
final _that = this;
switch (_that) {
case _MaintenanceBlockBody() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String code,  String message,  String? estimatedEnd)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MaintenanceBlockBody() when $default != null:
return $default(_that.code,_that.message,_that.estimatedEnd);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String code,  String message,  String? estimatedEnd)  $default,) {final _that = this;
switch (_that) {
case _MaintenanceBlockBody():
return $default(_that.code,_that.message,_that.estimatedEnd);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String code,  String message,  String? estimatedEnd)?  $default,) {final _that = this;
switch (_that) {
case _MaintenanceBlockBody() when $default != null:
return $default(_that.code,_that.message,_that.estimatedEnd);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _MaintenanceBlockBody implements MaintenanceBlockBody {
  const _MaintenanceBlockBody({this.code = 'system_maintenance', this.message = '', this.estimatedEnd});
  factory _MaintenanceBlockBody.fromJson(Map<String, dynamic> json) => _$MaintenanceBlockBodyFromJson(json);

@override@JsonKey() final  String code;
@override@JsonKey() final  String message;
@override final  String? estimatedEnd;

/// Create a copy of MaintenanceBlockBody
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MaintenanceBlockBodyCopyWith<_MaintenanceBlockBody> get copyWith => __$MaintenanceBlockBodyCopyWithImpl<_MaintenanceBlockBody>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MaintenanceBlockBodyToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MaintenanceBlockBody&&(identical(other.code, code) || other.code == code)&&(identical(other.message, message) || other.message == message)&&(identical(other.estimatedEnd, estimatedEnd) || other.estimatedEnd == estimatedEnd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,code,message,estimatedEnd);

@override
String toString() {
  return 'MaintenanceBlockBody(code: $code, message: $message, estimatedEnd: $estimatedEnd)';
}


}

/// @nodoc
abstract mixin class _$MaintenanceBlockBodyCopyWith<$Res> implements $MaintenanceBlockBodyCopyWith<$Res> {
  factory _$MaintenanceBlockBodyCopyWith(_MaintenanceBlockBody value, $Res Function(_MaintenanceBlockBody) _then) = __$MaintenanceBlockBodyCopyWithImpl;
@override @useResult
$Res call({
 String code, String message, String? estimatedEnd
});




}
/// @nodoc
class __$MaintenanceBlockBodyCopyWithImpl<$Res>
    implements _$MaintenanceBlockBodyCopyWith<$Res> {
  __$MaintenanceBlockBodyCopyWithImpl(this._self, this._then);

  final _MaintenanceBlockBody _self;
  final $Res Function(_MaintenanceBlockBody) _then;

/// Create a copy of MaintenanceBlockBody
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? code = null,Object? message = null,Object? estimatedEnd = freezed,}) {
  return _then(_MaintenanceBlockBody(
code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,estimatedEnd: freezed == estimatedEnd ? _self.estimatedEnd : estimatedEnd // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$MaintenanceStatus {

 bool get enabled; String? get message; String? get estimatedEnd;
/// Create a copy of MaintenanceStatus
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MaintenanceStatusCopyWith<MaintenanceStatus> get copyWith => _$MaintenanceStatusCopyWithImpl<MaintenanceStatus>(this as MaintenanceStatus, _$identity);

  /// Serializes this MaintenanceStatus to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MaintenanceStatus&&(identical(other.enabled, enabled) || other.enabled == enabled)&&(identical(other.message, message) || other.message == message)&&(identical(other.estimatedEnd, estimatedEnd) || other.estimatedEnd == estimatedEnd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,enabled,message,estimatedEnd);

@override
String toString() {
  return 'MaintenanceStatus(enabled: $enabled, message: $message, estimatedEnd: $estimatedEnd)';
}


}

/// @nodoc
abstract mixin class $MaintenanceStatusCopyWith<$Res>  {
  factory $MaintenanceStatusCopyWith(MaintenanceStatus value, $Res Function(MaintenanceStatus) _then) = _$MaintenanceStatusCopyWithImpl;
@useResult
$Res call({
 bool enabled, String? message, String? estimatedEnd
});




}
/// @nodoc
class _$MaintenanceStatusCopyWithImpl<$Res>
    implements $MaintenanceStatusCopyWith<$Res> {
  _$MaintenanceStatusCopyWithImpl(this._self, this._then);

  final MaintenanceStatus _self;
  final $Res Function(MaintenanceStatus) _then;

/// Create a copy of MaintenanceStatus
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? enabled = null,Object? message = freezed,Object? estimatedEnd = freezed,}) {
  return _then(MaintenanceStatus(
enabled: null == enabled ? _self.enabled : enabled // ignore: cast_nullable_to_non_nullable
as bool,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,estimatedEnd: freezed == estimatedEnd ? _self.estimatedEnd : estimatedEnd // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [MaintenanceStatus].
extension MaintenanceStatusPatterns on MaintenanceStatus {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MaintenanceStatus value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MaintenanceStatus() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MaintenanceStatus value)  $default,){
final _that = this;
switch (_that) {
case _MaintenanceStatus():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MaintenanceStatus value)?  $default,){
final _that = this;
switch (_that) {
case _MaintenanceStatus() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool enabled,  String? message,  String? estimatedEnd)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MaintenanceStatus() when $default != null:
return $default(_that.enabled,_that.message,_that.estimatedEnd);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool enabled,  String? message,  String? estimatedEnd)  $default,) {final _that = this;
switch (_that) {
case _MaintenanceStatus():
return $default(_that.enabled,_that.message,_that.estimatedEnd);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool enabled,  String? message,  String? estimatedEnd)?  $default,) {final _that = this;
switch (_that) {
case _MaintenanceStatus() when $default != null:
return $default(_that.enabled,_that.message,_that.estimatedEnd);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _MaintenanceStatus implements MaintenanceStatus {
  const _MaintenanceStatus({required this.enabled, this.message, this.estimatedEnd});
  factory _MaintenanceStatus.fromJson(Map<String, dynamic> json) => _$MaintenanceStatusFromJson(json);

@override final  bool enabled;
@override final  String? message;
@override final  String? estimatedEnd;

/// Create a copy of MaintenanceStatus
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MaintenanceStatusCopyWith<_MaintenanceStatus> get copyWith => __$MaintenanceStatusCopyWithImpl<_MaintenanceStatus>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MaintenanceStatusToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MaintenanceStatus&&(identical(other.enabled, enabled) || other.enabled == enabled)&&(identical(other.message, message) || other.message == message)&&(identical(other.estimatedEnd, estimatedEnd) || other.estimatedEnd == estimatedEnd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,enabled,message,estimatedEnd);

@override
String toString() {
  return 'MaintenanceStatus(enabled: $enabled, message: $message, estimatedEnd: $estimatedEnd)';
}


}

/// @nodoc
abstract mixin class _$MaintenanceStatusCopyWith<$Res> implements $MaintenanceStatusCopyWith<$Res> {
  factory _$MaintenanceStatusCopyWith(_MaintenanceStatus value, $Res Function(_MaintenanceStatus) _then) = __$MaintenanceStatusCopyWithImpl;
@override @useResult
$Res call({
 bool enabled, String? message, String? estimatedEnd
});




}
/// @nodoc
class __$MaintenanceStatusCopyWithImpl<$Res>
    implements _$MaintenanceStatusCopyWith<$Res> {
  __$MaintenanceStatusCopyWithImpl(this._self, this._then);

  final _MaintenanceStatus _self;
  final $Res Function(_MaintenanceStatus) _then;

/// Create a copy of MaintenanceStatus
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? enabled = null,Object? message = freezed,Object? estimatedEnd = freezed,}) {
  return _then(_MaintenanceStatus(
enabled: null == enabled ? _self.enabled : enabled // ignore: cast_nullable_to_non_nullable
as bool,message: freezed == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String?,estimatedEnd: freezed == estimatedEnd ? _self.estimatedEnd : estimatedEnd // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
