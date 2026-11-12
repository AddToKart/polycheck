import 'dart:typed_data';

import 'package:freezed_annotation/freezed_annotation.dart';

import '../models/attendance.dart';
import '../models/api.dart';
import '../models/session.dart';
import '../models/subject.dart';
import '../models/user.dart';

/// Response/request DTOs used by the HTTP surface that are not part of the
/// mirrored `shared/src/types` barrel (they are declared inline in
/// `shared/src/types/api.ts`). Field names match the wire contract exactly.
///
/// Enum members decode with the same strict unknown-value rejection used by
/// the A1 models.

Map<String, dynamic> _map(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.cast<String, dynamic>();
  return <String, dynamic>{};
}

List<Object?> _list(Object? value) => value is List ? value : const [];

/// Mobile login response (`POST /auth/mobile/login/*`).
@immutable
class LoginResult {
  const LoginResult({required this.user, required this.token});

  factory LoginResult.fromJson(Map<String, dynamic> json) {
    return LoginResult(
      user: User.fromJson(_map(json['user'])),
      token: json['token'] as String,
    );
  }

  final User user;
  final String token;
}

@immutable
class PrivacyNotice {
  const PrivacyNotice({
    required this.version,
    required this.url,
    required this.summary,
  });

  factory PrivacyNotice.fromJson(Map<String, dynamic> json) {
    return PrivacyNotice(
      version: json['version'] as String? ?? '',
      url: json['url'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
    );
  }

  final String version;
  final String url;
  final String summary;
}

@immutable
class AppSetting {
  const AppSetting({
    required this.key,
    required this.value,
    required this.updatedAt,
  });

