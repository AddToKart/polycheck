// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_AdminOverviewHealth _$AdminOverviewHealthFromJson(Map<String, dynamic> json) =>
    _AdminOverviewHealth(
      status: const AdminOverviewHealthStatusConverter().fromJson(
        json['status'] as String,
      ),
      timestamp: json['timestamp'] as String,
      database: json['database'] as bool? ?? false,
      redis: json['redis'] as bool? ?? false,
    );

Map<String, dynamic> _$AdminOverviewHealthToJson(
  _AdminOverviewHealth instance,
) => <String, dynamic>{
  'status': const AdminOverviewHealthStatusConverter().toJson(instance.status),
  'timestamp': instance.timestamp,
  'database': instance.database,
  'redis': instance.redis,
};

_AdminOverviewCounts _$AdminOverviewCountsFromJson(Map<String, dynamic> json) =>
    _AdminOverviewCounts(
      activeFaculty: (json['activeFaculty'] as num?)?.toInt() ?? 0,
      disabledFaculty: (json['disabledFaculty'] as num?)?.toInt() ?? 0,
      activeStudents: (json['activeStudents'] as num?)?.toInt() ?? 0,
      disabledStudents: (json['disabledStudents'] as num?)?.toInt() ?? 0,
      activeSessions: (json['activeSessions'] as num?)?.toInt() ?? 0,
      pendingDisputes: (json['pendingDisputes'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$AdminOverviewCountsToJson(
  _AdminOverviewCounts instance,
) => <String, dynamic>{
  'activeFaculty': instance.activeFaculty,
  'disabledFaculty': instance.disabledFaculty,
  'activeStudents': instance.activeStudents,
  'disabledStudents': instance.disabledStudents,
  'activeSessions': instance.activeSessions,
  'pendingDisputes': instance.pendingDisputes,
};

_AdminOverview _$AdminOverviewFromJson(
  Map<String, dynamic> json,
) => _AdminOverview(
  scope: const AdminScopeKindConverter().fromJson(json['scope'] as String),
  department: json['department'] as String?,
  counts: AdminOverviewCounts.fromJson(json['counts'] as Map<String, dynamic>),
  health: AdminOverviewHealth.fromJson(json['health'] as Map<String, dynamic>),
  recentActivity:
      (json['recentActivity'] as List<dynamic>?)
          ?.map((e) => AuditLogEntry.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <AuditLogEntry>[],
);

Map<String, dynamic> _$AdminOverviewToJson(_AdminOverview instance) =>
    <String, dynamic>{
      'scope': const AdminScopeKindConverter().toJson(instance.scope),
      'department': instance.department,
      'counts': instance.counts.toJson(),
      'health': instance.health.toJson(),
      'recentActivity': instance.recentActivity.map((e) => e.toJson()).toList(),
    };

_AdminUserFilters _$AdminUserFiltersFromJson(Map<String, dynamic> json) =>
    _AdminUserFilters(
      role: _$JsonConverterFromJson<String, AdminUserRoleFilter>(
        json['role'],
        const AdminUserRoleFilterConverter().fromJson,
      ),
      q: json['q'] as String?,
      department: json['department'] as String?,
      status: _$JsonConverterFromJson<String, AdminUserStatusFilter>(
        json['status'],
        const AdminUserStatusFilterConverter().fromJson,
      ),
      limit: (json['limit'] as num?)?.toInt(),
      offset: (json['offset'] as num?)?.toInt(),
    );

Map<String, dynamic> _$AdminUserFiltersToJson(_AdminUserFilters instance) =>
    <String, dynamic>{
      'role': _$JsonConverterToJson<String, AdminUserRoleFilter>(
        instance.role,
        const AdminUserRoleFilterConverter().toJson,
      ),
      'q': instance.q,
      'department': instance.department,
      'status': _$JsonConverterToJson<String, AdminUserStatusFilter>(
        instance.status,
        const AdminUserStatusFilterConverter().toJson,
      ),
      'limit': instance.limit,
      'offset': instance.offset,
    };

Value? _$JsonConverterFromJson<Json, Value>(
  Object? json,
  Value? Function(Json json) fromJson,
) => json == null ? null : fromJson(json as Json);

Json? _$JsonConverterToJson<Json, Value>(
  Value? value,
  Json? Function(Value value) toJson,
) => value == null ? null : toJson(value);

_AdminUserPage _$AdminUserPageFromJson(Map<String, dynamic> json) =>
    _AdminUserPage(
      data:
          (json['data'] as List<dynamic>?)
              ?.map((e) => User.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <User>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
      limit: (json['limit'] as num?)?.toInt() ?? 0,
      offset: (json['offset'] as num?)?.toInt() ?? 0,
      hasMore: json['hasMore'] as bool? ?? false,
    );

Map<String, dynamic> _$AdminUserPageToJson(_AdminUserPage instance) =>
    <String, dynamic>{
      'data': instance.data.map((e) => e.toJson()).toList(),
      'total': instance.total,
      'limit': instance.limit,
      'offset': instance.offset,
      'hasMore': instance.hasMore,
    };

_UpdateUserInput _$UpdateUserInputFromJson(Map<String, dynamic> json) =>
    _UpdateUserInput(
      fullName: json['fullName'] as String?,
      department: json['department'] as String?,
      email: json['email'] as String?,
      program: json['program'] as String?,
      yearLevel: (json['yearLevel'] as num?)?.toInt(),
      canResetStudentPasswords: json['canResetStudentPasswords'] as bool?,
      canEmergencyUnbindDevices: json['canEmergencyUnbindDevices'] as bool?,
      isItCoordinator: json['isItCoordinator'] as bool?,
      isDepartmentHead: json['isDepartmentHead'] as bool?,
      isUserRegistrar: json['isUserRegistrar'] as bool?,
    );

Map<String, dynamic> _$UpdateUserInputToJson(_UpdateUserInput instance) =>
    <String, dynamic>{
      'fullName': instance.fullName,
      'department': instance.department,
      'email': instance.email,
      'program': instance.program,
      'yearLevel': instance.yearLevel,
      'canResetStudentPasswords': instance.canResetStudentPasswords,
      'canEmergencyUnbindDevices': instance.canEmergencyUnbindDevices,
      'isItCoordinator': instance.isItCoordinator,
      'isDepartmentHead': instance.isDepartmentHead,
      'isUserRegistrar': instance.isUserRegistrar,
    };

_CreateAdminInput _$CreateAdminInputFromJson(Map<String, dynamic> json) =>
    _CreateAdminInput(
      userId: json['userId'] as String?,
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      password: json['password'] as String?,
      department: json['department'] as String?,
    );

Map<String, dynamic> _$CreateAdminInputToJson(_CreateAdminInput instance) =>
    <String, dynamic>{
      'userId': instance.userId,
      'fullName': instance.fullName,
      'email': instance.email,
      'password': instance.password,
      'department': instance.department,
    };

_ServerStatusQueue _$ServerStatusQueueFromJson(Map<String, dynamic> json) =>
    _ServerStatusQueue(
      wait: (json['wait'] as num?)?.toInt() ?? 0,
      active: (json['active'] as num?)?.toInt() ?? 0,
      failed: (json['failed'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$ServerStatusQueueToJson(_ServerStatusQueue instance) =>
    <String, dynamic>{
      'wait': instance.wait,
      'active': instance.active,
      'failed': instance.failed,
    };

_ServerStatusSnapshot _$ServerStatusSnapshotFromJson(
  Map<String, dynamic> json,
) => _ServerStatusSnapshot(
  timestamp: json['timestamp'] as String,
  uptimeSeconds: (json['uptimeSeconds'] as num?)?.toInt() ?? 0,
  httpRequestsTotal: (json['httpRequestsTotal'] as num?)?.toInt() ?? 0,
  httpErrorsTotal: (json['httpErrorsTotal'] as num?)?.toInt() ?? 0,
  latencyP50Ms: (json['latencyP50Ms'] as num?)?.toDouble(),
  latencyP95Ms: (json['latencyP95Ms'] as num?)?.toDouble(),
  eventLoopLagMs: (json['eventLoopLagMs'] as num?)?.toDouble(),
  memoryRssBytes: (json['memoryRssBytes'] as num?)?.toInt() ?? 0,
  cpuSecondsTotal: (json['cpuSecondsTotal'] as num?)?.toInt() ?? 0,
  applicationReady: json['applicationReady'] as bool? ?? false,
  databaseReady: json['databaseReady'] as bool? ?? false,
  redisReady: json['redisReady'] as bool? ?? false,
  queue: json['queue'] == null
      ? const ServerStatusQueue()
      : ServerStatusQueue.fromJson(json['queue'] as Map<String, dynamic>),
  activeSockets: (json['activeSockets'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$ServerStatusSnapshotToJson(
  _ServerStatusSnapshot instance,
) => <String, dynamic>{
  'timestamp': instance.timestamp,
  'uptimeSeconds': instance.uptimeSeconds,
  'httpRequestsTotal': instance.httpRequestsTotal,
  'httpErrorsTotal': instance.httpErrorsTotal,
  'latencyP50Ms': instance.latencyP50Ms,
  'latencyP95Ms': instance.latencyP95Ms,
  'eventLoopLagMs': instance.eventLoopLagMs,
  'memoryRssBytes': instance.memoryRssBytes,
  'cpuSecondsTotal': instance.cpuSecondsTotal,
  'applicationReady': instance.applicationReady,
  'databaseReady': instance.databaseReady,
  'redisReady': instance.redisReady,
  'queue': instance.queue.toJson(),
  'activeSockets': instance.activeSockets,
};
