// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'session.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GeofenceConfig {

 double get latitude; double get longitude; double get radiusMeters;
/// Create a copy of GeofenceConfig
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GeofenceConfigCopyWith<GeofenceConfig> get copyWith => _$GeofenceConfigCopyWithImpl<GeofenceConfig>(this as GeofenceConfig, _$identity);

  /// Serializes this GeofenceConfig to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GeofenceConfig&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.radiusMeters, radiusMeters) || other.radiusMeters == radiusMeters));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,latitude,longitude,radiusMeters);

@override
String toString() {
  return 'GeofenceConfig(latitude: $latitude, longitude: $longitude, radiusMeters: $radiusMeters)';
}


}

/// @nodoc
abstract mixin class $GeofenceConfigCopyWith<$Res>  {
  factory $GeofenceConfigCopyWith(GeofenceConfig value, $Res Function(GeofenceConfig) _then) = _$GeofenceConfigCopyWithImpl;
@useResult
$Res call({
 double latitude, double longitude, double radiusMeters
});




}
/// @nodoc
class _$GeofenceConfigCopyWithImpl<$Res>
    implements $GeofenceConfigCopyWith<$Res> {
  _$GeofenceConfigCopyWithImpl(this._self, this._then);

  final GeofenceConfig _self;
  final $Res Function(GeofenceConfig) _then;

/// Create a copy of GeofenceConfig
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? latitude = null,Object? longitude = null,Object? radiusMeters = null,}) {
  return _then(GeofenceConfig(
latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,radiusMeters: null == radiusMeters ? _self.radiusMeters : radiusMeters // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [GeofenceConfig].
extension GeofenceConfigPatterns on GeofenceConfig {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GeofenceConfig value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GeofenceConfig() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GeofenceConfig value)  $default,){
final _that = this;
switch (_that) {
case _GeofenceConfig():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GeofenceConfig value)?  $default,){
final _that = this;
switch (_that) {
case _GeofenceConfig() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( double latitude,  double longitude,  double radiusMeters)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GeofenceConfig() when $default != null:
return $default(_that.latitude,_that.longitude,_that.radiusMeters);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( double latitude,  double longitude,  double radiusMeters)  $default,) {final _that = this;
switch (_that) {
case _GeofenceConfig():
return $default(_that.latitude,_that.longitude,_that.radiusMeters);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( double latitude,  double longitude,  double radiusMeters)?  $default,) {final _that = this;
switch (_that) {
case _GeofenceConfig() when $default != null:
return $default(_that.latitude,_that.longitude,_that.radiusMeters);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _GeofenceConfig implements GeofenceConfig {
  const _GeofenceConfig({required this.latitude, required this.longitude, required this.radiusMeters});
  factory _GeofenceConfig.fromJson(Map<String, dynamic> json) => _$GeofenceConfigFromJson(json);

@override final  double latitude;
@override final  double longitude;
@override final  double radiusMeters;

/// Create a copy of GeofenceConfig
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GeofenceConfigCopyWith<_GeofenceConfig> get copyWith => __$GeofenceConfigCopyWithImpl<_GeofenceConfig>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GeofenceConfigToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GeofenceConfig&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.radiusMeters, radiusMeters) || other.radiusMeters == radiusMeters));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,latitude,longitude,radiusMeters);

@override
String toString() {
  return 'GeofenceConfig(latitude: $latitude, longitude: $longitude, radiusMeters: $radiusMeters)';
}


}

/// @nodoc
abstract mixin class _$GeofenceConfigCopyWith<$Res> implements $GeofenceConfigCopyWith<$Res> {
  factory _$GeofenceConfigCopyWith(_GeofenceConfig value, $Res Function(_GeofenceConfig) _then) = __$GeofenceConfigCopyWithImpl;
@override @useResult
$Res call({
 double latitude, double longitude, double radiusMeters
});




}
/// @nodoc
class __$GeofenceConfigCopyWithImpl<$Res>
    implements _$GeofenceConfigCopyWith<$Res> {
  __$GeofenceConfigCopyWithImpl(this._self, this._then);

  final _GeofenceConfig _self;
  final $Res Function(_GeofenceConfig) _then;

/// Create a copy of GeofenceConfig
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? latitude = null,Object? longitude = null,Object? radiusMeters = null,}) {
  return _then(_GeofenceConfig(
latitude: null == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double,longitude: null == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double,radiusMeters: null == radiusMeters ? _self.radiusMeters : radiusMeters // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}


/// @nodoc
mixin _$Session {

 String get id; String get sectionId; String get subjectName; String get date; String get startTime; String get endTime; String? get room; SessionMode get mode; int get qrValidityMinutes; int get gracePeriodMinutes; GeofenceConfig? get geofence; bool get isActive; String? get endedAt; String? get qrToken; String? get qrTokenExpiresAt; String? get qrGeneratedAt; int? get startQrValiditySeconds; int? get startGraceMinutes; int? get endQrValiditySeconds; int? get endGraceMinutes; String? get startQrToken; String? get startTokenExpiresAt; String? get startQrGeneratedAt; String? get endQrToken; String? get endTokenExpiresAt; String? get endQrGeneratedAt; bool get pinRequired; String? get autoEndAt; String get teacherId; String? get teacherPublicKey; String get createdAt; bool get isRescheduled; String? get rescheduledFromDate; String? get originalScheduleTime; String? get originalRoom;
/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionCopyWith<Session> get copyWith => _$SessionCopyWithImpl<Session>(this as Session, _$identity);

  /// Serializes this Session to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Session&&(identical(other.id, id) || other.id == id)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.date, date) || other.date == date)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.qrValidityMinutes, qrValidityMinutes) || other.qrValidityMinutes == qrValidityMinutes)&&(identical(other.gracePeriodMinutes, gracePeriodMinutes) || other.gracePeriodMinutes == gracePeriodMinutes)&&(identical(other.geofence, geofence) || other.geofence == geofence)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.endedAt, endedAt) || other.endedAt == endedAt)&&(identical(other.qrToken, qrToken) || other.qrToken == qrToken)&&(identical(other.qrTokenExpiresAt, qrTokenExpiresAt) || other.qrTokenExpiresAt == qrTokenExpiresAt)&&(identical(other.qrGeneratedAt, qrGeneratedAt) || other.qrGeneratedAt == qrGeneratedAt)&&(identical(other.startQrValiditySeconds, startQrValiditySeconds) || other.startQrValiditySeconds == startQrValiditySeconds)&&(identical(other.startGraceMinutes, startGraceMinutes) || other.startGraceMinutes == startGraceMinutes)&&(identical(other.endQrValiditySeconds, endQrValiditySeconds) || other.endQrValiditySeconds == endQrValiditySeconds)&&(identical(other.endGraceMinutes, endGraceMinutes) || other.endGraceMinutes == endGraceMinutes)&&(identical(other.startQrToken, startQrToken) || other.startQrToken == startQrToken)&&(identical(other.startTokenExpiresAt, startTokenExpiresAt) || other.startTokenExpiresAt == startTokenExpiresAt)&&(identical(other.startQrGeneratedAt, startQrGeneratedAt) || other.startQrGeneratedAt == startQrGeneratedAt)&&(identical(other.endQrToken, endQrToken) || other.endQrToken == endQrToken)&&(identical(other.endTokenExpiresAt, endTokenExpiresAt) || other.endTokenExpiresAt == endTokenExpiresAt)&&(identical(other.endQrGeneratedAt, endQrGeneratedAt) || other.endQrGeneratedAt == endQrGeneratedAt)&&(identical(other.pinRequired, pinRequired) || other.pinRequired == pinRequired)&&(identical(other.autoEndAt, autoEndAt) || other.autoEndAt == autoEndAt)&&(identical(other.teacherId, teacherId) || other.teacherId == teacherId)&&(identical(other.teacherPublicKey, teacherPublicKey) || other.teacherPublicKey == teacherPublicKey)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.isRescheduled, isRescheduled) || other.isRescheduled == isRescheduled)&&(identical(other.rescheduledFromDate, rescheduledFromDate) || other.rescheduledFromDate == rescheduledFromDate)&&(identical(other.originalScheduleTime, originalScheduleTime) || other.originalScheduleTime == originalScheduleTime)&&(identical(other.originalRoom, originalRoom) || other.originalRoom == originalRoom));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,sectionId,subjectName,date,startTime,endTime,room,mode,qrValidityMinutes,gracePeriodMinutes,geofence,isActive,endedAt,qrToken,qrTokenExpiresAt,qrGeneratedAt,startQrValiditySeconds,startGraceMinutes,endQrValiditySeconds,endGraceMinutes,startQrToken,startTokenExpiresAt,startQrGeneratedAt,endQrToken,endTokenExpiresAt,endQrGeneratedAt,pinRequired,autoEndAt,teacherId,teacherPublicKey,createdAt,isRescheduled,rescheduledFromDate,originalScheduleTime,originalRoom]);

@override
String toString() {
  return 'Session(id: $id, sectionId: $sectionId, subjectName: $subjectName, date: $date, startTime: $startTime, endTime: $endTime, room: $room, mode: $mode, qrValidityMinutes: $qrValidityMinutes, gracePeriodMinutes: $gracePeriodMinutes, geofence: $geofence, isActive: $isActive, endedAt: $endedAt, qrToken: $qrToken, qrTokenExpiresAt: $qrTokenExpiresAt, qrGeneratedAt: $qrGeneratedAt, startQrValiditySeconds: $startQrValiditySeconds, startGraceMinutes: $startGraceMinutes, endQrValiditySeconds: $endQrValiditySeconds, endGraceMinutes: $endGraceMinutes, startQrToken: $startQrToken, startTokenExpiresAt: $startTokenExpiresAt, startQrGeneratedAt: $startQrGeneratedAt, endQrToken: $endQrToken, endTokenExpiresAt: $endTokenExpiresAt, endQrGeneratedAt: $endQrGeneratedAt, pinRequired: $pinRequired, autoEndAt: $autoEndAt, teacherId: $teacherId, teacherPublicKey: $teacherPublicKey, createdAt: $createdAt, isRescheduled: $isRescheduled, rescheduledFromDate: $rescheduledFromDate, originalScheduleTime: $originalScheduleTime, originalRoom: $originalRoom)';
}


}

/// @nodoc
abstract mixin class $SessionCopyWith<$Res>  {
  factory $SessionCopyWith(Session value, $Res Function(Session) _then) = _$SessionCopyWithImpl;
@useResult
$Res call({
 String id, String sectionId, String subjectName, String date, String startTime, String endTime, String? room, SessionMode mode, int qrValidityMinutes, int gracePeriodMinutes, GeofenceConfig? geofence, bool isActive, String? endedAt, String? qrToken, String? qrTokenExpiresAt, String? qrGeneratedAt, int? startQrValiditySeconds, int? startGraceMinutes, int? endQrValiditySeconds, int? endGraceMinutes, String? startQrToken, String? startTokenExpiresAt, String? startQrGeneratedAt, String? endQrToken, String? endTokenExpiresAt, String? endQrGeneratedAt, bool pinRequired, String? autoEndAt, String teacherId, String? teacherPublicKey, String createdAt, bool isRescheduled, String? rescheduledFromDate, String? originalScheduleTime, String? originalRoom
});


$GeofenceConfigCopyWith<$Res>? get geofence;

}
/// @nodoc
class _$SessionCopyWithImpl<$Res>
    implements $SessionCopyWith<$Res> {
  _$SessionCopyWithImpl(this._self, this._then);

  final Session _self;
  final $Res Function(Session) _then;

/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? sectionId = null,Object? subjectName = null,Object? date = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,Object? mode = null,Object? qrValidityMinutes = null,Object? gracePeriodMinutes = null,Object? geofence = freezed,Object? isActive = null,Object? endedAt = freezed,Object? qrToken = freezed,Object? qrTokenExpiresAt = freezed,Object? qrGeneratedAt = freezed,Object? startQrValiditySeconds = freezed,Object? startGraceMinutes = freezed,Object? endQrValiditySeconds = freezed,Object? endGraceMinutes = freezed,Object? startQrToken = freezed,Object? startTokenExpiresAt = freezed,Object? startQrGeneratedAt = freezed,Object? endQrToken = freezed,Object? endTokenExpiresAt = freezed,Object? endQrGeneratedAt = freezed,Object? pinRequired = null,Object? autoEndAt = freezed,Object? teacherId = null,Object? teacherPublicKey = freezed,Object? createdAt = null,Object? isRescheduled = null,Object? rescheduledFromDate = freezed,Object? originalScheduleTime = freezed,Object? originalRoom = freezed,}) {
  return _then(Session(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode,qrValidityMinutes: null == qrValidityMinutes ? _self.qrValidityMinutes : qrValidityMinutes // ignore: cast_nullable_to_non_nullable
as int,gracePeriodMinutes: null == gracePeriodMinutes ? _self.gracePeriodMinutes : gracePeriodMinutes // ignore: cast_nullable_to_non_nullable
as int,geofence: freezed == geofence ? _self.geofence : geofence // ignore: cast_nullable_to_non_nullable
as GeofenceConfig?,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,endedAt: freezed == endedAt ? _self.endedAt : endedAt // ignore: cast_nullable_to_non_nullable
as String?,qrToken: freezed == qrToken ? _self.qrToken : qrToken // ignore: cast_nullable_to_non_nullable
as String?,qrTokenExpiresAt: freezed == qrTokenExpiresAt ? _self.qrTokenExpiresAt : qrTokenExpiresAt // ignore: cast_nullable_to_non_nullable
as String?,qrGeneratedAt: freezed == qrGeneratedAt ? _self.qrGeneratedAt : qrGeneratedAt // ignore: cast_nullable_to_non_nullable
as String?,startQrValiditySeconds: freezed == startQrValiditySeconds ? _self.startQrValiditySeconds : startQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,startGraceMinutes: freezed == startGraceMinutes ? _self.startGraceMinutes : startGraceMinutes // ignore: cast_nullable_to_non_nullable
as int?,endQrValiditySeconds: freezed == endQrValiditySeconds ? _self.endQrValiditySeconds : endQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,endGraceMinutes: freezed == endGraceMinutes ? _self.endGraceMinutes : endGraceMinutes // ignore: cast_nullable_to_non_nullable
as int?,startQrToken: freezed == startQrToken ? _self.startQrToken : startQrToken // ignore: cast_nullable_to_non_nullable
as String?,startTokenExpiresAt: freezed == startTokenExpiresAt ? _self.startTokenExpiresAt : startTokenExpiresAt // ignore: cast_nullable_to_non_nullable
as String?,startQrGeneratedAt: freezed == startQrGeneratedAt ? _self.startQrGeneratedAt : startQrGeneratedAt // ignore: cast_nullable_to_non_nullable
as String?,endQrToken: freezed == endQrToken ? _self.endQrToken : endQrToken // ignore: cast_nullable_to_non_nullable
as String?,endTokenExpiresAt: freezed == endTokenExpiresAt ? _self.endTokenExpiresAt : endTokenExpiresAt // ignore: cast_nullable_to_non_nullable
as String?,endQrGeneratedAt: freezed == endQrGeneratedAt ? _self.endQrGeneratedAt : endQrGeneratedAt // ignore: cast_nullable_to_non_nullable
as String?,pinRequired: null == pinRequired ? _self.pinRequired : pinRequired // ignore: cast_nullable_to_non_nullable
as bool,autoEndAt: freezed == autoEndAt ? _self.autoEndAt : autoEndAt // ignore: cast_nullable_to_non_nullable
as String?,teacherId: null == teacherId ? _self.teacherId : teacherId // ignore: cast_nullable_to_non_nullable
as String,teacherPublicKey: freezed == teacherPublicKey ? _self.teacherPublicKey : teacherPublicKey // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,isRescheduled: null == isRescheduled ? _self.isRescheduled : isRescheduled // ignore: cast_nullable_to_non_nullable
as bool,rescheduledFromDate: freezed == rescheduledFromDate ? _self.rescheduledFromDate : rescheduledFromDate // ignore: cast_nullable_to_non_nullable
as String?,originalScheduleTime: freezed == originalScheduleTime ? _self.originalScheduleTime : originalScheduleTime // ignore: cast_nullable_to_non_nullable
as String?,originalRoom: freezed == originalRoom ? _self.originalRoom : originalRoom // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GeofenceConfigCopyWith<$Res>? get geofence {
    if (_self.geofence == null) {
    return null;
  }

  return $GeofenceConfigCopyWith<$Res>(_self.geofence!, (value) {
    return _then(_self.copyWith(geofence: value));
  });
}
}


/// Adds pattern-matching-related methods to [Session].
extension SessionPatterns on Session {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Session value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Session() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Session value)  $default,){
final _that = this;
switch (_that) {
case _Session():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Session value)?  $default,){
final _that = this;
switch (_that) {
case _Session() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String sectionId,  String subjectName,  String date,  String startTime,  String endTime,  String? room,  SessionMode mode,  int qrValidityMinutes,  int gracePeriodMinutes,  GeofenceConfig? geofence,  bool isActive,  String? endedAt,  String? qrToken,  String? qrTokenExpiresAt,  String? qrGeneratedAt,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  int? endGraceMinutes,  String? startQrToken,  String? startTokenExpiresAt,  String? startQrGeneratedAt,  String? endQrToken,  String? endTokenExpiresAt,  String? endQrGeneratedAt,  bool pinRequired,  String? autoEndAt,  String teacherId,  String? teacherPublicKey,  String createdAt,  bool isRescheduled,  String? rescheduledFromDate,  String? originalScheduleTime,  String? originalRoom)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Session() when $default != null:
return $default(_that.id,_that.sectionId,_that.subjectName,_that.date,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.geofence,_that.isActive,_that.endedAt,_that.qrToken,_that.qrTokenExpiresAt,_that.qrGeneratedAt,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.endGraceMinutes,_that.startQrToken,_that.startTokenExpiresAt,_that.startQrGeneratedAt,_that.endQrToken,_that.endTokenExpiresAt,_that.endQrGeneratedAt,_that.pinRequired,_that.autoEndAt,_that.teacherId,_that.teacherPublicKey,_that.createdAt,_that.isRescheduled,_that.rescheduledFromDate,_that.originalScheduleTime,_that.originalRoom);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String sectionId,  String subjectName,  String date,  String startTime,  String endTime,  String? room,  SessionMode mode,  int qrValidityMinutes,  int gracePeriodMinutes,  GeofenceConfig? geofence,  bool isActive,  String? endedAt,  String? qrToken,  String? qrTokenExpiresAt,  String? qrGeneratedAt,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  int? endGraceMinutes,  String? startQrToken,  String? startTokenExpiresAt,  String? startQrGeneratedAt,  String? endQrToken,  String? endTokenExpiresAt,  String? endQrGeneratedAt,  bool pinRequired,  String? autoEndAt,  String teacherId,  String? teacherPublicKey,  String createdAt,  bool isRescheduled,  String? rescheduledFromDate,  String? originalScheduleTime,  String? originalRoom)  $default,) {final _that = this;
switch (_that) {
case _Session():
return $default(_that.id,_that.sectionId,_that.subjectName,_that.date,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.geofence,_that.isActive,_that.endedAt,_that.qrToken,_that.qrTokenExpiresAt,_that.qrGeneratedAt,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.endGraceMinutes,_that.startQrToken,_that.startTokenExpiresAt,_that.startQrGeneratedAt,_that.endQrToken,_that.endTokenExpiresAt,_that.endQrGeneratedAt,_that.pinRequired,_that.autoEndAt,_that.teacherId,_that.teacherPublicKey,_that.createdAt,_that.isRescheduled,_that.rescheduledFromDate,_that.originalScheduleTime,_that.originalRoom);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String sectionId,  String subjectName,  String date,  String startTime,  String endTime,  String? room,  SessionMode mode,  int qrValidityMinutes,  int gracePeriodMinutes,  GeofenceConfig? geofence,  bool isActive,  String? endedAt,  String? qrToken,  String? qrTokenExpiresAt,  String? qrGeneratedAt,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  int? endGraceMinutes,  String? startQrToken,  String? startTokenExpiresAt,  String? startQrGeneratedAt,  String? endQrToken,  String? endTokenExpiresAt,  String? endQrGeneratedAt,  bool pinRequired,  String? autoEndAt,  String teacherId,  String? teacherPublicKey,  String createdAt,  bool isRescheduled,  String? rescheduledFromDate,  String? originalScheduleTime,  String? originalRoom)?  $default,) {final _that = this;
switch (_that) {
case _Session() when $default != null:
return $default(_that.id,_that.sectionId,_that.subjectName,_that.date,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.geofence,_that.isActive,_that.endedAt,_that.qrToken,_that.qrTokenExpiresAt,_that.qrGeneratedAt,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.endGraceMinutes,_that.startQrToken,_that.startTokenExpiresAt,_that.startQrGeneratedAt,_that.endQrToken,_that.endTokenExpiresAt,_that.endQrGeneratedAt,_that.pinRequired,_that.autoEndAt,_that.teacherId,_that.teacherPublicKey,_that.createdAt,_that.isRescheduled,_that.rescheduledFromDate,_that.originalScheduleTime,_that.originalRoom);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [SessionModeConverter()])
class _Session implements Session {
  const _Session({required this.id, required this.sectionId, this.subjectName = '', required this.date, this.startTime = '', this.endTime = '', this.room, this.mode = SessionMode.inPerson, this.qrValidityMinutes = 15, this.gracePeriodMinutes = 15, this.geofence, this.isActive = false, this.endedAt, this.qrToken, this.qrTokenExpiresAt, this.qrGeneratedAt, this.startQrValiditySeconds, this.startGraceMinutes, this.endQrValiditySeconds, this.endGraceMinutes, this.startQrToken, this.startTokenExpiresAt, this.startQrGeneratedAt, this.endQrToken, this.endTokenExpiresAt, this.endQrGeneratedAt, this.pinRequired = false, this.autoEndAt, required this.teacherId, this.teacherPublicKey, this.createdAt = '', this.isRescheduled = false, this.rescheduledFromDate, this.originalScheduleTime, this.originalRoom});
  factory _Session.fromJson(Map<String, dynamic> json) => _$SessionFromJson(json);

@override final  String id;
@override final  String sectionId;
@override@JsonKey() final  String subjectName;
@override final  String date;
@override@JsonKey() final  String startTime;
@override@JsonKey() final  String endTime;
@override final  String? room;
@override@JsonKey() final  SessionMode mode;
@override@JsonKey() final  int qrValidityMinutes;
@override@JsonKey() final  int gracePeriodMinutes;
@override final  GeofenceConfig? geofence;
@override@JsonKey() final  bool isActive;
@override final  String? endedAt;
@override final  String? qrToken;
@override final  String? qrTokenExpiresAt;
@override final  String? qrGeneratedAt;
@override final  int? startQrValiditySeconds;
@override final  int? startGraceMinutes;
@override final  int? endQrValiditySeconds;
@override final  int? endGraceMinutes;
@override final  String? startQrToken;
@override final  String? startTokenExpiresAt;
@override final  String? startQrGeneratedAt;
@override final  String? endQrToken;
@override final  String? endTokenExpiresAt;
@override final  String? endQrGeneratedAt;
@override@JsonKey() final  bool pinRequired;
@override final  String? autoEndAt;
@override final  String teacherId;
@override final  String? teacherPublicKey;
@override@JsonKey() final  String createdAt;
@override@JsonKey() final  bool isRescheduled;
@override final  String? rescheduledFromDate;
@override final  String? originalScheduleTime;
@override final  String? originalRoom;

/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionCopyWith<_Session> get copyWith => __$SessionCopyWithImpl<_Session>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _Session&&(identical(other.id, id) || other.id == id)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.date, date) || other.date == date)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.qrValidityMinutes, qrValidityMinutes) || other.qrValidityMinutes == qrValidityMinutes)&&(identical(other.gracePeriodMinutes, gracePeriodMinutes) || other.gracePeriodMinutes == gracePeriodMinutes)&&(identical(other.geofence, geofence) || other.geofence == geofence)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.endedAt, endedAt) || other.endedAt == endedAt)&&(identical(other.qrToken, qrToken) || other.qrToken == qrToken)&&(identical(other.qrTokenExpiresAt, qrTokenExpiresAt) || other.qrTokenExpiresAt == qrTokenExpiresAt)&&(identical(other.qrGeneratedAt, qrGeneratedAt) || other.qrGeneratedAt == qrGeneratedAt)&&(identical(other.startQrValiditySeconds, startQrValiditySeconds) || other.startQrValiditySeconds == startQrValiditySeconds)&&(identical(other.startGraceMinutes, startGraceMinutes) || other.startGraceMinutes == startGraceMinutes)&&(identical(other.endQrValiditySeconds, endQrValiditySeconds) || other.endQrValiditySeconds == endQrValiditySeconds)&&(identical(other.endGraceMinutes, endGraceMinutes) || other.endGraceMinutes == endGraceMinutes)&&(identical(other.startQrToken, startQrToken) || other.startQrToken == startQrToken)&&(identical(other.startTokenExpiresAt, startTokenExpiresAt) || other.startTokenExpiresAt == startTokenExpiresAt)&&(identical(other.startQrGeneratedAt, startQrGeneratedAt) || other.startQrGeneratedAt == startQrGeneratedAt)&&(identical(other.endQrToken, endQrToken) || other.endQrToken == endQrToken)&&(identical(other.endTokenExpiresAt, endTokenExpiresAt) || other.endTokenExpiresAt == endTokenExpiresAt)&&(identical(other.endQrGeneratedAt, endQrGeneratedAt) || other.endQrGeneratedAt == endQrGeneratedAt)&&(identical(other.pinRequired, pinRequired) || other.pinRequired == pinRequired)&&(identical(other.autoEndAt, autoEndAt) || other.autoEndAt == autoEndAt)&&(identical(other.teacherId, teacherId) || other.teacherId == teacherId)&&(identical(other.teacherPublicKey, teacherPublicKey) || other.teacherPublicKey == teacherPublicKey)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.isRescheduled, isRescheduled) || other.isRescheduled == isRescheduled)&&(identical(other.rescheduledFromDate, rescheduledFromDate) || other.rescheduledFromDate == rescheduledFromDate)&&(identical(other.originalScheduleTime, originalScheduleTime) || other.originalScheduleTime == originalScheduleTime)&&(identical(other.originalRoom, originalRoom) || other.originalRoom == originalRoom));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,sectionId,subjectName,date,startTime,endTime,room,mode,qrValidityMinutes,gracePeriodMinutes,geofence,isActive,endedAt,qrToken,qrTokenExpiresAt,qrGeneratedAt,startQrValiditySeconds,startGraceMinutes,endQrValiditySeconds,endGraceMinutes,startQrToken,startTokenExpiresAt,startQrGeneratedAt,endQrToken,endTokenExpiresAt,endQrGeneratedAt,pinRequired,autoEndAt,teacherId,teacherPublicKey,createdAt,isRescheduled,rescheduledFromDate,originalScheduleTime,originalRoom]);

