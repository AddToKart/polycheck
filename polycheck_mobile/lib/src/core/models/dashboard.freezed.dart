// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$AdminOverviewHealth {

 AdminOverviewHealthStatus get status; String get timestamp; bool get database; bool get redis;
/// Create a copy of AdminOverviewHealth
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AdminOverviewHealthCopyWith<AdminOverviewHealth> get copyWith => _$AdminOverviewHealthCopyWithImpl<AdminOverviewHealth>(this as AdminOverviewHealth, _$identity);

  /// Serializes this AdminOverviewHealth to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AdminOverviewHealth&&(identical(other.status, status) || other.status == status)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.database, database) || other.database == database)&&(identical(other.redis, redis) || other.redis == redis));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,timestamp,database,redis);

@override
String toString() {
  return 'AdminOverviewHealth(status: $status, timestamp: $timestamp, database: $database, redis: $redis)';
}


}

/// @nodoc
abstract mixin class $AdminOverviewHealthCopyWith<$Res>  {
  factory $AdminOverviewHealthCopyWith(AdminOverviewHealth value, $Res Function(AdminOverviewHealth) _then) = _$AdminOverviewHealthCopyWithImpl;
@useResult
$Res call({
 AdminOverviewHealthStatus status, String timestamp, bool database, bool redis
});




}
/// @nodoc
class _$AdminOverviewHealthCopyWithImpl<$Res>
    implements $AdminOverviewHealthCopyWith<$Res> {
  _$AdminOverviewHealthCopyWithImpl(this._self, this._then);

  final AdminOverviewHealth _self;
  final $Res Function(AdminOverviewHealth) _then;

/// Create a copy of AdminOverviewHealth
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? timestamp = null,Object? database = null,Object? redis = null,}) {
  return _then(AdminOverviewHealth(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AdminOverviewHealthStatus,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,database: null == database ? _self.database : database // ignore: cast_nullable_to_non_nullable
as bool,redis: null == redis ? _self.redis : redis // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [AdminOverviewHealth].
extension AdminOverviewHealthPatterns on AdminOverviewHealth {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AdminOverviewHealth value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AdminOverviewHealth() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AdminOverviewHealth value)  $default,){
final _that = this;
switch (_that) {
case _AdminOverviewHealth():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AdminOverviewHealth value)?  $default,){
final _that = this;
switch (_that) {
case _AdminOverviewHealth() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( AdminOverviewHealthStatus status,  String timestamp,  bool database,  bool redis)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AdminOverviewHealth() when $default != null:
return $default(_that.status,_that.timestamp,_that.database,_that.redis);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( AdminOverviewHealthStatus status,  String timestamp,  bool database,  bool redis)  $default,) {final _that = this;
switch (_that) {
case _AdminOverviewHealth():
return $default(_that.status,_that.timestamp,_that.database,_that.redis);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( AdminOverviewHealthStatus status,  String timestamp,  bool database,  bool redis)?  $default,) {final _that = this;
switch (_that) {
case _AdminOverviewHealth() when $default != null:
return $default(_that.status,_that.timestamp,_that.database,_that.redis);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AdminOverviewHealthStatusConverter()])
class _AdminOverviewHealth implements AdminOverviewHealth {
  const _AdminOverviewHealth({required this.status, required this.timestamp, this.database = false, this.redis = false});
  factory _AdminOverviewHealth.fromJson(Map<String, dynamic> json) => _$AdminOverviewHealthFromJson(json);

@override final  AdminOverviewHealthStatus status;
@override final  String timestamp;
@override@JsonKey() final  bool database;
@override@JsonKey() final  bool redis;

/// Create a copy of AdminOverviewHealth
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AdminOverviewHealthCopyWith<_AdminOverviewHealth> get copyWith => __$AdminOverviewHealthCopyWithImpl<_AdminOverviewHealth>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AdminOverviewHealthToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AdminOverviewHealth&&(identical(other.status, status) || other.status == status)&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.database, database) || other.database == database)&&(identical(other.redis, redis) || other.redis == redis));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,timestamp,database,redis);

@override
String toString() {
  return 'AdminOverviewHealth(status: $status, timestamp: $timestamp, database: $database, redis: $redis)';
}


}

