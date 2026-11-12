import 'package:freezed_annotation/freezed_annotation.dart';

import 'api.dart';
import 'support/wire_enum.dart';
import 'user.dart';

part 'dashboard.freezed.dart';
part 'dashboard.g.dart';

/// Mirrors `shared/src/types/dashboard.ts`.
enum AdminScopeKind {
  institution('institution'),
  department('department');

  const AdminScopeKind(this.wire);

  final String wire;

  static final Map<String, AdminScopeKind> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AdminScopeKind fromWire(String value) =>
      decodeWireEnum('AdminScopeKind', value, byWire);

  static AdminScopeKind? tryParse(String value) => byWire[value];
}

class AdminScopeKindConverter extends JsonConverter<AdminScopeKind, String> {
  const AdminScopeKindConverter();

  @override
  AdminScopeKind fromJson(String json) => AdminScopeKind.fromWire(json);

  @override
  String toJson(AdminScopeKind object) => object.wire;
}

enum AdminOverviewHealthStatus {
  ok('ok'),
  unavailable('unavailable');

  const AdminOverviewHealthStatus(this.wire);

  final String wire;

  static final Map<String, AdminOverviewHealthStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AdminOverviewHealthStatus fromWire(String value) =>
      decodeWireEnum('AdminOverviewHealthStatus', value, byWire);
}

class AdminOverviewHealthStatusConverter
    extends JsonConverter<AdminOverviewHealthStatus, String> {
  const AdminOverviewHealthStatusConverter();

  @override
  AdminOverviewHealthStatus fromJson(String json) =>
      AdminOverviewHealthStatus.fromWire(json);

  @override
  String toJson(AdminOverviewHealthStatus object) => object.wire;
}

enum AdminUserRoleFilter {
  superAdmin('super_admin'),
  teacher('teacher'),
  student('student');

  const AdminUserRoleFilter(this.wire);

  final String wire;

  static final Map<String, AdminUserRoleFilter> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AdminUserRoleFilter fromWire(String value) =>
      decodeWireEnum('AdminUserRoleFilter', value, byWire);

  static AdminUserRoleFilter? tryParse(String value) => byWire[value];
}

class AdminUserRoleFilterConverter
    extends JsonConverter<AdminUserRoleFilter, String> {
  const AdminUserRoleFilterConverter();

  @override
  AdminUserRoleFilter fromJson(String json) =>
      AdminUserRoleFilter.fromWire(json);

  @override
  String toJson(AdminUserRoleFilter object) => object.wire;
}

enum AdminUserStatusFilter {
  active('active'),
  inactive('inactive');

  const AdminUserStatusFilter(this.wire);

  final String wire;

  static final Map<String, AdminUserStatusFilter> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AdminUserStatusFilter fromWire(String value) =>
      decodeWireEnum('AdminUserStatusFilter', value, byWire);

  static AdminUserStatusFilter? tryParse(String value) => byWire[value];
}

class AdminUserStatusFilterConverter
    extends JsonConverter<AdminUserStatusFilter, String> {
  const AdminUserStatusFilterConverter();

  @override
  AdminUserStatusFilter fromJson(String json) =>
      AdminUserStatusFilter.fromWire(json);

  @override
  String toJson(AdminUserStatusFilter object) => object.wire;
}

/// Only student <-> teacher transitions are assignable.
enum AssignableRole {
  teacher('teacher'),
  student('student');

  const AssignableRole(this.wire);

  final String wire;

  static final Map<String, AssignableRole> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AssignableRole fromWire(String value) =>
      decodeWireEnum('AssignableRole', value, byWire);

  static AssignableRole? tryParse(String value) => byWire[value];
}

class AssignableRoleConverter extends JsonConverter<AssignableRole, String> {
  const AssignableRoleConverter();

  @override
  AssignableRole fromJson(String json) => AssignableRole.fromWire(json);

  @override
  String toJson(AssignableRole object) => object.wire;
}

@freezed
abstract class AdminOverviewHealth with _$AdminOverviewHealth {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AdminOverviewHealthStatusConverter()],
  )
  const factory AdminOverviewHealth({
    required AdminOverviewHealthStatus status,
    required String timestamp,
    @Default(false) bool database,
    @Default(false) bool redis,
  }) = _AdminOverviewHealth;

  factory AdminOverviewHealth.fromJson(Map<String, dynamic> json) =>
      _$AdminOverviewHealthFromJson(json);
}