@override
String toString() {
  return 'Session(id: $id, sectionId: $sectionId, subjectName: $subjectName, date: $date, startTime: $startTime, endTime: $endTime, room: $room, mode: $mode, qrValidityMinutes: $qrValidityMinutes, gracePeriodMinutes: $gracePeriodMinutes, geofence: $geofence, isActive: $isActive, endedAt: $endedAt, qrToken: $qrToken, qrTokenExpiresAt: $qrTokenExpiresAt, qrGeneratedAt: $qrGeneratedAt, startQrValiditySeconds: $startQrValiditySeconds, startGraceMinutes: $startGraceMinutes, endQrValiditySeconds: $endQrValiditySeconds, endGraceMinutes: $endGraceMinutes, startQrToken: $startQrToken, startTokenExpiresAt: $startTokenExpiresAt, startQrGeneratedAt: $startQrGeneratedAt, endQrToken: $endQrToken, endTokenExpiresAt: $endTokenExpiresAt, endQrGeneratedAt: $endQrGeneratedAt, pinRequired: $pinRequired, autoEndAt: $autoEndAt, teacherId: $teacherId, teacherPublicKey: $teacherPublicKey, createdAt: $createdAt, isRescheduled: $isRescheduled, rescheduledFromDate: $rescheduledFromDate, originalScheduleTime: $originalScheduleTime, originalRoom: $originalRoom)';
}


}

