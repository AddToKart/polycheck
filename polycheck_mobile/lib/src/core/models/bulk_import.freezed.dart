// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'bulk_import.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$StudentImportRow {

 int get rowNumber; String get fullName; String get studentId; String? get email; String? get program; int? get yearLevel; String? get department;
/// Create a copy of StudentImportRow
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StudentImportRowCopyWith<StudentImportRow> get copyWith => _$StudentImportRowCopyWithImpl<StudentImportRow>(this as StudentImportRow, _$identity);

  /// Serializes this StudentImportRow to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StudentImportRow&&(identical(other.rowNumber, rowNumber) || other.rowNumber == rowNumber)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.email, email) || other.email == email)&&(identical(other.program, program) || other.program == program)&&(identical(other.yearLevel, yearLevel) || other.yearLevel == yearLevel)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rowNumber,fullName,studentId,email,program,yearLevel,department);

@override
String toString() {
  return 'StudentImportRow(rowNumber: $rowNumber, fullName: $fullName, studentId: $studentId, email: $email, program: $program, yearLevel: $yearLevel, department: $department)';
}


}

/// @nodoc
abstract mixin class $StudentImportRowCopyWith<$Res>  {
  factory $StudentImportRowCopyWith(StudentImportRow value, $Res Function(StudentImportRow) _then) = _$StudentImportRowCopyWithImpl;
@useResult
$Res call({
 int rowNumber, String fullName, String studentId, String? email, String? program, int? yearLevel, String? department
});




}
/// @nodoc
class _$StudentImportRowCopyWithImpl<$Res>
    implements $StudentImportRowCopyWith<$Res> {
  _$StudentImportRowCopyWithImpl(this._self, this._then);

  final StudentImportRow _self;
  final $Res Function(StudentImportRow) _then;

/// Create a copy of StudentImportRow
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? rowNumber = null,Object? fullName = null,Object? studentId = null,Object? email = freezed,Object? program = freezed,Object? yearLevel = freezed,Object? department = freezed,}) {
  return _then(StudentImportRow(
rowNumber: null == rowNumber ? _self.rowNumber : rowNumber // ignore: cast_nullable_to_non_nullable
as int,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,program: freezed == program ? _self.program : program // ignore: cast_nullable_to_non_nullable
as String?,yearLevel: freezed == yearLevel ? _self.yearLevel : yearLevel // ignore: cast_nullable_to_non_nullable
as int?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [StudentImportRow].
extension StudentImportRowPatterns on StudentImportRow {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StudentImportRow value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StudentImportRow() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StudentImportRow value)  $default,){
final _that = this;
switch (_that) {
case _StudentImportRow():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StudentImportRow value)?  $default,){
final _that = this;
switch (_that) {
case _StudentImportRow() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int rowNumber,  String fullName,  String studentId,  String? email,  String? program,  int? yearLevel,  String? department)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StudentImportRow() when $default != null:
return $default(_that.rowNumber,_that.fullName,_that.studentId,_that.email,_that.program,_that.yearLevel,_that.department);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int rowNumber,  String fullName,  String studentId,  String? email,  String? program,  int? yearLevel,  String? department)  $default,) {final _that = this;
switch (_that) {
case _StudentImportRow():
return $default(_that.rowNumber,_that.fullName,_that.studentId,_that.email,_that.program,_that.yearLevel,_that.department);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int rowNumber,  String fullName,  String studentId,  String? email,  String? program,  int? yearLevel,  String? department)?  $default,) {final _that = this;
switch (_that) {
case _StudentImportRow() when $default != null:
return $default(_that.rowNumber,_that.fullName,_that.studentId,_that.email,_that.program,_that.yearLevel,_that.department);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _StudentImportRow implements StudentImportRow {
  const _StudentImportRow({required this.rowNumber, required this.fullName, required this.studentId, this.email, this.program, this.yearLevel, this.department});
  factory _StudentImportRow.fromJson(Map<String, dynamic> json) => _$StudentImportRowFromJson(json);

@override final  int rowNumber;
@override final  String fullName;
@override final  String studentId;
@override final  String? email;
@override final  String? program;
@override final  int? yearLevel;
@override final  String? department;

/// Create a copy of StudentImportRow
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StudentImportRowCopyWith<_StudentImportRow> get copyWith => __$StudentImportRowCopyWithImpl<_StudentImportRow>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StudentImportRowToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StudentImportRow&&(identical(other.rowNumber, rowNumber) || other.rowNumber == rowNumber)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.email, email) || other.email == email)&&(identical(other.program, program) || other.program == program)&&(identical(other.yearLevel, yearLevel) || other.yearLevel == yearLevel)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rowNumber,fullName,studentId,email,program,yearLevel,department);

@override
String toString() {
  return 'StudentImportRow(rowNumber: $rowNumber, fullName: $fullName, studentId: $studentId, email: $email, program: $program, yearLevel: $yearLevel, department: $department)';
}


}

