// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'system_report.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ReportSubmitter {

 String get id; String get fullName; UserRole get role; String? get studentId; String? get email; String? get department;
/// Create a copy of ReportSubmitter
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReportSubmitterCopyWith<ReportSubmitter> get copyWith => _$ReportSubmitterCopyWithImpl<ReportSubmitter>(this as ReportSubmitter, _$identity);

  /// Serializes this ReportSubmitter to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReportSubmitter&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.role, role) || other.role == role)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.email, email) || other.email == email)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,role,studentId,email,department);

@override
String toString() {
  return 'ReportSubmitter(id: $id, fullName: $fullName, role: $role, studentId: $studentId, email: $email, department: $department)';
}


}

/// @nodoc
abstract mixin class $ReportSubmitterCopyWith<$Res>  {
  factory $ReportSubmitterCopyWith(ReportSubmitter value, $Res Function(ReportSubmitter) _then) = _$ReportSubmitterCopyWithImpl;
@useResult
$Res call({
 String id, String fullName, UserRole role, String? studentId, String? email, String? department
});




}
/// @nodoc
class _$ReportSubmitterCopyWithImpl<$Res>
    implements $ReportSubmitterCopyWith<$Res> {
  _$ReportSubmitterCopyWithImpl(this._self, this._then);

  final ReportSubmitter _self;
  final $Res Function(ReportSubmitter) _then;

/// Create a copy of ReportSubmitter
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? fullName = null,Object? role = null,Object? studentId = freezed,Object? email = freezed,Object? department = freezed,}) {
  return _then(ReportSubmitter(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as UserRole,studentId: freezed == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ReportSubmitter].
extension ReportSubmitterPatterns on ReportSubmitter {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReportSubmitter value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReportSubmitter() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReportSubmitter value)  $default,){
final _that = this;
switch (_that) {
case _ReportSubmitter():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReportSubmitter value)?  $default,){
final _that = this;
switch (_that) {
case _ReportSubmitter() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String fullName,  UserRole role,  String? studentId,  String? email,  String? department)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReportSubmitter() when $default != null:
return $default(_that.id,_that.fullName,_that.role,_that.studentId,_that.email,_that.department);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String fullName,  UserRole role,  String? studentId,  String? email,  String? department)  $default,) {final _that = this;
switch (_that) {
case _ReportSubmitter():
return $default(_that.id,_that.fullName,_that.role,_that.studentId,_that.email,_that.department);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String fullName,  UserRole role,  String? studentId,  String? email,  String? department)?  $default,) {final _that = this;
switch (_that) {
case _ReportSubmitter() when $default != null:
return $default(_that.id,_that.fullName,_that.role,_that.studentId,_that.email,_that.department);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [UserRoleConverter()])
class _ReportSubmitter implements ReportSubmitter {
  const _ReportSubmitter({required this.id, this.fullName = '', required this.role, this.studentId, this.email, this.department});
  factory _ReportSubmitter.fromJson(Map<String, dynamic> json) => _$ReportSubmitterFromJson(json);

@override final  String id;
@override@JsonKey() final  String fullName;
@override final  UserRole role;
@override final  String? studentId;
@override final  String? email;
@override final  String? department;

/// Create a copy of ReportSubmitter
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReportSubmitterCopyWith<_ReportSubmitter> get copyWith => __$ReportSubmitterCopyWithImpl<_ReportSubmitter>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReportSubmitterToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReportSubmitter&&(identical(other.id, id) || other.id == id)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.role, role) || other.role == role)&&(identical(other.studentId, studentId) || other.studentId == studentId)&&(identical(other.email, email) || other.email == email)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,fullName,role,studentId,email,department);

@override
String toString() {
  return 'ReportSubmitter(id: $id, fullName: $fullName, role: $role, studentId: $studentId, email: $email, department: $department)';
}


}

