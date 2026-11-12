// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_report.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ReportSubmitter _$ReportSubmitterFromJson(Map<String, dynamic> json) =>
    _ReportSubmitter(
      id: json['id'] as String,
      fullName: json['fullName'] as String? ?? '',
      role: const UserRoleConverter().fromJson(json['role'] as String),
      studentId: json['studentId'] as String?,
      email: json['email'] as String?,
      department: json['department'] as String?,
    );

Map<String, dynamic> _$ReportSubmitterToJson(_ReportSubmitter instance) =>
    <String, dynamic>{
      'id': instance.id,
      'fullName': instance.fullName,
      'role': const UserRoleConverter().toJson(instance.role),
      'studentId': instance.studentId,
      'email': instance.email,
      'department': instance.department,
    };

_SystemReport _$SystemReportFromJson(Map<String, dynamic> json) =>
    _SystemReport(
      id: json['id'] as String,
      category: const ReportCategoryConverter().fromJson(
        json['category'] as String,
      ),
      severity: const ReportSeverityConverter().fromJson(
        json['severity'] as String,
      ),
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      status: const ReportStatusConverter().fromJson(json['status'] as String),
      deviceInfo: json['deviceInfo'] as String?,
      appVersion: json['appVersion'] as String?,
      route: json['route'] as String?,
      networkType: json['networkType'] as String?,
      screenshotUrl: json['screenshotUrl'] as String?,
      adminNotes: json['adminNotes'] as String?,
      resolvedAt: json['resolvedAt'] as String?,
      resolvedBy: json['resolvedBy'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      user: ReportSubmitter.fromJson(json['user'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$SystemReportToJson(_SystemReport instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': const ReportCategoryConverter().toJson(instance.category),
      'severity': const ReportSeverityConverter().toJson(instance.severity),
      'title': instance.title,
      'description': instance.description,
      'status': const ReportStatusConverter().toJson(instance.status),
      'deviceInfo': instance.deviceInfo,
      'appVersion': instance.appVersion,
      'route': instance.route,
      'networkType': instance.networkType,
      'screenshotUrl': instance.screenshotUrl,
      'adminNotes': instance.adminNotes,
      'resolvedAt': instance.resolvedAt,
      'resolvedBy': instance.resolvedBy,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
      'user': instance.user.toJson(),
    };

_CreateSystemReportInput _$CreateSystemReportInputFromJson(
  Map<String, dynamic> json,
) => _CreateSystemReportInput(
  category: const ReportCategoryConverter().fromJson(
    json['category'] as String,
  ),
  severity: const ReportSeverityConverter().fromJson(
    json['severity'] as String,
  ),
  title: json['title'] as String,
  description: json['description'] as String,
  screenshotData: json['screenshotData'] as String?,
  deviceInfo: json['deviceInfo'] as String?,
  appVersion: json['appVersion'] as String?,
  route: json['route'] as String?,
  networkType: json['networkType'] as String?,
);

Map<String, dynamic> _$CreateSystemReportInputToJson(
  _CreateSystemReportInput instance,
) => <String, dynamic>{
  'category': const ReportCategoryConverter().toJson(instance.category),
  'severity': const ReportSeverityConverter().toJson(instance.severity),
  'title': instance.title,
  'description': instance.description,
  'screenshotData': instance.screenshotData,
  'deviceInfo': instance.deviceInfo,
  'appVersion': instance.appVersion,
  'route': instance.route,
  'networkType': instance.networkType,
};

_UpdateSystemReportStatusInput _$UpdateSystemReportStatusInputFromJson(
  Map<String, dynamic> json,
) => _UpdateSystemReportStatusInput(
  status: const ReportStatusConverter().fromJson(json['status'] as String),
  adminNotes: json['adminNotes'] as String?,
);

Map<String, dynamic> _$UpdateSystemReportStatusInputToJson(
  _UpdateSystemReportStatusInput instance,
) => <String, dynamic>{
  'status': const ReportStatusConverter().toJson(instance.status),
  'adminNotes': instance.adminNotes,
};

_SystemReportFilters _$SystemReportFiltersFromJson(Map<String, dynamic> json) =>
    _SystemReportFilters(
      category: _$JsonConverterFromJson<String, ReportCategory>(
        json['category'],
        const ReportCategoryConverter().fromJson,
      ),
      severity: _$JsonConverterFromJson<String, ReportSeverity>(
        json['severity'],
        const ReportSeverityConverter().fromJson,
      ),
      status: _$JsonConverterFromJson<String, ReportStatus>(
        json['status'],
        const ReportStatusConverter().fromJson,
      ),
      role: json['role'] as String?,
      search: json['search'] as String?,
      startDate: json['startDate'] as String?,
      endDate: json['endDate'] as String?,
      limit: (json['limit'] as num?)?.toInt(),
      offset: (json['offset'] as num?)?.toInt(),
    );

Map<String, dynamic> _$SystemReportFiltersToJson(
  _SystemReportFilters instance,
) => <String, dynamic>{
  'category': _$JsonConverterToJson<String, ReportCategory>(
    instance.category,
    const ReportCategoryConverter().toJson,
  ),
  'severity': _$JsonConverterToJson<String, ReportSeverity>(
    instance.severity,
    const ReportSeverityConverter().toJson,
  ),
  'status': _$JsonConverterToJson<String, ReportStatus>(
    instance.status,
    const ReportStatusConverter().toJson,
  ),
  'role': instance.role,
  'search': instance.search,
  'startDate': instance.startDate,
  'endDate': instance.endDate,
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

_SystemReportPage _$SystemReportPageFromJson(Map<String, dynamic> json) =>
    _SystemReportPage(
      data:
          (json['data'] as List<dynamic>?)
              ?.map((e) => SystemReport.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <SystemReport>[],
      total: (json['total'] as num?)?.toInt() ?? 0,
      limit: (json['limit'] as num?)?.toInt() ?? 0,
      offset: (json['offset'] as num?)?.toInt() ?? 0,
      hasMore: json['hasMore'] as bool? ?? false,
    );

Map<String, dynamic> _$SystemReportPageToJson(_SystemReportPage instance) =>
    <String, dynamic>{
      'data': instance.data.map((e) => e.toJson()).toList(),
      'total': instance.total,
      'limit': instance.limit,
      'offset': instance.offset,
      'hasMore': instance.hasMore,
    };

_SystemReportStats _$SystemReportStatsFromJson(Map<String, dynamic> json) =>
    _SystemReportStats(
      total: (json['total'] as num?)?.toInt() ?? 0,
      open: (json['open'] as num?)?.toInt() ?? 0,
      inReview: (json['inReview'] as num?)?.toInt() ?? 0,
      resolved: (json['resolved'] as num?)?.toInt() ?? 0,
      dismissed: (json['dismissed'] as num?)?.toInt() ?? 0,
      scannerAndGps: (json['scannerAndGps'] as num?)?.toInt() ?? 0,
      resolvedThisMonth: (json['resolvedThisMonth'] as num?)?.toInt() ?? 0,
      critical: (json['critical'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$SystemReportStatsToJson(_SystemReportStats instance) =>
    <String, dynamic>{
      'total': instance.total,
      'open': instance.open,
      'inReview': instance.inReview,
      'resolved': instance.resolved,
      'dismissed': instance.dismissed,
      'scannerAndGps': instance.scannerAndGps,
      'resolvedThisMonth': instance.resolvedThisMonth,
      'critical': instance.critical,
    };
