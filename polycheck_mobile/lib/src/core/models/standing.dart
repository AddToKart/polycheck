import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';

part 'standing.freezed.dart';
part 'standing.g.dart';

/// Mirrors `shared/src/types/standing.ts`.
enum AttendanceStandingStatus {
  onTrack('on_track'),
  atRisk('at_risk'),
  belowThreshold('below_threshold'),
  insufficientData('insufficient_data');

  const AttendanceStandingStatus(this.wire);

  final String wire;

  static final Map<String, AttendanceStandingStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AttendanceStandingStatus fromWire(String value) =>
      decodeWireEnum('AttendanceStandingStatus', value, byWire);

  static AttendanceStandingStatus? tryParse(String value) => byWire[value];
}

class AttendanceStandingStatusConverter
    extends JsonConverter<AttendanceStandingStatus, String> {
  const AttendanceStandingStatusConverter();

  @override
  AttendanceStandingStatus fromJson(String json) =>
      AttendanceStandingStatus.fromWire(json);

  @override
  String toJson(AttendanceStandingStatus object) => object.wire;
}

@freezed
abstract class AttendanceStanding with _$AttendanceStanding {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AttendanceStandingStatusConverter()],
  )
  const factory AttendanceStanding({
    required String sectionId,
    @Default('') String subjectName,
    @Default('') String subjectCode,
    @Default('') String sectionName,
    @Default('') String professorName,
    @Default(75) int thresholdPercent,
    @Default(0) int present,
    @Default(0) int late,
    @Default(0) int absent,
    @Default(0) int disputed,
    @Default(0) int incomplete,
    @Default(0) int countedSessions,
    double? attendanceRate,
    required AttendanceStandingStatus status,
    int? absencesBeforeBelowThreshold,
    String? lastSessionDate,
    String? caveat,
  }) = _AttendanceStanding;

  factory AttendanceStanding.fromJson(Map<String, dynamic> json) =>
      _$AttendanceStandingFromJson(json);
}
