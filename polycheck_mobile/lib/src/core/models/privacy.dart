import 'package:freezed_annotation/freezed_annotation.dart';

part 'privacy.freezed.dart';
part 'privacy.g.dart';

/// Mirrors `shared/src/types/privacy.ts` (RA 10173 transparency contracts).

/// Documented clamp for `geolocation_retention_days` (7-90, default 30).
const int geolocationRetentionMinDays = 7;
const int geolocationRetentionMaxDays = 90;
const int geolocationRetentionDefaultDays = 30;

/// Snapshot of the consent ledger for the current onboarding notice version.
@freezed
abstract class PrivacyConsentSnapshot with _$PrivacyConsentSnapshot {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory PrivacyConsentSnapshot({
    @Default(0) int covered,
    @Default(0) int totalActive,
    @Default('') String version,
  }) = _PrivacyConsentSnapshot;

  factory PrivacyConsentSnapshot.fromJson(Map<String, dynamic> json) =>
      _$PrivacyConsentSnapshotFromJson(json);
}

/// Last nightly telemetry shred, read from Redis (48 h) with an in-memory
/// fallback. `null` counts mean "unknown", never "zero".
@freezed
abstract class PrivacyEphemeralSnapshot with _$PrivacyEphemeralSnapshot {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory PrivacyEphemeralSnapshot({
    String? lastRunAt,
    int? recordsShredded,
    int? attemptsShredded,
  }) = _PrivacyEphemeralSnapshot;

  factory PrivacyEphemeralSnapshot.fromJson(Map<String, dynamic> json) =>
      _$PrivacyEphemeralSnapshotFromJson(json);
}

/// One row of the plain-language "what we store and why" inventory.
@freezed
abstract class PrivacyDataInventoryRow with _$PrivacyDataInventoryRow {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory PrivacyDataInventoryRow({
    required String data,
    required String purpose,
    required String lawfulBasis,
    required String lifetime,
  }) = _PrivacyDataInventoryRow;

  factory PrivacyDataInventoryRow.fromJson(Map<String, dynamic> json) =>
      _$PrivacyDataInventoryRowFromJson(json);
}

/// Response served by GET /settings/privacy-center.
@freezed
abstract class PrivacyCenterSnapshot with _$PrivacyCenterSnapshot {
  @JsonSerializable(fieldRename: FieldRename.none, explicitToJson: true)
  const factory PrivacyCenterSnapshot({
    @Default(geolocationRetentionDefaultDays) int retentionDays,
    required PrivacyConsentSnapshot consent,
    required PrivacyEphemeralSnapshot ephemeral,
    @Default(<PrivacyDataInventoryRow>[])
    List<PrivacyDataInventoryRow> dataInventory,
    @Default(<Object?>[]) List<Object?> breaches,
  }) = _PrivacyCenterSnapshot;

  factory PrivacyCenterSnapshot.fromJson(Map<String, dynamic> json) =>
      _$PrivacyCenterSnapshotFromJson(json);
}

/// The published data inventory (identical copy across web, Android, and DPO
/// summary).
const List<PrivacyDataInventoryRow> privacyDataInventory = [
  PrivacyDataInventoryRow(
    data:
        'Account identity (full name, student number, program and year level, '
        'faculty department)',
    purpose: 'Roster building, digital student ID, and official class records',
    lawfulBasis: 'RA 10173 §13 - legitimate educational interests',
    lifetime: 'While the account is active; deleted with the account',
  ),
  PrivacyDataInventoryRow(
    data:
        'Attendance record (session occurrence, status, timestamps, signed QR '
        'token snapshot)',
    purpose: 'The official attendance record of record for each class meeting',
    lawfulBasis: 'RA 10173 §13 - legitimate educational interests',
    lifetime:
        'Retained with academic-year records; status/decisional data is never '
        'shredded',
  ),
  PrivacyDataInventoryRow(
    data: 'Check-in GPS coordinates and accuracy (in-person sessions only)',
    purpose:
        'Verify the student is physically inside the class geofence at scan '
        'time (anti-proxy check-in)',
    lawfulBasis: 'RA 10173 §12(b)/§13 - consent obtained at onboarding',
    lifetime:
        'Shredded (nulled) after geolocation_retention_days (7-90, default 30) '
        'by the nightly job',
  ),
  PrivacyDataInventoryRow(
    data:
        'Scan attempt telemetry (device claims, accuracy, mock flags, input '
        'channel, risk signals)',
    purpose:
        'Audit trail and anti-cheat review for rejected or suspicious scan '
        'attempts',
    lawfulBasis: 'RA 10173 §13 - legitimate educational interests',
    lifetime:
        'Coordinates/accuracy/risk signals shredded on the same retention '
        'schedule; unlinked denied attempts pruned after 90 days',
  ),
  PrivacyDataInventoryRow(
    data:
        'Signed QR tokens and their hashes (issued at activation, valid 1-15 '
        'minutes)',
    purpose:
        'Cryptographic proof that a check-in was scanned from a teacher-signed '
        'code and was not replayed',
    lawfulBasis: 'RA 10173 §13 - legitimate educational interests',
    lifetime: 'Stored with the attendance record they validated',
  ),
  PrivacyDataInventoryRow(
    data:
        'Dispute and excuse submissions (reason, description, decision stamps)',
    purpose:
        'Let students contest attendance entries and let instructors resolve '
        'them with evidence',
    lawfulBasis: 'RA 10173 §13 - legitimate educational interests; consent',
    lifetime:
        'Retained with the academic-year record; decision outcome kept after '
        'coordinate shredding',
  ),
  PrivacyDataInventoryRow(
    data: 'Proof-of-class photos and report screenshots (image attachments)',
    purpose:
        'Verify that a class meeting occurred and document reported issues',
    lawfulBasis: 'RA 10173 §13 - legitimate educational interests',
    lifetime:
        'Teacher-managed deletion for proofs; screenshot attachments follow '
        'the report lifecycle',
  ),
  PrivacyDataInventoryRow(
    data:
        'Audit trail (who did what, from where, when - including institution '
        'settings changes)',
    purpose: 'Tamper-evident accountability log with daily external anchors',
    lawfulBasis: 'RA 10173 §13 - legitimate educational interests',
    lifetime: 'Default 7-year retention (AUDIT_LOG_RETENTION_DAYS)',
  ),
];

/// Clamps a hand-edited retention row into the documented 7-90 window.
int clampRetentionDays(num value) {
  if (!value.isFinite) return geolocationRetentionDefaultDays;
  return value
      .round()
      .clamp(geolocationRetentionMinDays, geolocationRetentionMaxDays)
      .toInt();
}

/// Consent coverage percentage; null when the denominator is zero.
int? consentCoveragePercent(int covered, int totalActive) {
  if (totalActive <= 0) return null;
  return ((covered / totalActive) * 100).round().clamp(0, 100).toInt();
}
