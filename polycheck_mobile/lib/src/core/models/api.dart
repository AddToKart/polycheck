import 'package:freezed_annotation/freezed_annotation.dart';

import 'session.dart';
import 'support/wire_enum.dart';
import 'user.dart';

export 'user.dart' show DelegatedTeacherPermissions;

part 'api.freezed.dart';
part 'api.g.dart';

/// Input/response contracts from `shared/src/types/api.ts` used by clients.
///
/// The NestJS `ApiClient` interface itself is intentionally not ported (Dart
/// talks HTTP through the network layer); only the DTO shapes live here.
@freezed
abstract class CreateSubjectInput with _$CreateSubjectInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory CreateSubjectInput({
    required String name,
    required String code,
    String? description,
  }) = _CreateSubjectInput;

  factory CreateSubjectInput.fromJson(Map<String, dynamic> json) =>
      _$CreateSubjectInputFromJson(json);
}

@freezed
abstract class CreateTeacherInput with _$CreateTeacherInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory CreateTeacherInput({
    required String fullName,
    required String email,
    String? password,
    String? department,
  }) = _CreateTeacherInput;

  factory CreateTeacherInput.fromJson(Map<String, dynamic> json) =>
      _$CreateTeacherInputFromJson(json);
}

@freezed
abstract class CreateStudentInput with _$CreateStudentInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory CreateStudentInput({
    required String fullName,
    required String studentId,
    String? email,
    String? password,
    required String program,
    required int yearLevel,
    required String department,
  }) = _CreateStudentInput;

  factory CreateStudentInput.fromJson(Map<String, dynamic> json) =>
      _$CreateStudentInputFromJson(json);
}

@freezed
abstract class CreateSectionScheduleSlot with _$CreateSectionScheduleSlot {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory CreateSectionScheduleSlot({
    required String day,
    required String startTime,
    required String endTime,
    String? room,
  }) = _CreateSectionScheduleSlot;

  factory CreateSectionScheduleSlot.fromJson(Map<String, dynamic> json) =>
      _$CreateSectionScheduleSlotFromJson(json);
}

@freezed
abstract class CreateSectionInput with _$CreateSectionInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory CreateSectionInput({
    required String subjectId,
    required String section,
    String? course,
    required String room,
    @Default(<CreateSectionScheduleSlot>[])
    List<CreateSectionScheduleSlot> schedule,
    required String semester,
  }) = _CreateSectionInput;

  factory CreateSectionInput.fromJson(Map<String, dynamic> json) =>
      _$CreateSectionInputFromJson(json);
}

@freezed
abstract class CreateSessionInput with _$CreateSessionInput {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [SessionModeConverter()],
  )
  const factory CreateSessionInput({
    required String sectionId,
    required String subjectName,
    required String date,
    required String startTime,
    required String endTime,
    String? room,
    SessionMode? mode,
    int? qrValidityMinutes,
    int? gracePeriodMinutes,
    int? startQrValiditySeconds,
    int? startGraceMinutes,
    int? endQrValiditySeconds,
    GeofenceConfig? geofence,
    required String teacherId,
    bool? isRescheduled,
    String? rescheduledFromDate,
    String? originalScheduleTime,
    String? originalRoom,
  }) = _CreateSessionInput;

  factory CreateSessionInput.fromJson(Map<String, dynamic> json) =>
      _$CreateSessionInputFromJson(json);
}

/// Optional teacher activation evidence for in-person sessions (V4).
@freezed
abstract class TeacherActivationLocation with _$TeacherActivationLocation {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory TeacherActivationLocation({
    double? latitude,
    double? longitude,
    @JsonKey(name: 'override') bool? overrideFlag,
  }) = _TeacherActivationLocation;

  factory TeacherActivationLocation.fromJson(Map<String, dynamic> json) =>
      _$TeacherActivationLocationFromJson(json);
}

