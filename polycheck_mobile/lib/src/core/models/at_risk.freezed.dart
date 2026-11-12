// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'at_risk.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$StudentAtRisk {

 String get studentId; String get studentName; String? get studentNumber; String get sectionId; String get sectionName; String get subjectName; String get professorName; int get thresholdPercent; double? get attendanceRate; AttendanceStandingStatus get status; int? get absencesBeforeBelowThreshold; String? get lastAbsenceDate;
/// Create a copy of StudentAtRisk
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StudentAtRiskCopyWith<StudentAtRisk> get copyWith => _$StudentAtRiskCopyWithImpl<StudentAtRisk>(this as StudentAtRisk, _$identity);

  /// Serializes this StudentAtRisk to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StudentAtRisk&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentNumber, studentNumber) || other.studentNumber == studentNumber)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.sectionName, sectionName) || other.sectionName == sectionName)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.professorName, professorName) || other.professorName == professorName)&&(identical(other.thresholdPercent, thresholdPercent) || other.thresholdPercent == thresholdPercent)&&(identical(other.attendanceRate, attendanceRate) || other.attendanceRate == attendanceRate)&&(identical(other.status, status) || other.status == status)&&(identical(other.absencesBeforeBelowThreshold, absencesBeforeBelowThreshold) || other.absencesBeforeBelowThreshold == absencesBeforeBelowThreshold)&&(identical(other.lastAbsenceDate, lastAbsenceDate) || other.lastAbsenceDate == lastAbsenceDate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,studentId,studentName,studentNumber,sectionId,sectionName,subjectName,professorName,thresholdPercent,attendanceRate,status,absencesBeforeBelowThreshold,lastAbsenceDate);

@override
String toString() {
  return 'StudentAtRisk(studentId: $studentId, studentName: $studentName, studentNumber: $studentNumber, sectionId: $sectionId, sectionName: $sectionName, subjectName: $subjectName, professorName: $professorName, thresholdPercent: $thresholdPercent, attendanceRate: $attendanceRate, status: $status, absencesBeforeBelowThreshold: $absencesBeforeBelowThreshold, lastAbsenceDate: $lastAbsenceDate)';
}


}