/// @nodoc
abstract mixin class _$AdminOverviewHealthCopyWith<$Res> implements $AdminOverviewHealthCopyWith<$Res> {
  factory _$AdminOverviewHealthCopyWith(_AdminOverviewHealth value, $Res Function(_AdminOverviewHealth) _then) = __$AdminOverviewHealthCopyWithImpl;
@override @useResult
$Res call({
 AdminOverviewHealthStatus status, String timestamp, bool database, bool redis
});




}
/// @nodoc
class __$AdminOverviewHealthCopyWithImpl<$Res>
    implements _$AdminOverviewHealthCopyWith<$Res> {
  __$AdminOverviewHealthCopyWithImpl(this._self, this._then);

  final _AdminOverviewHealth _self;
  final $Res Function(_AdminOverviewHealth) _then;

/// Create a copy of AdminOverviewHealth
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? timestamp = null,Object? database = null,Object? redis = null,}) {
  return _then(_AdminOverviewHealth(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AdminOverviewHealthStatus,timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,database: null == database ? _self.database : database // ignore: cast_nullable_to_non_nullable
as bool,redis: null == redis ? _self.redis : redis // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$AdminOverviewCounts {

 int get activeFaculty; int get disabledFaculty; int get activeStudents; int get disabledStudents; int get activeSessions; int get pendingDisputes;
/// Create a copy of AdminOverviewCounts
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AdminOverviewCountsCopyWith<AdminOverviewCounts> get copyWith => _$AdminOverviewCountsCopyWithImpl<AdminOverviewCounts>(this as AdminOverviewCounts, _$identity);

  /// Serializes this AdminOverviewCounts to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AdminOverviewCounts&&(identical(other.activeFaculty, activeFaculty) || other.activeFaculty == activeFaculty)&&(identical(other.disabledFaculty, disabledFaculty) || other.disabledFaculty == disabledFaculty)&&(identical(other.activeStudents, activeStudents) || other.activeStudents == activeStudents)&&(identical(other.disabledStudents, disabledStudents) || other.disabledStudents == disabledStudents)&&(identical(other.activeSessions, activeSessions) || other.activeSessions == activeSessions)&&(identical(other.pendingDisputes, pendingDisputes) || other.pendingDisputes == pendingDisputes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activeFaculty,disabledFaculty,activeStudents,disabledStudents,activeSessions,pendingDisputes);

@override
String toString() {
  return 'AdminOverviewCounts(activeFaculty: $activeFaculty, disabledFaculty: $disabledFaculty, activeStudents: $activeStudents, disabledStudents: $disabledStudents, activeSessions: $activeSessions, pendingDisputes: $pendingDisputes)';
}


}

/// @nodoc
abstract mixin class $AdminOverviewCountsCopyWith<$Res>  {
  factory $AdminOverviewCountsCopyWith(AdminOverviewCounts value, $Res Function(AdminOverviewCounts) _then) = _$AdminOverviewCountsCopyWithImpl;
@useResult
$Res call({
 int activeFaculty, int disabledFaculty, int activeStudents, int disabledStudents, int activeSessions, int pendingDisputes
});




}
/// @nodoc
class _$AdminOverviewCountsCopyWithImpl<$Res>
    implements $AdminOverviewCountsCopyWith<$Res> {
  _$AdminOverviewCountsCopyWithImpl(this._self, this._then);

  final AdminOverviewCounts _self;
  final $Res Function(AdminOverviewCounts) _then;

/// Create a copy of AdminOverviewCounts
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? activeFaculty = null,Object? disabledFaculty = null,Object? activeStudents = null,Object? disabledStudents = null,Object? activeSessions = null,Object? pendingDisputes = null,}) {
  return _then(AdminOverviewCounts(
activeFaculty: null == activeFaculty ? _self.activeFaculty : activeFaculty // ignore: cast_nullable_to_non_nullable
as int,disabledFaculty: null == disabledFaculty ? _self.disabledFaculty : disabledFaculty // ignore: cast_nullable_to_non_nullable
as int,activeStudents: null == activeStudents ? _self.activeStudents : activeStudents // ignore: cast_nullable_to_non_nullable
as int,disabledStudents: null == disabledStudents ? _self.disabledStudents : disabledStudents // ignore: cast_nullable_to_non_nullable
as int,activeSessions: null == activeSessions ? _self.activeSessions : activeSessions // ignore: cast_nullable_to_non_nullable
as int,pendingDisputes: null == pendingDisputes ? _self.pendingDisputes : pendingDisputes // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [AdminOverviewCounts].
extension AdminOverviewCountsPatterns on AdminOverviewCounts {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AdminOverviewCounts value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AdminOverviewCounts() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AdminOverviewCounts value)  $default,){
final _that = this;
switch (_that) {
case _AdminOverviewCounts():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AdminOverviewCounts value)?  $default,){
final _that = this;
switch (_that) {
case _AdminOverviewCounts() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int activeFaculty,  int disabledFaculty,  int activeStudents,  int disabledStudents,  int activeSessions,  int pendingDisputes)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AdminOverviewCounts() when $default != null:
return $default(_that.activeFaculty,_that.disabledFaculty,_that.activeStudents,_that.disabledStudents,_that.activeSessions,_that.pendingDisputes);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int activeFaculty,  int disabledFaculty,  int activeStudents,  int disabledStudents,  int activeSessions,  int pendingDisputes)  $default,) {final _that = this;
switch (_that) {
case _AdminOverviewCounts():
return $default(_that.activeFaculty,_that.disabledFaculty,_that.activeStudents,_that.disabledStudents,_that.activeSessions,_that.pendingDisputes);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int activeFaculty,  int disabledFaculty,  int activeStudents,  int disabledStudents,  int activeSessions,  int pendingDisputes)?  $default,) {final _that = this;
switch (_that) {
case _AdminOverviewCounts() when $default != null:
return $default(_that.activeFaculty,_that.disabledFaculty,_that.activeStudents,_that.disabledStudents,_that.activeSessions,_that.pendingDisputes);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AdminOverviewCounts implements AdminOverviewCounts {
  const _AdminOverviewCounts({this.activeFaculty = 0, this.disabledFaculty = 0, this.activeStudents = 0, this.disabledStudents = 0, this.activeSessions = 0, this.pendingDisputes = 0});
  factory _AdminOverviewCounts.fromJson(Map<String, dynamic> json) => _$AdminOverviewCountsFromJson(json);

@override@JsonKey() final  int activeFaculty;
@override@JsonKey() final  int disabledFaculty;
@override@JsonKey() final  int activeStudents;
@override@JsonKey() final  int disabledStudents;
@override@JsonKey() final  int activeSessions;
@override@JsonKey() final  int pendingDisputes;

/// Create a copy of AdminOverviewCounts
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AdminOverviewCountsCopyWith<_AdminOverviewCounts> get copyWith => __$AdminOverviewCountsCopyWithImpl<_AdminOverviewCounts>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AdminOverviewCountsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AdminOverviewCounts&&(identical(other.activeFaculty, activeFaculty) || other.activeFaculty == activeFaculty)&&(identical(other.disabledFaculty, disabledFaculty) || other.disabledFaculty == disabledFaculty)&&(identical(other.activeStudents, activeStudents) || other.activeStudents == activeStudents)&&(identical(other.disabledStudents, disabledStudents) || other.disabledStudents == disabledStudents)&&(identical(other.activeSessions, activeSessions) || other.activeSessions == activeSessions)&&(identical(other.pendingDisputes, pendingDisputes) || other.pendingDisputes == pendingDisputes));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,activeFaculty,disabledFaculty,activeStudents,disabledStudents,activeSessions,pendingDisputes);

@override
String toString() {
  return 'AdminOverviewCounts(activeFaculty: $activeFaculty, disabledFaculty: $disabledFaculty, activeStudents: $activeStudents, disabledStudents: $disabledStudents, activeSessions: $activeSessions, pendingDisputes: $pendingDisputes)';
}


}

/// @nodoc
abstract mixin class _$AdminOverviewCountsCopyWith<$Res> implements $AdminOverviewCountsCopyWith<$Res> {
  factory _$AdminOverviewCountsCopyWith(_AdminOverviewCounts value, $Res Function(_AdminOverviewCounts) _then) = __$AdminOverviewCountsCopyWithImpl;
@override @useResult
$Res call({
 int activeFaculty, int disabledFaculty, int activeStudents, int disabledStudents, int activeSessions, int pendingDisputes
});




}
/// @nodoc
class __$AdminOverviewCountsCopyWithImpl<$Res>
    implements _$AdminOverviewCountsCopyWith<$Res> {
  __$AdminOverviewCountsCopyWithImpl(this._self, this._then);

  final _AdminOverviewCounts _self;
  final $Res Function(_AdminOverviewCounts) _then;

/// Create a copy of AdminOverviewCounts
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? activeFaculty = null,Object? disabledFaculty = null,Object? activeStudents = null,Object? disabledStudents = null,Object? activeSessions = null,Object? pendingDisputes = null,}) {
  return _then(_AdminOverviewCounts(
activeFaculty: null == activeFaculty ? _self.activeFaculty : activeFaculty // ignore: cast_nullable_to_non_nullable
as int,disabledFaculty: null == disabledFaculty ? _self.disabledFaculty : disabledFaculty // ignore: cast_nullable_to_non_nullable
as int,activeStudents: null == activeStudents ? _self.activeStudents : activeStudents // ignore: cast_nullable_to_non_nullable
as int,disabledStudents: null == disabledStudents ? _self.disabledStudents : disabledStudents // ignore: cast_nullable_to_non_nullable
as int,activeSessions: null == activeSessions ? _self.activeSessions : activeSessions // ignore: cast_nullable_to_non_nullable
as int,pendingDisputes: null == pendingDisputes ? _self.pendingDisputes : pendingDisputes // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$AdminOverview {

 AdminScopeKind get scope; String? get department; AdminOverviewCounts get counts; AdminOverviewHealth get health; List<AuditLogEntry> get recentActivity;
/// Create a copy of AdminOverview
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AdminOverviewCopyWith<AdminOverview> get copyWith => _$AdminOverviewCopyWithImpl<AdminOverview>(this as AdminOverview, _$identity);

  /// Serializes this AdminOverview to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AdminOverview&&(identical(other.scope, scope) || other.scope == scope)&&(identical(other.department, department) || other.department == department)&&(identical(other.counts, counts) || other.counts == counts)&&(identical(other.health, health) || other.health == health)&&const DeepCollectionEquality().equals(other.recentActivity, recentActivity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,scope,department,counts,health,const DeepCollectionEquality().hash(recentActivity));

@override
String toString() {
  return 'AdminOverview(scope: $scope, department: $department, counts: $counts, health: $health, recentActivity: $recentActivity)';
}


}

/// @nodoc
abstract mixin class $AdminOverviewCopyWith<$Res>  {
  factory $AdminOverviewCopyWith(AdminOverview value, $Res Function(AdminOverview) _then) = _$AdminOverviewCopyWithImpl;
@useResult
$Res call({
 AdminScopeKind scope, String? department, AdminOverviewCounts counts, AdminOverviewHealth health, List<AuditLogEntry> recentActivity
});


$AdminOverviewCountsCopyWith<$Res> get counts;$AdminOverviewHealthCopyWith<$Res> get health;

}
/// @nodoc
class _$AdminOverviewCopyWithImpl<$Res>
    implements $AdminOverviewCopyWith<$Res> {
  _$AdminOverviewCopyWithImpl(this._self, this._then);

  final AdminOverview _self;
  final $Res Function(AdminOverview) _then;

/// Create a copy of AdminOverview
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? scope = null,Object? department = freezed,Object? counts = null,Object? health = null,Object? recentActivity = null,}) {
  return _then(AdminOverview(
scope: null == scope ? _self.scope : scope // ignore: cast_nullable_to_non_nullable
as AdminScopeKind,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,counts: null == counts ? _self.counts : counts // ignore: cast_nullable_to_non_nullable
as AdminOverviewCounts,health: null == health ? _self.health : health // ignore: cast_nullable_to_non_nullable
as AdminOverviewHealth,recentActivity: null == recentActivity ? _self.recentActivity : recentActivity // ignore: cast_nullable_to_non_nullable
as List<AuditLogEntry>,
  ));
}
/// Create a copy of AdminOverview
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AdminOverviewCountsCopyWith<$Res> get counts {
  
  return $AdminOverviewCountsCopyWith<$Res>(_self.counts, (value) {
    return _then(_self.copyWith(counts: value));
  });
}/// Create a copy of AdminOverview
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AdminOverviewHealthCopyWith<$Res> get health {
  
  return $AdminOverviewHealthCopyWith<$Res>(_self.health, (value) {
    return _then(_self.copyWith(health: value));
  });
}
}


/// Adds pattern-matching-related methods to [AdminOverview].
extension AdminOverviewPatterns on AdminOverview {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AdminOverview value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AdminOverview() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AdminOverview value)  $default,){
final _that = this;
switch (_that) {
case _AdminOverview():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AdminOverview value)?  $default,){
final _that = this;
switch (_that) {
case _AdminOverview() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( AdminScopeKind scope,  String? department,  AdminOverviewCounts counts,  AdminOverviewHealth health,  List<AuditLogEntry> recentActivity)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AdminOverview() when $default != null:
return $default(_that.scope,_that.department,_that.counts,_that.health,_that.recentActivity);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( AdminScopeKind scope,  String? department,  AdminOverviewCounts counts,  AdminOverviewHealth health,  List<AuditLogEntry> recentActivity)  $default,) {final _that = this;
switch (_that) {
case _AdminOverview():
return $default(_that.scope,_that.department,_that.counts,_that.health,_that.recentActivity);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( AdminScopeKind scope,  String? department,  AdminOverviewCounts counts,  AdminOverviewHealth health,  List<AuditLogEntry> recentActivity)?  $default,) {final _that = this;
switch (_that) {
case _AdminOverview() when $default != null:
return $default(_that.scope,_that.department,_that.counts,_that.health,_that.recentActivity);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AdminScopeKindConverter()])
class _AdminOverview implements AdminOverview {
  const _AdminOverview({required this.scope, this.department, required this.counts, required this.health,  List<AuditLogEntry> recentActivity = const <AuditLogEntry>[]}): _recentActivity = recentActivity;
  factory _AdminOverview.fromJson(Map<String, dynamic> json) => _$AdminOverviewFromJson(json);

@override final  AdminScopeKind scope;
@override final  String? department;
@override final  AdminOverviewCounts counts;
@override final  AdminOverviewHealth health;
 final  List<AuditLogEntry> _recentActivity;
@override@JsonKey() List<AuditLogEntry> get recentActivity {
  if (_recentActivity is EqualUnmodifiableListView) return _recentActivity;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_recentActivity);
}


/// Create a copy of AdminOverview
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AdminOverviewCopyWith<_AdminOverview> get copyWith => __$AdminOverviewCopyWithImpl<_AdminOverview>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AdminOverviewToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AdminOverview&&(identical(other.scope, scope) || other.scope == scope)&&(identical(other.department, department) || other.department == department)&&(identical(other.counts, counts) || other.counts == counts)&&(identical(other.health, health) || other.health == health)&&const DeepCollectionEquality().equals(other._recentActivity, _recentActivity));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,scope,department,counts,health,const DeepCollectionEquality().hash(_recentActivity));