/// @nodoc
abstract mixin class _$ReportSubmitterCopyWith<$Res> implements $ReportSubmitterCopyWith<$Res> {
  factory _$ReportSubmitterCopyWith(_ReportSubmitter value, $Res Function(_ReportSubmitter) _then) = __$ReportSubmitterCopyWithImpl;
@override @useResult
$Res call({
 String id, String fullName, UserRole role, String? studentId, String? email, String? department
});




}
/// @nodoc
class __$ReportSubmitterCopyWithImpl<$Res>
    implements _$ReportSubmitterCopyWith<$Res> {
  __$ReportSubmitterCopyWithImpl(this._self, this._then);

  final _ReportSubmitter _self;
  final $Res Function(_ReportSubmitter) _then;

/// Create a copy of ReportSubmitter
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? fullName = null,Object? role = null,Object? studentId = freezed,Object? email = freezed,Object? department = freezed,}) {
  return _then(_ReportSubmitter(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,fullName: null == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as UserRole,studentId: freezed == studentId ? _self.studentId : studentId // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SystemReport {

 String get id; ReportCategory get category; ReportSeverity get severity; String get title; String get description; ReportStatus get status; String? get deviceInfo; String? get appVersion; String? get route; String? get networkType; String? get screenshotUrl; String? get adminNotes; String? get resolvedAt; String? get resolvedBy; String get createdAt; String get updatedAt; ReportSubmitter get user;
/// Create a copy of SystemReport
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SystemReportCopyWith<SystemReport> get copyWith => _$SystemReportCopyWithImpl<SystemReport>(this as SystemReport, _$identity);

  /// Serializes this SystemReport to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SystemReport&&(identical(other.id, id) || other.id == id)&&(identical(other.category, category) || other.category == category)&&(identical(other.severity, severity) || other.severity == severity)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.status, status) || other.status == status)&&(identical(other.deviceInfo, deviceInfo) || other.deviceInfo == deviceInfo)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion)&&(identical(other.route, route) || other.route == route)&&(identical(other.networkType, networkType) || other.networkType == networkType)&&(identical(other.screenshotUrl, screenshotUrl) || other.screenshotUrl == screenshotUrl)&&(identical(other.adminNotes, adminNotes) || other.adminNotes == adminNotes)&&(identical(other.resolvedAt, resolvedAt) || other.resolvedAt == resolvedAt)&&(identical(other.resolvedBy, resolvedBy) || other.resolvedBy == resolvedBy)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.user, user) || other.user == user));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,category,severity,title,description,status,deviceInfo,appVersion,route,networkType,screenshotUrl,adminNotes,resolvedAt,resolvedBy,createdAt,updatedAt,user);

@override
String toString() {
  return 'SystemReport(id: $id, category: $category, severity: $severity, title: $title, description: $description, status: $status, deviceInfo: $deviceInfo, appVersion: $appVersion, route: $route, networkType: $networkType, screenshotUrl: $screenshotUrl, adminNotes: $adminNotes, resolvedAt: $resolvedAt, resolvedBy: $resolvedBy, createdAt: $createdAt, updatedAt: $updatedAt, user: $user)';
}


}

/// @nodoc
abstract mixin class $SystemReportCopyWith<$Res>  {
  factory $SystemReportCopyWith(SystemReport value, $Res Function(SystemReport) _then) = _$SystemReportCopyWithImpl;
@useResult
$Res call({
 String id, ReportCategory category, ReportSeverity severity, String title, String description, ReportStatus status, String? deviceInfo, String? appVersion, String? route, String? networkType, String? screenshotUrl, String? adminNotes, String? resolvedAt, String? resolvedBy, String createdAt, String updatedAt, ReportSubmitter user
});


$ReportSubmitterCopyWith<$Res> get user;

}
/// @nodoc
class _$SystemReportCopyWithImpl<$Res>
    implements $SystemReportCopyWith<$Res> {
  _$SystemReportCopyWithImpl(this._self, this._then);

  final SystemReport _self;
  final $Res Function(SystemReport) _then;

/// Create a copy of SystemReport
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? category = null,Object? severity = null,Object? title = null,Object? description = null,Object? status = null,Object? deviceInfo = freezed,Object? appVersion = freezed,Object? route = freezed,Object? networkType = freezed,Object? screenshotUrl = freezed,Object? adminNotes = freezed,Object? resolvedAt = freezed,Object? resolvedBy = freezed,Object? createdAt = null,Object? updatedAt = null,Object? user = null,}) {
  return _then(SystemReport(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as ReportCategory,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as ReportSeverity,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReportStatus,deviceInfo: freezed == deviceInfo ? _self.deviceInfo : deviceInfo // ignore: cast_nullable_to_non_nullable
as String?,appVersion: freezed == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String?,route: freezed == route ? _self.route : route // ignore: cast_nullable_to_non_nullable
as String?,networkType: freezed == networkType ? _self.networkType : networkType // ignore: cast_nullable_to_non_nullable
as String?,screenshotUrl: freezed == screenshotUrl ? _self.screenshotUrl : screenshotUrl // ignore: cast_nullable_to_non_nullable
as String?,adminNotes: freezed == adminNotes ? _self.adminNotes : adminNotes // ignore: cast_nullable_to_non_nullable
as String?,resolvedAt: freezed == resolvedAt ? _self.resolvedAt : resolvedAt // ignore: cast_nullable_to_non_nullable
as String?,resolvedBy: freezed == resolvedBy ? _self.resolvedBy : resolvedBy // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as ReportSubmitter,
  ));
}
/// Create a copy of SystemReport
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ReportSubmitterCopyWith<$Res> get user {
  
  return $ReportSubmitterCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}
}


/// Adds pattern-matching-related methods to [SystemReport].
extension SystemReportPatterns on SystemReport {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SystemReport value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SystemReport() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SystemReport value)  $default,){
final _that = this;
switch (_that) {
case _SystemReport():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SystemReport value)?  $default,){
final _that = this;
switch (_that) {
case _SystemReport() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  ReportCategory category,  ReportSeverity severity,  String title,  String description,  ReportStatus status,  String? deviceInfo,  String? appVersion,  String? route,  String? networkType,  String? screenshotUrl,  String? adminNotes,  String? resolvedAt,  String? resolvedBy,  String createdAt,  String updatedAt,  ReportSubmitter user)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SystemReport() when $default != null:
return $default(_that.id,_that.category,_that.severity,_that.title,_that.description,_that.status,_that.deviceInfo,_that.appVersion,_that.route,_that.networkType,_that.screenshotUrl,_that.adminNotes,_that.resolvedAt,_that.resolvedBy,_that.createdAt,_that.updatedAt,_that.user);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  ReportCategory category,  ReportSeverity severity,  String title,  String description,  ReportStatus status,  String? deviceInfo,  String? appVersion,  String? route,  String? networkType,  String? screenshotUrl,  String? adminNotes,  String? resolvedAt,  String? resolvedBy,  String createdAt,  String updatedAt,  ReportSubmitter user)  $default,) {final _that = this;
switch (_that) {
case _SystemReport():
return $default(_that.id,_that.category,_that.severity,_that.title,_that.description,_that.status,_that.deviceInfo,_that.appVersion,_that.route,_that.networkType,_that.screenshotUrl,_that.adminNotes,_that.resolvedAt,_that.resolvedBy,_that.createdAt,_that.updatedAt,_that.user);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  ReportCategory category,  ReportSeverity severity,  String title,  String description,  ReportStatus status,  String? deviceInfo,  String? appVersion,  String? route,  String? networkType,  String? screenshotUrl,  String? adminNotes,  String? resolvedAt,  String? resolvedBy,  String createdAt,  String updatedAt,  ReportSubmitter user)?  $default,) {final _that = this;
switch (_that) {
case _SystemReport() when $default != null:
return $default(_that.id,_that.category,_that.severity,_that.title,_that.description,_that.status,_that.deviceInfo,_that.appVersion,_that.route,_that.networkType,_that.screenshotUrl,_that.adminNotes,_that.resolvedAt,_that.resolvedBy,_that.createdAt,_that.updatedAt,_that.user);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ReportCategoryConverter(), ReportSeverityConverter(), ReportStatusConverter()])
class _SystemReport implements SystemReport {
  const _SystemReport({required this.id, required this.category, required this.severity, this.title = '', this.description = '', required this.status, this.deviceInfo, this.appVersion, this.route, this.networkType, this.screenshotUrl, this.adminNotes, this.resolvedAt, this.resolvedBy, this.createdAt = '', this.updatedAt = '', required this.user});
  factory _SystemReport.fromJson(Map<String, dynamic> json) => _$SystemReportFromJson(json);

@override final  String id;
@override final  ReportCategory category;
@override final  ReportSeverity severity;
@override@JsonKey() final  String title;
@override@JsonKey() final  String description;
@override final  ReportStatus status;
@override final  String? deviceInfo;
@override final  String? appVersion;
@override final  String? route;
@override final  String? networkType;
@override final  String? screenshotUrl;
@override final  String? adminNotes;
@override final  String? resolvedAt;
@override final  String? resolvedBy;
@override@JsonKey() final  String createdAt;
@override@JsonKey() final  String updatedAt;
@override final  ReportSubmitter user;

/// Create a copy of SystemReport
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SystemReportCopyWith<_SystemReport> get copyWith => __$SystemReportCopyWithImpl<_SystemReport>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SystemReportToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SystemReport&&(identical(other.id, id) || other.id == id)&&(identical(other.category, category) || other.category == category)&&(identical(other.severity, severity) || other.severity == severity)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.status, status) || other.status == status)&&(identical(other.deviceInfo, deviceInfo) || other.deviceInfo == deviceInfo)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion)&&(identical(other.route, route) || other.route == route)&&(identical(other.networkType, networkType) || other.networkType == networkType)&&(identical(other.screenshotUrl, screenshotUrl) || other.screenshotUrl == screenshotUrl)&&(identical(other.adminNotes, adminNotes) || other.adminNotes == adminNotes)&&(identical(other.resolvedAt, resolvedAt) || other.resolvedAt == resolvedAt)&&(identical(other.resolvedBy, resolvedBy) || other.resolvedBy == resolvedBy)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.user, user) || other.user == user));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,category,severity,title,description,status,deviceInfo,appVersion,route,networkType,screenshotUrl,adminNotes,resolvedAt,resolvedBy,createdAt,updatedAt,user);

