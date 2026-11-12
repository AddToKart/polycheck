// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'attendance.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AttendanceCoordinates {

 double? get latitude; double? get longitude;
/// Create a copy of AttendanceCoordinates
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AttendanceCoordinatesCopyWith<AttendanceCoordinates> get copyWith => _$AttendanceCoordinatesCopyWithImpl<AttendanceCoordinates>(this as AttendanceCoordinates, _$identity);

  /// Serializes this AttendanceCoordinates to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AttendanceCoordinates&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,latitude,longitude);

@override
String toString() {
  return 'AttendanceCoordinates(latitude: $latitude, longitude: $longitude)';
}


}

/// @nodoc
abstract mixin class $AttendanceCoordinatesCopyWith<$Res>  {
  factory $AttendanceCoordinatesCopyWith(AttendanceCoordinates value, $Res Function(AttendanceCoordinates) _then) = _$AttendanceCoordinatesCopyWithImpl;
@useResult
$Res call({
 double? latitude, double? longitude
});




}
/// @nodoc
class _$AttendanceCoordinatesCopyWithImpl<$Res>
    implements $AttendanceCoordinatesCopyWith<$Res> {
  _$AttendanceCoordinatesCopyWithImpl(this._self, this._then);

  final AttendanceCoordinates _self;
  final $Res Function(AttendanceCoordinates) _then;

/// Create a copy of AttendanceCoordinates
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? latitude = freezed,Object? longitude = freezed,}) {
  return _then(AttendanceCoordinates(
latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

}


/// Adds pattern-matching-related methods to [AttendanceCoordinates].
extension AttendanceCoordinatesPatterns on AttendanceCoordinates {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AttendanceCoordinates value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AttendanceCoordinates() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AttendanceCoordinates value)  $default,){
final _that = this;
switch (_that) {
case _AttendanceCoordinates():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AttendanceCoordinates value)?  $default,){
final _that = this;
switch (_that) {
case _AttendanceCoordinates() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( double? latitude,  double? longitude)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AttendanceCoordinates() when $default != null:
return $default(_that.latitude,_that.longitude);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( double? latitude,  double? longitude)  $default,) {final _that = this;
switch (_that) {
case _AttendanceCoordinates():
return $default(_that.latitude,_that.longitude);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( double? latitude,  double? longitude)?  $default,) {final _that = this;
switch (_that) {
case _AttendanceCoordinates() when $default != null:
return $default(_that.latitude,_that.longitude);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AttendanceCoordinates implements AttendanceCoordinates {
  const _AttendanceCoordinates({required this.latitude, required this.longitude});
  factory _AttendanceCoordinates.fromJson(Map<String, dynamic> json) => _$AttendanceCoordinatesFromJson(json);

@override final  double? latitude;
@override final  double? longitude;

/// Create a copy of AttendanceCoordinates
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AttendanceCoordinatesCopyWith<_AttendanceCoordinates> get copyWith => __$AttendanceCoordinatesCopyWithImpl<_AttendanceCoordinates>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AttendanceCoordinatesToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AttendanceCoordinates&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,latitude,longitude);

@override
String toString() {
  return 'AttendanceCoordinates(latitude: $latitude, longitude: $longitude)';
}


}

/// @nodoc
abstract mixin class _$AttendanceCoordinatesCopyWith<$Res> implements $AttendanceCoordinatesCopyWith<$Res> {
  factory _$AttendanceCoordinatesCopyWith(_AttendanceCoordinates value, $Res Function(_AttendanceCoordinates) _then) = __$AttendanceCoordinatesCopyWithImpl;
@override @useResult
$Res call({
 double? latitude, double? longitude
});




}
/// @nodoc
class __$AttendanceCoordinatesCopyWithImpl<$Res>
    implements _$AttendanceCoordinatesCopyWith<$Res> {
  __$AttendanceCoordinatesCopyWithImpl(this._self, this._then);

  final _AttendanceCoordinates _self;
  final $Res Function(_AttendanceCoordinates) _then;

/// Create a copy of AttendanceCoordinates
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? latitude = freezed,Object? longitude = freezed,}) {
  return _then(_AttendanceCoordinates(
latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}


}


/// @nodoc
mixin _$AttendanceRecord {

 String get id; String get sessionId; String get sectionId; String get studentId; String get studentName; String? get studentProgram; String get timestamp; AttendanceStatus get status; AttendanceCoordinates get coordinates; SessionMode? get mode; String? get checkInTime; AttendanceStatus? get checkInStatus; String? get checkOutTime; AttendanceStatus? get checkOutStatus; String? get deviceId; String? get tokenSnapshot; bool get isSynced; String? get syncedAt; DisputeReason? get disputeReason; bool get disputeResolved; String? get disputeDescription; bool get manuallySet; String? get notes; ExcuseStatus? get excuseStatus; ExcuseReason? get excuseReason; String? get excuseDescription; String? get excuseEvidencePath; String? get excuseReviewedBy; String? get excuseReviewedAt; String? get excuseReviewNote;
/// Create a copy of AttendanceRecord
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AttendanceRecordCopyWith<AttendanceRecord> get copyWith => _$AttendanceRecordCopyWithImpl<AttendanceRecord>(this as AttendanceRecord, _$identity);

  /// Serializes this AttendanceRecord to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AttendanceRecord&&(identical(other.id, id) || other.id == id)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentProgram, studentProgram) || other.studentProgram == studentProgram)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.status, status) || other.status == status)&&(identical(other.coordinates, coordinates) || other.coordinates == coordinates)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.checkInTime, checkInTime) || other.checkInTime == checkInTime)&&(identical(other.checkInStatus, checkInStatus) || other.checkInStatus == checkInStatus)&&(identical(other.checkOutTime, checkOutTime) || other.checkOutTime == checkOutTime)&&(identical(other.checkOutStatus, checkOutStatus) || other.checkOutStatus == checkOutStatus)&&(identical(other.deviceId, deviceId) || other.deviceId == deviceId)&&(identical(other.tokenSnapshot, tokenSnapshot) || other.tokenSnapshot == tokenSnapshot)&&(identical(other.isSynced, isSynced) || other.isSynced == isSynced)&&(identical(other.syncedAt, syncedAt) || other.syncedAt == syncedAt)&&(identical(other.disputeReason, disputeReason) || other.disputeReason == disputeReason)&&(identical(other.disputeResolved, disputeResolved) || other.disputeResolved == disputeResolved)&&(identical(other.disputeDescription, disputeDescription) || other.disputeDescription == disputeDescription)&&(identical(other.manuallySet, manuallySet) || other.manuallySet == manuallySet)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.excuseStatus, excuseStatus) || other.excuseStatus == excuseStatus)&&(identical(other.excuseReason, excuseReason) || other.excuseReason == excuseReason)&&(identical(other.excuseDescription, excuseDescription) || other.excuseDescription == excuseDescription)&&(identical(other.excuseEvidencePath, excuseEvidencePath) || other.excuseEvidencePath == excuseEvidencePath)&&(identical(other.excuseReviewedBy, excuseReviewedBy) || other.excuseReviewedBy == excuseReviewedBy)&&(identical(other.excuseReviewedAt, excuseReviewedAt) || other.excuseReviewedAt == excuseReviewedAt)&&(identical(other.excuseReviewNote, excuseReviewNote) || other.excuseReviewNote == excuseReviewNote));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,sessionId,sectionId,studentId,studentName,studentProgram,timestamp,status,coordinates,mode,checkInTime,checkInStatus,checkOutTime,checkOutStatus,deviceId,tokenSnapshot,isSynced,syncedAt,disputeReason,disputeResolved,disputeDescription,manuallySet,notes,excuseStatus,excuseReason,excuseDescription,excuseEvidencePath,excuseReviewedBy,excuseReviewedAt,excuseReviewNote]);

@override
String toString() {
  return 'AttendanceRecord(id: $id, sessionId: $sessionId, sectionId: $sectionId, studentId: $studentId, studentName: $studentName, studentProgram: $studentProgram, timestamp: $timestamp, status: $status, coordinates: $coordinates, mode: $mode, checkInTime: $checkInTime, checkInStatus: $checkInStatus, checkOutTime: $checkOutTime, checkOutStatus: $checkOutStatus, deviceId: $deviceId, tokenSnapshot: $tokenSnapshot, isSynced: $isSynced, syncedAt: $syncedAt, disputeReason: $disputeReason, disputeResolved: $disputeResolved, disputeDescription: $disputeDescription, manuallySet: $manuallySet, notes: $notes, excuseStatus: $excuseStatus, excuseReason: $excuseReason, excuseDescription: $excuseDescription, excuseEvidencePath: $excuseEvidencePath, excuseReviewedBy: $excuseReviewedBy, excuseReviewedAt: $excuseReviewedAt, excuseReviewNote: $excuseReviewNote)';
}


}

/// @nodoc
abstract mixin class $AttendanceRecordCopyWith<$Res>  {
  factory $AttendanceRecordCopyWith(AttendanceRecord value, $Res Function(AttendanceRecord) _then) = _$AttendanceRecordCopyWithImpl;
@useResult
$Res call({
 String id, String sessionId, String sectionId, String studentId, String studentName, String? studentProgram, String timestamp, AttendanceStatus status, AttendanceCoordinates coordinates, SessionMode? mode, String? checkInTime, AttendanceStatus? checkInStatus, String? checkOutTime, AttendanceStatus? checkOutStatus, String? deviceId, String? tokenSnapshot, bool isSynced, String? syncedAt, DisputeReason? disputeReason, bool disputeResolved, String? disputeDescription, bool manuallySet, String? notes, ExcuseStatus? excuseStatus, ExcuseReason? excuseReason, String? excuseDescription, String? excuseEvidencePath, String? excuseReviewedBy, String? excuseReviewedAt, String? excuseReviewNote
});


$AttendanceCoordinatesCopyWith<$Res> get coordinates;

}
/// @nodoc
class _$AttendanceRecordCopyWithImpl<$Res>
    implements $AttendanceRecordCopyWith<$Res> {
  _$AttendanceRecordCopyWithImpl(this._self, this._then);

  final AttendanceRecord _self;
  final $Res Function(AttendanceRecord) _then;

/// Create a copy of AttendanceRecord
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? sessionId = null,Object? sectionId = null,Object? studentId = null,Object? studentName = null,Object? studentProgram = freezed,Object? timestamp = null,Object? status = null,Object? coordinates = null,Object? mode = freezed,Object? checkInTime = freezed,Object? checkInStatus = freezed,Object? checkOutTime = freezed,Object? checkOutStatus = freezed,Object? deviceId = freezed,Object? tokenSnapshot = freezed,Object? isSynced = null,Object? syncedAt = freezed,Object? disputeReason = freezed,Object? disputeResolved = null,Object? disputeDescription = freezed,Object? manuallySet = null,Object? notes = freezed,Object? excuseStatus = freezed,Object? excuseReason = freezed,Object? excuseDescription = freezed,Object? excuseEvidencePath = freezed,Object? excuseReviewedBy = freezed,Object? excuseReviewedAt = freezed,Object? excuseReviewNote = freezed,}) {
  return _then(AttendanceRecord(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,studentProgram: freezed == studentProgram ? _self.studentProgram : studentProgram // ignore: cast_nullable_to_non_nullable
as String?,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AttendanceStatus,coordinates: null == coordinates ? _self.coordinates : coordinates // ignore: cast_nullable_to_non_nullable
as AttendanceCoordinates,mode: freezed == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode?,checkInTime: freezed == checkInTime ? _self.checkInTime : checkInTime // ignore: cast_nullable_to_non_nullable
as String?,checkInStatus: freezed == checkInStatus ? _self.checkInStatus : checkInStatus // ignore: cast_nullable_to_non_nullable
as AttendanceStatus?,checkOutTime: freezed == checkOutTime ? _self.checkOutTime : checkOutTime // ignore: cast_nullable_to_non_nullable
as String?,checkOutStatus: freezed == checkOutStatus ? _self.checkOutStatus : checkOutStatus // ignore: cast_nullable_to_non_nullable
as AttendanceStatus?,deviceId: freezed == deviceId ? _self.deviceId : deviceId // ignore: cast_nullable_to_non_nullable
as String?,tokenSnapshot: freezed == tokenSnapshot ? _self.tokenSnapshot : tokenSnapshot // ignore: cast_nullable_to_non_nullable
as String?,isSynced: null == isSynced ? _self.isSynced : isSynced // ignore: cast_nullable_to_non_nullable
as bool,syncedAt: freezed == syncedAt ? _self.syncedAt : syncedAt // ignore: cast_nullable_to_non_nullable
as String?,disputeReason: freezed == disputeReason ? _self.disputeReason : disputeReason // ignore: cast_nullable_to_non_nullable
as DisputeReason?,disputeResolved: null == disputeResolved ? _self.disputeResolved : disputeResolved // ignore: cast_nullable_to_non_nullable
as bool,disputeDescription: freezed == disputeDescription ? _self.disputeDescription : disputeDescription // ignore: cast_nullable_to_non_nullable
as String?,manuallySet: null == manuallySet ? _self.manuallySet : manuallySet // ignore: cast_nullable_to_non_nullable
as bool,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,excuseStatus: freezed == excuseStatus ? _self.excuseStatus : excuseStatus // ignore: cast_nullable_to_non_nullable
as ExcuseStatus?,excuseReason: freezed == excuseReason ? _self.excuseReason : excuseReason // ignore: cast_nullable_to_non_nullable
as ExcuseReason?,excuseDescription: freezed == excuseDescription ? _self.excuseDescription : excuseDescription // ignore: cast_nullable_to_non_nullable
as String?,excuseEvidencePath: freezed == excuseEvidencePath ? _self.excuseEvidencePath : excuseEvidencePath // ignore: cast_nullable_to_non_nullable
as String?,excuseReviewedBy: freezed == excuseReviewedBy ? _self.excuseReviewedBy : excuseReviewedBy // ignore: cast_nullable_to_non_nullable
as String?,excuseReviewedAt: freezed == excuseReviewedAt ? _self.excuseReviewedAt : excuseReviewedAt // ignore: cast_nullable_to_non_nullable
as String?,excuseReviewNote: freezed == excuseReviewNote ? _self.excuseReviewNote : excuseReviewNote // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of AttendanceRecord
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AttendanceCoordinatesCopyWith<$Res> get coordinates {
  
  return $AttendanceCoordinatesCopyWith<$Res>(_self.coordinates, (value) {
    return _then(_self.copyWith(coordinates: value));
  });
}
}


/// Adds pattern-matching-related methods to [AttendanceRecord].
extension AttendanceRecordPatterns on AttendanceRecord {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AttendanceRecord value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AttendanceRecord() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AttendanceRecord value)  $default,){
final _that = this;
switch (_that) {
case _AttendanceRecord():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AttendanceRecord value)?  $default,){
final _that = this;
switch (_that) {
case _AttendanceRecord() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String sessionId,  String sectionId,  String studentId,  String studentName,  String? studentProgram,  String timestamp,  AttendanceStatus status,  AttendanceCoordinates coordinates,  SessionMode? mode,  String? checkInTime,  AttendanceStatus? checkInStatus,  String? checkOutTime,  AttendanceStatus? checkOutStatus,  String? deviceId,  String? tokenSnapshot,  bool isSynced,  String? syncedAt,  DisputeReason? disputeReason,  bool disputeResolved,  String? disputeDescription,  bool manuallySet,  String? notes,  ExcuseStatus? excuseStatus,  ExcuseReason? excuseReason,  String? excuseDescription,  String? excuseEvidencePath,  String? excuseReviewedBy,  String? excuseReviewedAt,  String? excuseReviewNote)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AttendanceRecord() when $default != null:
return $default(_that.id,_that.sessionId,_that.sectionId,_that.studentId,_that.studentName,_that.studentProgram,_that.timestamp,_that.status,_that.coordinates,_that.mode,_that.checkInTime,_that.checkInStatus,_that.checkOutTime,_that.checkOutStatus,_that.deviceId,_that.tokenSnapshot,_that.isSynced,_that.syncedAt,_that.disputeReason,_that.disputeResolved,_that.disputeDescription,_that.manuallySet,_that.notes,_that.excuseStatus,_that.excuseReason,_that.excuseDescription,_that.excuseEvidencePath,_that.excuseReviewedBy,_that.excuseReviewedAt,_that.excuseReviewNote);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String sessionId,  String sectionId,  String studentId,  String studentName,  String? studentProgram,  String timestamp,  AttendanceStatus status,  AttendanceCoordinates coordinates,  SessionMode? mode,  String? checkInTime,  AttendanceStatus? checkInStatus,  String? checkOutTime,  AttendanceStatus? checkOutStatus,  String? deviceId,  String? tokenSnapshot,  bool isSynced,  String? syncedAt,  DisputeReason? disputeReason,  bool disputeResolved,  String? disputeDescription,  bool manuallySet,  String? notes,  ExcuseStatus? excuseStatus,  ExcuseReason? excuseReason,  String? excuseDescription,  String? excuseEvidencePath,  String? excuseReviewedBy,  String? excuseReviewedAt,  String? excuseReviewNote)  $default,) {final _that = this;
switch (_that) {
case _AttendanceRecord():
return $default(_that.id,_that.sessionId,_that.sectionId,_that.studentId,_that.studentName,_that.studentProgram,_that.timestamp,_that.status,_that.coordinates,_that.mode,_that.checkInTime,_that.checkInStatus,_that.checkOutTime,_that.checkOutStatus,_that.deviceId,_that.tokenSnapshot,_that.isSynced,_that.syncedAt,_that.disputeReason,_that.disputeResolved,_that.disputeDescription,_that.manuallySet,_that.notes,_that.excuseStatus,_that.excuseReason,_that.excuseDescription,_that.excuseEvidencePath,_that.excuseReviewedBy,_that.excuseReviewedAt,_that.excuseReviewNote);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String sessionId,  String sectionId,  String studentId,  String studentName,  String? studentProgram,  String timestamp,  AttendanceStatus status,  AttendanceCoordinates coordinates,  SessionMode? mode,  String? checkInTime,  AttendanceStatus? checkInStatus,  String? checkOutTime,  AttendanceStatus? checkOutStatus,  String? deviceId,  String? tokenSnapshot,  bool isSynced,  String? syncedAt,  DisputeReason? disputeReason,  bool disputeResolved,  String? disputeDescription,  bool manuallySet,  String? notes,  ExcuseStatus? excuseStatus,  ExcuseReason? excuseReason,  String? excuseDescription,  String? excuseEvidencePath,  String? excuseReviewedBy,  String? excuseReviewedAt,  String? excuseReviewNote)?  $default,) {final _that = this;
switch (_that) {
case _AttendanceRecord() when $default != null:
return $default(_that.id,_that.sessionId,_that.sectionId,_that.studentId,_that.studentName,_that.studentProgram,_that.timestamp,_that.status,_that.coordinates,_that.mode,_that.checkInTime,_that.checkInStatus,_that.checkOutTime,_that.checkOutStatus,_that.deviceId,_that.tokenSnapshot,_that.isSynced,_that.syncedAt,_that.disputeReason,_that.disputeResolved,_that.disputeDescription,_that.manuallySet,_that.notes,_that.excuseStatus,_that.excuseReason,_that.excuseDescription,_that.excuseEvidencePath,_that.excuseReviewedBy,_that.excuseReviewedAt,_that.excuseReviewNote);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AttendanceStatusConverter(), SessionModeConverter(), DisputeReasonConverter(), ExcuseStatusConverter()])
class _AttendanceRecord implements AttendanceRecord {
  const _AttendanceRecord({required this.id, required this.sessionId, required this.sectionId, required this.studentId, this.studentName = '', this.studentProgram, this.timestamp = '', required this.status, this.coordinates = const AttendanceCoordinates(latitude: null, longitude: null), this.mode, this.checkInTime, this.checkInStatus, this.checkOutTime, this.checkOutStatus, this.deviceId, this.tokenSnapshot, this.isSynced = false, this.syncedAt, this.disputeReason, this.disputeResolved = false, this.disputeDescription, this.manuallySet = false, this.notes, this.excuseStatus, this.excuseReason, this.excuseDescription, this.excuseEvidencePath, this.excuseReviewedBy, this.excuseReviewedAt, this.excuseReviewNote});
  factory _AttendanceRecord.fromJson(Map<String, dynamic> json) => _$AttendanceRecordFromJson(json);

@override final  String id;
@override final  String sessionId;
@override final  String sectionId;
@override final  String studentId;
@override@JsonKey() final  String studentName;
@override final  String? studentProgram;
@override@JsonKey() final  String timestamp;
@override final  AttendanceStatus status;
@override@JsonKey() final  AttendanceCoordinates coordinates;
@override final  SessionMode? mode;
@override final  String? checkInTime;
@override final  AttendanceStatus? checkInStatus;
@override final  String? checkOutTime;
@override final  AttendanceStatus? checkOutStatus;
@override final  String? deviceId;
@override final  String? tokenSnapshot;
@override@JsonKey() final  bool isSynced;
@override final  String? syncedAt;
@override final  DisputeReason? disputeReason;
@override@JsonKey() final  bool disputeResolved;
@override final  String? disputeDescription;
@override@JsonKey() final  bool manuallySet;
@override final  String? notes;
@override final  ExcuseStatus? excuseStatus;
@override final  ExcuseReason? excuseReason;
@override final  String? excuseDescription;
@override final  String? excuseEvidencePath;
@override final  String? excuseReviewedBy;
@override final  String? excuseReviewedAt;
@override final  String? excuseReviewNote;

/// Create a copy of AttendanceRecord
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AttendanceRecordCopyWith<_AttendanceRecord> get copyWith => __$AttendanceRecordCopyWithImpl<_AttendanceRecord>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AttendanceRecordToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AttendanceRecord&&(identical(other.id, id) || other.id == id)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentProgram, studentProgram) || other.studentProgram == studentProgram)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.status, status) || other.status == status)&&(identical(other.coordinates, coordinates) || other.coordinates == coordinates)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.checkInTime, checkInTime) || other.checkInTime == checkInTime)&&(identical(other.checkInStatus, checkInStatus) || other.checkInStatus == checkInStatus)&&(identical(other.checkOutTime, checkOutTime) || other.checkOutTime == checkOutTime)&&(identical(other.checkOutStatus, checkOutStatus) || other.checkOutStatus == checkOutStatus)&&(identical(other.deviceId, deviceId) || other.deviceId == deviceId)&&(identical(other.tokenSnapshot, tokenSnapshot) || other.tokenSnapshot == tokenSnapshot)&&(identical(other.isSynced, isSynced) || other.isSynced == isSynced)&&(identical(other.syncedAt, syncedAt) || other.syncedAt == syncedAt)&&(identical(other.disputeReason, disputeReason) || other.disputeReason == disputeReason)&&(identical(other.disputeResolved, disputeResolved) || other.disputeResolved == disputeResolved)&&(identical(other.disputeDescription, disputeDescription) || other.disputeDescription == disputeDescription)&&(identical(other.manuallySet, manuallySet) || other.manuallySet == manuallySet)&&(identical(other.notes, notes) || other.notes == notes)&&(identical(other.excuseStatus, excuseStatus) || other.excuseStatus == excuseStatus)&&(identical(other.excuseReason, excuseReason) || other.excuseReason == excuseReason)&&(identical(other.excuseDescription, excuseDescription) || other.excuseDescription == excuseDescription)&&(identical(other.excuseEvidencePath, excuseEvidencePath) || other.excuseEvidencePath == excuseEvidencePath)&&(identical(other.excuseReviewedBy, excuseReviewedBy) || other.excuseReviewedBy == excuseReviewedBy)&&(identical(other.excuseReviewedAt, excuseReviewedAt) || other.excuseReviewedAt == excuseReviewedAt)&&(identical(other.excuseReviewNote, excuseReviewNote) || other.excuseReviewNote == excuseReviewNote));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,sessionId,sectionId,studentId,studentName,studentProgram,timestamp,status,coordinates,mode,checkInTime,checkInStatus,checkOutTime,checkOutStatus,deviceId,tokenSnapshot,isSynced,syncedAt,disputeReason,disputeResolved,disputeDescription,manuallySet,notes,excuseStatus,excuseReason,excuseDescription,excuseEvidencePath,excuseReviewedBy,excuseReviewedAt,excuseReviewNote]);

