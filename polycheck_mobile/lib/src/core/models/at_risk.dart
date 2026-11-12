import 'package:freezed_annotation/freezed_annotation.dart';

import 'standing.dart';
import 'support/wire_enum.dart';

part 'at_risk.freezed.dart';
part 'at_risk.g.dart';

/// Mirrors `shared/src/types/at-risk.ts`.
enum ReferralStatus {
  generated('generated'),
  acknowledged('acknowledged'),
  counselingScheduled('counseling_scheduled'),
  resolved('resolved');

  const ReferralStatus(this.wire);

  final String wire;

  static final Map<String, ReferralStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ReferralStatus fromWire(String value) =>
      decodeWireEnum('ReferralStatus', value, byWire);

  static ReferralStatus? tryParse(String value) => byWire[value];
}

class ReferralStatusConverter extends JsonConverter<ReferralStatus, String> {
  const ReferralStatusConverter();

  @override
  ReferralStatus fromJson(String json) => ReferralStatus.fromWire(json);

  @override
  String toJson(ReferralStatus object) => object.wire;
}

@freezed
abstract class StudentAtRisk with _$StudentAtRisk {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AttendanceStandingStatusConverter()],
  )
  const factory StudentAtRisk({
    required String studentId,
    @Default('') String studentName,
    String? studentNumber,
    required String sectionId,
    @Default('') String sectionName,
    @Default('') String subjectName,
    @Default('') String professorName,
    @Default(75) int thresholdPercent,
    double? attendanceRate,
    required AttendanceStandingStatus status,
    int? absencesBeforeBelowThreshold,
    String? lastAbsenceDate,
  }) = _StudentAtRisk;

  factory StudentAtRisk.fromJson(Map<String, dynamic> json) =>
      _$StudentAtRiskFromJson(json);
}

@freezed
abstract class AtRiskReferral with _$AtRiskReferral {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ReferralStatusConverter()],
  )
  const factory AtRiskReferral({
    required String id,
    required String studentId,
    @Default('') String studentName,
    String? studentNumber,
    required String sectionId,
    @Default('') String sectionName,
    @Default('') String subjectName,
    @Default('') String professorName,
    @Default('') String generatedById,
    @Default('') String generatedByName,
    required ReferralStatus status,
    String? note,
    @Default('') String createdAt,
    @Default('') String updatedAt,
  }) = _AtRiskReferral;

  factory AtRiskReferral.fromJson(Map<String, dynamic> json) =>
      _$AtRiskReferralFromJson(json);
}

@freezed
abstract class AtRiskReferralFilters with _$AtRiskReferralFilters {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ReferralStatusConverter()],
  )
  const factory AtRiskReferralFilters({
    ReferralStatus? status,
    String? sectionId,
  }) = _AtRiskReferralFilters;

  factory AtRiskReferralFilters.fromJson(Map<String, dynamic> json) =>
      _$AtRiskReferralFiltersFromJson(json);
}

const Map<ReferralStatus, String> referralStatusLabels = {
  ReferralStatus.generated: 'Generated',
  ReferralStatus.acknowledged: 'Acknowledged',
  ReferralStatus.counselingScheduled: 'Counseling scheduled',
  ReferralStatus.resolved: 'Resolved',
};