@override
String toString() {
  return 'AdminOverview(scope: $scope, department: $department, counts: $counts, health: $health, recentActivity: $recentActivity)';
}


}

/// @nodoc
abstract mixin class _$AdminOverviewCopyWith<$Res> implements $AdminOverviewCopyWith<$Res> {
  factory _$AdminOverviewCopyWith(_AdminOverview value, $Res Function(_AdminOverview) _then) = __$AdminOverviewCopyWithImpl;
@override @useResult
$Res call({
 AdminScopeKind scope, String? department, AdminOverviewCounts counts, AdminOverviewHealth health, List<AuditLogEntry> recentActivity
});


@override $AdminOverviewCountsCopyWith<$Res> get counts;@override $AdminOverviewHealthCopyWith<$Res> get health;

}
/// @nodoc
class __$AdminOverviewCopyWithImpl<$Res>
    implements _$AdminOverviewCopyWith<$Res> {
  __$AdminOverviewCopyWithImpl(this._self, this._then);

  final _AdminOverview _self;
  final $Res Function(_AdminOverview) _then;

/// Create a copy of AdminOverview
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? scope = null,Object? department = freezed,Object? counts = null,Object? health = null,Object? recentActivity = null,}) {
  return _then(_AdminOverview(
scope: null == scope ? _self.scope : scope // ignore: cast_nullable_to_non_nullable
as AdminScopeKind,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,counts: null == counts ? _self.counts : counts // ignore: cast_nullable_to_non_nullable
as AdminOverviewCounts,health: null == health ? _self.health : health // ignore: cast_nullable_to_non_nullable
as AdminOverviewHealth,recentActivity: null == recentActivity ? _self._recentActivity : recentActivity // ignore: cast_nullable_to_non_nullable
as List<AuditLogEntry>,
  ));
}

/// Create a copy of AdminOverview
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AdminOverviewCountsCopyWith<$Res> get counts {
  
  return $AdminOverviewCountsCopyWith<$Res>(_self.counts, (value) {
    return _then(_self.copyWith(counts: value));
  });
}/// Create a copy of AdminOverview
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$AdminOverviewHealthCopyWith<$Res> get health {
  
  return $AdminOverviewHealthCopyWith<$Res>(_self.health, (value) {
    return _then(_self.copyWith(health: value));
  });
}
}


/// @nodoc
mixin _$AdminUserFilters {

 AdminUserRoleFilter? get role; String? get q; String? get department; AdminUserStatusFilter? get status; int? get limit; int? get offset;
/// Create a copy of AdminUserFilters
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AdminUserFiltersCopyWith<AdminUserFilters> get copyWith => _$AdminUserFiltersCopyWithImpl<AdminUserFilters>(this as AdminUserFilters, _$identity);

  /// Serializes this AdminUserFilters to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AdminUserFilters&&(identical(other.role, role) || other.role == role)&&(identical(other.q, q) || other.q == q)&&(identical(other.department, department) || other.department == department)&&(identical(other.status, status) || other.status == status)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.offset, offset) || other.offset == offset));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,role,q,department,status,limit,offset);

@override
String toString() {
  return 'AdminUserFilters(role: $role, q: $q, department: $department, status: $status, limit: $limit, offset: $offset)';
}


}