@override
String toString() {
  return 'SystemReport(id: $id, category: $category, severity: $severity, title: $title, description: $description, status: $status, deviceInfo: $deviceInfo, appVersion: $appVersion, route: $route, networkType: $networkType, screenshotUrl: $screenshotUrl, adminNotes: $adminNotes, resolvedAt: $resolvedAt, resolvedBy: $resolvedBy, createdAt: $createdAt, updatedAt: $updatedAt, user: $user)';
}


}

/// @nodoc
abstract mixin class _$SystemReportCopyWith<$Res> implements $SystemReportCopyWith<$Res> {
  factory _$SystemReportCopyWith(_SystemReport value, $Res Function(_SystemReport) _then) = __$SystemReportCopyWithImpl;
@override @useResult
$Res call({
 String id, ReportCategory category, ReportSeverity severity, String title, String description, ReportStatus status, String? deviceInfo, String? appVersion, String? route, String? networkType, String? screenshotUrl, String? adminNotes, String? resolvedAt, String? resolvedBy, String createdAt, String updatedAt, ReportSubmitter user
});


@override $ReportSubmitterCopyWith<$Res> get user;

}
/// @nodoc
class __$SystemReportCopyWithImpl<$Res>
    implements _$SystemReportCopyWith<$Res> {
  __$SystemReportCopyWithImpl(this._self, this._then);

  final _SystemReport _self;
  final $Res Function(_SystemReport) _then;

/// Create a copy of SystemReport
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? category = null,Object? severity = null,Object? title = null,Object? description = null,Object? status = null,Object? deviceInfo = freezed,Object? appVersion = freezed,Object? route = freezed,Object? networkType = freezed,Object? screenshotUrl = freezed,Object? adminNotes = freezed,Object? resolvedAt = freezed,Object? resolvedBy = freezed,Object? createdAt = null,Object? updatedAt = null,Object? user = null,}) {
  return _then(_SystemReport(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as ReportCategory,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as ReportSeverity,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReportStatus,deviceInfo: freezed == deviceInfo ? _self.deviceInfo : deviceInfo // ignore: cast_nullable_to_non_nullable
as String?,appVersion: freezed == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String?,route: freezed == route ? _self.route : route // ignore: cast_nullable_to_non_nullable
as String?,networkType: freezed == networkType ? _self.networkType : networkType // ignore: cast_nullable_to_non_nullable
as String?,screenshotUrl: freezed == screenshotUrl ? _self.screenshotUrl : screenshotUrl // ignore: cast_nullable_to_non_nullable
as String?,adminNotes: freezed == adminNotes ? _self.adminNotes : adminNotes // ignore: cast_nullable_to_non_nullable
as String?,resolvedAt: freezed == resolvedAt ? _self.resolvedAt : resolvedAt // ignore: cast_nullable_to_non_nullable
as String?,resolvedBy: freezed == resolvedBy ? _self.resolvedBy : resolvedBy // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String,user: null == user ? _self.user : user // ignore: cast_nullable_to_non_nullable
as ReportSubmitter,
  ));
}

/// Create a copy of SystemReport
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ReportSubmitterCopyWith<$Res> get user {
  
  return $ReportSubmitterCopyWith<$Res>(_self.user, (value) {
    return _then(_self.copyWith(user: value));
  });
}
}


/// @nodoc
mixin _$CreateSystemReportInput {

 ReportCategory get category; ReportSeverity get severity; String get title; String get description; String? get screenshotData; String? get deviceInfo; String? get appVersion; String? get route; String? get networkType;
/// Create a copy of CreateSystemReportInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateSystemReportInputCopyWith<CreateSystemReportInput> get copyWith => _$CreateSystemReportInputCopyWithImpl<CreateSystemReportInput>(this as CreateSystemReportInput, _$identity);

  /// Serializes this CreateSystemReportInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateSystemReportInput&&(identical(other.category, category) || other.category == category)&&(identical(other.severity, severity) || other.severity == severity)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.screenshotData, screenshotData) || other.screenshotData == screenshotData)&&(identical(other.deviceInfo, deviceInfo) || other.deviceInfo == deviceInfo)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion)&&(identical(other.route, route) || other.route == route)&&(identical(other.networkType, networkType) || other.networkType == networkType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,category,severity,title,description,screenshotData,deviceInfo,appVersion,route,networkType);

@override
String toString() {
  return 'CreateSystemReportInput(category: $category, severity: $severity, title: $title, description: $description, screenshotData: $screenshotData, deviceInfo: $deviceInfo, appVersion: $appVersion, route: $route, networkType: $networkType)';
}


}