@freezed
abstract class GenerateCheckpointQrInput with _$GenerateCheckpointQrInput {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [CheckpointTypeConverter()],
  )
  const factory GenerateCheckpointQrInput({
    required String sessionId,
    required CheckpointType checkpoint,
    required int validitySeconds,
    int? graceMinutes,
    bool? regenerate,
    String? pin,
    TeacherActivationLocation? teacherLocation,
  }) = _GenerateCheckpointQrInput;

  factory GenerateCheckpointQrInput.fromJson(Map<String, dynamic> json) =>
      _$GenerateCheckpointQrInputFromJson(json);
}

/// Shared-contract name for the checkpoint QR request.
typedef ActivateCheckpointInput = GenerateCheckpointQrInput;

@freezed
abstract class BulkSessionSlot with _$BulkSessionSlot {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory BulkSessionSlot({
    required String day,
    required String startTime,
    required String endTime,
  }) = _BulkSessionSlot;

  factory BulkSessionSlot.fromJson(Map<String, dynamic> json) =>
      _$BulkSessionSlotFromJson(json);
}

@freezed
abstract class BulkSessionInput with _$BulkSessionInput {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [SessionModeConverter()],
  )
  const factory BulkSessionInput({
    required String sectionId,
    required String subjectName,
    required String startDate,
    required String endDate,
    List<BulkSessionSlot>? slots,
    List<String>? daysOfWeek,
    String? startTime,
    String? endTime,
    String? room,
    SessionMode? mode,
    int? qrValidityMinutes,
    int? gracePeriodMinutes,
    int? startQrValiditySeconds,
    int? startGraceMinutes,
    int? endQrValiditySeconds,
    GeofenceConfig? geofence,
    required String teacherId,
  }) = _BulkSessionInput;

  factory BulkSessionInput.fromJson(Map<String, dynamic> json) =>
      _$BulkSessionInputFromJson(json);
}

/// Validation-schema shape for bulk creation (`BulkSessionCreateSchema`).
///
/// The request body the mobile client sends is [BulkSessionInput] (adds the
/// authenticated `teacherId`); both share the same JSON field names.
typedef BulkSessionCreate = BulkSessionInput;

@freezed
abstract class EnrollStudentInput with _$EnrollStudentInput {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory EnrollStudentInput({
    required String sectionId,
    required String studentId,
    required String studentName,
  }) = _EnrollStudentInput;

  factory EnrollStudentInput.fromJson(Map<String, dynamic> json) =>
      _$EnrollStudentInputFromJson(json);
}

enum CalendarEventType {
  session('session'),
  schedule('schedule');

  const CalendarEventType(this.wire);

  final String wire;

  static final Map<String, CalendarEventType> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static CalendarEventType fromWire(String value) =>
      decodeWireEnum('CalendarEventType', value, byWire);

  static CalendarEventType? tryParse(String value) => byWire[value];
}

class CalendarEventTypeConverter
    extends JsonConverter<CalendarEventType, String> {
  const CalendarEventTypeConverter();

  @override
  CalendarEventType fromJson(String json) => CalendarEventType.fromWire(json);

  @override
  String toJson(CalendarEventType object) => object.wire;
}

enum CalendarEventStatus {
  active('active'),
  inactive('inactive'),
  completed('completed'),
  moved('moved');

  const CalendarEventStatus(this.wire);

  final String wire;

  static final Map<String, CalendarEventStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static CalendarEventStatus fromWire(String value) =>
      decodeWireEnum('CalendarEventStatus', value, byWire);

  static CalendarEventStatus? tryParse(String value) => byWire[value];
}

class CalendarEventStatusConverter
    extends JsonConverter<CalendarEventStatus, String> {
  const CalendarEventStatusConverter();

  @override
  CalendarEventStatus fromJson(String json) =>
      CalendarEventStatus.fromWire(json);

  @override
  String toJson(CalendarEventStatus object) => object.wire;
}

enum CalendarEventStudentStatus {
  present('present'),
  late('late'),
  absent('absent');

  const CalendarEventStudentStatus(this.wire);

  final String wire;

  static final Map<String, CalendarEventStudentStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static CalendarEventStudentStatus fromWire(String value) =>
      decodeWireEnum('CalendarEventStudentStatus', value, byWire);

