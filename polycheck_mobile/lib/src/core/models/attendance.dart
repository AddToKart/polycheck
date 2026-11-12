import 'package:freezed_annotation/freezed_annotation.dart';

import 'session.dart';
import 'support/wire_enum.dart';

part 'attendance.freezed.dart';
part 'attendance.g.dart';

/// Mirrors `shared/src/types/attendance.ts` (K11: enums mirror the backend
/// exactly; an unknown member throws [UnknownApiValue] instead of silently
/// defaulting).
enum AttendanceStatus {
  present('present'),
  late('late'),
  absent('absent'),
  pending('pending'),
  disputed('disputed'),
  excused('excused'),
  incomplete('incomplete');

  const AttendanceStatus(this.wire);

  final String wire;

  static final Map<String, AttendanceStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static AttendanceStatus fromWire(String value) =>
      decodeWireEnum('AttendanceStatus', value, byWire);

  static AttendanceStatus? tryParse(String value) => byWire[value];
}

class AttendanceStatusConverter
    extends JsonConverter<AttendanceStatus, String> {
  const AttendanceStatusConverter();

  @override
  AttendanceStatus fromJson(String json) => AttendanceStatus.fromWire(json);

  @override
  String toJson(AttendanceStatus object) => object.wire;
}

enum ExcuseStatus {
  requested('requested'),
  approved('approved'),
  rejected('rejected');

  const ExcuseStatus(this.wire);

  final String wire;

  static final Map<String, ExcuseStatus> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ExcuseStatus fromWire(String value) =>
      decodeWireEnum('ExcuseStatus', value, byWire);

  static ExcuseStatus? tryParse(String value) => byWire[value];
}

class ExcuseStatusConverter extends JsonConverter<ExcuseStatus, String> {
  const ExcuseStatusConverter();

  @override
  ExcuseStatus fromJson(String json) => ExcuseStatus.fromWire(json);

  @override
  String toJson(ExcuseStatus object) => object.wire;
}

enum ExcuseReason {
  medical('medical'),
  familyEmergency('family_emergency'),
  schoolActivity('school_activity'),
  transportation('transportation'),
  bereavement('bereavement'),
  other('other');

  const ExcuseReason(this.wire);

  final String wire;

  static final Map<String, ExcuseReason> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ExcuseReason fromWire(String value) =>
      decodeWireEnum('ExcuseReason', value, byWire);

  static ExcuseReason? tryParse(String value) => byWire[value];
}

class ExcuseReasonConverter extends JsonConverter<ExcuseReason, String> {
  const ExcuseReasonConverter();

  @override
  ExcuseReason fromJson(String json) => ExcuseReason.fromWire(json);

  @override
  String toJson(ExcuseReason object) => object.wire;
}

enum ExcuseDecision {
  approve('approve'),
  reject('reject');

  const ExcuseDecision(this.wire);

  final String wire;

  static final Map<String, ExcuseDecision> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ExcuseDecision fromWire(String value) =>
      decodeWireEnum('ExcuseDecision', value, byWire);

  static ExcuseDecision? tryParse(String value) => byWire[value];
}

/// The full dispute-reason union: the student request set plus the
/// system/server-side reasons a teacher sees on the review rail.
enum DisputeReason {
  outsideGeofence('outside_geofence'),
  expiredToken('expired_token'),
  duplicateSubmission('duplicate_submission'),
  invalidSignature('invalid_signature'),
  deviceMismatch('device_mismatch'),
  suspiciousCoordinates('suspicious_coordinates'),
  other('other'),
  delayedOfflineSync('delayed_offline_sync'),

  /// The validator stamps this when a scan carries no core evidence
  /// (`missingCoreEvidence` in `scan-validator.service.ts`) — the reason an
  /// offline replay without `inputChannel` lands on.
  missingScanEvidence('missing_scan_evidence'),
  invalidTimestamp('invalid_timestamp'),

  /// An offline replay whose client clock sat more than the tolerance behind
  /// the signed `issuedAt`. The backend keeps the evidence and flags it as
  /// disputed instead of rejecting it (scan-validator DD-3c), so the teacher
  /// rail must label it.
  implausibleClientTimestamp('implausible_client_timestamp'),
  tokenMismatch('token_mismatch'),
  sessionInactive('session_inactive'),
  notEnrolled('not_enrolled'),
  qrExpired('qr_expired'),
  rateLimited('rate_limited'),
  mockedLocation('mocked_location'),
  rootedDevice('rooted_device'),
  hookDetected('hook_detected'),
  emulatorDetected('emulator_detected'),
  concurrentSessionConflict('concurrent_session_conflict');