/// @nodoc
abstract mixin class $CreateSystemReportInputCopyWith<$Res>  {
  factory $CreateSystemReportInputCopyWith(CreateSystemReportInput value, $Res Function(CreateSystemReportInput) _then) = _$CreateSystemReportInputCopyWithImpl;
@useResult
$Res call({
 ReportCategory category, ReportSeverity severity, String title, String description, String? screenshotData, String? deviceInfo, String? appVersion, String? route, String? networkType
});




}
/// @nodoc
class _$CreateSystemReportInputCopyWithImpl<$Res>
    implements $CreateSystemReportInputCopyWith<$Res> {
  _$CreateSystemReportInputCopyWithImpl(this._self, this._then);

  final CreateSystemReportInput _self;
  final $Res Function(CreateSystemReportInput) _then;

/// Create a copy of CreateSystemReportInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? category = null,Object? severity = null,Object? title = null,Object? description = null,Object? screenshotData = freezed,Object? deviceInfo = freezed,Object? appVersion = freezed,Object? route = freezed,Object? networkType = freezed,}) {
  return _then(CreateSystemReportInput(
category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as ReportCategory,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as ReportSeverity,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,screenshotData: freezed == screenshotData ? _self.screenshotData : screenshotData // ignore: cast_nullable_to_non_nullable
as String?,deviceInfo: freezed == deviceInfo ? _self.deviceInfo : deviceInfo // ignore: cast_nullable_to_non_nullable
as String?,appVersion: freezed == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String?,route: freezed == route ? _self.route : route // ignore: cast_nullable_to_non_nullable
as String?,networkType: freezed == networkType ? _self.networkType : networkType // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateSystemReportInput].
extension CreateSystemReportInputPatterns on CreateSystemReportInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateSystemReportInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateSystemReportInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateSystemReportInput value)  $default,){
final _that = this;
switch (_that) {
case _CreateSystemReportInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateSystemReportInput value)?  $default,){
final _that = this;
switch (_that) {
case _CreateSystemReportInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ReportCategory category,  ReportSeverity severity,  String title,  String description,  String? screenshotData,  String? deviceInfo,  String? appVersion,  String? route,  String? networkType)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateSystemReportInput() when $default != null:
return $default(_that.category,_that.severity,_that.title,_that.description,_that.screenshotData,_that.deviceInfo,_that.appVersion,_that.route,_that.networkType);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ReportCategory category,  ReportSeverity severity,  String title,  String description,  String? screenshotData,  String? deviceInfo,  String? appVersion,  String? route,  String? networkType)  $default,) {final _that = this;
switch (_that) {
case _CreateSystemReportInput():
return $default(_that.category,_that.severity,_that.title,_that.description,_that.screenshotData,_that.deviceInfo,_that.appVersion,_that.route,_that.networkType);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ReportCategory category,  ReportSeverity severity,  String title,  String description,  String? screenshotData,  String? deviceInfo,  String? appVersion,  String? route,  String? networkType)?  $default,) {final _that = this;
switch (_that) {
case _CreateSystemReportInput() when $default != null:
return $default(_that.category,_that.severity,_that.title,_that.description,_that.screenshotData,_that.deviceInfo,_that.appVersion,_that.route,_that.networkType);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ReportCategoryConverter(), ReportSeverityConverter()])
class _CreateSystemReportInput implements CreateSystemReportInput {
  const _CreateSystemReportInput({required this.category, required this.severity, required this.title, required this.description, this.screenshotData, this.deviceInfo, this.appVersion, this.route, this.networkType});
  factory _CreateSystemReportInput.fromJson(Map<String, dynamic> json) => _$CreateSystemReportInputFromJson(json);

@override final  ReportCategory category;
@override final  ReportSeverity severity;
@override final  String title;
@override final  String description;
@override final  String? screenshotData;
@override final  String? deviceInfo;
@override final  String? appVersion;
@override final  String? route;
@override final  String? networkType;

/// Create a copy of CreateSystemReportInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateSystemReportInputCopyWith<_CreateSystemReportInput> get copyWith => __$CreateSystemReportInputCopyWithImpl<_CreateSystemReportInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateSystemReportInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateSystemReportInput&&(identical(other.category, category) || other.category == category)&&(identical(other.severity, severity) || other.severity == severity)&&(identical(other.title, title) || other.title == title)&&(identical(other.description, description) || other.description == description)&&(identical(other.screenshotData, screenshotData) || other.screenshotData == screenshotData)&&(identical(other.deviceInfo, deviceInfo) || other.deviceInfo == deviceInfo)&&(identical(other.appVersion, appVersion) || other.appVersion == appVersion)&&(identical(other.route, route) || other.route == route)&&(identical(other.networkType, networkType) || other.networkType == networkType));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,category,severity,title,description,screenshotData,deviceInfo,appVersion,route,networkType);

@override
String toString() {
  return 'CreateSystemReportInput(category: $category, severity: $severity, title: $title, description: $description, screenshotData: $screenshotData, deviceInfo: $deviceInfo, appVersion: $appVersion, route: $route, networkType: $networkType)';
}


}