  static CalendarEventStudentStatus? tryParse(String value) => byWire[value];
}

class CalendarEventStudentStatusConverter
    extends JsonConverter<CalendarEventStudentStatus, String> {
  const CalendarEventStudentStatusConverter();

  @override
  CalendarEventStudentStatus fromJson(String json) =>
      CalendarEventStudentStatus.fromWire(json);

  @override
  String toJson(CalendarEventStudentStatus object) => object.wire;
}

@freezed
abstract class CalendarEventAttendanceCounts
    with _$CalendarEventAttendanceCounts {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory CalendarEventAttendanceCounts({
    @Default(0) int present,
    @Default(0) int late,
    @Default(0) int absent,
    @Default(0) int disputed,
  }) = _CalendarEventAttendanceCounts;

  factory CalendarEventAttendanceCounts.fromJson(Map<String, dynamic> json) =>
      _$CalendarEventAttendanceCountsFromJson(json);
}

@freezed
abstract class CalendarEventReschedule with _$CalendarEventReschedule {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory CalendarEventReschedule({
    required String date,
    required String startTime,
    required String endTime,
    String? room,
  }) = _CalendarEventReschedule;

  factory CalendarEventReschedule.fromJson(Map<String, dynamic> json) =>
      _$CalendarEventRescheduleFromJson(json);
}

@freezed
abstract class CalendarEvent with _$CalendarEvent {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [
      CalendarEventTypeConverter(),
      CalendarEventStatusConverter(),
      CalendarEventStudentStatusConverter(),
    ],
  )
  const factory CalendarEvent({
    required String id,
    @Default('') String title,
    required String date,
    @Default('') String startTime,
    @Default('') String endTime,
    String? room,
    required String sectionId,
    @Default('') String subjectName,
    @Default('') String sectionName,
    required CalendarEventType type,
    CalendarEventStatus? status,
    CalendarEventStudentStatus? studentStatus,
    CalendarEventAttendanceCounts? attendanceCounts,
    String? teacherName,
    String? subjectCode,
    bool? isRescheduled,
    String? rescheduledFromDate,
    CalendarEventReschedule? rescheduledTo,
  }) = _CalendarEvent;

  factory CalendarEvent.fromJson(Map<String, dynamic> json) =>
      _$CalendarEventFromJson(json);
}

@freezed
abstract class EmergencyDeviceReleaseResult
    with _$EmergencyDeviceReleaseResult {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory EmergencyDeviceReleaseResult({
    required User user,
    @Default(false) bool clearedCooldown,
    bool? hadCooldown,
    bool? hadBinding,
    @Default('') String message,
  }) = _EmergencyDeviceReleaseResult;

  factory EmergencyDeviceReleaseResult.fromJson(Map<String, dynamic> json) =>
      _$EmergencyDeviceReleaseResultFromJson(json);
}

enum AuditOutcome {
  initiated('initiated'),
  succeeded('succeeded'),
  failed('failed');

  const AuditOutcome(this.wire);

  final String wire;

  static final Map<String, AuditOutcome> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AuditOutcome fromWire(String value) =>
      decodeWireEnum('AuditOutcome', value, byWire);

  static AuditOutcome? tryParse(String value) => byWire[value];
}

class AuditOutcomeConverter extends JsonConverter<AuditOutcome, String> {
  const AuditOutcomeConverter();

  @override
  AuditOutcome fromJson(String json) => AuditOutcome.fromWire(json);

  @override
  String toJson(AuditOutcome object) => object.wire;
}

@freezed
abstract class AuditLogEntry with _$AuditLogEntry {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [AuditOutcomeConverter()],
  )
  const factory AuditLogEntry({
    required String id,
    @Default('') String actorId,
    @Default('') String actorName,
    @Default('') String actorRole,
    @Default('') String action,
    @Default('') String entityType,
    String? entityId,
    required AuditOutcome outcome,
    String? ipAddress,
    @Default('') String createdAt,
  }) = _AuditLogEntry;

  factory AuditLogEntry.fromJson(Map<String, dynamic> json) =>
      _$AuditLogEntryFromJson(json);
}