  const DisputeReason(this.wire);

  final String wire;

  static final Map<String, DisputeReason> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static DisputeReason fromWire(String value) =>
      decodeWireEnum('DisputeReason', value, byWire);

  static DisputeReason? tryParse(String value) => byWire[value];
}

/// Wire decode for [DisputeReason].
///
/// **Documented degraded mode (DD-C3):** an unknown reason decodes to
/// [DisputeReason.other] instead of throwing [UnknownApiValue]. The reason
/// union is server-stamped (`SystemDisputeReason`) and grows without warning;
/// a strict decode failed the *whole* `AttendanceRecord`, so a single row with
/// a newer reason blanked the teacher's entire disputes rail with
/// "Unable to load disputes". [disputeReasonLabel] / [disputeReasonIcon] already
/// degrade to a generic label, so one unfamiliar row now stays reviewable as
/// "Other". Every other wire enum keeps the strict K11 behaviour above.
class DisputeReasonConverter extends JsonConverter<DisputeReason, String> {
  const DisputeReasonConverter();

  @override
  DisputeReason fromJson(String json) =>
      DisputeReason.tryParse(json) ?? DisputeReason.other;

  @override
  String toJson(DisputeReason object) => object.wire;
}

/// `StudentDisputeReason` — exactly the seven reasons a student may submit.
const Set<DisputeReason> studentDisputeReasons = {
  DisputeReason.outsideGeofence,
  DisputeReason.expiredToken,
  DisputeReason.duplicateSubmission,
  DisputeReason.invalidSignature,
  DisputeReason.deviceMismatch,
  DisputeReason.suspiciousCoordinates,
  DisputeReason.other,
};

/// `SystemDisputeReason` — reasons only the server may stamp on a record.
const Set<DisputeReason> systemDisputeReasons = {
  DisputeReason.delayedOfflineSync,
  DisputeReason.missingScanEvidence,
  DisputeReason.invalidTimestamp,
  DisputeReason.implausibleClientTimestamp,
  DisputeReason.tokenMismatch,
  DisputeReason.sessionInactive,
  DisputeReason.notEnrolled,
  DisputeReason.qrExpired,
  DisputeReason.rateLimited,
  DisputeReason.mockedLocation,
  DisputeReason.rootedDevice,
  DisputeReason.hookDetected,
  DisputeReason.emulatorDetected,
  DisputeReason.concurrentSessionConflict,
};

extension DisputeReasonClassification on DisputeReason {
  /// True for the seven reasons a student may submit.
  bool get isStudentReason => studentDisputeReasons.contains(this);

  /// True for the server-stamped reasons a teacher reviews.
  bool get isSystemReason => systemDisputeReasons.contains(this);
}

@freezed
abstract class AttendanceCoordinates with _$AttendanceCoordinates {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AttendanceCoordinates({
    required double? latitude,
    required double? longitude,
  }) = _AttendanceCoordinates;

  factory AttendanceCoordinates.fromJson(Map<String, dynamic> json) =>
      _$AttendanceCoordinatesFromJson(json);
}

@freezed
abstract class AttendanceRecord with _$AttendanceRecord {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [
      AttendanceStatusConverter(),
      SessionModeConverter(),
      DisputeReasonConverter(),
      ExcuseStatusConverter(),
    ],
  )
  const factory AttendanceRecord({
    required String id,
    required String sessionId,
    required String sectionId,
    required String studentId,
    @Default('') String studentName,
    String? studentProgram,
    @Default('') String timestamp,
    required AttendanceStatus status,
    @Default(AttendanceCoordinates(latitude: null, longitude: null))
    AttendanceCoordinates coordinates,
    SessionMode? mode,
    String? checkInTime,
    AttendanceStatus? checkInStatus,
    String? checkOutTime,
    AttendanceStatus? checkOutStatus,
    String? deviceId,
    String? tokenSnapshot,
    @Default(false) bool isSynced,
    String? syncedAt,
    DisputeReason? disputeReason,
    @Default(false) bool disputeResolved,
    String? disputeDescription,
    @Default(false) bool manuallySet,
    String? notes,
    ExcuseStatus? excuseStatus,
    ExcuseReason? excuseReason,
    String? excuseDescription,
    String? excuseEvidencePath,
    String? excuseReviewedBy,
    String? excuseReviewedAt,
    String? excuseReviewNote,
  }) = _AttendanceRecord;

  factory AttendanceRecord.fromJson(Map<String, dynamic> json) =>
      _$AttendanceRecordFromJson(json);
}

