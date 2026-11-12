// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'user.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$DelegatedTeacherPermissions {

 bool get canResetStudentPasswords; bool get canEmergencyUnbindDevices;
/// Create a copy of DelegatedTeacherPermissions
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$DelegatedTeacherPermissionsCopyWith<DelegatedTeacherPermissions> get copyWith => _$DelegatedTeacherPermissionsCopyWithImpl<DelegatedTeacherPermissions>(this as DelegatedTeacherPermissions, _$identity);

  /// Serializes this DelegatedTeacherPermissions to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is DelegatedTeacherPermissions&&(identical(other.canResetStudentPasswords, canResetStudentPasswords) || other.canResetStudentPasswords == canResetStudentPasswords)&&(identical(other.canEmergencyUnbindDevices, canEmergencyUnbindDevices) || other.canEmergencyUnbindDevices == canEmergencyUnbindDevices));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,canResetStudentPasswords,canEmergencyUnbindDevices);

@override
String toString() {
  return 'DelegatedTeacherPermissions(canResetStudentPasswords: $canResetStudentPasswords, canEmergencyUnbindDevices: $canEmergencyUnbindDevices)';
}


}

/// @nodoc
abstract mixin class $DelegatedTeacherPermissionsCopyWith<$Res>  {
  factory $DelegatedTeacherPermissionsCopyWith(DelegatedTeacherPermissions value, $Res Function(DelegatedTeacherPermissions) _then) = _$DelegatedTeacherPermissionsCopyWithImpl;
@useResult
$Res call({
 bool canResetStudentPasswords, bool canEmergencyUnbindDevices
});




}
/// @nodoc
class _$DelegatedTeacherPermissionsCopyWithImpl<$Res>
    implements $DelegatedTeacherPermissionsCopyWith<$Res> {
  _$DelegatedTeacherPermissionsCopyWithImpl(this._self, this._then);

  final DelegatedTeacherPermissions _self;
  final $Res Function(DelegatedTeacherPermissions) _then;

/// Create a copy of DelegatedTeacherPermissions
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? canResetStudentPasswords = null,Object? canEmergencyUnbindDevices = null,}) {
  return _then(DelegatedTeacherPermissions(
canResetStudentPasswords: null == canResetStudentPasswords ? _self.canResetStudentPasswords : canResetStudentPasswords // ignore: cast_nullable_to_non_nullable
as bool,canEmergencyUnbindDevices: null == canEmergencyUnbindDevices ? _self.canEmergencyUnbindDevices : canEmergencyUnbindDevices // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [DelegatedTeacherPermissions].
extension DelegatedTeacherPermissionsPatterns on DelegatedTeacherPermissions {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _DelegatedTeacherPermissions value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _DelegatedTeacherPermissions() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _DelegatedTeacherPermissions value)  $default,){
final _that = this;
switch (_that) {
case _DelegatedTeacherPermissions():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _DelegatedTeacherPermissions value)?  $default,){
final _that = this;
switch (_that) {
case _DelegatedTeacherPermissions() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool canResetStudentPasswords,  bool canEmergencyUnbindDevices)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _DelegatedTeacherPermissions() when $default != null:
return $default(_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool canResetStudentPasswords,  bool canEmergencyUnbindDevices)  $default,) {final _that = this;
switch (_that) {
case _DelegatedTeacherPermissions():
return $default(_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool canResetStudentPasswords,  bool canEmergencyUnbindDevices)?  $default,) {final _that = this;
switch (_that) {
case _DelegatedTeacherPermissions() when $default != null:
return $default(_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _DelegatedTeacherPermissions implements DelegatedTeacherPermissions {
  const _DelegatedTeacherPermissions({required this.canResetStudentPasswords, required this.canEmergencyUnbindDevices});
  factory _DelegatedTeacherPermissions.fromJson(Map<String, dynamic> json) => _$DelegatedTeacherPermissionsFromJson(json);

@override final  bool canResetStudentPasswords;
@override final  bool canEmergencyUnbindDevices;

/// Create a copy of DelegatedTeacherPermissions
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$DelegatedTeacherPermissionsCopyWith<_DelegatedTeacherPermissions> get copyWith => __$DelegatedTeacherPermissionsCopyWithImpl<_DelegatedTeacherPermissions>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$DelegatedTeacherPermissionsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _DelegatedTeacherPermissions&&(identical(other.canResetStudentPasswords, canResetStudentPasswords) || other.canResetStudentPasswords == canResetStudentPasswords)&&(identical(other.canEmergencyUnbindDevices, canEmergencyUnbindDevices) || other.canEmergencyUnbindDevices == canEmergencyUnbindDevices));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,canResetStudentPasswords,canEmergencyUnbindDevices);

@override
String toString() {
  return 'DelegatedTeacherPermissions(canResetStudentPasswords: $canResetStudentPasswords, canEmergencyUnbindDevices: $canEmergencyUnbindDevices)';
}


}

/// @nodoc
abstract mixin class _$DelegatedTeacherPermissionsCopyWith<$Res> implements $DelegatedTeacherPermissionsCopyWith<$Res> {
  factory _$DelegatedTeacherPermissionsCopyWith(_DelegatedTeacherPermissions value, $Res Function(_DelegatedTeacherPermissions) _then) = __$DelegatedTeacherPermissionsCopyWithImpl;
@override @useResult
$Res call({
 bool canResetStudentPasswords, bool canEmergencyUnbindDevices
});




}
/// @nodoc
class __$DelegatedTeacherPermissionsCopyWithImpl<$Res>
    implements _$DelegatedTeacherPermissionsCopyWith<$Res> {
  __$DelegatedTeacherPermissionsCopyWithImpl(this._self, this._then);

  final _DelegatedTeacherPermissions _self;
  final $Res Function(_DelegatedTeacherPermissions) _then;

/// Create a copy of DelegatedTeacherPermissions
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? canResetStudentPasswords = null,Object? canEmergencyUnbindDevices = null,}) {
  return _then(_DelegatedTeacherPermissions(
canResetStudentPasswords: null == canResetStudentPasswords ? _self.canResetStudentPasswords : canResetStudentPasswords // ignore: cast_nullable_to_non_nullable
as bool,canEmergencyUnbindDevices: null == canEmergencyUnbindDevices ? _self.canEmergencyUnbindDevices : canEmergencyUnbindDevices // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$User {

 String get id; String? get studentId; String get fullName; String? get email;/// Roster rows (`GET /sections/:id/students`) and other list endpoints
/// omit `role` entirely; every such row is a student by construction.
/// Absent or explicit-null decodes to [UserRole.student]; a present
/// unknown wire value still throws [UnknownApiValue].
 UserRole get role; String? get program; int? get yearLevel; String? get department; String? get photoUrl; bool get isActive; String? get privacyConsentVersion; String? get privacyConsentedAt; bool get mustChangePassword; String? get boundDeviceId; String? get deviceBoundAt; String? get deviceCooldownUntil; String? get cooldownDeviceId; bool? get canResetStudentPasswords; bool? get canEmergencyUnbindDevices; DelegatedTeacherPermissions? get delegatedPermissions; bool get isItCoordinator; bool get isDepartmentHead; bool get isUserRegistrar; String? get contactEmail; String? get contactPhone; List<String> get enrolledSectionIds; String? get scope; String get createdAt; String get updatedAt;
/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UserCopyWith<User> get copyWith => _$UserCopyWithImpl<User>(this as User, _$identity);

  /// Serializes this User to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is User&&(identical(other.id, id) || other.id == id)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.email, email) || other.email == email)&&(identical(other.role, role) || other.role == role)&&(identical(other.program, program) || other.program == program)&&(identical(other.yearLevel, yearLevel) || other.yearLevel == yearLevel)&&(identical(other.department, department) || other.department == department)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.privacyConsentVersion, privacyConsentVersion) || other.privacyConsentVersion == privacyConsentVersion)&&(identical(other.privacyConsentedAt, privacyConsentedAt) || other.privacyConsentedAt == privacyConsentedAt)&&(identical(other.mustChangePassword, mustChangePassword) || other.mustChangePassword == mustChangePassword)&&(identical(other.boundDeviceId, boundDeviceId) || other.boundDeviceId == boundDeviceId)&&(identical(other.deviceBoundAt, deviceBoundAt) || other.deviceBoundAt == deviceBoundAt)&&(identical(other.deviceCooldownUntil, deviceCooldownUntil) || other.deviceCooldownUntil == deviceCooldownUntil)&&(identical(other.cooldownDeviceId, cooldownDeviceId) || other.cooldownDeviceId == cooldownDeviceId)&&(identical(other.canResetStudentPasswords, canResetStudentPasswords) || other.canResetStudentPasswords == canResetStudentPasswords)&&(identical(other.canEmergencyUnbindDevices, canEmergencyUnbindDevices) || other.canEmergencyUnbindDevices == canEmergencyUnbindDevices)&&(identical(other.delegatedPermissions, delegatedPermissions) || other.delegatedPermissions == delegatedPermissions)&&(identical(other.isItCoordinator, isItCoordinator) || other.isItCoordinator == isItCoordinator)&&(identical(other.isDepartmentHead, isDepartmentHead) || other.isDepartmentHead == isDepartmentHead)&&(identical(other.isUserRegistrar, isUserRegistrar) || other.isUserRegistrar == isUserRegistrar)&&(identical(other.contactEmail, contactEmail) || other.contactEmail == contactEmail)&&(identical(other.contactPhone, contactPhone) || other.contactPhone == contactPhone)&&const DeepCollectionEquality().equals(other.enrolledSectionIds, enrolledSectionIds)&&(identical(other.scope, scope) || other.scope == scope)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,studentId,fullName,email,role,program,yearLevel,department,photoUrl,isActive,privacyConsentVersion,privacyConsentedAt,mustChangePassword,boundDeviceId,deviceBoundAt,deviceCooldownUntil,cooldownDeviceId,canResetStudentPasswords,canEmergencyUnbindDevices,delegatedPermissions,isItCoordinator,isDepartmentHead,isUserRegistrar,contactEmail,contactPhone,const DeepCollectionEquality().hash(enrolledSectionIds),scope,createdAt,updatedAt]);

@override
String toString() {
  return 'User(id: $id, studentId: $studentId, fullName: $fullName, email: $email, role: $role, program: $program, yearLevel: $yearLevel, department: $department, photoUrl: $photoUrl, isActive: $isActive, privacyConsentVersion: $privacyConsentVersion, privacyConsentedAt: $privacyConsentedAt, mustChangePassword: $mustChangePassword, boundDeviceId: $boundDeviceId, deviceBoundAt: $deviceBoundAt, deviceCooldownUntil: $deviceCooldownUntil, cooldownDeviceId: $cooldownDeviceId, canResetStudentPasswords: $canResetStudentPasswords, canEmergencyUnbindDevices: $canEmergencyUnbindDevices, delegatedPermissions: $delegatedPermissions, isItCoordinator: $isItCoordinator, isDepartmentHead: $isDepartmentHead, isUserRegistrar: $isUserRegistrar, contactEmail: $contactEmail, contactPhone: $contactPhone, enrolledSectionIds: $enrolledSectionIds, scope: $scope, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $UserCopyWith<$Res>  {
  factory $UserCopyWith(User value, $Res Function(User) _then) = _$UserCopyWithImpl;
@useResult
$Res call({
 String id, String? studentId, String fullName, String? email, UserRole role, String? program, int? yearLevel, String? department, String? photoUrl, bool isActive, String? privacyConsentVersion, String? privacyConsentedAt, bool mustChangePassword, String? boundDeviceId, String? deviceBoundAt, String? deviceCooldownUntil, String? cooldownDeviceId, bool? canResetStudentPasswords, bool? canEmergencyUnbindDevices, DelegatedTeacherPermissions? delegatedPermissions, bool isItCoordinator, bool isDepartmentHead, bool isUserRegistrar, String? contactEmail, String? contactPhone, List<String> enrolledSectionIds, String? scope, String createdAt, String updatedAt
});


$DelegatedTeacherPermissionsCopyWith<$Res>? get delegatedPermissions;

}
/// @nodoc
class _$UserCopyWithImpl<$Res>
    implements $UserCopyWith<$Res> {
  _$UserCopyWithImpl(this._self, this._then);

  final User _self;
  final $Res Function(User) _then;

/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? studentId = freezed,Object? fullName = null,Object? email = freezed,Object? role = null,Object? program = freezed,Object? yearLevel = freezed,Object? department = freezed,Object? photoUrl = freezed,Object? isActive = null,Object? privacyConsentVersion = freezed,Object? privacyConsentedAt = freezed,Object? mustChangePassword = null,Object? boundDeviceId = freezed,Object? deviceBoundAt = freezed,Object? deviceCooldownUntil = freezed,Object? cooldownDeviceId = freezed,Object? canResetStudentPasswords = freezed,Object? canEmergencyUnbindDevices = freezed,Object? delegatedPermissions = freezed,Object? isItCoordinator = null,Object? isDepartmentHead = null,Object? isUserRegistrar = null,Object? contactEmail = freezed,Object? contactPhone = freezed,Object? enrolledSectionIds = null,Object? scope = freezed,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(User(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,studentId: freezed == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String?,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as UserRole,program: freezed == program ? _self.program : program // ignore: cast_nullable_to_non_nullable
as String?,yearLevel: freezed == yearLevel ? _self.yearLevel : yearLevel // ignore: cast_nullable_to_non_nullable
as int?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,privacyConsentVersion: freezed == privacyConsentVersion ? _self.privacyConsentVersion : privacyConsentVersion // ignore: cast_nullable_to_non_nullable
as String?,privacyConsentedAt: freezed == privacyConsentedAt ? _self.privacyConsentedAt : privacyConsentedAt // ignore: cast_nullable_to_non_nullable
as String?,mustChangePassword: null == mustChangePassword ? _self.mustChangePassword : mustChangePassword // ignore: cast_nullable_to_non_nullable
as bool,boundDeviceId: freezed == boundDeviceId ? _self.boundDeviceId : boundDeviceId // ignore: cast_nullable_to_non_nullable
as String?,deviceBoundAt: freezed == deviceBoundAt ? _self.deviceBoundAt : deviceBoundAt // ignore: cast_nullable_to_non_nullable
as String?,deviceCooldownUntil: freezed == deviceCooldownUntil ? _self.deviceCooldownUntil : deviceCooldownUntil // ignore: cast_nullable_to_non_nullable
as String?,cooldownDeviceId: freezed == cooldownDeviceId ? _self.cooldownDeviceId : cooldownDeviceId // ignore: cast_nullable_to_non_nullable
as String?,canResetStudentPasswords: freezed == canResetStudentPasswords ? _self.canResetStudentPasswords : canResetStudentPasswords // ignore: cast_nullable_to_non_nullable
as bool?,canEmergencyUnbindDevices: freezed == canEmergencyUnbindDevices ? _self.canEmergencyUnbindDevices : canEmergencyUnbindDevices // ignore: cast_nullable_to_non_nullable
as bool?,delegatedPermissions: freezed == delegatedPermissions ? _self.delegatedPermissions : delegatedPermissions // ignore: cast_nullable_to_non_nullable
as DelegatedTeacherPermissions?,isItCoordinator: null == isItCoordinator ? _self.isItCoordinator : isItCoordinator // ignore: cast_nullable_to_non_nullable
as bool,isDepartmentHead: null == isDepartmentHead ? _self.isDepartmentHead : isDepartmentHead // ignore: cast_nullable_to_non_nullable
as bool,isUserRegistrar: null == isUserRegistrar ? _self.isUserRegistrar : isUserRegistrar // ignore: cast_nullable_to_non_nullable
as bool,contactEmail: freezed == contactEmail ? _self.contactEmail : contactEmail // ignore: cast_nullable_to_non_nullable
as String?,contactPhone: freezed == contactPhone ? _self.contactPhone : contactPhone // ignore: cast_nullable_to_non_nullable
as String?,enrolledSectionIds: null == enrolledSectionIds ? _self.enrolledSectionIds : enrolledSectionIds // ignore: cast_nullable_to_non_nullable
as List<String>,scope: freezed == scope ? _self.scope : scope // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}
/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DelegatedTeacherPermissionsCopyWith<$Res>? get delegatedPermissions {
    if (_self.delegatedPermissions == null) {
    return null;
  }

  return $DelegatedTeacherPermissionsCopyWith<$Res>(_self.delegatedPermissions!, (value) {
    return _then(_self.copyWith(delegatedPermissions: value));
  });
}
}


/// Adds pattern-matching-related methods to [User].
extension UserPatterns on User {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _User value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _User() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _User value)  $default,){
final _that = this;
switch (_that) {
case _User():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _User value)?  $default,){
final _that = this;
switch (_that) {
case _User() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String? studentId,  String fullName,  String? email,  UserRole role,  String? program,  int? yearLevel,  String? department,  String? photoUrl,  bool isActive,  String? privacyConsentVersion,  String? privacyConsentedAt,  bool mustChangePassword,  String? boundDeviceId,  String? deviceBoundAt,  String? deviceCooldownUntil,  String? cooldownDeviceId,  bool? canResetStudentPasswords,  bool? canEmergencyUnbindDevices,  DelegatedTeacherPermissions? delegatedPermissions,  bool isItCoordinator,  bool isDepartmentHead,  bool isUserRegistrar,  String? contactEmail,  String? contactPhone,  List<String> enrolledSectionIds,  String? scope,  String createdAt,  String updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _User() when $default != null:
return $default(_that.id,_that.studentId,_that.fullName,_that.email,_that.role,_that.program,_that.yearLevel,_that.department,_that.photoUrl,_that.isActive,_that.privacyConsentVersion,_that.privacyConsentedAt,_that.mustChangePassword,_that.boundDeviceId,_that.deviceBoundAt,_that.deviceCooldownUntil,_that.cooldownDeviceId,_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices,_that.delegatedPermissions,_that.isItCoordinator,_that.isDepartmentHead,_that.isUserRegistrar,_that.contactEmail,_that.contactPhone,_that.enrolledSectionIds,_that.scope,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String? studentId,  String fullName,  String? email,  UserRole role,  String? program,  int? yearLevel,  String? department,  String? photoUrl,  bool isActive,  String? privacyConsentVersion,  String? privacyConsentedAt,  bool mustChangePassword,  String? boundDeviceId,  String? deviceBoundAt,  String? deviceCooldownUntil,  String? cooldownDeviceId,  bool? canResetStudentPasswords,  bool? canEmergencyUnbindDevices,  DelegatedTeacherPermissions? delegatedPermissions,  bool isItCoordinator,  bool isDepartmentHead,  bool isUserRegistrar,  String? contactEmail,  String? contactPhone,  List<String> enrolledSectionIds,  String? scope,  String createdAt,  String updatedAt)  $default,) {final _that = this;
switch (_that) {
case _User():
return $default(_that.id,_that.studentId,_that.fullName,_that.email,_that.role,_that.program,_that.yearLevel,_that.department,_that.photoUrl,_that.isActive,_that.privacyConsentVersion,_that.privacyConsentedAt,_that.mustChangePassword,_that.boundDeviceId,_that.deviceBoundAt,_that.deviceCooldownUntil,_that.cooldownDeviceId,_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices,_that.delegatedPermissions,_that.isItCoordinator,_that.isDepartmentHead,_that.isUserRegistrar,_that.contactEmail,_that.contactPhone,_that.enrolledSectionIds,_that.scope,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String? studentId,  String fullName,  String? email,  UserRole role,  String? program,  int? yearLevel,  String? department,  String? photoUrl,  bool isActive,  String? privacyConsentVersion,  String? privacyConsentedAt,  bool mustChangePassword,  String? boundDeviceId,  String? deviceBoundAt,  String? deviceCooldownUntil,  String? cooldownDeviceId,  bool? canResetStudentPasswords,  bool? canEmergencyUnbindDevices,  DelegatedTeacherPermissions? delegatedPermissions,  bool isItCoordinator,  bool isDepartmentHead,  bool isUserRegistrar,  String? contactEmail,  String? contactPhone,  List<String> enrolledSectionIds,  String? scope,  String createdAt,  String updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _User() when $default != null:
return $default(_that.id,_that.studentId,_that.fullName,_that.email,_that.role,_that.program,_that.yearLevel,_that.department,_that.photoUrl,_that.isActive,_that.privacyConsentVersion,_that.privacyConsentedAt,_that.mustChangePassword,_that.boundDeviceId,_that.deviceBoundAt,_that.deviceCooldownUntil,_that.cooldownDeviceId,_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices,_that.delegatedPermissions,_that.isItCoordinator,_that.isDepartmentHead,_that.isUserRegistrar,_that.contactEmail,_that.contactPhone,_that.enrolledSectionIds,_that.scope,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [UserRoleConverter()])
class _User implements User {
  const _User({required this.id, this.studentId, required this.fullName, this.email, this.role = UserRole.student, this.program, this.yearLevel, this.department, this.photoUrl, this.isActive = true, this.privacyConsentVersion, this.privacyConsentedAt, this.mustChangePassword = false, this.boundDeviceId, this.deviceBoundAt, this.deviceCooldownUntil, this.cooldownDeviceId, this.canResetStudentPasswords, this.canEmergencyUnbindDevices, this.delegatedPermissions, this.isItCoordinator = false, this.isDepartmentHead = false, this.isUserRegistrar = false, this.contactEmail, this.contactPhone,  List<String> enrolledSectionIds = const <String>[], this.scope, this.createdAt = '', this.updatedAt = ''}): _enrolledSectionIds = enrolledSectionIds;
  factory _User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);

@override final  String id;
@override final  String? studentId;
@override final  String fullName;
@override final  String? email;
/// Roster rows (`GET /sections/:id/students`) and other list endpoints
/// omit `role` entirely; every such row is a student by construction.
/// Absent or explicit-null decodes to [UserRole.student]; a present
/// unknown wire value still throws [UnknownApiValue].
@override@JsonKey() final  UserRole role;
@override final  String? program;
@override final  int? yearLevel;
@override final  String? department;
@override final  String? photoUrl;
@override@JsonKey() final  bool isActive;
@override final  String? privacyConsentVersion;
@override final  String? privacyConsentedAt;
@override@JsonKey() final  bool mustChangePassword;
@override final  String? boundDeviceId;
@override final  String? deviceBoundAt;
@override final  String? deviceCooldownUntil;
@override final  String? cooldownDeviceId;
@override final  bool? canResetStudentPasswords;
@override final  bool? canEmergencyUnbindDevices;
@override final  DelegatedTeacherPermissions? delegatedPermissions;
@override@JsonKey() final  bool isItCoordinator;
@override@JsonKey() final  bool isDepartmentHead;
@override@JsonKey() final  bool isUserRegistrar;
@override final  String? contactEmail;
@override final  String? contactPhone;
 final  List<String> _enrolledSectionIds;
@override@JsonKey() List<String> get enrolledSectionIds {
  if (_enrolledSectionIds is EqualUnmodifiableListView) return _enrolledSectionIds;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_enrolledSectionIds);
}

@override final  String? scope;
@override@JsonKey() final  String createdAt;
@override@JsonKey() final  String updatedAt;

/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UserCopyWith<_User> get copyWith => __$UserCopyWithImpl<_User>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UserToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _User&&(identical(other.id, id) || other.id == id)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.email, email) || other.email == email)&&(identical(other.role, role) || other.role == role)&&(identical(other.program, program) || other.program == program)&&(identical(other.yearLevel, yearLevel) || other.yearLevel == yearLevel)&&(identical(other.department, department) || other.department == department)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&(identical(other.isActive, isActive) || other.isActive == isActive)&&(identical(other.privacyConsentVersion, privacyConsentVersion) || other.privacyConsentVersion == privacyConsentVersion)&&(identical(other.privacyConsentedAt, privacyConsentedAt) || other.privacyConsentedAt == privacyConsentedAt)&&(identical(other.mustChangePassword, mustChangePassword) || other.mustChangePassword == mustChangePassword)&&(identical(other.boundDeviceId, boundDeviceId) || other.boundDeviceId == boundDeviceId)&&(identical(other.deviceBoundAt, deviceBoundAt) || other.deviceBoundAt == deviceBoundAt)&&(identical(other.deviceCooldownUntil, deviceCooldownUntil) || other.deviceCooldownUntil == deviceCooldownUntil)&&(identical(other.cooldownDeviceId, cooldownDeviceId) || other.cooldownDeviceId == cooldownDeviceId)&&(identical(other.canResetStudentPasswords, canResetStudentPasswords) || other.canResetStudentPasswords == canResetStudentPasswords)&&(identical(other.canEmergencyUnbindDevices, canEmergencyUnbindDevices) || other.canEmergencyUnbindDevices == canEmergencyUnbindDevices)&&(identical(other.delegatedPermissions, delegatedPermissions) || other.delegatedPermissions == delegatedPermissions)&&(identical(other.isItCoordinator, isItCoordinator) || other.isItCoordinator == isItCoordinator)&&(identical(other.isDepartmentHead, isDepartmentHead) || other.isDepartmentHead == isDepartmentHead)&&(identical(other.isUserRegistrar, isUserRegistrar) || other.isUserRegistrar == isUserRegistrar)&&(identical(other.contactEmail, contactEmail) || other.contactEmail == contactEmail)&&(identical(other.contactPhone, contactPhone) || other.contactPhone == contactPhone)&&const DeepCollectionEquality().equals(other._enrolledSectionIds, _enrolledSectionIds)&&(identical(other.scope, scope) || other.scope == scope)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hashAll([runtimeType,id,studentId,fullName,email,role,program,yearLevel,department,photoUrl,isActive,privacyConsentVersion,privacyConsentedAt,mustChangePassword,boundDeviceId,deviceBoundAt,deviceCooldownUntil,cooldownDeviceId,canResetStudentPasswords,canEmergencyUnbindDevices,delegatedPermissions,isItCoordinator,isDepartmentHead,isUserRegistrar,contactEmail,contactPhone,const DeepCollectionEquality().hash(_enrolledSectionIds),scope,createdAt,updatedAt]);

@override
String toString() {
  return 'User(id: $id, studentId: $studentId, fullName: $fullName, email: $email, role: $role, program: $program, yearLevel: $yearLevel, department: $department, photoUrl: $photoUrl, isActive: $isActive, privacyConsentVersion: $privacyConsentVersion, privacyConsentedAt: $privacyConsentedAt, mustChangePassword: $mustChangePassword, boundDeviceId: $boundDeviceId, deviceBoundAt: $deviceBoundAt, deviceCooldownUntil: $deviceCooldownUntil, cooldownDeviceId: $cooldownDeviceId, canResetStudentPasswords: $canResetStudentPasswords, canEmergencyUnbindDevices: $canEmergencyUnbindDevices, delegatedPermissions: $delegatedPermissions, isItCoordinator: $isItCoordinator, isDepartmentHead: $isDepartmentHead, isUserRegistrar: $isUserRegistrar, contactEmail: $contactEmail, contactPhone: $contactPhone, enrolledSectionIds: $enrolledSectionIds, scope: $scope, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$UserCopyWith<$Res> implements $UserCopyWith<$Res> {
  factory _$UserCopyWith(_User value, $Res Function(_User) _then) = __$UserCopyWithImpl;
@override @useResult
$Res call({
 String id, String? studentId, String fullName, String? email, UserRole role, String? program, int? yearLevel, String? department, String? photoUrl, bool isActive, String? privacyConsentVersion, String? privacyConsentedAt, bool mustChangePassword, String? boundDeviceId, String? deviceBoundAt, String? deviceCooldownUntil, String? cooldownDeviceId, bool? canResetStudentPasswords, bool? canEmergencyUnbindDevices, DelegatedTeacherPermissions? delegatedPermissions, bool isItCoordinator, bool isDepartmentHead, bool isUserRegistrar, String? contactEmail, String? contactPhone, List<String> enrolledSectionIds, String? scope, String createdAt, String updatedAt
});


@override $DelegatedTeacherPermissionsCopyWith<$Res>? get delegatedPermissions;

}
/// @nodoc
class __$UserCopyWithImpl<$Res>
    implements _$UserCopyWith<$Res> {
  __$UserCopyWithImpl(this._self, this._then);

  final _User _self;
  final $Res Function(_User) _then;

/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? studentId = freezed,Object? fullName = null,Object? email = freezed,Object? role = null,Object? program = freezed,Object? yearLevel = freezed,Object? department = freezed,Object? photoUrl = freezed,Object? isActive = null,Object? privacyConsentVersion = freezed,Object? privacyConsentedAt = freezed,Object? mustChangePassword = null,Object? boundDeviceId = freezed,Object? deviceBoundAt = freezed,Object? deviceCooldownUntil = freezed,Object? cooldownDeviceId = freezed,Object? canResetStudentPasswords = freezed,Object? canEmergencyUnbindDevices = freezed,Object? delegatedPermissions = freezed,Object? isItCoordinator = null,Object? isDepartmentHead = null,Object? isUserRegistrar = null,Object? contactEmail = freezed,Object? contactPhone = freezed,Object? enrolledSectionIds = null,Object? scope = freezed,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(_User(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,studentId: freezed == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String?,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as UserRole,program: freezed == program ? _self.program : program // ignore: cast_nullable_to_non_nullable
as String?,yearLevel: freezed == yearLevel ? _self.yearLevel : yearLevel // ignore: cast_nullable_to_non_nullable
as int?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,privacyConsentVersion: freezed == privacyConsentVersion ? _self.privacyConsentVersion : privacyConsentVersion // ignore: cast_nullable_to_non_nullable
as String?,privacyConsentedAt: freezed == privacyConsentedAt ? _self.privacyConsentedAt : privacyConsentedAt // ignore: cast_nullable_to_non_nullable
as String?,mustChangePassword: null == mustChangePassword ? _self.mustChangePassword : mustChangePassword // ignore: cast_nullable_to_non_nullable
as bool,boundDeviceId: freezed == boundDeviceId ? _self.boundDeviceId : boundDeviceId // ignore: cast_nullable_to_non_nullable
as String?,deviceBoundAt: freezed == deviceBoundAt ? _self.deviceBoundAt : deviceBoundAt // ignore: cast_nullable_to_non_nullable
as String?,deviceCooldownUntil: freezed == deviceCooldownUntil ? _self.deviceCooldownUntil : deviceCooldownUntil // ignore: cast_nullable_to_non_nullable
as String?,cooldownDeviceId: freezed == cooldownDeviceId ? _self.cooldownDeviceId : cooldownDeviceId // ignore: cast_nullable_to_non_nullable
as String?,canResetStudentPasswords: freezed == canResetStudentPasswords ? _self.canResetStudentPasswords : canResetStudentPasswords // ignore: cast_nullable_to_non_nullable
as bool?,canEmergencyUnbindDevices: freezed == canEmergencyUnbindDevices ? _self.canEmergencyUnbindDevices : canEmergencyUnbindDevices // ignore: cast_nullable_to_non_nullable
as bool?,delegatedPermissions: freezed == delegatedPermissions ? _self.delegatedPermissions : delegatedPermissions // ignore: cast_nullable_to_non_nullable
as DelegatedTeacherPermissions?,isItCoordinator: null == isItCoordinator ? _self.isItCoordinator : isItCoordinator // ignore: cast_nullable_to_non_nullable
as bool,isDepartmentHead: null == isDepartmentHead ? _self.isDepartmentHead : isDepartmentHead // ignore: cast_nullable_to_non_nullable
as bool,isUserRegistrar: null == isUserRegistrar ? _self.isUserRegistrar : isUserRegistrar // ignore: cast_nullable_to_non_nullable
as bool,contactEmail: freezed == contactEmail ? _self.contactEmail : contactEmail // ignore: cast_nullable_to_non_nullable
as String?,contactPhone: freezed == contactPhone ? _self.contactPhone : contactPhone // ignore: cast_nullable_to_non_nullable
as String?,enrolledSectionIds: null == enrolledSectionIds ? _self._enrolledSectionIds : enrolledSectionIds // ignore: cast_nullable_to_non_nullable
as List<String>,scope: freezed == scope ? _self.scope : scope // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

/// Create a copy of User
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$DelegatedTeacherPermissionsCopyWith<$Res>? get delegatedPermissions {
    if (_self.delegatedPermissions == null) {
    return null;
  }

  return $DelegatedTeacherPermissionsCopyWith<$Res>(_self.delegatedPermissions!, (value) {
    return _then(_self.copyWith(delegatedPermissions: value));
  });
}
}

// dart format on
