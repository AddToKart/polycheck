import 'dart:typed_data';

import '../models/system_report.dart';
import 'api_base.dart';

/// System issue / feedback reporting (submitter and IT triage surfaces).
class ReportsApi extends ApiBase {
  ReportsApi(super.dio);

  Future<SystemReport> createSystemReport(CreateSystemReportInput input) async {
    final data = await postJson('/reports', body: input.toJson());
    return SystemReport.fromJson(asMap(data));
  }

  Future<List<SystemReport>> getMySystemReports() async {
    final data = await getJson('/reports/my');
    return asList(data)
        .whereType<Map>()
        .map((item) => SystemReport.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<SystemReportPage> getSystemReports([
    SystemReportFilters filters = const SystemReportFilters(),
  ]) async {
    final data = await getJson('/reports', query: _clean(filters.toJson()));
    return SystemReportPage.fromJson(asMap(data));
  }

  Future<SystemReportStats> getSystemReportStats() async {
    final data = await getJson('/reports/stats');
    return SystemReportStats.fromJson(asMap(data));
  }

  Future<SystemReport> getSystemReport(String id) async {
    final data = await getJson('/reports/$id');
    return SystemReport.fromJson(asMap(data));
  }

  Future<SystemReport> updateSystemReportStatus(
    String id,
    UpdateSystemReportStatusInput input,
  ) async {
    final data = await patchJson('/reports/$id/status', body: input.toJson());
    return SystemReport.fromJson(asMap(data));
  }

  /// Streams the screenshot bytes with the bearer token. A3 renders these via
  /// `Image.memory`; no base64 hop is required on Flutter.
  Future<Uint8List> getReportScreenshot(String reportId) async {
    final response = await getBytes('/reports/$reportId/screenshot');
    return response.bytes;
  }

  static Map<String, dynamic> _clean(Map<String, dynamic> input) {
    return <String, dynamic>{
      for (final entry in input.entries)
        if (entry.value != null && entry.value != '') entry.key: entry.value,
    };
  }
}