  factory AppSetting.fromJson(Map<String, dynamic> json) {
    return AppSetting(
      key: json['key'] as String? ?? '',
      value: json['value'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }

  final String key;
  final String value;
  final String updatedAt;

  Map<String, dynamic> toJson() => {
    'key': key,
    'value': value,
    'updatedAt': updatedAt,
  };
}

enum DisputeResolution {
  accept('accept'),
  reject('reject'),
  override('override');

  const DisputeResolution(this.wire);

  final String wire;
}

@immutable
class AttendanceReportFilters {
  const AttendanceReportFilters({
    this.startDate,
    this.endDate,
    this.teacherId,
    this.subjectId,
    this.sectionId,
    this.sessionId,
    this.department,
  });

  final String? startDate;
  final String? endDate;
  final String? teacherId;
  final String? subjectId;
  final String? sectionId;
  final String? sessionId;
  final String? department;

  Map<String, dynamic> toQuery() => {
    if (startDate != null && startDate!.isNotEmpty) 'startDate': startDate,
    if (endDate != null && endDate!.isNotEmpty) 'endDate': endDate,
    if (teacherId != null && teacherId!.isNotEmpty) 'teacherId': teacherId,
    if (subjectId != null && subjectId!.isNotEmpty) 'subjectId': subjectId,
    if (sectionId != null && sectionId!.isNotEmpty) 'sectionId': sectionId,
    if (sessionId != null && sessionId!.isNotEmpty) 'sessionId': sessionId,
    if (department != null && department!.isNotEmpty) 'department': department,
  };
}

@immutable
class AttendanceReportTotals {
  const AttendanceReportTotals({
    this.totalRecords = 0,
    this.totalSessions = 0,
    this.present = 0,
    this.late = 0,
    this.absent = 0,
    this.pending = 0,
    this.disputed = 0,
    this.excused = 0,
    this.incomplete = 0,
  });

  factory AttendanceReportTotals.fromJson(Map<String, dynamic> json) {
    int read(String key) => (json[key] as num?)?.toInt() ?? 0;
    return AttendanceReportTotals(
      totalRecords: read('totalRecords'),
      totalSessions: read('totalSessions'),
      present: read('present'),
      late: read('late'),
      absent: read('absent'),
      pending: read('pending'),
      disputed: read('disputed'),
      excused: read('excused'),
      incomplete: read('incomplete'),
    );
  }

  final int totalRecords;
  final int totalSessions;
  final int present;
  final int late;
  final int absent;
  final int pending;
  final int disputed;
  final int excused;
  final int incomplete;

  Map<String, dynamic> toJson() => {
    'totalRecords': totalRecords,
    'totalSessions': totalSessions,
    'present': present,
    'late': late,
    'absent': absent,
    'pending': pending,
    'disputed': disputed,
    'excused': excused,
    'incomplete': incomplete,
  };
}

@immutable
class AttendanceReportSummary {
  const AttendanceReportSummary({
    required this.sectionId,
    this.subjectName = '',
    this.totalSessions = 0,
    this.present = 0,
    this.late = 0,
    this.absent = 0,
    this.disputed = 0,
    this.excused = 0,
    this.incomplete = 0,
    this.pending = 0,
  });

  factory AttendanceReportSummary.fromJson(Map<String, dynamic> json) {
    int read(String key) => (json[key] as num?)?.toInt() ?? 0;
    return AttendanceReportSummary(
      sectionId: json['sectionId'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? '',
      totalSessions: read('totalSessions'),
      present: read('present'),
      late: read('late'),
      absent: read('absent'),
      disputed: read('disputed'),
      excused: read('excused'),
      incomplete: read('incomplete'),
      pending: read('pending'),
    );
  }

  final String sectionId;
  final String subjectName;
  final int totalSessions;
  final int present;
  final int late;
  final int absent;
  final int disputed;
  final int excused;
  final int incomplete;
  final int pending;

  Map<String, dynamic> toJson() => {
    'sectionId': sectionId,
    'subjectName': subjectName,
    'totalSessions': totalSessions,
    'present': present,
    'late': late,
    'absent': absent,
    'disputed': disputed,
    'excused': excused,
    'incomplete': incomplete,
    'pending': pending,
  };
}

@immutable
class AttendanceReportRange {
  const AttendanceReportRange({this.startDate = '', this.endDate = ''});

  factory AttendanceReportRange.fromJson(Map<String, dynamic> json) {
    return AttendanceReportRange(
      startDate: json['startDate'] as String? ?? '',
      endDate: json['endDate'] as String? ?? '',
    );
  }

  final String startDate;
  final String endDate;
}

@immutable
class AttendanceReport {
  const AttendanceReport({
    required this.range,
    required this.totals,
    this.summaries = const <AttendanceReportSummary>[],
  });

  factory AttendanceReport.fromJson(Map<String, dynamic> json) {
    return AttendanceReport(
      range: AttendanceReportRange.fromJson(_map(json['range'])),
      totals: AttendanceReportTotals.fromJson(_map(json['totals'])),
      summaries: _list(json['summaries'])
          .whereType<Map>()
          .map((item) => AttendanceReportSummary.fromJson(_map(item)))
          .toList(growable: false),
    );
  }

  final AttendanceReportRange range;
  final AttendanceReportTotals totals;
  final List<AttendanceReportSummary> summaries;
}

@immutable
class DashboardCounts {
  const DashboardCounts({
    this.faculty = 0,
    this.students = 0,
    this.subjects = 0,
    this.sections = 0,
    this.sessionsToday = 0,
    this.pendingDisputes = 0,
  });

  factory DashboardCounts.fromJson(Map<String, dynamic> json) {
    int read(String key) => (json[key] as num?)?.toInt() ?? 0;
    return DashboardCounts(
      faculty: read('faculty'),
      students: read('students'),
      subjects: read('subjects'),
      sections: read('sections'),
      sessionsToday: read('sessionsToday'),
      pendingDisputes: read('pendingDisputes'),
    );
  }

  final int faculty;
  final int students;
  final int subjects;
  final int sections;
  final int sessionsToday;
  final int pendingDisputes;
}

@immutable
class DashboardTrendPoint {
  const DashboardTrendPoint({
    required this.date,
    this.present = 0,
    this.late = 0,
    this.absent = 0,
    this.disputed = 0,
    this.excused = 0,
    this.incomplete = 0,
  });

  factory DashboardTrendPoint.fromJson(Map<String, dynamic> json) {
    int read(String key) => (json[key] as num?)?.toInt() ?? 0;
    return DashboardTrendPoint(
      date: json['date'] as String? ?? '',
      present: read('present'),
      late: read('late'),
      absent: read('absent'),
      disputed: read('disputed'),
      excused: read('excused'),
      incomplete: read('incomplete'),
    );
  }

  final String date;
  final int present;
  final int late;
  final int absent;
  final int disputed;
  final int excused;
  final int incomplete;
}

@immutable
class DashboardRecentAttendance {
  const DashboardRecentAttendance({
    required this.id,
    required this.sessionId,
    required this.sectionId,
    this.studentName = '',
    this.subjectName = '',
    this.timestamp = '',
    required this.status,
  });

  factory DashboardRecentAttendance.fromJson(Map<String, dynamic> json) {
    return DashboardRecentAttendance(
      id: json['id'] as String? ?? '',
      sessionId: json['sessionId'] as String? ?? '',
      sectionId: json['sectionId'] as String? ?? '',
      studentName: json['studentName'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? '',
      timestamp: json['timestamp'] as String? ?? '',
      status: AttendanceStatus.fromWire(json['status'] as String? ?? ''),
    );
  }

  final String id;
  final String sessionId;
  final String sectionId;
  final String studentName;
  final String subjectName;
  final String timestamp;
  final AttendanceStatus status;
}

@immutable
class DashboardRecentDispute {
  const DashboardRecentDispute({
    required this.id,
    required this.sectionId,
    this.studentName = '',
    this.timestamp = '',
    this.disputeReason,
  });

  factory DashboardRecentDispute.fromJson(Map<String, dynamic> json) {
    return DashboardRecentDispute(
      id: json['id'] as String? ?? '',
      sectionId: json['sectionId'] as String? ?? '',
      studentName: json['studentName'] as String? ?? '',
      timestamp: json['timestamp'] as String? ?? '',
      disputeReason: json['disputeReason'] as String?,
    );
  }

  final String id;
  final String sectionId;
  final String studentName;
  final String timestamp;
  final String? disputeReason;
}

@immutable
class DashboardOverview {
  const DashboardOverview({
    required this.counts,
    required this.trendRange,
    this.trends = const <DashboardTrendPoint>[],
    this.recentAttendance = const <DashboardRecentAttendance>[],
    this.recentDisputes = const <DashboardRecentDispute>[],
  });

  factory DashboardOverview.fromJson(Map<String, dynamic> json) {
    return DashboardOverview(
      counts: DashboardCounts.fromJson(_map(json['counts'])),
      trendRange: AttendanceReportRange.fromJson(_map(json['trendRange'])),
      trends: _list(json['trends'])
          .whereType<Map>()
          .map((item) => DashboardTrendPoint.fromJson(_map(item)))
          .toList(growable: false),
      recentAttendance: _list(json['recentAttendance'])
          .whereType<Map>()
          .map((item) => DashboardRecentAttendance.fromJson(_map(item)))
          .toList(growable: false),
      recentDisputes: _list(json['recentDisputes'])
          .whereType<Map>()
          .map((item) => DashboardRecentDispute.fromJson(_map(item)))
          .toList(growable: false),
    );
  }

  final DashboardCounts counts;
  final AttendanceReportRange trendRange;
  final List<DashboardTrendPoint> trends;
  final List<DashboardRecentAttendance> recentAttendance;
  final List<DashboardRecentDispute> recentDisputes;
}

@immutable
class SubmitAttendanceResult {
  const SubmitAttendanceResult({
    required this.success,
    required this.status,
    this.reason,
    this.message,
  });

  factory SubmitAttendanceResult.fromJson(Map<String, dynamic> json) {
    return SubmitAttendanceResult(
      success: json['success'] as bool? ?? false,
      status: AttendanceStatus.fromWire(json['status'] as String? ?? 'absent'),
      reason: json['reason'] as String?,
      message: json['message'] as String?,
    );
  }

  final bool success;
  final AttendanceStatus status;
  final String? reason;
  final String? message;
}

enum ScanInputChannel {
  camera('camera'),
  image('image'),
  manual('manual');

  const ScanInputChannel(this.wire);

  final String wire;

  static ScanInputChannel? tryParse(String value) {
    for (final channel in values) {
      if (channel.wire == value) return channel;
    }
    return null;
  }
}

@immutable
class DeviceSecurityEvidence {
  const DeviceSecurityEvidence({
    this.rootDetected,
    this.hookDetected,
    this.emulatorDetected,
  });

  final bool? rootDetected;
  final bool? hookDetected;
  final bool? emulatorDetected;

  Map<String, dynamic> toJson() => {
    if (rootDetected != null) 'rootDetected': rootDetected,
    if (hookDetected != null) 'hookDetected': hookDetected,
    if (emulatorDetected != null) 'emulatorDetected': emulatorDetected,
  };
}

@immutable
class ScanEvidenceInput {
  const ScanEvidenceInput({
    required this.clientAttemptId,
    this.accuracyMeters,
    this.locationCapturedAt,
    this.mocked,
    this.inputChannel,
    this.deviceSecurity,
  });

  final String clientAttemptId;
  final double? accuracyMeters;
  final String? locationCapturedAt;
  final bool? mocked;
  final ScanInputChannel? inputChannel;
  final DeviceSecurityEvidence? deviceSecurity;

  Map<String, dynamic> toJson() => {
    'clientAttemptId': clientAttemptId,
    if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
    if (locationCapturedAt != null) 'locationCapturedAt': locationCapturedAt,
    if (mocked != null) 'mocked': mocked,
    if (inputChannel != null) 'inputChannel': inputChannel!.wire,
    if (deviceSecurity != null) 'deviceSecurity': deviceSecurity!.toJson(),
  };
}

@immutable
class SectionStudentAttendance {
  const SectionStudentAttendance({
    this.present = 0,
    this.late = 0,
    this.absent = 0,
    this.disputed = 0,
  });

  factory SectionStudentAttendance.fromJson(Map<String, dynamic> json) {
    int read(String key) => (json[key] as num?)?.toInt() ?? 0;
    return SectionStudentAttendance(
      present: read('present'),
      late: read('late'),
      absent: read('absent'),
      disputed: read('disputed'),
    );
  }

  final int present;
  final int late;
  final int absent;
  final int disputed;

  Map<String, dynamic> toJson() => {
    'present': present,
    'late': late,
    'absent': absent,
    'disputed': disputed,
  };
}

/// `GET /sections/:id/students` row: the student payload plus section counts.
@immutable
class SectionStudent {
  const SectionStudent({required this.student, required this.attendance});

  factory SectionStudent.fromJson(Map<String, dynamic> json) {
    return SectionStudent(
      student: User.fromJson(json),
      attendance: SectionStudentAttendance.fromJson(_map(json['attendance'])),
    );
  }

  final User student;
  final SectionStudentAttendance attendance;

  Map<String, dynamic> toJson() => {
    ...student.toJson(),
    'attendance': attendance.toJson(),
  };
}

@immutable
class CreateTeacherResult {
  const CreateTeacherResult({required this.user, this.temporaryPassword});

  factory CreateTeacherResult.fromJson(Map<String, dynamic> json) {
    return CreateTeacherResult(
      user: User.fromJson(json),
      temporaryPassword: json['temporaryPassword'] as String?,
    );
  }

  final User user;
  final String? temporaryPassword;
}

@immutable
class CreateStudentResult {
  const CreateStudentResult({required this.user, this.temporaryPassword});

  factory CreateStudentResult.fromJson(Map<String, dynamic> json) {
    return CreateStudentResult(
      user: User.fromJson(json),
      temporaryPassword: json['temporaryPassword'] as String?,
    );
  }

  final User user;
  final String? temporaryPassword;
}

@immutable
class ResetUserPasswordResult {
  const ResetUserPasswordResult({
    this.message = '',
    this.userId = '',
    this.temporaryPassword,
  });

  factory ResetUserPasswordResult.fromJson(Map<String, dynamic> json) {
    return ResetUserPasswordResult(
      message: json['message'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      temporaryPassword: json['temporaryPassword'] as String?,
    );
  }

  final String message;
  final String userId;
  final String? temporaryPassword;
}

@immutable
class TeacherResetStudentPasswordResult {
  const TeacherResetStudentPasswordResult({
    required this.userId,
    required this.temporaryPassword,
    this.message = '',
  });

  factory TeacherResetStudentPasswordResult.fromJson(
    Map<String, dynamic> json,
  ) {
    return TeacherResetStudentPasswordResult(
      userId: json['userId'] as String? ?? '',
      temporaryPassword: json['temporaryPassword'] as String? ?? '',
      message: json['message'] as String? ?? '',
    );
  }

  final String userId;
  final String temporaryPassword;
  final String message;
}

@immutable
class UnregisterDeviceResult {
  const UnregisterDeviceResult({
    required this.user,
    this.cooldownHours = 0,
    this.cooldownUntil = '',
    this.message = '',
  });

  factory UnregisterDeviceResult.fromJson(Map<String, dynamic> json) {
    return UnregisterDeviceResult(
      user: User.fromJson(_map(json['user'])),
      cooldownHours: (json['cooldownHours'] as num?)?.toInt() ?? 0,
      cooldownUntil: json['cooldownUntil'] as String? ?? '',
      message: json['message'] as String? ?? '',
    );
  }

  final User user;
  final int cooldownHours;
  final String cooldownUntil;
  final String message;
}

@immutable
class UpdateContactsInput {
  const UpdateContactsInput({this.contactEmail, this.contactPhone});

  /// Empty string clears the stored value (mirrors the backend DTO).
  final String? contactEmail;
  final String? contactPhone;

  Map<String, dynamic> toJson() => {
    if (contactEmail != null) 'contactEmail': contactEmail,
    if (contactPhone != null) 'contactPhone': contactPhone,
  };
}

enum EmergencyDeviceReleaseReason {
  deadBattery('dead_battery'),
  lostOrDamaged('lost_or_damaged'),
  borrowedDevice('borrowed_device'),
  other('other');

  const EmergencyDeviceReleaseReason(this.wire);

  final String wire;
}

@immutable
class EmergencyDeviceReleaseInput {
  const EmergencyDeviceReleaseInput({
    required this.sectionId,
    required this.reason,
    this.note,
  });

  final String sectionId;
  final EmergencyDeviceReleaseReason reason;
  final String? note;

  Map<String, dynamic> toJson() => {
    'sectionId': sectionId,
    'reason': reason.wire,
    if (note != null) 'note': note,
  };
}

@immutable
class AuditLogFilters {
  const AuditLogFilters({
    this.page,
    this.pageSize,
    this.search,
    this.action,
    this.outcome,
    this.startDate,
    this.endDate,
  });

  final int? page;
  final int? pageSize;
  final String? search;
  final String? action;
  final String? outcome;
  final String? startDate;
  final String? endDate;

  Map<String, dynamic> toQuery() => {
    if (page != null) 'page': page,
    if (pageSize != null) 'pageSize': pageSize,
    if (search != null && search!.isNotEmpty) 'search': search,
    if (action != null && action!.isNotEmpty) 'action': action,
    if (outcome != null && outcome!.isNotEmpty) 'outcome': outcome,
    if (startDate != null && startDate!.isNotEmpty) 'startDate': startDate,
    if (endDate != null && endDate!.isNotEmpty) 'endDate': endDate,
  };
}

@immutable
class AuditLogPage {
  const AuditLogPage({
    this.items = const <AuditLogEntry>[],
    this.total = 0,
    this.page = 0,
    this.pageSize = 0,
    this.totalPages = 0,
  });

  factory AuditLogPage.fromJson(Map<String, dynamic> json) {
    return AuditLogPage(
      items: _list(json['items'])
          .whereType<Map>()
          .map((item) => AuditLogEntry.fromJson(_map(item)))
          .toList(growable: false),
      total: (json['total'] as num?)?.toInt() ?? 0,
      page: (json['page'] as num?)?.toInt() ?? 0,
      pageSize: (json['pageSize'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 0,
    );
  }

  final List<AuditLogEntry> items;
  final int total;
  final int page;
  final int pageSize;
  final int totalPages;
}

@immutable
class LedgerBreak {
  const LedgerBreak({
    required this.sessionId,
    required this.recordId,
    required this.reason,
  });

  factory LedgerBreak.fromJson(Map<String, dynamic> json) {
    return LedgerBreak(
      sessionId: json['sessionId'] as String? ?? '',
      recordId: json['recordId'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
    );
  }

  final String sessionId;
  final String recordId;
  final String reason;
}

@immutable
class LedgerVerifyResult {
  const LedgerVerifyResult({
    required this.verified,
    this.status,
    this.recordsChecked = 0,
    this.sessionsChecked = 0,
    this.unhashedRecords = 0,
    this.lastAnchorDate,
    this.brokenAt,
  });

  factory LedgerVerifyResult.fromJson(Map<String, dynamic> json) {
    final broken = json['brokenAt'];
    return LedgerVerifyResult(
      verified: json['verified'] as bool? ?? false,
      status: json['status'] as String?,
      recordsChecked: (json['recordsChecked'] as num?)?.toInt() ?? 0,
      sessionsChecked: (json['sessionsChecked'] as num?)?.toInt() ?? 0,
      unhashedRecords: (json['unhashedRecords'] as num?)?.toInt() ?? 0,
      lastAnchorDate: json['lastAnchorDate'] as String?,
      brokenAt: broken is Map ? LedgerBreak.fromJson(_map(broken)) : null,
    );
  }

  final bool verified;

  /// Server-declared outcome: `verified`, `broken` or `insufficient_data`.
  ///
  /// Null when talking to an older backend; [ledgerOutcomeOf] then derives the
  /// outcome from [verified] so existing responses keep decoding.
  final String? status;
  final int recordsChecked;
  final int sessionsChecked;

  /// Attendance rows with no chain entry. Non-zero means the ledger is not
  /// fully anchored even when the chained rows themselves verify.
  final int unhashedRecords;
  final String? lastAnchorDate;
  final LedgerBreak? brokenAt;
}

@immutable
class SearchResults {
  const SearchResults({
    this.students = const <User>[],
    this.sections = const <Section>[],
    this.sessions = const <Session>[],
  });

  factory SearchResults.fromJson(Map<String, dynamic> json) {
    return SearchResults(
      students: _list(json['students'])
          .whereType<Map>()
          .map((item) => User.fromJson(_map(item)))
          .toList(growable: false),
      sections: _list(json['sections'])
          .whereType<Map>()
          .map((item) => Section.fromJson(_map(item)))
          .toList(growable: false),
      sessions: _list(json['sessions'])
          .whereType<Map>()
          .map((item) => Session.fromJson(_map(item)))
          .toList(growable: false),
    );
  }

  final List<User> students;
  final List<Section> sections;
  final List<Session> sessions;
}

/// One per-record sync outcome: either the authoritative record or a typed
/// error carrying the terminal/retryable hint from the server.
sealed class SyncRecordResult {
  const SyncRecordResult();

  factory SyncRecordResult.fromJson(Map<String, dynamic> json) {
    if (json.containsKey('error')) {
      return SyncRecordFailure(
        error: json['error'] as String? ?? 'Sync rejected',
        retryable: json['retryable'] as bool? ?? true,
      );
    }
    return SyncRecordSuccess(AttendanceRecord.fromJson(json));
  }
}

final class SyncRecordSuccess extends SyncRecordResult {
  const SyncRecordSuccess(this.record);

  final AttendanceRecord record;
}

final class SyncRecordFailure extends SyncRecordResult {
  const SyncRecordFailure({required this.error, required this.retryable});

  final String error;
  final bool retryable;
}

@immutable
class SyncBatchSubmitResult {
  const SyncBatchSubmitResult({
    required this.queued,
    this.receiptId,
    this.results,
  });

  factory SyncBatchSubmitResult.fromJson(Map<String, dynamic> json) {
    return SyncBatchSubmitResult(
      queued: json['queued'] as bool? ?? false,
      receiptId: json['receiptId'] as String?,
      results: json['results'] is List
          ? _list(json['results'])
                .whereType<Map>()
                .map((item) => SyncRecordResult.fromJson(_map(item)))
                .toList(growable: false)
          : null,
    );
  }

  final bool queued;
  final String? receiptId;
  final List<SyncRecordResult>? results;
}

@immutable
class SyncBatchStatus {
  const SyncBatchStatus({required this.state, this.results});

  factory SyncBatchStatus.fromJson(Map<String, dynamic> json) {
    return SyncBatchStatus(
      state: json['state'] as String? ?? 'pending',
      results: json['results'] is List
          ? _list(json['results'])
                .whereType<Map>()
                .map((item) => SyncRecordResult.fromJson(_map(item)))
                .toList(growable: false)
          : null,
    );
  }

  final String state;
  final List<SyncRecordResult>? results;

  bool get isCompleted => state == 'completed';
  bool get isFailed => state == 'failed';
}

@immutable
class DocumentDownload {
  const DocumentDownload({
    required this.bytes,
    required this.filename,
    required this.contentType,
  });

  final Uint8List bytes;
  final String filename;
  final String contentType;
}
