// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'standing.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AttendanceStanding {

 String get sectionId; String get subjectName; String get subjectCode; String get sectionName; String get professorName; int get thresholdPercent; int get present; int get late; int get absent; int get disputed; int get incomplete; int get countedSessions; double? get attendanceRate; AttendanceStandingStatus get status; int? get absencesBeforeBelowThreshold; String? get lastSessionDate; String? get caveat;
/// Create a copy of AttendanceStanding
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AttendanceStandingCopyWith<AttendanceStanding> get copyWith => _$AttendanceStandingCopyWithImpl<AttendanceStanding>(this as AttendanceStanding, _$identity);

  /// Serializes this AttendanceStanding to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AttendanceStanding&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.subjectCode, subjectCode) || other.subjectCode == subjectCode)&&(identical(other.sectionName, sectionName) || other.sectionName == sectionName)&&(identical(other.professorName, professorName) || other.professorName == professorName)&&(identical(other.thresholdPercent, thresholdPercent) || other.thresholdPercent == thresholdPercent)&&(identical(other.present, present) || other.present == present)&&(identical(other.late, late) || other.late == late)&&(identical(other.absent, absent) || other.absent == absent)&&(identical(other.disputed, disputed) || other.disputed == disputed)&&(identical(other.incomplete, incomplete) || other.incomplete == incomplete)&&(identical(other.countedSessions, countedSessions) || other.countedSessions == countedSessions)&&(identical(other.attendanceRate, attendanceRate) || other.attendanceRate == attendanceRate)&&(identical(other.status, status) || other.status == status)&&(identical(other.absencesBeforeBelowThreshold, absencesBeforeBelowThreshold) || other.absencesBeforeBelowThreshold == absencesBeforeBelowThreshold)&&(identical(other.lastSessionDate, lastSessionDate) || other.lastSessionDate == lastSessionDate)&&(identical(other.caveat, caveat) || other.caveat == caveat));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,subjectName,subjectCode,sectionName,professorName,thresholdPercent,present,late,absent,disputed,incomplete,countedSessions,attendanceRate,status,absencesBeforeBelowThreshold,lastSessionDate,caveat);

@override
String toString() {
  return 'AttendanceStanding(sectionId: $sectionId, subjectName: $subjectName, subjectCode: $subjectCode, sectionName: $sectionName, professorName: $professorName, thresholdPercent: $thresholdPercent, present: $present, late: $late, absent: $absent, disputed: $disputed, incomplete: $incomplete, countedSessions: $countedSessions, attendanceRate: $attendanceRate, status: $status, absencesBeforeBelowThreshold: $absencesBeforeBelowThreshold, lastSessionDate: $lastSessionDate, caveat: $caveat)';
}


}