/// @nodoc
abstract mixin class _$StudentImportRowCopyWith<$Res> implements $StudentImportRowCopyWith<$Res> {
  factory _$StudentImportRowCopyWith(_StudentImportRow value, $Res Function(_StudentImportRow) _then) = __$StudentImportRowCopyWithImpl;
@override @useResult
$Res call({
 int rowNumber, String fullName, String studentId, String? email, String? program, int? yearLevel, String? department
});




}
/// @nodoc
class __$StudentImportRowCopyWithImpl<$Res>
    implements _$StudentImportRowCopyWith<$Res> {
  __$StudentImportRowCopyWithImpl(this._self, this._then);

  final _StudentImportRow _self;
  final $Res Function(_StudentImportRow) _then;

/// Create a copy of StudentImportRow
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? rowNumber = null,Object? fullName = null,Object? studentId = null,Object? email = freezed,Object? program = freezed,Object? yearLevel = freezed,Object? department = freezed,}) {
  return _then(_StudentImportRow(
rowNumber: null == rowNumber ? _self.rowNumber : rowNumber // ignore: cast_nullable_to_non_nullable
as int,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,program: freezed == program ? _self.program : program // ignore: cast_nullable_to_non_nullable
as String?,yearLevel: freezed == yearLevel ? _self.yearLevel : yearLevel // ignore: cast_nullable_to_non_nullable
as int?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$EnrollImportRow {

 int get rowNumber; String get studentId; String? get studentName; String? get expectedProgram; int? get expectedYearLevel;
/// Create a copy of EnrollImportRow
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EnrollImportRowCopyWith<EnrollImportRow> get copyWith => _$EnrollImportRowCopyWithImpl<EnrollImportRow>(this as EnrollImportRow, _$identity);

  /// Serializes this EnrollImportRow to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EnrollImportRow&&(identical(other.rowNumber, rowNumber) || other.rowNumber == rowNumber)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.expectedProgram, expectedProgram) || other.expectedProgram == expectedProgram)&&(identical(other.expectedYearLevel, expectedYearLevel) || other.expectedYearLevel == expectedYearLevel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rowNumber,studentId,studentName,expectedProgram,expectedYearLevel);

@override
String toString() {
  return 'EnrollImportRow(rowNumber: $rowNumber, studentId: $studentId, studentName: $studentName, expectedProgram: $expectedProgram, expectedYearLevel: $expectedYearLevel)';
}


}

/// @nodoc
abstract mixin class $EnrollImportRowCopyWith<$Res>  {
  factory $EnrollImportRowCopyWith(EnrollImportRow value, $Res Function(EnrollImportRow) _then) = _$EnrollImportRowCopyWithImpl;
@useResult
$Res call({
 int rowNumber, String studentId, String? studentName, String? expectedProgram, int? expectedYearLevel
});




}
/// @nodoc
class _$EnrollImportRowCopyWithImpl<$Res>
    implements $EnrollImportRowCopyWith<$Res> {
  _$EnrollImportRowCopyWithImpl(this._self, this._then);

  final EnrollImportRow _self;
  final $Res Function(EnrollImportRow) _then;

/// Create a copy of EnrollImportRow
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? rowNumber = null,Object? studentId = null,Object? studentName = freezed,Object? expectedProgram = freezed,Object? expectedYearLevel = freezed,}) {
  return _then(EnrollImportRow(
rowNumber: null == rowNumber ? _self.rowNumber : rowNumber // ignore: cast_nullable_to_non_nullable
as int,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: freezed == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String?,expectedProgram: freezed == expectedProgram ? _self.expectedProgram : expectedProgram // ignore: cast_nullable_to_non_nullable
as String?,expectedYearLevel: freezed == expectedYearLevel ? _self.expectedYearLevel : expectedYearLevel // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [EnrollImportRow].
extension EnrollImportRowPatterns on EnrollImportRow {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EnrollImportRow value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EnrollImportRow() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EnrollImportRow value)  $default,){
final _that = this;
switch (_that) {
case _EnrollImportRow():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EnrollImportRow value)?  $default,){
final _that = this;
switch (_that) {
case _EnrollImportRow() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int rowNumber,  String studentId,  String? studentName,  String? expectedProgram,  int? expectedYearLevel)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EnrollImportRow() when $default != null:
return $default(_that.rowNumber,_that.studentId,_that.studentName,_that.expectedProgram,_that.expectedYearLevel);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int rowNumber,  String studentId,  String? studentName,  String? expectedProgram,  int? expectedYearLevel)  $default,) {final _that = this;
switch (_that) {
case _EnrollImportRow():
return $default(_that.rowNumber,_that.studentId,_that.studentName,_that.expectedProgram,_that.expectedYearLevel);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int rowNumber,  String studentId,  String? studentName,  String? expectedProgram,  int? expectedYearLevel)?  $default,) {final _that = this;
switch (_that) {
case _EnrollImportRow() when $default != null:
return $default(_that.rowNumber,_that.studentId,_that.studentName,_that.expectedProgram,_that.expectedYearLevel);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _EnrollImportRow implements EnrollImportRow {
  const _EnrollImportRow({required this.rowNumber, required this.studentId, this.studentName, this.expectedProgram, this.expectedYearLevel});
  factory _EnrollImportRow.fromJson(Map<String, dynamic> json) => _$EnrollImportRowFromJson(json);

@override final  int rowNumber;
@override final  String studentId;
@override final  String? studentName;
@override final  String? expectedProgram;
@override final  int? expectedYearLevel;

/// Create a copy of EnrollImportRow
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EnrollImportRowCopyWith<_EnrollImportRow> get copyWith => __$EnrollImportRowCopyWithImpl<_EnrollImportRow>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EnrollImportRowToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EnrollImportRow&&(identical(other.rowNumber, rowNumber) || other.rowNumber == rowNumber)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.expectedProgram, expectedProgram) || other.expectedProgram == expectedProgram)&&(identical(other.expectedYearLevel, expectedYearLevel) || other.expectedYearLevel == expectedYearLevel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rowNumber,studentId,studentName,expectedProgram,expectedYearLevel);

@override
String toString() {
  return 'EnrollImportRow(rowNumber: $rowNumber, studentId: $studentId, studentName: $studentName, expectedProgram: $expectedProgram, expectedYearLevel: $expectedYearLevel)';
}


}

/// @nodoc
abstract mixin class _$EnrollImportRowCopyWith<$Res> implements $EnrollImportRowCopyWith<$Res> {
  factory _$EnrollImportRowCopyWith(_EnrollImportRow value, $Res Function(_EnrollImportRow) _then) = __$EnrollImportRowCopyWithImpl;
@override @useResult
$Res call({
 int rowNumber, String studentId, String? studentName, String? expectedProgram, int? expectedYearLevel
});




}
/// @nodoc
class __$EnrollImportRowCopyWithImpl<$Res>
    implements _$EnrollImportRowCopyWith<$Res> {
  __$EnrollImportRowCopyWithImpl(this._self, this._then);

  final _EnrollImportRow _self;
  final $Res Function(_EnrollImportRow) _then;

/// Create a copy of EnrollImportRow
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? rowNumber = null,Object? studentId = null,Object? studentName = freezed,Object? expectedProgram = freezed,Object? expectedYearLevel = freezed,}) {
  return _then(_EnrollImportRow(
rowNumber: null == rowNumber ? _self.rowNumber : rowNumber // ignore: cast_nullable_to_non_nullable
as int,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: freezed == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String?,expectedProgram: freezed == expectedProgram ? _self.expectedProgram : expectedProgram // ignore: cast_nullable_to_non_nullable
as String?,expectedYearLevel: freezed == expectedYearLevel ? _self.expectedYearLevel : expectedYearLevel // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$ImportIssue {

 int get rowNumber; String? get column; ImportIssueCode get code; String get message;
/// Create a copy of ImportIssue
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ImportIssueCopyWith<ImportIssue> get copyWith => _$ImportIssueCopyWithImpl<ImportIssue>(this as ImportIssue, _$identity);

  /// Serializes this ImportIssue to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ImportIssue&&(identical(other.rowNumber, rowNumber) || other.rowNumber == rowNumber)&&(identical(other.column, column) || other.column == column)&&(identical(other.code, code) || other.code == code)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rowNumber,column,code,message);

@override
String toString() {
  return 'ImportIssue(rowNumber: $rowNumber, column: $column, code: $code, message: $message)';
}


}

/// @nodoc
abstract mixin class $ImportIssueCopyWith<$Res>  {
  factory $ImportIssueCopyWith(ImportIssue value, $Res Function(ImportIssue) _then) = _$ImportIssueCopyWithImpl;
@useResult
$Res call({
 int rowNumber, String? column, ImportIssueCode code, String message
});




}
/// @nodoc
class _$ImportIssueCopyWithImpl<$Res>
    implements $ImportIssueCopyWith<$Res> {
  _$ImportIssueCopyWithImpl(this._self, this._then);

  final ImportIssue _self;
  final $Res Function(ImportIssue) _then;

/// Create a copy of ImportIssue
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? rowNumber = null,Object? column = freezed,Object? code = null,Object? message = null,}) {
  return _then(ImportIssue(
rowNumber: null == rowNumber ? _self.rowNumber : rowNumber // ignore: cast_nullable_to_non_nullable
as int,column: freezed == column ? _self.column : column // ignore: cast_nullable_to_non_nullable
as String?,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as ImportIssueCode,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ImportIssue].
extension ImportIssuePatterns on ImportIssue {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ImportIssue value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ImportIssue() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ImportIssue value)  $default,){
final _that = this;
switch (_that) {
case _ImportIssue():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ImportIssue value)?  $default,){
final _that = this;
switch (_that) {
case _ImportIssue() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int rowNumber,  String? column,  ImportIssueCode code,  String message)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ImportIssue() when $default != null:
return $default(_that.rowNumber,_that.column,_that.code,_that.message);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int rowNumber,  String? column,  ImportIssueCode code,  String message)  $default,) {final _that = this;
switch (_that) {
case _ImportIssue():
return $default(_that.rowNumber,_that.column,_that.code,_that.message);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int rowNumber,  String? column,  ImportIssueCode code,  String message)?  $default,) {final _that = this;
switch (_that) {
case _ImportIssue() when $default != null:
return $default(_that.rowNumber,_that.column,_that.code,_that.message);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ImportIssueCodeConverter()])
class _ImportIssue implements ImportIssue {
  const _ImportIssue({required this.rowNumber, this.column, required this.code, this.message = ''});
  factory _ImportIssue.fromJson(Map<String, dynamic> json) => _$ImportIssueFromJson(json);

@override final  int rowNumber;
@override final  String? column;
@override final  ImportIssueCode code;
@override@JsonKey() final  String message;

/// Create a copy of ImportIssue
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ImportIssueCopyWith<_ImportIssue> get copyWith => __$ImportIssueCopyWithImpl<_ImportIssue>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ImportIssueToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ImportIssue&&(identical(other.rowNumber, rowNumber) || other.rowNumber == rowNumber)&&(identical(other.column, column) || other.column == column)&&(identical(other.code, code) || other.code == code)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rowNumber,column,code,message);

@override
String toString() {
  return 'ImportIssue(rowNumber: $rowNumber, column: $column, code: $code, message: $message)';
}


}

/// @nodoc
abstract mixin class _$ImportIssueCopyWith<$Res> implements $ImportIssueCopyWith<$Res> {
  factory _$ImportIssueCopyWith(_ImportIssue value, $Res Function(_ImportIssue) _then) = __$ImportIssueCopyWithImpl;
@override @useResult
$Res call({
 int rowNumber, String? column, ImportIssueCode code, String message
});




}
/// @nodoc
class __$ImportIssueCopyWithImpl<$Res>
    implements _$ImportIssueCopyWith<$Res> {
  __$ImportIssueCopyWithImpl(this._self, this._then);

  final _ImportIssue _self;
  final $Res Function(_ImportIssue) _then;

/// Create a copy of ImportIssue
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? rowNumber = null,Object? column = freezed,Object? code = null,Object? message = null,}) {
  return _then(_ImportIssue(
rowNumber: null == rowNumber ? _self.rowNumber : rowNumber // ignore: cast_nullable_to_non_nullable
as int,column: freezed == column ? _self.column : column // ignore: cast_nullable_to_non_nullable
as String?,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as ImportIssueCode,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$StudentImportSummary {

 int get total; int get valid; int get skip; int get invalid;@JsonKey(name: 'new') int get newCount; int get update;
/// Create a copy of StudentImportSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StudentImportSummaryCopyWith<StudentImportSummary> get copyWith => _$StudentImportSummaryCopyWithImpl<StudentImportSummary>(this as StudentImportSummary, _$identity);

  /// Serializes this StudentImportSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StudentImportSummary&&(identical(other.total, total) || other.total == total)&&(identical(other.valid, valid) || other.valid == valid)&&(identical(other.skip, skip) || other.skip == skip)&&(identical(other.invalid, invalid) || other.invalid == invalid)&&(identical(other.newCount, newCount) || other.newCount == newCount)&&(identical(other.update, update) || other.update == update));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,total,valid,skip,invalid,newCount,update);

@override
String toString() {
  return 'StudentImportSummary(total: $total, valid: $valid, skip: $skip, invalid: $invalid, newCount: $newCount, update: $update)';
}


}

/// @nodoc
abstract mixin class $StudentImportSummaryCopyWith<$Res>  {
  factory $StudentImportSummaryCopyWith(StudentImportSummary value, $Res Function(StudentImportSummary) _then) = _$StudentImportSummaryCopyWithImpl;
@useResult
$Res call({
 int total, int valid, int skip, int invalid,@JsonKey(name: 'new') int newCount, int update
});




}
/// @nodoc
class _$StudentImportSummaryCopyWithImpl<$Res>
    implements $StudentImportSummaryCopyWith<$Res> {
  _$StudentImportSummaryCopyWithImpl(this._self, this._then);

  final StudentImportSummary _self;
  final $Res Function(StudentImportSummary) _then;

/// Create a copy of StudentImportSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? total = null,Object? valid = null,Object? skip = null,Object? invalid = null,Object? newCount = null,Object? update = null,}) {
  return _then(StudentImportSummary(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,valid: null == valid ? _self.valid : valid // ignore: cast_nullable_to_non_nullable
as int,skip: null == skip ? _self.skip : skip // ignore: cast_nullable_to_non_nullable
as int,invalid: null == invalid ? _self.invalid : invalid // ignore: cast_nullable_to_non_nullable
as int,newCount: null == newCount ? _self.newCount : newCount // ignore: cast_nullable_to_non_nullable
as int,update: null == update ? _self.update : update // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [StudentImportSummary].
extension StudentImportSummaryPatterns on StudentImportSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StudentImportSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StudentImportSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StudentImportSummary value)  $default,){
final _that = this;
switch (_that) {
case _StudentImportSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StudentImportSummary value)?  $default,){
final _that = this;
switch (_that) {
case _StudentImportSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int total,  int valid,  int skip,  int invalid, @JsonKey(name: 'new')  int newCount,  int update)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StudentImportSummary() when $default != null:
return $default(_that.total,_that.valid,_that.skip,_that.invalid,_that.newCount,_that.update);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int total,  int valid,  int skip,  int invalid, @JsonKey(name: 'new')  int newCount,  int update)  $default,) {final _that = this;
switch (_that) {
case _StudentImportSummary():
return $default(_that.total,_that.valid,_that.skip,_that.invalid,_that.newCount,_that.update);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int total,  int valid,  int skip,  int invalid, @JsonKey(name: 'new')  int newCount,  int update)?  $default,) {final _that = this;
switch (_that) {
case _StudentImportSummary() when $default != null:
return $default(_that.total,_that.valid,_that.skip,_that.invalid,_that.newCount,_that.update);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _StudentImportSummary implements StudentImportSummary {
  const _StudentImportSummary({this.total = 0, this.valid = 0, this.skip = 0, this.invalid = 0, @JsonKey(name: 'new') this.newCount = 0, this.update = 0});
  factory _StudentImportSummary.fromJson(Map<String, dynamic> json) => _$StudentImportSummaryFromJson(json);

@override@JsonKey() final  int total;
@override@JsonKey() final  int valid;
@override@JsonKey() final  int skip;
@override@JsonKey() final  int invalid;
@override@JsonKey(name: 'new') final  int newCount;
@override@JsonKey() final  int update;

/// Create a copy of StudentImportSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StudentImportSummaryCopyWith<_StudentImportSummary> get copyWith => __$StudentImportSummaryCopyWithImpl<_StudentImportSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StudentImportSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StudentImportSummary&&(identical(other.total, total) || other.total == total)&&(identical(other.valid, valid) || other.valid == valid)&&(identical(other.skip, skip) || other.skip == skip)&&(identical(other.invalid, invalid) || other.invalid == invalid)&&(identical(other.newCount, newCount) || other.newCount == newCount)&&(identical(other.update, update) || other.update == update));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,total,valid,skip,invalid,newCount,update);

@override
String toString() {
  return 'StudentImportSummary(total: $total, valid: $valid, skip: $skip, invalid: $invalid, newCount: $newCount, update: $update)';
}


}

/// @nodoc
abstract mixin class _$StudentImportSummaryCopyWith<$Res> implements $StudentImportSummaryCopyWith<$Res> {
  factory _$StudentImportSummaryCopyWith(_StudentImportSummary value, $Res Function(_StudentImportSummary) _then) = __$StudentImportSummaryCopyWithImpl;
@override @useResult
$Res call({
 int total, int valid, int skip, int invalid,@JsonKey(name: 'new') int newCount, int update
});




}
/// @nodoc
class __$StudentImportSummaryCopyWithImpl<$Res>
    implements _$StudentImportSummaryCopyWith<$Res> {
  __$StudentImportSummaryCopyWithImpl(this._self, this._then);

  final _StudentImportSummary _self;
  final $Res Function(_StudentImportSummary) _then;

/// Create a copy of StudentImportSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? total = null,Object? valid = null,Object? skip = null,Object? invalid = null,Object? newCount = null,Object? update = null,}) {
  return _then(_StudentImportSummary(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,valid: null == valid ? _self.valid : valid // ignore: cast_nullable_to_non_nullable
as int,skip: null == skip ? _self.skip : skip // ignore: cast_nullable_to_non_nullable
as int,invalid: null == invalid ? _self.invalid : invalid // ignore: cast_nullable_to_non_nullable
as int,newCount: null == newCount ? _self.newCount : newCount // ignore: cast_nullable_to_non_nullable
as int,update: null == update ? _self.update : update // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$EnrollImportSummary {

 int get total; int get valid; int get skip; int get invalid; int get enrollable; int? get provisioning;
/// Create a copy of EnrollImportSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EnrollImportSummaryCopyWith<EnrollImportSummary> get copyWith => _$EnrollImportSummaryCopyWithImpl<EnrollImportSummary>(this as EnrollImportSummary, _$identity);

  /// Serializes this EnrollImportSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EnrollImportSummary&&(identical(other.total, total) || other.total == total)&&(identical(other.valid, valid) || other.valid == valid)&&(identical(other.skip, skip) || other.skip == skip)&&(identical(other.invalid, invalid) || other.invalid == invalid)&&(identical(other.enrollable, enrollable) || other.enrollable == enrollable)&&(identical(other.provisioning, provisioning) || other.provisioning == provisioning));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,total,valid,skip,invalid,enrollable,provisioning);

@override
String toString() {
  return 'EnrollImportSummary(total: $total, valid: $valid, skip: $skip, invalid: $invalid, enrollable: $enrollable, provisioning: $provisioning)';
}


}

/// @nodoc
abstract mixin class $EnrollImportSummaryCopyWith<$Res>  {
  factory $EnrollImportSummaryCopyWith(EnrollImportSummary value, $Res Function(EnrollImportSummary) _then) = _$EnrollImportSummaryCopyWithImpl;
@useResult
$Res call({
 int total, int valid, int skip, int invalid, int enrollable, int? provisioning
});




}
/// @nodoc
class _$EnrollImportSummaryCopyWithImpl<$Res>
    implements $EnrollImportSummaryCopyWith<$Res> {
  _$EnrollImportSummaryCopyWithImpl(this._self, this._then);

  final EnrollImportSummary _self;
  final $Res Function(EnrollImportSummary) _then;

/// Create a copy of EnrollImportSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? total = null,Object? valid = null,Object? skip = null,Object? invalid = null,Object? enrollable = null,Object? provisioning = freezed,}) {
  return _then(EnrollImportSummary(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,valid: null == valid ? _self.valid : valid // ignore: cast_nullable_to_non_nullable
as int,skip: null == skip ? _self.skip : skip // ignore: cast_nullable_to_non_nullable
as int,invalid: null == invalid ? _self.invalid : invalid // ignore: cast_nullable_to_non_nullable
as int,enrollable: null == enrollable ? _self.enrollable : enrollable // ignore: cast_nullable_to_non_nullable
as int,provisioning: freezed == provisioning ? _self.provisioning : provisioning // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [EnrollImportSummary].
extension EnrollImportSummaryPatterns on EnrollImportSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EnrollImportSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EnrollImportSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EnrollImportSummary value)  $default,){
final _that = this;
switch (_that) {
case _EnrollImportSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EnrollImportSummary value)?  $default,){
final _that = this;
switch (_that) {
case _EnrollImportSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int total,  int valid,  int skip,  int invalid,  int enrollable,  int? provisioning)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EnrollImportSummary() when $default != null:
return $default(_that.total,_that.valid,_that.skip,_that.invalid,_that.enrollable,_that.provisioning);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int total,  int valid,  int skip,  int invalid,  int enrollable,  int? provisioning)  $default,) {final _that = this;
switch (_that) {
case _EnrollImportSummary():
return $default(_that.total,_that.valid,_that.skip,_that.invalid,_that.enrollable,_that.provisioning);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int total,  int valid,  int skip,  int invalid,  int enrollable,  int? provisioning)?  $default,) {final _that = this;
switch (_that) {
case _EnrollImportSummary() when $default != null:
return $default(_that.total,_that.valid,_that.skip,_that.invalid,_that.enrollable,_that.provisioning);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _EnrollImportSummary implements EnrollImportSummary {
  const _EnrollImportSummary({this.total = 0, this.valid = 0, this.skip = 0, this.invalid = 0, this.enrollable = 0, this.provisioning});
  factory _EnrollImportSummary.fromJson(Map<String, dynamic> json) => _$EnrollImportSummaryFromJson(json);

@override@JsonKey() final  int total;
@override@JsonKey() final  int valid;
@override@JsonKey() final  int skip;
@override@JsonKey() final  int invalid;
@override@JsonKey() final  int enrollable;
@override final  int? provisioning;

/// Create a copy of EnrollImportSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EnrollImportSummaryCopyWith<_EnrollImportSummary> get copyWith => __$EnrollImportSummaryCopyWithImpl<_EnrollImportSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EnrollImportSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EnrollImportSummary&&(identical(other.total, total) || other.total == total)&&(identical(other.valid, valid) || other.valid == valid)&&(identical(other.skip, skip) || other.skip == skip)&&(identical(other.invalid, invalid) || other.invalid == invalid)&&(identical(other.enrollable, enrollable) || other.enrollable == enrollable)&&(identical(other.provisioning, provisioning) || other.provisioning == provisioning));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,total,valid,skip,invalid,enrollable,provisioning);

@override
String toString() {
  return 'EnrollImportSummary(total: $total, valid: $valid, skip: $skip, invalid: $invalid, enrollable: $enrollable, provisioning: $provisioning)';
}


}

/// @nodoc
abstract mixin class _$EnrollImportSummaryCopyWith<$Res> implements $EnrollImportSummaryCopyWith<$Res> {
  factory _$EnrollImportSummaryCopyWith(_EnrollImportSummary value, $Res Function(_EnrollImportSummary) _then) = __$EnrollImportSummaryCopyWithImpl;
@override @useResult
$Res call({
 int total, int valid, int skip, int invalid, int enrollable, int? provisioning
});




}
/// @nodoc
class __$EnrollImportSummaryCopyWithImpl<$Res>
    implements _$EnrollImportSummaryCopyWith<$Res> {
  __$EnrollImportSummaryCopyWithImpl(this._self, this._then);

  final _EnrollImportSummary _self;
  final $Res Function(_EnrollImportSummary) _then;

/// Create a copy of EnrollImportSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? total = null,Object? valid = null,Object? skip = null,Object? invalid = null,Object? enrollable = null,Object? provisioning = freezed,}) {
  return _then(_EnrollImportSummary(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,valid: null == valid ? _self.valid : valid // ignore: cast_nullable_to_non_nullable
as int,skip: null == skip ? _self.skip : skip // ignore: cast_nullable_to_non_nullable
as int,invalid: null == invalid ? _self.invalid : invalid // ignore: cast_nullable_to_non_nullable
as int,enrollable: null == enrollable ? _self.enrollable : enrollable // ignore: cast_nullable_to_non_nullable
as int,provisioning: freezed == provisioning ? _self.provisioning : provisioning // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$ImportCredential {

 int get rowNumber; String get studentId; String get tempPassword;
/// Create a copy of ImportCredential
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ImportCredentialCopyWith<ImportCredential> get copyWith => _$ImportCredentialCopyWithImpl<ImportCredential>(this as ImportCredential, _$identity);

  /// Serializes this ImportCredential to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ImportCredential&&(identical(other.rowNumber, rowNumber) || other.rowNumber == rowNumber)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.tempPassword, tempPassword) || other.tempPassword == tempPassword));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rowNumber,studentId,tempPassword);

@override
String toString() {
  return 'ImportCredential(rowNumber: $rowNumber, studentId: $studentId, tempPassword: $tempPassword)';
}


}

/// @nodoc
abstract mixin class $ImportCredentialCopyWith<$Res>  {
  factory $ImportCredentialCopyWith(ImportCredential value, $Res Function(ImportCredential) _then) = _$ImportCredentialCopyWithImpl;
@useResult
$Res call({
 int rowNumber, String studentId, String tempPassword
});




}
/// @nodoc
class _$ImportCredentialCopyWithImpl<$Res>
    implements $ImportCredentialCopyWith<$Res> {
  _$ImportCredentialCopyWithImpl(this._self, this._then);

  final ImportCredential _self;
  final $Res Function(ImportCredential) _then;

/// Create a copy of ImportCredential
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? rowNumber = null,Object? studentId = null,Object? tempPassword = null,}) {
  return _then(ImportCredential(
rowNumber: null == rowNumber ? _self.rowNumber : rowNumber // ignore: cast_nullable_to_non_nullable
as int,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,tempPassword: null == tempPassword ? _self.tempPassword : tempPassword // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ImportCredential].
extension ImportCredentialPatterns on ImportCredential {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ImportCredential value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ImportCredential() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ImportCredential value)  $default,){
final _that = this;
switch (_that) {
case _ImportCredential():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ImportCredential value)?  $default,){
final _that = this;
switch (_that) {
case _ImportCredential() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int rowNumber,  String studentId,  String tempPassword)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ImportCredential() when $default != null:
return $default(_that.rowNumber,_that.studentId,_that.tempPassword);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int rowNumber,  String studentId,  String tempPassword)  $default,) {final _that = this;
switch (_that) {
case _ImportCredential():
return $default(_that.rowNumber,_that.studentId,_that.tempPassword);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int rowNumber,  String studentId,  String tempPassword)?  $default,) {final _that = this;
switch (_that) {
case _ImportCredential() when $default != null:
return $default(_that.rowNumber,_that.studentId,_that.tempPassword);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _ImportCredential implements ImportCredential {
  const _ImportCredential({this.rowNumber = 0, this.studentId = '', this.tempPassword = ''});
  factory _ImportCredential.fromJson(Map<String, dynamic> json) => _$ImportCredentialFromJson(json);

@override@JsonKey() final  int rowNumber;
@override@JsonKey() final  String studentId;
@override@JsonKey() final  String tempPassword;

/// Create a copy of ImportCredential
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ImportCredentialCopyWith<_ImportCredential> get copyWith => __$ImportCredentialCopyWithImpl<_ImportCredential>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ImportCredentialToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ImportCredential&&(identical(other.rowNumber, rowNumber) || other.rowNumber == rowNumber)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.tempPassword, tempPassword) || other.tempPassword == tempPassword));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rowNumber,studentId,tempPassword);

@override
String toString() {
  return 'ImportCredential(rowNumber: $rowNumber, studentId: $studentId, tempPassword: $tempPassword)';
}


}

/// @nodoc
abstract mixin class _$ImportCredentialCopyWith<$Res> implements $ImportCredentialCopyWith<$Res> {
  factory _$ImportCredentialCopyWith(_ImportCredential value, $Res Function(_ImportCredential) _then) = __$ImportCredentialCopyWithImpl;
@override @useResult
$Res call({
 int rowNumber, String studentId, String tempPassword
});




}
/// @nodoc
class __$ImportCredentialCopyWithImpl<$Res>
    implements _$ImportCredentialCopyWith<$Res> {
  __$ImportCredentialCopyWithImpl(this._self, this._then);

  final _ImportCredential _self;
  final $Res Function(_ImportCredential) _then;

/// Create a copy of ImportCredential
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? rowNumber = null,Object? studentId = null,Object? tempPassword = null,}) {
  return _then(_ImportCredential(
rowNumber: null == rowNumber ? _self.rowNumber : rowNumber // ignore: cast_nullable_to_non_nullable
as int,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,tempPassword: null == tempPassword ? _self.tempPassword : tempPassword // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$StudentImportResult {

 ImportMode get mode; ImportConflictMode get conflictMode; String get rowChecksum; StudentImportSummary get summary; List<ImportIssue> get issues; bool get hasMoreIssues; List<ImportCredential>? get credentials;
/// Create a copy of StudentImportResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StudentImportResultCopyWith<StudentImportResult> get copyWith => _$StudentImportResultCopyWithImpl<StudentImportResult>(this as StudentImportResult, _$identity);

  /// Serializes this StudentImportResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StudentImportResult&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.conflictMode, conflictMode) || other.conflictMode == conflictMode)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum)&&(identical(other.summary, summary) || other.summary == summary)&&const DeepCollectionEquality().equals(other.issues, issues)&&(identical(other.hasMoreIssues, hasMoreIssues) || other.hasMoreIssues == hasMoreIssues)&&const DeepCollectionEquality().equals(other.credentials, credentials));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mode,conflictMode,rowChecksum,summary,const DeepCollectionEquality().hash(issues),hasMoreIssues,const DeepCollectionEquality().hash(credentials));

@override
String toString() {
  return 'StudentImportResult(mode: $mode, conflictMode: $conflictMode, rowChecksum: $rowChecksum, summary: $summary, issues: $issues, hasMoreIssues: $hasMoreIssues, credentials: $credentials)';
}


}

/// @nodoc
abstract mixin class $StudentImportResultCopyWith<$Res>  {
  factory $StudentImportResultCopyWith(StudentImportResult value, $Res Function(StudentImportResult) _then) = _$StudentImportResultCopyWithImpl;
@useResult
$Res call({
 ImportMode mode, ImportConflictMode conflictMode, String rowChecksum, StudentImportSummary summary, List<ImportIssue> issues, bool hasMoreIssues, List<ImportCredential>? credentials
});


$StudentImportSummaryCopyWith<$Res> get summary;

}
/// @nodoc
class _$StudentImportResultCopyWithImpl<$Res>
    implements $StudentImportResultCopyWith<$Res> {
  _$StudentImportResultCopyWithImpl(this._self, this._then);

  final StudentImportResult _self;
  final $Res Function(StudentImportResult) _then;

/// Create a copy of StudentImportResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? mode = null,Object? conflictMode = null,Object? rowChecksum = null,Object? summary = null,Object? issues = null,Object? hasMoreIssues = null,Object? credentials = freezed,}) {
  return _then(StudentImportResult(
mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as ImportMode,conflictMode: null == conflictMode ? _self.conflictMode : conflictMode // ignore: cast_nullable_to_non_nullable
as ImportConflictMode,rowChecksum: null == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String,summary: null == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as StudentImportSummary,issues: null == issues ? _self.issues : issues // ignore: cast_nullable_to_non_nullable
as List<ImportIssue>,hasMoreIssues: null == hasMoreIssues ? _self.hasMoreIssues : hasMoreIssues // ignore: cast_nullable_to_non_nullable
as bool,credentials: freezed == credentials ? _self.credentials : credentials // ignore: cast_nullable_to_non_nullable
as List<ImportCredential>?,
  ));
}
/// Create a copy of StudentImportResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StudentImportSummaryCopyWith<$Res> get summary {
  
  return $StudentImportSummaryCopyWith<$Res>(_self.summary, (value) {
    return _then(_self.copyWith(summary: value));
  });
}
}


/// Adds pattern-matching-related methods to [StudentImportResult].
extension StudentImportResultPatterns on StudentImportResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StudentImportResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StudentImportResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StudentImportResult value)  $default,){
final _that = this;
switch (_that) {
case _StudentImportResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StudentImportResult value)?  $default,){
final _that = this;
switch (_that) {
case _StudentImportResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ImportMode mode,  ImportConflictMode conflictMode,  String rowChecksum,  StudentImportSummary summary,  List<ImportIssue> issues,  bool hasMoreIssues,  List<ImportCredential>? credentials)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StudentImportResult() when $default != null:
return $default(_that.mode,_that.conflictMode,_that.rowChecksum,_that.summary,_that.issues,_that.hasMoreIssues,_that.credentials);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ImportMode mode,  ImportConflictMode conflictMode,  String rowChecksum,  StudentImportSummary summary,  List<ImportIssue> issues,  bool hasMoreIssues,  List<ImportCredential>? credentials)  $default,) {final _that = this;
switch (_that) {
case _StudentImportResult():
return $default(_that.mode,_that.conflictMode,_that.rowChecksum,_that.summary,_that.issues,_that.hasMoreIssues,_that.credentials);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ImportMode mode,  ImportConflictMode conflictMode,  String rowChecksum,  StudentImportSummary summary,  List<ImportIssue> issues,  bool hasMoreIssues,  List<ImportCredential>? credentials)?  $default,) {final _that = this;
switch (_that) {
case _StudentImportResult() when $default != null:
return $default(_that.mode,_that.conflictMode,_that.rowChecksum,_that.summary,_that.issues,_that.hasMoreIssues,_that.credentials);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ImportModeConverter(), ImportConflictModeConverter()])
class _StudentImportResult implements StudentImportResult {
  const _StudentImportResult({required this.mode, required this.conflictMode, this.rowChecksum = '', required this.summary,  List<ImportIssue> issues = const <ImportIssue>[], this.hasMoreIssues = false,  List<ImportCredential>? credentials}): _issues = issues,_credentials = credentials;
  factory _StudentImportResult.fromJson(Map<String, dynamic> json) => _$StudentImportResultFromJson(json);

@override final  ImportMode mode;
@override final  ImportConflictMode conflictMode;
@override@JsonKey() final  String rowChecksum;
@override final  StudentImportSummary summary;
 final  List<ImportIssue> _issues;
@override@JsonKey() List<ImportIssue> get issues {
  if (_issues is EqualUnmodifiableListView) return _issues;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_issues);
}

@override@JsonKey() final  bool hasMoreIssues;
 final  List<ImportCredential>? _credentials;
@override List<ImportCredential>? get credentials {
  final value = _credentials;
  if (value == null) return null;
  if (_credentials is EqualUnmodifiableListView) return _credentials;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of StudentImportResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StudentImportResultCopyWith<_StudentImportResult> get copyWith => __$StudentImportResultCopyWithImpl<_StudentImportResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StudentImportResultToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StudentImportResult&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.conflictMode, conflictMode) || other.conflictMode == conflictMode)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum)&&(identical(other.summary, summary) || other.summary == summary)&&const DeepCollectionEquality().equals(other._issues, _issues)&&(identical(other.hasMoreIssues, hasMoreIssues) || other.hasMoreIssues == hasMoreIssues)&&const DeepCollectionEquality().equals(other._credentials, _credentials));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mode,conflictMode,rowChecksum,summary,const DeepCollectionEquality().hash(_issues),hasMoreIssues,const DeepCollectionEquality().hash(_credentials));

@override
String toString() {
  return 'StudentImportResult(mode: $mode, conflictMode: $conflictMode, rowChecksum: $rowChecksum, summary: $summary, issues: $issues, hasMoreIssues: $hasMoreIssues, credentials: $credentials)';
}


}

/// @nodoc
abstract mixin class _$StudentImportResultCopyWith<$Res> implements $StudentImportResultCopyWith<$Res> {
  factory _$StudentImportResultCopyWith(_StudentImportResult value, $Res Function(_StudentImportResult) _then) = __$StudentImportResultCopyWithImpl;
@override @useResult
$Res call({
 ImportMode mode, ImportConflictMode conflictMode, String rowChecksum, StudentImportSummary summary, List<ImportIssue> issues, bool hasMoreIssues, List<ImportCredential>? credentials
});


@override $StudentImportSummaryCopyWith<$Res> get summary;

}
/// @nodoc
class __$StudentImportResultCopyWithImpl<$Res>
    implements _$StudentImportResultCopyWith<$Res> {
  __$StudentImportResultCopyWithImpl(this._self, this._then);

  final _StudentImportResult _self;
  final $Res Function(_StudentImportResult) _then;

/// Create a copy of StudentImportResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? mode = null,Object? conflictMode = null,Object? rowChecksum = null,Object? summary = null,Object? issues = null,Object? hasMoreIssues = null,Object? credentials = freezed,}) {
  return _then(_StudentImportResult(
mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as ImportMode,conflictMode: null == conflictMode ? _self.conflictMode : conflictMode // ignore: cast_nullable_to_non_nullable
as ImportConflictMode,rowChecksum: null == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String,summary: null == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as StudentImportSummary,issues: null == issues ? _self._issues : issues // ignore: cast_nullable_to_non_nullable
as List<ImportIssue>,hasMoreIssues: null == hasMoreIssues ? _self.hasMoreIssues : hasMoreIssues // ignore: cast_nullable_to_non_nullable
as bool,credentials: freezed == credentials ? _self._credentials : credentials // ignore: cast_nullable_to_non_nullable
as List<ImportCredential>?,
  ));
}

/// Create a copy of StudentImportResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StudentImportSummaryCopyWith<$Res> get summary {
  
  return $StudentImportSummaryCopyWith<$Res>(_self.summary, (value) {
    return _then(_self.copyWith(summary: value));
  });
}
}