/// @nodoc
abstract mixin class $StudentAtRiskCopyWith<$Res>  {
  factory $StudentAtRiskCopyWith(StudentAtRisk value, $Res Function(StudentAtRisk) _then) = _$StudentAtRiskCopyWithImpl;
@useResult
$Res call({
 String studentId, String studentName, String? studentNumber, String sectionId, String sectionName, String subjectName, String professorName, int thresholdPercent, double? attendanceRate, AttendanceStandingStatus status, int? absencesBeforeBelowThreshold, String? lastAbsenceDate
});




}
/// @nodoc
class _$StudentAtRiskCopyWithImpl<$Res>
    implements $StudentAtRiskCopyWith<$Res> {
  _$StudentAtRiskCopyWithImpl(this._self, this._then);

  final StudentAtRisk _self;
  final $Res Function(StudentAtRisk) _then;

/// Create a copy of StudentAtRisk
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? studentId = null,Object? studentName = null,Object? studentNumber = freezed,Object? sectionId = null,Object? sectionName = null,Object? subjectName = null,Object? professorName = null,Object? thresholdPercent = null,Object? attendanceRate = freezed,Object? status = null,Object? absencesBeforeBelowThreshold = freezed,Object? lastAbsenceDate = freezed,}) {
  return _then(StudentAtRisk(
studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,studentNumber: freezed == studentNumber ? _self.studentNumber : studentNumber // ignore: cast_nullable_to_non_nullable
as String?,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,sectionName: null == sectionName ? _self.sectionName : sectionName // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,professorName: null == professorName ? _self.professorName : professorName // ignore: cast_nullable_to_non_nullable
as String,thresholdPercent: null == thresholdPercent ? _self.thresholdPercent : thresholdPercent // ignore: cast_nullable_to_non_nullable
as int,attendanceRate: freezed == attendanceRate ? _self.attendanceRate : attendanceRate // ignore: cast_nullable_to_non_nullable
as double?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AttendanceStandingStatus,absencesBeforeBelowThreshold: freezed == absencesBeforeBelowThreshold ? _self.absencesBeforeBelowThreshold : absencesBeforeBelowThreshold // ignore: cast_nullable_to_non_nullable
as int?,lastAbsenceDate: freezed == lastAbsenceDate ? _self.lastAbsenceDate : lastAbsenceDate // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [StudentAtRisk].
extension StudentAtRiskPatterns on StudentAtRisk {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StudentAtRisk value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StudentAtRisk() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StudentAtRisk value)  $default,){
final _that = this;
switch (_that) {
case _StudentAtRisk():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StudentAtRisk value)?  $default,){
final _that = this;
switch (_that) {
case _StudentAtRisk() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String studentId,  String studentName,  String? studentNumber,  String sectionId,  String sectionName,  String subjectName,  String professorName,  int thresholdPercent,  double? attendanceRate,  AttendanceStandingStatus status,  int? absencesBeforeBelowThreshold,  String? lastAbsenceDate)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StudentAtRisk() when $default != null:
return $default(_that.studentId,_that.studentName,_that.studentNumber,_that.sectionId,_that.sectionName,_that.subjectName,_that.professorName,_that.thresholdPercent,_that.attendanceRate,_that.status,_that.absencesBeforeBelowThreshold,_that.lastAbsenceDate);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String studentId,  String studentName,  String? studentNumber,  String sectionId,  String sectionName,  String subjectName,  String professorName,  int thresholdPercent,  double? attendanceRate,  AttendanceStandingStatus status,  int? absencesBeforeBelowThreshold,  String? lastAbsenceDate)  $default,) {final _that = this;
switch (_that) {
case _StudentAtRisk():
return $default(_that.studentId,_that.studentName,_that.studentNumber,_that.sectionId,_that.sectionName,_that.subjectName,_that.professorName,_that.thresholdPercent,_that.attendanceRate,_that.status,_that.absencesBeforeBelowThreshold,_that.lastAbsenceDate);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String studentId,  String studentName,  String? studentNumber,  String sectionId,  String sectionName,  String subjectName,  String professorName,  int thresholdPercent,  double? attendanceRate,  AttendanceStandingStatus status,  int? absencesBeforeBelowThreshold,  String? lastAbsenceDate)?  $default,) {final _that = this;
switch (_that) {
case _StudentAtRisk() when $default != null:
return $default(_that.studentId,_that.studentName,_that.studentNumber,_that.sectionId,_that.sectionName,_that.subjectName,_that.professorName,_that.thresholdPercent,_that.attendanceRate,_that.status,_that.absencesBeforeBelowThreshold,_that.lastAbsenceDate);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AttendanceStandingStatusConverter()])
class _StudentAtRisk implements StudentAtRisk {
  const _StudentAtRisk({required this.studentId, this.studentName = '', this.studentNumber, required this.sectionId, this.sectionName = '', this.subjectName = '', this.professorName = '', this.thresholdPercent = 75, this.attendanceRate, required this.status, this.absencesBeforeBelowThreshold, this.lastAbsenceDate});
  factory _StudentAtRisk.fromJson(Map<String, dynamic> json) => _$StudentAtRiskFromJson(json);

@override final  String studentId;
@override@JsonKey() final  String studentName;
@override final  String? studentNumber;
@override final  String sectionId;
@override@JsonKey() final  String sectionName;
@override@JsonKey() final  String subjectName;
@override@JsonKey() final  String professorName;
@override@JsonKey() final  int thresholdPercent;
@override final  double? attendanceRate;
@override final  AttendanceStandingStatus status;
@override final  int? absencesBeforeBelowThreshold;
@override final  String? lastAbsenceDate;

/// Create a copy of StudentAtRisk
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StudentAtRiskCopyWith<_StudentAtRisk> get copyWith => __$StudentAtRiskCopyWithImpl<_StudentAtRisk>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StudentAtRiskToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StudentAtRisk&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentNumber, studentNumber) || other.studentNumber == studentNumber)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.sectionName, sectionName) || other.sectionName == sectionName)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.professorName, professorName) || other.professorName == professorName)&&(identical(other.thresholdPercent, thresholdPercent) || other.thresholdPercent == thresholdPercent)&&(identical(other.attendanceRate, attendanceRate) || other.attendanceRate == attendanceRate)&&(identical(other.status, status) || other.status == status)&&(identical(other.absencesBeforeBelowThreshold, absencesBeforeBelowThreshold) || other.absencesBeforeBelowThreshold == absencesBeforeBelowThreshold)&&(identical(other.lastAbsenceDate, lastAbsenceDate) || other.lastAbsenceDate == lastAbsenceDate));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,studentId,studentName,studentNumber,sectionId,sectionName,subjectName,professorName,thresholdPercent,attendanceRate,status,absencesBeforeBelowThreshold,lastAbsenceDate);