@freezed
abstract class AttendanceSummary with _$AttendanceSummary {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AttendanceSummary({
    required String sectionId,
    @Default('') String subjectName,
    @Default(0) int totalSessions,
    @Default(0) int present,
    @Default(0) int late,
    @Default(0) int absent,
    @Default(0) int disputed,
    @Default(0) int excused,
    @Default(0) int incomplete,
  }) = _AttendanceSummary;

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) =>
      _$AttendanceSummaryFromJson(json);
}

/// Live geofence anomaly broadcast (`attendance:anomaly`).
@freezed
abstract class AttendanceAnomalyEvent with _$AttendanceAnomalyEvent {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory AttendanceAnomalyEvent({
    required String sessionId,
    required String studentId,
    String? studentName,
    String? studentNumber,
    required double? latitude,
    required double? longitude,
    double? distanceMeters,
    double? geofenceRadiusMeters,
    required String reason,
    required String timestamp,
  }) = _AttendanceAnomalyEvent;

  factory AttendanceAnomalyEvent.fromJson(Map<String, dynamic> json) =>
      _$AttendanceAnomalyEventFromJson(json);
}

enum ScanAttemptOutcome {
  accepted('accepted'),
  denied('denied'),
  pending('pending');

  const ScanAttemptOutcome(this.wire);

  final String wire;

  static final Map<String, ScanAttemptOutcome> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static ScanAttemptOutcome fromWire(String value) =>
      decodeWireEnum('ScanAttemptOutcome', value, byWire);
}

class ScanAttemptOutcomeConverter
    extends JsonConverter<ScanAttemptOutcome, String> {
  const ScanAttemptOutcomeConverter();

  @override
  ScanAttemptOutcome fromJson(String json) => ScanAttemptOutcome.fromWire(json);

  @override
  String toJson(ScanAttemptOutcome object) => object.wire;
}

@freezed
abstract class ScanAttemptView with _$ScanAttemptView {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [ScanAttemptOutcomeConverter()],
  )
  const factory ScanAttemptView({
    required String id,
    required String sessionId,
    required String studentId,
    @Default('') String studentName,
    String? studentNumber,
    required String timestamp,
    String? clientScannedAt,
    required String receivedAt,
    @Default(AttendanceCoordinates(latitude: null, longitude: null))
    AttendanceCoordinates coordinates,
    double? accuracyMeters,
    double? distanceMeters,
    double? geofenceRadiusMeters,
    required ScanAttemptOutcome outcome,
    String? denialReason,
    bool? mocked,
    bool? pinVerified,
    bool? offline,
    String? inputChannel,
    String? checkpoint,
    String? deviceIdMasked,
  }) = _ScanAttemptView;

  factory ScanAttemptView.fromJson(Map<String, dynamic> json) =>
      _$ScanAttemptViewFromJson(json);
}

enum RecordTimelineEventKind {
  activation('activation'),
  scan('scan'),
  signature('signature'),
  queue('queue'),
  network('network'),
  sync('sync'),
  dispute('dispute'),
  decision('decision'),
  excuse('excuse');

  const RecordTimelineEventKind(this.wire);

  final String wire;

  static final Map<String, RecordTimelineEventKind> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static RecordTimelineEventKind fromWire(String value) =>
      decodeWireEnum('RecordTimelineEventKind', value, byWire);
}

class RecordTimelineEventKindConverter
    extends JsonConverter<RecordTimelineEventKind, String> {
  const RecordTimelineEventKindConverter();

  @override
  RecordTimelineEventKind fromJson(String json) =>
      RecordTimelineEventKind.fromWire(json);

  @override
  String toJson(RecordTimelineEventKind object) => object.wire;
}

enum RecordTimelineEventSource {
  session('session'),
  scanAttempt('scan_attempt'),
  token('token'),
  record('record'),
  audit('audit');

  const RecordTimelineEventSource(this.wire);

  final String wire;