/// @nodoc
abstract mixin class _$SessionCopyWith<$Res> implements $SessionCopyWith<$Res> {
  factory _$SessionCopyWith(_Session value, $Res Function(_Session) _then) = __$SessionCopyWithImpl;
@override @useResult
$Res call({
 String id, String sectionId, String subjectName, String date, String startTime, String endTime, String? room, SessionMode mode, int qrValidityMinutes, int gracePeriodMinutes, GeofenceConfig? geofence, bool isActive, String? endedAt, String? qrToken, String? qrTokenExpiresAt, String? qrGeneratedAt, int? startQrValiditySeconds, int? startGraceMinutes, int? endQrValiditySeconds, int? endGraceMinutes, String? startQrToken, String? startTokenExpiresAt, String? startQrGeneratedAt, String? endQrToken, String? endTokenExpiresAt, String? endQrGeneratedAt, bool pinRequired, String? autoEndAt, String teacherId, String? teacherPublicKey, String createdAt, bool isRescheduled, String? rescheduledFromDate, String? originalScheduleTime, String? originalRoom
});


@override $GeofenceConfigCopyWith<$Res>? get geofence;

}
/// @nodoc
class __$SessionCopyWithImpl<$Res>
    implements _$SessionCopyWith<$Res> {
  __$SessionCopyWithImpl(this._self, this._then);

  final _Session _self;
  final $Res Function(_Session) _then;

/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? sectionId = null,Object? subjectName = null,Object? date = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,Object? mode = null,Object? qrValidityMinutes = null,Object? gracePeriodMinutes = null,Object? geofence = freezed,Object? isActive = null,Object? endedAt = freezed,Object? qrToken = freezed,Object? qrTokenExpiresAt = freezed,Object? qrGeneratedAt = freezed,Object? startQrValiditySeconds = freezed,Object? startGraceMinutes = freezed,Object? endQrValiditySeconds = freezed,Object? endGraceMinutes = freezed,Object? startQrToken = freezed,Object? startTokenExpiresAt = freezed,Object? startQrGeneratedAt = freezed,Object? endQrToken = freezed,Object? endTokenExpiresAt = freezed,Object? endQrGeneratedAt = freezed,Object? pinRequired = null,Object? autoEndAt = freezed,Object? teacherId = null,Object? teacherPublicKey = freezed,Object? createdAt = null,Object? isRescheduled = null,Object? rescheduledFromDate = freezed,Object? originalScheduleTime = freezed,Object? originalRoom = freezed,}) {
  return _then(_Session(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode,qrValidityMinutes: null == qrValidityMinutes ? _self.qrValidityMinutes : qrValidityMinutes // ignore: cast_nullable_to_non_nullable
as int,gracePeriodMinutes: null == gracePeriodMinutes ? _self.gracePeriodMinutes : gracePeriodMinutes // ignore: cast_nullable_to_non_nullable
as int,geofence: freezed == geofence ? _self.geofence : geofence // ignore: cast_nullable_to_non_nullable
as GeofenceConfig?,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,endedAt: freezed == endedAt ? _self.endedAt : endedAt // ignore: cast_nullable_to_non_nullable
as String?,qrToken: freezed == qrToken ? _self.qrToken : qrToken // ignore: cast_nullable_to_non_nullable
as String?,qrTokenExpiresAt: freezed == qrTokenExpiresAt ? _self.qrTokenExpiresAt : qrTokenExpiresAt // ignore: cast_nullable_to_non_nullable
as String?,qrGeneratedAt: freezed == qrGeneratedAt ? _self.qrGeneratedAt : qrGeneratedAt // ignore: cast_nullable_to_non_nullable
as String?,startQrValiditySeconds: freezed == startQrValiditySeconds ? _self.startQrValiditySeconds : startQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,startGraceMinutes: freezed == startGraceMinutes ? _self.startGraceMinutes : startGraceMinutes // ignore: cast_nullable_to_non_nullable
as int?,endQrValiditySeconds: freezed == endQrValiditySeconds ? _self.endQrValiditySeconds : endQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,endGraceMinutes: freezed == endGraceMinutes ? _self.endGraceMinutes : endGraceMinutes // ignore: cast_nullable_to_non_nullable
as int?,startQrToken: freezed == startQrToken ? _self.startQrToken : startQrToken // ignore: cast_nullable_to_non_nullable
as String?,startTokenExpiresAt: freezed == startTokenExpiresAt ? _self.startTokenExpiresAt : startTokenExpiresAt // ignore: cast_nullable_to_non_nullable
as String?,startQrGeneratedAt: freezed == startQrGeneratedAt ? _self.startQrGeneratedAt : startQrGeneratedAt // ignore: cast_nullable_to_non_nullable
as String?,endQrToken: freezed == endQrToken ? _self.endQrToken : endQrToken // ignore: cast_nullable_to_non_nullable
as String?,endTokenExpiresAt: freezed == endTokenExpiresAt ? _self.endTokenExpiresAt : endTokenExpiresAt // ignore: cast_nullable_to_non_nullable
as String?,endQrGeneratedAt: freezed == endQrGeneratedAt ? _self.endQrGeneratedAt : endQrGeneratedAt // ignore: cast_nullable_to_non_nullable
as String?,pinRequired: null == pinRequired ? _self.pinRequired : pinRequired // ignore: cast_nullable_to_non_nullable
as bool,autoEndAt: freezed == autoEndAt ? _self.autoEndAt : autoEndAt // ignore: cast_nullable_to_non_nullable
as String?,teacherId: null == teacherId ? _self.teacherId : teacherId // ignore: cast_nullable_to_non_nullable
as String,teacherPublicKey: freezed == teacherPublicKey ? _self.teacherPublicKey : teacherPublicKey // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,isRescheduled: null == isRescheduled ? _self.isRescheduled : isRescheduled // ignore: cast_nullable_to_non_nullable
as bool,rescheduledFromDate: freezed == rescheduledFromDate ? _self.rescheduledFromDate : rescheduledFromDate // ignore: cast_nullable_to_non_nullable
as String?,originalScheduleTime: freezed == originalScheduleTime ? _self.originalScheduleTime : originalScheduleTime // ignore: cast_nullable_to_non_nullable
as String?,originalRoom: freezed == originalRoom ? _self.originalRoom : originalRoom // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of Session
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GeofenceConfigCopyWith<$Res>? get geofence {
    if (_self.geofence == null) {
    return null;
  }

  return $GeofenceConfigCopyWith<$Res>(_self.geofence!, (value) {
    return _then(_self.copyWith(geofence: value));
  });
}
}


/// @nodoc
mixin _$QRTokenPayload {

 int get version; String get sessionId; String get sectionId; int get issuedAt; int get validityMinutes; int get gracePeriodMinutes; String get teacherId; String get teacherName; SessionMode get mode; CheckpointType? get checkpoint; bool get pinRequired; String? get pinHash; int? get validitySeconds;
/// Create a copy of QRTokenPayload
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$QRTokenPayloadCopyWith<QRTokenPayload> get copyWith => _$QRTokenPayloadCopyWithImpl<QRTokenPayload>(this as QRTokenPayload, _$identity);

  /// Serializes this QRTokenPayload to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is QRTokenPayload&&(identical(other.version, version) || other.version == version)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.issuedAt, issuedAt) || other.issuedAt == issuedAt)&&(identical(other.validityMinutes, validityMinutes) || other.validityMinutes == validityMinutes)&&(identical(other.gracePeriodMinutes, gracePeriodMinutes) || other.gracePeriodMinutes == gracePeriodMinutes)&&(identical(other.teacherId, teacherId) || other.teacherId == teacherId)&&(identical(other.teacherName, teacherName) || other.teacherName == teacherName)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.checkpoint, checkpoint) || other.checkpoint == checkpoint)&&(identical(other.pinRequired, pinRequired) || other.pinRequired == pinRequired)&&(identical(other.pinHash, pinHash) || other.pinHash == pinHash)&&(identical(other.validitySeconds, validitySeconds) || other.validitySeconds == validitySeconds));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,version,sessionId,sectionId,issuedAt,validityMinutes,gracePeriodMinutes,teacherId,teacherName,mode,checkpoint,pinRequired,pinHash,validitySeconds);

@override
String toString() {
  return 'QRTokenPayload(version: $version, sessionId: $sessionId, sectionId: $sectionId, issuedAt: $issuedAt, validityMinutes: $validityMinutes, gracePeriodMinutes: $gracePeriodMinutes, teacherId: $teacherId, teacherName: $teacherName, mode: $mode, checkpoint: $checkpoint, pinRequired: $pinRequired, pinHash: $pinHash, validitySeconds: $validitySeconds)';
}


}

/// @nodoc
abstract mixin class $QRTokenPayloadCopyWith<$Res>  {
  factory $QRTokenPayloadCopyWith(QRTokenPayload value, $Res Function(QRTokenPayload) _then) = _$QRTokenPayloadCopyWithImpl;
@useResult
$Res call({
 int version, String sessionId, String sectionId, int issuedAt, int validityMinutes, int gracePeriodMinutes, String teacherId, String teacherName, SessionMode mode, CheckpointType? checkpoint, bool pinRequired, String? pinHash, int? validitySeconds
});




}
/// @nodoc
class _$QRTokenPayloadCopyWithImpl<$Res>
    implements $QRTokenPayloadCopyWith<$Res> {
  _$QRTokenPayloadCopyWithImpl(this._self, this._then);

  final QRTokenPayload _self;
  final $Res Function(QRTokenPayload) _then;

/// Create a copy of QRTokenPayload
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? version = null,Object? sessionId = null,Object? sectionId = null,Object? issuedAt = null,Object? validityMinutes = null,Object? gracePeriodMinutes = null,Object? teacherId = null,Object? teacherName = null,Object? mode = null,Object? checkpoint = freezed,Object? pinRequired = null,Object? pinHash = freezed,Object? validitySeconds = freezed,}) {
  return _then(QRTokenPayload(
version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as int,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,issuedAt: null == issuedAt ? _self.issuedAt : issuedAt // ignore: cast_nullable_to_non_nullable
as int,validityMinutes: null == validityMinutes ? _self.validityMinutes : validityMinutes // ignore: cast_nullable_to_non_nullable
as int,gracePeriodMinutes: null == gracePeriodMinutes ? _self.gracePeriodMinutes : gracePeriodMinutes // ignore: cast_nullable_to_non_nullable
as int,teacherId: null == teacherId ? _self.teacherId : teacherId // ignore: cast_nullable_to_non_nullable
as String,teacherName: null == teacherName ? _self.teacherName : teacherName // ignore: cast_nullable_to_non_nullable
as String,mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode,checkpoint: freezed == checkpoint ? _self.checkpoint : checkpoint // ignore: cast_nullable_to_non_nullable
as CheckpointType?,pinRequired: null == pinRequired ? _self.pinRequired : pinRequired // ignore: cast_nullable_to_non_nullable
as bool,pinHash: freezed == pinHash ? _self.pinHash : pinHash // ignore: cast_nullable_to_non_nullable
as String?,validitySeconds: freezed == validitySeconds ? _self.validitySeconds : validitySeconds // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [QRTokenPayload].
extension QRTokenPayloadPatterns on QRTokenPayload {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _QRTokenPayload value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _QRTokenPayload() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _QRTokenPayload value)  $default,){
final _that = this;
switch (_that) {
case _QRTokenPayload():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _QRTokenPayload value)?  $default,){
final _that = this;
switch (_that) {
case _QRTokenPayload() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int version,  String sessionId,  String sectionId,  int issuedAt,  int validityMinutes,  int gracePeriodMinutes,  String teacherId,  String teacherName,  SessionMode mode,  CheckpointType? checkpoint,  bool pinRequired,  String? pinHash,  int? validitySeconds)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _QRTokenPayload() when $default != null:
return $default(_that.version,_that.sessionId,_that.sectionId,_that.issuedAt,_that.validityMinutes,_that.gracePeriodMinutes,_that.teacherId,_that.teacherName,_that.mode,_that.checkpoint,_that.pinRequired,_that.pinHash,_that.validitySeconds);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int version,  String sessionId,  String sectionId,  int issuedAt,  int validityMinutes,  int gracePeriodMinutes,  String teacherId,  String teacherName,  SessionMode mode,  CheckpointType? checkpoint,  bool pinRequired,  String? pinHash,  int? validitySeconds)  $default,) {final _that = this;
switch (_that) {
case _QRTokenPayload():
return $default(_that.version,_that.sessionId,_that.sectionId,_that.issuedAt,_that.validityMinutes,_that.gracePeriodMinutes,_that.teacherId,_that.teacherName,_that.mode,_that.checkpoint,_that.pinRequired,_that.pinHash,_that.validitySeconds);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int version,  String sessionId,  String sectionId,  int issuedAt,  int validityMinutes,  int gracePeriodMinutes,  String teacherId,  String teacherName,  SessionMode mode,  CheckpointType? checkpoint,  bool pinRequired,  String? pinHash,  int? validitySeconds)?  $default,) {final _that = this;
switch (_that) {
case _QRTokenPayload() when $default != null:
return $default(_that.version,_that.sessionId,_that.sectionId,_that.issuedAt,_that.validityMinutes,_that.gracePeriodMinutes,_that.teacherId,_that.teacherName,_that.mode,_that.checkpoint,_that.pinRequired,_that.pinHash,_that.validitySeconds);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [SessionModeConverter(), CheckpointTypeConverter()])
class _QRTokenPayload implements QRTokenPayload {
  const _QRTokenPayload({required this.version, required this.sessionId, required this.sectionId, required this.issuedAt, required this.validityMinutes, required this.gracePeriodMinutes, required this.teacherId, required this.teacherName, this.mode = SessionMode.inPerson, this.checkpoint, this.pinRequired = false, this.pinHash, this.validitySeconds});
  factory _QRTokenPayload.fromJson(Map<String, dynamic> json) => _$QRTokenPayloadFromJson(json);

@override final  int version;
@override final  String sessionId;
@override final  String sectionId;
@override final  int issuedAt;
@override final  int validityMinutes;
@override final  int gracePeriodMinutes;
@override final  String teacherId;
@override final  String teacherName;
@override@JsonKey() final  SessionMode mode;
@override final  CheckpointType? checkpoint;
@override@JsonKey() final  bool pinRequired;
@override final  String? pinHash;
@override final  int? validitySeconds;

/// Create a copy of QRTokenPayload
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$QRTokenPayloadCopyWith<_QRTokenPayload> get copyWith => __$QRTokenPayloadCopyWithImpl<_QRTokenPayload>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$QRTokenPayloadToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _QRTokenPayload&&(identical(other.version, version) || other.version == version)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.issuedAt, issuedAt) || other.issuedAt == issuedAt)&&(identical(other.validityMinutes, validityMinutes) || other.validityMinutes == validityMinutes)&&(identical(other.gracePeriodMinutes, gracePeriodMinutes) || other.gracePeriodMinutes == gracePeriodMinutes)&&(identical(other.teacherId, teacherId) || other.teacherId == teacherId)&&(identical(other.teacherName, teacherName) || other.teacherName == teacherName)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.checkpoint, checkpoint) || other.checkpoint == checkpoint)&&(identical(other.pinRequired, pinRequired) || other.pinRequired == pinRequired)&&(identical(other.pinHash, pinHash) || other.pinHash == pinHash)&&(identical(other.validitySeconds, validitySeconds) || other.validitySeconds == validitySeconds));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,version,sessionId,sectionId,issuedAt,validityMinutes,gracePeriodMinutes,teacherId,teacherName,mode,checkpoint,pinRequired,pinHash,validitySeconds);

