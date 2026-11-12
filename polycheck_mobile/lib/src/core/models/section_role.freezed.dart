// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'section_role.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$SectionRole {

 String get id; String get sectionId; String get studentId; String get studentName; SectionRoleType get role; String get grantedBy; String get grantedAt;
/// Create a copy of SectionRole
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SectionRoleCopyWith<SectionRole> get copyWith => _$SectionRoleCopyWithImpl<SectionRole>(this as SectionRole, _$identity);

  /// Serializes this SectionRole to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SectionRole&&(identical(other.id, id) || other.id == id)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.role, role) || other.role == role)&&(identical(other.grantedBy, grantedBy) || other.grantedBy == grantedBy)&&(identical(other.grantedAt, grantedAt) || other.grantedAt == grantedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,sectionId,studentId,studentName,role,grantedBy,grantedAt);

@override
String toString() {
  return 'SectionRole(id: $id, sectionId: $sectionId, studentId: $studentId, studentName: $studentName, role: $role, grantedBy: $grantedBy, grantedAt: $grantedAt)';
}


}

/// @nodoc
abstract mixin class $SectionRoleCopyWith<$Res>  {
  factory $SectionRoleCopyWith(SectionRole value, $Res Function(SectionRole) _then) = _$SectionRoleCopyWithImpl;
@useResult
$Res call({
 String id, String sectionId, String studentId, String studentName, SectionRoleType role, String grantedBy, String grantedAt
});




}
/// @nodoc
class _$SectionRoleCopyWithImpl<$Res>
    implements $SectionRoleCopyWith<$Res> {
  _$SectionRoleCopyWithImpl(this._self, this._then);

  final SectionRole _self;
  final $Res Function(SectionRole) _then;

/// Create a copy of SectionRole
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? sectionId = null,Object? studentId = null,Object? studentName = null,Object? role = null,Object? grantedBy = null,Object? grantedAt = null,}) {
  return _then(SectionRole(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as SectionRoleType,grantedBy: null == grantedBy ? _self.grantedBy : grantedBy // ignore: cast_nullable_to_non_nullable
as String,grantedAt: null == grantedAt ? _self.grantedAt : grantedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [SectionRole].
extension SectionRolePatterns on SectionRole {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SectionRole value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SectionRole() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SectionRole value)  $default,){
final _that = this;
switch (_that) {
case _SectionRole():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SectionRole value)?  $default,){
final _that = this;
switch (_that) {
case _SectionRole() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String sectionId,  String studentId,  String studentName,  SectionRoleType role,  String grantedBy,  String grantedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SectionRole() when $default != null:
return $default(_that.id,_that.sectionId,_that.studentId,_that.studentName,_that.role,_that.grantedBy,_that.grantedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String sectionId,  String studentId,  String studentName,  SectionRoleType role,  String grantedBy,  String grantedAt)  $default,) {final _that = this;
switch (_that) {
case _SectionRole():
return $default(_that.id,_that.sectionId,_that.studentId,_that.studentName,_that.role,_that.grantedBy,_that.grantedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String sectionId,  String studentId,  String studentName,  SectionRoleType role,  String grantedBy,  String grantedAt)?  $default,) {final _that = this;
switch (_that) {
case _SectionRole() when $default != null:
return $default(_that.id,_that.sectionId,_that.studentId,_that.studentName,_that.role,_that.grantedBy,_that.grantedAt);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [SectionRoleTypeConverter()])
class _SectionRole implements SectionRole {
  const _SectionRole({required this.id, required this.sectionId, required this.studentId, this.studentName = '', required this.role, this.grantedBy = '', this.grantedAt = ''});
  factory _SectionRole.fromJson(Map<String, dynamic> json) => _$SectionRoleFromJson(json);

@override final  String id;
@override final  String sectionId;
@override final  String studentId;
@override@JsonKey() final  String studentName;
@override final  SectionRoleType role;
@override@JsonKey() final  String grantedBy;
@override@JsonKey() final  String grantedAt;

/// Create a copy of SectionRole
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SectionRoleCopyWith<_SectionRole> get copyWith => __$SectionRoleCopyWithImpl<_SectionRole>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SectionRoleToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SectionRole&&(identical(other.id, id) || other.id == id)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.studentName, studentName) || other.studentName == studentName)&&(identical(other.role, role) || other.role == role)&&(identical(other.grantedBy, grantedBy) || other.grantedBy == grantedBy)&&(identical(other.grantedAt, grantedAt) || other.grantedAt == grantedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,sectionId,studentId,studentName,role,grantedBy,grantedAt);

@override
String toString() {
  return 'SectionRole(id: $id, sectionId: $sectionId, studentId: $studentId, studentName: $studentName, role: $role, grantedBy: $grantedBy, grantedAt: $grantedAt)';
}


}

/// @nodoc
abstract mixin class _$SectionRoleCopyWith<$Res> implements $SectionRoleCopyWith<$Res> {
  factory _$SectionRoleCopyWith(_SectionRole value, $Res Function(_SectionRole) _then) = __$SectionRoleCopyWithImpl;
@override @useResult
$Res call({
 String id, String sectionId, String studentId, String studentName, SectionRoleType role, String grantedBy, String grantedAt
});




}
/// @nodoc
class __$SectionRoleCopyWithImpl<$Res>
    implements _$SectionRoleCopyWith<$Res> {
  __$SectionRoleCopyWithImpl(this._self, this._then);

  final _SectionRole _self;
  final $Res Function(_SectionRole) _then;

/// Create a copy of SectionRole
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? sectionId = null,Object? studentId = null,Object? studentName = null,Object? role = null,Object? grantedBy = null,Object? grantedAt = null,}) {
  return _then(_SectionRole(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,studentName: null == studentName ? _self.studentName : studentName // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as SectionRoleType,grantedBy: null == grantedBy ? _self.grantedBy : grantedBy // ignore: cast_nullable_to_non_nullable
as String,grantedAt: null == grantedAt ? _self.grantedAt : grantedAt // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$SessionPermission {

 String get id; String get sectionId; String get studentId; String get grantedBy; String get grantedAt; String get expiresAt; bool get isActive;
/// Create a copy of SessionPermission
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionPermissionCopyWith<SessionPermission> get copyWith => _$SessionPermissionCopyWithImpl<SessionPermission>(this as SessionPermission, _$identity);

  /// Serializes this SessionPermission to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionPermission&&(identical(other.id, id) || other.id == id)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.grantedBy, grantedBy) || other.grantedBy == grantedBy)&&(identical(other.grantedAt, grantedAt) || other.grantedAt == grantedAt)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt)&&(identical(other.isActive, isActive) || other.isActive == isActive));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,sectionId,studentId,grantedBy,grantedAt,expiresAt,isActive);

@override
String toString() {
  return 'SessionPermission(id: $id, sectionId: $sectionId, studentId: $studentId, grantedBy: $grantedBy, grantedAt: $grantedAt, expiresAt: $expiresAt, isActive: $isActive)';
}


}

/// @nodoc
abstract mixin class $SessionPermissionCopyWith<$Res>  {
  factory $SessionPermissionCopyWith(SessionPermission value, $Res Function(SessionPermission) _then) = _$SessionPermissionCopyWithImpl;
@useResult
$Res call({
 String id, String sectionId, String studentId, String grantedBy, String grantedAt, String expiresAt, bool isActive
});




}
/// @nodoc
class _$SessionPermissionCopyWithImpl<$Res>
    implements $SessionPermissionCopyWith<$Res> {
  _$SessionPermissionCopyWithImpl(this._self, this._then);

  final SessionPermission _self;
  final $Res Function(SessionPermission) _then;

/// Create a copy of SessionPermission
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? sectionId = null,Object? studentId = null,Object? grantedBy = null,Object? grantedAt = null,Object? expiresAt = null,Object? isActive = null,}) {
  return _then(SessionPermission(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,grantedBy: null == grantedBy ? _self.grantedBy : grantedBy // ignore: cast_nullable_to_non_nullable
as String,grantedAt: null == grantedAt ? _self.grantedAt : grantedAt // ignore: cast_nullable_to_non_nullable
as String,expiresAt: null == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as String,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionPermission].
extension SessionPermissionPatterns on SessionPermission {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionPermission value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionPermission() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionPermission value)  $default,){
final _that = this;
switch (_that) {
case _SessionPermission():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionPermission value)?  $default,){
final _that = this;
switch (_that) {
case _SessionPermission() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String sectionId,  String studentId,  String grantedBy,  String grantedAt,  String expiresAt,  bool isActive)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionPermission() when $default != null:
return $default(_that.id,_that.sectionId,_that.studentId,_that.grantedBy,_that.grantedAt,_that.expiresAt,_that.isActive);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String sectionId,  String studentId,  String grantedBy,  String grantedAt,  String expiresAt,  bool isActive)  $default,) {final _that = this;
switch (_that) {
case _SessionPermission():
return $default(_that.id,_that.sectionId,_that.studentId,_that.grantedBy,_that.grantedAt,_that.expiresAt,_that.isActive);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String sectionId,  String studentId,  String grantedBy,  String grantedAt,  String expiresAt,  bool isActive)?  $default,) {final _that = this;
switch (_that) {
case _SessionPermission() when $default != null:
return $default(_that.id,_that.sectionId,_that.studentId,_that.grantedBy,_that.grantedAt,_that.expiresAt,_that.isActive);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _SessionPermission implements SessionPermission {
  const _SessionPermission({required this.id, required this.sectionId, required this.studentId, this.grantedBy = '', this.grantedAt = '', required this.expiresAt, this.isActive = false});
  factory _SessionPermission.fromJson(Map<String, dynamic> json) => _$SessionPermissionFromJson(json);

@override final  String id;
@override final  String sectionId;
@override final  String studentId;
@override@JsonKey() final  String grantedBy;
@override@JsonKey() final  String grantedAt;
@override final  String expiresAt;
@override@JsonKey() final  bool isActive;

/// Create a copy of SessionPermission
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionPermissionCopyWith<_SessionPermission> get copyWith => __$SessionPermissionCopyWithImpl<_SessionPermission>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionPermissionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionPermission&&(identical(other.id, id) || other.id == id)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.grantedBy, grantedBy) || other.grantedBy == grantedBy)&&(identical(other.grantedAt, grantedAt) || other.grantedAt == grantedAt)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt)&&(identical(other.isActive, isActive) || other.isActive == isActive));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,sectionId,studentId,grantedBy,grantedAt,expiresAt,isActive);

@override
String toString() {
  return 'SessionPermission(id: $id, sectionId: $sectionId, studentId: $studentId, grantedBy: $grantedBy, grantedAt: $grantedAt, expiresAt: $expiresAt, isActive: $isActive)';
}


}