@override
String toString() {
  return 'AttendanceRecord(id: $id, sessionId: $sessionId, sectionId: $sectionId, studentId: $studentId, studentName: $studentName, studentProgram: $studentProgram, timestamp: $timestamp, status: $status, coordinates: $coordinates, mode: $mode, checkInTime: $checkInTime, checkInStatus: $checkInStatus, checkOutTime: $checkOutTime, checkOutStatus: $checkOutStatus, deviceId: $deviceId, tokenSnapshot: $tokenSnapshot, isSynced: $isSynced, syncedAt: $syncedAt, disputeReason: $disputeReason, disputeResolved: $disputeResolved, disputeDescription: $disputeDescription, manuallySet: $manuallySet, notes: $notes, excuseStatus: $excuseStatus, excuseReason: $excuseReason, excuseDescription: $excuseDescription, excuseEvidencePath: $excuseEvidencePath, excuseReviewedBy: $excuseReviewedBy, excuseReviewedAt: $excuseReviewedAt, excuseReviewNote: $excuseReviewNote)';
}


}

/// @nodoc
abstract mixin class _$AttendanceRecordCopyWith<$Res> implements $AttendanceRecordCopyWith<$Res> {
  factory _$AttendanceRecordCopyWith(_AttendanceRecord value, $Res Function(_AttendanceRecord) _then) = __$AttendanceRecordCopyWithImpl;
@override @useResult
$Res call({
 String id, String sessionId, String sectionId, String studentId, String studentName, String? studentProgram, String timestamp, AttendanceStatus status, AttendanceCoordinates coordinates, SessionMode? mode, String? checkInTime, AttendanceStatus? checkInStatus, String? checkOutTime, AttendanceStatus? checkOutStatus, String? deviceId, String? tokenSnapshot, bool isSynced, String? syncedAt, DisputeReason? disputeReason, bool disputeResolved, String? disputeDescription, bool manuallySet, String? notes, ExcuseStatus? excuseStatus, ExcuseReason? excuseReason, String? excuseDescription, String? excuseEvidencePath, String? excuseReviewedBy, String? excuseReviewedAt, String? excuseReviewNote
});


@override $AttendanceCoordinatesCopyWith<$Res> get coordinates;

}
/// @nodoc
class __$AttendanceRecordCopyWithImpl<$Res>
    implements _$AttendanceRecordCopyWith<$Res> {
  __$AttendanceRecordCopyWithImpl(this._self, this._then);

  final _AttendanceRecord _self;
  final $Res Function(_AttendanceRecord) _then;

/// Create a copy of AttendanceRecord
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? sessionId = null,Object? sectionId = null,Object? studentId = null,Object? studentName = null,Object? studentProgram = freezed,Object? timestamp = null,Object? status = null,Object? coordinates = null,Object? mode = freezed,Object? checkInTime = freezed,Object? checkInStatus = freezed,Object? checkOutTime = freezed,Object? checkOutStatus = freezed,Object? deviceId = freezed,Object? tokenSnapshot = freezed,Object? isSynced = null,Object? syncedAt = freezed,Object? disputeReason = freezed,Object? disputeResolved = null,Object? disputeDescription = freezed,Object? manuallySet = null,Object? notes = freezed,Object? excuseStatus = freezed,Object? excuseReason = freezed,Object? excuseDescription = freezed,Object? excuseEvidencePath = freezed,Object? excuseReviewedBy = freezed,Object? excuseReviewedAt = freezed,Object? excuseReviewNote = freezed,}) {
  return _then(_AttendanceRecord(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,studentProgram: freezed == studentProgram ? _self.studentProgram : studentProgram // ignore: cast_nullable_to_non_nullable
as String?,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AttendanceStatus,coordinates: null == coordinates ? _self.coordinates : coordinates // ignore: cast_nullable_to_non_nullable
as AttendanceCoordinates,mode: freezed == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode?,checkInTime: freezed == checkInTime ? _self.checkInTime : checkInTime // ignore: cast_nullable_to_non_nullable
as String?,checkInStatus: freezed == checkInStatus ? _self.checkInStatus : checkInStatus // ignore: cast_nullable_to_non_nullable
as AttendanceStatus?,checkOutTime: freezed == checkOutTime ? _self.checkOutTime : checkOutTime // ignore: cast_nullable_to_non_nullable
as String?,checkOutStatus: freezed == checkOutStatus ? _self.checkOutStatus : checkOutStatus // ignore: cast_nullable_to_non_nullable
as AttendanceStatus?,deviceId: freezed == deviceId ? _self.deviceId : deviceId // ignore: cast_nullable_to_non_nullable
as String?,tokenSnapshot: freezed == tokenSnapshot ? _self.tokenSnapshot : tokenSnapshot // ignore: cast_nullable_to_non_nullable
as String?,isSynced: null == isSynced ? _self.isSynced : isSynced // ignore: cast_nullable_to_non_nullable
as bool,syncedAt: freezed == syncedAt ? _self.syncedAt : syncedAt // ignore: cast_nullable_to_non_nullable
as String?,disputeReason: freezed == disputeReason ? _self.disputeReason : disputeReason // ignore: cast_nullable_to_non_nullable
as DisputeReason?,disputeResolved: null == disputeResolved ? _self.disputeResolved : disputeResolved // ignore: cast_nullable_to_non_nullable
as bool,disputeDescription: freezed == disputeDescription ? _self.disputeDescription : disputeDescription // ignore: cast_nullable_to_non_nullable
as String?,manuallySet: null == manuallySet ? _self.manuallySet : manuallySet // ignore: cast_nullable_to_non_nullable
as bool,notes: freezed == notes ? _self.notes : notes // ignore: cast_nullable_to_non_nullable
as String?,excuseStatus: freezed == excuseStatus ? _self.excuseStatus : excuseStatus // ignore: cast_nullable_to_non_nullable
as ExcuseStatus?,excuseReason: freezed == excuseReason ? _self.excuseReason : excuseReason // ignore: cast_nullable_to_non_nullable
as ExcuseReason?,excuseDescription: freezed == excuseDescription ? _self.excuseDescription : excuseDescription // ignore: cast_nullable_to_non_nullable
as String?,excuseEvidencePath: freezed == excuseEvidencePath ? _self.excuseEvidencePath : excuseEvidencePath // ignore: cast_nullable_to_non_nullable
as String?,excuseReviewedBy: freezed == excuseReviewedBy ? _self.excuseReviewedBy : excuseReviewedBy // ignore: cast_nullable_to_non_nullable
as String?,excuseReviewedAt: freezed == excuseReviewedAt ? _self.excuseReviewedAt : excuseReviewedAt // ignore: cast_nullable_to_non_nullable
as String?,excuseReviewNote: freezed == excuseReviewNote ? _self.excuseReviewNote : excuseReviewNote // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of AttendanceRecord
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AttendanceCoordinatesCopyWith<$Res> get coordinates {
  
  return $AttendanceCoordinatesCopyWith<$Res>(_self.coordinates, (value) {
    return _then(_self.copyWith(coordinates: value));
  });
}
}


/// @nodoc
mixin _$AttendanceSummary {

 String get sectionId; String get subjectName; int get totalSessions; int get present; int get late; int get absent; int get disputed; int get excused; int get incomplete;
/// Create a copy of AttendanceSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AttendanceSummaryCopyWith<AttendanceSummary> get copyWith => _$AttendanceSummaryCopyWithImpl<AttendanceSummary>(this as AttendanceSummary, _$identity);

  /// Serializes this AttendanceSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AttendanceSummary&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.totalSessions, totalSessions) || other.totalSessions == totalSessions)&&(identical(other.present, present) || other.present == present)&&(identical(other.late, late) || other.late == late)&&(identical(other.absent, absent) || other.absent == absent)&&(identical(other.disputed, disputed) || other.disputed == disputed)&&(identical(other.excused, excused) || other.excused == excused)&&(identical(other.incomplete, incomplete) || other.incomplete == incomplete));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,subjectName,totalSessions,present,late,absent,disputed,excused,incomplete);

@override
String toString() {
  return 'AttendanceSummary(sectionId: $sectionId, subjectName: $subjectName, totalSessions: $totalSessions, present: $present, late: $late, absent: $absent, disputed: $disputed, excused: $excused, incomplete: $incomplete)';
}


}

/// @nodoc
abstract mixin class $AttendanceSummaryCopyWith<$Res>  {
  factory $AttendanceSummaryCopyWith(AttendanceSummary value, $Res Function(AttendanceSummary) _then) = _$AttendanceSummaryCopyWithImpl;
@useResult
$Res call({
 String sectionId, String subjectName, int totalSessions, int present, int late, int absent, int disputed, int excused, int incomplete
});




}
/// @nodoc
class _$AttendanceSummaryCopyWithImpl<$Res>
    implements $AttendanceSummaryCopyWith<$Res> {
  _$AttendanceSummaryCopyWithImpl(this._self, this._then);

  final AttendanceSummary _self;
  final $Res Function(AttendanceSummary) _then;

/// Create a copy of AttendanceSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sectionId = null,Object? subjectName = null,Object? totalSessions = null,Object? present = null,Object? late = null,Object? absent = null,Object? disputed = null,Object? excused = null,Object? incomplete = null,}) {
  return _then(AttendanceSummary(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,totalSessions: null == totalSessions ? _self.totalSessions : totalSessions // ignore: cast_nullable_to_non_nullable
as int,present: null == present ? _self.present : present // ignore: cast_nullable_to_non_nullable
as int,late: null == late ? _self.late : late // ignore: cast_nullable_to_non_nullable
as int,absent: null == absent ? _self.absent : absent // ignore: cast_nullable_to_non_nullable
as int,disputed: null == disputed ? _self.disputed : disputed // ignore: cast_nullable_to_non_nullable
as int,excused: null == excused ? _self.excused : excused // ignore: cast_nullable_to_non_nullable
as int,incomplete: null == incomplete ? _self.incomplete : incomplete // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [AttendanceSummary].
extension AttendanceSummaryPatterns on AttendanceSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AttendanceSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AttendanceSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AttendanceSummary value)  $default,){
final _that = this;
switch (_that) {
case _AttendanceSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AttendanceSummary value)?  $default,){
final _that = this;
switch (_that) {
case _AttendanceSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sectionId,  String subjectName,  int totalSessions,  int present,  int late,  int absent,  int disputed,  int excused,  int incomplete)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AttendanceSummary() when $default != null:
return $default(_that.sectionId,_that.subjectName,_that.totalSessions,_that.present,_that.late,_that.absent,_that.disputed,_that.excused,_that.incomplete);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sectionId,  String subjectName,  int totalSessions,  int present,  int late,  int absent,  int disputed,  int excused,  int incomplete)  $default,) {final _that = this;
switch (_that) {
case _AttendanceSummary():
return $default(_that.sectionId,_that.subjectName,_that.totalSessions,_that.present,_that.late,_that.absent,_that.disputed,_that.excused,_that.incomplete);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sectionId,  String subjectName,  int totalSessions,  int present,  int late,  int absent,  int disputed,  int excused,  int incomplete)?  $default,) {final _that = this;
switch (_that) {
case _AttendanceSummary() when $default != null:
return $default(_that.sectionId,_that.subjectName,_that.totalSessions,_that.present,_that.late,_that.absent,_that.disputed,_that.excused,_that.incomplete);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AttendanceSummary implements AttendanceSummary {
  const _AttendanceSummary({required this.sectionId, this.subjectName = '', this.totalSessions = 0, this.present = 0, this.late = 0, this.absent = 0, this.disputed = 0, this.excused = 0, this.incomplete = 0});
  factory _AttendanceSummary.fromJson(Map<String, dynamic> json) => _$AttendanceSummaryFromJson(json);

@override final  String sectionId;
@override@JsonKey() final  String subjectName;
@override@JsonKey() final  int totalSessions;
@override@JsonKey() final  int present;
@override@JsonKey() final  int late;
@override@JsonKey() final  int absent;
@override@JsonKey() final  int disputed;
@override@JsonKey() final  int excused;
@override@JsonKey() final  int incomplete;

/// Create a copy of AttendanceSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AttendanceSummaryCopyWith<_AttendanceSummary> get copyWith => __$AttendanceSummaryCopyWithImpl<_AttendanceSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AttendanceSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AttendanceSummary&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.totalSessions, totalSessions) || other.totalSessions == totalSessions)&&(identical(other.present, present) || other.present == present)&&(identical(other.late, late) || other.late == late)&&(identical(other.absent, absent) || other.absent == absent)&&(identical(other.disputed, disputed) || other.disputed == disputed)&&(identical(other.excused, excused) || other.excused == excused)&&(identical(other.incomplete, incomplete) || other.incomplete == incomplete));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,subjectName,totalSessions,present,late,absent,disputed,excused,incomplete);

@override
String toString() {
  return 'AttendanceSummary(sectionId: $sectionId, subjectName: $subjectName, totalSessions: $totalSessions, present: $present, late: $late, absent: $absent, disputed: $disputed, excused: $excused, incomplete: $incomplete)';
}


}

/// @nodoc
abstract mixin class _$AttendanceSummaryCopyWith<$Res> implements $AttendanceSummaryCopyWith<$Res> {
  factory _$AttendanceSummaryCopyWith(_AttendanceSummary value, $Res Function(_AttendanceSummary) _then) = __$AttendanceSummaryCopyWithImpl;
@override @useResult
$Res call({
 String sectionId, String subjectName, int totalSessions, int present, int late, int absent, int disputed, int excused, int incomplete
});




}
/// @nodoc
class __$AttendanceSummaryCopyWithImpl<$Res>
    implements _$AttendanceSummaryCopyWith<$Res> {
  __$AttendanceSummaryCopyWithImpl(this._self, this._then);

  final _AttendanceSummary _self;
  final $Res Function(_AttendanceSummary) _then;

/// Create a copy of AttendanceSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sectionId = null,Object? subjectName = null,Object? totalSessions = null,Object? present = null,Object? late = null,Object? absent = null,Object? disputed = null,Object? excused = null,Object? incomplete = null,}) {
  return _then(_AttendanceSummary(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,totalSessions: null == totalSessions ? _self.totalSessions : totalSessions // ignore: cast_nullable_to_non_nullable
as int,present: null == present ? _self.present : present // ignore: cast_nullable_to_non_nullable
as int,late: null == late ? _self.late : late // ignore: cast_nullable_to_non_nullable
as int,absent: null == absent ? _self.absent : absent // ignore: cast_nullable_to_non_nullable
as int,disputed: null == disputed ? _self.disputed : disputed // ignore: cast_nullable_to_non_nullable
as int,excused: null == excused ? _self.excused : excused // ignore: cast_nullable_to_non_nullable
as int,incomplete: null == incomplete ? _self.incomplete : incomplete // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$AttendanceAnomalyEvent {

 String get sessionId; String get studentId; String? get studentName; String? get studentNumber; double? get latitude; double? get longitude; double? get distanceMeters; double? get geofenceRadiusMeters; String get reason; String get timestamp;
/// Create a copy of AttendanceAnomalyEvent
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AttendanceAnomalyEventCopyWith<AttendanceAnomalyEvent> get copyWith => _$AttendanceAnomalyEventCopyWithImpl<AttendanceAnomalyEvent>(this as AttendanceAnomalyEvent, _$identity);

  /// Serializes this AttendanceAnomalyEvent to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AttendanceAnomalyEvent&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentNumber, studentNumber) || other.studentNumber == studentNumber)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.geofenceRadiusMeters, geofenceRadiusMeters) || other.geofenceRadiusMeters == geofenceRadiusMeters)&&(identical(other.reason, reason) || other.reason == reason)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sessionId,studentId,studentName,studentNumber,latitude,longitude,distanceMeters,geofenceRadiusMeters,reason,timestamp);

@override
String toString() {
  return 'AttendanceAnomalyEvent(sessionId: $sessionId, studentId: $studentId, studentName: $studentName, studentNumber: $studentNumber, latitude: $latitude, longitude: $longitude, distanceMeters: $distanceMeters, geofenceRadiusMeters: $geofenceRadiusMeters, reason: $reason, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class $AttendanceAnomalyEventCopyWith<$Res>  {
  factory $AttendanceAnomalyEventCopyWith(AttendanceAnomalyEvent value, $Res Function(AttendanceAnomalyEvent) _then) = _$AttendanceAnomalyEventCopyWithImpl;
@useResult
$Res call({
 String sessionId, String studentId, String? studentName, String? studentNumber, double? latitude, double? longitude, double? distanceMeters, double? geofenceRadiusMeters, String reason, String timestamp
});




}
/// @nodoc
class _$AttendanceAnomalyEventCopyWithImpl<$Res>
    implements $AttendanceAnomalyEventCopyWith<$Res> {
  _$AttendanceAnomalyEventCopyWithImpl(this._self, this._then);

  final AttendanceAnomalyEvent _self;
  final $Res Function(AttendanceAnomalyEvent) _then;

/// Create a copy of AttendanceAnomalyEvent
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sessionId = null,Object? studentId = null,Object? studentName = freezed,Object? studentNumber = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? distanceMeters = freezed,Object? geofenceRadiusMeters = freezed,Object? reason = null,Object? timestamp = null,}) {
  return _then(AttendanceAnomalyEvent(
sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: freezed == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String?,studentNumber: freezed == studentNumber ? _self.studentNumber : studentNumber // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,geofenceRadiusMeters: freezed == geofenceRadiusMeters ? _self.geofenceRadiusMeters : geofenceRadiusMeters // ignore: cast_nullable_to_non_nullable
as double?,reason: null == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AttendanceAnomalyEvent].
extension AttendanceAnomalyEventPatterns on AttendanceAnomalyEvent {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AttendanceAnomalyEvent value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AttendanceAnomalyEvent() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AttendanceAnomalyEvent value)  $default,){
final _that = this;
switch (_that) {
case _AttendanceAnomalyEvent():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AttendanceAnomalyEvent value)?  $default,){
final _that = this;
switch (_that) {
case _AttendanceAnomalyEvent() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sessionId,  String studentId,  String? studentName,  String? studentNumber,  double? latitude,  double? longitude,  double? distanceMeters,  double? geofenceRadiusMeters,  String reason,  String timestamp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AttendanceAnomalyEvent() when $default != null:
return $default(_that.sessionId,_that.studentId,_that.studentName,_that.studentNumber,_that.latitude,_that.longitude,_that.distanceMeters,_that.geofenceRadiusMeters,_that.reason,_that.timestamp);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sessionId,  String studentId,  String? studentName,  String? studentNumber,  double? latitude,  double? longitude,  double? distanceMeters,  double? geofenceRadiusMeters,  String reason,  String timestamp)  $default,) {final _that = this;
switch (_that) {
case _AttendanceAnomalyEvent():
return $default(_that.sessionId,_that.studentId,_that.studentName,_that.studentNumber,_that.latitude,_that.longitude,_that.distanceMeters,_that.geofenceRadiusMeters,_that.reason,_that.timestamp);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sessionId,  String studentId,  String? studentName,  String? studentNumber,  double? latitude,  double? longitude,  double? distanceMeters,  double? geofenceRadiusMeters,  String reason,  String timestamp)?  $default,) {final _that = this;
switch (_that) {
case _AttendanceAnomalyEvent() when $default != null:
return $default(_that.sessionId,_that.studentId,_that.studentName,_that.studentNumber,_that.latitude,_that.longitude,_that.distanceMeters,_that.geofenceRadiusMeters,_that.reason,_that.timestamp);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AttendanceAnomalyEvent implements AttendanceAnomalyEvent {
  const _AttendanceAnomalyEvent({required this.sessionId, required this.studentId, this.studentName, this.studentNumber, required this.latitude, required this.longitude, this.distanceMeters, this.geofenceRadiusMeters, required this.reason, required this.timestamp});
  factory _AttendanceAnomalyEvent.fromJson(Map<String, dynamic> json) => _$AttendanceAnomalyEventFromJson(json);

@override final  String sessionId;
@override final  String studentId;
@override final  String? studentName;
@override final  String? studentNumber;
@override final  double? latitude;
@override final  double? longitude;
@override final  double? distanceMeters;
@override final  double? geofenceRadiusMeters;
@override final  String reason;
@override final  String timestamp;

/// Create a copy of AttendanceAnomalyEvent
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AttendanceAnomalyEventCopyWith<_AttendanceAnomalyEvent> get copyWith => __$AttendanceAnomalyEventCopyWithImpl<_AttendanceAnomalyEvent>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AttendanceAnomalyEventToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AttendanceAnomalyEvent&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentNumber, studentNumber) || other.studentNumber == studentNumber)&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.geofenceRadiusMeters, geofenceRadiusMeters) || other.geofenceRadiusMeters == geofenceRadiusMeters)&&(identical(other.reason, reason) || other.reason == reason)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sessionId,studentId,studentName,studentNumber,latitude,longitude,distanceMeters,geofenceRadiusMeters,reason,timestamp);

@override
String toString() {
  return 'AttendanceAnomalyEvent(sessionId: $sessionId, studentId: $studentId, studentName: $studentName, studentNumber: $studentNumber, latitude: $latitude, longitude: $longitude, distanceMeters: $distanceMeters, geofenceRadiusMeters: $geofenceRadiusMeters, reason: $reason, timestamp: $timestamp)';
}


}

/// @nodoc
abstract mixin class _$AttendanceAnomalyEventCopyWith<$Res> implements $AttendanceAnomalyEventCopyWith<$Res> {
  factory _$AttendanceAnomalyEventCopyWith(_AttendanceAnomalyEvent value, $Res Function(_AttendanceAnomalyEvent) _then) = __$AttendanceAnomalyEventCopyWithImpl;
@override @useResult
$Res call({
 String sessionId, String studentId, String? studentName, String? studentNumber, double? latitude, double? longitude, double? distanceMeters, double? geofenceRadiusMeters, String reason, String timestamp
});




}
/// @nodoc
class __$AttendanceAnomalyEventCopyWithImpl<$Res>
    implements _$AttendanceAnomalyEventCopyWith<$Res> {
  __$AttendanceAnomalyEventCopyWithImpl(this._self, this._then);

  final _AttendanceAnomalyEvent _self;
  final $Res Function(_AttendanceAnomalyEvent) _then;

/// Create a copy of AttendanceAnomalyEvent
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sessionId = null,Object? studentId = null,Object? studentName = freezed,Object? studentNumber = freezed,Object? latitude = freezed,Object? longitude = freezed,Object? distanceMeters = freezed,Object? geofenceRadiusMeters = freezed,Object? reason = null,Object? timestamp = null,}) {
  return _then(_AttendanceAnomalyEvent(
sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: freezed == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String?,studentNumber: freezed == studentNumber ? _self.studentNumber : studentNumber // ignore: cast_nullable_to_non_nullable
as String?,latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,geofenceRadiusMeters: freezed == geofenceRadiusMeters ? _self.geofenceRadiusMeters : geofenceRadiusMeters // ignore: cast_nullable_to_non_nullable
as double?,reason: null == reason ? _self.reason : reason // ignore: cast_nullable_to_non_nullable
as String,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ScanAttemptView {

 String get id; String get sessionId; String get studentId; String get studentName; String? get studentNumber; String get timestamp; String? get clientScannedAt; String get receivedAt; AttendanceCoordinates get coordinates; double? get accuracyMeters; double? get distanceMeters; double? get geofenceRadiusMeters; ScanAttemptOutcome get outcome; String? get denialReason; bool? get mocked; bool? get pinVerified; bool? get offline; String? get inputChannel; String? get checkpoint; String? get deviceIdMasked;
/// Create a copy of ScanAttemptView
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ScanAttemptViewCopyWith<ScanAttemptView> get copyWith => _$ScanAttemptViewCopyWithImpl<ScanAttemptView>(this as ScanAttemptView, _$identity);

  /// Serializes this ScanAttemptView to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ScanAttemptView&&(identical(other.id, id) || other.id == id)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentNumber, studentNumber) || other.studentNumber == studentNumber)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.clientScannedAt, clientScannedAt) || other.clientScannedAt == clientScannedAt)&&(identical(other.receivedAt, receivedAt) || other.receivedAt == receivedAt)&&(identical(other.coordinates, coordinates) || other.coordinates == coordinates)&&(identical(other.accuracyMeters, accuracyMeters) || other.accuracyMeters == accuracyMeters)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.geofenceRadiusMeters, geofenceRadiusMeters) || other.geofenceRadiusMeters == geofenceRadiusMeters)&&(identical(other.outcome, outcome) || other.outcome == outcome)&&(identical(other.denialReason, denialReason) || other.denialReason == denialReason)&&(identical(other.mocked, mocked) || other.mocked == mocked)&&(identical(other.pinVerified, pinVerified) || other.pinVerified == pinVerified)&&(identical(other.offline, offline) || other.offline == offline)&&(identical(other.inputChannel, inputChannel) || other.inputChannel == inputChannel)&&(identical(other.checkpoint, checkpoint) || other.checkpoint == checkpoint)&&(identical(other.deviceIdMasked, deviceIdMasked) || other.deviceIdMasked == deviceIdMasked));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,sessionId,studentId,studentName,studentNumber,timestamp,clientScannedAt,receivedAt,coordinates,accuracyMeters,distanceMeters,geofenceRadiusMeters,outcome,denialReason,mocked,pinVerified,offline,inputChannel,checkpoint,deviceIdMasked]);

@override
String toString() {
  return 'ScanAttemptView(id: $id, sessionId: $sessionId, studentId: $studentId, studentName: $studentName, studentNumber: $studentNumber, timestamp: $timestamp, clientScannedAt: $clientScannedAt, receivedAt: $receivedAt, coordinates: $coordinates, accuracyMeters: $accuracyMeters, distanceMeters: $distanceMeters, geofenceRadiusMeters: $geofenceRadiusMeters, outcome: $outcome, denialReason: $denialReason, mocked: $mocked, pinVerified: $pinVerified, offline: $offline, inputChannel: $inputChannel, checkpoint: $checkpoint, deviceIdMasked: $deviceIdMasked)';
}


}

/// @nodoc
abstract mixin class $ScanAttemptViewCopyWith<$Res>  {
  factory $ScanAttemptViewCopyWith(ScanAttemptView value, $Res Function(ScanAttemptView) _then) = _$ScanAttemptViewCopyWithImpl;
@useResult
$Res call({
 String id, String sessionId, String studentId, String studentName, String? studentNumber, String timestamp, String? clientScannedAt, String receivedAt, AttendanceCoordinates coordinates, double? accuracyMeters, double? distanceMeters, double? geofenceRadiusMeters, ScanAttemptOutcome outcome, String? denialReason, bool? mocked, bool? pinVerified, bool? offline, String? inputChannel, String? checkpoint, String? deviceIdMasked
});


$AttendanceCoordinatesCopyWith<$Res> get coordinates;

}
/// @nodoc
class _$ScanAttemptViewCopyWithImpl<$Res>
    implements $ScanAttemptViewCopyWith<$Res> {
  _$ScanAttemptViewCopyWithImpl(this._self, this._then);

  final ScanAttemptView _self;
  final $Res Function(ScanAttemptView) _then;

/// Create a copy of ScanAttemptView
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? sessionId = null,Object? studentId = null,Object? studentName = null,Object? studentNumber = freezed,Object? timestamp = null,Object? clientScannedAt = freezed,Object? receivedAt = null,Object? coordinates = null,Object? accuracyMeters = freezed,Object? distanceMeters = freezed,Object? geofenceRadiusMeters = freezed,Object? outcome = null,Object? denialReason = freezed,Object? mocked = freezed,Object? pinVerified = freezed,Object? offline = freezed,Object? inputChannel = freezed,Object? checkpoint = freezed,Object? deviceIdMasked = freezed,}) {
  return _then(ScanAttemptView(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,studentNumber: freezed == studentNumber ? _self.studentNumber : studentNumber // ignore: cast_nullable_to_non_nullable
as String?,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,clientScannedAt: freezed == clientScannedAt ? _self.clientScannedAt : clientScannedAt // ignore: cast_nullable_to_non_nullable
as String?,receivedAt: null == receivedAt ? _self.receivedAt : receivedAt // ignore: cast_nullable_to_non_nullable
as String,coordinates: null == coordinates ? _self.coordinates : coordinates // ignore: cast_nullable_to_non_nullable
as AttendanceCoordinates,accuracyMeters: freezed == accuracyMeters ? _self.accuracyMeters : accuracyMeters // ignore: cast_nullable_to_non_nullable
as double?,distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,geofenceRadiusMeters: freezed == geofenceRadiusMeters ? _self.geofenceRadiusMeters : geofenceRadiusMeters // ignore: cast_nullable_to_non_nullable
as double?,outcome: null == outcome ? _self.outcome : outcome // ignore: cast_nullable_to_non_nullable
as ScanAttemptOutcome,denialReason: freezed == denialReason ? _self.denialReason : denialReason // ignore: cast_nullable_to_non_nullable
as String?,mocked: freezed == mocked ? _self.mocked : mocked // ignore: cast_nullable_to_non_nullable
as bool?,pinVerified: freezed == pinVerified ? _self.pinVerified : pinVerified // ignore: cast_nullable_to_non_nullable
as bool?,offline: freezed == offline ? _self.offline : offline // ignore: cast_nullable_to_non_nullable
as bool?,inputChannel: freezed == inputChannel ? _self.inputChannel : inputChannel // ignore: cast_nullable_to_non_nullable
as String?,checkpoint: freezed == checkpoint ? _self.checkpoint : checkpoint // ignore: cast_nullable_to_non_nullable
as String?,deviceIdMasked: freezed == deviceIdMasked ? _self.deviceIdMasked : deviceIdMasked // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of ScanAttemptView
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AttendanceCoordinatesCopyWith<$Res> get coordinates {
  
  return $AttendanceCoordinatesCopyWith<$Res>(_self.coordinates, (value) {
    return _then(_self.copyWith(coordinates: value));
  });
}
}


/// Adds pattern-matching-related methods to [ScanAttemptView].
extension ScanAttemptViewPatterns on ScanAttemptView {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ScanAttemptView value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ScanAttemptView() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ScanAttemptView value)  $default,){
final _that = this;
switch (_that) {
case _ScanAttemptView():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ScanAttemptView value)?  $default,){
final _that = this;
switch (_that) {
case _ScanAttemptView() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String sessionId,  String studentId,  String studentName,  String? studentNumber,  String timestamp,  String? clientScannedAt,  String receivedAt,  AttendanceCoordinates coordinates,  double? accuracyMeters,  double? distanceMeters,  double? geofenceRadiusMeters,  ScanAttemptOutcome outcome,  String? denialReason,  bool? mocked,  bool? pinVerified,  bool? offline,  String? inputChannel,  String? checkpoint,  String? deviceIdMasked)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ScanAttemptView() when $default != null:
return $default(_that.id,_that.sessionId,_that.studentId,_that.studentName,_that.studentNumber,_that.timestamp,_that.clientScannedAt,_that.receivedAt,_that.coordinates,_that.accuracyMeters,_that.distanceMeters,_that.geofenceRadiusMeters,_that.outcome,_that.denialReason,_that.mocked,_that.pinVerified,_that.offline,_that.inputChannel,_that.checkpoint,_that.deviceIdMasked);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String sessionId,  String studentId,  String studentName,  String? studentNumber,  String timestamp,  String? clientScannedAt,  String receivedAt,  AttendanceCoordinates coordinates,  double? accuracyMeters,  double? distanceMeters,  double? geofenceRadiusMeters,  ScanAttemptOutcome outcome,  String? denialReason,  bool? mocked,  bool? pinVerified,  bool? offline,  String? inputChannel,  String? checkpoint,  String? deviceIdMasked)  $default,) {final _that = this;
switch (_that) {
case _ScanAttemptView():
return $default(_that.id,_that.sessionId,_that.studentId,_that.studentName,_that.studentNumber,_that.timestamp,_that.clientScannedAt,_that.receivedAt,_that.coordinates,_that.accuracyMeters,_that.distanceMeters,_that.geofenceRadiusMeters,_that.outcome,_that.denialReason,_that.mocked,_that.pinVerified,_that.offline,_that.inputChannel,_that.checkpoint,_that.deviceIdMasked);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String sessionId,  String studentId,  String studentName,  String? studentNumber,  String timestamp,  String? clientScannedAt,  String receivedAt,  AttendanceCoordinates coordinates,  double? accuracyMeters,  double? distanceMeters,  double? geofenceRadiusMeters,  ScanAttemptOutcome outcome,  String? denialReason,  bool? mocked,  bool? pinVerified,  bool? offline,  String? inputChannel,  String? checkpoint,  String? deviceIdMasked)?  $default,) {final _that = this;
switch (_that) {
case _ScanAttemptView() when $default != null:
return $default(_that.id,_that.sessionId,_that.studentId,_that.studentName,_that.studentNumber,_that.timestamp,_that.clientScannedAt,_that.receivedAt,_that.coordinates,_that.accuracyMeters,_that.distanceMeters,_that.geofenceRadiusMeters,_that.outcome,_that.denialReason,_that.mocked,_that.pinVerified,_that.offline,_that.inputChannel,_that.checkpoint,_that.deviceIdMasked);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ScanAttemptOutcomeConverter()])
class _ScanAttemptView implements ScanAttemptView {
  const _ScanAttemptView({required this.id, required this.sessionId, required this.studentId, this.studentName = '', this.studentNumber, required this.timestamp, this.clientScannedAt, required this.receivedAt, this.coordinates = const AttendanceCoordinates(latitude: null, longitude: null), this.accuracyMeters, this.distanceMeters, this.geofenceRadiusMeters, required this.outcome, this.denialReason, this.mocked, this.pinVerified, this.offline, this.inputChannel, this.checkpoint, this.deviceIdMasked});
  factory _ScanAttemptView.fromJson(Map<String, dynamic> json) => _$ScanAttemptViewFromJson(json);

@override final  String id;
@override final  String sessionId;
@override final  String studentId;
@override@JsonKey() final  String studentName;
@override final  String? studentNumber;
@override final  String timestamp;
@override final  String? clientScannedAt;
@override final  String receivedAt;
@override@JsonKey() final  AttendanceCoordinates coordinates;
@override final  double? accuracyMeters;
@override final  double? distanceMeters;
@override final  double? geofenceRadiusMeters;
@override final  ScanAttemptOutcome outcome;
@override final  String? denialReason;
@override final  bool? mocked;
@override final  bool? pinVerified;
@override final  bool? offline;
@override final  String? inputChannel;
@override final  String? checkpoint;
@override final  String? deviceIdMasked;

/// Create a copy of ScanAttemptView
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ScanAttemptViewCopyWith<_ScanAttemptView> get copyWith => __$ScanAttemptViewCopyWithImpl<_ScanAttemptView>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ScanAttemptViewToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ScanAttemptView&&(identical(other.id, id) || other.id == id)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentNumber, studentNumber) || other.studentNumber == studentNumber)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.clientScannedAt, clientScannedAt) || other.clientScannedAt == clientScannedAt)&&(identical(other.receivedAt, receivedAt) || other.receivedAt == receivedAt)&&(identical(other.coordinates, coordinates) || other.coordinates == coordinates)&&(identical(other.accuracyMeters, accuracyMeters) || other.accuracyMeters == accuracyMeters)&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.geofenceRadiusMeters, geofenceRadiusMeters) || other.geofenceRadiusMeters == geofenceRadiusMeters)&&(identical(other.outcome, outcome) || other.outcome == outcome)&&(identical(other.denialReason, denialReason) || other.denialReason == denialReason)&&(identical(other.mocked, mocked) || other.mocked == mocked)&&(identical(other.pinVerified, pinVerified) || other.pinVerified == pinVerified)&&(identical(other.offline, offline) || other.offline == offline)&&(identical(other.inputChannel, inputChannel) || other.inputChannel == inputChannel)&&(identical(other.checkpoint, checkpoint) || other.checkpoint == checkpoint)&&(identical(other.deviceIdMasked, deviceIdMasked) || other.deviceIdMasked == deviceIdMasked));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,sessionId,studentId,studentName,studentNumber,timestamp,clientScannedAt,receivedAt,coordinates,accuracyMeters,distanceMeters,geofenceRadiusMeters,outcome,denialReason,mocked,pinVerified,offline,inputChannel,checkpoint,deviceIdMasked]);