@override
String toString() {
  return 'QRTokenPayload(version: $version, sessionId: $sessionId, sectionId: $sectionId, issuedAt: $issuedAt, validityMinutes: $validityMinutes, gracePeriodMinutes: $gracePeriodMinutes, teacherId: $teacherId, teacherName: $teacherName, mode: $mode, checkpoint: $checkpoint, pinRequired: $pinRequired, pinHash: $pinHash, validitySeconds: $validitySeconds)';
}


}

/// @nodoc
abstract mixin class _$QRTokenPayloadCopyWith<$Res> implements $QRTokenPayloadCopyWith<$Res> {
  factory _$QRTokenPayloadCopyWith(_QRTokenPayload value, $Res Function(_QRTokenPayload) _then) = __$QRTokenPayloadCopyWithImpl;
@override @useResult
$Res call({
 int version, String sessionId, String sectionId, int issuedAt, int validityMinutes, int gracePeriodMinutes, String teacherId, String teacherName, SessionMode mode, CheckpointType? checkpoint, bool pinRequired, String? pinHash, int? validitySeconds
});




}
/// @nodoc
class __$QRTokenPayloadCopyWithImpl<$Res>
    implements _$QRTokenPayloadCopyWith<$Res> {
  __$QRTokenPayloadCopyWithImpl(this._self, this._then);

  final _QRTokenPayload _self;
  final $Res Function(_QRTokenPayload) _then;

/// Create a copy of QRTokenPayload
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? version = null,Object? sessionId = null,Object? sectionId = null,Object? issuedAt = null,Object? validityMinutes = null,Object? gracePeriodMinutes = null,Object? teacherId = null,Object? teacherName = null,Object? mode = null,Object? checkpoint = freezed,Object? pinRequired = null,Object? pinHash = freezed,Object? validitySeconds = freezed,}) {
  return _then(_QRTokenPayload(
version: null == version ? _self.version : version // ignore: cast_nullable_to_non_nullable
as int,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,issuedAt: null == issuedAt ? _self.issuedAt : issuedAt // ignore: cast_nullable_to_non_nullable
as int,validityMinutes: null == validityMinutes ? _self.validityMinutes : validityMinutes // ignore: cast_nullable_to_non_nullable
as int,gracePeriodMinutes: null == gracePeriodMinutes ? _self.gracePeriodMinutes : gracePeriodMinutes // ignore: cast_nullable_to_non_nullable
as int,teacherId: null == teacherId ? _self.teacherId : teacherId // ignore: cast_nullable_to_non_nullable
as String,teacherName: null == teacherName ? _self.teacherName : teacherName // ignore: cast_nullable_to_non_nullable
as String,mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode,checkpoint: freezed == checkpoint ? _self.checkpoint : checkpoint // ignore: cast_nullable_to_non_nullable
as CheckpointType?,pinRequired: null == pinRequired ? _self.pinRequired : pinRequired // ignore: cast_nullable_to_non_nullable
as bool,pinHash: freezed == pinHash ? _self.pinHash : pinHash // ignore: cast_nullable_to_non_nullable
as String?,validitySeconds: freezed == validitySeconds ? _self.validitySeconds : validitySeconds // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$SessionFinaleSummary {

 String get sessionId; String get endedAt;@JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson) Map<FinaleCountStatus, int> get counts; int get capacity;
/// Create a copy of SessionFinaleSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionFinaleSummaryCopyWith<SessionFinaleSummary> get copyWith => _$SessionFinaleSummaryCopyWithImpl<SessionFinaleSummary>(this as SessionFinaleSummary, _$identity);

  /// Serializes this SessionFinaleSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionFinaleSummary&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.endedAt, endedAt) || other.endedAt == endedAt)&&const DeepCollectionEquality().equals(other.counts, counts)&&(identical(other.capacity, capacity) || other.capacity == capacity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sessionId,endedAt,const DeepCollectionEquality().hash(counts),capacity);

@override
String toString() {
  return 'SessionFinaleSummary(sessionId: $sessionId, endedAt: $endedAt, counts: $counts, capacity: $capacity)';
}


}

/// @nodoc
abstract mixin class $SessionFinaleSummaryCopyWith<$Res>  {
  factory $SessionFinaleSummaryCopyWith(SessionFinaleSummary value, $Res Function(SessionFinaleSummary) _then) = _$SessionFinaleSummaryCopyWithImpl;
@useResult
$Res call({
 String sessionId, String endedAt,@JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson) Map<FinaleCountStatus, int> counts, int capacity
});




}
/// @nodoc
class _$SessionFinaleSummaryCopyWithImpl<$Res>
    implements $SessionFinaleSummaryCopyWith<$Res> {
  _$SessionFinaleSummaryCopyWithImpl(this._self, this._then);

  final SessionFinaleSummary _self;
  final $Res Function(SessionFinaleSummary) _then;

/// Create a copy of SessionFinaleSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sessionId = null,Object? endedAt = null,Object? counts = null,Object? capacity = null,}) {
  return _then(SessionFinaleSummary(
sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,endedAt: null == endedAt ? _self.endedAt : endedAt // ignore: cast_nullable_to_non_nullable
as String,counts: null == counts ? _self.counts : counts // ignore: cast_nullable_to_non_nullable
as Map<FinaleCountStatus, int>,capacity: null == capacity ? _self.capacity : capacity // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionFinaleSummary].
extension SessionFinaleSummaryPatterns on SessionFinaleSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionFinaleSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionFinaleSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionFinaleSummary value)  $default,){
final _that = this;
switch (_that) {
case _SessionFinaleSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionFinaleSummary value)?  $default,){
final _that = this;
switch (_that) {
case _SessionFinaleSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sessionId,  String endedAt, @JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson)  Map<FinaleCountStatus, int> counts,  int capacity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionFinaleSummary() when $default != null:
return $default(_that.sessionId,_that.endedAt,_that.counts,_that.capacity);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sessionId,  String endedAt, @JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson)  Map<FinaleCountStatus, int> counts,  int capacity)  $default,) {final _that = this;
switch (_that) {
case _SessionFinaleSummary():
return $default(_that.sessionId,_that.endedAt,_that.counts,_that.capacity);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sessionId,  String endedAt, @JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson)  Map<FinaleCountStatus, int> counts,  int capacity)?  $default,) {final _that = this;
switch (_that) {
case _SessionFinaleSummary() when $default != null:
return $default(_that.sessionId,_that.endedAt,_that.counts,_that.capacity);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _SessionFinaleSummary implements SessionFinaleSummary {
  const _SessionFinaleSummary({required this.sessionId, required this.endedAt, @JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson)  Map<FinaleCountStatus, int> counts = const <FinaleCountStatus, int>{}, this.capacity = 0}): _counts = counts;
  factory _SessionFinaleSummary.fromJson(Map<String, dynamic> json) => _$SessionFinaleSummaryFromJson(json);

@override final  String sessionId;
@override final  String endedAt;
 final  Map<FinaleCountStatus, int> _counts;
@override@JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson) Map<FinaleCountStatus, int> get counts {
  if (_counts is EqualUnmodifiableMapView) return _counts;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_counts);
}

