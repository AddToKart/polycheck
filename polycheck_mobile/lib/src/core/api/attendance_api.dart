import '../models/at_risk.dart';
import '../models/attendance.dart';
import '../models/standing.dart';
import '../utils/calendar_utils.dart';
import 'api_base.dart';
import 'api_models.dart';

/// Attendance, scanning, reports, excuses, at-risk, and referrals.
///
/// Mirrors the Android endpoints. The RN client's offline fallbacks
/// (`submitScan`/`checkAttendance` cache verification) are intentionally not
/// duplicated here; the sync slice owns the encrypted queue and re-validation.
class AttendanceApi extends ApiBase {
  AttendanceApi(super.dio);

  Future<List<AttendanceRecord>> getAttendanceRecords({
    String? sessionId,
    String? startDate,
    String? endDate,
  }) async {
    final range = getRecentCampusDateRange(31);
    final query = sessionId != null
        ? <String, dynamic>{'sessionId': sessionId, 'limit': 1000}
        : <String, dynamic>{
            'startDate': startDate ?? range.startDate,
            'endDate': endDate ?? range.endDate,
            'limit': 1000,
          };
    final data = await getJson('/attendance', query: query);
    return _records(data);
  }

  Future<List<AttendanceSummary>> getAttendanceSummaries({
    String? teacherId,
  }) async {
    final range = getRecentCampusDateRange(30);
    final data = await getJson(
      '/attendance/summaries',
      query: <String, dynamic>{
        'startDate': range.startDate,
        'endDate': range.endDate,
        'teacherId': ?teacherId,
      },
    );
    return asList(data)
        .whereType<Map>()
        .map((item) => AttendanceSummary.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<AttendanceReport> getAttendanceReport([
    AttendanceReportFilters filters = const AttendanceReportFilters(),
  ]) async {
    final range = getRecentCampusDateRange(30);
    final data = await getJson(
      '/attendance/report',
      query: <String, dynamic>{
        ...filters.toQuery(),
        'startDate': filters.startDate ?? range.startDate,
        'endDate': filters.endDate ?? range.endDate,
      },
    );
    return AttendanceReport.fromJson(asMap(data));
  }

  Future<List<AttendanceRecord>> getAttendanceForStudent(
    String studentId,
  ) async {
    final data = await getJson(
      '/attendance/student/${Uri.encodeComponent(studentId)}',
    );
    return _records(data);
  }

  /// Same endpoint as [getAttendanceForStudent] with the section filter.
  Future<List<AttendanceRecord>> getStudentAttendanceForSection(
    String studentId,
    String sectionId,
  ) async {
    final data = await getJson(
      '/attendance/student/${Uri.encodeComponent(studentId)}',
      query: <String, dynamic>{'sectionId': sectionId},
    );
    return _records(data);
  }

  Future<List<AttendanceRecord>> getMyAttendance(String studentId) {
    return getAttendanceForStudent(studentId);
  }

  Future<AttendanceRecord> addAttendanceRecord(AttendanceRecord record) async {
    final data = await postJson(
      '/attendance',
      body: <String, dynamic>{
        'sessionId': record.sessionId,
        'sectionId': record.sectionId,
        'studentId': record.studentId,
        'status': record.status.wire,
      },
    );
    return AttendanceRecord.fromJson(asMap(data));
  }

  Future<AttendanceRecord> updateAttendanceStatus(
    String recordId,
    AttendanceStatus status,
  ) async {
    final data = await patchJson(
      '/attendance/${Uri.encodeComponent(recordId)}/status',
      body: <String, dynamic>{'status': status.wire},
    );
    return AttendanceRecord.fromJson(asMap(data));
  }

  /// `POST /attendance/scan` — camera/offline submission payload.
  Future<AttendanceRecord> submitScan({
    required String sessionId,
    required String studentId,
    required String studentName,
    required double? lat,
    required double? lon,
    required String deviceId,
    required String qrToken,
    String? scannedAt,
    ScanEvidenceInput? evidence,
    String? pin,
  }) async {
    final data = await postJson(
      '/attendance/scan',
      body: <String, dynamic>{
        'sessionId': sessionId,
        'lat': ?lat,
        'lon': ?lon,
        'deviceId': deviceId,
        'qrToken': qrToken,
        'scannedAt': scannedAt ?? DateTime.now().toUtc().toIso8601String(),
        ...?evidence?.toJson(),
        if (pin != null && pin.isNotEmpty) 'pin': pin,
      },
    );
    return AttendanceRecord.fromJson(asMap(data));
  }

  /// `POST /attendance/check` — validation probe (no attendance record).
  Future<SubmitAttendanceResult> checkAttendance({
    required String sessionId,
    required double? lat,
    required double? lon,
    String? qrToken,
    String? scannedAt,
    String? pin,
  }) async {
    final data = await postJson(
      '/attendance/check',
      body: <String, dynamic>{
        'sessionId': sessionId,
        'lat': ?lat,
        'lon': ?lon,
        'qrToken': ?qrToken,
        'scannedAt': ?scannedAt,
        if (pin != null && pin.isNotEmpty) 'pin': pin,
      },
    );
    return SubmitAttendanceResult.fromJson(asMap(data));
  }

  Future<List<ScanAttemptView>> getScanAttempts({String? sessionId}) async {
    final data = await getJson(
      '/attendance/attempts',
      query: <String, dynamic>{'sessionId': sessionId},
    );
    return asList(data)
        .whereType<Map>()
        .map((item) => ScanAttemptView.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<RecordTimeline> getRecordTimeline(String recordId) async {
    final data = await getJson(
      '/attendance/records/${Uri.encodeComponent(recordId)}/timeline',
    );
    return RecordTimeline.fromJson(asMap(data));
  }

  Future<List<StudentAtRisk>> getAtRiskStudents({
    String? sectionId,
    int? limit,
  }) async {
    final data = await getJson(
      '/attendance/at-risk',
      query: <String, dynamic>{'sectionId': sectionId, 'limit': limit},
    );
    return asList(data)
        .whereType<Map>()
        .map((item) => StudentAtRisk.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<AtRiskReferral> generateAtRiskReferral({
    required String studentId,
    required String sectionId,
    String? note,
  }) async {
    final data = await postJson(
      '/attendance/at-risk/referrals',
      body: <String, dynamic>{
        'studentId': studentId,
        'sectionId': sectionId,
        'note': ?note,
      },
    );
    return AtRiskReferral.fromJson(asMap(data));
  }

  Future<List<AtRiskReferral>> getAtRiskReferrals({
    ReferralStatus? status,
    String? sectionId,
  }) async {
    final data = await getJson(
      '/attendance/at-risk/referrals',
      query: <String, dynamic>{'status': status?.wire, 'sectionId': sectionId},
    );
    return asList(data)
        .whereType<Map>()
        .map((item) => AtRiskReferral.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<AtRiskReferral> updateAtRiskReferral(
    String id, {
    required ReferralStatus status,
    String? note,
  }) async {
    final data = await patchJson(
      '/attendance/at-risk/referrals/${Uri.encodeComponent(id)}',
      body: <String, dynamic>{'status': status.wire, 'note': ?note},
    );
    return AtRiskReferral.fromJson(asMap(data));
  }

  // ── Excuses ──

  Future<AttendanceRecord> requestExcuse(
    String recordId, {
    required ExcuseReason reason,
    required String description,
    String? evidenceData,
  }) async {
    final data = await postJson(
      '/attendance/records/${Uri.encodeComponent(recordId)}/excuse',
      body: <String, dynamic>{
        'reason': reason.wire,
        'description': description,
        'evidenceData': ?evidenceData,
      },
    );
    return AttendanceRecord.fromJson(asMap(data));
  }

  Future<List<AttendanceRecord>> listExcuses({
    String? status,
    String? sectionId,
    String? startDate,
    String? endDate,
  }) async {
    final data = await getJson(
      '/attendance/excuses',
      query: <String, dynamic>{
        'status': status,
        'sectionId': sectionId,
        'startDate': startDate,
        'endDate': endDate,
      },
    );
    return _records(data);
  }

  Future<AttendanceRecord> decideExcuse(
    String recordId, {
    required ExcuseDecision decision,
    String? note,
  }) async {
    final data = await postJson(
      '/attendance/records/${Uri.encodeComponent(recordId)}/excuse/decision',
      body: <String, dynamic>{'decision': decision.wire, 'note': ?note},
    );
    return AttendanceRecord.fromJson(asMap(data));
  }

  /// Deterministic standing evaluation (`GET /me/standing`, student only).
  Future<List<AttendanceStanding>> getMyStanding() async {
    final data = await getJson('/me/standing');
    return asList(data)
        .whereType<Map>()
        .map((item) => AttendanceStanding.fromJson(asMap(item)))
        .toList(growable: false);
  }

  List<AttendanceRecord> _records(Object? data) {
    return asList(data)
        .whereType<Map>()
        .map((item) => AttendanceRecord.fromJson(asMap(item)))
        .toList(growable: false);
  }
}