/// @nodoc
abstract mixin class _$SessionPermissionCopyWith<$Res> implements $SessionPermissionCopyWith<$Res> {
  factory _$SessionPermissionCopyWith(_SessionPermission value, $Res Function(_SessionPermission) _then) = __$SessionPermissionCopyWithImpl;
@override @useResult
$Res call({
 String id, String sectionId, String studentId, String grantedBy, String grantedAt, String expiresAt, bool isActive
});




}
/// @nodoc
class __$SessionPermissionCopyWithImpl<$Res>
    implements _$SessionPermissionCopyWith<$Res> {
  __$SessionPermissionCopyWithImpl(this._self, this._then);

  final _SessionPermission _self;
  final $Res Function(_SessionPermission) _then;

/// Create a copy of SessionPermission
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? sectionId = null,Object? studentId = null,Object? grantedBy = null,Object? grantedAt = null,Object? expiresAt = null,Object? isActive = null,}) {
  return _then(_SessionPermission(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,studentId: null == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String,grantedBy: null == grantedBy ? _self.grantedBy : grantedBy // ignore: cast_nullable_to_non_nullable
as String,grantedAt: null == grantedAt ? _self.grantedAt : grantedAt // ignore: cast_nullable_to_non_nullable
as String,expiresAt: null == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as String,isActive: null == isActive ? _self.isActive : isActive // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$ProofOfClass {

 String get id; String get sectionId; String get sessionId; String get uploadedBy; String get uploadedByStudentName; String get photoData; String get uploadedAt; String? get description;
/// Create a copy of ProofOfClass
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProofOfClassCopyWith<ProofOfClass> get copyWith => _$ProofOfClassCopyWithImpl<ProofOfClass>(this as ProofOfClass, _$identity);

  /// Serializes this ProofOfClass to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProofOfClass&&(identical(other.id, id) || other.id == id)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.uploadedBy, uploadedBy) || other.uploadedBy == uploadedBy)&&(identical(other.uploadedByStudentName, uploadedByStudentName) || other.uploadedByStudentName == uploadedByStudentName)&&(identical(other.photoData, photoData) || other.photoData == photoData)&&(identical(other.uploadedAt, uploadedAt) || other.uploadedAt == uploadedAt)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,sectionId,sessionId,uploadedBy,uploadedByStudentName,photoData,uploadedAt,description);

@override
String toString() {
  return 'ProofOfClass(id: $id, sectionId: $sectionId, sessionId: $sessionId, uploadedBy: $uploadedBy, uploadedByStudentName: $uploadedByStudentName, photoData: $photoData, uploadedAt: $uploadedAt, description: $description)';
}


}

/// @nodoc
abstract mixin class $ProofOfClassCopyWith<$Res>  {
  factory $ProofOfClassCopyWith(ProofOfClass value, $Res Function(ProofOfClass) _then) = _$ProofOfClassCopyWithImpl;
@useResult
$Res call({
 String id, String sectionId, String sessionId, String uploadedBy, String uploadedByStudentName, String photoData, String uploadedAt, String? description
});




}
/// @nodoc
class _$ProofOfClassCopyWithImpl<$Res>
    implements $ProofOfClassCopyWith<$Res> {
  _$ProofOfClassCopyWithImpl(this._self, this._then);

  final ProofOfClass _self;
  final $Res Function(ProofOfClass) _then;

/// Create a copy of ProofOfClass
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? sectionId = null,Object? sessionId = null,Object? uploadedBy = null,Object? uploadedByStudentName = null,Object? photoData = null,Object? uploadedAt = null,Object? description = freezed,}) {
  return _then(ProofOfClass(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,uploadedBy: null == uploadedBy ? _self.uploadedBy : uploadedBy // ignore: cast_nullable_to_non_nullable
as String,uploadedByStudentName: null == uploadedByStudentName ? _self.uploadedByStudentName : uploadedByStudentName // ignore: cast_nullable_to_non_nullable
as String,photoData: null == photoData ? _self.photoData : photoData // ignore: cast_nullable_to_non_nullable
as String,uploadedAt: null == uploadedAt ? _self.uploadedAt : uploadedAt // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ProofOfClass].
extension ProofOfClassPatterns on ProofOfClass {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProofOfClass value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProofOfClass() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProofOfClass value)  $default,){
final _that = this;
switch (_that) {
case _ProofOfClass():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProofOfClass value)?  $default,){
final _that = this;
switch (_that) {
case _ProofOfClass() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String sectionId,  String sessionId,  String uploadedBy,  String uploadedByStudentName,  String photoData,  String uploadedAt,  String? description)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProofOfClass() when $default != null:
return $default(_that.id,_that.sectionId,_that.sessionId,_that.uploadedBy,_that.uploadedByStudentName,_that.photoData,_that.uploadedAt,_that.description);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String sectionId,  String sessionId,  String uploadedBy,  String uploadedByStudentName,  String photoData,  String uploadedAt,  String? description)  $default,) {final _that = this;
switch (_that) {
case _ProofOfClass():
return $default(_that.id,_that.sectionId,_that.sessionId,_that.uploadedBy,_that.uploadedByStudentName,_that.photoData,_that.uploadedAt,_that.description);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String sectionId,  String sessionId,  String uploadedBy,  String uploadedByStudentName,  String photoData,  String uploadedAt,  String? description)?  $default,) {final _that = this;
switch (_that) {
case _ProofOfClass() when $default != null:
return $default(_that.id,_that.sectionId,_that.sessionId,_that.uploadedBy,_that.uploadedByStudentName,_that.photoData,_that.uploadedAt,_that.description);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _ProofOfClass implements ProofOfClass {
  const _ProofOfClass({required this.id, required this.sectionId, required this.sessionId, required this.uploadedBy, this.uploadedByStudentName = '', this.photoData = '', this.uploadedAt = '', this.description});
  factory _ProofOfClass.fromJson(Map<String, dynamic> json) => _$ProofOfClassFromJson(json);

@override final  String id;
@override final  String sectionId;
@override final  String sessionId;
@override final  String uploadedBy;
@override@JsonKey() final  String uploadedByStudentName;
@override@JsonKey() final  String photoData;
@override@JsonKey() final  String uploadedAt;
@override final  String? description;

/// Create a copy of ProofOfClass
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProofOfClassCopyWith<_ProofOfClass> get copyWith => __$ProofOfClassCopyWithImpl<_ProofOfClass>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProofOfClassToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProofOfClass&&(identical(other.id, id) || other.id == id)&&(identical(other.sectionId, sectionId) || other.sectionId == sectionId)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId)&&(identical(other.uploadedBy, uploadedBy) || other.uploadedBy == uploadedBy)&&(identical(other.uploadedByStudentName, uploadedByStudentName) || other.uploadedByStudentName == uploadedByStudentName)&&(identical(other.photoData, photoData) || other.photoData == photoData)&&(identical(other.uploadedAt, uploadedAt) || other.uploadedAt == uploadedAt)&&(identical(other.description, description) || other.description == description));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,sectionId,sessionId,uploadedBy,uploadedByStudentName,photoData,uploadedAt,description);

@override
String toString() {
  return 'ProofOfClass(id: $id, sectionId: $sectionId, sessionId: $sessionId, uploadedBy: $uploadedBy, uploadedByStudentName: $uploadedByStudentName, photoData: $photoData, uploadedAt: $uploadedAt, description: $description)';
}


}

/// @nodoc
abstract mixin class _$ProofOfClassCopyWith<$Res> implements $ProofOfClassCopyWith<$Res> {
  factory _$ProofOfClassCopyWith(_ProofOfClass value, $Res Function(_ProofOfClass) _then) = __$ProofOfClassCopyWithImpl;
@override @useResult
$Res call({
 String id, String sectionId, String sessionId, String uploadedBy, String uploadedByStudentName, String photoData, String uploadedAt, String? description
});




}
/// @nodoc
class __$ProofOfClassCopyWithImpl<$Res>
    implements _$ProofOfClassCopyWith<$Res> {
  __$ProofOfClassCopyWithImpl(this._self, this._then);

  final _ProofOfClass _self;
  final $Res Function(_ProofOfClass) _then;

/// Create a copy of ProofOfClass
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? sectionId = null,Object? sessionId = null,Object? uploadedBy = null,Object? uploadedByStudentName = null,Object? photoData = null,Object? uploadedAt = null,Object? description = freezed,}) {
  return _then(_ProofOfClass(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,sectionId: null == sectionId ? _self.sectionId : sectionId // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,uploadedBy: null == uploadedBy ? _self.uploadedBy : uploadedBy // ignore: cast_nullable_to_non_nullable
as String,uploadedByStudentName: null == uploadedByStudentName ? _self.uploadedByStudentName : uploadedByStudentName // ignore: cast_nullable_to_non_nullable
as String,photoData: null == photoData ? _self.photoData : photoData // ignore: cast_nullable_to_non_nullable
as String,uploadedAt: null == uploadedAt ? _self.uploadedAt : uploadedAt // ignore: cast_nullable_to_non_nullable
as String,description: freezed == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
