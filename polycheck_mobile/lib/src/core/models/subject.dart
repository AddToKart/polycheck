import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';

part 'subject.freezed.dart';
part 'subject.g.dart';

/// Mirrors `shared/src/types/subject.ts`.
enum DayOfWeek {
  mon('Mon'),
  tue('Tue'),
  wed('Wed'),
  thu('Thu'),
  fri('Fri'),
  sat('Sat'),
  sun('Sun');

  const DayOfWeek(this.wire);

  final String wire;

  static final Map<String, DayOfWeek> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static DayOfWeek fromWire(String value) =>
      decodeWireEnum('DayOfWeek', value, byWire);

  static DayOfWeek? tryParse(String value) => byWire[value];
}

class DayOfWeekConverter extends JsonConverter<DayOfWeek, String> {
  const DayOfWeekConverter();

  @override
  DayOfWeek fromJson(String json) => DayOfWeek.fromWire(json);

  @override
  String toJson(DayOfWeek object) => object.wire;
}

@freezed
abstract class ScheduleDay with _$ScheduleDay {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [DayOfWeekConverter()],
  )
  const factory ScheduleDay({
    required DayOfWeek day,
    required String startTime,
    required String endTime,
    String? room,
  }) = _ScheduleDay;

  factory ScheduleDay.fromJson(Map<String, dynamic> json) =>
      _$ScheduleDayFromJson(json);
}

@freezed
abstract class Subject with _$Subject {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory Subject({
    required String id,
    required String name,
    required String code,
    String? description,
    @Default('') String createdAt,
    @Default('') String updatedAt,
  }) = _Subject;

  factory Subject.fromJson(Map<String, dynamic> json) =>
      _$SubjectFromJson(json);
}

/// A section is the class instance of a [Subject] (course + section + roster).
@freezed
abstract class Section with _$Section {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [DayOfWeekConverter()],
  )
  const factory Section({
    required String id,
    required String subjectId,
    required String section,
    String? course,
    @Default('') String room,
    @Default(<ScheduleDay>[]) List<ScheduleDay> schedule,
    @Default('') String semester,
    required String teacherId,
    @Default('') String teacherName,
    String? enrollmentCode,
    String? enrollmentCodeExpiry,
    @Default(0) int studentCount,
    @Default('') String createdAt,
    @Default('') String updatedAt,
  }) = _Section;

  factory Section.fromJson(Map<String, dynamic> json) =>
      _$SectionFromJson(json);
}

@freezed
abstract class Enrollment with _$Enrollment {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory Enrollment({
    required String id,
    required String studentId,
    required String sectionId,
    @Default('') String enrolledAt,
  }) = _Enrollment;

  factory Enrollment.fromJson(Map<String, dynamic> json) =>
      _$EnrollmentFromJson(json);
}
