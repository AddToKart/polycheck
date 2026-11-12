// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'api.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$CreateSubjectInput {

 String get name; String get code; String? get description;
/// Create a copy of CreateSubjectInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateSubjectInputCopyWith<CreateSubjectInput> get copyWith => _$CreateSubjectInputCopyWithImpl<CreateSubjectInput>(this as CreateSubjectInput, _$identity);

  /// Serializes this CreateSubjectInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateSubjectInput&&(identical(other.name, name) || other.name == name)&&(identical(other.code, code) || other.code == code)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,code,description);

@override
String toString() {
  return 'CreateSubjectInput(name: $name, code: $code, description: $description)';
}


}

/// @nodoc
abstract mixin class $CreateSubjectInputCopyWith<$Res>  {
  factory $CreateSubjectInputCopyWith(CreateSubjectInput value, $Res Function(CreateSubjectInput) _then) = _$CreateSubjectInputCopyWithImpl;
@useResult
$Res call({
 String name, String code, String? description
});




}
/// @nodoc
class _$CreateSubjectInputCopyWithImpl<$Res>
    implements $CreateSubjectInputCopyWith<$Res> {
  _$CreateSubjectInputCopyWithImpl(this._self, this._then);

  final CreateSubjectInput _self;
  final $Res Function(CreateSubjectInput) _then;

/// Create a copy of CreateSubjectInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? code = null,Object? description = freezed,}) {
  return _then(CreateSubjectInput(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateSubjectInput].
extension CreateSubjectInputPatterns on CreateSubjectInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateSubjectInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateSubjectInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateSubjectInput value)  $default,){
final _that = this;
switch (_that) {
case _CreateSubjectInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateSubjectInput value)?  $default,){
final _that = this;
switch (_that) {
case _CreateSubjectInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  String code,  String? description)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateSubjectInput() when $default != null:
return $default(_that.name,_that.code,_that.description);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  String code,  String? description)  $default,) {final _that = this;
switch (_that) {
case _CreateSubjectInput():
return $default(_that.name,_that.code,_that.description);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  String code,  String? description)?  $default,) {final _that = this;
switch (_that) {
case _CreateSubjectInput() when $default != null:
return $default(_that.name,_that.code,_that.description);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _CreateSubjectInput implements CreateSubjectInput {
  const _CreateSubjectInput({required this.name, required this.code, this.description});
  factory _CreateSubjectInput.fromJson(Map<String, dynamic> json) => _$CreateSubjectInputFromJson(json);

@override final  String name;
@override final  String code;
@override final  String? description;

/// Create a copy of CreateSubjectInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateSubjectInputCopyWith<_CreateSubjectInput> get copyWith => __$CreateSubjectInputCopyWithImpl<_CreateSubjectInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateSubjectInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateSubjectInput&&(identical(other.name, name) || other.name == name)&&(identical(other.code, code) || other.code == code)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,code,description);

@override
String toString() {
  return 'CreateSubjectInput(name: $name, code: $code, description: $description)';
}


}

/// @nodoc
abstract mixin class _$CreateSubjectInputCopyWith<$Res> implements $CreateSubjectInputCopyWith<$Res> {
  factory _$CreateSubjectInputCopyWith(_CreateSubjectInput value, $Res Function(_CreateSubjectInput) _then) = __$CreateSubjectInputCopyWithImpl;
@override @useResult
$Res call({
 String name, String code, String? description
});




}
/// @nodoc
class __$CreateSubjectInputCopyWithImpl<$Res>
    implements _$CreateSubjectInputCopyWith<$Res> {
  __$CreateSubjectInputCopyWithImpl(this._self, this._then);

  final _CreateSubjectInput _self;
  final $Res Function(_CreateSubjectInput) _then;

/// Create a copy of CreateSubjectInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? code = null,Object? description = freezed,}) {
  return _then(_CreateSubjectInput(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,code: null == code ? _self.code : code // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CreateTeacherInput {

 String get fullName; String get email; String? get password; String? get department;
/// Create a copy of CreateTeacherInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateTeacherInputCopyWith<CreateTeacherInput> get copyWith => _$CreateTeacherInputCopyWithImpl<CreateTeacherInput>(this as CreateTeacherInput, _$identity);

  /// Serializes this CreateTeacherInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateTeacherInput&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.email, email) || other.email == email)&&(identical(other.password, password) || other.password == password)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fullName,email,password,department);

@override
String toString() {
  return 'CreateTeacherInput(fullName: $fullName, email: $email, password: $password, department: $department)';
}


}

/// @nodoc
abstract mixin class $CreateTeacherInputCopyWith<$Res>  {
  factory $CreateTeacherInputCopyWith(CreateTeacherInput value, $Res Function(CreateTeacherInput) _then) = _$CreateTeacherInputCopyWithImpl;
@useResult
$Res call({
 String fullName, String email, String? password, String? department
});




}
/// @nodoc
class _$CreateTeacherInputCopyWithImpl<$Res>
    implements $CreateTeacherInputCopyWith<$Res> {
  _$CreateTeacherInputCopyWithImpl(this._self, this._then);

  final CreateTeacherInput _self;
  final $Res Function(CreateTeacherInput) _then;

/// Create a copy of CreateTeacherInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? fullName = null,Object? email = null,Object? password = freezed,Object? department = freezed,}) {
  return _then(CreateTeacherInput(
fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,password: freezed == password ? _self.password : password // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateTeacherInput].
extension CreateTeacherInputPatterns on CreateTeacherInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateTeacherInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateTeacherInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateTeacherInput value)  $default,){
final _that = this;
switch (_that) {
case _CreateTeacherInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateTeacherInput value)?  $default,){
final _that = this;
switch (_that) {
case _CreateTeacherInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String fullName,  String email,  String? password,  String? department)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateTeacherInput() when $default != null:
return $default(_that.fullName,_that.email,_that.password,_that.department);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String fullName,  String email,  String? password,  String? department)  $default,) {final _that = this;
switch (_that) {
case _CreateTeacherInput():
return $default(_that.fullName,_that.email,_that.password,_that.department);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String fullName,  String email,  String? password,  String? department)?  $default,) {final _that = this;
switch (_that) {
case _CreateTeacherInput() when $default != null:
return $default(_that.fullName,_that.email,_that.password,_that.department);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _CreateTeacherInput implements CreateTeacherInput {
  const _CreateTeacherInput({required this.fullName, required this.email, this.password, this.department});
  factory _CreateTeacherInput.fromJson(Map<String, dynamic> json) => _$CreateTeacherInputFromJson(json);

@override final  String fullName;
@override final  String email;
@override final  String? password;
@override final  String? department;

/// Create a copy of CreateTeacherInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateTeacherInputCopyWith<_CreateTeacherInput> get copyWith => __$CreateTeacherInputCopyWithImpl<_CreateTeacherInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateTeacherInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateTeacherInput&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.email, email) || other.email == email)&&(identical(other.password, password) || other.password == password)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fullName,email,password,department);

@override
String toString() {
  return 'CreateTeacherInput(fullName: $fullName, email: $email, password: $password, department: $department)';
}


}

/// @nodoc
abstract mixin class _$CreateTeacherInputCopyWith<$Res> implements $CreateTeacherInputCopyWith<$Res> {
  factory _$CreateTeacherInputCopyWith(_CreateTeacherInput value, $Res Function(_CreateTeacherInput) _then) = __$CreateTeacherInputCopyWithImpl;
@override @useResult
$Res call({
 String fullName, String email, String? password, String? department
});




}
/// @nodoc
class __$CreateTeacherInputCopyWithImpl<$Res>
    implements _$CreateTeacherInputCopyWith<$Res> {
  __$CreateTeacherInputCopyWithImpl(this._self, this._then);

  final _CreateTeacherInput _self;
  final $Res Function(_CreateTeacherInput) _then;

/// Create a copy of CreateTeacherInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? fullName = null,Object? email = null,Object? password = freezed,Object? department = freezed,}) {
  return _then(_CreateTeacherInput(
fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,email: null == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String,password: freezed == password ? _self.password : password // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CreateStudentInput {

 String get fullName; String get studentId; String? get email; String? get password; String get program; int get yearLevel; String get department;
/// Create a copy of CreateStudentInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateStudentInputCopyWith<CreateStudentInput> get copyWith => _$CreateStudentInputCopyWithImpl<CreateStudentInput>(this as CreateStudentInput, _$identity);

  /// Serializes this CreateStudentInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateStudentInput&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.email, email) || other.email == email)&&(identical(other.password, password) || other.password == password)&&(identical(other.program, program) || other.program == program)&&(identical(other.yearLevel, yearLevel) || other.yearLevel == yearLevel)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fullName,studentId,email,password,program,yearLevel,department);

@override
String toString() {
  return 'CreateStudentInput(fullName: $fullName, studentId: $studentId, email: $email, password: $password, program: $program, yearLevel: $yearLevel, department: $department)';
}


}

/// @nodoc
abstract mixin class $CreateStudentInputCopyWith<$Res>  {
  factory $CreateStudentInputCopyWith(CreateStudentInput value, $Res Function(CreateStudentInput) _then) = _$CreateStudentInputCopyWithImpl;
@useResult
$Res call({
 String fullName, String studentId, String? email, String? password, String program, int yearLevel, String department
});




}
/// @nodoc
class _$CreateStudentInputCopyWithImpl<$Res>
    implements $CreateStudentInputCopyWith<$Res> {
  _$CreateStudentInputCopyWithImpl(this._self, this._then);

  final CreateStudentInput _self;
  final $Res Function(CreateStudentInput) _then;

/// Create a copy of CreateStudentInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? fullName = null,Object? studentId = null,Object? email = freezed,Object? password = freezed,Object? program = null,Object? yearLevel = null,Object? department = null,}) {
  return _then(CreateStudentInput(
fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,password: freezed == password ? _self.password : password // ignore: cast_nullable_to_non_nullable
as String?,program: null == program ? _self.program : program // ignore: cast_nullable_to_non_nullable
as String,yearLevel: null == yearLevel ? _self.yearLevel : yearLevel // ignore: cast_nullable_to_non_nullable
as int,department: null == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateStudentInput].
extension CreateStudentInputPatterns on CreateStudentInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateStudentInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateStudentInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateStudentInput value)  $default,){
final _that = this;
switch (_that) {
case _CreateStudentInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateStudentInput value)?  $default,){
final _that = this;
switch (_that) {
case _CreateStudentInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String fullName,  String studentId,  String? email,  String? password,  String program,  int yearLevel,  String department)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateStudentInput() when $default != null:
return $default(_that.fullName,_that.studentId,_that.email,_that.password,_that.program,_that.yearLevel,_that.department);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String fullName,  String studentId,  String? email,  String? password,  String program,  int yearLevel,  String department)  $default,) {final _that = this;
switch (_that) {
case _CreateStudentInput():
return $default(_that.fullName,_that.studentId,_that.email,_that.password,_that.program,_that.yearLevel,_that.department);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String fullName,  String studentId,  String? email,  String? password,  String program,  int yearLevel,  String department)?  $default,) {final _that = this;
switch (_that) {
case _CreateStudentInput() when $default != null:
return $default(_that.fullName,_that.studentId,_that.email,_that.password,_that.program,_that.yearLevel,_that.department);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _CreateStudentInput implements CreateStudentInput {
  const _CreateStudentInput({required this.fullName, required this.studentId, this.email, this.password, required this.program, required this.yearLevel, required this.department});
  factory _CreateStudentInput.fromJson(Map<String, dynamic> json) => _$CreateStudentInputFromJson(json);

@override final  String fullName;
@override final  String studentId;
@override final  String? email;
@override final  String? password;
@override final  String program;
@override final  int yearLevel;
@override final  String department;

/// Create a copy of CreateStudentInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateStudentInputCopyWith<_CreateStudentInput> get copyWith => __$CreateStudentInputCopyWithImpl<_CreateStudentInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateStudentInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateStudentInput&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.email, email) || other.email == email)&&(identical(other.password, password) || other.password == password)&&(identical(other.program, program) || other.program == program)&&(identical(other.yearLevel, yearLevel) || other.yearLevel == yearLevel)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fullName,studentId,email,password,program,yearLevel,department);

@override
String toString() {
  return 'CreateStudentInput(fullName: $fullName, studentId: $studentId, email: $email, password: $password, program: $program, yearLevel: $yearLevel, department: $department)';
}


}

/// @nodoc
abstract mixin class _$CreateStudentInputCopyWith<$Res> implements $CreateStudentInputCopyWith<$Res> {
  factory _$CreateStudentInputCopyWith(_CreateStudentInput value, $Res Function(_CreateStudentInput) _then) = __$CreateStudentInputCopyWithImpl;
@override @useResult
$Res call({
 String fullName, String studentId, String? email, String? password, String program, int yearLevel, String department
});




}
/// @nodoc
class __$CreateStudentInputCopyWithImpl<$Res>
    implements _$CreateStudentInputCopyWith<$Res> {
  __$CreateStudentInputCopyWithImpl(this._self, this._then);

  final _CreateStudentInput _self;
  final $Res Function(_CreateStudentInput) _then;

/// Create a copy of CreateStudentInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? fullName = null,Object? studentId = null,Object? email = freezed,Object? password = freezed,Object? program = null,Object? yearLevel = null,Object? department = null,}) {
  return _then(_CreateStudentInput(
fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,password: freezed == password ? _self.password : password // ignore: cast_nullable_to_non_nullable
as String?,program: null == program ? _self.program : program // ignore: cast_nullable_to_non_nullable
as String,yearLevel: null == yearLevel ? _self.yearLevel : yearLevel // ignore: cast_nullable_to_non_nullable
as int,department: null == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$CreateSectionScheduleSlot {

 String get day; String get startTime; String get endTime; String? get room;
/// Create a copy of CreateSectionScheduleSlot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateSectionScheduleSlotCopyWith<CreateSectionScheduleSlot> get copyWith => _$CreateSectionScheduleSlotCopyWithImpl<CreateSectionScheduleSlot>(this as CreateSectionScheduleSlot, _$identity);

  /// Serializes this CreateSectionScheduleSlot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateSectionScheduleSlot&&(identical(other.day, day) || other.day == day)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,day,startTime,endTime,room);

@override
String toString() {
  return 'CreateSectionScheduleSlot(day: $day, startTime: $startTime, endTime: $endTime, room: $room)';
}


}

/// @nodoc
abstract mixin class $CreateSectionScheduleSlotCopyWith<$Res>  {
  factory $CreateSectionScheduleSlotCopyWith(CreateSectionScheduleSlot value, $Res Function(CreateSectionScheduleSlot) _then) = _$CreateSectionScheduleSlotCopyWithImpl;
@useResult
$Res call({
 String day, String startTime, String endTime, String? room
});




}
/// @nodoc
class _$CreateSectionScheduleSlotCopyWithImpl<$Res>
    implements $CreateSectionScheduleSlotCopyWith<$Res> {
  _$CreateSectionScheduleSlotCopyWithImpl(this._self, this._then);

  final CreateSectionScheduleSlot _self;
  final $Res Function(CreateSectionScheduleSlot) _then;

/// Create a copy of CreateSectionScheduleSlot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? day = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,}) {
  return _then(CreateSectionScheduleSlot(
day: null == day ? _self.day : day // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateSectionScheduleSlot].
extension CreateSectionScheduleSlotPatterns on CreateSectionScheduleSlot {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateSectionScheduleSlot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateSectionScheduleSlot() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateSectionScheduleSlot value)  $default,){
final _that = this;
switch (_that) {
case _CreateSectionScheduleSlot():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateSectionScheduleSlot value)?  $default,){
final _that = this;
switch (_that) {
case _CreateSectionScheduleSlot() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String day,  String startTime,  String endTime,  String? room)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateSectionScheduleSlot() when $default != null:
return $default(_that.day,_that.startTime,_that.endTime,_that.room);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String day,  String startTime,  String endTime,  String? room)  $default,) {final _that = this;
switch (_that) {
case _CreateSectionScheduleSlot():
return $default(_that.day,_that.startTime,_that.endTime,_that.room);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String day,  String startTime,  String endTime,  String? room)?  $default,) {final _that = this;
switch (_that) {
case _CreateSectionScheduleSlot() when $default != null:
return $default(_that.day,_that.startTime,_that.endTime,_that.room);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _CreateSectionScheduleSlot implements CreateSectionScheduleSlot {
  const _CreateSectionScheduleSlot({required this.day, required this.startTime, required this.endTime, this.room});
  factory _CreateSectionScheduleSlot.fromJson(Map<String, dynamic> json) => _$CreateSectionScheduleSlotFromJson(json);

@override final  String day;
@override final  String startTime;
@override final  String endTime;
@override final  String? room;

/// Create a copy of CreateSectionScheduleSlot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateSectionScheduleSlotCopyWith<_CreateSectionScheduleSlot> get copyWith => __$CreateSectionScheduleSlotCopyWithImpl<_CreateSectionScheduleSlot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateSectionScheduleSlotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateSectionScheduleSlot&&(identical(other.day, day) || other.day == day)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,day,startTime,endTime,room);

@override
String toString() {
  return 'CreateSectionScheduleSlot(day: $day, startTime: $startTime, endTime: $endTime, room: $room)';
}


}

/// @nodoc
abstract mixin class _$CreateSectionScheduleSlotCopyWith<$Res> implements $CreateSectionScheduleSlotCopyWith<$Res> {
  factory _$CreateSectionScheduleSlotCopyWith(_CreateSectionScheduleSlot value, $Res Function(_CreateSectionScheduleSlot) _then) = __$CreateSectionScheduleSlotCopyWithImpl;
@override @useResult
$Res call({
 String day, String startTime, String endTime, String? room
});




}
/// @nodoc
class __$CreateSectionScheduleSlotCopyWithImpl<$Res>
    implements _$CreateSectionScheduleSlotCopyWith<$Res> {
  __$CreateSectionScheduleSlotCopyWithImpl(this._self, this._then);

  final _CreateSectionScheduleSlot _self;
  final $Res Function(_CreateSectionScheduleSlot) _then;

/// Create a copy of CreateSectionScheduleSlot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? day = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,}) {
  return _then(_CreateSectionScheduleSlot(
day: null == day ? _self.day : day // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CreateSectionInput {

 String get subjectId; String get section; String? get course; String get room; List<CreateSectionScheduleSlot> get schedule; String get semester;
/// Create a copy of CreateSectionInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateSectionInputCopyWith<CreateSectionInput> get copyWith => _$CreateSectionInputCopyWithImpl<CreateSectionInput>(this as CreateSectionInput, _$identity);

  /// Serializes this CreateSectionInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateSectionInput&&(identical(other.subjectId, subjectId) || other.subjectId == subjectId)&&(identical(other.section, section) || other.section == section)&&(identical(other.course, course) || other.course == course)&&(identical(other.room, room) || other.room == room)&&const DeepCollectionEquality().equals(other.schedule, schedule)&&(identical(other.semester, semester) || other.semester == semester));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,subjectId,section,course,room,const DeepCollectionEquality().hash(schedule),semester);

@override
String toString() {
  return 'CreateSectionInput(subjectId: $subjectId, section: $section, course: $course, room: $room, schedule: $schedule, semester: $semester)';
}


}

/// @nodoc
abstract mixin class $CreateSectionInputCopyWith<$Res>  {
  factory $CreateSectionInputCopyWith(CreateSectionInput value, $Res Function(CreateSectionInput) _then) = _$CreateSectionInputCopyWithImpl;
@useResult
$Res call({
 String subjectId, String section, String? course, String room, List<CreateSectionScheduleSlot> schedule, String semester
});




}
/// @nodoc
class _$CreateSectionInputCopyWithImpl<$Res>
    implements $CreateSectionInputCopyWith<$Res> {
  _$CreateSectionInputCopyWithImpl(this._self, this._then);

  final CreateSectionInput _self;
  final $Res Function(CreateSectionInput) _then;

/// Create a copy of CreateSectionInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? subjectId = null,Object? section = null,Object? course = freezed,Object? room = null,Object? schedule = null,Object? semester = null,}) {
  return _then(CreateSectionInput(
subjectId: null == subjectId ? _self.subjectId : subjectId // ignore: cast_nullable_to_non_nullable
as String,section: null == section ? _self.section : section // ignore: cast_nullable_to_non_nullable
as String,course: freezed == course ? _self.course : course // ignore: cast_nullable_to_non_nullable
as String?,room: null == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String,schedule: null == schedule ? _self.schedule : schedule // ignore: cast_nullable_to_non_nullable
as List<CreateSectionScheduleSlot>,semester: null == semester ? _self.semester : semester // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateSectionInput].
extension CreateSectionInputPatterns on CreateSectionInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateSectionInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateSectionInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateSectionInput value)  $default,){
final _that = this;
switch (_that) {
case _CreateSectionInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateSectionInput value)?  $default,){
final _that = this;
switch (_that) {
case _CreateSectionInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String subjectId,  String section,  String? course,  String room,  List<CreateSectionScheduleSlot> schedule,  String semester)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateSectionInput() when $default != null:
return $default(_that.subjectId,_that.section,_that.course,_that.room,_that.schedule,_that.semester);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String subjectId,  String section,  String? course,  String room,  List<CreateSectionScheduleSlot> schedule,  String semester)  $default,) {final _that = this;
switch (_that) {
case _CreateSectionInput():
return $default(_that.subjectId,_that.section,_that.course,_that.room,_that.schedule,_that.semester);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String subjectId,  String section,  String? course,  String room,  List<CreateSectionScheduleSlot> schedule,  String semester)?  $default,) {final _that = this;
switch (_that) {
case _CreateSectionInput() when $default != null:
return $default(_that.subjectId,_that.section,_that.course,_that.room,_that.schedule,_that.semester);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _CreateSectionInput implements CreateSectionInput {
  const _CreateSectionInput({required this.subjectId, required this.section, this.course, required this.room,  List<CreateSectionScheduleSlot> schedule = const <CreateSectionScheduleSlot>[], required this.semester}): _schedule = schedule;
  factory _CreateSectionInput.fromJson(Map<String, dynamic> json) => _$CreateSectionInputFromJson(json);

@override final  String subjectId;
@override final  String section;
@override final  String? course;
@override final  String room;
 final  List<CreateSectionScheduleSlot> _schedule;
@override@JsonKey() List<CreateSectionScheduleSlot> get schedule {
  if (_schedule is EqualUnmodifiableListView) return _schedule;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_schedule);
}

@override final  String semester;

/// Create a copy of CreateSectionInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateSectionInputCopyWith<_CreateSectionInput> get copyWith => __$CreateSectionInputCopyWithImpl<_CreateSectionInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateSectionInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateSectionInput&&(identical(other.subjectId, subjectId) || other.subjectId == subjectId)&&(identical(other.section, section) || other.section == section)&&(identical(other.course, course) || other.course == course)&&(identical(other.room, room) || other.room == room)&&const DeepCollectionEquality().equals(other._schedule, _schedule)&&(identical(other.semester, semester) || other.semester == semester));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,subjectId,section,course,room,const DeepCollectionEquality().hash(_schedule),semester);

@override
String toString() {
  return 'CreateSectionInput(subjectId: $subjectId, section: $section, course: $course, room: $room, schedule: $schedule, semester: $semester)';
}


}

/// @nodoc
abstract mixin class _$CreateSectionInputCopyWith<$Res> implements $CreateSectionInputCopyWith<$Res> {
  factory _$CreateSectionInputCopyWith(_CreateSectionInput value, $Res Function(_CreateSectionInput) _then) = __$CreateSectionInputCopyWithImpl;
@override @useResult
$Res call({
 String subjectId, String section, String? course, String room, List<CreateSectionScheduleSlot> schedule, String semester
});




}
/// @nodoc
class __$CreateSectionInputCopyWithImpl<$Res>
    implements _$CreateSectionInputCopyWith<$Res> {
  __$CreateSectionInputCopyWithImpl(this._self, this._then);

  final _CreateSectionInput _self;
  final $Res Function(_CreateSectionInput) _then;

/// Create a copy of CreateSectionInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? subjectId = null,Object? section = null,Object? course = freezed,Object? room = null,Object? schedule = null,Object? semester = null,}) {
  return _then(_CreateSectionInput(
subjectId: null == subjectId ? _self.subjectId : subjectId // ignore: cast_nullable_to_non_nullable
as String,section: null == section ? _self.section : section // ignore: cast_nullable_to_non_nullable
as String,course: freezed == course ? _self.course : course // ignore: cast_nullable_to_non_nullable
as String?,room: null == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String,schedule: null == schedule ? _self._schedule : schedule // ignore: cast_nullable_to_non_nullable
as List<CreateSectionScheduleSlot>,semester: null == semester ? _self.semester : semester // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$CreateSessionInput {

 String get sectionId; String get subjectName; String get date; String get startTime; String get endTime; String? get room; SessionMode? get mode; int? get qrValidityMinutes; int? get gracePeriodMinutes; int? get startQrValiditySeconds; int? get startGraceMinutes; int? get endQrValiditySeconds; GeofenceConfig? get geofence; String get teacherId; bool? get isRescheduled; String? get rescheduledFromDate; String? get originalScheduleTime; String? get originalRoom;
/// Create a copy of CreateSessionInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateSessionInputCopyWith<CreateSessionInput> get copyWith => _$CreateSessionInputCopyWithImpl<CreateSessionInput>(this as CreateSessionInput, _$identity);

  /// Serializes this CreateSessionInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateSessionInput&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.date, date) || other.date == date)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.qrValidityMinutes, qrValidityMinutes) || other.qrValidityMinutes == qrValidityMinutes)&&(identical(other.gracePeriodMinutes, gracePeriodMinutes) || other.gracePeriodMinutes == gracePeriodMinutes)&&(identical(other.startQrValiditySeconds, startQrValiditySeconds) || other.startQrValiditySeconds == startQrValiditySeconds)&&(identical(other.startGraceMinutes, startGraceMinutes) || other.startGraceMinutes == startGraceMinutes)&&(identical(other.endQrValiditySeconds, endQrValiditySeconds) || other.endQrValiditySeconds == endQrValiditySeconds)&&(identical(other.geofence, geofence) || other.geofence == geofence)&&(identical(other.teacherId, teacherId) || other.teacherId == teacherId)&&(identical(other.isRescheduled, isRescheduled) || other.isRescheduled == isRescheduled)&&(identical(other.rescheduledFromDate, rescheduledFromDate) || other.rescheduledFromDate == rescheduledFromDate)&&(identical(other.originalScheduleTime, originalScheduleTime) || other.originalScheduleTime == originalScheduleTime)&&(identical(other.originalRoom, originalRoom) || other.originalRoom == originalRoom));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,subjectName,date,startTime,endTime,room,mode,qrValidityMinutes,gracePeriodMinutes,startQrValiditySeconds,startGraceMinutes,endQrValiditySeconds,geofence,teacherId,isRescheduled,rescheduledFromDate,originalScheduleTime,originalRoom);

@override
String toString() {
  return 'CreateSessionInput(sectionId: $sectionId, subjectName: $subjectName, date: $date, startTime: $startTime, endTime: $endTime, room: $room, mode: $mode, qrValidityMinutes: $qrValidityMinutes, gracePeriodMinutes: $gracePeriodMinutes, startQrValiditySeconds: $startQrValiditySeconds, startGraceMinutes: $startGraceMinutes, endQrValiditySeconds: $endQrValiditySeconds, geofence: $geofence, teacherId: $teacherId, isRescheduled: $isRescheduled, rescheduledFromDate: $rescheduledFromDate, originalScheduleTime: $originalScheduleTime, originalRoom: $originalRoom)';
}


}

/// @nodoc
abstract mixin class $CreateSessionInputCopyWith<$Res>  {
  factory $CreateSessionInputCopyWith(CreateSessionInput value, $Res Function(CreateSessionInput) _then) = _$CreateSessionInputCopyWithImpl;
@useResult
$Res call({
 String sectionId, String subjectName, String date, String startTime, String endTime, String? room, SessionMode? mode, int? qrValidityMinutes, int? gracePeriodMinutes, int? startQrValiditySeconds, int? startGraceMinutes, int? endQrValiditySeconds, GeofenceConfig? geofence, String teacherId, bool? isRescheduled, String? rescheduledFromDate, String? originalScheduleTime, String? originalRoom
});


$GeofenceConfigCopyWith<$Res>? get geofence;

}
/// @nodoc
class _$CreateSessionInputCopyWithImpl<$Res>
    implements $CreateSessionInputCopyWith<$Res> {
  _$CreateSessionInputCopyWithImpl(this._self, this._then);

  final CreateSessionInput _self;
  final $Res Function(CreateSessionInput) _then;

/// Create a copy of CreateSessionInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sectionId = null,Object? subjectName = null,Object? date = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,Object? mode = freezed,Object? qrValidityMinutes = freezed,Object? gracePeriodMinutes = freezed,Object? startQrValiditySeconds = freezed,Object? startGraceMinutes = freezed,Object? endQrValiditySeconds = freezed,Object? geofence = freezed,Object? teacherId = null,Object? isRescheduled = freezed,Object? rescheduledFromDate = freezed,Object? originalScheduleTime = freezed,Object? originalRoom = freezed,}) {
  return _then(CreateSessionInput(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,mode: freezed == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode?,qrValidityMinutes: freezed == qrValidityMinutes ? _self.qrValidityMinutes : qrValidityMinutes // ignore: cast_nullable_to_non_nullable
as int?,gracePeriodMinutes: freezed == gracePeriodMinutes ? _self.gracePeriodMinutes : gracePeriodMinutes // ignore: cast_nullable_to_non_nullable
as int?,startQrValiditySeconds: freezed == startQrValiditySeconds ? _self.startQrValiditySeconds : startQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,startGraceMinutes: freezed == startGraceMinutes ? _self.startGraceMinutes : startGraceMinutes // ignore: cast_nullable_to_non_nullable
as int?,endQrValiditySeconds: freezed == endQrValiditySeconds ? _self.endQrValiditySeconds : endQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,geofence: freezed == geofence ? _self.geofence : geofence // ignore: cast_nullable_to_non_nullable
as GeofenceConfig?,teacherId: null == teacherId ? _self.teacherId : teacherId // ignore: cast_nullable_to_non_nullable
as String,isRescheduled: freezed == isRescheduled ? _self.isRescheduled : isRescheduled // ignore: cast_nullable_to_non_nullable
as bool?,rescheduledFromDate: freezed == rescheduledFromDate ? _self.rescheduledFromDate : rescheduledFromDate // ignore: cast_nullable_to_non_nullable
as String?,originalScheduleTime: freezed == originalScheduleTime ? _self.originalScheduleTime : originalScheduleTime // ignore: cast_nullable_to_non_nullable
as String?,originalRoom: freezed == originalRoom ? _self.originalRoom : originalRoom // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}
/// Create a copy of CreateSessionInput
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


/// Adds pattern-matching-related methods to [CreateSessionInput].
extension CreateSessionInputPatterns on CreateSessionInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateSessionInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateSessionInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateSessionInput value)  $default,){
final _that = this;
switch (_that) {
case _CreateSessionInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateSessionInput value)?  $default,){
final _that = this;
switch (_that) {
case _CreateSessionInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sectionId,  String subjectName,  String date,  String startTime,  String endTime,  String? room,  SessionMode? mode,  int? qrValidityMinutes,  int? gracePeriodMinutes,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  GeofenceConfig? geofence,  String teacherId,  bool? isRescheduled,  String? rescheduledFromDate,  String? originalScheduleTime,  String? originalRoom)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateSessionInput() when $default != null:
return $default(_that.sectionId,_that.subjectName,_that.date,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.geofence,_that.teacherId,_that.isRescheduled,_that.rescheduledFromDate,_that.originalScheduleTime,_that.originalRoom);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sectionId,  String subjectName,  String date,  String startTime,  String endTime,  String? room,  SessionMode? mode,  int? qrValidityMinutes,  int? gracePeriodMinutes,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  GeofenceConfig? geofence,  String teacherId,  bool? isRescheduled,  String? rescheduledFromDate,  String? originalScheduleTime,  String? originalRoom)  $default,) {final _that = this;
switch (_that) {
case _CreateSessionInput():
return $default(_that.sectionId,_that.subjectName,_that.date,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.geofence,_that.teacherId,_that.isRescheduled,_that.rescheduledFromDate,_that.originalScheduleTime,_that.originalRoom);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sectionId,  String subjectName,  String date,  String startTime,  String endTime,  String? room,  SessionMode? mode,  int? qrValidityMinutes,  int? gracePeriodMinutes,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  GeofenceConfig? geofence,  String teacherId,  bool? isRescheduled,  String? rescheduledFromDate,  String? originalScheduleTime,  String? originalRoom)?  $default,) {final _that = this;
switch (_that) {
case _CreateSessionInput() when $default != null:
return $default(_that.sectionId,_that.subjectName,_that.date,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.geofence,_that.teacherId,_that.isRescheduled,_that.rescheduledFromDate,_that.originalScheduleTime,_that.originalRoom);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [SessionModeConverter()])
class _CreateSessionInput implements CreateSessionInput {
  const _CreateSessionInput({required this.sectionId, required this.subjectName, required this.date, required this.startTime, required this.endTime, this.room, this.mode, this.qrValidityMinutes, this.gracePeriodMinutes, this.startQrValiditySeconds, this.startGraceMinutes, this.endQrValiditySeconds, this.geofence, required this.teacherId, this.isRescheduled, this.rescheduledFromDate, this.originalScheduleTime, this.originalRoom});
  factory _CreateSessionInput.fromJson(Map<String, dynamic> json) => _$CreateSessionInputFromJson(json);

@override final  String sectionId;
@override final  String subjectName;
@override final  String date;
@override final  String startTime;
@override final  String endTime;
@override final  String? room;
@override final  SessionMode? mode;
@override final  int? qrValidityMinutes;
@override final  int? gracePeriodMinutes;
@override final  int? startQrValiditySeconds;
@override final  int? startGraceMinutes;
@override final  int? endQrValiditySeconds;
@override final  GeofenceConfig? geofence;
@override final  String teacherId;
@override final  bool? isRescheduled;
@override final  String? rescheduledFromDate;
@override final  String? originalScheduleTime;
@override final  String? originalRoom;

/// Create a copy of CreateSessionInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateSessionInputCopyWith<_CreateSessionInput> get copyWith => __$CreateSessionInputCopyWithImpl<_CreateSessionInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateSessionInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateSessionInput&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.date, date) || other.date == date)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.qrValidityMinutes, qrValidityMinutes) || other.qrValidityMinutes == qrValidityMinutes)&&(identical(other.gracePeriodMinutes, gracePeriodMinutes) || other.gracePeriodMinutes == gracePeriodMinutes)&&(identical(other.startQrValiditySeconds, startQrValiditySeconds) || other.startQrValiditySeconds == startQrValiditySeconds)&&(identical(other.startGraceMinutes, startGraceMinutes) || other.startGraceMinutes == startGraceMinutes)&&(identical(other.endQrValiditySeconds, endQrValiditySeconds) || other.endQrValiditySeconds == endQrValiditySeconds)&&(identical(other.geofence, geofence) || other.geofence == geofence)&&(identical(other.teacherId, teacherId) || other.teacherId == teacherId)&&(identical(other.isRescheduled, isRescheduled) || other.isRescheduled == isRescheduled)&&(identical(other.rescheduledFromDate, rescheduledFromDate) || other.rescheduledFromDate == rescheduledFromDate)&&(identical(other.originalScheduleTime, originalScheduleTime) || other.originalScheduleTime == originalScheduleTime)&&(identical(other.originalRoom, originalRoom) || other.originalRoom == originalRoom));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,subjectName,date,startTime,endTime,room,mode,qrValidityMinutes,gracePeriodMinutes,startQrValiditySeconds,startGraceMinutes,endQrValiditySeconds,geofence,teacherId,isRescheduled,rescheduledFromDate,originalScheduleTime,originalRoom);

@override
String toString() {
  return 'CreateSessionInput(sectionId: $sectionId, subjectName: $subjectName, date: $date, startTime: $startTime, endTime: $endTime, room: $room, mode: $mode, qrValidityMinutes: $qrValidityMinutes, gracePeriodMinutes: $gracePeriodMinutes, startQrValiditySeconds: $startQrValiditySeconds, startGraceMinutes: $startGraceMinutes, endQrValiditySeconds: $endQrValiditySeconds, geofence: $geofence, teacherId: $teacherId, isRescheduled: $isRescheduled, rescheduledFromDate: $rescheduledFromDate, originalScheduleTime: $originalScheduleTime, originalRoom: $originalRoom)';
}


}

/// @nodoc
abstract mixin class _$CreateSessionInputCopyWith<$Res> implements $CreateSessionInputCopyWith<$Res> {
  factory _$CreateSessionInputCopyWith(_CreateSessionInput value, $Res Function(_CreateSessionInput) _then) = __$CreateSessionInputCopyWithImpl;
@override @useResult
$Res call({
 String sectionId, String subjectName, String date, String startTime, String endTime, String? room, SessionMode? mode, int? qrValidityMinutes, int? gracePeriodMinutes, int? startQrValiditySeconds, int? startGraceMinutes, int? endQrValiditySeconds, GeofenceConfig? geofence, String teacherId, bool? isRescheduled, String? rescheduledFromDate, String? originalScheduleTime, String? originalRoom
});


@override $GeofenceConfigCopyWith<$Res>? get geofence;

}
/// @nodoc
class __$CreateSessionInputCopyWithImpl<$Res>
    implements _$CreateSessionInputCopyWith<$Res> {
  __$CreateSessionInputCopyWithImpl(this._self, this._then);

  final _CreateSessionInput _self;
  final $Res Function(_CreateSessionInput) _then;

/// Create a copy of CreateSessionInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sectionId = null,Object? subjectName = null,Object? date = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,Object? mode = freezed,Object? qrValidityMinutes = freezed,Object? gracePeriodMinutes = freezed,Object? startQrValiditySeconds = freezed,Object? startGraceMinutes = freezed,Object? endQrValiditySeconds = freezed,Object? geofence = freezed,Object? teacherId = null,Object? isRescheduled = freezed,Object? rescheduledFromDate = freezed,Object? originalScheduleTime = freezed,Object? originalRoom = freezed,}) {
  return _then(_CreateSessionInput(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,mode: freezed == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode?,qrValidityMinutes: freezed == qrValidityMinutes ? _self.qrValidityMinutes : qrValidityMinutes // ignore: cast_nullable_to_non_nullable
as int?,gracePeriodMinutes: freezed == gracePeriodMinutes ? _self.gracePeriodMinutes : gracePeriodMinutes // ignore: cast_nullable_to_non_nullable
as int?,startQrValiditySeconds: freezed == startQrValiditySeconds ? _self.startQrValiditySeconds : startQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,startGraceMinutes: freezed == startGraceMinutes ? _self.startGraceMinutes : startGraceMinutes // ignore: cast_nullable_to_non_nullable
as int?,endQrValiditySeconds: freezed == endQrValiditySeconds ? _self.endQrValiditySeconds : endQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,geofence: freezed == geofence ? _self.geofence : geofence // ignore: cast_nullable_to_non_nullable
as GeofenceConfig?,teacherId: null == teacherId ? _self.teacherId : teacherId // ignore: cast_nullable_to_non_nullable
as String,isRescheduled: freezed == isRescheduled ? _self.isRescheduled : isRescheduled // ignore: cast_nullable_to_non_nullable
as bool?,rescheduledFromDate: freezed == rescheduledFromDate ? _self.rescheduledFromDate : rescheduledFromDate // ignore: cast_nullable_to_non_nullable
as String?,originalScheduleTime: freezed == originalScheduleTime ? _self.originalScheduleTime : originalScheduleTime // ignore: cast_nullable_to_non_nullable
as String?,originalRoom: freezed == originalRoom ? _self.originalRoom : originalRoom // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

/// Create a copy of CreateSessionInput
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
mixin _$TeacherActivationLocation {

 double? get latitude; double? get longitude;@JsonKey(name: 'override') bool? get overrideFlag;
/// Create a copy of TeacherActivationLocation
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TeacherActivationLocationCopyWith<TeacherActivationLocation> get copyWith => _$TeacherActivationLocationCopyWithImpl<TeacherActivationLocation>(this as TeacherActivationLocation, _$identity);

  /// Serializes this TeacherActivationLocation to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TeacherActivationLocation&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.overrideFlag, overrideFlag) || other.overrideFlag == overrideFlag));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,latitude,longitude,overrideFlag);

@override
String toString() {
  return 'TeacherActivationLocation(latitude: $latitude, longitude: $longitude, overrideFlag: $overrideFlag)';
}


}

/// @nodoc
abstract mixin class $TeacherActivationLocationCopyWith<$Res>  {
  factory $TeacherActivationLocationCopyWith(TeacherActivationLocation value, $Res Function(TeacherActivationLocation) _then) = _$TeacherActivationLocationCopyWithImpl;
@useResult
$Res call({
 double? latitude, double? longitude,@JsonKey(name: 'override') bool? overrideFlag
});




}
/// @nodoc
class _$TeacherActivationLocationCopyWithImpl<$Res>
    implements $TeacherActivationLocationCopyWith<$Res> {
  _$TeacherActivationLocationCopyWithImpl(this._self, this._then);

  final TeacherActivationLocation _self;
  final $Res Function(TeacherActivationLocation) _then;

/// Create a copy of TeacherActivationLocation
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? latitude = freezed,Object? longitude = freezed,Object? overrideFlag = freezed,}) {
  return _then(TeacherActivationLocation(
latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,overrideFlag: freezed == overrideFlag ? _self.overrideFlag : overrideFlag // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}

}


/// Adds pattern-matching-related methods to [TeacherActivationLocation].
extension TeacherActivationLocationPatterns on TeacherActivationLocation {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TeacherActivationLocation value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TeacherActivationLocation() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TeacherActivationLocation value)  $default,){
final _that = this;
switch (_that) {
case _TeacherActivationLocation():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TeacherActivationLocation value)?  $default,){
final _that = this;
switch (_that) {
case _TeacherActivationLocation() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( double? latitude,  double? longitude, @JsonKey(name: 'override')  bool? overrideFlag)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TeacherActivationLocation() when $default != null:
return $default(_that.latitude,_that.longitude,_that.overrideFlag);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( double? latitude,  double? longitude, @JsonKey(name: 'override')  bool? overrideFlag)  $default,) {final _that = this;
switch (_that) {
case _TeacherActivationLocation():
return $default(_that.latitude,_that.longitude,_that.overrideFlag);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( double? latitude,  double? longitude, @JsonKey(name: 'override')  bool? overrideFlag)?  $default,) {final _that = this;
switch (_that) {
case _TeacherActivationLocation() when $default != null:
return $default(_that.latitude,_that.longitude,_that.overrideFlag);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _TeacherActivationLocation implements TeacherActivationLocation {
  const _TeacherActivationLocation({this.latitude, this.longitude, @JsonKey(name: 'override') this.overrideFlag});
  factory _TeacherActivationLocation.fromJson(Map<String, dynamic> json) => _$TeacherActivationLocationFromJson(json);

@override final  double? latitude;
@override final  double? longitude;
@override@JsonKey(name: 'override') final  bool? overrideFlag;

/// Create a copy of TeacherActivationLocation
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TeacherActivationLocationCopyWith<_TeacherActivationLocation> get copyWith => __$TeacherActivationLocationCopyWithImpl<_TeacherActivationLocation>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TeacherActivationLocationToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TeacherActivationLocation&&(identical(other.latitude, latitude) || other.latitude == latitude)&&(identical(other.longitude, longitude) || other.longitude == longitude)&&(identical(other.overrideFlag, overrideFlag) || other.overrideFlag == overrideFlag));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,latitude,longitude,overrideFlag);

@override
String toString() {
  return 'TeacherActivationLocation(latitude: $latitude, longitude: $longitude, overrideFlag: $overrideFlag)';
}


}

/// @nodoc
abstract mixin class _$TeacherActivationLocationCopyWith<$Res> implements $TeacherActivationLocationCopyWith<$Res> {
  factory _$TeacherActivationLocationCopyWith(_TeacherActivationLocation value, $Res Function(_TeacherActivationLocation) _then) = __$TeacherActivationLocationCopyWithImpl;
@override @useResult
$Res call({
 double? latitude, double? longitude,@JsonKey(name: 'override') bool? overrideFlag
});




}
/// @nodoc
class __$TeacherActivationLocationCopyWithImpl<$Res>
    implements _$TeacherActivationLocationCopyWith<$Res> {
  __$TeacherActivationLocationCopyWithImpl(this._self, this._then);

  final _TeacherActivationLocation _self;
  final $Res Function(_TeacherActivationLocation) _then;

/// Create a copy of TeacherActivationLocation
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? latitude = freezed,Object? longitude = freezed,Object? overrideFlag = freezed,}) {
  return _then(_TeacherActivationLocation(
latitude: freezed == latitude ? _self.latitude : latitude // ignore: cast_nullable_to_non_nullable
as double?,longitude: freezed == longitude ? _self.longitude : longitude // ignore: cast_nullable_to_non_nullable
as double?,overrideFlag: freezed == overrideFlag ? _self.overrideFlag : overrideFlag // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}


}


/// @nodoc
mixin _$GenerateCheckpointQrInput {

 String get sessionId; CheckpointType get checkpoint; int get validitySeconds; int? get graceMinutes; bool? get regenerate; String? get pin; TeacherActivationLocation? get teacherLocation;
/// Create a copy of GenerateCheckpointQrInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GenerateCheckpointQrInputCopyWith<GenerateCheckpointQrInput> get copyWith => _$GenerateCheckpointQrInputCopyWithImpl<GenerateCheckpointQrInput>(this as GenerateCheckpointQrInput, _$identity);

  /// Serializes this GenerateCheckpointQrInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GenerateCheckpointQrInput&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.checkpoint, checkpoint) || other.checkpoint == checkpoint)&&(identical(other.validitySeconds, validitySeconds) || other.validitySeconds == validitySeconds)&&(identical(other.graceMinutes, graceMinutes) || other.graceMinutes == graceMinutes)&&(identical(other.regenerate, regenerate) || other.regenerate == regenerate)&&(identical(other.pin, pin) || other.pin == pin)&&(identical(other.teacherLocation, teacherLocation) || other.teacherLocation == teacherLocation));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sessionId,checkpoint,validitySeconds,graceMinutes,regenerate,pin,teacherLocation);

@override
String toString() {
  return 'GenerateCheckpointQrInput(sessionId: $sessionId, checkpoint: $checkpoint, validitySeconds: $validitySeconds, graceMinutes: $graceMinutes, regenerate: $regenerate, pin: $pin, teacherLocation: $teacherLocation)';
}


}

/// @nodoc
abstract mixin class $GenerateCheckpointQrInputCopyWith<$Res>  {
  factory $GenerateCheckpointQrInputCopyWith(GenerateCheckpointQrInput value, $Res Function(GenerateCheckpointQrInput) _then) = _$GenerateCheckpointQrInputCopyWithImpl;
@useResult
$Res call({
 String sessionId, CheckpointType checkpoint, int validitySeconds, int? graceMinutes, bool? regenerate, String? pin, TeacherActivationLocation? teacherLocation
});


$TeacherActivationLocationCopyWith<$Res>? get teacherLocation;

}
/// @nodoc
class _$GenerateCheckpointQrInputCopyWithImpl<$Res>
    implements $GenerateCheckpointQrInputCopyWith<$Res> {
  _$GenerateCheckpointQrInputCopyWithImpl(this._self, this._then);

  final GenerateCheckpointQrInput _self;
  final $Res Function(GenerateCheckpointQrInput) _then;

/// Create a copy of GenerateCheckpointQrInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sessionId = null,Object? checkpoint = null,Object? validitySeconds = null,Object? graceMinutes = freezed,Object? regenerate = freezed,Object? pin = freezed,Object? teacherLocation = freezed,}) {
  return _then(GenerateCheckpointQrInput(
sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,checkpoint: null == checkpoint ? _self.checkpoint : checkpoint // ignore: cast_nullable_to_non_nullable
as CheckpointType,validitySeconds: null == validitySeconds ? _self.validitySeconds : validitySeconds // ignore: cast_nullable_to_non_nullable
as int,graceMinutes: freezed == graceMinutes ? _self.graceMinutes : graceMinutes // ignore: cast_nullable_to_non_nullable
as int?,regenerate: freezed == regenerate ? _self.regenerate : regenerate // ignore: cast_nullable_to_non_nullable
as bool?,pin: freezed == pin ? _self.pin : pin // ignore: cast_nullable_to_non_nullable
as String?,teacherLocation: freezed == teacherLocation ? _self.teacherLocation : teacherLocation // ignore: cast_nullable_to_non_nullable
as TeacherActivationLocation?,
  ));
}
/// Create a copy of GenerateCheckpointQrInput
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TeacherActivationLocationCopyWith<$Res>? get teacherLocation {
    if (_self.teacherLocation == null) {
    return null;
  }

  return $TeacherActivationLocationCopyWith<$Res>(_self.teacherLocation!, (value) {
    return _then(_self.copyWith(teacherLocation: value));
  });
}
}


/// Adds pattern-matching-related methods to [GenerateCheckpointQrInput].
extension GenerateCheckpointQrInputPatterns on GenerateCheckpointQrInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GenerateCheckpointQrInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GenerateCheckpointQrInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GenerateCheckpointQrInput value)  $default,){
final _that = this;
switch (_that) {
case _GenerateCheckpointQrInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GenerateCheckpointQrInput value)?  $default,){
final _that = this;
switch (_that) {
case _GenerateCheckpointQrInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sessionId,  CheckpointType checkpoint,  int validitySeconds,  int? graceMinutes,  bool? regenerate,  String? pin,  TeacherActivationLocation? teacherLocation)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GenerateCheckpointQrInput() when $default != null:
return $default(_that.sessionId,_that.checkpoint,_that.validitySeconds,_that.graceMinutes,_that.regenerate,_that.pin,_that.teacherLocation);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sessionId,  CheckpointType checkpoint,  int validitySeconds,  int? graceMinutes,  bool? regenerate,  String? pin,  TeacherActivationLocation? teacherLocation)  $default,) {final _that = this;
switch (_that) {
case _GenerateCheckpointQrInput():
return $default(_that.sessionId,_that.checkpoint,_that.validitySeconds,_that.graceMinutes,_that.regenerate,_that.pin,_that.teacherLocation);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sessionId,  CheckpointType checkpoint,  int validitySeconds,  int? graceMinutes,  bool? regenerate,  String? pin,  TeacherActivationLocation? teacherLocation)?  $default,) {final _that = this;
switch (_that) {
case _GenerateCheckpointQrInput() when $default != null:
return $default(_that.sessionId,_that.checkpoint,_that.validitySeconds,_that.graceMinutes,_that.regenerate,_that.pin,_that.teacherLocation);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [CheckpointTypeConverter()])
class _GenerateCheckpointQrInput implements GenerateCheckpointQrInput {
  const _GenerateCheckpointQrInput({required this.sessionId, required this.checkpoint, required this.validitySeconds, this.graceMinutes, this.regenerate, this.pin, this.teacherLocation});
  factory _GenerateCheckpointQrInput.fromJson(Map<String, dynamic> json) => _$GenerateCheckpointQrInputFromJson(json);

@override final  String sessionId;
@override final  CheckpointType checkpoint;
@override final  int validitySeconds;
@override final  int? graceMinutes;
@override final  bool? regenerate;
@override final  String? pin;
@override final  TeacherActivationLocation? teacherLocation;

/// Create a copy of GenerateCheckpointQrInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GenerateCheckpointQrInputCopyWith<_GenerateCheckpointQrInput> get copyWith => __$GenerateCheckpointQrInputCopyWithImpl<_GenerateCheckpointQrInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GenerateCheckpointQrInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _GenerateCheckpointQrInput&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.checkpoint, checkpoint) || other.checkpoint == checkpoint)&&(identical(other.validitySeconds, validitySeconds) || other.validitySeconds == validitySeconds)&&(identical(other.graceMinutes, graceMinutes) || other.graceMinutes == graceMinutes)&&(identical(other.regenerate, regenerate) || other.regenerate == regenerate)&&(identical(other.pin, pin) || other.pin == pin)&&(identical(other.teacherLocation, teacherLocation) || other.teacherLocation == teacherLocation));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sessionId,checkpoint,validitySeconds,graceMinutes,regenerate,pin,teacherLocation);

@override
String toString() {
  return 'GenerateCheckpointQrInput(sessionId: $sessionId, checkpoint: $checkpoint, validitySeconds: $validitySeconds, graceMinutes: $graceMinutes, regenerate: $regenerate, pin: $pin, teacherLocation: $teacherLocation)';
}


}

/// @nodoc
abstract mixin class _$GenerateCheckpointQrInputCopyWith<$Res> implements $GenerateCheckpointQrInputCopyWith<$Res> {
  factory _$GenerateCheckpointQrInputCopyWith(_GenerateCheckpointQrInput value, $Res Function(_GenerateCheckpointQrInput) _then) = __$GenerateCheckpointQrInputCopyWithImpl;
@override @useResult
$Res call({
 String sessionId, CheckpointType checkpoint, int validitySeconds, int? graceMinutes, bool? regenerate, String? pin, TeacherActivationLocation? teacherLocation
});


@override $TeacherActivationLocationCopyWith<$Res>? get teacherLocation;

}
/// @nodoc
class __$GenerateCheckpointQrInputCopyWithImpl<$Res>
    implements _$GenerateCheckpointQrInputCopyWith<$Res> {
  __$GenerateCheckpointQrInputCopyWithImpl(this._self, this._then);

  final _GenerateCheckpointQrInput _self;
  final $Res Function(_GenerateCheckpointQrInput) _then;

/// Create a copy of GenerateCheckpointQrInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sessionId = null,Object? checkpoint = null,Object? validitySeconds = null,Object? graceMinutes = freezed,Object? regenerate = freezed,Object? pin = freezed,Object? teacherLocation = freezed,}) {
  return _then(_GenerateCheckpointQrInput(
sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,checkpoint: null == checkpoint ? _self.checkpoint : checkpoint // ignore: cast_nullable_to_non_nullable
as CheckpointType,validitySeconds: null == validitySeconds ? _self.validitySeconds : validitySeconds // ignore: cast_nullable_to_non_nullable
as int,graceMinutes: freezed == graceMinutes ? _self.graceMinutes : graceMinutes // ignore: cast_nullable_to_non_nullable
as int?,regenerate: freezed == regenerate ? _self.regenerate : regenerate // ignore: cast_nullable_to_non_nullable
as bool?,pin: freezed == pin ? _self.pin : pin // ignore: cast_nullable_to_non_nullable
as String?,teacherLocation: freezed == teacherLocation ? _self.teacherLocation : teacherLocation // ignore: cast_nullable_to_non_nullable
as TeacherActivationLocation?,
  ));
}

/// Create a copy of GenerateCheckpointQrInput
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$TeacherActivationLocationCopyWith<$Res>? get teacherLocation {
    if (_self.teacherLocation == null) {
    return null;
  }

  return $TeacherActivationLocationCopyWith<$Res>(_self.teacherLocation!, (value) {
    return _then(_self.copyWith(teacherLocation: value));
  });
}
}


/// @nodoc
mixin _$BulkSessionSlot {

 String get day; String get startTime; String get endTime;
/// Create a copy of BulkSessionSlot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BulkSessionSlotCopyWith<BulkSessionSlot> get copyWith => _$BulkSessionSlotCopyWithImpl<BulkSessionSlot>(this as BulkSessionSlot, _$identity);

  /// Serializes this BulkSessionSlot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BulkSessionSlot&&(identical(other.day, day) || other.day == day)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,day,startTime,endTime);

@override
String toString() {
  return 'BulkSessionSlot(day: $day, startTime: $startTime, endTime: $endTime)';
}


}

/// @nodoc
abstract mixin class $BulkSessionSlotCopyWith<$Res>  {
  factory $BulkSessionSlotCopyWith(BulkSessionSlot value, $Res Function(BulkSessionSlot) _then) = _$BulkSessionSlotCopyWithImpl;
@useResult
$Res call({
 String day, String startTime, String endTime
});




}
/// @nodoc
class _$BulkSessionSlotCopyWithImpl<$Res>
    implements $BulkSessionSlotCopyWith<$Res> {
  _$BulkSessionSlotCopyWithImpl(this._self, this._then);

  final BulkSessionSlot _self;
  final $Res Function(BulkSessionSlot) _then;

/// Create a copy of BulkSessionSlot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? day = null,Object? startTime = null,Object? endTime = null,}) {
  return _then(BulkSessionSlot(
day: null == day ? _self.day : day // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [BulkSessionSlot].
extension BulkSessionSlotPatterns on BulkSessionSlot {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BulkSessionSlot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BulkSessionSlot() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BulkSessionSlot value)  $default,){
final _that = this;
switch (_that) {
case _BulkSessionSlot():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BulkSessionSlot value)?  $default,){
final _that = this;
switch (_that) {
case _BulkSessionSlot() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String day,  String startTime,  String endTime)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BulkSessionSlot() when $default != null:
return $default(_that.day,_that.startTime,_that.endTime);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String day,  String startTime,  String endTime)  $default,) {final _that = this;
switch (_that) {
case _BulkSessionSlot():
return $default(_that.day,_that.startTime,_that.endTime);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String day,  String startTime,  String endTime)?  $default,) {final _that = this;
switch (_that) {
case _BulkSessionSlot() when $default != null:
return $default(_that.day,_that.startTime,_that.endTime);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _BulkSessionSlot implements BulkSessionSlot {
  const _BulkSessionSlot({required this.day, required this.startTime, required this.endTime});
  factory _BulkSessionSlot.fromJson(Map<String, dynamic> json) => _$BulkSessionSlotFromJson(json);

@override final  String day;
@override final  String startTime;
@override final  String endTime;

/// Create a copy of BulkSessionSlot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BulkSessionSlotCopyWith<_BulkSessionSlot> get copyWith => __$BulkSessionSlotCopyWithImpl<_BulkSessionSlot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BulkSessionSlotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BulkSessionSlot&&(identical(other.day, day) || other.day == day)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,day,startTime,endTime);

@override
String toString() {
  return 'BulkSessionSlot(day: $day, startTime: $startTime, endTime: $endTime)';
}


}

/// @nodoc
abstract mixin class _$BulkSessionSlotCopyWith<$Res> implements $BulkSessionSlotCopyWith<$Res> {
  factory _$BulkSessionSlotCopyWith(_BulkSessionSlot value, $Res Function(_BulkSessionSlot) _then) = __$BulkSessionSlotCopyWithImpl;
@override @useResult
$Res call({
 String day, String startTime, String endTime
});




}
/// @nodoc
class __$BulkSessionSlotCopyWithImpl<$Res>
    implements _$BulkSessionSlotCopyWith<$Res> {
  __$BulkSessionSlotCopyWithImpl(this._self, this._then);

  final _BulkSessionSlot _self;
  final $Res Function(_BulkSessionSlot) _then;

/// Create a copy of BulkSessionSlot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? day = null,Object? startTime = null,Object? endTime = null,}) {
  return _then(_BulkSessionSlot(
day: null == day ? _self.day : day // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$BulkSessionInput {

 String get sectionId; String get subjectName; String get startDate; String get endDate; List<BulkSessionSlot>? get slots; List<String>? get daysOfWeek; String? get startTime; String? get endTime; String? get room; SessionMode? get mode; int? get qrValidityMinutes; int? get gracePeriodMinutes; int? get startQrValiditySeconds; int? get startGraceMinutes; int? get endQrValiditySeconds; GeofenceConfig? get geofence; String get teacherId;
/// Create a copy of BulkSessionInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BulkSessionInputCopyWith<BulkSessionInput> get copyWith => _$BulkSessionInputCopyWithImpl<BulkSessionInput>(this as BulkSessionInput, _$identity);

  /// Serializes this BulkSessionInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BulkSessionInput&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&const DeepCollectionEquality().equals(other.slots, slots)&&const DeepCollectionEquality().equals(other.daysOfWeek, daysOfWeek)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.qrValidityMinutes, qrValidityMinutes) || other.qrValidityMinutes == qrValidityMinutes)&&(identical(other.gracePeriodMinutes, gracePeriodMinutes) || other.gracePeriodMinutes == gracePeriodMinutes)&&(identical(other.startQrValiditySeconds, startQrValiditySeconds) || other.startQrValiditySeconds == startQrValiditySeconds)&&(identical(other.startGraceMinutes, startGraceMinutes) || other.startGraceMinutes == startGraceMinutes)&&(identical(other.endQrValiditySeconds, endQrValiditySeconds) || other.endQrValiditySeconds == endQrValiditySeconds)&&(identical(other.geofence, geofence) || other.geofence == geofence)&&(identical(other.teacherId, teacherId) || other.teacherId == teacherId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,subjectName,startDate,endDate,const DeepCollectionEquality().hash(slots),const DeepCollectionEquality().hash(daysOfWeek),startTime,endTime,room,mode,qrValidityMinutes,gracePeriodMinutes,startQrValiditySeconds,startGraceMinutes,endQrValiditySeconds,geofence,teacherId);

@override
String toString() {
  return 'BulkSessionInput(sectionId: $sectionId, subjectName: $subjectName, startDate: $startDate, endDate: $endDate, slots: $slots, daysOfWeek: $daysOfWeek, startTime: $startTime, endTime: $endTime, room: $room, mode: $mode, qrValidityMinutes: $qrValidityMinutes, gracePeriodMinutes: $gracePeriodMinutes, startQrValiditySeconds: $startQrValiditySeconds, startGraceMinutes: $startGraceMinutes, endQrValiditySeconds: $endQrValiditySeconds, geofence: $geofence, teacherId: $teacherId)';
}


}

/// @nodoc
abstract mixin class $BulkSessionInputCopyWith<$Res>  {
  factory $BulkSessionInputCopyWith(BulkSessionInput value, $Res Function(BulkSessionInput) _then) = _$BulkSessionInputCopyWithImpl;
@useResult
$Res call({
 String sectionId, String subjectName, String startDate, String endDate, List<BulkSessionSlot>? slots, List<String>? daysOfWeek, String? startTime, String? endTime, String? room, SessionMode? mode, int? qrValidityMinutes, int? gracePeriodMinutes, int? startQrValiditySeconds, int? startGraceMinutes, int? endQrValiditySeconds, GeofenceConfig? geofence, String teacherId
});


$GeofenceConfigCopyWith<$Res>? get geofence;

}
/// @nodoc
class _$BulkSessionInputCopyWithImpl<$Res>
    implements $BulkSessionInputCopyWith<$Res> {
  _$BulkSessionInputCopyWithImpl(this._self, this._then);

  final BulkSessionInput _self;
  final $Res Function(BulkSessionInput) _then;

/// Create a copy of BulkSessionInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sectionId = null,Object? subjectName = null,Object? startDate = null,Object? endDate = null,Object? slots = freezed,Object? daysOfWeek = freezed,Object? startTime = freezed,Object? endTime = freezed,Object? room = freezed,Object? mode = freezed,Object? qrValidityMinutes = freezed,Object? gracePeriodMinutes = freezed,Object? startQrValiditySeconds = freezed,Object? startGraceMinutes = freezed,Object? endQrValiditySeconds = freezed,Object? geofence = freezed,Object? teacherId = null,}) {
  return _then(BulkSessionInput(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,startDate: null == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String,endDate: null == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String,slots: freezed == slots ? _self.slots : slots // ignore: cast_nullable_to_non_nullable
as List<BulkSessionSlot>?,daysOfWeek: freezed == daysOfWeek ? _self.daysOfWeek : daysOfWeek // ignore: cast_nullable_to_non_nullable
as List<String>?,startTime: freezed == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String?,endTime: freezed == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String?,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,mode: freezed == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode?,qrValidityMinutes: freezed == qrValidityMinutes ? _self.qrValidityMinutes : qrValidityMinutes // ignore: cast_nullable_to_non_nullable
as int?,gracePeriodMinutes: freezed == gracePeriodMinutes ? _self.gracePeriodMinutes : gracePeriodMinutes // ignore: cast_nullable_to_non_nullable
as int?,startQrValiditySeconds: freezed == startQrValiditySeconds ? _self.startQrValiditySeconds : startQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,startGraceMinutes: freezed == startGraceMinutes ? _self.startGraceMinutes : startGraceMinutes // ignore: cast_nullable_to_non_nullable
as int?,endQrValiditySeconds: freezed == endQrValiditySeconds ? _self.endQrValiditySeconds : endQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,geofence: freezed == geofence ? _self.geofence : geofence // ignore: cast_nullable_to_non_nullable
as GeofenceConfig?,teacherId: null == teacherId ? _self.teacherId : teacherId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}
/// Create a copy of BulkSessionInput
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


/// Adds pattern-matching-related methods to [BulkSessionInput].
extension BulkSessionInputPatterns on BulkSessionInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BulkSessionInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BulkSessionInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BulkSessionInput value)  $default,){
final _that = this;
switch (_that) {
case _BulkSessionInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BulkSessionInput value)?  $default,){
final _that = this;
switch (_that) {
case _BulkSessionInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sectionId,  String subjectName,  String startDate,  String endDate,  List<BulkSessionSlot>? slots,  List<String>? daysOfWeek,  String? startTime,  String? endTime,  String? room,  SessionMode? mode,  int? qrValidityMinutes,  int? gracePeriodMinutes,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  GeofenceConfig? geofence,  String teacherId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BulkSessionInput() when $default != null:
return $default(_that.sectionId,_that.subjectName,_that.startDate,_that.endDate,_that.slots,_that.daysOfWeek,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.geofence,_that.teacherId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sectionId,  String subjectName,  String startDate,  String endDate,  List<BulkSessionSlot>? slots,  List<String>? daysOfWeek,  String? startTime,  String? endTime,  String? room,  SessionMode? mode,  int? qrValidityMinutes,  int? gracePeriodMinutes,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  GeofenceConfig? geofence,  String teacherId)  $default,) {final _that = this;
switch (_that) {
case _BulkSessionInput():
return $default(_that.sectionId,_that.subjectName,_that.startDate,_that.endDate,_that.slots,_that.daysOfWeek,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.geofence,_that.teacherId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sectionId,  String subjectName,  String startDate,  String endDate,  List<BulkSessionSlot>? slots,  List<String>? daysOfWeek,  String? startTime,  String? endTime,  String? room,  SessionMode? mode,  int? qrValidityMinutes,  int? gracePeriodMinutes,  int? startQrValiditySeconds,  int? startGraceMinutes,  int? endQrValiditySeconds,  GeofenceConfig? geofence,  String teacherId)?  $default,) {final _that = this;
switch (_that) {
case _BulkSessionInput() when $default != null:
return $default(_that.sectionId,_that.subjectName,_that.startDate,_that.endDate,_that.slots,_that.daysOfWeek,_that.startTime,_that.endTime,_that.room,_that.mode,_that.qrValidityMinutes,_that.gracePeriodMinutes,_that.startQrValiditySeconds,_that.startGraceMinutes,_that.endQrValiditySeconds,_that.geofence,_that.teacherId);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [SessionModeConverter()])
class _BulkSessionInput implements BulkSessionInput {
  const _BulkSessionInput({required this.sectionId, required this.subjectName, required this.startDate, required this.endDate,  List<BulkSessionSlot>? slots,  List<String>? daysOfWeek, this.startTime, this.endTime, this.room, this.mode, this.qrValidityMinutes, this.gracePeriodMinutes, this.startQrValiditySeconds, this.startGraceMinutes, this.endQrValiditySeconds, this.geofence, required this.teacherId}): _slots = slots,_daysOfWeek = daysOfWeek;
  factory _BulkSessionInput.fromJson(Map<String, dynamic> json) => _$BulkSessionInputFromJson(json);

@override final  String sectionId;
@override final  String subjectName;
@override final  String startDate;
@override final  String endDate;
 final  List<BulkSessionSlot>? _slots;
@override List<BulkSessionSlot>? get slots {
  final value = _slots;
  if (value == null) return null;
  if (_slots is EqualUnmodifiableListView) return _slots;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

 final  List<String>? _daysOfWeek;
@override List<String>? get daysOfWeek {
  final value = _daysOfWeek;
  if (value == null) return null;
  if (_daysOfWeek is EqualUnmodifiableListView) return _daysOfWeek;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}

@override final  String? startTime;
@override final  String? endTime;
@override final  String? room;
@override final  SessionMode? mode;
@override final  int? qrValidityMinutes;
@override final  int? gracePeriodMinutes;
@override final  int? startQrValiditySeconds;
@override final  int? startGraceMinutes;
@override final  int? endQrValiditySeconds;
@override final  GeofenceConfig? geofence;
@override final  String teacherId;

/// Create a copy of BulkSessionInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BulkSessionInputCopyWith<_BulkSessionInput> get copyWith => __$BulkSessionInputCopyWithImpl<_BulkSessionInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BulkSessionInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BulkSessionInput&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&const DeepCollectionEquality().equals(other._slots, _slots)&&const DeepCollectionEquality().equals(other._daysOfWeek, _daysOfWeek)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room)&&(identical(other.mode, mode) || other.mode == mode)&&(identical(other.qrValidityMinutes, qrValidityMinutes) || other.qrValidityMinutes == qrValidityMinutes)&&(identical(other.gracePeriodMinutes, gracePeriodMinutes) || other.gracePeriodMinutes == gracePeriodMinutes)&&(identical(other.startQrValiditySeconds, startQrValiditySeconds) || other.startQrValiditySeconds == startQrValiditySeconds)&&(identical(other.startGraceMinutes, startGraceMinutes) || other.startGraceMinutes == startGraceMinutes)&&(identical(other.endQrValiditySeconds, endQrValiditySeconds) || other.endQrValiditySeconds == endQrValiditySeconds)&&(identical(other.geofence, geofence) || other.geofence == geofence)&&(identical(other.teacherId, teacherId) || other.teacherId == teacherId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,subjectName,startDate,endDate,const DeepCollectionEquality().hash(_slots),const DeepCollectionEquality().hash(_daysOfWeek),startTime,endTime,room,mode,qrValidityMinutes,gracePeriodMinutes,startQrValiditySeconds,startGraceMinutes,endQrValiditySeconds,geofence,teacherId);

@override
String toString() {
  return 'BulkSessionInput(sectionId: $sectionId, subjectName: $subjectName, startDate: $startDate, endDate: $endDate, slots: $slots, daysOfWeek: $daysOfWeek, startTime: $startTime, endTime: $endTime, room: $room, mode: $mode, qrValidityMinutes: $qrValidityMinutes, gracePeriodMinutes: $gracePeriodMinutes, startQrValiditySeconds: $startQrValiditySeconds, startGraceMinutes: $startGraceMinutes, endQrValiditySeconds: $endQrValiditySeconds, geofence: $geofence, teacherId: $teacherId)';
}


}

/// @nodoc
abstract mixin class _$BulkSessionInputCopyWith<$Res> implements $BulkSessionInputCopyWith<$Res> {
  factory _$BulkSessionInputCopyWith(_BulkSessionInput value, $Res Function(_BulkSessionInput) _then) = __$BulkSessionInputCopyWithImpl;
@override @useResult
$Res call({
 String sectionId, String subjectName, String startDate, String endDate, List<BulkSessionSlot>? slots, List<String>? daysOfWeek, String? startTime, String? endTime, String? room, SessionMode? mode, int? qrValidityMinutes, int? gracePeriodMinutes, int? startQrValiditySeconds, int? startGraceMinutes, int? endQrValiditySeconds, GeofenceConfig? geofence, String teacherId
});


@override $GeofenceConfigCopyWith<$Res>? get geofence;

}
/// @nodoc
class __$BulkSessionInputCopyWithImpl<$Res>
    implements _$BulkSessionInputCopyWith<$Res> {
  __$BulkSessionInputCopyWithImpl(this._self, this._then);

  final _BulkSessionInput _self;
  final $Res Function(_BulkSessionInput) _then;

/// Create a copy of BulkSessionInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sectionId = null,Object? subjectName = null,Object? startDate = null,Object? endDate = null,Object? slots = freezed,Object? daysOfWeek = freezed,Object? startTime = freezed,Object? endTime = freezed,Object? room = freezed,Object? mode = freezed,Object? qrValidityMinutes = freezed,Object? gracePeriodMinutes = freezed,Object? startQrValiditySeconds = freezed,Object? startGraceMinutes = freezed,Object? endQrValiditySeconds = freezed,Object? geofence = freezed,Object? teacherId = null,}) {
  return _then(_BulkSessionInput(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,startDate: null == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String,endDate: null == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String,slots: freezed == slots ? _self._slots : slots // ignore: cast_nullable_to_non_nullable
as List<BulkSessionSlot>?,daysOfWeek: freezed == daysOfWeek ? _self._daysOfWeek : daysOfWeek // ignore: cast_nullable_to_non_nullable
as List<String>?,startTime: freezed == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String?,endTime: freezed == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String?,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,mode: freezed == mode ? _self.mode : mode // ignore: cast_nullable_to_non_nullable
as SessionMode?,qrValidityMinutes: freezed == qrValidityMinutes ? _self.qrValidityMinutes : qrValidityMinutes // ignore: cast_nullable_to_non_nullable
as int?,gracePeriodMinutes: freezed == gracePeriodMinutes ? _self.gracePeriodMinutes : gracePeriodMinutes // ignore: cast_nullable_to_non_nullable
as int?,startQrValiditySeconds: freezed == startQrValiditySeconds ? _self.startQrValiditySeconds : startQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,startGraceMinutes: freezed == startGraceMinutes ? _self.startGraceMinutes : startGraceMinutes // ignore: cast_nullable_to_non_nullable
as int?,endQrValiditySeconds: freezed == endQrValiditySeconds ? _self.endQrValiditySeconds : endQrValiditySeconds // ignore: cast_nullable_to_non_nullable
as int?,geofence: freezed == geofence ? _self.geofence : geofence // ignore: cast_nullable_to_non_nullable
as GeofenceConfig?,teacherId: null == teacherId ? _self.teacherId : teacherId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

/// Create a copy of BulkSessionInput
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
mixin _$EnrollStudentInput {

 String get sectionId; String get studentId; String get studentName;
/// Create a copy of EnrollStudentInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EnrollStudentInputCopyWith<EnrollStudentInput> get copyWith => _$EnrollStudentInputCopyWithImpl<EnrollStudentInput>(this as EnrollStudentInput, _$identity);

  /// Serializes this EnrollStudentInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EnrollStudentInput&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,studentId,studentName);

@override
String toString() {
  return 'EnrollStudentInput(sectionId: $sectionId, studentId: $studentId, studentName: $studentName)';
}


}

/// @nodoc
abstract mixin class $EnrollStudentInputCopyWith<$Res>  {
  factory $EnrollStudentInputCopyWith(EnrollStudentInput value, $Res Function(EnrollStudentInput) _then) = _$EnrollStudentInputCopyWithImpl;
@useResult
$Res call({
 String sectionId, String studentId, String studentName
});




}
/// @nodoc
class _$EnrollStudentInputCopyWithImpl<$Res>
    implements $EnrollStudentInputCopyWith<$Res> {
  _$EnrollStudentInputCopyWithImpl(this._self, this._then);

  final EnrollStudentInput _self;
  final $Res Function(EnrollStudentInput) _then;

/// Create a copy of EnrollStudentInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? sectionId = null,Object? studentId = null,Object? studentName = null,}) {
  return _then(EnrollStudentInput(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [EnrollStudentInput].
extension EnrollStudentInputPatterns on EnrollStudentInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EnrollStudentInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EnrollStudentInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EnrollStudentInput value)  $default,){
final _that = this;
switch (_that) {
case _EnrollStudentInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EnrollStudentInput value)?  $default,){
final _that = this;
switch (_that) {
case _EnrollStudentInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String sectionId,  String studentId,  String studentName)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EnrollStudentInput() when $default != null:
return $default(_that.sectionId,_that.studentId,_that.studentName);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String sectionId,  String studentId,  String studentName)  $default,) {final _that = this;
switch (_that) {
case _EnrollStudentInput():
return $default(_that.sectionId,_that.studentId,_that.studentName);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String sectionId,  String studentId,  String studentName)?  $default,) {final _that = this;
switch (_that) {
case _EnrollStudentInput() when $default != null:
return $default(_that.sectionId,_that.studentId,_that.studentName);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _EnrollStudentInput implements EnrollStudentInput {
  const _EnrollStudentInput({required this.sectionId, required this.studentId, required this.studentName});
  factory _EnrollStudentInput.fromJson(Map<String, dynamic> json) => _$EnrollStudentInputFromJson(json);

@override final  String sectionId;
@override final  String studentId;
@override final  String studentName;

/// Create a copy of EnrollStudentInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EnrollStudentInputCopyWith<_EnrollStudentInput> get copyWith => __$EnrollStudentInputCopyWithImpl<_EnrollStudentInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EnrollStudentInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EnrollStudentInput&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,sectionId,studentId,studentName);

@override
String toString() {
  return 'EnrollStudentInput(sectionId: $sectionId, studentId: $studentId, studentName: $studentName)';
}


}

/// @nodoc
abstract mixin class _$EnrollStudentInputCopyWith<$Res> implements $EnrollStudentInputCopyWith<$Res> {
  factory _$EnrollStudentInputCopyWith(_EnrollStudentInput value, $Res Function(_EnrollStudentInput) _then) = __$EnrollStudentInputCopyWithImpl;
@override @useResult
$Res call({
 String sectionId, String studentId, String studentName
});




}
/// @nodoc
class __$EnrollStudentInputCopyWithImpl<$Res>
    implements _$EnrollStudentInputCopyWith<$Res> {
  __$EnrollStudentInputCopyWithImpl(this._self, this._then);

  final _EnrollStudentInput _self;
  final $Res Function(_EnrollStudentInput) _then;

/// Create a copy of EnrollStudentInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? sectionId = null,Object? studentId = null,Object? studentName = null,}) {
  return _then(_EnrollStudentInput(
sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$CalendarEventAttendanceCounts {

 int get present; int get late; int get absent; int get disputed;
/// Create a copy of CalendarEventAttendanceCounts
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CalendarEventAttendanceCountsCopyWith<CalendarEventAttendanceCounts> get copyWith => _$CalendarEventAttendanceCountsCopyWithImpl<CalendarEventAttendanceCounts>(this as CalendarEventAttendanceCounts, _$identity);

  /// Serializes this CalendarEventAttendanceCounts to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CalendarEventAttendanceCounts&&(identical(other.present, present) || other.present == present)&&(identical(other.late, late) || other.late == late)&&(identical(other.absent, absent) || other.absent == absent)&&(identical(other.disputed, disputed) || other.disputed == disputed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,present,late,absent,disputed);

@override
String toString() {
  return 'CalendarEventAttendanceCounts(present: $present, late: $late, absent: $absent, disputed: $disputed)';
}


}

/// @nodoc
abstract mixin class $CalendarEventAttendanceCountsCopyWith<$Res>  {
  factory $CalendarEventAttendanceCountsCopyWith(CalendarEventAttendanceCounts value, $Res Function(CalendarEventAttendanceCounts) _then) = _$CalendarEventAttendanceCountsCopyWithImpl;
@useResult
$Res call({
 int present, int late, int absent, int disputed
});




}
/// @nodoc
class _$CalendarEventAttendanceCountsCopyWithImpl<$Res>
    implements $CalendarEventAttendanceCountsCopyWith<$Res> {
  _$CalendarEventAttendanceCountsCopyWithImpl(this._self, this._then);

  final CalendarEventAttendanceCounts _self;
  final $Res Function(CalendarEventAttendanceCounts) _then;

/// Create a copy of CalendarEventAttendanceCounts
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? present = null,Object? late = null,Object? absent = null,Object? disputed = null,}) {
  return _then(CalendarEventAttendanceCounts(
present: null == present ? _self.present : present // ignore: cast_nullable_to_non_nullable
as int,late: null == late ? _self.late : late // ignore: cast_nullable_to_non_nullable
as int,absent: null == absent ? _self.absent : absent // ignore: cast_nullable_to_non_nullable
as int,disputed: null == disputed ? _self.disputed : disputed // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [CalendarEventAttendanceCounts].
extension CalendarEventAttendanceCountsPatterns on CalendarEventAttendanceCounts {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CalendarEventAttendanceCounts value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CalendarEventAttendanceCounts() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CalendarEventAttendanceCounts value)  $default,){
final _that = this;
switch (_that) {
case _CalendarEventAttendanceCounts():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CalendarEventAttendanceCounts value)?  $default,){
final _that = this;
switch (_that) {
case _CalendarEventAttendanceCounts() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int present,  int late,  int absent,  int disputed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CalendarEventAttendanceCounts() when $default != null:
return $default(_that.present,_that.late,_that.absent,_that.disputed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int present,  int late,  int absent,  int disputed)  $default,) {final _that = this;
switch (_that) {
case _CalendarEventAttendanceCounts():
return $default(_that.present,_that.late,_that.absent,_that.disputed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int present,  int late,  int absent,  int disputed)?  $default,) {final _that = this;
switch (_that) {
case _CalendarEventAttendanceCounts() when $default != null:
return $default(_that.present,_that.late,_that.absent,_that.disputed);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _CalendarEventAttendanceCounts implements CalendarEventAttendanceCounts {
  const _CalendarEventAttendanceCounts({this.present = 0, this.late = 0, this.absent = 0, this.disputed = 0});
  factory _CalendarEventAttendanceCounts.fromJson(Map<String, dynamic> json) => _$CalendarEventAttendanceCountsFromJson(json);

@override@JsonKey() final  int present;
@override@JsonKey() final  int late;
@override@JsonKey() final  int absent;
@override@JsonKey() final  int disputed;

/// Create a copy of CalendarEventAttendanceCounts
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CalendarEventAttendanceCountsCopyWith<_CalendarEventAttendanceCounts> get copyWith => __$CalendarEventAttendanceCountsCopyWithImpl<_CalendarEventAttendanceCounts>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CalendarEventAttendanceCountsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CalendarEventAttendanceCounts&&(identical(other.present, present) || other.present == present)&&(identical(other.late, late) || other.late == late)&&(identical(other.absent, absent) || other.absent == absent)&&(identical(other.disputed, disputed) || other.disputed == disputed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,present,late,absent,disputed);

@override
String toString() {
  return 'CalendarEventAttendanceCounts(present: $present, late: $late, absent: $absent, disputed: $disputed)';
}


}

/// @nodoc
abstract mixin class _$CalendarEventAttendanceCountsCopyWith<$Res> implements $CalendarEventAttendanceCountsCopyWith<$Res> {
  factory _$CalendarEventAttendanceCountsCopyWith(_CalendarEventAttendanceCounts value, $Res Function(_CalendarEventAttendanceCounts) _then) = __$CalendarEventAttendanceCountsCopyWithImpl;
@override @useResult
$Res call({
 int present, int late, int absent, int disputed
});




}
/// @nodoc
class __$CalendarEventAttendanceCountsCopyWithImpl<$Res>
    implements _$CalendarEventAttendanceCountsCopyWith<$Res> {
  __$CalendarEventAttendanceCountsCopyWithImpl(this._self, this._then);

  final _CalendarEventAttendanceCounts _self;
  final $Res Function(_CalendarEventAttendanceCounts) _then;

/// Create a copy of CalendarEventAttendanceCounts
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? present = null,Object? late = null,Object? absent = null,Object? disputed = null,}) {
  return _then(_CalendarEventAttendanceCounts(
present: null == present ? _self.present : present // ignore: cast_nullable_to_non_nullable
as int,late: null == late ? _self.late : late // ignore: cast_nullable_to_non_nullable
as int,absent: null == absent ? _self.absent : absent // ignore: cast_nullable_to_non_nullable
as int,disputed: null == disputed ? _self.disputed : disputed // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$CalendarEventReschedule {

 String get date; String get startTime; String get endTime; String? get room;
/// Create a copy of CalendarEventReschedule
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CalendarEventRescheduleCopyWith<CalendarEventReschedule> get copyWith => _$CalendarEventRescheduleCopyWithImpl<CalendarEventReschedule>(this as CalendarEventReschedule, _$identity);

  /// Serializes this CalendarEventReschedule to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CalendarEventReschedule&&(identical(other.date, date) || other.date == date)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,date,startTime,endTime,room);

@override
String toString() {
  return 'CalendarEventReschedule(date: $date, startTime: $startTime, endTime: $endTime, room: $room)';
}


}

/// @nodoc
abstract mixin class $CalendarEventRescheduleCopyWith<$Res>  {
  factory $CalendarEventRescheduleCopyWith(CalendarEventReschedule value, $Res Function(CalendarEventReschedule) _then) = _$CalendarEventRescheduleCopyWithImpl;
@useResult
$Res call({
 String date, String startTime, String endTime, String? room
});




}
/// @nodoc
class _$CalendarEventRescheduleCopyWithImpl<$Res>
    implements $CalendarEventRescheduleCopyWith<$Res> {
  _$CalendarEventRescheduleCopyWithImpl(this._self, this._then);

  final CalendarEventReschedule _self;
  final $Res Function(CalendarEventReschedule) _then;

/// Create a copy of CalendarEventReschedule
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? date = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,}) {
  return _then(CalendarEventReschedule(
date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CalendarEventReschedule].
extension CalendarEventReschedulePatterns on CalendarEventReschedule {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CalendarEventReschedule value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CalendarEventReschedule() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CalendarEventReschedule value)  $default,){
final _that = this;
switch (_that) {
case _CalendarEventReschedule():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CalendarEventReschedule value)?  $default,){
final _that = this;
switch (_that) {
case _CalendarEventReschedule() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String date,  String startTime,  String endTime,  String? room)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CalendarEventReschedule() when $default != null:
return $default(_that.date,_that.startTime,_that.endTime,_that.room);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String date,  String startTime,  String endTime,  String? room)  $default,) {final _that = this;
switch (_that) {
case _CalendarEventReschedule():
return $default(_that.date,_that.startTime,_that.endTime,_that.room);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String date,  String startTime,  String endTime,  String? room)?  $default,) {final _that = this;
switch (_that) {
case _CalendarEventReschedule() when $default != null:
return $default(_that.date,_that.startTime,_that.endTime,_that.room);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _CalendarEventReschedule implements CalendarEventReschedule {
  const _CalendarEventReschedule({required this.date, required this.startTime, required this.endTime, this.room});
  factory _CalendarEventReschedule.fromJson(Map<String, dynamic> json) => _$CalendarEventRescheduleFromJson(json);

@override final  String date;
@override final  String startTime;
@override final  String endTime;
@override final  String? room;

/// Create a copy of CalendarEventReschedule
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CalendarEventRescheduleCopyWith<_CalendarEventReschedule> get copyWith => __$CalendarEventRescheduleCopyWithImpl<_CalendarEventReschedule>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CalendarEventRescheduleToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CalendarEventReschedule&&(identical(other.date, date) || other.date == date)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,date,startTime,endTime,room);

@override
String toString() {
  return 'CalendarEventReschedule(date: $date, startTime: $startTime, endTime: $endTime, room: $room)';
}


}

/// @nodoc
abstract mixin class _$CalendarEventRescheduleCopyWith<$Res> implements $CalendarEventRescheduleCopyWith<$Res> {
  factory _$CalendarEventRescheduleCopyWith(_CalendarEventReschedule value, $Res Function(_CalendarEventReschedule) _then) = __$CalendarEventRescheduleCopyWithImpl;
@override @useResult
$Res call({
 String date, String startTime, String endTime, String? room
});




}
/// @nodoc
class __$CalendarEventRescheduleCopyWithImpl<$Res>
    implements _$CalendarEventRescheduleCopyWith<$Res> {
  __$CalendarEventRescheduleCopyWithImpl(this._self, this._then);

  final _CalendarEventReschedule _self;
  final $Res Function(_CalendarEventReschedule) _then;

/// Create a copy of CalendarEventReschedule
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? date = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,}) {
  return _then(_CalendarEventReschedule(
date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$CalendarEvent {

 String get id; String get title; String get date; String get startTime; String get endTime; String? get room; String get sectionId; String get subjectName; String get sectionName; CalendarEventType get type; CalendarEventStatus? get status; CalendarEventStudentStatus? get studentStatus; CalendarEventAttendanceCounts? get attendanceCounts; String? get teacherName; String? get subjectCode; bool? get isRescheduled; String? get rescheduledFromDate; CalendarEventReschedule? get rescheduledTo;
/// Create a copy of CalendarEvent
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CalendarEventCopyWith<CalendarEvent> get copyWith => _$CalendarEventCopyWithImpl<CalendarEvent>(this as CalendarEvent, _$identity);

  /// Serializes this CalendarEvent to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CalendarEvent&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.date, date) || other.date == date)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.sectionName, sectionName) || other.sectionName == sectionName)&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.studentStatus, studentStatus) || other.studentStatus == studentStatus)&&(identical(other.attendanceCounts, attendanceCounts) || other.attendanceCounts == attendanceCounts)&&(identical(other.teacherName, teacherName) || other.teacherName == teacherName)&&(identical(other.subjectCode, subjectCode) || other.subjectCode == subjectCode)&&(identical(other.isRescheduled, isRescheduled) || other.isRescheduled == isRescheduled)&&(identical(other.rescheduledFromDate, rescheduledFromDate) || other.rescheduledFromDate == rescheduledFromDate)&&(identical(other.rescheduledTo, rescheduledTo) || other.rescheduledTo == rescheduledTo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,date,startTime,endTime,room,sectionId,subjectName,sectionName,type,status,studentStatus,attendanceCounts,teacherName,subjectCode,isRescheduled,rescheduledFromDate,rescheduledTo);

@override
String toString() {
  return 'CalendarEvent(id: $id, title: $title, date: $date, startTime: $startTime, endTime: $endTime, room: $room, sectionId: $sectionId, subjectName: $subjectName, sectionName: $sectionName, type: $type, status: $status, studentStatus: $studentStatus, attendanceCounts: $attendanceCounts, teacherName: $teacherName, subjectCode: $subjectCode, isRescheduled: $isRescheduled, rescheduledFromDate: $rescheduledFromDate, rescheduledTo: $rescheduledTo)';
}


}

/// @nodoc
abstract mixin class $CalendarEventCopyWith<$Res>  {
  factory $CalendarEventCopyWith(CalendarEvent value, $Res Function(CalendarEvent) _then) = _$CalendarEventCopyWithImpl;
@useResult
$Res call({
 String id, String title, String date, String startTime, String endTime, String? room, String sectionId, String subjectName, String sectionName, CalendarEventType type, CalendarEventStatus? status, CalendarEventStudentStatus? studentStatus, CalendarEventAttendanceCounts? attendanceCounts, String? teacherName, String? subjectCode, bool? isRescheduled, String? rescheduledFromDate, CalendarEventReschedule? rescheduledTo
});


$CalendarEventAttendanceCountsCopyWith<$Res>? get attendanceCounts;$CalendarEventRescheduleCopyWith<$Res>? get rescheduledTo;

}
/// @nodoc
class _$CalendarEventCopyWithImpl<$Res>
    implements $CalendarEventCopyWith<$Res> {
  _$CalendarEventCopyWithImpl(this._self, this._then);

  final CalendarEvent _self;
  final $Res Function(CalendarEvent) _then;

/// Create a copy of CalendarEvent
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? date = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,Object? sectionId = null,Object? subjectName = null,Object? sectionName = null,Object? type = null,Object? status = freezed,Object? studentStatus = freezed,Object? attendanceCounts = freezed,Object? teacherName = freezed,Object? subjectCode = freezed,Object? isRescheduled = freezed,Object? rescheduledFromDate = freezed,Object? rescheduledTo = freezed,}) {
  return _then(CalendarEvent(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,sectionName: null == sectionName ? _self.sectionName : sectionName // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as CalendarEventType,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as CalendarEventStatus?,studentStatus: freezed == studentStatus ? _self.studentStatus : studentStatus // ignore: cast_nullable_to_non_nullable
as CalendarEventStudentStatus?,attendanceCounts: freezed == attendanceCounts ? _self.attendanceCounts : attendanceCounts // ignore: cast_nullable_to_non_nullable
as CalendarEventAttendanceCounts?,teacherName: freezed == teacherName ? _self.teacherName : teacherName // ignore: cast_nullable_to_non_nullable
as String?,subjectCode: freezed == subjectCode ? _self.subjectCode : subjectCode // ignore: cast_nullable_to_non_nullable
as String?,isRescheduled: freezed == isRescheduled ? _self.isRescheduled : isRescheduled // ignore: cast_nullable_to_non_nullable
as bool?,rescheduledFromDate: freezed == rescheduledFromDate ? _self.rescheduledFromDate : rescheduledFromDate // ignore: cast_nullable_to_non_nullable
as String?,rescheduledTo: freezed == rescheduledTo ? _self.rescheduledTo : rescheduledTo // ignore: cast_nullable_to_non_nullable
as CalendarEventReschedule?,
  ));
}
/// Create a copy of CalendarEvent
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CalendarEventAttendanceCountsCopyWith<$Res>? get attendanceCounts {
    if (_self.attendanceCounts == null) {
    return null;
  }

  return $CalendarEventAttendanceCountsCopyWith<$Res>(_self.attendanceCounts!, (value) {
    return _then(_self.copyWith(attendanceCounts: value));
  });
}/// Create a copy of CalendarEvent
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CalendarEventRescheduleCopyWith<$Res>? get rescheduledTo {
    if (_self.rescheduledTo == null) {
    return null;
  }

  return $CalendarEventRescheduleCopyWith<$Res>(_self.rescheduledTo!, (value) {
    return _then(_self.copyWith(rescheduledTo: value));
  });
}
}


/// Adds pattern-matching-related methods to [CalendarEvent].
extension CalendarEventPatterns on CalendarEvent {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CalendarEvent value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CalendarEvent() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CalendarEvent value)  $default,){
final _that = this;
switch (_that) {
case _CalendarEvent():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CalendarEvent value)?  $default,){
final _that = this;
switch (_that) {
case _CalendarEvent() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  String date,  String startTime,  String endTime,  String? room,  String sectionId,  String subjectName,  String sectionName,  CalendarEventType type,  CalendarEventStatus? status,  CalendarEventStudentStatus? studentStatus,  CalendarEventAttendanceCounts? attendanceCounts,  String? teacherName,  String? subjectCode,  bool? isRescheduled,  String? rescheduledFromDate,  CalendarEventReschedule? rescheduledTo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CalendarEvent() when $default != null:
return $default(_that.id,_that.title,_that.date,_that.startTime,_that.endTime,_that.room,_that.sectionId,_that.subjectName,_that.sectionName,_that.type,_that.status,_that.studentStatus,_that.attendanceCounts,_that.teacherName,_that.subjectCode,_that.isRescheduled,_that.rescheduledFromDate,_that.rescheduledTo);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  String date,  String startTime,  String endTime,  String? room,  String sectionId,  String subjectName,  String sectionName,  CalendarEventType type,  CalendarEventStatus? status,  CalendarEventStudentStatus? studentStatus,  CalendarEventAttendanceCounts? attendanceCounts,  String? teacherName,  String? subjectCode,  bool? isRescheduled,  String? rescheduledFromDate,  CalendarEventReschedule? rescheduledTo)  $default,) {final _that = this;
switch (_that) {
case _CalendarEvent():
return $default(_that.id,_that.title,_that.date,_that.startTime,_that.endTime,_that.room,_that.sectionId,_that.subjectName,_that.sectionName,_that.type,_that.status,_that.studentStatus,_that.attendanceCounts,_that.teacherName,_that.subjectCode,_that.isRescheduled,_that.rescheduledFromDate,_that.rescheduledTo);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  String date,  String startTime,  String endTime,  String? room,  String sectionId,  String subjectName,  String sectionName,  CalendarEventType type,  CalendarEventStatus? status,  CalendarEventStudentStatus? studentStatus,  CalendarEventAttendanceCounts? attendanceCounts,  String? teacherName,  String? subjectCode,  bool? isRescheduled,  String? rescheduledFromDate,  CalendarEventReschedule? rescheduledTo)?  $default,) {final _that = this;
switch (_that) {
case _CalendarEvent() when $default != null:
return $default(_that.id,_that.title,_that.date,_that.startTime,_that.endTime,_that.room,_that.sectionId,_that.subjectName,_that.sectionName,_that.type,_that.status,_that.studentStatus,_that.attendanceCounts,_that.teacherName,_that.subjectCode,_that.isRescheduled,_that.rescheduledFromDate,_that.rescheduledTo);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [CalendarEventTypeConverter(), CalendarEventStatusConverter(), CalendarEventStudentStatusConverter()])
class _CalendarEvent implements CalendarEvent {
  const _CalendarEvent({required this.id, this.title = '', required this.date, this.startTime = '', this.endTime = '', this.room, required this.sectionId, this.subjectName = '', this.sectionName = '', required this.type, this.status, this.studentStatus, this.attendanceCounts, this.teacherName, this.subjectCode, this.isRescheduled, this.rescheduledFromDate, this.rescheduledTo});
  factory _CalendarEvent.fromJson(Map<String, dynamic> json) => _$CalendarEventFromJson(json);

@override final  String id;
@override@JsonKey() final  String title;
@override final  String date;
@override@JsonKey() final  String startTime;
@override@JsonKey() final  String endTime;
@override final  String? room;
@override final  String sectionId;
@override@JsonKey() final  String subjectName;
@override@JsonKey() final  String sectionName;
@override final  CalendarEventType type;
@override final  CalendarEventStatus? status;
@override final  CalendarEventStudentStatus? studentStatus;
@override final  CalendarEventAttendanceCounts? attendanceCounts;
@override final  String? teacherName;
@override final  String? subjectCode;
@override final  bool? isRescheduled;
@override final  String? rescheduledFromDate;
@override final  CalendarEventReschedule? rescheduledTo;

/// Create a copy of CalendarEvent
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CalendarEventCopyWith<_CalendarEvent> get copyWith => __$CalendarEventCopyWithImpl<_CalendarEvent>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CalendarEventToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CalendarEvent&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.date, date) || other.date == date)&&(identical(other.startTime, startTime) || other.startTime == startTime)&&(identical(other.endTime, endTime) || other.endTime == endTime)&&(identical(other.room, room) || other.room == room)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.subjectName, subjectName) || other.subjectName == subjectName)&&(identical(other.sectionName, sectionName) || other.sectionName == sectionName)&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.studentStatus, studentStatus) || other.studentStatus == studentStatus)&&(identical(other.attendanceCounts, attendanceCounts) || other.attendanceCounts == attendanceCounts)&&(identical(other.teacherName, teacherName) || other.teacherName == teacherName)&&(identical(other.subjectCode, subjectCode) || other.subjectCode == subjectCode)&&(identical(other.isRescheduled, isRescheduled) || other.isRescheduled == isRescheduled)&&(identical(other.rescheduledFromDate, rescheduledFromDate) || other.rescheduledFromDate == rescheduledFromDate)&&(identical(other.rescheduledTo, rescheduledTo) || other.rescheduledTo == rescheduledTo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,title,date,startTime,endTime,room,sectionId,subjectName,sectionName,type,status,studentStatus,attendanceCounts,teacherName,subjectCode,isRescheduled,rescheduledFromDate,rescheduledTo);

@override
String toString() {
  return 'CalendarEvent(id: $id, title: $title, date: $date, startTime: $startTime, endTime: $endTime, room: $room, sectionId: $sectionId, subjectName: $subjectName, sectionName: $sectionName, type: $type, status: $status, studentStatus: $studentStatus, attendanceCounts: $attendanceCounts, teacherName: $teacherName, subjectCode: $subjectCode, isRescheduled: $isRescheduled, rescheduledFromDate: $rescheduledFromDate, rescheduledTo: $rescheduledTo)';
}


}

/// @nodoc
abstract mixin class _$CalendarEventCopyWith<$Res> implements $CalendarEventCopyWith<$Res> {
  factory _$CalendarEventCopyWith(_CalendarEvent value, $Res Function(_CalendarEvent) _then) = __$CalendarEventCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, String date, String startTime, String endTime, String? room, String sectionId, String subjectName, String sectionName, CalendarEventType type, CalendarEventStatus? status, CalendarEventStudentStatus? studentStatus, CalendarEventAttendanceCounts? attendanceCounts, String? teacherName, String? subjectCode, bool? isRescheduled, String? rescheduledFromDate, CalendarEventReschedule? rescheduledTo
});


@override $CalendarEventAttendanceCountsCopyWith<$Res>? get attendanceCounts;@override $CalendarEventRescheduleCopyWith<$Res>? get rescheduledTo;

}
/// @nodoc
class __$CalendarEventCopyWithImpl<$Res>
    implements _$CalendarEventCopyWith<$Res> {
  __$CalendarEventCopyWithImpl(this._self, this._then);

  final _CalendarEvent _self;
  final $Res Function(_CalendarEvent) _then;

/// Create a copy of CalendarEvent
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? date = null,Object? startTime = null,Object? endTime = null,Object? room = freezed,Object? sectionId = null,Object? subjectName = null,Object? sectionName = null,Object? type = null,Object? status = freezed,Object? studentStatus = freezed,Object? attendanceCounts = freezed,Object? teacherName = freezed,Object? subjectCode = freezed,Object? isRescheduled = freezed,Object? rescheduledFromDate = freezed,Object? rescheduledTo = freezed,}) {
  return _then(_CalendarEvent(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,startTime: null == startTime ? _self.startTime : startTime // ignore: cast_nullable_to_non_nullable
as String,endTime: null == endTime ? _self.endTime : endTime // ignore: cast_nullable_to_non_nullable
as String,room: freezed == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String?,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,subjectName: null == subjectName ? _self.subjectName : subjectName // ignore: cast_nullable_to_non_nullable
as String,sectionName: null == sectionName ? _self.sectionName : sectionName // ignore: cast_nullable_to_non_nullable
as String,type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as CalendarEventType,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as CalendarEventStatus?,studentStatus: freezed == studentStatus ? _self.studentStatus : studentStatus // ignore: cast_nullable_to_non_nullable
as CalendarEventStudentStatus?,attendanceCounts: freezed == attendanceCounts ? _self.attendanceCounts : attendanceCounts // ignore: cast_nullable_to_non_nullable
as CalendarEventAttendanceCounts?,teacherName: freezed == teacherName ? _self.teacherName : teacherName // ignore: cast_nullable_to_non_nullable
as String?,subjectCode: freezed == subjectCode ? _self.subjectCode : subjectCode // ignore: cast_nullable_to_non_nullable
as String?,isRescheduled: freezed == isRescheduled ? _self.isRescheduled : isRescheduled // ignore: cast_nullable_to_non_nullable
as bool?,rescheduledFromDate: freezed == rescheduledFromDate ? _self.rescheduledFromDate : rescheduledFromDate // ignore: cast_nullable_to_non_nullable
as String?,rescheduledTo: freezed == rescheduledTo ? _self.rescheduledTo : rescheduledTo // ignore: cast_nullable_to_non_nullable
as CalendarEventReschedule?,
  ));
}

/// Create a copy of CalendarEvent
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CalendarEventAttendanceCountsCopyWith<$Res>? get attendanceCounts {
    if (_self.attendanceCounts == null) {
    return null;
  }

  return $CalendarEventAttendanceCountsCopyWith<$Res>(_self.attendanceCounts!, (value) {
    return _then(_self.copyWith(attendanceCounts: value));
  });
}/// Create a copy of CalendarEvent
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CalendarEventRescheduleCopyWith<$Res>? get rescheduledTo {
    if (_self.rescheduledTo == null) {
    return null;
  }

  return $CalendarEventRescheduleCopyWith<$Res>(_self.rescheduledTo!, (value) {
    return _then(_self.copyWith(rescheduledTo: value));
  });
}
}


/// @nodoc
mixin _$EmergencyDeviceReleaseResult {

 User get user; bool get clearedCooldown; bool? get hadCooldown; bool? get hadBinding; String get message;
/// Create a copy of EmergencyDeviceReleaseResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EmergencyDeviceReleaseResultCopyWith<EmergencyDeviceReleaseResult> get copyWith => _$EmergencyDeviceReleaseResultCopyWithImpl<EmergencyDeviceReleaseResult>(this as EmergencyDeviceReleaseResult, _$identity);

  /// Serializes this EmergencyDeviceReleaseResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EmergencyDeviceReleaseResult&&(identical(other.user, user) || other.user == user)&&(identical(other.clearedCooldown, clearedCooldown) || other.clearedCooldown == clearedCooldown)&&(identical(other.hadCooldown, hadCooldown) || other.hadCooldown == hadCooldown)&&(identical(other.hadBinding, hadBinding) || other.hadBinding == hadBinding)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,user,clearedCooldown,hadCooldown,hadBinding,message);

@override
String toString() {
  return 'EmergencyDeviceReleaseResult(user: $user, clearedCooldown: $clearedCooldown, hadCooldown: $hadCooldown, hadBinding: $hadBinding, message: $message)';
}


}

/// @nodoc
abstract mixin class $EmergencyDeviceReleaseResultCopyWith<$Res>  {
  factory $EmergencyDeviceReleaseResultCopyWith(EmergencyDeviceReleaseResult value, $Res Function(EmergencyDeviceReleaseResult) _then) = _$EmergencyDeviceReleaseResultCopyWithImpl;
@useResult
$Res call({
 User user, bool clearedCooldown, bool? hadCooldown, bool? hadBinding, String message
});


$UserCopyWith<$Res> get user;

}
/// @nodoc
class _$EmergencyDeviceReleaseResultCopyWithImpl<$Res>
    implements $EmergencyDeviceReleaseResultCopyWith<$Res> {
  _$EmergencyDeviceReleaseResultCopyWithImpl(this._self, this._then);

  final EmergencyDeviceReleaseResult _self;
  final $Res Function(EmergencyDeviceReleaseResult) _then;

/// Create a copy of EmergencyDeviceReleaseResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? user = null,Object? clearedCooldown = null,Object? hadCooldown = freezed,Object? hadBinding = freezed,Object? message = null,}) {
  return _then(EmergencyDeviceReleaseResult(
user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as User,clearedCooldown: null == clearedCooldown ? _self.clearedCooldown : clearedCooldown // ignore: cast_nullable_to_non_nullable
as bool,hadCooldown: freezed == hadCooldown ? _self.hadCooldown : hadCooldown // ignore: cast_nullable_to_non_nullable
as bool?,hadBinding: freezed == hadBinding ? _self.hadBinding : hadBinding // ignore: cast_nullable_to_non_nullable
as bool?,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}
/// Create a copy of EmergencyDeviceReleaseResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UserCopyWith<$Res> get user {
  
  return $UserCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}
}


/// Adds pattern-matching-related methods to [EmergencyDeviceReleaseResult].
extension EmergencyDeviceReleaseResultPatterns on EmergencyDeviceReleaseResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EmergencyDeviceReleaseResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EmergencyDeviceReleaseResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EmergencyDeviceReleaseResult value)  $default,){
final _that = this;
switch (_that) {
case _EmergencyDeviceReleaseResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EmergencyDeviceReleaseResult value)?  $default,){
final _that = this;
switch (_that) {
case _EmergencyDeviceReleaseResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( User user,  bool clearedCooldown,  bool? hadCooldown,  bool? hadBinding,  String message)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EmergencyDeviceReleaseResult() when $default != null:
return $default(_that.user,_that.clearedCooldown,_that.hadCooldown,_that.hadBinding,_that.message);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( User user,  bool clearedCooldown,  bool? hadCooldown,  bool? hadBinding,  String message)  $default,) {final _that = this;
switch (_that) {
case _EmergencyDeviceReleaseResult():
return $default(_that.user,_that.clearedCooldown,_that.hadCooldown,_that.hadBinding,_that.message);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( User user,  bool clearedCooldown,  bool? hadCooldown,  bool? hadBinding,  String message)?  $default,) {final _that = this;
switch (_that) {
case _EmergencyDeviceReleaseResult() when $default != null:
return $default(_that.user,_that.clearedCooldown,_that.hadCooldown,_that.hadBinding,_that.message);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _EmergencyDeviceReleaseResult implements EmergencyDeviceReleaseResult {
  const _EmergencyDeviceReleaseResult({required this.user, this.clearedCooldown = false, this.hadCooldown, this.hadBinding, this.message = ''});
  factory _EmergencyDeviceReleaseResult.fromJson(Map<String, dynamic> json) => _$EmergencyDeviceReleaseResultFromJson(json);

@override final  User user;
@override@JsonKey() final  bool clearedCooldown;
@override final  bool? hadCooldown;
@override final  bool? hadBinding;
@override@JsonKey() final  String message;

/// Create a copy of EmergencyDeviceReleaseResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EmergencyDeviceReleaseResultCopyWith<_EmergencyDeviceReleaseResult> get copyWith => __$EmergencyDeviceReleaseResultCopyWithImpl<_EmergencyDeviceReleaseResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EmergencyDeviceReleaseResultToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EmergencyDeviceReleaseResult&&(identical(other.user, user) || other.user == user)&&(identical(other.clearedCooldown, clearedCooldown) || other.clearedCooldown == clearedCooldown)&&(identical(other.hadCooldown, hadCooldown) || other.hadCooldown == hadCooldown)&&(identical(other.hadBinding, hadBinding) || other.hadBinding == hadBinding)&&(identical(other.message, message) || other.message == message));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,user,clearedCooldown,hadCooldown,hadBinding,message);

@override
String toString() {
  return 'EmergencyDeviceReleaseResult(user: $user, clearedCooldown: $clearedCooldown, hadCooldown: $hadCooldown, hadBinding: $hadBinding, message: $message)';
}


}

/// @nodoc
abstract mixin class _$EmergencyDeviceReleaseResultCopyWith<$Res> implements $EmergencyDeviceReleaseResultCopyWith<$Res> {
  factory _$EmergencyDeviceReleaseResultCopyWith(_EmergencyDeviceReleaseResult value, $Res Function(_EmergencyDeviceReleaseResult) _then) = __$EmergencyDeviceReleaseResultCopyWithImpl;
@override @useResult
$Res call({
 User user, bool clearedCooldown, bool? hadCooldown, bool? hadBinding, String message
});


@override $UserCopyWith<$Res> get user;

}
/// @nodoc
class __$EmergencyDeviceReleaseResultCopyWithImpl<$Res>
    implements _$EmergencyDeviceReleaseResultCopyWith<$Res> {
  __$EmergencyDeviceReleaseResultCopyWithImpl(this._self, this._then);

  final _EmergencyDeviceReleaseResult _self;
  final $Res Function(_EmergencyDeviceReleaseResult) _then;

/// Create a copy of EmergencyDeviceReleaseResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? user = null,Object? clearedCooldown = null,Object? hadCooldown = freezed,Object? hadBinding = freezed,Object? message = null,}) {
  return _then(_EmergencyDeviceReleaseResult(
user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as User,clearedCooldown: null == clearedCooldown ? _self.clearedCooldown : clearedCooldown // ignore: cast_nullable_to_non_nullable
as bool,hadCooldown: freezed == hadCooldown ? _self.hadCooldown : hadCooldown // ignore: cast_nullable_to_non_nullable
as bool?,hadBinding: freezed == hadBinding ? _self.hadBinding : hadBinding // ignore: cast_nullable_to_non_nullable
as bool?,message: null == message ? _self.message : message // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

/// Create a copy of EmergencyDeviceReleaseResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$UserCopyWith<$Res> get user {
  
  return $UserCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}
}


/// @nodoc
mixin _$AuditLogEntry {

 String get id; String get actorId; String get actorName; String get actorRole; String get action; String get entityType; String? get entityId; AuditOutcome get outcome; String? get ipAddress; String get createdAt;
/// Create a copy of AuditLogEntry
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AuditLogEntryCopyWith<AuditLogEntry> get copyWith => _$AuditLogEntryCopyWithImpl<AuditLogEntry>(this as AuditLogEntry, _$identity);

  /// Serializes this AuditLogEntry to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AuditLogEntry&&(identical(other.id, id) || other.id == id)&&(identical(other.actorId, actorId) || other.actorId == actorId)&&(identical(other.actorName, actorName) || other.actorName == actorName)&&(identical(other.actorRole, actorRole) || other.actorRole == actorRole)&&(identical(other.action, action) || other.action == action)&&(identical(other.entityType, entityType) || other.entityType == entityType)&&(identical(other.entityId, entityId) || other.entityId == entityId)&&(identical(other.outcome, outcome) || other.outcome == outcome)&&(identical(other.ipAddress, ipAddress) || other.ipAddress == ipAddress)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,actorId,actorName,actorRole,action,entityType,entityId,outcome,ipAddress,createdAt);

@override
String toString() {
  return 'AuditLogEntry(id: $id, actorId: $actorId, actorName: $actorName, actorRole: $actorRole, action: $action, entityType: $entityType, entityId: $entityId, outcome: $outcome, ipAddress: $ipAddress, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $AuditLogEntryCopyWith<$Res>  {
  factory $AuditLogEntryCopyWith(AuditLogEntry value, $Res Function(AuditLogEntry) _then) = _$AuditLogEntryCopyWithImpl;
@useResult
$Res call({
 String id, String actorId, String actorName, String actorRole, String action, String entityType, String? entityId, AuditOutcome outcome, String? ipAddress, String createdAt
});




}
/// @nodoc
class _$AuditLogEntryCopyWithImpl<$Res>
    implements $AuditLogEntryCopyWith<$Res> {
  _$AuditLogEntryCopyWithImpl(this._self, this._then);

  final AuditLogEntry _self;
  final $Res Function(AuditLogEntry) _then;

/// Create a copy of AuditLogEntry
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? actorId = null,Object? actorName = null,Object? actorRole = null,Object? action = null,Object? entityType = null,Object? entityId = freezed,Object? outcome = null,Object? ipAddress = freezed,Object? createdAt = null,}) {
  return _then(AuditLogEntry(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,actorId: null == actorId ? _self.actorId : actorId // ignore: cast_nullable_to_non_nullable
as String,actorName: null == actorName ? _self.actorName : actorName // ignore: cast_nullable_to_non_nullable
as String,actorRole: null == actorRole ? _self.actorRole : actorRole // ignore: cast_nullable_to_non_nullable
as String,action: null == action ? _self.action : action // ignore: cast_nullable_to_non_nullable
as String,entityType: null == entityType ? _self.entityType : entityType // ignore: cast_nullable_to_non_nullable
as String,entityId: freezed == entityId ? _self.entityId : entityId // ignore: cast_nullable_to_non_nullable
as String?,outcome: null == outcome ? _self.outcome : outcome // ignore: cast_nullable_to_non_nullable
as AuditOutcome,ipAddress: freezed == ipAddress ? _self.ipAddress : ipAddress // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AuditLogEntry].
extension AuditLogEntryPatterns on AuditLogEntry {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AuditLogEntry value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AuditLogEntry() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AuditLogEntry value)  $default,){
final _that = this;
switch (_that) {
case _AuditLogEntry():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AuditLogEntry value)?  $default,){
final _that = this;
switch (_that) {
case _AuditLogEntry() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String actorId,  String actorName,  String actorRole,  String action,  String entityType,  String? entityId,  AuditOutcome outcome,  String? ipAddress,  String createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AuditLogEntry() when $default != null:
return $default(_that.id,_that.actorId,_that.actorName,_that.actorRole,_that.action,_that.entityType,_that.entityId,_that.outcome,_that.ipAddress,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String actorId,  String actorName,  String actorRole,  String action,  String entityType,  String? entityId,  AuditOutcome outcome,  String? ipAddress,  String createdAt)  $default,) {final _that = this;
switch (_that) {
case _AuditLogEntry():
return $default(_that.id,_that.actorId,_that.actorName,_that.actorRole,_that.action,_that.entityType,_that.entityId,_that.outcome,_that.ipAddress,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String actorId,  String actorName,  String actorRole,  String action,  String entityType,  String? entityId,  AuditOutcome outcome,  String? ipAddress,  String createdAt)?  $default,) {final _that = this;
switch (_that) {
case _AuditLogEntry() when $default != null:
return $default(_that.id,_that.actorId,_that.actorName,_that.actorRole,_that.action,_that.entityType,_that.entityId,_that.outcome,_that.ipAddress,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AuditOutcomeConverter()])
class _AuditLogEntry implements AuditLogEntry {
  const _AuditLogEntry({required this.id, this.actorId = '', this.actorName = '', this.actorRole = '', this.action = '', this.entityType = '', this.entityId, required this.outcome, this.ipAddress, this.createdAt = ''});
  factory _AuditLogEntry.fromJson(Map<String, dynamic> json) => _$AuditLogEntryFromJson(json);

@override final  String id;
@override@JsonKey() final  String actorId;
@override@JsonKey() final  String actorName;
@override@JsonKey() final  String actorRole;
@override@JsonKey() final  String action;
@override@JsonKey() final  String entityType;
@override final  String? entityId;
@override final  AuditOutcome outcome;
@override final  String? ipAddress;
@override@JsonKey() final  String createdAt;

/// Create a copy of AuditLogEntry
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AuditLogEntryCopyWith<_AuditLogEntry> get copyWith => __$AuditLogEntryCopyWithImpl<_AuditLogEntry>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AuditLogEntryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AuditLogEntry&&(identical(other.id, id) || other.id == id)&&(identical(other.actorId, actorId) || other.actorId == actorId)&&(identical(other.actorName, actorName) || other.actorName == actorName)&&(identical(other.actorRole, actorRole) || other.actorRole == actorRole)&&(identical(other.action, action) || other.action == action)&&(identical(other.entityType, entityType) || other.entityType == entityType)&&(identical(other.entityId, entityId) || other.entityId == entityId)&&(identical(other.outcome, outcome) || other.outcome == outcome)&&(identical(other.ipAddress, ipAddress) || other.ipAddress == ipAddress)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,actorId,actorName,actorRole,action,entityType,entityId,outcome,ipAddress,createdAt);

@override
String toString() {
  return 'AuditLogEntry(id: $id, actorId: $actorId, actorName: $actorName, actorRole: $actorRole, action: $action, entityType: $entityType, entityId: $entityId, outcome: $outcome, ipAddress: $ipAddress, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$AuditLogEntryCopyWith<$Res> implements $AuditLogEntryCopyWith<$Res> {
  factory _$AuditLogEntryCopyWith(_AuditLogEntry value, $Res Function(_AuditLogEntry) _then) = __$AuditLogEntryCopyWithImpl;
@override @useResult
$Res call({
 String id, String actorId, String actorName, String actorRole, String action, String entityType, String? entityId, AuditOutcome outcome, String? ipAddress, String createdAt
});




}
/// @nodoc
class __$AuditLogEntryCopyWithImpl<$Res>
    implements _$AuditLogEntryCopyWith<$Res> {
  __$AuditLogEntryCopyWithImpl(this._self, this._then);

  final _AuditLogEntry _self;
  final $Res Function(_AuditLogEntry) _then;

/// Create a copy of AuditLogEntry
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? actorId = null,Object? actorName = null,Object? actorRole = null,Object? action = null,Object? entityType = null,Object? entityId = freezed,Object? outcome = null,Object? ipAddress = freezed,Object? createdAt = null,}) {
  return _then(_AuditLogEntry(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,actorId: null == actorId ? _self.actorId : actorId // ignore: cast_nullable_to_non_nullable
as String,actorName: null == actorName ? _self.actorName : actorName // ignore: cast_nullable_to_non_nullable
as String,actorRole: null == actorRole ? _self.actorRole : actorRole // ignore: cast_nullable_to_non_nullable
as String,action: null == action ? _self.action : action // ignore: cast_nullable_to_non_nullable
as String,entityType: null == entityType ? _self.entityType : entityType // ignore: cast_nullable_to_non_nullable
as String,entityId: freezed == entityId ? _self.entityId : entityId // ignore: cast_nullable_to_non_nullable
as String?,outcome: null == outcome ? _self.outcome : outcome // ignore: cast_nullable_to_non_nullable
as AuditOutcome,ipAddress: freezed == ipAddress ? _self.ipAddress : ipAddress // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