/// @nodoc
abstract mixin class $AttendanceStandingCopyWith<$Res>  {
  factory $AttendanceStandingCopyWith(AttendanceStanding value, $Res Function(AttendanceStanding) _then) = _$AttendanceStandingCopyWithImpl;
@useResult
$Res call({
 String sectionId, String subjectName, String subjectCode, String sectionName, String professorName, int thresholdPercent, int present, int late, int absent, int disputed, int incomplete, int countedSessions, double? attendanceRate, AttendanceStandingStatus status, int? absencesBeforeBelowThreshold, String? lastSessionDate, String? caveat
});




}
/// @nodoc
class _$AttendanceStandingCopyWithImpl<$Res>
    implements $AttendanceStandingCopyWith<$Res> {
  _$AttendanceStandingCopyWithImpl(this._self, this._then);

  final AttendanceStanding _self;
  final $Res Function(AttendanceStanding) _then;

/// Create a copy of AttendanceStanding
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sectionId = null,Object? subjectName = null,Object? subjectCode = null,Object? sectionName = null,Object? professorName = null,Object? thresholdPercent = null,Object? present = null,Object? late = null,Object? absent = null,Object? disputed = null,Object? incomplete = null,Object? countedSessions = null,Object? attendanceRate = freezed,Object? status = null,Object? absencesBeforeBelowThreshold = freezed,Object? lastSessionDate = freezed,Object? caveat = freezed,}) {
  return _then(AttendanceStanding(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,subjectCode: null == subjectCode ? _self.subjectCode : subjectCode // ignore: cast_nullable_to_non_nullable
as String,sectionName: null == sectionName ? _self.sectionName : sectionName // ignore: cast_nullable_to_non_nullable
as String,professorName: null == professorName ? _self.professorName : professorName // ignore: cast_nullable_to_non_nullable
as String,thresholdPercent: null == thresholdPercent ? _self.thresholdPercent : thresholdPercent // ignore: cast_nullable_to_non_nullable
as int,present: null == present ? _self.present : present // ignore: cast_nullable_to_non_nullable
as int,late: null == late ? _self.late : late // ignore: cast_nullable_to_non_nullable
as int,absent: null == absent ? _self.absent : absent // ignore: cast_nullable_to_non_nullable
as int,disputed: null == disputed ? _self.disputed : disputed // ignore: cast_nullable_to_non_nullable
as int,incomplete: null == incomplete ? _self.incomplete : incomplete // ignore: cast_nullable_to_non_nullable
as int,countedSessions: null == countedSessions ? _self.countedSessions : countedSessions // ignore: cast_nullable_to_non_nullable
as int,attendanceRate: freezed == attendanceRate ? _self.attendanceRate : attendanceRate // ignore: cast_nullable_to_non_nullable
as double?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AttendanceStandingStatus,absencesBeforeBelowThreshold: freezed == absencesBeforeBelowThreshold ? _self.absencesBeforeBelowThreshold : absencesBeforeBelowThreshold // ignore: cast_nullable_to_non_nullable
as int?,lastSessionDate: freezed == lastSessionDate ? _self.lastSessionDate : lastSessionDate // ignore: cast_nullable_to_non_nullable
as String?,caveat: freezed == caveat ? _self.caveat : caveat // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [AttendanceStanding].
extension AttendanceStandingPatterns on AttendanceStanding {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AttendanceStanding value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AttendanceStanding() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AttendanceStanding value)  $default,){
final _that = this;
switch (_that) {
case _AttendanceStanding():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AttendanceStanding value)?  $default,){
final _that = this;
switch (_that) {
case _AttendanceStanding() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sectionId,  String subjectName,  String subjectCode,  String sectionName,  String professorName,  int thresholdPercent,  int present,  int late,  int absent,  int disputed,  int incomplete,  int countedSessions,  double? attendanceRate,  AttendanceStandingStatus status,  int? absencesBeforeBelowThreshold,  String? lastSessionDate,  String? caveat)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AttendanceStanding() when $default != null:
return $default(_that.sectionId,_that.subjectName,_that.subjectCode,_that.sectionName,_that.professorName,_that.thresholdPercent,_that.present,_that.late,_that.absent,_that.disputed,_that.incomplete,_that.countedSessions,_that.attendanceRate,_that.status,_that.absencesBeforeBelowThreshold,_that.lastSessionDate,_that.caveat);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sectionId,  String subjectName,  String subjectCode,  String sectionName,  String professorName,  int thresholdPercent,  int present,  int late,  int absent,  int disputed,  int incomplete,  int countedSessions,  double? attendanceRate,  AttendanceStandingStatus status,  int? absencesBeforeBelowThreshold,  String? lastSessionDate,  String? caveat)  $default,) {final _that = this;
switch (_that) {
case _AttendanceStanding():
return $default(_that.sectionId,_that.subjectName,_that.subjectCode,_that.sectionName,_that.professorName,_that.thresholdPercent,_that.present,_that.late,_that.absent,_that.disputed,_that.incomplete,_that.countedSessions,_that.attendanceRate,_that.status,_that.absencesBeforeBelowThreshold,_that.lastSessionDate,_that.caveat);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sectionId,  String subjectName,  String subjectCode,  String sectionName,  String professorName,  int thresholdPercent,  int present,  int late,  int absent,  int disputed,  int incomplete,  int countedSessions,  double? attendanceRate,  AttendanceStandingStatus status,  int? absencesBeforeBelowThreshold,  String? lastSessionDate,  String? caveat)?  $default,) {final _that = this;
switch (_that) {
case _AttendanceStanding() when $default != null:
return $default(_that.sectionId,_that.subjectName,_that.subjectCode,_that.sectionName,_that.professorName,_that.thresholdPercent,_that.present,_that.late,_that.absent,_that.disputed,_that.incomplete,_that.countedSessions,_that.attendanceRate,_that.status,_that.absencesBeforeBelowThreshold,_that.lastSessionDate,_that.caveat);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AttendanceStandingStatusConverter()])
class _AttendanceStanding implements AttendanceStanding {
  const _AttendanceStanding({required this.sectionId, this.subjectName = '', this.subjectCode = '', this.sectionName = '', this.professorName = '', this.thresholdPercent = 75, this.present = 0, this.late = 0, this.absent = 0, this.disputed = 0, this.incomplete = 0, this.countedSessions = 0, this.attendanceRate, required this.status, this.absencesBeforeBelowThreshold, this.lastSessionDate, this.caveat});
  factory _AttendanceStanding.fromJson(Map<String, dynamic> json) => _$AttendanceStandingFromJson(json);

@override final  String sectionId;
@override@JsonKey() final  String subjectName;
@override@JsonKey() final  String subjectCode;
@override@JsonKey() final  String sectionName;
@override@JsonKey() final  String professorName;
@override@JsonKey() final  int thresholdPercent;
@override@JsonKey() final  int present;
@override@JsonKey() final  int late;
@override@JsonKey() final  int absent;
@override@JsonKey() final  int disputed;
@override@JsonKey() final  int incomplete;
@override@JsonKey() final  int countedSessions;
@override final  double? attendanceRate;
@override final  AttendanceStandingStatus status;
@override final  int? absencesBeforeBelowThreshold;
@override final  String? lastSessionDate;
@override final  String? caveat;

/// Create a copy of AttendanceStanding
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AttendanceStandingCopyWith<_AttendanceStanding> get copyWith => __$AttendanceStandingCopyWithImpl<_AttendanceStanding>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AttendanceStandingToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AttendanceStanding&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.subjectCode, subjectCode) || other.subjectCode == subjectCode)&&(identical(other.sectionName, sectionName) || other.sectionName == sectionName)&&(identical(other.professorName, professorName) || other.professorName == professorName)&&(identical(other.thresholdPercent, thresholdPercent) || other.thresholdPercent == thresholdPercent)&&(identical(other.present, present) || other.present == present)&&(identical(other.late, late) || other.late == late)&&(identical(other.absent, absent) || other.absent == absent)&&(identical(other.disputed, disputed) || other.disputed == disputed)&&(identical(other.incomplete, incomplete) || other.incomplete == incomplete)&&(identical(other.countedSessions, countedSessions) || other.countedSessions == countedSessions)&&(identical(other.attendanceRate, attendanceRate) || other.attendanceRate == attendanceRate)&&(identical(other.status, status) || other.status == status)&&(identical(other.absencesBeforeBelowThreshold, absencesBeforeBelowThreshold) || other.absencesBeforeBelowThreshold == absencesBeforeBelowThreshold)&&(identical(other.lastSessionDate, lastSessionDate) || other.lastSessionDate == lastSessionDate)&&(identical(other.caveat, caveat) || other.caveat == caveat));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,subjectName,subjectCode,sectionName,professorName,thresholdPercent,present,late,absent,disputed,incomplete,countedSessions,attendanceRate,status,absencesBeforeBelowThreshold,lastSessionDate,caveat);