/// @nodoc
mixin _$EnrollImportResult {

 ImportMode get mode; String get rowChecksum; EnrollImportSummary get summary; List<ImportIssue> get issues; bool get hasMoreIssues;
/// Create a copy of EnrollImportResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EnrollImportResultCopyWith<EnrollImportResult> get copyWith => _$EnrollImportResultCopyWithImpl<EnrollImportResult>(this as EnrollImportResult, _$identity);

  /// Serializes this EnrollImportResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EnrollImportResult&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum)&&(identical(other.summary, summary) || other.summary == summary)&&const DeepCollectionEquality().equals(other.issues, issues)&&(identical(other.hasMoreIssues, hasMoreIssues) || other.hasMoreIssues == hasMoreIssues));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mode,rowChecksum,summary,const DeepCollectionEquality().hash(issues),hasMoreIssues);

@override
String toString() {
  return 'EnrollImportResult(mode: $mode, rowChecksum: $rowChecksum, summary: $summary, issues: $issues, hasMoreIssues: $hasMoreIssues)';
}


}

/// @nodoc
abstract mixin class $EnrollImportResultCopyWith<$Res>  {
  factory $EnrollImportResultCopyWith(EnrollImportResult value, $Res Function(EnrollImportResult) _then) = _$EnrollImportResultCopyWithImpl;
@useResult
$Res call({
 ImportMode mode, String rowChecksum, EnrollImportSummary summary, List<ImportIssue> issues, bool hasMoreIssues
});


$EnrollImportSummaryCopyWith<$Res> get summary;

}
/// @nodoc
class _$EnrollImportResultCopyWithImpl<$Res>
    implements $EnrollImportResultCopyWith<$Res> {
  _$EnrollImportResultCopyWithImpl(this._self, this._then);

  final EnrollImportResult _self;
  final $Res Function(EnrollImportResult) _then;

/// Create a copy of EnrollImportResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? mode = null,Object? rowChecksum = null,Object? summary = null,Object? issues = null,Object? hasMoreIssues = null,}) {
  return _then(EnrollImportResult(
mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as ImportMode,rowChecksum: null == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String,summary: null == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as EnrollImportSummary,issues: null == issues ? _self.issues : issues // ignore: cast_nullable_to_non_nullable
as List<ImportIssue>,hasMoreIssues: null == hasMoreIssues ? _self.hasMoreIssues : hasMoreIssues // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}
/// Create a copy of EnrollImportResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$EnrollImportSummaryCopyWith<$Res> get summary {
  
  return $EnrollImportSummaryCopyWith<$Res>(_self.summary, (value) {
    return _then(_self.copyWith(summary: value));
  });
}
}


/// Adds pattern-matching-related methods to [EnrollImportResult].
extension EnrollImportResultPatterns on EnrollImportResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EnrollImportResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EnrollImportResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EnrollImportResult value)  $default,){
final _that = this;
switch (_that) {
case _EnrollImportResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EnrollImportResult value)?  $default,){
final _that = this;
switch (_that) {
case _EnrollImportResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ImportMode mode,  String rowChecksum,  EnrollImportSummary summary,  List<ImportIssue> issues,  bool hasMoreIssues)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EnrollImportResult() when $default != null:
return $default(_that.mode,_that.rowChecksum,_that.summary,_that.issues,_that.hasMoreIssues);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ImportMode mode,  String rowChecksum,  EnrollImportSummary summary,  List<ImportIssue> issues,  bool hasMoreIssues)  $default,) {final _that = this;
switch (_that) {
case _EnrollImportResult():
return $default(_that.mode,_that.rowChecksum,_that.summary,_that.issues,_that.hasMoreIssues);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ImportMode mode,  String rowChecksum,  EnrollImportSummary summary,  List<ImportIssue> issues,  bool hasMoreIssues)?  $default,) {final _that = this;
switch (_that) {
case _EnrollImportResult() when $default != null:
return $default(_that.mode,_that.rowChecksum,_that.summary,_that.issues,_that.hasMoreIssues);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ImportModeConverter()])
class _EnrollImportResult implements EnrollImportResult {
  const _EnrollImportResult({required this.mode, this.rowChecksum = '', required this.summary,  List<ImportIssue> issues = const <ImportIssue>[], this.hasMoreIssues = false}): _issues = issues;
  factory _EnrollImportResult.fromJson(Map<String, dynamic> json) => _$EnrollImportResultFromJson(json);

@override final  ImportMode mode;
@override@JsonKey() final  String rowChecksum;
@override final  EnrollImportSummary summary;
 final  List<ImportIssue> _issues;
@override@JsonKey() List<ImportIssue> get issues {
  if (_issues is EqualUnmodifiableListView) return _issues;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_issues);
}

