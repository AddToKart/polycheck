import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';
import 'user.dart';

part 'system_report.freezed.dart';
part 'system_report.g.dart';

/// Mirrors `shared/src/types/system-report.ts`.
enum ReportCategory {
  scannerCamera('scanner_camera'),
  geofenceGps('geofence_gps'),
  uiDisplay('ui_display'),
  enrollmentRoster('enrollment_roster'),
  accountLogin('account_login'),
  feedbackSuggestion('feedback_suggestion');

  const ReportCategory(this.wire);

  final String wire;

  static final Map<String, ReportCategory> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ReportCategory fromWire(String value) =>
      decodeWireEnum('ReportCategory', value, byWire);

  static ReportCategory? tryParse(String value) => byWire[value];
}

class ReportCategoryConverter extends JsonConverter<ReportCategory, String> {
  const ReportCategoryConverter();

  @override
  ReportCategory fromJson(String json) => ReportCategory.fromWire(json);

  @override
  String toJson(ReportCategory object) => object.wire;
}

enum ReportSeverity {
  low('low'),
  medium('medium'),
  high('high'),
  critical('critical');

  const ReportSeverity(this.wire);

  final String wire;

  static final Map<String, ReportSeverity> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ReportSeverity fromWire(String value) =>
      decodeWireEnum('ReportSeverity', value, byWire);

  static ReportSeverity? tryParse(String value) => byWire[value];
}

class ReportSeverityConverter extends JsonConverter<ReportSeverity, String> {
  const ReportSeverityConverter();

  @override
  ReportSeverity fromJson(String json) => ReportSeverity.fromWire(json);

  @override
  String toJson(ReportSeverity object) => object.wire;
}

enum ReportStatus {
  open('open'),
  inReview('in_review'),
  resolved('resolved'),
  dismissed('dismissed');

  const ReportStatus(this.wire);

  final String wire;

  static final Map<String, ReportStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ReportStatus fromWire(String value) =>
      decodeWireEnum('ReportStatus', value, byWire);

  static ReportStatus? tryParse(String value) => byWire[value];
}

class ReportStatusConverter extends JsonConverter<ReportStatus, String> {
  const ReportStatusConverter();

  @override
  ReportStatus fromJson(String json) => ReportStatus.fromWire(json);

  @override
  String toJson(ReportStatus object) => object.wire;
}

const List<ReportCategory> reportCategories = ReportCategory.values;

const List<ReportSeverity> reportSeverities = ReportSeverity.values;

const List<ReportStatus> reportStatuses = ReportStatus.values;

const Map<ReportCategory, String> reportCategoryLabels = {
  ReportCategory.scannerCamera: 'Scanner / camera',
  ReportCategory.geofenceGps: 'Geofence / GPS',
  ReportCategory.uiDisplay: 'UI / display',
  ReportCategory.enrollmentRoster: 'Enrollment / roster',
  ReportCategory.accountLogin: 'Account / login',
  ReportCategory.feedbackSuggestion: 'Feedback / suggestion',
};

const Map<ReportSeverity, String> reportSeverityLabels = {
  ReportSeverity.low: 'Low',
  ReportSeverity.medium: 'Medium',
  ReportSeverity.high: 'High',
  ReportSeverity.critical: 'Critical',
};

const Map<ReportStatus, String> reportStatusLabels = {
  ReportStatus.open: 'Open',
  ReportStatus.inReview: 'In review',
  ReportStatus.resolved: 'Resolved',
  ReportStatus.dismissed: 'Dismissed',
};

@freezed
abstract class ReportSubmitter with _$ReportSubmitter {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [UserRoleConverter()],
  )
  const factory ReportSubmitter({
    required String id,
    @Default('') String fullName,
    required UserRole role,
    String? studentId,
    String? email,
    String? department,
  }) = _ReportSubmitter;

  factory ReportSubmitter.fromJson(Map<String, dynamic> json) =>
      _$ReportSubmitterFromJson(json);
}

@freezed
abstract class SystemReport with _$SystemReport {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [
      ReportCategoryConverter(),
      ReportSeverityConverter(),
      ReportStatusConverter(),
    ],
  )
  const factory SystemReport({
    required String id,
    required ReportCategory category,
    required ReportSeverity severity,
    @Default('') String title,
    @Default('') String description,
    required ReportStatus status,
    String? deviceInfo,
    String? appVersion,
    String? route,
    String? networkType,
    String? screenshotUrl,
    String? adminNotes,
    String? resolvedAt,
    String? resolvedBy,
    @Default('') String createdAt,
    @Default('') String updatedAt,
    required ReportSubmitter user,
  }) = _SystemReport;

  factory SystemReport.fromJson(Map<String, dynamic> json) =>
      _$SystemReportFromJson(json);
}

@freezed
abstract class CreateSystemReportInput with _$CreateSystemReportInput {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ReportCategoryConverter(), ReportSeverityConverter()],
  )
  const factory CreateSystemReportInput({
    required ReportCategory category,
    required ReportSeverity severity,
    required String title,
    required String description,
    String? screenshotData,
    String? deviceInfo,
    String? appVersion,
    String? route,
    String? networkType,
  }) = _CreateSystemReportInput;

  factory CreateSystemReportInput.fromJson(Map<String, dynamic> json) =>
      _$CreateSystemReportInputFromJson(json);
}

@freezed
abstract class UpdateSystemReportStatusInput
    with _$UpdateSystemReportStatusInput {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ReportStatusConverter()],
  )
  const factory UpdateSystemReportStatusInput({
    required ReportStatus status,
    String? adminNotes,
  }) = _UpdateSystemReportStatusInput;

  factory UpdateSystemReportStatusInput.fromJson(Map<String, dynamic> json) =>
      _$UpdateSystemReportStatusInputFromJson(json);
}

@freezed
abstract class SystemReportFilters with _$SystemReportFilters {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [
      ReportCategoryConverter(),
      ReportSeverityConverter(),
      ReportStatusConverter(),
    ],
  )
  const factory SystemReportFilters({
    ReportCategory? category,
    ReportSeverity? severity,
    ReportStatus? status,
    String? role,
    String? search,
    String? startDate,
    String? endDate,
    int? limit,
    int? offset,
  }) = _SystemReportFilters;

  factory SystemReportFilters.fromJson(Map<String, dynamic> json) =>
      _$SystemReportFiltersFromJson(json);
}

@freezed
abstract class SystemReportPage with _$SystemReportPage {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory SystemReportPage({
    @Default(<SystemReport>[]) List<SystemReport> data,
    @Default(0) int total,
    @Default(0) int limit,
    @Default(0) int offset,
    @Default(false) bool hasMore,
  }) = _SystemReportPage;

  factory SystemReportPage.fromJson(Map<String, dynamic> json) =>
      _$SystemReportPageFromJson(json);
}

@freezed
abstract class SystemReportStats with _$SystemReportStats {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory SystemReportStats({
    @Default(0) int total,
    @Default(0) int open,
    @Default(0) int inReview,
    @Default(0) int resolved,
    @Default(0) int dismissed,
    @Default(0) int scannerAndGps,
    @Default(0) int resolvedThisMonth,
    @Default(0) int critical,
  }) = _SystemReportStats;

  factory SystemReportStats.fromJson(Map<String, dynamic> json) =>
      _$SystemReportStatsFromJson(json);
}