  static final Map<String, RecordTimelineEventSource> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static RecordTimelineEventSource fromWire(String value) =>
      decodeWireEnum('RecordTimelineEventSource', value, byWire);
}

class RecordTimelineEventSourceConverter
    extends JsonConverter<RecordTimelineEventSource, String> {
  const RecordTimelineEventSourceConverter();

  @override
  RecordTimelineEventSource fromJson(String json) =>
      RecordTimelineEventSource.fromWire(json);

  @override
  String toJson(RecordTimelineEventSource object) => object.wire;
}

@freezed
abstract class RecordTimelineEventDetail with _$RecordTimelineEventDetail {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory RecordTimelineEventDetail({
    double? distanceMeters,
    double? radiusMeters,
    bool? insideGeofence,
    bool? mocked,
    bool? pinVerified,
    String? channel,
    String? deviceIdMasked,
    String? receiptId,
  }) = _RecordTimelineEventDetail;

  factory RecordTimelineEventDetail.fromJson(Map<String, dynamic> json) =>
      _$RecordTimelineEventDetailFromJson(json);
}

@freezed
abstract class RecordTimelineEvent with _$RecordTimelineEvent {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [
      RecordTimelineEventKindConverter(),
      RecordTimelineEventSourceConverter(),
    ],
  )
  const factory RecordTimelineEvent({
    required RecordTimelineEventKind kind,
    required String at,
    required String label,
    required RecordTimelineEventSource source,
    RecordTimelineEventDetail? detail,
  }) = _RecordTimelineEvent;

  factory RecordTimelineEvent.fromJson(Map<String, dynamic> json) =>
      _$RecordTimelineEventFromJson(json);
}

enum DisputeRecommendationVerdict {
  accept('accept'),
  review('review'),
  reject('reject');

  const DisputeRecommendationVerdict(this.wire);

  final String wire;

  static final Map<String, DisputeRecommendationVerdict> byWire = wireLookup(
    values,
    (v) => v.wire,
  );

  static DisputeRecommendationVerdict fromWire(String value) =>
      decodeWireEnum('DisputeRecommendationVerdict', value, byWire);
}

class DisputeRecommendationVerdictConverter
    extends JsonConverter<DisputeRecommendationVerdict, String> {
  const DisputeRecommendationVerdictConverter();

  @override
  DisputeRecommendationVerdict fromJson(String json) =>
      DisputeRecommendationVerdict.fromWire(json);

  @override
  String toJson(DisputeRecommendationVerdict object) => object.wire;
}

@freezed
abstract class DisputeRecommendation with _$DisputeRecommendation {
  @JsonSerializable(
    fieldRename: FieldRename.none,
    explicitToJson: true,
    converters: [DisputeRecommendationVerdictConverter()],
  )
  const factory DisputeRecommendation({
    required DisputeRecommendationVerdict verdict,
    required String rationale,
  }) = _DisputeRecommendation;

  factory DisputeRecommendation.fromJson(Map<String, dynamic> json) =>
      _$DisputeRecommendationFromJson(json);
}

@freezed
abstract class RecordTimeline with _$RecordTimeline {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory RecordTimeline({
    required String recordId,
    @Default(<RecordTimelineEvent>[]) List<RecordTimelineEvent> events,
    required DisputeRecommendation recommendation,
  }) = _RecordTimeline;

  factory RecordTimeline.fromJson(Map<String, dynamic> json) =>
      _$RecordTimelineFromJson(json);
}

const Map<RecordTimelineEventKind, String> recordTimelineEventKindLabels = {
  RecordTimelineEventKind.activation: 'Activation',
  RecordTimelineEventKind.scan: 'Scan attempt',
  RecordTimelineEventKind.signature: 'Signature',
  RecordTimelineEventKind.queue: 'Queued on device',
  RecordTimelineEventKind.network: 'Network',
  RecordTimelineEventKind.sync: 'Sync',
  RecordTimelineEventKind.dispute: 'Dispute',
  RecordTimelineEventKind.decision: 'Decision',
  RecordTimelineEventKind.excuse: 'Excuse',
};

const Map<DisputeRecommendationVerdict, String> disputeRecommendationLabels = {
  DisputeRecommendationVerdict.accept: 'Accept',
  DisputeRecommendationVerdict.review: 'Review',
  DisputeRecommendationVerdict.reject: 'Reject',
};