@override
String toString() {
  return 'ScanAttemptView(id: $id, sessionId: $sessionId, studentId: $studentId, studentName: $studentName, studentNumber: $studentNumber, timestamp: $timestamp, clientScannedAt: $clientScannedAt, receivedAt: $receivedAt, coordinates: $coordinates, accuracyMeters: $accuracyMeters, distanceMeters: $distanceMeters, geofenceRadiusMeters: $geofenceRadiusMeters, outcome: $outcome, denialReason: $denialReason, mocked: $mocked, pinVerified: $pinVerified, offline: $offline, inputChannel: $inputChannel, checkpoint: $checkpoint, deviceIdMasked: $deviceIdMasked)';
}


}

/// @nodoc
abstract mixin class _$ScanAttemptViewCopyWith<$Res> implements $ScanAttemptViewCopyWith<$Res> {
  factory _$ScanAttemptViewCopyWith(_ScanAttemptView value, $Res Function(_ScanAttemptView) _then) = __$ScanAttemptViewCopyWithImpl;
@override @useResult
$Res call({
 String id, String sessionId, String studentId, String studentName, String? studentNumber, String timestamp, String? clientScannedAt, String receivedAt, AttendanceCoordinates coordinates, double? accuracyMeters, double? distanceMeters, double? geofenceRadiusMeters, ScanAttemptOutcome outcome, String? denialReason, bool? mocked, bool? pinVerified, bool? offline, String? inputChannel, String? checkpoint, String? deviceIdMasked
});


@override $AttendanceCoordinatesCopyWith<$Res> get coordinates;

}
/// @nodoc
class __$ScanAttemptViewCopyWithImpl<$Res>
    implements _$ScanAttemptViewCopyWith<$Res> {
  __$ScanAttemptViewCopyWithImpl(this._self, this._then);

  final _ScanAttemptView _self;
  final $Res Function(_ScanAttemptView) _then;

/// Create a copy of ScanAttemptView
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? sessionId = null,Object? studentId = null,Object? studentName = null,Object? studentNumber = freezed,Object? timestamp = null,Object? clientScannedAt = freezed,Object? receivedAt = null,Object? coordinates = null,Object? accuracyMeters = freezed,Object? distanceMeters = freezed,Object? geofenceRadiusMeters = freezed,Object? outcome = null,Object? denialReason = freezed,Object? mocked = freezed,Object? pinVerified = freezed,Object? offline = freezed,Object? inputChannel = freezed,Object? checkpoint = freezed,Object? deviceIdMasked = freezed,}) {
  return _then(_ScanAttemptView(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,studentNumber: freezed == studentNumber ? _self.studentNumber : studentNumber // ignore: cast_nullable_to_non_nullable
as String?,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,clientScannedAt: freezed == clientScannedAt ? _self.clientScannedAt : clientScannedAt // ignore: cast_nullable_to_non_nullable
as String?,receivedAt: null == receivedAt ? _self.receivedAt : receivedAt // ignore: cast_nullable_to_non_nullable
as String,coordinates: null == coordinates ? _self.coordinates : coordinates // ignore: cast_nullable_to_non_nullable
as AttendanceCoordinates,accuracyMeters: freezed == accuracyMeters ? _self.accuracyMeters : accuracyMeters // ignore: cast_nullable_to_non_nullable
as double?,distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,geofenceRadiusMeters: freezed == geofenceRadiusMeters ? _self.geofenceRadiusMeters : geofenceRadiusMeters // ignore: cast_nullable_to_non_nullable
as double?,outcome: null == outcome ? _self.outcome : outcome // ignore: cast_nullable_to_non_nullable
as ScanAttemptOutcome,denialReason: freezed == denialReason ? _self.denialReason : denialReason // ignore: cast_nullable_to_non_nullable
as String?,mocked: freezed == mocked ? _self.mocked : mocked // ignore: cast_nullable_to_non_nullable
as bool?,pinVerified: freezed == pinVerified ? _self.pinVerified : pinVerified // ignore: cast_nullable_to_non_nullable
as bool?,offline: freezed == offline ? _self.offline : offline // ignore: cast_nullable_to_non_nullable
as bool?,inputChannel: freezed == inputChannel ? _self.inputChannel : inputChannel // ignore: cast_nullable_to_non_nullable
as String?,checkpoint: freezed == checkpoint ? _self.checkpoint : checkpoint // ignore: cast_nullable_to_non_nullable
as String?,deviceIdMasked: freezed == deviceIdMasked ? _self.deviceIdMasked : deviceIdMasked // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of ScanAttemptView
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AttendanceCoordinatesCopyWith<$Res> get coordinates {
  
  return $AttendanceCoordinatesCopyWith<$Res>(_self.coordinates, (value) {
    return _then(_self.copyWith(coordinates: value));
  });
}
}


/// @nodoc
mixin _$RecordTimelineEventDetail {

 double? get distanceMeters; double? get radiusMeters; bool? get insideGeofence; bool? get mocked; bool? get pinVerified; String? get channel; String? get deviceIdMasked; String? get receiptId;
/// Create a copy of RecordTimelineEventDetail
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RecordTimelineEventDetailCopyWith<RecordTimelineEventDetail> get copyWith => _$RecordTimelineEventDetailCopyWithImpl<RecordTimelineEventDetail>(this as RecordTimelineEventDetail, _$identity);

  /// Serializes this RecordTimelineEventDetail to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RecordTimelineEventDetail&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.radiusMeters, radiusMeters) || other.radiusMeters == radiusMeters)&&(identical(other.insideGeofence, insideGeofence) || other.insideGeofence == insideGeofence)&&(identical(other.mocked, mocked) || other.mocked == mocked)&&(identical(other.pinVerified, pinVerified) || other.pinVerified == pinVerified)&&(identical(other.channel, channel) || other.channel == channel)&&(identical(other.deviceIdMasked, deviceIdMasked) || other.deviceIdMasked == deviceIdMasked)&&(identical(other.receiptId, receiptId) || other.receiptId == receiptId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,distanceMeters,radiusMeters,insideGeofence,mocked,pinVerified,channel,deviceIdMasked,receiptId);

@override
String toString() {
  return 'RecordTimelineEventDetail(distanceMeters: $distanceMeters, radiusMeters: $radiusMeters, insideGeofence: $insideGeofence, mocked: $mocked, pinVerified: $pinVerified, channel: $channel, deviceIdMasked: $deviceIdMasked, receiptId: $receiptId)';
}


}

/// @nodoc
abstract mixin class $RecordTimelineEventDetailCopyWith<$Res>  {
  factory $RecordTimelineEventDetailCopyWith(RecordTimelineEventDetail value, $Res Function(RecordTimelineEventDetail) _then) = _$RecordTimelineEventDetailCopyWithImpl;
@useResult
$Res call({
 double? distanceMeters, double? radiusMeters, bool? insideGeofence, bool? mocked, bool? pinVerified, String? channel, String? deviceIdMasked, String? receiptId
});




}
/// @nodoc
class _$RecordTimelineEventDetailCopyWithImpl<$Res>
    implements $RecordTimelineEventDetailCopyWith<$Res> {
  _$RecordTimelineEventDetailCopyWithImpl(this._self, this._then);

  final RecordTimelineEventDetail _self;
  final $Res Function(RecordTimelineEventDetail) _then;

/// Create a copy of RecordTimelineEventDetail
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? distanceMeters = freezed,Object? radiusMeters = freezed,Object? insideGeofence = freezed,Object? mocked = freezed,Object? pinVerified = freezed,Object? channel = freezed,Object? deviceIdMasked = freezed,Object? receiptId = freezed,}) {
  return _then(RecordTimelineEventDetail(
distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,radiusMeters: freezed == radiusMeters ? _self.radiusMeters : radiusMeters // ignore: cast_nullable_to_non_nullable
as double?,insideGeofence: freezed == insideGeofence ? _self.insideGeofence : insideGeofence // ignore: cast_nullable_to_non_nullable
as bool?,mocked: freezed == mocked ? _self.mocked : mocked // ignore: cast_nullable_to_non_nullable
as bool?,pinVerified: freezed == pinVerified ? _self.pinVerified : pinVerified // ignore: cast_nullable_to_non_nullable
as bool?,channel: freezed == channel ? _self.channel : channel // ignore: cast_nullable_to_non_nullable
as String?,deviceIdMasked: freezed == deviceIdMasked ? _self.deviceIdMasked : deviceIdMasked // ignore: cast_nullable_to_non_nullable
as String?,receiptId: freezed == receiptId ? _self.receiptId : receiptId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [RecordTimelineEventDetail].
extension RecordTimelineEventDetailPatterns on RecordTimelineEventDetail {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RecordTimelineEventDetail value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RecordTimelineEventDetail() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RecordTimelineEventDetail value)  $default,){
final _that = this;
switch (_that) {
case _RecordTimelineEventDetail():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RecordTimelineEventDetail value)?  $default,){
final _that = this;
switch (_that) {
case _RecordTimelineEventDetail() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( double? distanceMeters,  double? radiusMeters,  bool? insideGeofence,  bool? mocked,  bool? pinVerified,  String? channel,  String? deviceIdMasked,  String? receiptId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RecordTimelineEventDetail() when $default != null:
return $default(_that.distanceMeters,_that.radiusMeters,_that.insideGeofence,_that.mocked,_that.pinVerified,_that.channel,_that.deviceIdMasked,_that.receiptId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( double? distanceMeters,  double? radiusMeters,  bool? insideGeofence,  bool? mocked,  bool? pinVerified,  String? channel,  String? deviceIdMasked,  String? receiptId)  $default,) {final _that = this;
switch (_that) {
case _RecordTimelineEventDetail():
return $default(_that.distanceMeters,_that.radiusMeters,_that.insideGeofence,_that.mocked,_that.pinVerified,_that.channel,_that.deviceIdMasked,_that.receiptId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( double? distanceMeters,  double? radiusMeters,  bool? insideGeofence,  bool? mocked,  bool? pinVerified,  String? channel,  String? deviceIdMasked,  String? receiptId)?  $default,) {final _that = this;
switch (_that) {
case _RecordTimelineEventDetail() when $default != null:
return $default(_that.distanceMeters,_that.radiusMeters,_that.insideGeofence,_that.mocked,_that.pinVerified,_that.channel,_that.deviceIdMasked,_that.receiptId);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _RecordTimelineEventDetail implements RecordTimelineEventDetail {
  const _RecordTimelineEventDetail({this.distanceMeters, this.radiusMeters, this.insideGeofence, this.mocked, this.pinVerified, this.channel, this.deviceIdMasked, this.receiptId});
  factory _RecordTimelineEventDetail.fromJson(Map<String, dynamic> json) => _$RecordTimelineEventDetailFromJson(json);

@override final  double? distanceMeters;
@override final  double? radiusMeters;
@override final  bool? insideGeofence;
@override final  bool? mocked;
@override final  bool? pinVerified;
@override final  String? channel;
@override final  String? deviceIdMasked;
@override final  String? receiptId;

/// Create a copy of RecordTimelineEventDetail
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RecordTimelineEventDetailCopyWith<_RecordTimelineEventDetail> get copyWith => __$RecordTimelineEventDetailCopyWithImpl<_RecordTimelineEventDetail>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RecordTimelineEventDetailToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RecordTimelineEventDetail&&(identical(other.distanceMeters, distanceMeters) || other.distanceMeters == distanceMeters)&&(identical(other.radiusMeters, radiusMeters) || other.radiusMeters == radiusMeters)&&(identical(other.insideGeofence, insideGeofence) || other.insideGeofence == insideGeofence)&&(identical(other.mocked, mocked) || other.mocked == mocked)&&(identical(other.pinVerified, pinVerified) || other.pinVerified == pinVerified)&&(identical(other.channel, channel) || other.channel == channel)&&(identical(other.deviceIdMasked, deviceIdMasked) || other.deviceIdMasked == deviceIdMasked)&&(identical(other.receiptId, receiptId) || other.receiptId == receiptId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,distanceMeters,radiusMeters,insideGeofence,mocked,pinVerified,channel,deviceIdMasked,receiptId);

@override
String toString() {
  return 'RecordTimelineEventDetail(distanceMeters: $distanceMeters, radiusMeters: $radiusMeters, insideGeofence: $insideGeofence, mocked: $mocked, pinVerified: $pinVerified, channel: $channel, deviceIdMasked: $deviceIdMasked, receiptId: $receiptId)';
}


}

/// @nodoc
abstract mixin class _$RecordTimelineEventDetailCopyWith<$Res> implements $RecordTimelineEventDetailCopyWith<$Res> {
  factory _$RecordTimelineEventDetailCopyWith(_RecordTimelineEventDetail value, $Res Function(_RecordTimelineEventDetail) _then) = __$RecordTimelineEventDetailCopyWithImpl;
@override @useResult
$Res call({
 double? distanceMeters, double? radiusMeters, bool? insideGeofence, bool? mocked, bool? pinVerified, String? channel, String? deviceIdMasked, String? receiptId
});




}
/// @nodoc
class __$RecordTimelineEventDetailCopyWithImpl<$Res>
    implements _$RecordTimelineEventDetailCopyWith<$Res> {
  __$RecordTimelineEventDetailCopyWithImpl(this._self, this._then);

  final _RecordTimelineEventDetail _self;
  final $Res Function(_RecordTimelineEventDetail) _then;

/// Create a copy of RecordTimelineEventDetail
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? distanceMeters = freezed,Object? radiusMeters = freezed,Object? insideGeofence = freezed,Object? mocked = freezed,Object? pinVerified = freezed,Object? channel = freezed,Object? deviceIdMasked = freezed,Object? receiptId = freezed,}) {
  return _then(_RecordTimelineEventDetail(
distanceMeters: freezed == distanceMeters ? _self.distanceMeters : distanceMeters // ignore: cast_nullable_to_non_nullable
as double?,radiusMeters: freezed == radiusMeters ? _self.radiusMeters : radiusMeters // ignore: cast_nullable_to_non_nullable
as double?,insideGeofence: freezed == insideGeofence ? _self.insideGeofence : insideGeofence // ignore: cast_nullable_to_non_nullable
as bool?,mocked: freezed == mocked ? _self.mocked : mocked // ignore: cast_nullable_to_non_nullable
as bool?,pinVerified: freezed == pinVerified ? _self.pinVerified : pinVerified // ignore: cast_nullable_to_non_nullable
as bool?,channel: freezed == channel ? _self.channel : channel // ignore: cast_nullable_to_non_nullable
as String?,deviceIdMasked: freezed == deviceIdMasked ? _self.deviceIdMasked : deviceIdMasked // ignore: cast_nullable_to_non_nullable
as String?,receiptId: freezed == receiptId ? _self.receiptId : receiptId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$RecordTimelineEvent {

 RecordTimelineEventKind get kind; String get at; String get label; RecordTimelineEventSource get source; RecordTimelineEventDetail? get detail;
/// Create a copy of RecordTimelineEvent
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RecordTimelineEventCopyWith<RecordTimelineEvent> get copyWith => _$RecordTimelineEventCopyWithImpl<RecordTimelineEvent>(this as RecordTimelineEvent, _$identity);

  /// Serializes this RecordTimelineEvent to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RecordTimelineEvent&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.at, at) || other.at == at)&&(identical(other.label, label) || other.label == label)&&(identical(other.source, source) || other.source == source)&&(identical(other.detail, detail) || other.detail == detail));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,kind,at,label,source,detail);

@override
String toString() {
  return 'RecordTimelineEvent(kind: $kind, at: $at, label: $label, source: $source, detail: $detail)';
}


}

/// @nodoc
abstract mixin class $RecordTimelineEventCopyWith<$Res>  {
  factory $RecordTimelineEventCopyWith(RecordTimelineEvent value, $Res Function(RecordTimelineEvent) _then) = _$RecordTimelineEventCopyWithImpl;
@useResult
$Res call({
 RecordTimelineEventKind kind, String at, String label, RecordTimelineEventSource source, RecordTimelineEventDetail? detail
});


$RecordTimelineEventDetailCopyWith<$Res>? get detail;

}
/// @nodoc
class _$RecordTimelineEventCopyWithImpl<$Res>
    implements $RecordTimelineEventCopyWith<$Res> {
  _$RecordTimelineEventCopyWithImpl(this._self, this._then);

  final RecordTimelineEvent _self;
  final $Res Function(RecordTimelineEvent) _then;

/// Create a copy of RecordTimelineEvent
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? kind = null,Object? at = null,Object? label = null,Object? source = null,Object? detail = freezed,}) {
  return _then(RecordTimelineEvent(
kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as RecordTimelineEventKind,at: null == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as String,label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,source: null == source ? _self.source : source // ignore: cast_nullable_to_non_nullable
as RecordTimelineEventSource,detail: freezed == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as RecordTimelineEventDetail?,
  ));
}
/// Create a copy of RecordTimelineEvent
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RecordTimelineEventDetailCopyWith<$Res>? get detail {
    if (_self.detail == null) {
    return null;
  }

  return $RecordTimelineEventDetailCopyWith<$Res>(_self.detail!, (value) {
    return _then(_self.copyWith(detail: value));
  });
}
}


/// Adds pattern-matching-related methods to [RecordTimelineEvent].
extension RecordTimelineEventPatterns on RecordTimelineEvent {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RecordTimelineEvent value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RecordTimelineEvent() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RecordTimelineEvent value)  $default,){
final _that = this;
switch (_that) {
case _RecordTimelineEvent():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RecordTimelineEvent value)?  $default,){
final _that = this;
switch (_that) {
case _RecordTimelineEvent() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( RecordTimelineEventKind kind,  String at,  String label,  RecordTimelineEventSource source,  RecordTimelineEventDetail? detail)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RecordTimelineEvent() when $default != null:
return $default(_that.kind,_that.at,_that.label,_that.source,_that.detail);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( RecordTimelineEventKind kind,  String at,  String label,  RecordTimelineEventSource source,  RecordTimelineEventDetail? detail)  $default,) {final _that = this;
switch (_that) {
case _RecordTimelineEvent():
return $default(_that.kind,_that.at,_that.label,_that.source,_that.detail);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( RecordTimelineEventKind kind,  String at,  String label,  RecordTimelineEventSource source,  RecordTimelineEventDetail? detail)?  $default,) {final _that = this;
switch (_that) {
case _RecordTimelineEvent() when $default != null:
return $default(_that.kind,_that.at,_that.label,_that.source,_that.detail);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [RecordTimelineEventKindConverter(), RecordTimelineEventSourceConverter()])
class _RecordTimelineEvent implements RecordTimelineEvent {
  const _RecordTimelineEvent({required this.kind, required this.at, required this.label, required this.source, this.detail});
  factory _RecordTimelineEvent.fromJson(Map<String, dynamic> json) => _$RecordTimelineEventFromJson(json);

@override final  RecordTimelineEventKind kind;
@override final  String at;
@override final  String label;
@override final  RecordTimelineEventSource source;
@override final  RecordTimelineEventDetail? detail;

/// Create a copy of RecordTimelineEvent
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RecordTimelineEventCopyWith<_RecordTimelineEvent> get copyWith => __$RecordTimelineEventCopyWithImpl<_RecordTimelineEvent>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RecordTimelineEventToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RecordTimelineEvent&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.at, at) || other.at == at)&&(identical(other.label, label) || other.label == label)&&(identical(other.source, source) || other.source == source)&&(identical(other.detail, detail) || other.detail == detail));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,kind,at,label,source,detail);

@override
String toString() {
  return 'RecordTimelineEvent(kind: $kind, at: $at, label: $label, source: $source, detail: $detail)';
}


}

/// @nodoc
abstract mixin class _$RecordTimelineEventCopyWith<$Res> implements $RecordTimelineEventCopyWith<$Res> {
  factory _$RecordTimelineEventCopyWith(_RecordTimelineEvent value, $Res Function(_RecordTimelineEvent) _then) = __$RecordTimelineEventCopyWithImpl;
@override @useResult
$Res call({
 RecordTimelineEventKind kind, String at, String label, RecordTimelineEventSource source, RecordTimelineEventDetail? detail
});


@override $RecordTimelineEventDetailCopyWith<$Res>? get detail;

}
/// @nodoc
class __$RecordTimelineEventCopyWithImpl<$Res>
    implements _$RecordTimelineEventCopyWith<$Res> {
  __$RecordTimelineEventCopyWithImpl(this._self, this._then);

  final _RecordTimelineEvent _self;
  final $Res Function(_RecordTimelineEvent) _then;

/// Create a copy of RecordTimelineEvent
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? kind = null,Object? at = null,Object? label = null,Object? source = null,Object? detail = freezed,}) {
  return _then(_RecordTimelineEvent(
kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as RecordTimelineEventKind,at: null == at ? _self.at : at // ignore: cast_nullable_to_non_nullable
as String,label: null == label ? _self.label : label // ignore: cast_nullable_to_non_nullable
as String,source: null == source ? _self.source : source // ignore: cast_nullable_to_non_nullable
as RecordTimelineEventSource,detail: freezed == detail ? _self.detail : detail // ignore: cast_nullable_to_non_nullable
as RecordTimelineEventDetail?,
  ));
}

/// Create a copy of RecordTimelineEvent
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RecordTimelineEventDetailCopyWith<$Res>? get detail {
    if (_self.detail == null) {
    return null;
  }

  return $RecordTimelineEventDetailCopyWith<$Res>(_self.detail!, (value) {
    return _then(_self.copyWith(detail: value));
  });
}
}


/// @nodoc
mixin _$DisputeRecommendation {

 DisputeRecommendationVerdict get verdict; String get rationale;
/// Create a copy of DisputeRecommendation
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DisputeRecommendationCopyWith<DisputeRecommendation> get copyWith => _$DisputeRecommendationCopyWithImpl<DisputeRecommendation>(this as DisputeRecommendation, _$identity);

  /// Serializes this DisputeRecommendation to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DisputeRecommendation&&(identical(other.verdict, verdict) || other.verdict == verdict)&&(identical(other.rationale, rationale) || other.rationale == rationale));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,verdict,rationale);

@override
String toString() {
  return 'DisputeRecommendation(verdict: $verdict, rationale: $rationale)';
}


}

/// @nodoc
abstract mixin class $DisputeRecommendationCopyWith<$Res>  {
  factory $DisputeRecommendationCopyWith(DisputeRecommendation value, $Res Function(DisputeRecommendation) _then) = _$DisputeRecommendationCopyWithImpl;
@useResult
$Res call({
 DisputeRecommendationVerdict verdict, String rationale
});




}
/// @nodoc
class _$DisputeRecommendationCopyWithImpl<$Res>
    implements $DisputeRecommendationCopyWith<$Res> {
  _$DisputeRecommendationCopyWithImpl(this._self, this._then);

  final DisputeRecommendation _self;
  final $Res Function(DisputeRecommendation) _then;

/// Create a copy of DisputeRecommendation
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? verdict = null,Object? rationale = null,}) {
  return _then(DisputeRecommendation(
verdict: null == verdict ? _self.verdict : verdict // ignore: cast_nullable_to_non_nullable
as DisputeRecommendationVerdict,rationale: null == rationale ? _self.rationale : rationale // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [DisputeRecommendation].
extension DisputeRecommendationPatterns on DisputeRecommendation {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DisputeRecommendation value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DisputeRecommendation() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DisputeRecommendation value)  $default,){
final _that = this;
switch (_that) {
case _DisputeRecommendation():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DisputeRecommendation value)?  $default,){
final _that = this;
switch (_that) {
case _DisputeRecommendation() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( DisputeRecommendationVerdict verdict,  String rationale)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DisputeRecommendation() when $default != null:
return $default(_that.verdict,_that.rationale);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( DisputeRecommendationVerdict verdict,  String rationale)  $default,) {final _that = this;
switch (_that) {
case _DisputeRecommendation():
return $default(_that.verdict,_that.rationale);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( DisputeRecommendationVerdict verdict,  String rationale)?  $default,) {final _that = this;
switch (_that) {
case _DisputeRecommendation() when $default != null:
return $default(_that.verdict,_that.rationale);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [DisputeRecommendationVerdictConverter()])
class _DisputeRecommendation implements DisputeRecommendation {
  const _DisputeRecommendation({required this.verdict, required this.rationale});
  factory _DisputeRecommendation.fromJson(Map<String, dynamic> json) => _$DisputeRecommendationFromJson(json);

@override final  DisputeRecommendationVerdict verdict;
@override final  String rationale;

/// Create a copy of DisputeRecommendation
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DisputeRecommendationCopyWith<_DisputeRecommendation> get copyWith => __$DisputeRecommendationCopyWithImpl<_DisputeRecommendation>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DisputeRecommendationToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DisputeRecommendation&&(identical(other.verdict, verdict) || other.verdict == verdict)&&(identical(other.rationale, rationale) || other.rationale == rationale));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,verdict,rationale);

@override
String toString() {
  return 'DisputeRecommendation(verdict: $verdict, rationale: $rationale)';
}


}

/// @nodoc
abstract mixin class _$DisputeRecommendationCopyWith<$Res> implements $DisputeRecommendationCopyWith<$Res> {
  factory _$DisputeRecommendationCopyWith(_DisputeRecommendation value, $Res Function(_DisputeRecommendation) _then) = __$DisputeRecommendationCopyWithImpl;
@override @useResult
$Res call({
 DisputeRecommendationVerdict verdict, String rationale
});




}
/// @nodoc
class __$DisputeRecommendationCopyWithImpl<$Res>
    implements _$DisputeRecommendationCopyWith<$Res> {
  __$DisputeRecommendationCopyWithImpl(this._self, this._then);

  final _DisputeRecommendation _self;
  final $Res Function(_DisputeRecommendation) _then;

/// Create a copy of DisputeRecommendation
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? verdict = null,Object? rationale = null,}) {
  return _then(_DisputeRecommendation(
verdict: null == verdict ? _self.verdict : verdict // ignore: cast_nullable_to_non_nullable
as DisputeRecommendationVerdict,rationale: null == rationale ? _self.rationale : rationale // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$RecordTimeline {

 String get recordId; List<RecordTimelineEvent> get events; DisputeRecommendation get recommendation;
/// Create a copy of RecordTimeline
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RecordTimelineCopyWith<RecordTimeline> get copyWith => _$RecordTimelineCopyWithImpl<RecordTimeline>(this as RecordTimeline, _$identity);

  /// Serializes this RecordTimeline to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RecordTimeline&&(identical(other.recordId, recordId) || other.recordId == recordId)&&const DeepCollectionEquality().equals(other.events, events)&&(identical(other.recommendation, recommendation) || other.recommendation == recommendation));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,recordId,const DeepCollectionEquality().hash(events),recommendation);

@override
String toString() {
  return 'RecordTimeline(recordId: $recordId, events: $events, recommendation: $recommendation)';
}


}

/// @nodoc
abstract mixin class $RecordTimelineCopyWith<$Res>  {
  factory $RecordTimelineCopyWith(RecordTimeline value, $Res Function(RecordTimeline) _then) = _$RecordTimelineCopyWithImpl;
@useResult
$Res call({
 String recordId, List<RecordTimelineEvent> events, DisputeRecommendation recommendation
});


$DisputeRecommendationCopyWith<$Res> get recommendation;

}
/// @nodoc
class _$RecordTimelineCopyWithImpl<$Res>
    implements $RecordTimelineCopyWith<$Res> {
  _$RecordTimelineCopyWithImpl(this._self, this._then);

  final RecordTimeline _self;
  final $Res Function(RecordTimeline) _then;

/// Create a copy of RecordTimeline
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? recordId = null,Object? events = null,Object? recommendation = null,}) {
  return _then(RecordTimeline(
recordId: null == recordId ? _self.recordId : recordId // ignore: cast_nullable_to_non_nullable
as String,events: null == events ? _self.events : events // ignore: cast_nullable_to_non_nullable
as List<RecordTimelineEvent>,recommendation: null == recommendation ? _self.recommendation : recommendation // ignore: cast_nullable_to_non_nullable
as DisputeRecommendation,
  ));
}
/// Create a copy of RecordTimeline
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DisputeRecommendationCopyWith<$Res> get recommendation {
  
  return $DisputeRecommendationCopyWith<$Res>(_self.recommendation, (value) {
    return _then(_self.copyWith(recommendation: value));
  });
}
}


/// Adds pattern-matching-related methods to [RecordTimeline].
extension RecordTimelinePatterns on RecordTimeline {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RecordTimeline value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RecordTimeline() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RecordTimeline value)  $default,){
final _that = this;
switch (_that) {
case _RecordTimeline():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RecordTimeline value)?  $default,){
final _that = this;
switch (_that) {
case _RecordTimeline() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String recordId,  List<RecordTimelineEvent> events,  DisputeRecommendation recommendation)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RecordTimeline() when $default != null:
return $default(_that.recordId,_that.events,_that.recommendation);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String recordId,  List<RecordTimelineEvent> events,  DisputeRecommendation recommendation)  $default,) {final _that = this;
switch (_that) {
case _RecordTimeline():
return $default(_that.recordId,_that.events,_that.recommendation);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String recordId,  List<RecordTimelineEvent> events,  DisputeRecommendation recommendation)?  $default,) {final _that = this;
switch (_that) {
case _RecordTimeline() when $default != null:
return $default(_that.recordId,_that.events,_that.recommendation);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _RecordTimeline implements RecordTimeline {
  const _RecordTimeline({required this.recordId,  List<RecordTimelineEvent> events = const <RecordTimelineEvent>[], required this.recommendation}): _events = events;
  factory _RecordTimeline.fromJson(Map<String, dynamic> json) => _$RecordTimelineFromJson(json);

@override final  String recordId;
 final  List<RecordTimelineEvent> _events;
@override@JsonKey() List<RecordTimelineEvent> get events {
  if (_events is EqualUnmodifiableListView) return _events;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_events);
}

@override final  DisputeRecommendation recommendation;

/// Create a copy of RecordTimeline
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RecordTimelineCopyWith<_RecordTimeline> get copyWith => __$RecordTimelineCopyWithImpl<_RecordTimeline>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RecordTimelineToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RecordTimeline&&(identical(other.recordId, recordId) || other.recordId == recordId)&&const DeepCollectionEquality().equals(other._events, _events)&&(identical(other.recommendation, recommendation) || other.recommendation == recommendation));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,recordId,const DeepCollectionEquality().hash(_events),recommendation);

@override
String toString() {
  return 'RecordTimeline(recordId: $recordId, events: $events, recommendation: $recommendation)';
}


}

/// @nodoc
abstract mixin class _$RecordTimelineCopyWith<$Res> implements $RecordTimelineCopyWith<$Res> {
  factory _$RecordTimelineCopyWith(_RecordTimeline value, $Res Function(_RecordTimeline) _then) = __$RecordTimelineCopyWithImpl;
@override @useResult
$Res call({
 String recordId, List<RecordTimelineEvent> events, DisputeRecommendation recommendation
});


@override $DisputeRecommendationCopyWith<$Res> get recommendation;

}
/// @nodoc
class __$RecordTimelineCopyWithImpl<$Res>
    implements _$RecordTimelineCopyWith<$Res> {
  __$RecordTimelineCopyWithImpl(this._self, this._then);

  final _RecordTimeline _self;
  final $Res Function(_RecordTimeline) _then;

/// Create a copy of RecordTimeline
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? recordId = null,Object? events = null,Object? recommendation = null,}) {
  return _then(_RecordTimeline(
recordId: null == recordId ? _self.recordId : recordId // ignore: cast_nullable_to_non_nullable
as String,events: null == events ? _self._events : events // ignore: cast_nullable_to_non_nullable
as List<RecordTimelineEvent>,recommendation: null == recommendation ? _self.recommendation : recommendation // ignore: cast_nullable_to_non_nullable
as DisputeRecommendation,
  ));
}

/// Create a copy of RecordTimeline
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DisputeRecommendationCopyWith<$Res> get recommendation {
  
  return $DisputeRecommendationCopyWith<$Res>(_self.recommendation, (value) {
    return _then(_self.copyWith(recommendation: value));
  });
}
}

// dart format on