/// @nodoc
abstract mixin class _$CreateSystemReportInputCopyWith<$Res> implements $CreateSystemReportInputCopyWith<$Res> {
  factory _$CreateSystemReportInputCopyWith(_CreateSystemReportInput value, $Res Function(_CreateSystemReportInput) _then) = __$CreateSystemReportInputCopyWithImpl;
@override @useResult
$Res call({
 ReportCategory category, ReportSeverity severity, String title, String description, String? screenshotData, String? deviceInfo, String? appVersion, String? route, String? networkType
});




}
/// @nodoc
class __$CreateSystemReportInputCopyWithImpl<$Res>
    implements _$CreateSystemReportInputCopyWith<$Res> {
  __$CreateSystemReportInputCopyWithImpl(this._self, this._then);

  final _CreateSystemReportInput _self;
  final $Res Function(_CreateSystemReportInput) _then;

/// Create a copy of CreateSystemReportInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? category = null,Object? severity = null,Object? title = null,Object? description = null,Object? screenshotData = freezed,Object? deviceInfo = freezed,Object? appVersion = freezed,Object? route = freezed,Object? networkType = freezed,}) {
  return _then(_CreateSystemReportInput(
category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as ReportCategory,severity: null == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as ReportSeverity,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,description: null == description ? _self.description : description // ignore: cast_nullable_to_non_nullable
as String,screenshotData: freezed == screenshotData ? _self.screenshotData : screenshotData // ignore: cast_nullable_to_non_nullable
as String?,deviceInfo: freezed == deviceInfo ? _self.deviceInfo : deviceInfo // ignore: cast_nullable_to_non_nullable
as String?,appVersion: freezed == appVersion ? _self.appVersion : appVersion // ignore: cast_nullable_to_non_nullable
as String?,route: freezed == route ? _self.route : route // ignore: cast_nullable_to_non_nullable
as String?,networkType: freezed == networkType ? _self.networkType : networkType // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$UpdateSystemReportStatusInput {

 ReportStatus get status; String? get adminNotes;
/// Create a copy of UpdateSystemReportStatusInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UpdateSystemReportStatusInputCopyWith<UpdateSystemReportStatusInput> get copyWith => _$UpdateSystemReportStatusInputCopyWithImpl<UpdateSystemReportStatusInput>(this as UpdateSystemReportStatusInput, _$identity);

  /// Serializes this UpdateSystemReportStatusInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UpdateSystemReportStatusInput&&(identical(other.status, status) || other.status == status)&&(identical(other.adminNotes, adminNotes) || other.adminNotes == adminNotes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,adminNotes);

@override
String toString() {
  return 'UpdateSystemReportStatusInput(status: $status, adminNotes: $adminNotes)';
}


}

/// @nodoc
abstract mixin class $UpdateSystemReportStatusInputCopyWith<$Res>  {
  factory $UpdateSystemReportStatusInputCopyWith(UpdateSystemReportStatusInput value, $Res Function(UpdateSystemReportStatusInput) _then) = _$UpdateSystemReportStatusInputCopyWithImpl;
@useResult
$Res call({
 ReportStatus status, String? adminNotes
});




}
/// @nodoc
class _$UpdateSystemReportStatusInputCopyWithImpl<$Res>
    implements $UpdateSystemReportStatusInputCopyWith<$Res> {
  _$UpdateSystemReportStatusInputCopyWithImpl(this._self, this._then);

  final UpdateSystemReportStatusInput _self;
  final $Res Function(UpdateSystemReportStatusInput) _then;

/// Create a copy of UpdateSystemReportStatusInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? adminNotes = freezed,}) {
  return _then(UpdateSystemReportStatusInput(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReportStatus,adminNotes: freezed == adminNotes ? _self.adminNotes : adminNotes // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [UpdateSystemReportStatusInput].
extension UpdateSystemReportStatusInputPatterns on UpdateSystemReportStatusInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UpdateSystemReportStatusInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UpdateSystemReportStatusInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UpdateSystemReportStatusInput value)  $default,){
final _that = this;
switch (_that) {
case _UpdateSystemReportStatusInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UpdateSystemReportStatusInput value)?  $default,){
final _that = this;
switch (_that) {
case _UpdateSystemReportStatusInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ReportStatus status,  String? adminNotes)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UpdateSystemReportStatusInput() when $default != null:
return $default(_that.status,_that.adminNotes);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ReportStatus status,  String? adminNotes)  $default,) {final _that = this;
switch (_that) {
case _UpdateSystemReportStatusInput():
return $default(_that.status,_that.adminNotes);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ReportStatus status,  String? adminNotes)?  $default,) {final _that = this;
switch (_that) {
case _UpdateSystemReportStatusInput() when $default != null:
return $default(_that.status,_that.adminNotes);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ReportStatusConverter()])
class _UpdateSystemReportStatusInput implements UpdateSystemReportStatusInput {
  const _UpdateSystemReportStatusInput({required this.status, this.adminNotes});
  factory _UpdateSystemReportStatusInput.fromJson(Map<String, dynamic> json) => _$UpdateSystemReportStatusInputFromJson(json);

@override final  ReportStatus status;
@override final  String? adminNotes;

/// Create a copy of UpdateSystemReportStatusInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UpdateSystemReportStatusInputCopyWith<_UpdateSystemReportStatusInput> get copyWith => __$UpdateSystemReportStatusInputCopyWithImpl<_UpdateSystemReportStatusInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UpdateSystemReportStatusInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UpdateSystemReportStatusInput&&(identical(other.status, status) || other.status == status)&&(identical(other.adminNotes, adminNotes) || other.adminNotes == adminNotes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,adminNotes);

@override
String toString() {
  return 'UpdateSystemReportStatusInput(status: $status, adminNotes: $adminNotes)';
}


}

/// @nodoc
abstract mixin class _$UpdateSystemReportStatusInputCopyWith<$Res> implements $UpdateSystemReportStatusInputCopyWith<$Res> {
  factory _$UpdateSystemReportStatusInputCopyWith(_UpdateSystemReportStatusInput value, $Res Function(_UpdateSystemReportStatusInput) _then) = __$UpdateSystemReportStatusInputCopyWithImpl;
@override @useResult
$Res call({
 ReportStatus status, String? adminNotes
});




}
/// @nodoc
class __$UpdateSystemReportStatusInputCopyWithImpl<$Res>
    implements _$UpdateSystemReportStatusInputCopyWith<$Res> {
  __$UpdateSystemReportStatusInputCopyWithImpl(this._self, this._then);

  final _UpdateSystemReportStatusInput _self;
  final $Res Function(_UpdateSystemReportStatusInput) _then;

/// Create a copy of UpdateSystemReportStatusInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? adminNotes = freezed,}) {
  return _then(_UpdateSystemReportStatusInput(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReportStatus,adminNotes: freezed == adminNotes ? _self.adminNotes : adminNotes // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SystemReportFilters {

 ReportCategory? get category; ReportSeverity? get severity; ReportStatus? get status; String? get role; String? get search; String? get startDate; String? get endDate; int? get limit; int? get offset;
/// Create a copy of SystemReportFilters
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SystemReportFiltersCopyWith<SystemReportFilters> get copyWith => _$SystemReportFiltersCopyWithImpl<SystemReportFilters>(this as SystemReportFilters, _$identity);

  /// Serializes this SystemReportFilters to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SystemReportFilters&&(identical(other.category, category) || other.category == category)&&(identical(other.severity, severity) || other.severity == severity)&&(identical(other.status, status) || other.status == status)&&(identical(other.role, role) || other.role == role)&&(identical(other.search, search) || other.search == search)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.offset, offset) || other.offset == offset));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,category,severity,status,role,search,startDate,endDate,limit,offset);

@override
String toString() {
  return 'SystemReportFilters(category: $category, severity: $severity, status: $status, role: $role, search: $search, startDate: $startDate, endDate: $endDate, limit: $limit, offset: $offset)';
}


}

/// @nodoc
abstract mixin class $SystemReportFiltersCopyWith<$Res>  {
  factory $SystemReportFiltersCopyWith(SystemReportFilters value, $Res Function(SystemReportFilters) _then) = _$SystemReportFiltersCopyWithImpl;
@useResult
$Res call({
 ReportCategory? category, ReportSeverity? severity, ReportStatus? status, String? role, String? search, String? startDate, String? endDate, int? limit, int? offset
});




}
/// @nodoc
class _$SystemReportFiltersCopyWithImpl<$Res>
    implements $SystemReportFiltersCopyWith<$Res> {
  _$SystemReportFiltersCopyWithImpl(this._self, this._then);

  final SystemReportFilters _self;
  final $Res Function(SystemReportFilters) _then;

/// Create a copy of SystemReportFilters
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? category = freezed,Object? severity = freezed,Object? status = freezed,Object? role = freezed,Object? search = freezed,Object? startDate = freezed,Object? endDate = freezed,Object? limit = freezed,Object? offset = freezed,}) {
  return _then(SystemReportFilters(
category: freezed == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as ReportCategory?,severity: freezed == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as ReportSeverity?,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReportStatus?,role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String?,search: freezed == search ? _self.search : search // ignore: cast_nullable_to_non_nullable
as String?,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,limit: freezed == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int?,offset: freezed == offset ? _self.offset : offset // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [SystemReportFilters].
extension SystemReportFiltersPatterns on SystemReportFilters {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SystemReportFilters value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SystemReportFilters() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SystemReportFilters value)  $default,){
final _that = this;
switch (_that) {
case _SystemReportFilters():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SystemReportFilters value)?  $default,){
final _that = this;
switch (_that) {
case _SystemReportFilters() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ReportCategory? category,  ReportSeverity? severity,  ReportStatus? status,  String? role,  String? search,  String? startDate,  String? endDate,  int? limit,  int? offset)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SystemReportFilters() when $default != null:
return $default(_that.category,_that.severity,_that.status,_that.role,_that.search,_that.startDate,_that.endDate,_that.limit,_that.offset);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ReportCategory? category,  ReportSeverity? severity,  ReportStatus? status,  String? role,  String? search,  String? startDate,  String? endDate,  int? limit,  int? offset)  $default,) {final _that = this;
switch (_that) {
case _SystemReportFilters():
return $default(_that.category,_that.severity,_that.status,_that.role,_that.search,_that.startDate,_that.endDate,_that.limit,_that.offset);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ReportCategory? category,  ReportSeverity? severity,  ReportStatus? status,  String? role,  String? search,  String? startDate,  String? endDate,  int? limit,  int? offset)?  $default,) {final _that = this;
switch (_that) {
case _SystemReportFilters() when $default != null:
return $default(_that.category,_that.severity,_that.status,_that.role,_that.search,_that.startDate,_that.endDate,_that.limit,_that.offset);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [ReportCategoryConverter(), ReportSeverityConverter(), ReportStatusConverter()])
class _SystemReportFilters implements SystemReportFilters {
  const _SystemReportFilters({this.category, this.severity, this.status, this.role, this.search, this.startDate, this.endDate, this.limit, this.offset});
  factory _SystemReportFilters.fromJson(Map<String, dynamic> json) => _$SystemReportFiltersFromJson(json);

@override final  ReportCategory? category;
@override final  ReportSeverity? severity;
@override final  ReportStatus? status;
@override final  String? role;
@override final  String? search;
@override final  String? startDate;
@override final  String? endDate;
@override final  int? limit;
@override final  int? offset;

/// Create a copy of SystemReportFilters
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SystemReportFiltersCopyWith<_SystemReportFilters> get copyWith => __$SystemReportFiltersCopyWithImpl<_SystemReportFilters>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SystemReportFiltersToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SystemReportFilters&&(identical(other.category, category) || other.category == category)&&(identical(other.severity, severity) || other.severity == severity)&&(identical(other.status, status) || other.status == status)&&(identical(other.role, role) || other.role == role)&&(identical(other.search, search) || other.search == search)&&(identical(other.startDate, startDate) || other.startDate == startDate)&&(identical(other.endDate, endDate) || other.endDate == endDate)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.offset, offset) || other.offset == offset));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,category,severity,status,role,search,startDate,endDate,limit,offset);

@override
String toString() {
  return 'SystemReportFilters(category: $category, severity: $severity, status: $status, role: $role, search: $search, startDate: $startDate, endDate: $endDate, limit: $limit, offset: $offset)';
}


}

/// @nodoc
abstract mixin class _$SystemReportFiltersCopyWith<$Res> implements $SystemReportFiltersCopyWith<$Res> {
  factory _$SystemReportFiltersCopyWith(_SystemReportFilters value, $Res Function(_SystemReportFilters) _then) = __$SystemReportFiltersCopyWithImpl;
@override @useResult
$Res call({
 ReportCategory? category, ReportSeverity? severity, ReportStatus? status, String? role, String? search, String? startDate, String? endDate, int? limit, int? offset
});




}
/// @nodoc
class __$SystemReportFiltersCopyWithImpl<$Res>
    implements _$SystemReportFiltersCopyWith<$Res> {
  __$SystemReportFiltersCopyWithImpl(this._self, this._then);

  final _SystemReportFilters _self;
  final $Res Function(_SystemReportFilters) _then;

/// Create a copy of SystemReportFilters
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? category = freezed,Object? severity = freezed,Object? status = freezed,Object? role = freezed,Object? search = freezed,Object? startDate = freezed,Object? endDate = freezed,Object? limit = freezed,Object? offset = freezed,}) {
  return _then(_SystemReportFilters(
category: freezed == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as ReportCategory?,severity: freezed == severity ? _self.severity : severity // ignore: cast_nullable_to_non_nullable
as ReportSeverity?,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ReportStatus?,role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String?,search: freezed == search ? _self.search : search // ignore: cast_nullable_to_non_nullable
as String?,startDate: freezed == startDate ? _self.startDate : startDate // ignore: cast_nullable_to_non_nullable
as String?,endDate: freezed == endDate ? _self.endDate : endDate // ignore: cast_nullable_to_non_nullable
as String?,limit: freezed == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int?,offset: freezed == offset ? _self.offset : offset // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$SystemReportPage {

 List<SystemReport> get data; int get total; int get limit; int get offset; bool get hasMore;
/// Create a copy of SystemReportPage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SystemReportPageCopyWith<SystemReportPage> get copyWith => _$SystemReportPageCopyWithImpl<SystemReportPage>(this as SystemReportPage, _$identity);

  /// Serializes this SystemReportPage to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SystemReportPage&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.total, total) || other.total == total)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.offset, offset) || other.offset == offset)&&(identical(other.hasMore, hasMore) || other.hasMore == hasMore));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(data),total,limit,offset,hasMore);

@override
String toString() {
  return 'SystemReportPage(data: $data, total: $total, limit: $limit, offset: $offset, hasMore: $hasMore)';
}


}

/// @nodoc
abstract mixin class $SystemReportPageCopyWith<$Res>  {
  factory $SystemReportPageCopyWith(SystemReportPage value, $Res Function(SystemReportPage) _then) = _$SystemReportPageCopyWithImpl;
@useResult
$Res call({
 List<SystemReport> data, int total, int limit, int offset, bool hasMore
});




}
/// @nodoc
class _$SystemReportPageCopyWithImpl<$Res>
    implements $SystemReportPageCopyWith<$Res> {
  _$SystemReportPageCopyWithImpl(this._self, this._then);

  final SystemReportPage _self;
  final $Res Function(SystemReportPage) _then;

/// Create a copy of SystemReportPage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? total = null,Object? limit = null,Object? offset = null,Object? hasMore = null,}) {
  return _then(SystemReportPage(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as List<SystemReport>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,limit: null == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int,offset: null == offset ? _self.offset : offset // ignore: cast_nullable_to_non_nullable
as int,hasMore: null == hasMore ? _self.hasMore : hasMore // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SystemReportPage].
extension SystemReportPagePatterns on SystemReportPage {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SystemReportPage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SystemReportPage() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SystemReportPage value)  $default,){
final _that = this;
switch (_that) {
case _SystemReportPage():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SystemReportPage value)?  $default,){
final _that = this;
switch (_that) {
case _SystemReportPage() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<SystemReport> data,  int total,  int limit,  int offset,  bool hasMore)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SystemReportPage() when $default != null:
return $default(_that.data,_that.total,_that.limit,_that.offset,_that.hasMore);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<SystemReport> data,  int total,  int limit,  int offset,  bool hasMore)  $default,) {final _that = this;
switch (_that) {
case _SystemReportPage():
return $default(_that.data,_that.total,_that.limit,_that.offset,_that.hasMore);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<SystemReport> data,  int total,  int limit,  int offset,  bool hasMore)?  $default,) {final _that = this;
switch (_that) {
case _SystemReportPage() when $default != null:
return $default(_that.data,_that.total,_that.limit,_that.offset,_that.hasMore);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _SystemReportPage implements SystemReportPage {
  const _SystemReportPage({ List<SystemReport> data = const <SystemReport>[], this.total = 0, this.limit = 0, this.offset = 0, this.hasMore = false}): _data = data;
  factory _SystemReportPage.fromJson(Map<String, dynamic> json) => _$SystemReportPageFromJson(json);

 final  List<SystemReport> _data;
@override@JsonKey() List<SystemReport> get data {
  if (_data is EqualUnmodifiableListView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_data);
}

@override@JsonKey() final  int total;
@override@JsonKey() final  int limit;
@override@JsonKey() final  int offset;
@override@JsonKey() final  bool hasMore;

/// Create a copy of SystemReportPage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SystemReportPageCopyWith<_SystemReportPage> get copyWith => __$SystemReportPageCopyWithImpl<_SystemReportPage>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SystemReportPageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SystemReportPage&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.total, total) || other.total == total)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.offset, offset) || other.offset == offset)&&(identical(other.hasMore, hasMore) || other.hasMore == hasMore));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_data),total,limit,offset,hasMore);

@override
String toString() {
  return 'SystemReportPage(data: $data, total: $total, limit: $limit, offset: $offset, hasMore: $hasMore)';
}


}

/// @nodoc
abstract mixin class _$SystemReportPageCopyWith<$Res> implements $SystemReportPageCopyWith<$Res> {
  factory _$SystemReportPageCopyWith(_SystemReportPage value, $Res Function(_SystemReportPage) _then) = __$SystemReportPageCopyWithImpl;
@override @useResult
$Res call({
 List<SystemReport> data, int total, int limit, int offset, bool hasMore
});




}
/// @nodoc
class __$SystemReportPageCopyWithImpl<$Res>
    implements _$SystemReportPageCopyWith<$Res> {
  __$SystemReportPageCopyWithImpl(this._self, this._then);

  final _SystemReportPage _self;
  final $Res Function(_SystemReportPage) _then;

/// Create a copy of SystemReportPage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? total = null,Object? limit = null,Object? offset = null,Object? hasMore = null,}) {
  return _then(_SystemReportPage(
data: null == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as List<SystemReport>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,limit: null == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int,offset: null == offset ? _self.offset : offset // ignore: cast_nullable_to_non_nullable
as int,hasMore: null == hasMore ? _self.hasMore : hasMore // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$SystemReportStats {

 int get total; int get open; int get inReview; int get resolved; int get dismissed; int get scannerAndGps; int get resolvedThisMonth; int get critical;
/// Create a copy of SystemReportStats
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SystemReportStatsCopyWith<SystemReportStats> get copyWith => _$SystemReportStatsCopyWithImpl<SystemReportStats>(this as SystemReportStats, _$identity);

  /// Serializes this SystemReportStats to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SystemReportStats&&(identical(other.total, total) || other.total == total)&&(identical(other.open, open) || other.open == open)&&(identical(other.inReview, inReview) || other.inReview == inReview)&&(identical(other.resolved, resolved) || other.resolved == resolved)&&(identical(other.dismissed, dismissed) || other.dismissed == dismissed)&&(identical(other.scannerAndGps, scannerAndGps) || other.scannerAndGps == scannerAndGps)&&(identical(other.resolvedThisMonth, resolvedThisMonth) || other.resolvedThisMonth == resolvedThisMonth)&&(identical(other.critical, critical) || other.critical == critical));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,total,open,inReview,resolved,dismissed,scannerAndGps,resolvedThisMonth,critical);

@override
String toString() {
  return 'SystemReportStats(total: $total, open: $open, inReview: $inReview, resolved: $resolved, dismissed: $dismissed, scannerAndGps: $scannerAndGps, resolvedThisMonth: $resolvedThisMonth, critical: $critical)';
}


}

/// @nodoc
abstract mixin class $SystemReportStatsCopyWith<$Res>  {
  factory $SystemReportStatsCopyWith(SystemReportStats value, $Res Function(SystemReportStats) _then) = _$SystemReportStatsCopyWithImpl;
@useResult
$Res call({
 int total, int open, int inReview, int resolved, int dismissed, int scannerAndGps, int resolvedThisMonth, int critical
});




}
/// @nodoc
class _$SystemReportStatsCopyWithImpl<$Res>
    implements $SystemReportStatsCopyWith<$Res> {
  _$SystemReportStatsCopyWithImpl(this._self, this._then);

  final SystemReportStats _self;
  final $Res Function(SystemReportStats) _then;

/// Create a copy of SystemReportStats
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? total = null,Object? open = null,Object? inReview = null,Object? resolved = null,Object? dismissed = null,Object? scannerAndGps = null,Object? resolvedThisMonth = null,Object? critical = null,}) {
  return _then(SystemReportStats(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,open: null == open ? _self.open : open // ignore: cast_nullable_to_non_nullable
as int,inReview: null == inReview ? _self.inReview : inReview // ignore: cast_nullable_to_non_nullable
as int,resolved: null == resolved ? _self.resolved : resolved // ignore: cast_nullable_to_non_nullable
as int,dismissed: null == dismissed ? _self.dismissed : dismissed // ignore: cast_nullable_to_non_nullable
as int,scannerAndGps: null == scannerAndGps ? _self.scannerAndGps : scannerAndGps // ignore: cast_nullable_to_non_nullable
as int,resolvedThisMonth: null == resolvedThisMonth ? _self.resolvedThisMonth : resolvedThisMonth // ignore: cast_nullable_to_non_nullable
as int,critical: null == critical ? _self.critical : critical // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [SystemReportStats].
extension SystemReportStatsPatterns on SystemReportStats {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SystemReportStats value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SystemReportStats() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SystemReportStats value)  $default,){
final _that = this;
switch (_that) {
case _SystemReportStats():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SystemReportStats value)?  $default,){
final _that = this;
switch (_that) {
case _SystemReportStats() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int total,  int open,  int inReview,  int resolved,  int dismissed,  int scannerAndGps,  int resolvedThisMonth,  int critical)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SystemReportStats() when $default != null:
return $default(_that.total,_that.open,_that.inReview,_that.resolved,_that.dismissed,_that.scannerAndGps,_that.resolvedThisMonth,_that.critical);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int total,  int open,  int inReview,  int resolved,  int dismissed,  int scannerAndGps,  int resolvedThisMonth,  int critical)  $default,) {final _that = this;
switch (_that) {
case _SystemReportStats():
return $default(_that.total,_that.open,_that.inReview,_that.resolved,_that.dismissed,_that.scannerAndGps,_that.resolvedThisMonth,_that.critical);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int total,  int open,  int inReview,  int resolved,  int dismissed,  int scannerAndGps,  int resolvedThisMonth,  int critical)?  $default,) {final _that = this;
switch (_that) {
case _SystemReportStats() when $default != null:
return $default(_that.total,_that.open,_that.inReview,_that.resolved,_that.dismissed,_that.scannerAndGps,_that.resolvedThisMonth,_that.critical);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _SystemReportStats implements SystemReportStats {
  const _SystemReportStats({this.total = 0, this.open = 0, this.inReview = 0, this.resolved = 0, this.dismissed = 0, this.scannerAndGps = 0, this.resolvedThisMonth = 0, this.critical = 0});
  factory _SystemReportStats.fromJson(Map<String, dynamic> json) => _$SystemReportStatsFromJson(json);

@override@JsonKey() final  int total;
@override@JsonKey() final  int open;
@override@JsonKey() final  int inReview;
@override@JsonKey() final  int resolved;
@override@JsonKey() final  int dismissed;
@override@JsonKey() final  int scannerAndGps;
@override@JsonKey() final  int resolvedThisMonth;
@override@JsonKey() final  int critical;

/// Create a copy of SystemReportStats
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SystemReportStatsCopyWith<_SystemReportStats> get copyWith => __$SystemReportStatsCopyWithImpl<_SystemReportStats>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SystemReportStatsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SystemReportStats&&(identical(other.total, total) || other.total == total)&&(identical(other.open, open) || other.open == open)&&(identical(other.inReview, inReview) || other.inReview == inReview)&&(identical(other.resolved, resolved) || other.resolved == resolved)&&(identical(other.dismissed, dismissed) || other.dismissed == dismissed)&&(identical(other.scannerAndGps, scannerAndGps) || other.scannerAndGps == scannerAndGps)&&(identical(other.resolvedThisMonth, resolvedThisMonth) || other.resolvedThisMonth == resolvedThisMonth)&&(identical(other.critical, critical) || other.critical == critical));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,total,open,inReview,resolved,dismissed,scannerAndGps,resolvedThisMonth,critical);

@override
String toString() {
  return 'SystemReportStats(total: $total, open: $open, inReview: $inReview, resolved: $resolved, dismissed: $dismissed, scannerAndGps: $scannerAndGps, resolvedThisMonth: $resolvedThisMonth, critical: $critical)';
}


}

/// @nodoc
abstract mixin class _$SystemReportStatsCopyWith<$Res> implements $SystemReportStatsCopyWith<$Res> {
  factory _$SystemReportStatsCopyWith(_SystemReportStats value, $Res Function(_SystemReportStats) _then) = __$SystemReportStatsCopyWithImpl;
@override @useResult
$Res call({
 int total, int open, int inReview, int resolved, int dismissed, int scannerAndGps, int resolvedThisMonth, int critical
});




}
/// @nodoc
class __$SystemReportStatsCopyWithImpl<$Res>
    implements _$SystemReportStatsCopyWith<$Res> {
  __$SystemReportStatsCopyWithImpl(this._self, this._then);

  final _SystemReportStats _self;
  final $Res Function(_SystemReportStats) _then;

/// Create a copy of SystemReportStats
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? total = null,Object? open = null,Object? inReview = null,Object? resolved = null,Object? dismissed = null,Object? scannerAndGps = null,Object? resolvedThisMonth = null,Object? critical = null,}) {
  return _then(_SystemReportStats(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,open: null == open ? _self.open : open // ignore: cast_nullable_to_non_nullable
as int,inReview: null == inReview ? _self.inReview : inReview // ignore: cast_nullable_to_non_nullable
as int,resolved: null == resolved ? _self.resolved : resolved // ignore: cast_nullable_to_non_nullable
as int,dismissed: null == dismissed ? _self.dismissed : dismissed // ignore: cast_nullable_to_non_nullable
as int,scannerAndGps: null == scannerAndGps ? _self.scannerAndGps : scannerAndGps // ignore: cast_nullable_to_non_nullable
as int,resolvedThisMonth: null == resolvedThisMonth ? _self.resolvedThisMonth : resolvedThisMonth // ignore: cast_nullable_to_non_nullable
as int,critical: null == critical ? _self.critical : critical // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
