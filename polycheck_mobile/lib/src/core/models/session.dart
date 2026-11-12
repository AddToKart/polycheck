import 'package:freezed_annotation/freezed_annotation.dart';

import 'support/wire_enum.dart';

part 'session.freezed.dart';
part 'session.g.dart';

/// Mirrors `shared/src/types/session.ts`.
enum SessionMode {
  inPerson('in_person'),
  online('online');

  const SessionMode(this.wire);

  final String wire;

  static final Map<String, SessionMode> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static SessionMode fromWire(String value) =>
      decodeWireEnum('SessionMode', value, byWire);

  static SessionMode? tryParse(String value) => byWire[value];
}

class SessionModeConverter extends JsonConverter<SessionMode, String> {
  const SessionModeConverter();

  @override
  SessionMode fromJson(String json) => SessionMode.fromWire(json);

  @override
  String toJson(SessionMode object) => object.wire;
}

enum CheckpointType {
  start('start'),
  end('end');

  const CheckpointType(this.wire);

  final String wire;

  static final Map<String, CheckpointType> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static CheckpointType fromWire(String value) =>
      decodeWireEnum('CheckpointType', value, byWire);

  static CheckpointType? tryParse(String value) => byWire[value];
}

class CheckpointTypeConverter extends JsonConverter<CheckpointType, String> {
  const CheckpointTypeConverter();

  @override
  CheckpointType fromJson(String json) => CheckpointType.fromWire(json);

  @override
  String toJson(CheckpointType object) => object.wire;
}

/// Every status the session-finale broadcast can count.
enum FinaleCountStatus {
  present('present'),
  late('late'),
  absent('absent'),
  excused('excused'),
  incomplete('incomplete'),
  disputed('disputed'),
  pending('pending');

  const FinaleCountStatus(this.wire);

  final String wire;

  static final Map<String, FinaleCountStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static FinaleCountStatus fromWire(String value) =>
      decodeWireEnum('FinaleCountStatus', value, byWire);

  static FinaleCountStatus? tryParse(String value) => byWire[value];
}

class FinaleCountStatusConverter
    extends JsonConverter<FinaleCountStatus, String> {
  const FinaleCountStatusConverter();

  @override
  FinaleCountStatus fromJson(String json) => FinaleCountStatus.fromWire(json);

  @override
  String toJson(FinaleCountStatus object) => object.wire;
}

Map<FinaleCountStatus, int> finaleCountsFromJson(Map<String, dynamic> json) {
  return {
    for (final entry in json.entries)
      FinaleCountStatus.fromWire(entry.key): (entry.value as num).toInt(),
  };
}

Map<String, dynamic> finaleCountsToJson(Map<FinaleCountStatus, int> counts) {
  return {for (final entry in counts.entries) entry.key.wire: entry.value};
}

@freezed
abstract class GeofenceConfig with _$GeofenceConfig {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory GeofenceConfig({
    required double latitude,
    required double longitude,
    required double radiusMeters,
  }) = _GeofenceConfig;

  factory GeofenceConfig.fromJson(Map<String, dynamic> json) =>
      _$GeofenceConfigFromJson(json);
}

@freezed
abstract class Session with _$Session {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [SessionModeConverter()],
  )
  const factory Session({
    required String id,
    required String sectionId,
    @Default('') String subjectName,
    required String date,
    @Default('') String startTime,
    @Default('') String endTime,
    String? room,
    @Default(SessionMode.inPerson) SessionMode mode,
    @Default(15) int qrValidityMinutes,
    @Default(15) int gracePeriodMinutes,
    GeofenceConfig? geofence,
    @Default(false) bool isActive,
    String? endedAt,
    String? qrToken,
    String? qrTokenExpiresAt,
    String? qrGeneratedAt,
    int? startQrValiditySeconds,
    int? startGraceMinutes,
    int? endQrValiditySeconds,
    int? endGraceMinutes,
    String? startQrToken,
    String? startTokenExpiresAt,
    String? startQrGeneratedAt,
    String? endQrToken,
    String? endTokenExpiresAt,
    String? endQrGeneratedAt,
    @Default(false) bool pinRequired,
    String? autoEndAt,
    required String teacherId,
    String? teacherPublicKey,
    @Default('') String createdAt,
    @Default(false) bool isRescheduled,
    String? rescheduledFromDate,
    String? originalScheduleTime,
    String? originalRoom,
  }) = _Session;

  factory Session.fromJson(Map<String, dynamic> json) =>
      _$SessionFromJson(json);
}

/// Signed QR payload (`shared/src/utils/token.ts`).
///
/// `issuedAt` is the trusted epoch-ms stamp baked into the signature; expiry
/// math must use it (never the device wall clock).
@freezed
abstract class QRTokenPayload with _$QRTokenPayload {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [SessionModeConverter(), CheckpointTypeConverter()],
  )
  const factory QRTokenPayload({
    required int version,
    required String sessionId,
    required String sectionId,
    required int issuedAt,
    required int validityMinutes,
    required int gracePeriodMinutes,
    required String teacherId,
    required String teacherName,
    @Default(SessionMode.inPerson) SessionMode mode,
    CheckpointType? checkpoint,
    @Default(false) bool pinRequired,
    String? pinHash,
    int? validitySeconds,
  }) = _QRTokenPayload;

  factory QRTokenPayload.fromJson(Map<String, dynamic> json) =>
      _$QRTokenPayloadFromJson(json);
}

@freezed
abstract class SessionFinaleSummary with _$SessionFinaleSummary {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory SessionFinaleSummary({
    required String sessionId,
    required String endedAt,
    @JsonKey(fromJson: finaleCountsFromJson, toJson: finaleCountsToJson)
    @Default(<FinaleCountStatus, int>{})
    Map<FinaleCountStatus, int> counts,
    @Default(0) int capacity,
  }) = _SessionFinaleSummary;

  factory SessionFinaleSummary.fromJson(Map<String, dynamic> json) =>
      _$SessionFinaleSummaryFromJson(json);
}

/// Realtime event names mirrored from the shared contract.
abstract final class SessionEvents {
  static const String attendanceAnomaly = 'attendance:anomaly';
  static const String sessionFinale = 'session:finale';
  static const String kioskJoin = 'kiosk:join';
  static const String kioskJoined = 'kiosk:joined';
  static const String kioskLeave = 'kiosk:leave';
}
