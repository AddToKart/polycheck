import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/system_report.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/features/admin/domain/system_reports.dart';

const report = SystemReport(
  id: 'report-1',
  category: ReportCategory.scannerCamera,
  severity: ReportSeverity.critical,
  title: 'Scanner stuck',
  description: 'The camera preview freezes after a successful scan.',
  status: ReportStatus.open,
  deviceInfo: 'Android 15 · Pixel 7',
  appVersion: '1.0.0+1',
  route: '/scan',
  networkType: 'wifi',
  createdAt: '2026-11-10T01:02:03Z',
  updatedAt: '2026-11-10T01:02:03Z',
  user: ReportSubmitter(
    id: 'user-1',
    fullName: 'Maria Santos',
    role: UserRole.student,
    studentId: '2024-00001-MN-0',
  ),
);

void main() {
  test('filters map every cockpit control', () {
    final filters = buildSystemReportFilters(
      const SystemReportFilterState(
        category: ReportCategory.scannerCamera,
        severity: ReportSeverity.critical,
        status: ReportStatus.inReview,
        role: 'student',
        search: '  freeze  ',
        startDate: '2026-10-11',
        endDate: '2026-11-10',
        offset: 20,
        limit: 999,
      ),
    );
    expect(filters.category, ReportCategory.scannerCamera);
    expect(filters.severity, ReportSeverity.critical);
    expect(filters.status, ReportStatus.inReview);
    expect(filters.role, 'student');
    expect(filters.search, 'freeze');
    expect(filters.startDate, '2026-10-11');
    expect(filters.offset, 20);
    expect(filters.limit, maxSystemReportPageSize);
  });

  test('blank search is dropped', () {
    final filters = buildSystemReportFilters(
      const SystemReportFilterState(search: '   '),
    );
    expect(filters.search, isNull);
  });

  test('metric cards fold open and in-review into unresolved', () {
    final metrics = metricsFromStats(
      const SystemReportStats(
        total: 30,
        open: 4,
        inReview: 3,
        resolved: 20,
        dismissed: 3,
        scannerAndGps: 11,
        resolvedThisMonth: 6,
        critical: 2,
      ),
    );
    expect(metrics.unresolved, 7);
    expect(metrics.scannerAndGps, 11);
    expect(metrics.resolvedThisMonth, 6);
    expect(metrics.critical, 2);
    expect(metrics.total, 30);
  });

  test('telemetry grid uses captured diagnostics and fallbacks', () {
    final rows = reportTelemetryRows(report);
    final values = <String, String>{
      for (final row in rows) row.label: row.value,
    };
    expect(values['Device'], 'Android 15 · Pixel 7');
    expect(values['App version'], '1.0.0+1');
    expect(values['Screen'], '/scan');
    expect(values['Network'], 'Wi-Fi');
    expect(values['Submitted by'], 'Maria Santos · Student');
    expect(values['Report ID'], 'report-1');

    final fallback = reportTelemetryRows(
      report.copyWith(
        deviceInfo: null,
        appVersion: null,
        route: null,
        networkType: 'unknown',
      ),
    );
    final fallbackValues = <String, String>{
      for (final row in fallback) row.label: row.value,
    };
    expect(fallbackValues['Device'], 'Unknown device');
    expect(fallbackValues['App version'], 'Unknown version');
    expect(fallbackValues['Screen'], 'Unknown screen');
    expect(fallbackValues['Network'], 'Unknown');
  });

  test('network labels map the shared client union', () {
    expect(networkTypeLabel('wifi'), 'Wi-Fi');
    expect(networkTypeLabel('cellular'), 'Cellular');
    expect(networkTypeLabel('online'), 'Online');
    expect(networkTypeLabel('offline'), 'Offline');
    expect(networkTypeLabel(null), 'Unknown');
  });

  test('department heads read triage while IT writes it', () {
    const head = User(
      id: 'head',
      fullName: 'Head',
      role: UserRole.teacher,
      department: 'CCIS',
      isDepartmentHead: true,
    );
    const it = User(
      id: 'it',
      fullName: 'IT',
      role: UserRole.teacher,
      department: 'CCIS',
      isItCoordinator: true,
    );
    const admin = User(
      id: 'admin',
      fullName: 'Admin',
      role: UserRole.superAdmin,
    );
    expect(systemReportReadOnly(head), isTrue);
    expect(canTriageSystemReports(head), isFalse);
    expect(systemReportReadOnly(it), isFalse);
    expect(canTriageSystemReports(it), isTrue);
    expect(systemReportReadOnly(admin), isFalse);
    expect(canTriageSystemReports(admin), isTrue);
  });
}