/// @nodoc
abstract mixin class $AdminUserFiltersCopyWith<$Res>  {
  factory $AdminUserFiltersCopyWith(AdminUserFilters value, $Res Function(AdminUserFilters) _then) = _$AdminUserFiltersCopyWithImpl;
@useResult
$Res call({
 AdminUserRoleFilter? role, String? q, String? department, AdminUserStatusFilter? status, int? limit, int? offset
});




}
/// @nodoc
class _$AdminUserFiltersCopyWithImpl<$Res>
    implements $AdminUserFiltersCopyWith<$Res> {
  _$AdminUserFiltersCopyWithImpl(this._self, this._then);

  final AdminUserFilters _self;
  final $Res Function(AdminUserFilters) _then;

/// Create a copy of AdminUserFilters
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? role = freezed,Object? q = freezed,Object? department = freezed,Object? status = freezed,Object? limit = freezed,Object? offset = freezed,}) {
  return _then(AdminUserFilters(
role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as AdminUserRoleFilter?,q: freezed == q ? _self.q : q // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AdminUserStatusFilter?,limit: freezed == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int?,offset: freezed == offset ? _self.offset : offset // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [AdminUserFilters].
extension AdminUserFiltersPatterns on AdminUserFilters {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AdminUserFilters value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AdminUserFilters() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AdminUserFilters value)  $default,){
final _that = this;
switch (_that) {
case _AdminUserFilters():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AdminUserFilters value)?  $default,){
final _that = this;
switch (_that) {
case _AdminUserFilters() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( AdminUserRoleFilter? role,  String? q,  String? department,  AdminUserStatusFilter? status,  int? limit,  int? offset)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AdminUserFilters() when $default != null:
return $default(_that.role,_that.q,_that.department,_that.status,_that.limit,_that.offset);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( AdminUserRoleFilter? role,  String? q,  String? department,  AdminUserStatusFilter? status,  int? limit,  int? offset)  $default,) {final _that = this;
switch (_that) {
case _AdminUserFilters():
return $default(_that.role,_that.q,_that.department,_that.status,_that.limit,_that.offset);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( AdminUserRoleFilter? role,  String? q,  String? department,  AdminUserStatusFilter? status,  int? limit,  int? offset)?  $default,) {final _that = this;
switch (_that) {
case _AdminUserFilters() when $default != null:
return $default(_that.role,_that.q,_that.department,_that.status,_that.limit,_that.offset);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true, converters: [AdminUserRoleFilterConverter(), AdminUserStatusFilterConverter()])
class _AdminUserFilters implements AdminUserFilters {
  const _AdminUserFilters({this.role, this.q, this.department, this.status, this.limit, this.offset});
  factory _AdminUserFilters.fromJson(Map<String, dynamic> json) => _$AdminUserFiltersFromJson(json);

@override final  AdminUserRoleFilter? role;
@override final  String? q;
@override final  String? department;
@override final  AdminUserStatusFilter? status;
@override final  int? limit;
@override final  int? offset;

/// Create a copy of AdminUserFilters
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AdminUserFiltersCopyWith<_AdminUserFilters> get copyWith => __$AdminUserFiltersCopyWithImpl<_AdminUserFilters>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AdminUserFiltersToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AdminUserFilters&&(identical(other.role, role) || other.role == role)&&(identical(other.q, q) || other.q == q)&&(identical(other.department, department) || other.department == department)&&(identical(other.status, status) || other.status == status)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.offset, offset) || other.offset == offset));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,role,q,department,status,limit,offset);

@override
String toString() {
  return 'AdminUserFilters(role: $role, q: $q, department: $department, status: $status, limit: $limit, offset: $offset)';
}


}

/// @nodoc
abstract mixin class _$AdminUserFiltersCopyWith<$Res> implements $AdminUserFiltersCopyWith<$Res> {
  factory _$AdminUserFiltersCopyWith(_AdminUserFilters value, $Res Function(_AdminUserFilters) _then) = __$AdminUserFiltersCopyWithImpl;
@override @useResult
$Res call({
 AdminUserRoleFilter? role, String? q, String? department, AdminUserStatusFilter? status, int? limit, int? offset
});




}
/// @nodoc
class __$AdminUserFiltersCopyWithImpl<$Res>
    implements _$AdminUserFiltersCopyWith<$Res> {
  __$AdminUserFiltersCopyWithImpl(this._self, this._then);

  final _AdminUserFilters _self;
  final $Res Function(_AdminUserFilters) _then;

/// Create a copy of AdminUserFilters
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? role = freezed,Object? q = freezed,Object? department = freezed,Object? status = freezed,Object? limit = freezed,Object? offset = freezed,}) {
  return _then(_AdminUserFilters(
role: freezed == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as AdminUserRoleFilter?,q: freezed == q ? _self.q : q // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as AdminUserStatusFilter?,limit: freezed == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int?,offset: freezed == offset ? _self.offset : offset // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$AdminUserPage {

 List<User> get data; int get total; int get limit; int get offset; bool get hasMore;
/// Create a copy of AdminUserPage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AdminUserPageCopyWith<AdminUserPage> get copyWith => _$AdminUserPageCopyWithImpl<AdminUserPage>(this as AdminUserPage, _$identity);

  /// Serializes this AdminUserPage to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AdminUserPage&&const DeepCollectionEquality().equals(other.data, data)&&(identical(other.total, total) || other.total == total)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.offset, offset) || other.offset == offset)&&(identical(other.hasMore, hasMore) || other.hasMore == hasMore));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(data),total,limit,offset,hasMore);

@override
String toString() {
  return 'AdminUserPage(data: $data, total: $total, limit: $limit, offset: $offset, hasMore: $hasMore)';
}


}

/// @nodoc
abstract mixin class $AdminUserPageCopyWith<$Res>  {
  factory $AdminUserPageCopyWith(AdminUserPage value, $Res Function(AdminUserPage) _then) = _$AdminUserPageCopyWithImpl;
@useResult
$Res call({
 List<User> data, int total, int limit, int offset, bool hasMore
});




}
/// @nodoc
class _$AdminUserPageCopyWithImpl<$Res>
    implements $AdminUserPageCopyWith<$Res> {
  _$AdminUserPageCopyWithImpl(this._self, this._then);

  final AdminUserPage _self;
  final $Res Function(AdminUserPage) _then;

/// Create a copy of AdminUserPage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? data = null,Object? total = null,Object? limit = null,Object? offset = null,Object? hasMore = null,}) {
  return _then(AdminUserPage(
data: null == data ? _self.data : data // ignore: cast_nullable_to_non_nullable
as List<User>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,limit: null == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int,offset: null == offset ? _self.offset : offset // ignore: cast_nullable_to_non_nullable
as int,hasMore: null == hasMore ? _self.hasMore : hasMore // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [AdminUserPage].
extension AdminUserPagePatterns on AdminUserPage {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AdminUserPage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AdminUserPage() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AdminUserPage value)  $default,){
final _that = this;
switch (_that) {
case _AdminUserPage():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AdminUserPage value)?  $default,){
final _that = this;
switch (_that) {
case _AdminUserPage() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<User> data,  int total,  int limit,  int offset,  bool hasMore)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AdminUserPage() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<User> data,  int total,  int limit,  int offset,  bool hasMore)  $default,) {final _that = this;
switch (_that) {
case _AdminUserPage():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<User> data,  int total,  int limit,  int offset,  bool hasMore)?  $default,) {final _that = this;
switch (_that) {
case _AdminUserPage() when $default != null:
return $default(_that.data,_that.total,_that.limit,_that.offset,_that.hasMore);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _AdminUserPage implements AdminUserPage {
  const _AdminUserPage({ List<User> data = const <User>[], this.total = 0, this.limit = 0, this.offset = 0, this.hasMore = false}): _data = data;
  factory _AdminUserPage.fromJson(Map<String, dynamic> json) => _$AdminUserPageFromJson(json);

 final  List<User> _data;
@override@JsonKey() List<User> get data {
  if (_data is EqualUnmodifiableListView) return _data;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_data);
}

@override@JsonKey() final  int total;
@override@JsonKey() final  int limit;
@override@JsonKey() final  int offset;
@override@JsonKey() final  bool hasMore;

/// Create a copy of AdminUserPage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AdminUserPageCopyWith<_AdminUserPage> get copyWith => __$AdminUserPageCopyWithImpl<_AdminUserPage>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AdminUserPageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AdminUserPage&&const DeepCollectionEquality().equals(other._data, _data)&&(identical(other.total, total) || other.total == total)&&(identical(other.limit, limit) || other.limit == limit)&&(identical(other.offset, offset) || other.offset == offset)&&(identical(other.hasMore, hasMore) || other.hasMore == hasMore));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_data),total,limit,offset,hasMore);

@override
String toString() {
  return 'AdminUserPage(data: $data, total: $total, limit: $limit, offset: $offset, hasMore: $hasMore)';
}


}

/// @nodoc
abstract mixin class _$AdminUserPageCopyWith<$Res> implements $AdminUserPageCopyWith<$Res> {
  factory _$AdminUserPageCopyWith(_AdminUserPage value, $Res Function(_AdminUserPage) _then) = __$AdminUserPageCopyWithImpl;
@override @useResult
$Res call({
 List<User> data, int total, int limit, int offset, bool hasMore
});




}
/// @nodoc
class __$AdminUserPageCopyWithImpl<$Res>
    implements _$AdminUserPageCopyWith<$Res> {
  __$AdminUserPageCopyWithImpl(this._self, this._then);

  final _AdminUserPage _self;
  final $Res Function(_AdminUserPage) _then;

/// Create a copy of AdminUserPage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? data = null,Object? total = null,Object? limit = null,Object? offset = null,Object? hasMore = null,}) {
  return _then(_AdminUserPage(
data: null == data ? _self._data : data // ignore: cast_nullable_to_non_nullable
as List<User>,total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as int,limit: null == limit ? _self.limit : limit // ignore: cast_nullable_to_non_nullable
as int,offset: null == offset ? _self.offset : offset // ignore: cast_nullable_to_non_nullable
as int,hasMore: null == hasMore ? _self.hasMore : hasMore // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$UpdateUserInput {

 String? get fullName; String? get department; String? get email; String? get program; int? get yearLevel; bool? get canResetStudentPasswords; bool? get canEmergencyUnbindDevices; bool? get isItCoordinator; bool? get isDepartmentHead; bool? get isUserRegistrar;
/// Create a copy of UpdateUserInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$UpdateUserInputCopyWith<UpdateUserInput> get copyWith => _$UpdateUserInputCopyWithImpl<UpdateUserInput>(this as UpdateUserInput, _$identity);

  /// Serializes this UpdateUserInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is UpdateUserInput&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.department, department) || other.department == department)&&(identical(other.email, email) || other.email == email)&&(identical(other.program, program) || other.program == program)&&(identical(other.yearLevel, yearLevel) || other.yearLevel == yearLevel)&&(identical(other.canResetStudentPasswords, canResetStudentPasswords) || other.canResetStudentPasswords == canResetStudentPasswords)&&(identical(other.canEmergencyUnbindDevices, canEmergencyUnbindDevices) || other.canEmergencyUnbindDevices == canEmergencyUnbindDevices)&&(identical(other.isItCoordinator, isItCoordinator) || other.isItCoordinator == isItCoordinator)&&(identical(other.isDepartmentHead, isDepartmentHead) || other.isDepartmentHead == isDepartmentHead)&&(identical(other.isUserRegistrar, isUserRegistrar) || other.isUserRegistrar == isUserRegistrar));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fullName,department,email,program,yearLevel,canResetStudentPasswords,canEmergencyUnbindDevices,isItCoordinator,isDepartmentHead,isUserRegistrar);

@override
String toString() {
  return 'UpdateUserInput(fullName: $fullName, department: $department, email: $email, program: $program, yearLevel: $yearLevel, canResetStudentPasswords: $canResetStudentPasswords, canEmergencyUnbindDevices: $canEmergencyUnbindDevices, isItCoordinator: $isItCoordinator, isDepartmentHead: $isDepartmentHead, isUserRegistrar: $isUserRegistrar)';
}


}

/// @nodoc
abstract mixin class $UpdateUserInputCopyWith<$Res>  {
  factory $UpdateUserInputCopyWith(UpdateUserInput value, $Res Function(UpdateUserInput) _then) = _$UpdateUserInputCopyWithImpl;
@useResult
$Res call({
 String? fullName, String? department, String? email, String? program, int? yearLevel, bool? canResetStudentPasswords, bool? canEmergencyUnbindDevices, bool? isItCoordinator, bool? isDepartmentHead, bool? isUserRegistrar
});




}
/// @nodoc
class _$UpdateUserInputCopyWithImpl<$Res>
    implements $UpdateUserInputCopyWith<$Res> {
  _$UpdateUserInputCopyWithImpl(this._self, this._then);

  final UpdateUserInput _self;
  final $Res Function(UpdateUserInput) _then;

/// Create a copy of UpdateUserInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? fullName = freezed,Object? department = freezed,Object? email = freezed,Object? program = freezed,Object? yearLevel = freezed,Object? canResetStudentPasswords = freezed,Object? canEmergencyUnbindDevices = freezed,Object? isItCoordinator = freezed,Object? isDepartmentHead = freezed,Object? isUserRegistrar = freezed,}) {
  return _then(UpdateUserInput(
fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,program: freezed == program ? _self.program : program // ignore: cast_nullable_to_non_nullable
as String?,yearLevel: freezed == yearLevel ? _self.yearLevel : yearLevel // ignore: cast_nullable_to_non_nullable
as int?,canResetStudentPasswords: freezed == canResetStudentPasswords ? _self.canResetStudentPasswords : canResetStudentPasswords // ignore: cast_nullable_to_non_nullable
as bool?,canEmergencyUnbindDevices: freezed == canEmergencyUnbindDevices ? _self.canEmergencyUnbindDevices : canEmergencyUnbindDevices // ignore: cast_nullable_to_non_nullable
as bool?,isItCoordinator: freezed == isItCoordinator ? _self.isItCoordinator : isItCoordinator // ignore: cast_nullable_to_non_nullable
as bool?,isDepartmentHead: freezed == isDepartmentHead ? _self.isDepartmentHead : isDepartmentHead // ignore: cast_nullable_to_non_nullable
as bool?,isUserRegistrar: freezed == isUserRegistrar ? _self.isUserRegistrar : isUserRegistrar // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}

}


/// Adds pattern-matching-related methods to [UpdateUserInput].
extension UpdateUserInputPatterns on UpdateUserInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _UpdateUserInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _UpdateUserInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _UpdateUserInput value)  $default,){
final _that = this;
switch (_that) {
case _UpdateUserInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _UpdateUserInput value)?  $default,){
final _that = this;
switch (_that) {
case _UpdateUserInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? fullName,  String? department,  String? email,  String? program,  int? yearLevel,  bool? canResetStudentPasswords,  bool? canEmergencyUnbindDevices,  bool? isItCoordinator,  bool? isDepartmentHead,  bool? isUserRegistrar)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _UpdateUserInput() when $default != null:
return $default(_that.fullName,_that.department,_that.email,_that.program,_that.yearLevel,_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices,_that.isItCoordinator,_that.isDepartmentHead,_that.isUserRegistrar);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? fullName,  String? department,  String? email,  String? program,  int? yearLevel,  bool? canResetStudentPasswords,  bool? canEmergencyUnbindDevices,  bool? isItCoordinator,  bool? isDepartmentHead,  bool? isUserRegistrar)  $default,) {final _that = this;
switch (_that) {
case _UpdateUserInput():
return $default(_that.fullName,_that.department,_that.email,_that.program,_that.yearLevel,_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices,_that.isItCoordinator,_that.isDepartmentHead,_that.isUserRegistrar);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? fullName,  String? department,  String? email,  String? program,  int? yearLevel,  bool? canResetStudentPasswords,  bool? canEmergencyUnbindDevices,  bool? isItCoordinator,  bool? isDepartmentHead,  bool? isUserRegistrar)?  $default,) {final _that = this;
switch (_that) {
case _UpdateUserInput() when $default != null:
return $default(_that.fullName,_that.department,_that.email,_that.program,_that.yearLevel,_that.canResetStudentPasswords,_that.canEmergencyUnbindDevices,_that.isItCoordinator,_that.isDepartmentHead,_that.isUserRegistrar);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _UpdateUserInput implements UpdateUserInput {
  const _UpdateUserInput({this.fullName, this.department, this.email, this.program, this.yearLevel, this.canResetStudentPasswords, this.canEmergencyUnbindDevices, this.isItCoordinator, this.isDepartmentHead, this.isUserRegistrar});
  factory _UpdateUserInput.fromJson(Map<String, dynamic> json) => _$UpdateUserInputFromJson(json);

@override final  String? fullName;
@override final  String? department;
@override final  String? email;
@override final  String? program;
@override final  int? yearLevel;
@override final  bool? canResetStudentPasswords;
@override final  bool? canEmergencyUnbindDevices;
@override final  bool? isItCoordinator;
@override final  bool? isDepartmentHead;
@override final  bool? isUserRegistrar;

/// Create a copy of UpdateUserInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$UpdateUserInputCopyWith<_UpdateUserInput> get copyWith => __$UpdateUserInputCopyWithImpl<_UpdateUserInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$UpdateUserInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _UpdateUserInput&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.department, department) || other.department == department)&&(identical(other.email, email) || other.email == email)&&(identical(other.program, program) || other.program == program)&&(identical(other.yearLevel, yearLevel) || other.yearLevel == yearLevel)&&(identical(other.canResetStudentPasswords, canResetStudentPasswords) || other.canResetStudentPasswords == canResetStudentPasswords)&&(identical(other.canEmergencyUnbindDevices, canEmergencyUnbindDevices) || other.canEmergencyUnbindDevices == canEmergencyUnbindDevices)&&(identical(other.isItCoordinator, isItCoordinator) || other.isItCoordinator == isItCoordinator)&&(identical(other.isDepartmentHead, isDepartmentHead) || other.isDepartmentHead == isDepartmentHead)&&(identical(other.isUserRegistrar, isUserRegistrar) || other.isUserRegistrar == isUserRegistrar));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,fullName,department,email,program,yearLevel,canResetStudentPasswords,canEmergencyUnbindDevices,isItCoordinator,isDepartmentHead,isUserRegistrar);

@override
String toString() {
  return 'UpdateUserInput(fullName: $fullName, department: $department, email: $email, program: $program, yearLevel: $yearLevel, canResetStudentPasswords: $canResetStudentPasswords, canEmergencyUnbindDevices: $canEmergencyUnbindDevices, isItCoordinator: $isItCoordinator, isDepartmentHead: $isDepartmentHead, isUserRegistrar: $isUserRegistrar)';
}


}

/// @nodoc
abstract mixin class _$UpdateUserInputCopyWith<$Res> implements $UpdateUserInputCopyWith<$Res> {
  factory _$UpdateUserInputCopyWith(_UpdateUserInput value, $Res Function(_UpdateUserInput) _then) = __$UpdateUserInputCopyWithImpl;
@override @useResult
$Res call({
 String? fullName, String? department, String? email, String? program, int? yearLevel, bool? canResetStudentPasswords, bool? canEmergencyUnbindDevices, bool? isItCoordinator, bool? isDepartmentHead, bool? isUserRegistrar
});




}
/// @nodoc
class __$UpdateUserInputCopyWithImpl<$Res>
    implements _$UpdateUserInputCopyWith<$Res> {
  __$UpdateUserInputCopyWithImpl(this._self, this._then);

  final _UpdateUserInput _self;
  final $Res Function(_UpdateUserInput) _then;

/// Create a copy of UpdateUserInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? fullName = freezed,Object? department = freezed,Object? email = freezed,Object? program = freezed,Object? yearLevel = freezed,Object? canResetStudentPasswords = freezed,Object? canEmergencyUnbindDevices = freezed,Object? isItCoordinator = freezed,Object? isDepartmentHead = freezed,Object? isUserRegistrar = freezed,}) {
  return _then(_UpdateUserInput(
fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,program: freezed == program ? _self.program : program // ignore: cast_nullable_to_non_nullable
as String?,yearLevel: freezed == yearLevel ? _self.yearLevel : yearLevel // ignore: cast_nullable_to_non_nullable
as int?,canResetStudentPasswords: freezed == canResetStudentPasswords ? _self.canResetStudentPasswords : canResetStudentPasswords // ignore: cast_nullable_to_non_nullable
as bool?,canEmergencyUnbindDevices: freezed == canEmergencyUnbindDevices ? _self.canEmergencyUnbindDevices : canEmergencyUnbindDevices // ignore: cast_nullable_to_non_nullable
as bool?,isItCoordinator: freezed == isItCoordinator ? _self.isItCoordinator : isItCoordinator // ignore: cast_nullable_to_non_nullable
as bool?,isDepartmentHead: freezed == isDepartmentHead ? _self.isDepartmentHead : isDepartmentHead // ignore: cast_nullable_to_non_nullable
as bool?,isUserRegistrar: freezed == isUserRegistrar ? _self.isUserRegistrar : isUserRegistrar // ignore: cast_nullable_to_non_nullable
as bool?,
  ));
}


}


/// @nodoc
mixin _$CreateAdminInput {

 String? get userId; String? get fullName; String? get email; String? get password; String? get department;
/// Create a copy of CreateAdminInput
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateAdminInputCopyWith<CreateAdminInput> get copyWith => _$CreateAdminInputCopyWithImpl<CreateAdminInput>(this as CreateAdminInput, _$identity);

  /// Serializes this CreateAdminInput to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateAdminInput&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.email, email) || other.email == email)&&(identical(other.password, password) || other.password == password)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,userId,fullName,email,password,department);

@override
String toString() {
  return 'CreateAdminInput(userId: $userId, fullName: $fullName, email: $email, password: $password, department: $department)';
}


}

/// @nodoc
abstract mixin class $CreateAdminInputCopyWith<$Res>  {
  factory $CreateAdminInputCopyWith(CreateAdminInput value, $Res Function(CreateAdminInput) _then) = _$CreateAdminInputCopyWithImpl;
@useResult
$Res call({
 String? userId, String? fullName, String? email, String? password, String? department
});




}
/// @nodoc
class _$CreateAdminInputCopyWithImpl<$Res>
    implements $CreateAdminInputCopyWith<$Res> {
  _$CreateAdminInputCopyWithImpl(this._self, this._then);

  final CreateAdminInput _self;
  final $Res Function(CreateAdminInput) _then;

/// Create a copy of CreateAdminInput
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? userId = freezed,Object? fullName = freezed,Object? email = freezed,Object? password = freezed,Object? department = freezed,}) {
  return _then(CreateAdminInput(
userId: freezed == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String?,fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,password: freezed == password ? _self.password : password // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CreateAdminInput].
extension CreateAdminInputPatterns on CreateAdminInput {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateAdminInput value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateAdminInput() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateAdminInput value)  $default,){
final _that = this;
switch (_that) {
case _CreateAdminInput():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateAdminInput value)?  $default,){
final _that = this;
switch (_that) {
case _CreateAdminInput() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? userId,  String? fullName,  String? email,  String? password,  String? department)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateAdminInput() when $default != null:
return $default(_that.userId,_that.fullName,_that.email,_that.password,_that.department);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? userId,  String? fullName,  String? email,  String? password,  String? department)  $default,) {final _that = this;
switch (_that) {
case _CreateAdminInput():
return $default(_that.userId,_that.fullName,_that.email,_that.password,_that.department);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? userId,  String? fullName,  String? email,  String? password,  String? department)?  $default,) {final _that = this;
switch (_that) {
case _CreateAdminInput() when $default != null:
return $default(_that.userId,_that.fullName,_that.email,_that.password,_that.department);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _CreateAdminInput implements CreateAdminInput {
  const _CreateAdminInput({this.userId, this.fullName, this.email, this.password, this.department});
  factory _CreateAdminInput.fromJson(Map<String, dynamic> json) => _$CreateAdminInputFromJson(json);

@override final  String? userId;
@override final  String? fullName;
@override final  String? email;
@override final  String? password;
@override final  String? department;

/// Create a copy of CreateAdminInput
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateAdminInputCopyWith<_CreateAdminInput> get copyWith => __$CreateAdminInputCopyWithImpl<_CreateAdminInput>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateAdminInputToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateAdminInput&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.fullName, fullName) || other.fullName == fullName)&&(identical(other.email, email) || other.email == email)&&(identical(other.password, password) || other.password == password)&&(identical(other.department, department) || other.department == department));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,userId,fullName,email,password,department);

@override
String toString() {
  return 'CreateAdminInput(userId: $userId, fullName: $fullName, email: $email, password: $password, department: $department)';
}


}

/// @nodoc
abstract mixin class _$CreateAdminInputCopyWith<$Res> implements $CreateAdminInputCopyWith<$Res> {
  factory _$CreateAdminInputCopyWith(_CreateAdminInput value, $Res Function(_CreateAdminInput) _then) = __$CreateAdminInputCopyWithImpl;
@override @useResult
$Res call({
 String? userId, String? fullName, String? email, String? password, String? department
});




}
/// @nodoc
class __$CreateAdminInputCopyWithImpl<$Res>
    implements _$CreateAdminInputCopyWith<$Res> {
  __$CreateAdminInputCopyWithImpl(this._self, this._then);

  final _CreateAdminInput _self;
  final $Res Function(_CreateAdminInput) _then;

/// Create a copy of CreateAdminInput
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? userId = freezed,Object? fullName = freezed,Object? email = freezed,Object? password = freezed,Object? department = freezed,}) {
  return _then(_CreateAdminInput(
userId: freezed == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String?,fullName: freezed == fullName ? _self.fullName : fullName // ignore: cast_nullable_to_non_nullable
as String?,email: freezed == email ? _self.email : email // ignore: cast_nullable_to_non_nullable
as String?,password: freezed == password ? _self.password : password // ignore: cast_nullable_to_non_nullable
as String?,department: freezed == department ? _self.department : department // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$ServerStatusQueue {

 int get wait; int get active; int get failed;
/// Create a copy of ServerStatusQueue
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ServerStatusQueueCopyWith<ServerStatusQueue> get copyWith => _$ServerStatusQueueCopyWithImpl<ServerStatusQueue>(this as ServerStatusQueue, _$identity);

  /// Serializes this ServerStatusQueue to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ServerStatusQueue&&(identical(other.wait, wait) || other.wait == wait)&&(identical(other.active, active) || other.active == active)&&(identical(other.failed, failed) || other.failed == failed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,wait,active,failed);

@override
String toString() {
  return 'ServerStatusQueue(wait: $wait, active: $active, failed: $failed)';
}


}

/// @nodoc
abstract mixin class $ServerStatusQueueCopyWith<$Res>  {
  factory $ServerStatusQueueCopyWith(ServerStatusQueue value, $Res Function(ServerStatusQueue) _then) = _$ServerStatusQueueCopyWithImpl;
@useResult
$Res call({
 int wait, int active, int failed
});




}
/// @nodoc
class _$ServerStatusQueueCopyWithImpl<$Res>
    implements $ServerStatusQueueCopyWith<$Res> {
  _$ServerStatusQueueCopyWithImpl(this._self, this._then);

  final ServerStatusQueue _self;
  final $Res Function(ServerStatusQueue) _then;

/// Create a copy of ServerStatusQueue
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? wait = null,Object? active = null,Object? failed = null,}) {
  return _then(ServerStatusQueue(
wait: null == wait ? _self.wait : wait // ignore: cast_nullable_to_non_nullable
as int,active: null == active ? _self.active : active // ignore: cast_nullable_to_non_nullable
as int,failed: null == failed ? _self.failed : failed // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ServerStatusQueue].
extension ServerStatusQueuePatterns on ServerStatusQueue {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ServerStatusQueue value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ServerStatusQueue() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ServerStatusQueue value)  $default,){
final _that = this;
switch (_that) {
case _ServerStatusQueue():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ServerStatusQueue value)?  $default,){
final _that = this;
switch (_that) {
case _ServerStatusQueue() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int wait,  int active,  int failed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ServerStatusQueue() when $default != null:
return $default(_that.wait,_that.active,_that.failed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int wait,  int active,  int failed)  $default,) {final _that = this;
switch (_that) {
case _ServerStatusQueue():
return $default(_that.wait,_that.active,_that.failed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int wait,  int active,  int failed)?  $default,) {final _that = this;
switch (_that) {
case _ServerStatusQueue() when $default != null:
return $default(_that.wait,_that.active,_that.failed);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _ServerStatusQueue implements ServerStatusQueue {
  const _ServerStatusQueue({this.wait = 0, this.active = 0, this.failed = 0});
  factory _ServerStatusQueue.fromJson(Map<String, dynamic> json) => _$ServerStatusQueueFromJson(json);

@override@JsonKey() final  int wait;
@override@JsonKey() final  int active;
@override@JsonKey() final  int failed;

/// Create a copy of ServerStatusQueue
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ServerStatusQueueCopyWith<_ServerStatusQueue> get copyWith => __$ServerStatusQueueCopyWithImpl<_ServerStatusQueue>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ServerStatusQueueToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ServerStatusQueue&&(identical(other.wait, wait) || other.wait == wait)&&(identical(other.active, active) || other.active == active)&&(identical(other.failed, failed) || other.failed == failed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,wait,active,failed);

@override
String toString() {
  return 'ServerStatusQueue(wait: $wait, active: $active, failed: $failed)';
}


}

/// @nodoc
abstract mixin class _$ServerStatusQueueCopyWith<$Res> implements $ServerStatusQueueCopyWith<$Res> {
  factory _$ServerStatusQueueCopyWith(_ServerStatusQueue value, $Res Function(_ServerStatusQueue) _then) = __$ServerStatusQueueCopyWithImpl;
@override @useResult
$Res call({
 int wait, int active, int failed
});




}
/// @nodoc
class __$ServerStatusQueueCopyWithImpl<$Res>
    implements _$ServerStatusQueueCopyWith<$Res> {
  __$ServerStatusQueueCopyWithImpl(this._self, this._then);

  final _ServerStatusQueue _self;
  final $Res Function(_ServerStatusQueue) _then;

/// Create a copy of ServerStatusQueue
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? wait = null,Object? active = null,Object? failed = null,}) {
  return _then(_ServerStatusQueue(
wait: null == wait ? _self.wait : wait // ignore: cast_nullable_to_non_nullable
as int,active: null == active ? _self.active : active // ignore: cast_nullable_to_non_nullable
as int,failed: null == failed ? _self.failed : failed // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ServerStatusSnapshot {

 String get timestamp; int get uptimeSeconds; int get httpRequestsTotal; int get httpErrorsTotal; double? get latencyP50Ms; double? get latencyP95Ms; double? get eventLoopLagMs; int get memoryRssBytes; int get cpuSecondsTotal; bool get applicationReady; bool get databaseReady; bool get redisReady; ServerStatusQueue get queue; int get activeSockets;
/// Create a copy of ServerStatusSnapshot
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ServerStatusSnapshotCopyWith<ServerStatusSnapshot> get copyWith => _$ServerStatusSnapshotCopyWithImpl<ServerStatusSnapshot>(this as ServerStatusSnapshot, _$identity);

  /// Serializes this ServerStatusSnapshot to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ServerStatusSnapshot&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.uptimeSeconds, uptimeSeconds) || other.uptimeSeconds == uptimeSeconds)&&(identical(other.httpRequestsTotal, httpRequestsTotal) || other.httpRequestsTotal == httpRequestsTotal)&&(identical(other.httpErrorsTotal, httpErrorsTotal) || other.httpErrorsTotal == httpErrorsTotal)&&(identical(other.latencyP50Ms, latencyP50Ms) || other.latencyP50Ms == latencyP50Ms)&&(identical(other.latencyP95Ms, latencyP95Ms) || other.latencyP95Ms == latencyP95Ms)&&(identical(other.eventLoopLagMs, eventLoopLagMs) || other.eventLoopLagMs == eventLoopLagMs)&&(identical(other.memoryRssBytes, memoryRssBytes) || other.memoryRssBytes == memoryRssBytes)&&(identical(other.cpuSecondsTotal, cpuSecondsTotal) || other.cpuSecondsTotal == cpuSecondsTotal)&&(identical(other.applicationReady, applicationReady) || other.applicationReady == applicationReady)&&(identical(other.databaseReady, databaseReady) || other.databaseReady == databaseReady)&&(identical(other.redisReady, redisReady) || other.redisReady == redisReady)&&(identical(other.queue, queue) || other.queue == queue)&&(identical(other.activeSockets, activeSockets) || other.activeSockets == activeSockets));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,timestamp,uptimeSeconds,httpRequestsTotal,httpErrorsTotal,latencyP50Ms,latencyP95Ms,eventLoopLagMs,memoryRssBytes,cpuSecondsTotal,applicationReady,databaseReady,redisReady,queue,activeSockets);

@override
String toString() {
  return 'ServerStatusSnapshot(timestamp: $timestamp, uptimeSeconds: $uptimeSeconds, httpRequestsTotal: $httpRequestsTotal, httpErrorsTotal: $httpErrorsTotal, latencyP50Ms: $latencyP50Ms, latencyP95Ms: $latencyP95Ms, eventLoopLagMs: $eventLoopLagMs, memoryRssBytes: $memoryRssBytes, cpuSecondsTotal: $cpuSecondsTotal, applicationReady: $applicationReady, databaseReady: $databaseReady, redisReady: $redisReady, queue: $queue, activeSockets: $activeSockets)';
}


}

/// @nodoc
abstract mixin class $ServerStatusSnapshotCopyWith<$Res>  {
  factory $ServerStatusSnapshotCopyWith(ServerStatusSnapshot value, $Res Function(ServerStatusSnapshot) _then) = _$ServerStatusSnapshotCopyWithImpl;
@useResult
$Res call({
 String timestamp, int uptimeSeconds, int httpRequestsTotal, int httpErrorsTotal, double? latencyP50Ms, double? latencyP95Ms, double? eventLoopLagMs, int memoryRssBytes, int cpuSecondsTotal, bool applicationReady, bool databaseReady, bool redisReady, ServerStatusQueue queue, int activeSockets
});


$ServerStatusQueueCopyWith<$Res> get queue;

}
/// @nodoc
class _$ServerStatusSnapshotCopyWithImpl<$Res>
    implements $ServerStatusSnapshotCopyWith<$Res> {
  _$ServerStatusSnapshotCopyWithImpl(this._self, this._then);

  final ServerStatusSnapshot _self;
  final $Res Function(ServerStatusSnapshot) _then;

/// Create a copy of ServerStatusSnapshot
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? timestamp = null,Object? uptimeSeconds = null,Object? httpRequestsTotal = null,Object? httpErrorsTotal = null,Object? latencyP50Ms = freezed,Object? latencyP95Ms = freezed,Object? eventLoopLagMs = freezed,Object? memoryRssBytes = null,Object? cpuSecondsTotal = null,Object? applicationReady = null,Object? databaseReady = null,Object? redisReady = null,Object? queue = null,Object? activeSockets = null,}) {
  return _then(ServerStatusSnapshot(
timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,uptimeSeconds: null == uptimeSeconds ? _self.uptimeSeconds : uptimeSeconds // ignore: cast_nullable_to_non_nullable
as int,httpRequestsTotal: null == httpRequestsTotal ? _self.httpRequestsTotal : httpRequestsTotal // ignore: cast_nullable_to_non_nullable
as int,httpErrorsTotal: null == httpErrorsTotal ? _self.httpErrorsTotal : httpErrorsTotal // ignore: cast_nullable_to_non_nullable
as int,latencyP50Ms: freezed == latencyP50Ms ? _self.latencyP50Ms : latencyP50Ms // ignore: cast_nullable_to_non_nullable
as double?,latencyP95Ms: freezed == latencyP95Ms ? _self.latencyP95Ms : latencyP95Ms // ignore: cast_nullable_to_non_nullable
as double?,eventLoopLagMs: freezed == eventLoopLagMs ? _self.eventLoopLagMs : eventLoopLagMs // ignore: cast_nullable_to_non_nullable
as double?,memoryRssBytes: null == memoryRssBytes ? _self.memoryRssBytes : memoryRssBytes // ignore: cast_nullable_to_non_nullable
as int,cpuSecondsTotal: null == cpuSecondsTotal ? _self.cpuSecondsTotal : cpuSecondsTotal // ignore: cast_nullable_to_non_nullable
as int,applicationReady: null == applicationReady ? _self.applicationReady : applicationReady // ignore: cast_nullable_to_non_nullable
as bool,databaseReady: null == databaseReady ? _self.databaseReady : databaseReady // ignore: cast_nullable_to_non_nullable
as bool,redisReady: null == redisReady ? _self.redisReady : redisReady // ignore: cast_nullable_to_non_nullable
as bool,queue: null == queue ? _self.queue : queue // ignore: cast_nullable_to_non_nullable
as ServerStatusQueue,activeSockets: null == activeSockets ? _self.activeSockets : activeSockets // ignore: cast_nullable_to_non_nullable
as int,
  ));
}
/// Create a copy of ServerStatusSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ServerStatusQueueCopyWith<$Res> get queue {
  
  return $ServerStatusQueueCopyWith<$Res>(_self.queue, (value) {
    return _then(_self.copyWith(queue: value));
  });
}
}


/// Adds pattern-matching-related methods to [ServerStatusSnapshot].
extension ServerStatusSnapshotPatterns on ServerStatusSnapshot {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ServerStatusSnapshot value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ServerStatusSnapshot() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ServerStatusSnapshot value)  $default,){
final _that = this;
switch (_that) {
case _ServerStatusSnapshot():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ServerStatusSnapshot value)?  $default,){
final _that = this;
switch (_that) {
case _ServerStatusSnapshot() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String timestamp,  int uptimeSeconds,  int httpRequestsTotal,  int httpErrorsTotal,  double? latencyP50Ms,  double? latencyP95Ms,  double? eventLoopLagMs,  int memoryRssBytes,  int cpuSecondsTotal,  bool applicationReady,  bool databaseReady,  bool redisReady,  ServerStatusQueue queue,  int activeSockets)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ServerStatusSnapshot() when $default != null:
return $default(_that.timestamp,_that.uptimeSeconds,_that.httpRequestsTotal,_that.httpErrorsTotal,_that.latencyP50Ms,_that.latencyP95Ms,_that.eventLoopLagMs,_that.memoryRssBytes,_that.cpuSecondsTotal,_that.applicationReady,_that.databaseReady,_that.redisReady,_that.queue,_that.activeSockets);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String timestamp,  int uptimeSeconds,  int httpRequestsTotal,  int httpErrorsTotal,  double? latencyP50Ms,  double? latencyP95Ms,  double? eventLoopLagMs,  int memoryRssBytes,  int cpuSecondsTotal,  bool applicationReady,  bool databaseReady,  bool redisReady,  ServerStatusQueue queue,  int activeSockets)  $default,) {final _that = this;
switch (_that) {
case _ServerStatusSnapshot():
return $default(_that.timestamp,_that.uptimeSeconds,_that.httpRequestsTotal,_that.httpErrorsTotal,_that.latencyP50Ms,_that.latencyP95Ms,_that.eventLoopLagMs,_that.memoryRssBytes,_that.cpuSecondsTotal,_that.applicationReady,_that.databaseReady,_that.redisReady,_that.queue,_that.activeSockets);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String timestamp,  int uptimeSeconds,  int httpRequestsTotal,  int httpErrorsTotal,  double? latencyP50Ms,  double? latencyP95Ms,  double? eventLoopLagMs,  int memoryRssBytes,  int cpuSecondsTotal,  bool applicationReady,  bool databaseReady,  bool redisReady,  ServerStatusQueue queue,  int activeSockets)?  $default,) {final _that = this;
switch (_that) {
case _ServerStatusSnapshot() when $default != null:
return $default(_that.timestamp,_that.uptimeSeconds,_that.httpRequestsTotal,_that.httpErrorsTotal,_that.latencyP50Ms,_that.latencyP95Ms,_that.eventLoopLagMs,_that.memoryRssBytes,_that.cpuSecondsTotal,_that.applicationReady,_that.databaseReady,_that.redisReady,_that.queue,_that.activeSockets);case _:
  return null;

}
}

}

/// @nodoc

@JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
class _ServerStatusSnapshot implements ServerStatusSnapshot {
  const _ServerStatusSnapshot({required this.timestamp, this.uptimeSeconds = 0, this.httpRequestsTotal = 0, this.httpErrorsTotal = 0, this.latencyP50Ms, this.latencyP95Ms, this.eventLoopLagMs, this.memoryRssBytes = 0, this.cpuSecondsTotal = 0, this.applicationReady = false, this.databaseReady = false, this.redisReady = false, this.queue = const ServerStatusQueue(), this.activeSockets = 0});
  factory _ServerStatusSnapshot.fromJson(Map<String, dynamic> json) => _$ServerStatusSnapshotFromJson(json);

@override final  String timestamp;
@override@JsonKey() final  int uptimeSeconds;
@override@JsonKey() final  int httpRequestsTotal;
@override@JsonKey() final  int httpErrorsTotal;
@override final  double? latencyP50Ms;
@override final  double? latencyP95Ms;
@override final  double? eventLoopLagMs;
@override@JsonKey() final  int memoryRssBytes;
@override@JsonKey() final  int cpuSecondsTotal;
@override@JsonKey() final  bool applicationReady;
@override@JsonKey() final  bool databaseReady;
@override@JsonKey() final  bool redisReady;
@override@JsonKey() final  ServerStatusQueue queue;
@override@JsonKey() final  int activeSockets;

/// Create a copy of ServerStatusSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ServerStatusSnapshotCopyWith<_ServerStatusSnapshot> get copyWith => __$ServerStatusSnapshotCopyWithImpl<_ServerStatusSnapshot>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ServerStatusSnapshotToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ServerStatusSnapshot&&(identical(other.timestamp, timestamp) || other.timestamp == timestamp)&&(identical(other.uptimeSeconds, uptimeSeconds) || other.uptimeSeconds == uptimeSeconds)&&(identical(other.httpRequestsTotal, httpRequestsTotal) || other.httpRequestsTotal == httpRequestsTotal)&&(identical(other.httpErrorsTotal, httpErrorsTotal) || other.httpErrorsTotal == httpErrorsTotal)&&(identical(other.latencyP50Ms, latencyP50Ms) || other.latencyP50Ms == latencyP50Ms)&&(identical(other.latencyP95Ms, latencyP95Ms) || other.latencyP95Ms == latencyP95Ms)&&(identical(other.eventLoopLagMs, eventLoopLagMs) || other.eventLoopLagMs == eventLoopLagMs)&&(identical(other.memoryRssBytes, memoryRssBytes) || other.memoryRssBytes == memoryRssBytes)&&(identical(other.cpuSecondsTotal, cpuSecondsTotal) || other.cpuSecondsTotal == cpuSecondsTotal)&&(identical(other.applicationReady, applicationReady) || other.applicationReady == applicationReady)&&(identical(other.databaseReady, databaseReady) || other.databaseReady == databaseReady)&&(identical(other.redisReady, redisReady) || other.redisReady == redisReady)&&(identical(other.queue, queue) || other.queue == queue)&&(identical(other.activeSockets, activeSockets) || other.activeSockets == activeSockets));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,timestamp,uptimeSeconds,httpRequestsTotal,httpErrorsTotal,latencyP50Ms,latencyP95Ms,eventLoopLagMs,memoryRssBytes,cpuSecondsTotal,applicationReady,databaseReady,redisReady,queue,activeSockets);

@override
String toString() {
  return 'ServerStatusSnapshot(timestamp: $timestamp, uptimeSeconds: $uptimeSeconds, httpRequestsTotal: $httpRequestsTotal, httpErrorsTotal: $httpErrorsTotal, latencyP50Ms: $latencyP50Ms, latencyP95Ms: $latencyP95Ms, eventLoopLagMs: $eventLoopLagMs, memoryRssBytes: $memoryRssBytes, cpuSecondsTotal: $cpuSecondsTotal, applicationReady: $applicationReady, databaseReady: $databaseReady, redisReady: $redisReady, queue: $queue, activeSockets: $activeSockets)';
}


}

/// @nodoc
abstract mixin class _$ServerStatusSnapshotCopyWith<$Res> implements $ServerStatusSnapshotCopyWith<$Res> {
  factory _$ServerStatusSnapshotCopyWith(_ServerStatusSnapshot value, $Res Function(_ServerStatusSnapshot) _then) = __$ServerStatusSnapshotCopyWithImpl;
@override @useResult
$Res call({
 String timestamp, int uptimeSeconds, int httpRequestsTotal, int httpErrorsTotal, double? latencyP50Ms, double? latencyP95Ms, double? eventLoopLagMs, int memoryRssBytes, int cpuSecondsTotal, bool applicationReady, bool databaseReady, bool redisReady, ServerStatusQueue queue, int activeSockets
});


@override $ServerStatusQueueCopyWith<$Res> get queue;

}
/// @nodoc
class __$ServerStatusSnapshotCopyWithImpl<$Res>
    implements _$ServerStatusSnapshotCopyWith<$Res> {
  __$ServerStatusSnapshotCopyWithImpl(this._self, this._then);

  final _ServerStatusSnapshot _self;
  final $Res Function(_ServerStatusSnapshot) _then;

/// Create a copy of ServerStatusSnapshot
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? timestamp = null,Object? uptimeSeconds = null,Object? httpRequestsTotal = null,Object? httpErrorsTotal = null,Object? latencyP50Ms = freezed,Object? latencyP95Ms = freezed,Object? eventLoopLagMs = freezed,Object? memoryRssBytes = null,Object? cpuSecondsTotal = null,Object? applicationReady = null,Object? databaseReady = null,Object? redisReady = null,Object? queue = null,Object? activeSockets = null,}) {
  return _then(_ServerStatusSnapshot(
timestamp: null == timestamp ? _self.timestamp : timestamp // ignore: cast_nullable_to_non_nullable
as String,uptimeSeconds: null == uptimeSeconds ? _self.uptimeSeconds : uptimeSeconds // ignore: cast_nullable_to_non_nullable
as int,httpRequestsTotal: null == httpRequestsTotal ? _self.httpRequestsTotal : httpRequestsTotal // ignore: cast_nullable_to_non_nullable
as int,httpErrorsTotal: null == httpErrorsTotal ? _self.httpErrorsTotal : httpErrorsTotal // ignore: cast_nullable_to_non_nullable
as int,latencyP50Ms: freezed == latencyP50Ms ? _self.latencyP50Ms : latencyP50Ms // ignore: cast_nullable_to_non_nullable
as double?,latencyP95Ms: freezed == latencyP95Ms ? _self.latencyP95Ms : latencyP95Ms // ignore: cast_nullable_to_non_nullable
as double?,eventLoopLagMs: freezed == eventLoopLagMs ? _self.eventLoopLagMs : eventLoopLagMs // ignore: cast_nullable_to_non_nullable
as double?,memoryRssBytes: null == memoryRssBytes ? _self.memoryRssBytes : memoryRssBytes // ignore: cast_nullable_to_non_nullable
as int,cpuSecondsTotal: null == cpuSecondsTotal ? _self.cpuSecondsTotal : cpuSecondsTotal // ignore: cast_nullable_to_non_nullable
as int,applicationReady: null == applicationReady ? _self.applicationReady : applicationReady // ignore: cast_nullable_to_non_nullable
as bool,databaseReady: null == databaseReady ? _self.databaseReady : databaseReady // ignore: cast_nullable_to_non_nullable
as bool,redisReady: null == redisReady ? _self.redisReady : redisReady // ignore: cast_nullable_to_non_nullable
as bool,queue: null == queue ? _self.queue : queue // ignore: cast_nullable_to_non_nullable
as ServerStatusQueue,activeSockets: null == activeSockets ? _self.activeSockets : activeSockets // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

/// Create a copy of ServerStatusSnapshot
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ServerStatusQueueCopyWith<$Res> get queue {
  
  return $ServerStatusQueueCopyWith<$Res>(_self.queue, (value) {
    return _then(_self.copyWith(queue: value));
  });
}
}

// dart format on