@override
String toString() {
  return 'AttendanceStanding(sectionId: $sectionId, subjectName: $subjectName, subjectCode: $subjectCode, sectionName: $sectionName, professorName: $professorName, thresholdPercent: $thresholdPercent, present: $present, late: $late, absent: $absent, disputed: $disputed, incomplete: $incomplete, countedSessions: $countedSessions, attendanceRate: $attendanceRate, status: $status, absencesBeforeBelowThreshold: $absencesBeforeBelowThreshold, lastSessionDate: $lastSessionDate, caveat: $caveat)';
}


}

/// @nodoc
abstract mixin class _$AttendanceStandingCopyWith<$Res> implements $AttendanceStandingCopyWith<$Res> {
  factory _$AttendanceStandingCopyWith(_AttendanceStanding value, $Res Function(_AttendanceStanding) _then) = __$AttendanceStandingCopyWithImpl;
@override @useResult
$Res call({
 String sectionId, String subjectName, String subjectCode, String sectionName, String professorName, int thresholdPercent, int present, int late, int absent, int disputed, int incomplete, int countedSessions, double? attendanceRate, AttendanceStandingStatus status, int? absencesBeforeBelowThreshold, String? lastSessionDate, String? caveat
});




}
/// @nodoc
class __$AttendanceStandingCopyWithImpl<$Res>
    implements _$AttendanceStandingCopyWith<$Res> {
  __$AttendanceStandingCopyWithImpl(this._self, this._then);

  final _AttendanceStanding _self;
  final $Res Function(_AttendanceStanding) _then;

/// Create a copy of AttendanceStanding
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sectionId = null,Object? subjectName = null,Object? subjectCode = null,Object? sectionName = null,Object? professorName = null,Object? thresholdPercent = null,Object? present = null,Object? late = null,Object? absent = null,Object? disputed = null,Object? incomplete = null,Object? countedSessions = null,Object? attendanceRate = freezed,Object? status = null,Object? absencesBeforeBelowThreshold = freezed,Object? lastSessionDate = freezed,Object? caveat = freezed,}) {
  return _then(_AttendanceStanding(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,subjectCode: null == subjectCode ? _self.subjectCode : subjectCode // ignore: cast_nullable_to_non_nullable
as String,sectionName: null == sectionName ? _self.sectionName : sectionName // ignore: cast_nullable_to_non_nullable
as String,professorName: null == professorName ? _self.professorName : professorName // ignore: cast_nullable_to_non_nullable
as String,thresholdPercent: null == thresholdPercent ? _self.thresholdPercent : thresholdPercent // ignore: cast_nullable_to_non_nullable
as int,present: null == present ? _self.present : present // ignore: cast_nullable_to_non_nullable
as int,late: null == late ? _self.late : late // ignore: cast_nullable_to_non_nullable
as int,absent: null == absent ? _self.absent : absent // ignore: cast_nullable_to_non_nullable
as int,disputed: null == disputed ? _self.disputed : disputed // ignore: cast_nullable_to_non_nullable
as int,incomplete: null == incomplete ? _self.incomplete : incomplete // ignore: cast_nullable_to_non_nullable
as int,countedSessions: null == countedSessions ? _self.countedSessions : countedSessions // ignore: cast_nullable_to_non_nullable
as int,attendanceRate: freezed == attendanceRate ? _self.attendanceRate : attendanceRate // ignore: cast_nullable_to_non_nullable
as double?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AttendanceStandingStatus,absencesBeforeBelowThreshold: freezed == absencesBeforeBelowThreshold ? _self.absencesBeforeBelowThreshold : absencesBeforeBelowThreshold // ignore: cast_nullable_to_non_nullable
as int?,lastSessionDate: freezed == lastSessionDate ? _self.lastSessionDate : lastSessionDate // ignore: cast_nullable_to_non_nullable
as String?,caveat: freezed == caveat ? _self.caveat : caveat // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