@freezed
abstract class AdminOverviewCounts with _$AdminOverviewCounts {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AdminOverviewCounts({
    @Default(0) int activeFaculty,
    @Default(0) int disabledFaculty,
    @Default(0) int activeStudents,
    @Default(0) int disabledStudents,
    @Default(0) int activeSessions,
    @Default(0) int pendingDisputes,
  }) = _AdminOverviewCounts;

  factory AdminOverviewCounts.fromJson(Map<String, dynamic> json) =>
      _$AdminOverviewCountsFromJson(json);
}

@freezed
abstract class AdminOverview with _$AdminOverview {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AdminScopeKindConverter()],
  )
  const factory AdminOverview({
    required AdminScopeKind scope,
    String? department,
    required AdminOverviewCounts counts,
    required AdminOverviewHealth health,
    @Default(<AuditLogEntry>[]) List<AuditLogEntry> recentActivity,
  }) = _AdminOverview;

  factory AdminOverview.fromJson(Map<String, dynamic> json) =>
      _$AdminOverviewFromJson(json);
}

@freezed
abstract class AdminUserFilters with _$AdminUserFilters {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [
      AdminUserRoleFilterConverter(),
      AdminUserStatusFilterConverter(),
    ],
  )
  const factory AdminUserFilters({
    AdminUserRoleFilter? role,
    String? q,
    String? department,
    AdminUserStatusFilter? status,
    int? limit,
    int? offset,
  }) = _AdminUserFilters;

  factory AdminUserFilters.fromJson(Map<String, dynamic> json) =>
      _$AdminUserFiltersFromJson(json);
}

@freezed
abstract class AdminUserPage with _$AdminUserPage {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AdminUserPage({
    @Default(<User>[]) List<User> data,
    @Default(0) int total,
    @Default(0) int limit,
    @Default(0) int offset,
    @Default(false) bool hasMore,
  }) = _AdminUserPage;

  factory AdminUserPage.fromJson(Map<String, dynamic> json) =>
      _$AdminUserPageFromJson(json);
}

@freezed
abstract class UpdateUserInput with _$UpdateUserInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory UpdateUserInput({
    String? fullName,
    String? department,
    String? email,
    String? program,
    int? yearLevel,
    bool? canResetStudentPasswords,
    bool? canEmergencyUnbindDevices,
    bool? isItCoordinator,
    bool? isDepartmentHead,
    bool? isUserRegistrar,
  }) = _UpdateUserInput;

  factory UpdateUserInput.fromJson(Map<String, dynamic> json) =>
      _$UpdateUserInputFromJson(json);
}

@freezed
abstract class CreateAdminInput with _$CreateAdminInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory CreateAdminInput({
    String? userId,
    String? fullName,
    String? email,
    String? password,
    String? department,
  }) = _CreateAdminInput;

  factory CreateAdminInput.fromJson(Map<String, dynamic> json) =>
      _$CreateAdminInputFromJson(json);
}

@freezed
abstract class ServerStatusQueue with _$ServerStatusQueue {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory ServerStatusQueue({
    @Default(0) int wait,
    @Default(0) int active,
    @Default(0) int failed,
  }) = _ServerStatusQueue;

  factory ServerStatusQueue.fromJson(Map<String, dynamic> json) =>
      _$ServerStatusQueueFromJson(json);
}

@freezed
abstract class ServerStatusSnapshot with _$ServerStatusSnapshot {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory ServerStatusSnapshot({
    required String timestamp,
    @Default(0) int uptimeSeconds,
    @Default(0) int httpRequestsTotal,
    @Default(0) int httpErrorsTotal,
    double? latencyP50Ms,
    double? latencyP95Ms,
    double? eventLoopLagMs,
    @Default(0) int memoryRssBytes,
    @Default(0) int cpuSecondsTotal,
    @Default(false) bool applicationReady,
    @Default(false) bool databaseReady,
    @Default(false) bool redisReady,
    @Default(ServerStatusQueue()) ServerStatusQueue queue,
    @Default(0) int activeSockets,
  }) = _ServerStatusSnapshot;

  factory ServerStatusSnapshot.fromJson(Map<String, dynamic> json) =>
      _$ServerStatusSnapshotFromJson(json);
}

abstract final class ServerStatusEvents {
  static const String metrics = 'server:metrics';
  static const String subscribe = 'server:subscribe';
  static const String subscribed = 'server:subscribed';
  static const String unsubscribe = 'server:unsubscribe';
  static const String metricsRoom = 'server:metrics';
}