@override@JsonKey() final  bool hasMoreIssues;

/// Create a copy of EnrollImportResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EnrollImportResultCopyWith<_EnrollImportResult> get copyWith => __$EnrollImportResultCopyWithImpl<_EnrollImportResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EnrollImportResultToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EnrollImportResult&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum)&&(identical(other.summary, summary) || other.summary == summary)&&const DeepCollectionEquality().equals(other._issues, _issues)&&(identical(other.hasMoreIssues, hasMoreIssues) || other.hasMoreIssues == hasMoreIssues));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mode,rowChecksum,summary,const DeepCollectionEquality().hash(_issues),hasMoreIssues);

@override
String toString() {
  return 'EnrollImportResult(mode: $mode, rowChecksum: $rowChecksum, summary: $summary, issues: $issues, hasMoreIssues: $hasMoreIssues)';
}


}

/// @nodoc
abstract mixin class _$EnrollImportResultCopyWith<$Res> implements $EnrollImportResultCopyWith<$Res> {
  factory _$EnrollImportResultCopyWith(_EnrollImportResult value, $Res Function(_EnrollImportResult) _then) = __$EnrollImportResultCopyWithImpl;
@override @useResult
$Res call({
 ImportMode mode, String rowChecksum, EnrollImportSummary summary, List<ImportIssue> issues, bool hasMoreIssues
});


@override $EnrollImportSummaryCopyWith<$Res> get summary;

}
/// @nodoc
class __$EnrollImportResultCopyWithImpl<$Res>
    implements _$EnrollImportResultCopyWith<$Res> {
  __$EnrollImportResultCopyWithImpl(this._self, this._then);

  final _EnrollImportResult _self;
  final $Res Function(_EnrollImportResult) _then;

/// Create a copy of EnrollImportResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? mode = null,Object? rowChecksum = null,Object? summary = null,Object? issues = null,Object? hasMoreIssues = null,}) {
  return _then(_EnrollImportResult(
mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as ImportMode,rowChecksum: null == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String,summary: null == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as EnrollImportSummary,issues: null == issues ? _self._issues : issues // ignore: cast_nullable_to_non_nullable
as List<ImportIssue>,hasMoreIssues: null == hasMoreIssues ? _self.hasMoreIssues : hasMoreIssues // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

/// Create a copy of EnrollImportResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$EnrollImportSummaryCopyWith<$Res> get summary {
  
  return $EnrollImportSummaryCopyWith<$Res>(_self.summary, (value) {
    return _then(_self.copyWith(summary: value));
  });
}
}


/// @nodoc
mixin _$ImportChunkResult {

 int get chunkIndex; int get created; int? get updated; int get skipped; int get failed;
/// Create a copy of ImportChunkResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ImportChunkResultCopyWith<ImportChunkResult> get copyWith => _$ImportChunkResultCopyWithImpl<ImportChunkResult>(this as ImportChunkResult, _$identity);

  /// Serializes this ImportChunkResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ImportChunkResult&&(identical(other.chunkIndex, chunkIndex) || other.chunkIndex == chunkIndex)&&(identical(other.created, created) || other.created == created)&&(identical(other.updated, updated) || other.updated == updated)&&(identical(other.skipped, skipped) || other.skipped == skipped)&&(identical(other.failed, failed) || other.failed == failed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,chunkIndex,created,updated,skipped,failed);

@override
String toString() {
  return 'ImportChunkResult(chunkIndex: $chunkIndex, created: $created, updated: $updated, skipped: $skipped, failed: $failed)';
}


}

/// @nodoc
abstract mixin class $ImportChunkResultCopyWith<$Res>  {
  factory $ImportChunkResultCopyWith(ImportChunkResult value, $Res Function(ImportChunkResult) _then) = _$ImportChunkResultCopyWithImpl;
@useResult
$Res call({
 int chunkIndex, int created, int? updated, int skipped, int failed
});




}
/// @nodoc
class _$ImportChunkResultCopyWithImpl<$Res>
    implements $ImportChunkResultCopyWith<$Res> {
  _$ImportChunkResultCopyWithImpl(this._self, this._then);

  final ImportChunkResult _self;
  final $Res Function(ImportChunkResult) _then;

/// Create a copy of ImportChunkResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? chunkIndex = null,Object? created = null,Object? updated = freezed,Object? skipped = null,Object? failed = null,}) {
  return _then(ImportChunkResult(
chunkIndex: null == chunkIndex ? _self.chunkIndex : chunkIndex // ignore: cast_nullable_to_non_nullable
as int,created: null == created ? _self.created : created // ignore: cast_nullable_to_non_nullable
as int,updated: freezed == updated ? _self.updated : updated // ignore: cast_nullable_to_non_nullable
as int?,skipped: null == skipped ? _self.skipped : skipped // ignore: cast_nullable_to_non_nullable
as int,failed: null == failed ? _self.failed : failed // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ImportChunkResult].
extension ImportChunkResultPatterns on ImportChunkResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ImportChunkResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ImportChunkResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ImportChunkResult value)  $default,){
final _that = this;
switch (_that) {
case _ImportChunkResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ImportChunkResult value)?  $default,){
final _that = this;
switch (_that) {
case _ImportChunkResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int chunkIndex,  int created,  int? updated,  int skipped,  int failed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ImportChunkResult() when $default != null:
return $default(_that.chunkIndex,_that.created,_that.updated,_that.skipped,_that.failed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int chunkIndex,  int created,  int? updated,  int skipped,  int failed)  $default,) {final _that = this;
switch (_that) {
case _ImportChunkResult():
return $default(_that.chunkIndex,_that.created,_that.updated,_that.skipped,_that.failed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int chunkIndex,  int created,  int? updated,  int skipped,  int failed)?  $default,) {final _that = this;
switch (_that) {
case _ImportChunkResult() when $default != null:
return $default(_that.chunkIndex,_that.created,_that.updated,_that.skipped,_that.failed);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _ImportChunkResult implements ImportChunkResult {
  const _ImportChunkResult({this.chunkIndex = 0, this.created = 0, this.updated, this.skipped = 0, this.failed = 0});
  factory _ImportChunkResult.fromJson(Map<String, dynamic> json) => _$ImportChunkResultFromJson(json);

@override@JsonKey() final  int chunkIndex;
@override@JsonKey() final  int created;
@override final  int? updated;
@override@JsonKey() final  int skipped;
@override@JsonKey() final  int failed;

/// Create a copy of ImportChunkResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ImportChunkResultCopyWith<_ImportChunkResult> get copyWith => __$ImportChunkResultCopyWithImpl<_ImportChunkResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ImportChunkResultToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ImportChunkResult&&(identical(other.chunkIndex, chunkIndex) || other.chunkIndex == chunkIndex)&&(identical(other.created, created) || other.created == created)&&(identical(other.updated, updated) || other.updated == updated)&&(identical(other.skipped, skipped) || other.skipped == skipped)&&(identical(other.failed, failed) || other.failed == failed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,chunkIndex,created,updated,skipped,failed);

@override
String toString() {
  return 'ImportChunkResult(chunkIndex: $chunkIndex, created: $created, updated: $updated, skipped: $skipped, failed: $failed)';
}


}

/// @nodoc
abstract mixin class _$ImportChunkResultCopyWith<$Res> implements $ImportChunkResultCopyWith<$Res> {
  factory _$ImportChunkResultCopyWith(_ImportChunkResult value, $Res Function(_ImportChunkResult) _then) = __$ImportChunkResultCopyWithImpl;
@override @useResult
$Res call({
 int chunkIndex, int created, int? updated, int skipped, int failed
});




}
/// @nodoc
class __$ImportChunkResultCopyWithImpl<$Res>
    implements _$ImportChunkResultCopyWith<$Res> {
  __$ImportChunkResultCopyWithImpl(this._self, this._then);

  final _ImportChunkResult _self;
  final $Res Function(_ImportChunkResult) _then;

/// Create a copy of ImportChunkResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? chunkIndex = null,Object? created = null,Object? updated = freezed,Object? skipped = null,Object? failed = null,}) {
  return _then(_ImportChunkResult(
chunkIndex: null == chunkIndex ? _self.chunkIndex : chunkIndex // ignore: cast_nullable_to_non_nullable
as int,created: null == created ? _self.created : created // ignore: cast_nullable_to_non_nullable
as int,updated: freezed == updated ? _self.updated : updated // ignore: cast_nullable_to_non_nullable
as int?,skipped: null == skipped ? _self.skipped : skipped // ignore: cast_nullable_to_non_nullable
as int,failed: null == failed ? _self.failed : failed // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$StudentImportRequest {

 ImportMode get mode; ImportConflictMode get conflictMode; List<StudentImportRow> get rows; String? get idempotencyKey; String? get rowChecksum;
/// Create a copy of StudentImportRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$StudentImportRequestCopyWith<StudentImportRequest> get copyWith => _$StudentImportRequestCopyWithImpl<StudentImportRequest>(this as StudentImportRequest, _$identity);

  /// Serializes this StudentImportRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is StudentImportRequest&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.conflictMode, conflictMode) || other.conflictMode == conflictMode)&&const DeepCollectionEquality().equals(other.rows, rows)&&(identical(other.idempotencyKey, idempotencyKey) || other.idempotencyKey == idempotencyKey)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mode,conflictMode,const DeepCollectionEquality().hash(rows),idempotencyKey,rowChecksum);

@override
String toString() {
  return 'StudentImportRequest(mode: $mode, conflictMode: $conflictMode, rows: $rows, idempotencyKey: $idempotencyKey, rowChecksum: $rowChecksum)';
}


}

/// @nodoc
abstract mixin class $StudentImportRequestCopyWith<$Res>  {
  factory $StudentImportRequestCopyWith(StudentImportRequest value, $Res Function(StudentImportRequest) _then) = _$StudentImportRequestCopyWithImpl;
@useResult
$Res call({
 ImportMode mode, ImportConflictMode conflictMode, List<StudentImportRow> rows, String? idempotencyKey, String? rowChecksum
});




}
/// @nodoc
class _$StudentImportRequestCopyWithImpl<$Res>
    implements $StudentImportRequestCopyWith<$Res> {
  _$StudentImportRequestCopyWithImpl(this._self, this._then);

  final StudentImportRequest _self;
  final $Res Function(StudentImportRequest) _then;

/// Create a copy of StudentImportRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? mode = null,Object? conflictMode = null,Object? rows = null,Object? idempotencyKey = freezed,Object? rowChecksum = freezed,}) {
  return _then(StudentImportRequest(
mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as ImportMode,conflictMode: null == conflictMode ? _self.conflictMode : conflictMode // ignore: cast_nullable_to_non_nullable
as ImportConflictMode,rows: null == rows ? _self.rows : rows // ignore: cast_nullable_to_non_nullable
as List<StudentImportRow>,idempotencyKey: freezed == idempotencyKey ? _self.idempotencyKey : idempotencyKey // ignore: cast_nullable_to_non_nullable
as String?,rowChecksum: freezed == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [StudentImportRequest].
extension StudentImportRequestPatterns on StudentImportRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _StudentImportRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _StudentImportRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _StudentImportRequest value)  $default,){
final _that = this;
switch (_that) {
case _StudentImportRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _StudentImportRequest value)?  $default,){
final _that = this;
switch (_that) {
case _StudentImportRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ImportMode mode,  ImportConflictMode conflictMode,  List<StudentImportRow> rows,  String? idempotencyKey,  String? rowChecksum)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _StudentImportRequest() when $default != null:
return $default(_that.mode,_that.conflictMode,_that.rows,_that.idempotencyKey,_that.rowChecksum);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ImportMode mode,  ImportConflictMode conflictMode,  List<StudentImportRow> rows,  String? idempotencyKey,  String? rowChecksum)  $default,) {final _that = this;
switch (_that) {
case _StudentImportRequest():
return $default(_that.mode,_that.conflictMode,_that.rows,_that.idempotencyKey,_that.rowChecksum);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ImportMode mode,  ImportConflictMode conflictMode,  List<StudentImportRow> rows,  String? idempotencyKey,  String? rowChecksum)?  $default,) {final _that = this;
switch (_that) {
case _StudentImportRequest() when $default != null:
return $default(_that.mode,_that.conflictMode,_that.rows,_that.idempotencyKey,_that.rowChecksum);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ImportModeConverter(), ImportConflictModeConverter()])
class _StudentImportRequest implements StudentImportRequest {
  const _StudentImportRequest({required this.mode, required this.conflictMode,  List<StudentImportRow> rows = const <StudentImportRow>[], this.idempotencyKey, this.rowChecksum}): _rows = rows;
  factory _StudentImportRequest.fromJson(Map<String, dynamic> json) => _$StudentImportRequestFromJson(json);

@override final  ImportMode mode;
@override final  ImportConflictMode conflictMode;
 final  List<StudentImportRow> _rows;
@override@JsonKey() List<StudentImportRow> get rows {
  if (_rows is EqualUnmodifiableListView) return _rows;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_rows);
}

@override final  String? idempotencyKey;
@override final  String? rowChecksum;

/// Create a copy of StudentImportRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$StudentImportRequestCopyWith<_StudentImportRequest> get copyWith => __$StudentImportRequestCopyWithImpl<_StudentImportRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$StudentImportRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _StudentImportRequest&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.conflictMode, conflictMode) || other.conflictMode == conflictMode)&&const DeepCollectionEquality().equals(other._rows, _rows)&&(identical(other.idempotencyKey, idempotencyKey) || other.idempotencyKey == idempotencyKey)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mode,conflictMode,const DeepCollectionEquality().hash(_rows),idempotencyKey,rowChecksum);

@override
String toString() {
  return 'StudentImportRequest(mode: $mode, conflictMode: $conflictMode, rows: $rows, idempotencyKey: $idempotencyKey, rowChecksum: $rowChecksum)';
}


}

/// @nodoc
abstract mixin class _$StudentImportRequestCopyWith<$Res> implements $StudentImportRequestCopyWith<$Res> {
  factory _$StudentImportRequestCopyWith(_StudentImportRequest value, $Res Function(_StudentImportRequest) _then) = __$StudentImportRequestCopyWithImpl;
@override @useResult
$Res call({
 ImportMode mode, ImportConflictMode conflictMode, List<StudentImportRow> rows, String? idempotencyKey, String? rowChecksum
});




}
/// @nodoc
class __$StudentImportRequestCopyWithImpl<$Res>
    implements _$StudentImportRequestCopyWith<$Res> {
  __$StudentImportRequestCopyWithImpl(this._self, this._then);

  final _StudentImportRequest _self;
  final $Res Function(_StudentImportRequest) _then;

/// Create a copy of StudentImportRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? mode = null,Object? conflictMode = null,Object? rows = null,Object? idempotencyKey = freezed,Object? rowChecksum = freezed,}) {
  return _then(_StudentImportRequest(
mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as ImportMode,conflictMode: null == conflictMode ? _self.conflictMode : conflictMode // ignore: cast_nullable_to_non_nullable
as ImportConflictMode,rows: null == rows ? _self._rows : rows // ignore: cast_nullable_to_non_nullable
as List<StudentImportRow>,idempotencyKey: freezed == idempotencyKey ? _self.idempotencyKey : idempotencyKey // ignore: cast_nullable_to_non_nullable
as String?,rowChecksum: freezed == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$EnrollImportRequest {

 ImportMode get mode; List<EnrollImportRow> get rows; String? get idempotencyKey; String? get rowChecksum;
/// Create a copy of EnrollImportRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EnrollImportRequestCopyWith<EnrollImportRequest> get copyWith => _$EnrollImportRequestCopyWithImpl<EnrollImportRequest>(this as EnrollImportRequest, _$identity);

  /// Serializes this EnrollImportRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EnrollImportRequest&&(identical(other.mode, mode) || other.mode == mode)&&const DeepCollectionEquality().equals(other.rows, rows)&&(identical(other.idempotencyKey, idempotencyKey) || other.idempotencyKey == idempotencyKey)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mode,const DeepCollectionEquality().hash(rows),idempotencyKey,rowChecksum);

@override
String toString() {
  return 'EnrollImportRequest(mode: $mode, rows: $rows, idempotencyKey: $idempotencyKey, rowChecksum: $rowChecksum)';
}


}

/// @nodoc
abstract mixin class $EnrollImportRequestCopyWith<$Res>  {
  factory $EnrollImportRequestCopyWith(EnrollImportRequest value, $Res Function(EnrollImportRequest) _then) = _$EnrollImportRequestCopyWithImpl;
@useResult
$Res call({
 ImportMode mode, List<EnrollImportRow> rows, String? idempotencyKey, String? rowChecksum
});




}
/// @nodoc
class _$EnrollImportRequestCopyWithImpl<$Res>
    implements $EnrollImportRequestCopyWith<$Res> {
  _$EnrollImportRequestCopyWithImpl(this._self, this._then);

  final EnrollImportRequest _self;
  final $Res Function(EnrollImportRequest) _then;

/// Create a copy of EnrollImportRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? mode = null,Object? rows = null,Object? idempotencyKey = freezed,Object? rowChecksum = freezed,}) {
  return _then(EnrollImportRequest(
mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as ImportMode,rows: null == rows ? _self.rows : rows // ignore: cast_nullable_to_non_nullable
as List<EnrollImportRow>,idempotencyKey: freezed == idempotencyKey ? _self.idempotencyKey : idempotencyKey // ignore: cast_nullable_to_non_nullable
as String?,rowChecksum: freezed == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [EnrollImportRequest].
extension EnrollImportRequestPatterns on EnrollImportRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EnrollImportRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EnrollImportRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EnrollImportRequest value)  $default,){
final _that = this;
switch (_that) {
case _EnrollImportRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EnrollImportRequest value)?  $default,){
final _that = this;
switch (_that) {
case _EnrollImportRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ImportMode mode,  List<EnrollImportRow> rows,  String? idempotencyKey,  String? rowChecksum)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EnrollImportRequest() when $default != null:
return $default(_that.mode,_that.rows,_that.idempotencyKey,_that.rowChecksum);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ImportMode mode,  List<EnrollImportRow> rows,  String? idempotencyKey,  String? rowChecksum)  $default,) {final _that = this;
switch (_that) {
case _EnrollImportRequest():
return $default(_that.mode,_that.rows,_that.idempotencyKey,_that.rowChecksum);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ImportMode mode,  List<EnrollImportRow> rows,  String? idempotencyKey,  String? rowChecksum)?  $default,) {final _that = this;
switch (_that) {
case _EnrollImportRequest() when $default != null:
return $default(_that.mode,_that.rows,_that.idempotencyKey,_that.rowChecksum);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ImportModeConverter()])
class _EnrollImportRequest implements EnrollImportRequest {
  const _EnrollImportRequest({required this.mode,  List<EnrollImportRow> rows = const <EnrollImportRow>[], this.idempotencyKey, this.rowChecksum}): _rows = rows;
  factory _EnrollImportRequest.fromJson(Map<String, dynamic> json) => _$EnrollImportRequestFromJson(json);

@override final  ImportMode mode;
 final  List<EnrollImportRow> _rows;
@override@JsonKey() List<EnrollImportRow> get rows {
  if (_rows is EqualUnmodifiableListView) return _rows;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_rows);
}

@override final  String? idempotencyKey;
@override final  String? rowChecksum;

/// Create a copy of EnrollImportRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EnrollImportRequestCopyWith<_EnrollImportRequest> get copyWith => __$EnrollImportRequestCopyWithImpl<_EnrollImportRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EnrollImportRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EnrollImportRequest&&(identical(other.mode, mode) || other.mode == mode)&&const DeepCollectionEquality().equals(other._rows, _rows)&&(identical(other.idempotencyKey, idempotencyKey) || other.idempotencyKey == idempotencyKey)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,mode,const DeepCollectionEquality().hash(_rows),idempotencyKey,rowChecksum);

@override
String toString() {
  return 'EnrollImportRequest(mode: $mode, rows: $rows, idempotencyKey: $idempotencyKey, rowChecksum: $rowChecksum)';
}


}

/// @nodoc
abstract mixin class _$EnrollImportRequestCopyWith<$Res> implements $EnrollImportRequestCopyWith<$Res> {
  factory _$EnrollImportRequestCopyWith(_EnrollImportRequest value, $Res Function(_EnrollImportRequest) _then) = __$EnrollImportRequestCopyWithImpl;
@override @useResult
$Res call({
 ImportMode mode, List<EnrollImportRow> rows, String? idempotencyKey, String? rowChecksum
});




}
/// @nodoc
class __$EnrollImportRequestCopyWithImpl<$Res>
    implements _$EnrollImportRequestCopyWith<$Res> {
  __$EnrollImportRequestCopyWithImpl(this._self, this._then);

  final _EnrollImportRequest _self;
  final $Res Function(_EnrollImportRequest) _then;

/// Create a copy of EnrollImportRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? mode = null,Object? rows = null,Object? idempotencyKey = freezed,Object? rowChecksum = freezed,}) {
  return _then(_EnrollImportRequest(
mode: null == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as ImportMode,rows: null == rows ? _self._rows : rows // ignore: cast_nullable_to_non_nullable
as List<EnrollImportRow>,idempotencyKey: freezed == idempotencyKey ? _self.idempotencyKey : idempotencyKey // ignore: cast_nullable_to_non_nullable
as String?,rowChecksum: freezed == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$ImportJobProgress {

 int get chunksDone; int get chunksTotal;
/// Create a copy of ImportJobProgress
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ImportJobProgressCopyWith<ImportJobProgress> get copyWith => _$ImportJobProgressCopyWithImpl<ImportJobProgress>(this as ImportJobProgress, _$identity);

  /// Serializes this ImportJobProgress to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ImportJobProgress&&(identical(other.chunksDone, chunksDone) || other.chunksDone == chunksDone)&&(identical(other.chunksTotal, chunksTotal) || other.chunksTotal == chunksTotal));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,chunksDone,chunksTotal);

@override
String toString() {
  return 'ImportJobProgress(chunksDone: $chunksDone, chunksTotal: $chunksTotal)';
}


}

/// @nodoc
abstract mixin class $ImportJobProgressCopyWith<$Res>  {
  factory $ImportJobProgressCopyWith(ImportJobProgress value, $Res Function(ImportJobProgress) _then) = _$ImportJobProgressCopyWithImpl;
@useResult
$Res call({
 int chunksDone, int chunksTotal
});




}
/// @nodoc
class _$ImportJobProgressCopyWithImpl<$Res>
    implements $ImportJobProgressCopyWith<$Res> {
  _$ImportJobProgressCopyWithImpl(this._self, this._then);

  final ImportJobProgress _self;
  final $Res Function(ImportJobProgress) _then;

/// Create a copy of ImportJobProgress
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? chunksDone = null,Object? chunksTotal = null,}) {
  return _then(ImportJobProgress(
chunksDone: null == chunksDone ? _self.chunksDone : chunksDone // ignore: cast_nullable_to_non_nullable
as int,chunksTotal: null == chunksTotal ? _self.chunksTotal : chunksTotal // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ImportJobProgress].
extension ImportJobProgressPatterns on ImportJobProgress {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ImportJobProgress value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ImportJobProgress() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ImportJobProgress value)  $default,){
final _that = this;
switch (_that) {
case _ImportJobProgress():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ImportJobProgress value)?  $default,){
final _that = this;
switch (_that) {
case _ImportJobProgress() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int chunksDone,  int chunksTotal)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ImportJobProgress() when $default != null:
return $default(_that.chunksDone,_that.chunksTotal);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int chunksDone,  int chunksTotal)  $default,) {final _that = this;
switch (_that) {
case _ImportJobProgress():
return $default(_that.chunksDone,_that.chunksTotal);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int chunksDone,  int chunksTotal)?  $default,) {final _that = this;
switch (_that) {
case _ImportJobProgress() when $default != null:
return $default(_that.chunksDone,_that.chunksTotal);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _ImportJobProgress implements ImportJobProgress {
  const _ImportJobProgress({this.chunksDone = 0, this.chunksTotal = 0});
  factory _ImportJobProgress.fromJson(Map<String, dynamic> json) => _$ImportJobProgressFromJson(json);

@override@JsonKey() final  int chunksDone;
@override@JsonKey() final  int chunksTotal;

/// Create a copy of ImportJobProgress
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ImportJobProgressCopyWith<_ImportJobProgress> get copyWith => __$ImportJobProgressCopyWithImpl<_ImportJobProgress>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ImportJobProgressToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ImportJobProgress&&(identical(other.chunksDone, chunksDone) || other.chunksDone == chunksDone)&&(identical(other.chunksTotal, chunksTotal) || other.chunksTotal == chunksTotal));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,chunksDone,chunksTotal);

@override
String toString() {
  return 'ImportJobProgress(chunksDone: $chunksDone, chunksTotal: $chunksTotal)';
}


}

/// @nodoc
abstract mixin class _$ImportJobProgressCopyWith<$Res> implements $ImportJobProgressCopyWith<$Res> {
  factory _$ImportJobProgressCopyWith(_ImportJobProgress value, $Res Function(_ImportJobProgress) _then) = __$ImportJobProgressCopyWithImpl;
@override @useResult
$Res call({
 int chunksDone, int chunksTotal
});




}
/// @nodoc
class __$ImportJobProgressCopyWithImpl<$Res>
    implements _$ImportJobProgressCopyWith<$Res> {
  __$ImportJobProgressCopyWithImpl(this._self, this._then);

  final _ImportJobProgress _self;
  final $Res Function(_ImportJobProgress) _then;

/// Create a copy of ImportJobProgress
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? chunksDone = null,Object? chunksTotal = null,}) {
  return _then(_ImportJobProgress(
chunksDone: null == chunksDone ? _self.chunksDone : chunksDone // ignore: cast_nullable_to_non_nullable
as int,chunksTotal: null == chunksTotal ? _self.chunksTotal : chunksTotal // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ImportJobStatus {

 String get id; ImportJobState get state; ImportJobProgress? get progress; StudentImportResult? get result; String? get error;
/// Create a copy of ImportJobStatus
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ImportJobStatusCopyWith<ImportJobStatus> get copyWith => _$ImportJobStatusCopyWithImpl<ImportJobStatus>(this as ImportJobStatus, _$identity);

  /// Serializes this ImportJobStatus to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ImportJobStatus&&(identical(other.id, id) || other.id == id)&&(identical(other.state, state) || other.state == state)&&(identical(other.progress, progress) || other.progress == progress)&&(identical(other.result, result) || other.result == result)&&(identical(other.error, error) || other.error == error));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,state,progress,result,error);

@override
String toString() {
  return 'ImportJobStatus(id: $id, state: $state, progress: $progress, result: $result, error: $error)';
}


}

/// @nodoc
abstract mixin class $ImportJobStatusCopyWith<$Res>  {
  factory $ImportJobStatusCopyWith(ImportJobStatus value, $Res Function(ImportJobStatus) _then) = _$ImportJobStatusCopyWithImpl;
@useResult
$Res call({
 String id, ImportJobState state, ImportJobProgress? progress, StudentImportResult? result, String? error
});


$ImportJobProgressCopyWith<$Res>? get progress;$StudentImportResultCopyWith<$Res>? get result;

}
/// @nodoc
class _$ImportJobStatusCopyWithImpl<$Res>
    implements $ImportJobStatusCopyWith<$Res> {
  _$ImportJobStatusCopyWithImpl(this._self, this._then);

  final ImportJobStatus _self;
  final $Res Function(ImportJobStatus) _then;

/// Create a copy of ImportJobStatus
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? state = null,Object? progress = freezed,Object? result = freezed,Object? error = freezed,}) {
  return _then(ImportJobStatus(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as ImportJobState,progress: freezed == progress ? _self.progress : progress // ignore: cast_nullable_to_non_nullable
as ImportJobProgress?,result: freezed == result ? _self.result : result // ignore: cast_nullable_to_non_nullable
as StudentImportResult?,error: freezed == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of ImportJobStatus
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ImportJobProgressCopyWith<$Res>? get progress {
    if (_self.progress == null) {
    return null;
  }

  return $ImportJobProgressCopyWith<$Res>(_self.progress!, (value) {
    return _then(_self.copyWith(progress: value));
  });
}/// Create a copy of ImportJobStatus
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StudentImportResultCopyWith<$Res>? get result {
    if (_self.result == null) {
    return null;
  }

  return $StudentImportResultCopyWith<$Res>(_self.result!, (value) {
    return _then(_self.copyWith(result: value));
  });
}
}


/// Adds pattern-matching-related methods to [ImportJobStatus].
extension ImportJobStatusPatterns on ImportJobStatus {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ImportJobStatus value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ImportJobStatus() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ImportJobStatus value)  $default,){
final _that = this;
switch (_that) {
case _ImportJobStatus():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ImportJobStatus value)?  $default,){
final _that = this;
switch (_that) {
case _ImportJobStatus() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  ImportJobState state,  ImportJobProgress? progress,  StudentImportResult? result,  String? error)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ImportJobStatus() when $default != null:
return $default(_that.id,_that.state,_that.progress,_that.result,_that.error);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  ImportJobState state,  ImportJobProgress? progress,  StudentImportResult? result,  String? error)  $default,) {final _that = this;
switch (_that) {
case _ImportJobStatus():
return $default(_that.id,_that.state,_that.progress,_that.result,_that.error);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  ImportJobState state,  ImportJobProgress? progress,  StudentImportResult? result,  String? error)?  $default,) {final _that = this;
switch (_that) {
case _ImportJobStatus() when $default != null:
return $default(_that.id,_that.state,_that.progress,_that.result,_that.error);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ImportJobStateConverter()])
class _ImportJobStatus implements ImportJobStatus {
  const _ImportJobStatus({required this.id, required this.state, this.progress, this.result, this.error});
  factory _ImportJobStatus.fromJson(Map<String, dynamic> json) => _$ImportJobStatusFromJson(json);

@override final  String id;
@override final  ImportJobState state;
@override final  ImportJobProgress? progress;
@override final  StudentImportResult? result;
@override final  String? error;

/// Create a copy of ImportJobStatus
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ImportJobStatusCopyWith<_ImportJobStatus> get copyWith => __$ImportJobStatusCopyWithImpl<_ImportJobStatus>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ImportJobStatusToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ImportJobStatus&&(identical(other.id, id) || other.id == id)&&(identical(other.state, state) || other.state == state)&&(identical(other.progress, progress) || other.progress == progress)&&(identical(other.result, result) || other.result == result)&&(identical(other.error, error) || other.error == error));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,state,progress,result,error);

@override
String toString() {
  return 'ImportJobStatus(id: $id, state: $state, progress: $progress, result: $result, error: $error)';
}


}

/// @nodoc
abstract mixin class _$ImportJobStatusCopyWith<$Res> implements $ImportJobStatusCopyWith<$Res> {
  factory _$ImportJobStatusCopyWith(_ImportJobStatus value, $Res Function(_ImportJobStatus) _then) = __$ImportJobStatusCopyWithImpl;
@override @useResult
$Res call({
 String id, ImportJobState state, ImportJobProgress? progress, StudentImportResult? result, String? error
});


@override $ImportJobProgressCopyWith<$Res>? get progress;@override $StudentImportResultCopyWith<$Res>? get result;

}
/// @nodoc
class __$ImportJobStatusCopyWithImpl<$Res>
    implements _$ImportJobStatusCopyWith<$Res> {
  __$ImportJobStatusCopyWithImpl(this._self, this._then);

  final _ImportJobStatus _self;
  final $Res Function(_ImportJobStatus) _then;

/// Create a copy of ImportJobStatus
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? state = null,Object? progress = freezed,Object? result = freezed,Object? error = freezed,}) {
  return _then(_ImportJobStatus(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,state: null == state ? _self.state : state // ignore: cast_nullable_to_non_nullable
as ImportJobState,progress: freezed == progress ? _self.progress : progress // ignore: cast_nullable_to_non_nullable
as ImportJobProgress?,result: freezed == result ? _self.result : result // ignore: cast_nullable_to_non_nullable
as StudentImportResult?,error: freezed == error ? _self.error : error // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of ImportJobStatus
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ImportJobProgressCopyWith<$Res>? get progress {
    if (_self.progress == null) {
    return null;
  }

  return $ImportJobProgressCopyWith<$Res>(_self.progress!, (value) {
    return _then(_self.copyWith(progress: value));
  });
}/// Create a copy of ImportJobStatus
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$StudentImportResultCopyWith<$Res>? get result {
    if (_self.result == null) {
    return null;
  }

  return $StudentImportResultCopyWith<$Res>(_self.result!, (value) {
    return _then(_self.copyWith(result: value));
  });
}
}


/// @nodoc
mixin _$ImportBatchSummary {

 String get id; ImportBatchKind get kind; String get actorId; String? get department; String get createdAt; int get total; int get created; int get updated; int get skipped; int get failed; String get rowChecksum;
/// Create a copy of ImportBatchSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ImportBatchSummaryCopyWith<ImportBatchSummary> get copyWith => _$ImportBatchSummaryCopyWithImpl<ImportBatchSummary>(this as ImportBatchSummary, _$identity);

  /// Serializes this ImportBatchSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ImportBatchSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.actorId, actorId) || other.actorId == actorId)&&(identical(other.department, department) || other.department == department)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.total, total) || other.total == total)&&(identical(other.created, created) || other.created == created)&&(identical(other.updated, updated) || other.updated == updated)&&(identical(other.skipped, skipped) || other.skipped == skipped)&&(identical(other.failed, failed) || other.failed == failed)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,kind,actorId,department,createdAt,total,created,updated,skipped,failed,rowChecksum);

@override
String toString() {
  return 'ImportBatchSummary(id: $id, kind: $kind, actorId: $actorId, department: $department, createdAt: $createdAt, total: $total, created: $created, updated: $updated, skipped: $skipped, failed: $failed, rowChecksum: $rowChecksum)';
}


}

/// @nodoc
abstract mixin class $ImportBatchSummaryCopyWith<$Res>  {
  factory $ImportBatchSummaryCopyWith(ImportBatchSummary value, $Res Function(ImportBatchSummary) _then) = _$ImportBatchSummaryCopyWithImpl;
@useResult
$Res call({
 String id, ImportBatchKind kind, String actorId, String? department, String createdAt, int total, int created, int updated, int skipped, int failed, String rowChecksum
});




}
/// @nodoc
class _$ImportBatchSummaryCopyWithImpl<$Res>
    implements $ImportBatchSummaryCopyWith<$Res> {
  _$ImportBatchSummaryCopyWithImpl(this._self, this._then);

  final ImportBatchSummary _self;
  final $Res Function(ImportBatchSummary) _then;

/// Create a copy of ImportBatchSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? kind = null,Object? actorId = null,Object? department = freezed,Object? createdAt = null,Object? total = null,Object? created = null,Object? updated = null,Object? skipped = null,Object? failed = null,Object? rowChecksum = null,}) {
  return _then(ImportBatchSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as ImportBatchKind,actorId: null == actorId ? _self.actorId : actorId // ignore: cast_nullable_to_non_nullable
as String,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,created: null == created ? _self.created : created // ignore: cast_nullable_to_non_nullable
as int,updated: null == updated ? _self.updated : updated // ignore: cast_nullable_to_non_nullable
as int,skipped: null == skipped ? _self.skipped : skipped // ignore: cast_nullable_to_non_nullable
as int,failed: null == failed ? _self.failed : failed // ignore: cast_nullable_to_non_nullable
as int,rowChecksum: null == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ImportBatchSummary].
extension ImportBatchSummaryPatterns on ImportBatchSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ImportBatchSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ImportBatchSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ImportBatchSummary value)  $default,){
final _that = this;
switch (_that) {
case _ImportBatchSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ImportBatchSummary value)?  $default,){
final _that = this;
switch (_that) {
case _ImportBatchSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  ImportBatchKind kind,  String actorId,  String? department,  String createdAt,  int total,  int created,  int updated,  int skipped,  int failed,  String rowChecksum)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ImportBatchSummary() when $default != null:
return $default(_that.id,_that.kind,_that.actorId,_that.department,_that.createdAt,_that.total,_that.created,_that.updated,_that.skipped,_that.failed,_that.rowChecksum);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  ImportBatchKind kind,  String actorId,  String? department,  String createdAt,  int total,  int created,  int updated,  int skipped,  int failed,  String rowChecksum)  $default,) {final _that = this;
switch (_that) {
case _ImportBatchSummary():
return $default(_that.id,_that.kind,_that.actorId,_that.department,_that.createdAt,_that.total,_that.created,_that.updated,_that.skipped,_that.failed,_that.rowChecksum);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  ImportBatchKind kind,  String actorId,  String? department,  String createdAt,  int total,  int created,  int updated,  int skipped,  int failed,  String rowChecksum)?  $default,) {final _that = this;
switch (_that) {
case _ImportBatchSummary() when $default != null:
return $default(_that.id,_that.kind,_that.actorId,_that.department,_that.createdAt,_that.total,_that.created,_that.updated,_that.skipped,_that.failed,_that.rowChecksum);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ImportBatchKindConverter()])
class _ImportBatchSummary implements ImportBatchSummary {
  const _ImportBatchSummary({required this.id, required this.kind, this.actorId = '', this.department, this.createdAt = '', this.total = 0, this.created = 0, this.updated = 0, this.skipped = 0, this.failed = 0, this.rowChecksum = ''});
  factory _ImportBatchSummary.fromJson(Map<String, dynamic> json) => _$ImportBatchSummaryFromJson(json);

@override final  String id;
@override final  ImportBatchKind kind;
@override@JsonKey() final  String actorId;
@override final  String? department;
@override@JsonKey() final  String createdAt;
@override@JsonKey() final  int total;
@override@JsonKey() final  int created;
@override@JsonKey() final  int updated;
@override@JsonKey() final  int skipped;
@override@JsonKey() final  int failed;
@override@JsonKey() final  String rowChecksum;

/// Create a copy of ImportBatchSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ImportBatchSummaryCopyWith<_ImportBatchSummary> get copyWith => __$ImportBatchSummaryCopyWithImpl<_ImportBatchSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ImportBatchSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ImportBatchSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.actorId, actorId) || other.actorId == actorId)&&(identical(other.department, department) || other.department == department)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.total, total) || other.total == total)&&(identical(other.created, created) || other.created == created)&&(identical(other.updated, updated) || other.updated == updated)&&(identical(other.skipped, skipped) || other.skipped == skipped)&&(identical(other.failed, failed) || other.failed == failed)&&(identical(other.rowChecksum, rowChecksum) || other.rowChecksum == rowChecksum));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,kind,actorId,department,createdAt,total,created,updated,skipped,failed,rowChecksum);

@override
String toString() {
  return 'ImportBatchSummary(id: $id, kind: $kind, actorId: $actorId, department: $department, createdAt: $createdAt, total: $total, created: $created, updated: $updated, skipped: $skipped, failed: $failed, rowChecksum: $rowChecksum)';
}


}

/// @nodoc
abstract mixin class _$ImportBatchSummaryCopyWith<$Res> implements $ImportBatchSummaryCopyWith<$Res> {
  factory _$ImportBatchSummaryCopyWith(_ImportBatchSummary value, $Res Function(_ImportBatchSummary) _then) = __$ImportBatchSummaryCopyWithImpl;
@override @useResult
$Res call({
 String id, ImportBatchKind kind, String actorId, String? department, String createdAt, int total, int created, int updated, int skipped, int failed, String rowChecksum
});




}
/// @nodoc
class __$ImportBatchSummaryCopyWithImpl<$Res>
    implements _$ImportBatchSummaryCopyWith<$Res> {
  __$ImportBatchSummaryCopyWithImpl(this._self, this._then);

  final _ImportBatchSummary _self;
  final $Res Function(_ImportBatchSummary) _then;

/// Create a copy of ImportBatchSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? kind = null,Object? actorId = null,Object? department = freezed,Object? createdAt = null,Object? total = null,Object? created = null,Object? updated = null,Object? skipped = null,Object? failed = null,Object? rowChecksum = null,}) {
  return _then(_ImportBatchSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as ImportBatchKind,actorId: null == actorId ? _self.actorId : actorId // ignore: cast_nullable_to_non_nullable
as String,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,created: null == created ? _self.created : created // ignore: cast_nullable_to_non_nullable
as int,updated: null == updated ? _self.updated : updated // ignore: cast_nullable_to_non_nullable
as int,skipped: null == skipped ? _self.skipped : skipped // ignore: cast_nullable_to_non_nullable
as int,failed: null == failed ? _self.failed : failed // ignore: cast_nullable_to_non_nullable
as int,rowChecksum: null == rowChecksum ? _self.rowChecksum : rowChecksum // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