@override@JsonKey() final  int capacity;

/// Create a copy of SessionFinaleSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionFinaleSummaryCopyWith<_SessionFinaleSummary> get copyWith => __$SessionFinaleSummaryCopyWithImpl<_SessionFinaleSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionFinaleSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionFinaleSummary&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.endedAt, endedAt) || other.endedAt == endedAt)&&const DeepCollectionEquality().equals(other._counts, _counts)&&(identical(other.capacity, capacity) || other.capacity == capacity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sessionId,endedAt,const DeepCollectionEquality().hash(_counts),capacity);

@override
String toString() {
  return 'SessionFinaleSummary(sessionId: $sessionId, endedAt: $endedAt, counts: $counts, capacity: $capacity)';
}


}

/// @nodoc
abstract mixin class _$SessionFinaleSummaryCopyWith<$Res> implements $SessionFinaleSummaryCopyWith<$Res> {
  factory _$SessionFinaleSummaryCopyWith(_SessionFinaleSummary value, $Res Function(_SessionFinaleSummary) _then) = __$SessionFinaleSummaryCopyWithImpl;
@override @useResult
$Res call({
 String sessionId, String endedAt,@JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson) Map<FinaleCountStatus, int> counts, int capacity
});




}
/// @nodoc
class __$SessionFinaleSummaryCopyWithImpl<$Res>
    implements _$SessionFinaleSummaryCopyWith<$Res> {
  __$SessionFinaleSummaryCopyWithImpl(this._self, this._then);

  final _SessionFinaleSummary _self;
  final $Res Function(_SessionFinaleSummary) _then;

/// Create a copy of SessionFinaleSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sessionId = null,Object? endedAt = null,Object? counts = null,Object? capacity = null,}) {
  return _then(_SessionFinaleSummary(
sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,endedAt: null == endedAt ? _self.endedAt : endedAt // ignore: cast_nullable_to_non_nullable
as String,counts: null == counts ? _self._counts : counts // ignore: cast_nullable_to_non_nullable
as Map<FinaleCountStatus, int>,capacity: null == capacity ? _self.capacity : capacity // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
