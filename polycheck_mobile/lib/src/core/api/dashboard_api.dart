import '../models/api.dart';
import '../models/dashboard.dart';
import '../utils/calendar_utils.dart';
import 'api_base.dart';
import 'api_models.dart';

/// Teacher/admin dashboards, calm calendar feed, and CSV export.
class DashboardApi extends ApiBase {
  DashboardApi(super.dio);

  Future<DashboardOverview> getDashboardOverview({
    String? startDate,
    String? endDate,
  }) async {
    final data = await getJson(
      '/dashboard/overview',
      query: <String, dynamic>{'startDate': startDate, 'endDate': endDate},
    );
    return DashboardOverview.fromJson(asMap(data));
  }

  Future<AdminOverview> getAdminOverview() async {
    final data = await getJson('/dashboard/admin-overview');
    return AdminOverview.fromJson(asMap(data));
  }

  Future<ServerStatusSnapshot> getServerStatus() async {
    final data = await getJson('/dashboard/server-status');
    return ServerStatusSnapshot.fromJson(asMap(data));
  }

  /// Role-scoped calendar feed. `userId` is kept for Android signature parity;
  /// the backend scopes by the authenticated actor.
  Future<List<CalendarEvent>> getCalendarEvents(
    String userId,
    String startDate,
    String endDate,
  ) async {
    final data = await getJson(
      '/calendar/events',
      query: <String, dynamic>{'startDate': startDate, 'endDate': endDate},
    );
    return asList(data)
        .whereType<Map>()
        .map((item) => CalendarEvent.fromJson(asMap(item)))
        .toList(growable: false);
  }

  /// CSV export text (formula-safe on the server); the UI shares it as bytes.
  Future<String> exportAttendanceCsv([
    AttendanceReportFilters filters = const AttendanceReportFilters(),
  ]) async {
    final range = getRecentCampusDateRange(30);
    return getText(
      '/reports/export',
      query: <String, dynamic>{
        ...filters.toQuery(),
        'startDate': filters.startDate ?? range.startDate,
        'endDate': filters.endDate ?? range.endDate,
      },
    );
  }
}
