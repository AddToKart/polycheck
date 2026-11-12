import '../../../core/models/system_report.dart';
import '../../../core/models/user.dart';
import '../../../core/utils/designations.dart';

/// Triage derivations for the system-reports cockpit.
const int systemReportPageSize = 20;
const int maxSystemReportPageSize = 100;

class SystemReportFilterState {
  const SystemReportFilterState({
    this.category,
    this.severity,
    this.status,
    this.role,
    this.search = '',
    this.startDate,
    this.endDate,
    this.offset = 0,
    this.limit = systemReportPageSize,
  });

  final ReportCategory? category;
  final ReportSeverity? severity;
  final ReportStatus? status;
  final String? role;
  final String search;
  final String? startDate;
  final String? endDate;
  final int offset;
  final int limit;

  SystemReportFilterState copyWith({
    ReportCategory? category,
    bool clearCategory = false,
    ReportSeverity? severity,
    bool clearSeverity = false,
    ReportStatus? status,
    bool clearStatus = false,
    String? role,
    bool clearRole = false,
    String? search,
    String? startDate,
    String? endDate,
    int? offset,
    int? limit,
  }) {
    return SystemReportFilterState(
      category: clearCategory ? null : (category ?? this.category),
      severity: clearSeverity ? null : (severity ?? this.severity),
      status: clearStatus ? null : (status ?? this.status),
      role: clearRole ? null : (role ?? this.role),
      search: search ?? this.search,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      offset: offset ?? this.offset,
      limit: limit ?? this.limit,
    );
  }
}

SystemReportFilters buildSystemReportFilters(SystemReportFilterState state) {
  final query = state.search.trim();
  return SystemReportFilters(
    category: state.category,
    severity: state.severity,
    status: state.status,
    role: state.role,
    search: query.isEmpty ? null : query,
    startDate: state.startDate,
    endDate: state.endDate,
    limit: state.limit.clamp(1, maxSystemReportPageSize),
    offset: state.offset < 0 ? 0 : state.offset,
  );
}

class SystemReportMetrics {
  const SystemReportMetrics({
    required this.unresolved,
    required this.scannerAndGps,
    required this.resolvedThisMonth,
    required this.critical,
    required this.total,
  });

  final int unresolved;
  final int scannerAndGps;
  final int resolvedThisMonth;
  final int critical;
  final int total;
}

SystemReportMetrics metricsFromStats(SystemReportStats stats) {
  return SystemReportMetrics(
    unresolved: stats.open + stats.inReview,
    scannerAndGps: stats.scannerAndGps,
    resolvedThisMonth: stats.resolvedThisMonth,
    critical: stats.critical,
    total: stats.total,
  );
}

class ReportTelemetryRow {
  const ReportTelemetryRow({required this.label, required this.value});

  final String label;
  final String value;
}

String networkTypeLabel(String? value) {
  return switch (value?.trim().toLowerCase()) {
    'wifi' => 'Wi-Fi',
    'cellular' => 'Cellular',
    'online' => 'Online',
    'offline' => 'Offline',
    _ => 'Unknown',
  };
}

String reportRoleLabel(UserRole role) {
  return switch (role) {
    UserRole.student => 'Student',
    UserRole.teacher => 'Teacher',
    UserRole.superAdmin => 'Super admin',
  };
}

String reportSubmitterLabel(SystemReport report) {
  final name = report.user.fullName.trim();
  final resolved = name.isEmpty ? 'Unknown account' : name;
  return '$resolved · ${reportRoleLabel(report.user.role)}';
}

String? routeLabel(String? route) {
  final value = route?.trim();
  if (value == null || value.isEmpty) return null;
  return value;
}

/// Ordered rows for the detail sheet telemetry grid.
List<ReportTelemetryRow> reportTelemetryRows(SystemReport report) {
  return <ReportTelemetryRow>[
    ReportTelemetryRow(
      label: 'Device',
      value: (report.deviceInfo ?? '').trim().isEmpty
          ? 'Unknown device'
          : report.deviceInfo!.trim(),
    ),
    ReportTelemetryRow(
      label: 'App version',
      value: (report.appVersion ?? '').trim().isEmpty
          ? 'Unknown version'
          : report.appVersion!.trim(),
    ),
    ReportTelemetryRow(
      label: 'Screen',
      value: routeLabel(report.route) ?? 'Unknown screen',
    ),
    ReportTelemetryRow(
      label: 'Network',
      value: networkTypeLabel(report.networkType),
    ),
    ReportTelemetryRow(
      label: 'Submitted by',
      value: reportSubmitterLabel(report),
    ),
    ReportTelemetryRow(label: 'Report ID', value: report.id),
  ];
}

/// Department heads may read triage data but never transition a report. IT
/// coordinators (and super admins) hold the write capability.
bool systemReportReadOnly(PolyUser? user) {
  return canAccessAcademicOversight(user) && !canAccessItOperations(user);
}

bool canTriageSystemReports(PolyUser? user) => canAccessItOperations(user);
