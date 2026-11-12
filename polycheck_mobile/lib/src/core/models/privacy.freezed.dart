// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'privacy.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PrivacyConsentSnapshot {

 int get covered; int get totalActive; String get version;
/// Create a copy of PrivacyConsentSnapshot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PrivacyConsentSnapshotCopyWith<PrivacyConsentSnapshot> get copyWith => _$PrivacyConsentSnapshotCopyWithImpl<PrivacyConsentSnapshot>(this as PrivacyConsentSnapshot, _$identity);

  /// Serializes this PrivacyConsentSnapshot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PrivacyConsentSnapshot&&(identical(other.covered, covered) || other.covered == covered)&&(identical(other.totalActive, totalActive) || other.totalActive == totalActive)&&(identical(other.version, version) || other.version == version));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,covered,totalActive,version);

@override
String toString() {
  return 'PrivacyConsentSnapshot(covered: $covered, totalActive: $totalActive, version: $version)';
}


}

/// @nodoc
abstract mixin class $PrivacyConsentSnapshotCopyWith<$Res>  {
  factory $PrivacyConsentSnapshotCopyWith(PrivacyConsentSnapshot value, $Res Function(PrivacyConsentSnapshot) _then) = _$PrivacyConsentSnapshotCopyWithImpl;
@useResult
$Res call({
 int covered, int totalActive, String version
});




}
/// @nodoc
class _$PrivacyConsentSnapshotCopyWithImpl<$Res>
    implements $PrivacyConsentSnapshotCopyWith<$Res> {
  _$PrivacyConsentSnapshotCopyWithImpl(this._self, this._then);

  final PrivacyConsentSnapshot _self;
  final $Res Function(PrivacyConsentSnapshot) _then;

/// Create a copy of PrivacyConsentSnapshot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? covered = null,Object? totalActive = null,Object? version = null,}) {
  return _then(PrivacyConsentSnapshot(
covered: null == covered ? _self.covered : covered // ignore: cast_nullable_to_non_nullable
as int,totalActive: null == totalActive ? _self.totalActive : totalActive // ignore: cast_nullable_to_non_nullable
as int,version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PrivacyConsentSnapshot].
extension PrivacyConsentSnapshotPatterns on PrivacyConsentSnapshot {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PrivacyConsentSnapshot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PrivacyConsentSnapshot() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PrivacyConsentSnapshot value)  $default,){
final _that = this;
switch (_that) {
case _PrivacyConsentSnapshot():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PrivacyConsentSnapshot value)?  $default,){
final _that = this;
switch (_that) {
case _PrivacyConsentSnapshot() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int covered,  int totalActive,  String version)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PrivacyConsentSnapshot() when $default != null:
return $default(_that.covered,_that.totalActive,_that.version);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int covered,  int totalActive,  String version)  $default,) {final _that = this;
switch (_that) {
case _PrivacyConsentSnapshot():
return $default(_that.covered,_that.totalActive,_that.version);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int covered,  int totalActive,  String version)?  $default,) {final _that = this;
switch (_that) {
case _PrivacyConsentSnapshot() when $default != null:
return $default(_that.covered,_that.totalActive,_that.version);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _PrivacyConsentSnapshot implements PrivacyConsentSnapshot {
  const _PrivacyConsentSnapshot({this.covered = 0, this.totalActive = 0, this.version = ''});
  factory _PrivacyConsentSnapshot.fromJson(Map<String, dynamic> json) => _$PrivacyConsentSnapshotFromJson(json);

@override@JsonKey() final  int covered;
@override@JsonKey() final  int totalActive;
@override@JsonKey() final  String version;

/// Create a copy of PrivacyConsentSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PrivacyConsentSnapshotCopyWith<_PrivacyConsentSnapshot> get copyWith => __$PrivacyConsentSnapshotCopyWithImpl<_PrivacyConsentSnapshot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PrivacyConsentSnapshotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PrivacyConsentSnapshot&&(identical(other.covered, covered) || other.covered == covered)&&(identical(other.totalActive, totalActive) || other.totalActive == totalActive)&&(identical(other.version, version) || other.version == version));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,covered,totalActive,version);

@override
String toString() {
  return 'PrivacyConsentSnapshot(covered: $covered, totalActive: $totalActive, version: $version)';
}


}

/// @nodoc
abstract mixin class _$PrivacyConsentSnapshotCopyWith<$Res> implements $PrivacyConsentSnapshotCopyWith<$Res> {
  factory _$PrivacyConsentSnapshotCopyWith(_PrivacyConsentSnapshot value, $Res Function(_PrivacyConsentSnapshot) _then) = __$PrivacyConsentSnapshotCopyWithImpl;
@override @useResult
$Res call({
 int covered, int totalActive, String version
});




}
/// @nodoc
class __$PrivacyConsentSnapshotCopyWithImpl<$Res>
    implements _$PrivacyConsentSnapshotCopyWith<$Res> {
  __$PrivacyConsentSnapshotCopyWithImpl(this._self, this._then);

  final _PrivacyConsentSnapshot _self;
  final $Res Function(_PrivacyConsentSnapshot) _then;

/// Create a copy of PrivacyConsentSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? covered = null,Object? totalActive = null,Object? version = null,}) {
  return _then(_PrivacyConsentSnapshot(
covered: null == covered ? _self.covered : covered // ignore: cast_nullable_to_non_nullable
as int,totalActive: null == totalActive ? _self.totalActive : totalActive // ignore: cast_nullable_to_non_nullable
as int,version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$PrivacyEphemeralSnapshot {

 String? get lastRunAt; int? get recordsShredded; int? get attemptsShredded;
/// Create a copy of PrivacyEphemeralSnapshot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PrivacyEphemeralSnapshotCopyWith<PrivacyEphemeralSnapshot> get copyWith => _$PrivacyEphemeralSnapshotCopyWithImpl<PrivacyEphemeralSnapshot>(this as PrivacyEphemeralSnapshot, _$identity);

  /// Serializes this PrivacyEphemeralSnapshot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PrivacyEphemeralSnapshot&&(identical(other.lastRunAt, lastRunAt) || other.lastRunAt == lastRunAt)&&(identical(other.recordsShredded, recordsShredded) || other.recordsShredded == recordsShredded)&&(identical(other.attemptsShredded, attemptsShredded) || other.attemptsShredded == attemptsShredded));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,lastRunAt,recordsShredded,attemptsShredded);

@override
String toString() {
  return 'PrivacyEphemeralSnapshot(lastRunAt: $lastRunAt, recordsShredded: $recordsShredded, attemptsShredded: $attemptsShredded)';
}


}

/// @nodoc
abstract mixin class $PrivacyEphemeralSnapshotCopyWith<$Res>  {
  factory $PrivacyEphemeralSnapshotCopyWith(PrivacyEphemeralSnapshot value, $Res Function(PrivacyEphemeralSnapshot) _then) = _$PrivacyEphemeralSnapshotCopyWithImpl;
@useResult
$Res call({
 String? lastRunAt, int? recordsShredded, int? attemptsShredded
});




}
/// @nodoc
class _$PrivacyEphemeralSnapshotCopyWithImpl<$Res>
    implements $PrivacyEphemeralSnapshotCopyWith<$Res> {
  _$PrivacyEphemeralSnapshotCopyWithImpl(this._self, this._then);

  final PrivacyEphemeralSnapshot _self;
  final $Res Function(PrivacyEphemeralSnapshot) _then;

/// Create a copy of PrivacyEphemeralSnapshot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? lastRunAt = freezed,Object? recordsShredded = freezed,Object? attemptsShredded = freezed,}) {
  return _then(PrivacyEphemeralSnapshot(
lastRunAt: freezed == lastRunAt ? _self.lastRunAt : lastRunAt // ignore: cast_nullable_to_non_nullable
as String?,recordsShredded: freezed == recordsShredded ? _self.recordsShredded : recordsShredded // ignore: cast_nullable_to_non_nullable
as int?,attemptsShredded: freezed == attemptsShredded ? _self.attemptsShredded : attemptsShredded // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [PrivacyEphemeralSnapshot].
extension PrivacyEphemeralSnapshotPatterns on PrivacyEphemeralSnapshot {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PrivacyEphemeralSnapshot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PrivacyEphemeralSnapshot() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PrivacyEphemeralSnapshot value)  $default,){
final _that = this;
switch (_that) {
case _PrivacyEphemeralSnapshot():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PrivacyEphemeralSnapshot value)?  $default,){
final _that = this;
switch (_that) {
case _PrivacyEphemeralSnapshot() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? lastRunAt,  int? recordsShredded,  int? attemptsShredded)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PrivacyEphemeralSnapshot() when $default != null:
return $default(_that.lastRunAt,_that.recordsShredded,_that.attemptsShredded);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? lastRunAt,  int? recordsShredded,  int? attemptsShredded)  $default,) {final _that = this;
switch (_that) {
case _PrivacyEphemeralSnapshot():
return $default(_that.lastRunAt,_that.recordsShredded,_that.attemptsShredded);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? lastRunAt,  int? recordsShredded,  int? attemptsShredded)?  $default,) {final _that = this;
switch (_that) {
case _PrivacyEphemeralSnapshot() when $default != null:
return $default(_that.lastRunAt,_that.recordsShredded,_that.attemptsShredded);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _PrivacyEphemeralSnapshot implements PrivacyEphemeralSnapshot {
  const _PrivacyEphemeralSnapshot({this.lastRunAt, this.recordsShredded, this.attemptsShredded});
  factory _PrivacyEphemeralSnapshot.fromJson(Map<String, dynamic> json) => _$PrivacyEphemeralSnapshotFromJson(json);

@override final  String? lastRunAt;
@override final  int? recordsShredded;
@override final  int? attemptsShredded;

/// Create a copy of PrivacyEphemeralSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PrivacyEphemeralSnapshotCopyWith<_PrivacyEphemeralSnapshot> get copyWith => __$PrivacyEphemeralSnapshotCopyWithImpl<_PrivacyEphemeralSnapshot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PrivacyEphemeralSnapshotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PrivacyEphemeralSnapshot&&(identical(other.lastRunAt, lastRunAt) || other.lastRunAt == lastRunAt)&&(identical(other.recordsShredded, recordsShredded) || other.recordsShredded == recordsShredded)&&(identical(other.attemptsShredded, attemptsShredded) || other.attemptsShredded == attemptsShredded));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,lastRunAt,recordsShredded,attemptsShredded);

@override
String toString() {
  return 'PrivacyEphemeralSnapshot(lastRunAt: $lastRunAt, recordsShredded: $recordsShredded, attemptsShredded: $attemptsShredded)';
}


}

/// @nodoc
abstract mixin class _$PrivacyEphemeralSnapshotCopyWith<$Res> implements $PrivacyEphemeralSnapshotCopyWith<$Res> {
  factory _$PrivacyEphemeralSnapshotCopyWith(_PrivacyEphemeralSnapshot value, $Res Function(_PrivacyEphemeralSnapshot) _then) = __$PrivacyEphemeralSnapshotCopyWithImpl;
@override @useResult
$Res call({
 String? lastRunAt, int? recordsShredded, int? attemptsShredded
});




}
/// @nodoc
class __$PrivacyEphemeralSnapshotCopyWithImpl<$Res>
    implements _$PrivacyEphemeralSnapshotCopyWith<$Res> {
  __$PrivacyEphemeralSnapshotCopyWithImpl(this._self, this._then);

  final _PrivacyEphemeralSnapshot _self;
  final $Res Function(_PrivacyEphemeralSnapshot) _then;

/// Create a copy of PrivacyEphemeralSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? lastRunAt = freezed,Object? recordsShredded = freezed,Object? attemptsShredded = freezed,}) {
  return _then(_PrivacyEphemeralSnapshot(
lastRunAt: freezed == lastRunAt ? _self.lastRunAt : lastRunAt // ignore: cast_nullable_to_non_nullable
as String?,recordsShredded: freezed == recordsShredded ? _self.recordsShredded : recordsShredded // ignore: cast_nullable_to_non_nullable
as int?,attemptsShredded: freezed == attemptsShredded ? _self.attemptsShredded : attemptsShredded // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$PrivacyDataInventoryRow {

 String get data; String get purpose; String get lawfulBasis; String get lifetime;
/// Create a copy of PrivacyDataInventoryRow
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PrivacyDataInventoryRowCopyWith<PrivacyDataInventoryRow> get copyWith => _$PrivacyDataInventoryRowCopyWithImpl<PrivacyDataInventoryRow>(this as PrivacyDataInventoryRow, _$identity);

  /// Serializes this PrivacyDataInventoryRow to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PrivacyDataInventoryRow&&(identical(other.data, data) || other.data == data)&&(identical(other.purpose, purpose) || other.purpose == purpose)&&(identical(other.lawfulBasis, lawfulBasis) || other.lawfulBasis == lawfulBasis)&&(identical(other.lifetime, lifetime) || other.lifetime == lifetime));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,data,purpose,lawfulBasis,lifetime);

@override
String toString() {
  return 'PrivacyDataInventoryRow(data: $data, purpose: $purpose, lawfulBasis: $lawfulBasis, lifetime: $lifetime)';
}


}

/// @nodoc
abstract mixin class $PrivacyDataInventoryRowCopyWith<$Res>  {
  factory $PrivacyDataInventoryRowCopyWith(PrivacyDataInventoryRow value, $Res Function(PrivacyDataInventoryRow) _then) = _$PrivacyDataInventoryRowCopyWithImpl;
@useResult
$Res call({
 String data, String purpose, String lawfulBasis, String lifetime
});




}
/// @nodoc
class _$PrivacyDataInventoryRowCopyWithImpl<$Res>
    implements $PrivacyDataInventoryRowCopyWith<$Res> {
  _$PrivacyDataInventoryRowCopyWithImpl(this._self, this._then);

  final PrivacyDataInventoryRow _self;
  final $Res Function(PrivacyDataInventoryRow) _then;

/// Create a copy of PrivacyDataInventoryRow
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? purpose = null,Object? lawfulBasis = null,Object? lifetime = null,}) {
  return _then(PrivacyDataInventoryRow(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as String,purpose: null == purpose ? _self.purpose : purpose // ignore: cast_nullable_to_non_nullable
as String,lawfulBasis: null == lawfulBasis ? _self.lawfulBasis : lawfulBasis // ignore: cast_nullable_to_non_nullable
as String,lifetime: null == lifetime ? _self.lifetime : lifetime // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PrivacyDataInventoryRow].
extension PrivacyDataInventoryRowPatterns on PrivacyDataInventoryRow {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PrivacyDataInventoryRow value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PrivacyDataInventoryRow() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PrivacyDataInventoryRow value)  $default,){
final _that = this;
switch (_that) {
case _PrivacyDataInventoryRow():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PrivacyDataInventoryRow value)?  $default,){
final _that = this;
switch (_that) {
case _PrivacyDataInventoryRow() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String data,  String purpose,  String lawfulBasis,  String lifetime)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PrivacyDataInventoryRow() when $default != null:
return $default(_that.data,_that.purpose,_that.lawfulBasis,_that.lifetime);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String data,  String purpose,  String lawfulBasis,  String lifetime)  $default,) {final _that = this;
switch (_that) {
case _PrivacyDataInventoryRow():
return $default(_that.data,_that.purpose,_that.lawfulBasis,_that.lifetime);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String data,  String purpose,  String lawfulBasis,  String lifetime)?  $default,) {final _that = this;
switch (_that) {
case _PrivacyDataInventoryRow() when $default != null:
return $default(_that.data,_that.purpose,_that.lawfulBasis,_that.lifetime);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _PrivacyDataInventoryRow implements PrivacyDataInventoryRow {
  const _PrivacyDataInventoryRow({required this.data, required this.purpose, required this.lawfulBasis, required this.lifetime});
  factory _PrivacyDataInventoryRow.fromJson(Map<String, dynamic> json) => _$PrivacyDataInventoryRowFromJson(json);

@override final  String data;
@override final  String purpose;
@override final  String lawfulBasis;
@override final  String lifetime;

/// Create a copy of PrivacyDataInventoryRow
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PrivacyDataInventoryRowCopyWith<_PrivacyDataInventoryRow> get copyWith => __$PrivacyDataInventoryRowCopyWithImpl<_PrivacyDataInventoryRow>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PrivacyDataInventoryRowToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PrivacyDataInventoryRow&&(identical(other.data, data) || other.data == data)&&(identical(other.purpose, purpose) || other.purpose == purpose)&&(identical(other.lawfulBasis, lawfulBasis) || other.lawfulBasis == lawfulBasis)&&(identical(other.lifetime, lifetime) || other.lifetime == lifetime));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,data,purpose,lawfulBasis,lifetime);

@override
String toString() {
  return 'PrivacyDataInventoryRow(data: $data, purpose: $purpose, lawfulBasis: $lawfulBasis, lifetime: $lifetime)';
}


}

/// @nodoc
abstract mixin class _$PrivacyDataInventoryRowCopyWith<$Res> implements $PrivacyDataInventoryRowCopyWith<$Res> {
  factory _$PrivacyDataInventoryRowCopyWith(_PrivacyDataInventoryRow value, $Res Function(_PrivacyDataInventoryRow) _then) = __$PrivacyDataInventoryRowCopyWithImpl;
@override @useResult
$Res call({
 String data, String purpose, String lawfulBasis, String lifetime
});




}
/// @nodoc
class __$PrivacyDataInventoryRowCopyWithImpl<$Res>
    implements _$PrivacyDataInventoryRowCopyWith<$Res> {
  __$PrivacyDataInventoryRowCopyWithImpl(this._self, this._then);

  final _PrivacyDataInventoryRow _self;
  final $Res Function(_PrivacyDataInventoryRow) _then;

/// Create a copy of PrivacyDataInventoryRow
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? purpose = null,Object? lawfulBasis = null,Object? lifetime = null,}) {
  return _then(_PrivacyDataInventoryRow(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as String,purpose: null == purpose ? _self.purpose : purpose // ignore: cast_nullable_to_non_nullable
as String,lawfulBasis: null == lawfulBasis ? _self.lawfulBasis : lawfulBasis // ignore: cast_nullable_to_non_nullable
as String,lifetime: null == lifetime ? _self.lifetime : lifetime // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$PrivacyCenterSnapshot {

 int get retentionDays; PrivacyConsentSnapshot get consent; PrivacyEphemeralSnapshot get ephemeral; List<PrivacyDataInventoryRow> get dataInventory; List<Object?> get breaches;
/// Create a copy of PrivacyCenterSnapshot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PrivacyCenterSnapshotCopyWith<PrivacyCenterSnapshot> get copyWith => _$PrivacyCenterSnapshotCopyWithImpl<PrivacyCenterSnapshot>(this as PrivacyCenterSnapshot, _$identity);

  /// Serializes this PrivacyCenterSnapshot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PrivacyCenterSnapshot&&(identical(other.retentionDays, retentionDays) || other.retentionDays == retentionDays)&&(identical(other.consent, consent) || other.consent == consent)&&(identical(other.ephemeral, ephemeral) || other.ephemeral == ephemeral)&&const DeepCollectionEquality().equals(other.dataInventory, dataInventory)&&const DeepCollectionEquality().equals(other.breaches, breaches));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,retentionDays,consent,ephemeral,const DeepCollectionEquality().hash(dataInventory),const DeepCollectionEquality().hash(breaches));

@override
String toString() {
  return 'PrivacyCenterSnapshot(retentionDays: $retentionDays, consent: $consent, ephemeral: $ephemeral, dataInventory: $dataInventory, breaches: $breaches)';
}


}

/// @nodoc
abstract mixin class $PrivacyCenterSnapshotCopyWith<$Res>  {
  factory $PrivacyCenterSnapshotCopyWith(PrivacyCenterSnapshot value, $Res Function(PrivacyCenterSnapshot) _then) = _$PrivacyCenterSnapshotCopyWithImpl;
@useResult
$Res call({
 int retentionDays, PrivacyConsentSnapshot consent, PrivacyEphemeralSnapshot ephemeral, List<PrivacyDataInventoryRow> dataInventory, List<Object?> breaches
});


$PrivacyConsentSnapshotCopyWith<$Res> get consent;$PrivacyEphemeralSnapshotCopyWith<$Res> get ephemeral;

}
/// @nodoc
class _$PrivacyCenterSnapshotCopyWithImpl<$Res>
    implements $PrivacyCenterSnapshotCopyWith<$Res> {
  _$PrivacyCenterSnapshotCopyWithImpl(this._self, this._then);

  final PrivacyCenterSnapshot _self;
  final $Res Function(PrivacyCenterSnapshot) _then;

/// Create a copy of PrivacyCenterSnapshot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? retentionDays = null,Object? consent = null,Object? ephemeral = null,Object? dataInventory = null,Object? breaches = null,}) {
  return _then(PrivacyCenterSnapshot(
retentionDays: null == retentionDays ? _self.retentionDays : retentionDays // ignore: cast_nullable_to_non_nullable
as int,consent: null == consent ? _self.consent : consent // ignore: cast_nullable_to_non_nullable
as PrivacyConsentSnapshot,ephemeral: null == ephemeral ? _self.ephemeral : ephemeral // ignore: cast_nullable_to_non_nullable
as PrivacyEphemeralSnapshot,dataInventory: null == dataInventory ? _self.dataInventory : dataInventory // ignore: cast_nullable_to_non_nullable
as List<PrivacyDataInventoryRow>,breaches: null == breaches ? _self.breaches : breaches // ignore: cast_nullable_to_non_nullable
as List<Object?>,
  ));
}
/// Create a copy of PrivacyCenterSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PrivacyConsentSnapshotCopyWith<$Res> get consent {
  
  return $PrivacyConsentSnapshotCopyWith<$Res>(_self.consent, (value) {
    return _then(_self.copyWith(consent: value));
  });
}/// Create a copy of PrivacyCenterSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PrivacyEphemeralSnapshotCopyWith<$Res> get ephemeral {
  
  return $PrivacyEphemeralSnapshotCopyWith<$Res>(_self.ephemeral, (value) {
    return _then(_self.copyWith(ephemeral: value));
  });
}
}


/// Adds pattern-matching-related methods to [PrivacyCenterSnapshot].
extension PrivacyCenterSnapshotPatterns on PrivacyCenterSnapshot {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PrivacyCenterSnapshot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PrivacyCenterSnapshot() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PrivacyCenterSnapshot value)  $default,){
final _that = this;
switch (_that) {
case _PrivacyCenterSnapshot():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PrivacyCenterSnapshot value)?  $default,){
final _that = this;
switch (_that) {
case _PrivacyCenterSnapshot() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int retentionDays,  PrivacyConsentSnapshot consent,  PrivacyEphemeralSnapshot ephemeral,  List<PrivacyDataInventoryRow> dataInventory,  List<Object?> breaches)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PrivacyCenterSnapshot() when $default != null:
return $default(_that.retentionDays,_that.consent,_that.ephemeral,_that.dataInventory,_that.breaches);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int retentionDays,  PrivacyConsentSnapshot consent,  PrivacyEphemeralSnapshot ephemeral,  List<PrivacyDataInventoryRow> dataInventory,  List<Object?> breaches)  $default,) {final _that = this;
switch (_that) {
case _PrivacyCenterSnapshot():
return $default(_that.retentionDays,_that.consent,_that.ephemeral,_that.dataInventory,_that.breaches);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int retentionDays,  PrivacyConsentSnapshot consent,  PrivacyEphemeralSnapshot ephemeral,  List<PrivacyDataInventoryRow> dataInventory,  List<Object?> breaches)?  $default,) {final _that = this;
switch (_that) {
case _PrivacyCenterSnapshot() when $default != null:
return $default(_that.retentionDays,_that.consent,_that.ephemeral,_that.dataInventory,_that.breaches);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _PrivacyCenterSnapshot implements PrivacyCenterSnapshot {
  const _PrivacyCenterSnapshot({this.retentionDays = geolocationRetentionDefaultDays, required this.consent, required this.ephemeral,  List<PrivacyDataInventoryRow> dataInventory = const <PrivacyDataInventoryRow>[],  List<Object?> breaches = const <Object?>[]}): _dataInventory = dataInventory,_breaches = breaches;
  factory _PrivacyCenterSnapshot.fromJson(Map<String, dynamic> json) => _$PrivacyCenterSnapshotFromJson(json);

@override@JsonKey() final  int retentionDays;
@override final  PrivacyConsentSnapshot consent;
@override final  PrivacyEphemeralSnapshot ephemeral;
 final  List<PrivacyDataInventoryRow> _dataInventory;
@override@JsonKey() List<PrivacyDataInventoryRow> get dataInventory {
  if (_dataInventory is EqualUnmodifiableListView) return _dataInventory;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_dataInventory);
}

 final  List<Object?> _breaches;
@override@JsonKey() List<Object?> get breaches {
  if (_breaches is EqualUnmodifiableListView) return _breaches;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_breaches);
}


/// Create a copy of PrivacyCenterSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PrivacyCenterSnapshotCopyWith<_PrivacyCenterSnapshot> get copyWith => __$PrivacyCenterSnapshotCopyWithImpl<_PrivacyCenterSnapshot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PrivacyCenterSnapshotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PrivacyCenterSnapshot&&(identical(other.retentionDays, retentionDays) || other.retentionDays == retentionDays)&&(identical(other.consent, consent) || other.consent == consent)&&(identical(other.ephemeral, ephemeral) || other.ephemeral == ephemeral)&&const DeepCollectionEquality().equals(other._dataInventory, _dataInventory)&&const DeepCollectionEquality().equals(other._breaches, _breaches));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,retentionDays,consent,ephemeral,const DeepCollectionEquality().hash(_dataInventory),const DeepCollectionEquality().hash(_breaches));

@override
String toString() {
  return 'PrivacyCenterSnapshot(retentionDays: $retentionDays, consent: $consent, ephemeral: $ephemeral, dataInventory: $dataInventory, breaches: $breaches)';
}


}

/// @nodoc
abstract mixin class _$PrivacyCenterSnapshotCopyWith<$Res> implements $PrivacyCenterSnapshotCopyWith<$Res> {
  factory _$PrivacyCenterSnapshotCopyWith(_PrivacyCenterSnapshot value, $Res Function(_PrivacyCenterSnapshot) _then) = __$PrivacyCenterSnapshotCopyWithImpl;
@override @useResult
$Res call({
 int retentionDays, PrivacyConsentSnapshot consent, PrivacyEphemeralSnapshot ephemeral, List<PrivacyDataInventoryRow> dataInventory, List<Object?> breaches
});


@override $PrivacyConsentSnapshotCopyWith<$Res> get consent;@override $PrivacyEphemeralSnapshotCopyWith<$Res> get ephemeral;

}
/// @nodoc
class __$PrivacyCenterSnapshotCopyWithImpl<$Res>
    implements _$PrivacyCenterSnapshotCopyWith<$Res> {
  __$PrivacyCenterSnapshotCopyWithImpl(this._self, this._then);

  final _PrivacyCenterSnapshot _self;
  final $Res Function(_PrivacyCenterSnapshot) _then;

/// Create a copy of PrivacyCenterSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? retentionDays = null,Object? consent = null,Object? ephemeral = null,Object? dataInventory = null,Object? breaches = null,}) {
  return _then(_PrivacyCenterSnapshot(
retentionDays: null == retentionDays ? _self.retentionDays : retentionDays // ignore: cast_nullable_to_non_nullable
as int,consent: null == consent ? _self.consent : consent // ignore: cast_nullable_to_non_nullable
as PrivacyConsentSnapshot,ephemeral: null == ephemeral ? _self.ephemeral : ephemeral // ignore: cast_nullable_to_non_nullable
as PrivacyEphemeralSnapshot,dataInventory: null == dataInventory ? _self._dataInventory : dataInventory // ignore: cast_nullable_to_non_nullable
as List<PrivacyDataInventoryRow>,breaches: null == breaches ? _self._breaches : breaches // ignore: cast_nullable_to_non_nullable
as List<Object?>,
  ));
}

/// Create a copy of PrivacyCenterSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PrivacyConsentSnapshotCopyWith<$Res> get consent {
  
  return $PrivacyConsentSnapshotCopyWith<$Res>(_self.consent, (value) {
    return _then(_self.copyWith(consent: value));
  });
}/// Create a copy of PrivacyCenterSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$PrivacyEphemeralSnapshotCopyWith<$Res> get ephemeral {
  
  return $PrivacyEphemeralSnapshotCopyWith<$Res>(_self.ephemeral, (value) {
    return _then(_self.copyWith(ephemeral: value));
  });
}
}

// dart format on