@override
String toString() {
  return 'StudentAtRisk(studentId: $studentId, studentName: $studentName, studentNumber: $studentNumber, sectionId: $sectionId, sectionName: $sectionName, subjectName: $subjectName, professorName: $professorName, thresholdPercent: $thresholdPercent, attendanceRate: $attendanceRate, status: $status, absencesBeforeBelowThreshold: $absencesBeforeBelowThreshold, lastAbsenceDate: $lastAbsenceDate)';
}


}

/// @nodoc
abstract mixin class _$StudentAtRiskCopyWith<$Res> implements $StudentAtRiskCopyWith<$Res> {
  factory _$StudentAtRiskCopyWith(_StudentAtRisk value, $Res Function(_StudentAtRisk) _then) = __$StudentAtRiskCopyWithImpl;
@override @useResult
$Res call({
 String studentId, String studentName, String? studentNumber, String sectionId, String sectionName, String subjectName, String professorName, int thresholdPercent, double? attendanceRate, AttendanceStandingStatus status, int? absencesBeforeBelowThreshold, String? lastAbsenceDate
});




}
/// @nodoc
class __$StudentAtRiskCopyWithImpl<$Res>
    implements _$StudentAtRiskCopyWith<$Res> {
  __$StudentAtRiskCopyWithImpl(this._self, this._then);

  final _StudentAtRisk _self;
  final $Res Function(_StudentAtRisk) _then;

/// Create a copy of StudentAtRisk
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? studentId = null,Object? studentName = null,Object? studentNumber = freezed,Object? sectionId = null,Object? sectionName = null,Object? subjectName = null,Object? professorName = null,Object? thresholdPercent = null,Object? attendanceRate = freezed,Object? status = null,Object? absencesBeforeBelowThreshold = freezed,Object? lastAbsenceDate = freezed,}) {
  return _then(_StudentAtRisk(
studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,studentNumber: freezed == studentNumber ? _self.studentNumber : studentNumber // ignore: cast_nullable_to_non_nullable
as String?,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,sectionName: null == sectionName ? _self.sectionName : sectionName // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,professorName: null == professorName ? _self.professorName : professorName // ignore: cast_nullable_to_non_nullable
as String,thresholdPercent: null == thresholdPercent ? _self.thresholdPercent : thresholdPercent // ignore: cast_nullable_to_non_nullable
as int,attendanceRate: freezed == attendanceRate ? _self.attendanceRate : attendanceRate // ignore: cast_nullable_to_non_nullable
as double?,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AttendanceStandingStatus,absencesBeforeBelowThreshold: freezed == absencesBeforeBelowThreshold ? _self.absencesBeforeBelowThreshold : absencesBeforeBelowThreshold // ignore: cast_nullable_to_non_nullable
as int?,lastAbsenceDate: freezed == lastAbsenceDate ? _self.lastAbsenceDate : lastAbsenceDate // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$AtRiskReferral {

 String get id; String get studentId; String get studentName; String? get studentNumber; String get sectionId; String get sectionName; String get subjectName; String get professorName; String get generatedById; String get generatedByName; ReferralStatus get status; String? get note; String get createdAt; String get updatedAt;
/// Create a copy of AtRiskReferral
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AtRiskReferralCopyWith<AtRiskReferral> get copyWith => _$AtRiskReferralCopyWithImpl<AtRiskReferral>(this as AtRiskReferral, _$identity);

  /// Serializes this AtRiskReferral to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AtRiskReferral&&(identical(other.id, id) || other.id == id)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentNumber, studentNumber) || other.studentNumber == studentNumber)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.sectionName, sectionName) || other.sectionName == sectionName)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.professorName, professorName) || other.professorName == professorName)&&(identical(other.generatedById, generatedById) || other.generatedById == generatedById)&&(identical(other.generatedByName, generatedByName) || other.generatedByName == generatedByName)&&(identical(other.status, status) || other.status == status)&&(identical(other.note, note) || other.note == note)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,studentId,studentName,studentNumber,sectionId,sectionName,subjectName,professorName,generatedById,generatedByName,status,note,createdAt,updatedAt);

@override
String toString() {
  return 'AtRiskReferral(id: $id, studentId: $studentId, studentName: $studentName, studentNumber: $studentNumber, sectionId: $sectionId, sectionName: $sectionName, subjectName: $subjectName, professorName: $professorName, generatedById: $generatedById, generatedByName: $generatedByName, status: $status, note: $note, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $AtRiskReferralCopyWith<$Res>  {
  factory $AtRiskReferralCopyWith(AtRiskReferral value, $Res Function(AtRiskReferral) _then) = _$AtRiskReferralCopyWithImpl;
@useResult
$Res call({
 String id, String studentId, String studentName, String? studentNumber, String sectionId, String sectionName, String subjectName, String professorName, String generatedById, String generatedByName, ReferralStatus status, String? note, String createdAt, String updatedAt
});




}
/// @nodoc
class _$AtRiskReferralCopyWithImpl<$Res>
    implements $AtRiskReferralCopyWith<$Res> {
  _$AtRiskReferralCopyWithImpl(this._self, this._then);

  final AtRiskReferral _self;
  final $Res Function(AtRiskReferral) _then;

/// Create a copy of AtRiskReferral
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? studentId = null,Object? studentName = null,Object? studentNumber = freezed,Object? sectionId = null,Object? sectionName = null,Object? subjectName = null,Object? professorName = null,Object? generatedById = null,Object? generatedByName = null,Object? status = null,Object? note = freezed,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(AtRiskReferral(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,studentNumber: freezed == studentNumber ? _self.studentNumber : studentNumber // ignore: cast_nullable_to_non_nullable
as String?,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,sectionName: null == sectionName ? _self.sectionName : sectionName // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,professorName: null == professorName ? _self.professorName : professorName // ignore: cast_nullable_to_non_nullable
as String,generatedById: null == generatedById ? _self.generatedById : generatedById // ignore: cast_nullable_to_non_nullable
as String,generatedByName: null == generatedByName ? _self.generatedByName : generatedByName // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReferralStatus,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AtRiskReferral].
extension AtRiskReferralPatterns on AtRiskReferral {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AtRiskReferral value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AtRiskReferral() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AtRiskReferral value)  $default,){
final _that = this;
switch (_that) {
case _AtRiskReferral():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AtRiskReferral value)?  $default,){
final _that = this;
switch (_that) {
case _AtRiskReferral() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String studentId,  String studentName,  String? studentNumber,  String sectionId,  String sectionName,  String subjectName,  String professorName,  String generatedById,  String generatedByName,  ReferralStatus status,  String? note,  String createdAt,  String updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AtRiskReferral() when $default != null:
return $default(_that.id,_that.studentId,_that.studentName,_that.studentNumber,_that.sectionId,_that.sectionName,_that.subjectName,_that.professorName,_that.generatedById,_that.generatedByName,_that.status,_that.note,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String studentId,  String studentName,  String? studentNumber,  String sectionId,  String sectionName,  String subjectName,  String professorName,  String generatedById,  String generatedByName,  ReferralStatus status,  String? note,  String createdAt,  String updatedAt)  $default,) {final _that = this;
switch (_that) {
case _AtRiskReferral():
return $default(_that.id,_that.studentId,_that.studentName,_that.studentNumber,_that.sectionId,_that.sectionName,_that.subjectName,_that.professorName,_that.generatedById,_that.generatedByName,_that.status,_that.note,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String studentId,  String studentName,  String? studentNumber,  String sectionId,  String sectionName,  String subjectName,  String professorName,  String generatedById,  String generatedByName,  ReferralStatus status,  String? note,  String createdAt,  String updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _AtRiskReferral() when $default != null:
return $default(_that.id,_that.studentId,_that.studentName,_that.studentNumber,_that.sectionId,_that.sectionName,_that.subjectName,_that.professorName,_that.generatedById,_that.generatedByName,_that.status,_that.note,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ReferralStatusConverter()])
class _AtRiskReferral implements AtRiskReferral {
  const _AtRiskReferral({required this.id, required this.studentId, this.studentName = '', this.studentNumber, required this.sectionId, this.sectionName = '', this.subjectName = '', this.professorName = '', this.generatedById = '', this.generatedByName = '', required this.status, this.note, this.createdAt = '', this.updatedAt = ''});
  factory _AtRiskReferral.fromJson(Map<String, dynamic> json) => _$AtRiskReferralFromJson(json);

@override final  String id;
@override final  String studentId;
@override@JsonKey() final  String studentName;
@override final  String? studentNumber;
@override final  String sectionId;
@override@JsonKey() final  String sectionName;
@override@JsonKey() final  String subjectName;
@override@JsonKey() final  String professorName;
@override@JsonKey() final  String generatedById;
@override@JsonKey() final  String generatedByName;
@override final  ReferralStatus status;
@override final  String? note;
@override@JsonKey() final  String createdAt;
@override@JsonKey() final  String updatedAt;

/// Create a copy of AtRiskReferral
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AtRiskReferralCopyWith<_AtRiskReferral> get copyWith => __$AtRiskReferralCopyWithImpl<_AtRiskReferral>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AtRiskReferralToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AtRiskReferral&&(identical(other.id, id) || other.id == id)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.studentNumber, studentNumber) || other.studentNumber == studentNumber)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.sectionName, sectionName) || other.sectionName == sectionName)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.professorName, professorName) || other.professorName == professorName)&&(identical(other.generatedById, generatedById) || other.generatedById == generatedById)&&(identical(other.generatedByName, generatedByName) || other.generatedByName == generatedByName)&&(identical(other.status, status) || other.status == status)&&(identical(other.note, note) || other.note == note)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,studentId,studentName,studentNumber,sectionId,sectionName,subjectName,professorName,generatedById,generatedByName,status,note,createdAt,updatedAt);

@override
String toString() {
  return 'AtRiskReferral(id: $id, studentId: $studentId, studentName: $studentName, studentNumber: $studentNumber, sectionId: $sectionId, sectionName: $sectionName, subjectName: $subjectName, professorName: $professorName, generatedById: $generatedById, generatedByName: $generatedByName, status: $status, note: $note, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$AtRiskReferralCopyWith<$Res> implements $AtRiskReferralCopyWith<$Res> {
  factory _$AtRiskReferralCopyWith(_AtRiskReferral value, $Res Function(_AtRiskReferral) _then) = __$AtRiskReferralCopyWithImpl;
@override @useResult
$Res call({
 String id, String studentId, String studentName, String? studentNumber, String sectionId, String sectionName, String subjectName, String professorName, String generatedById, String generatedByName, ReferralStatus status, String? note, String createdAt, String updatedAt
});




}
/// @nodoc
class __$AtRiskReferralCopyWithImpl<$Res>
    implements _$AtRiskReferralCopyWith<$Res> {
  __$AtRiskReferralCopyWithImpl(this._self, this._then);

  final _AtRiskReferral _self;
  final $Res Function(_AtRiskReferral) _then;

/// Create a copy of AtRiskReferral
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? studentId = null,Object? studentName = null,Object? studentNumber = freezed,Object? sectionId = null,Object? sectionName = null,Object? subjectName = null,Object? professorName = null,Object? generatedById = null,Object? generatedByName = null,Object? status = null,Object? note = freezed,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(_AtRiskReferral(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,studentNumber: freezed == studentNumber ? _self.studentNumber : studentNumber // ignore: cast_nullable_to_non_nullable
as String?,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,sectionName: null == sectionName ? _self.sectionName : sectionName // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,professorName: null == professorName ? _self.professorName : professorName // ignore: cast_nullable_to_non_nullable
as String,generatedById: null == generatedById ? _self.generatedById : generatedById // ignore: cast_nullable_to_non_nullable
as String,generatedByName: null == generatedByName ? _self.generatedByName : generatedByName // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReferralStatus,note: freezed == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$AtRiskReferralFilters {

 ReferralStatus? get status; String? get sectionId;
/// Create a copy of AtRiskReferralFilters
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AtRiskReferralFiltersCopyWith<AtRiskReferralFilters> get copyWith => _$AtRiskReferralFiltersCopyWithImpl<AtRiskReferralFilters>(this as AtRiskReferralFilters, _$identity);

  /// Serializes this AtRiskReferralFilters to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AtRiskReferralFilters&&(identical(other.status, status) || other.status == status)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,sectionId);

@override
String toString() {
  return 'AtRiskReferralFilters(status: $status, sectionId: $sectionId)';
}


}

/// @nodoc
abstract mixin class $AtRiskReferralFiltersCopyWith<$Res>  {
  factory $AtRiskReferralFiltersCopyWith(AtRiskReferralFilters value, $Res Function(AtRiskReferralFilters) _then) = _$AtRiskReferralFiltersCopyWithImpl;
@useResult
$Res call({
 ReferralStatus? status, String? sectionId
});




}
/// @nodoc
class _$AtRiskReferralFiltersCopyWithImpl<$Res>
    implements $AtRiskReferralFiltersCopyWith<$Res> {
  _$AtRiskReferralFiltersCopyWithImpl(this._self, this._then);

  final AtRiskReferralFilters _self;
  final $Res Function(AtRiskReferralFilters) _then;

/// Create a copy of AtRiskReferralFilters
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = freezed,Object? sectionId = freezed,}) {
  return _then(AtRiskReferralFilters(
status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReferralStatus?,sectionId: freezed == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [AtRiskReferralFilters].
extension AtRiskReferralFiltersPatterns on AtRiskReferralFilters {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AtRiskReferralFilters value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AtRiskReferralFilters() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AtRiskReferralFilters value)  $default,){
final _that = this;
switch (_that) {
case _AtRiskReferralFilters():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AtRiskReferralFilters value)?  $default,){
final _that = this;
switch (_that) {
case _AtRiskReferralFilters() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ReferralStatus? status,  String? sectionId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AtRiskReferralFilters() when $default != null:
return $default(_that.status,_that.sectionId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ReferralStatus? status,  String? sectionId)  $default,) {final _that = this;
switch (_that) {
case _AtRiskReferralFilters():
return $default(_that.status,_that.sectionId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ReferralStatus? status,  String? sectionId)?  $default,) {final _that = this;
switch (_that) {
case _AtRiskReferralFilters() when $default != null:
return $default(_that.status,_that.sectionId);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ReferralStatusConverter()])
class _AtRiskReferralFilters implements AtRiskReferralFilters {
  const _AtRiskReferralFilters({this.status, this.sectionId});
  factory _AtRiskReferralFilters.fromJson(Map<String, dynamic> json) => _$AtRiskReferralFiltersFromJson(json);

@override final  ReferralStatus? status;
@override final  String? sectionId;

/// Create a copy of AtRiskReferralFilters
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AtRiskReferralFiltersCopyWith<_AtRiskReferralFilters> get copyWith => __$AtRiskReferralFiltersCopyWithImpl<_AtRiskReferralFilters>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AtRiskReferralFiltersToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AtRiskReferralFilters&&(identical(other.status, status) || other.status == status)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,sectionId);

@override
String toString() {
  return 'AtRiskReferralFilters(status: $status, sectionId: $sectionId)';
}


}

/// @nodoc
abstract mixin class _$AtRiskReferralFiltersCopyWith<$Res> implements $AtRiskReferralFiltersCopyWith<$Res> {
  factory _$AtRiskReferralFiltersCopyWith(_AtRiskReferralFilters value, $Res Function(_AtRiskReferralFilters) _then) = __$AtRiskReferralFiltersCopyWithImpl;
@override @useResult
$Res call({
 ReferralStatus? status, String? sectionId
});




}
/// @nodoc
class __$AtRiskReferralFiltersCopyWithImpl<$Res>
    implements _$AtRiskReferralFiltersCopyWith<$Res> {
  __$AtRiskReferralFiltersCopyWithImpl(this._self, this._then);

  final _AtRiskReferralFilters _self;
  final $Res Function(_AtRiskReferralFilters) _then;

/// Create a copy of AtRiskReferralFilters
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = freezed,Object? sectionId = freezed,}) {
  return _then(_AtRiskReferralFilters(
status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReferralStatus?,sectionId: freezed == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
