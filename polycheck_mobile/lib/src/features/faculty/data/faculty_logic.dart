import 'package:flutter/material.dart';

import '../../../core/polycheck_core.dart';

/// Pure faculty-side presentation logic shared by the screens and unit tests.
///
/// Everything here mirrors an existing web/Android rule: the manual override
/// cycle (`frontend/src/app/faculty/sessions/[id]/page.tsx:42`), the teacher
/// dispute rail labels (`frontend/src/app/faculty/disputes/page.tsx:49`), the
/// standing math (`backend/src/standing/standing.service.ts:153`), and the
/// at-risk ordering used by the oversight page.

// ── Attendance status cycle ──

/// The backend's manual-decision allowlist (`UpdateAttendanceStatusDto` and
/// `CreateManualAttendanceDto` in `backend/src/attendance/dto/attendance.dto.ts`).
///
/// `pending` is deliberately absent: it is a system pre-resolution state, never
/// a teacher decision, so sending it is a 400 (FLF-02).
const Set<AttendanceStatus> editableAttendanceStatuses = <AttendanceStatus>{
  AttendanceStatus.present,
  AttendanceStatus.late,
  AttendanceStatus.absent,
  AttendanceStatus.disputed,
  AttendanceStatus.incomplete,
};

/// The statuses a professor can set by hand, as on the website. `incomplete` is
/// offered because half-attended online sessions resolve to it; `pending` is
/// not, because the backend rejects it (FLF-02).
const List<AttendanceStatus> manualStatusChoices = <AttendanceStatus>[
  AttendanceStatus.present,
  AttendanceStatus.late,
  AttendanceStatus.incomplete,
  AttendanceStatus.absent,
];

/// Whether a row may be changed by hand. Disputed and excused rows are resolved
/// through their own queues.
bool isManualCycleStatus(AttendanceStatus status) {
  return status != AttendanceStatus.disputed &&
      status != AttendanceStatus.excused;
}

// ── Dispute labels / icons (teacher rail) ──

const Map<DisputeReason, String> disputeReasonLabels = {
  DisputeReason.outsideGeofence: 'Outside Geofence',
  DisputeReason.expiredToken: 'Expired Token',
  DisputeReason.duplicateSubmission: 'Duplicate Submission',
  DisputeReason.invalidSignature: 'Invalid Signature',
  DisputeReason.deviceMismatch: 'Device Mismatch',
  DisputeReason.other: 'Other',
  DisputeReason.suspiciousCoordinates: 'Suspicious GPS',
  DisputeReason.delayedOfflineSync: 'Delayed Offline Sync',
  DisputeReason.missingScanEvidence: 'Missing Scan Evidence',
  DisputeReason.invalidTimestamp: 'Invalid Timestamp',
  DisputeReason.implausibleClientTimestamp: 'Implausible Client Timestamp',
  DisputeReason.tokenMismatch: 'QR Token Mismatch',
  DisputeReason.sessionInactive: 'Inactive Session',
  DisputeReason.notEnrolled: 'Not Enrolled',
  DisputeReason.qrExpired: 'QR Expired',
  DisputeReason.rateLimited: 'Rate Limited',
  DisputeReason.mockedLocation: 'Mock GPS / Fake Location',
  DisputeReason.rootedDevice: 'Rooted / Jailbroken Device',
  DisputeReason.hookDetected: 'Hooking Tool Detected',
  DisputeReason.emulatorDetected: 'Android Emulator Detected',
  DisputeReason.concurrentSessionConflict: 'Concurrent Session',
};

const Map<DisputeReason, IconData> disputeReasonIcons = {
  DisputeReason.outsideGeofence: Icons.place_outlined,
  DisputeReason.expiredToken: Icons.timer_outlined,
  DisputeReason.duplicateSubmission: Icons.copy_all_outlined,
  DisputeReason.invalidSignature: Icons.fingerprint,
  DisputeReason.deviceMismatch: Icons.smartphone_outlined,
  DisputeReason.other: Icons.warning_amber_outlined,
  DisputeReason.suspiciousCoordinates: Icons.warning_amber_outlined,
  DisputeReason.delayedOfflineSync: Icons.schedule,
  DisputeReason.missingScanEvidence: Icons.report_gmailerrorred_outlined,
  DisputeReason.invalidTimestamp: Icons.schedule,
  DisputeReason.implausibleClientTimestamp: Icons.update_disabled_outlined,
  DisputeReason.tokenMismatch: Icons.fingerprint,
  DisputeReason.sessionInactive: Icons.timer_outlined,
  DisputeReason.notEnrolled: Icons.warning_amber_outlined,
  DisputeReason.qrExpired: Icons.timer_outlined,
  DisputeReason.rateLimited: Icons.warning_amber_outlined,
  DisputeReason.mockedLocation: Icons.warning_amber_outlined,
  DisputeReason.rootedDevice: Icons.shield_outlined,
  DisputeReason.hookDetected: Icons.memory_outlined,
  DisputeReason.emulatorDetected: Icons.smartphone_outlined,
  DisputeReason.concurrentSessionConflict: Icons.schedule,
};

String disputeReasonLabel(DisputeReason? reason) {
  if (reason == null) return 'Unknown';
  return disputeReasonLabelForWire(reason.wire);
}

IconData disputeReasonIcon(DisputeReason? reason) {
  if (reason == null) return Icons.help_outline;
  return disputeReasonIconForWire(reason.wire);
}

// ── Gateway-persisted dispute reasons (ING-07) ──

/// Reasons the ingest gateway (`services/ingest/src/core/scan.ts`) and the
/// control plane persist that are outside the shared `DisputeReason` union.
///
/// The union is NOT widened here: `DisputeReasonConverter` must keep degrading
/// unknown wires to [DisputeReason.other] instead of throwing, and widening a
/// persisted enum ripples into the sync replay payloads. Instead every known
/// gateway wire gets a display entry and anything unexpected is humanized.
const Map<String, String> gatewayDisputeReasonLabels = <String, String>{
  'missing_location': 'Missing Location',
  'missing_geofence': 'Missing Geofence',
  'geofence_uncertain': 'Uncertain Location',
  'stale_location': 'Stale Location',
  'poor_location_accuracy': 'Poor Location Accuracy',
  'duplicate': 'Duplicate Check-in',
  'client_attempt_conflict': 'Conflicting Attempt',
  'replayed_rejection': 'Replayed Rejection',
  'pin_mismatch': 'Meeting PIN Mismatch',
};

const Map<String, IconData> gatewayDisputeReasonIcons = <String, IconData>{
  'missing_location': Icons.place_outlined,
  'missing_geofence': Icons.place_outlined,
  'geofence_uncertain': Icons.place_outlined,
  'stale_location': Icons.schedule,
  'poor_location_accuracy': Icons.place_outlined,
  'duplicate': Icons.copy_all_outlined,
  'client_attempt_conflict': Icons.copy_all_outlined,
  'replayed_rejection': Icons.copy_all_outlined,
  'pin_mismatch': Icons.fingerprint,
};

/// `some_new_reason` → `Some New Reason`; never empty (web
/// `humanizeDisputeReason` parity).
String humanizeDisputeReason(String reason) {
  final text = reason.trim().replaceAll(RegExp(r'[_-]+'), ' ');
  if (text.isEmpty) return 'Unknown Reason';
  return text.replaceAllMapped(
    RegExp(r'\b\w'),
    (match) => match.group(0)!.toUpperCase(),
  );
}

/// Wire-keyed label lookup: the enum map first, then the gateway map, then a
/// humanized fallback so an unknown persisted reason never renders blank.
String disputeReasonLabelForWire(String? wire) {
  if (wire == null || wire.trim().isEmpty) return 'Unknown';
  final parsed = DisputeReason.tryParse(wire);
  if (parsed != null) {
    final label = disputeReasonLabels[parsed];
    if (label != null) return label;
  }
  return gatewayDisputeReasonLabels[wire] ?? humanizeDisputeReason(wire);
}

IconData disputeReasonIconForWire(String? wire) {
  if (wire == null || wire.trim().isEmpty) return Icons.help_outline;
  final parsed = DisputeReason.tryParse(wire);
  if (parsed != null) {
    final icon = disputeReasonIcons[parsed];
    if (icon != null) return icon;
  }
  return gatewayDisputeReasonIcons[wire] ?? Icons.help_outline;
}

// ── At-risk ordering ──

const Map<AttendanceStandingStatus, String> atRiskStatusLabels = {
  AttendanceStandingStatus.belowThreshold: 'Below threshold',
  AttendanceStandingStatus.atRisk: 'At risk',
  AttendanceStandingStatus.onTrack: 'On track',
  AttendanceStandingStatus.insufficientData: 'Insufficient data',
};

int atRiskStatusRank(AttendanceStandingStatus status) {
  return switch (status) {
    AttendanceStandingStatus.belowThreshold => 0,
    AttendanceStandingStatus.atRisk => 1,
    AttendanceStandingStatus.onTrack => 2,
    AttendanceStandingStatus.insufficientData => 3,
  };
}

/// Deterministic worst-first ordering: below threshold, at risk, then lowest
/// rate, then student name. Null rates sort last inside their status bucket.
List<StudentAtRisk> sortAtRiskRows(Iterable<StudentAtRisk> rows) {
  final sorted = rows.toList(growable: false);
  sorted.sort((left, right) {
    final rank = atRiskStatusRank(
      left.status,
    ).compareTo(atRiskStatusRank(right.status));
    if (rank != 0) return rank;
    final leftRate = left.attendanceRate ?? double.infinity;
    final rightRate = right.attendanceRate ?? double.infinity;
    final rate = leftRate.compareTo(rightRate);
    if (rate != 0) return rate;
    final section = (left.sectionName).compareTo(right.sectionName);
    if (section != 0) return section;
    return left.studentName.compareTo(right.studentName);
  });
  return sorted;
}

bool canFileChedReferral(StudentAtRisk row) {
  return row.status == AttendanceStandingStatus.belowThreshold ||
      row.status == AttendanceStandingStatus.atRisk;
}

/// Groups at-risk rows by section id, preserving the first-seen order.
List<({String sectionId, String sectionName, List<StudentAtRisk> rows})>
groupAtRiskBySection(Iterable<StudentAtRisk> rows) {
  final order = <String>[];
  final groups = <String, List<StudentAtRisk>>{};
  for (final row in rows) {
    if (!groups.containsKey(row.sectionId)) {
      order.add(row.sectionId);
      groups[row.sectionId] = <StudentAtRisk>[];
    }
    groups[row.sectionId]!.add(row);
  }
  return [
    for (final id in order)
      (
        sectionId: id,
        sectionName: groups[id]!.first.sectionName,
        rows: sortAtRiskRows(groups[id]!),
      ),
  ];
}

/// Next referral state in the CHED queue (`generated → acknowledged →
/// counseling_scheduled → resolved`). Returns null at the terminal state.
ReferralStatus? nextReferralStatus(ReferralStatus status) {
  return switch (status) {
    ReferralStatus.generated => ReferralStatus.acknowledged,
    ReferralStatus.acknowledged => ReferralStatus.counselingScheduled,
    ReferralStatus.counselingScheduled => ReferralStatus.resolved,
    ReferralStatus.resolved => null,
  };
}

String describeReferralError(ApiRequestError error) {
  return switch (error.code) {
    'referral_active' =>
      'An active CHED referral already exists for this student in this section.',
    'student_not_at_risk' =>
      'This student is no longer flagged as at risk — refresh before issuing another notice.',
    _ =>
      error.message.isEmpty
          ? 'Unable to issue the CHED notice.'
          : error.message,
  };
}

// ── Attendance math / report helpers ──

int countedSessionRecords({
  required int present,
  required int late,
  required int absent,
  required int incomplete,
}) {
  return present + late + absent + incomplete;
}

/// Standing-consistent rate; `null` when nothing has been counted yet.
double? attendanceRatePercent({
  required int present,
  required int late,
  required int absent,
  required int incomplete,
}) {
  final counted = countedSessionRecords(
    present: present,
    late: late,
    absent: absent,
    incomplete: incomplete,
  );
  if (counted == 0) return null;
  return ((present + late) / counted) * 100;
}

String formatRatePercent(double? rate) {
  if (rate == null) return '—';
  return '${rate.toStringAsFixed(rate % 1 == 0 ? 0 : 1)}%';
}

// ── Dispute grouping ──

class DisputeGroup {
  DisputeGroup({
    required this.sectionId,
    required this.subjectName,
    required this.records,
  });

  final String sectionId;
  final String subjectName;
  final List<AttendanceRecord> records;
}

/// Groups dispute rows by section then session, newest session first.
List<DisputeGroup> groupDisputes(
  Iterable<AttendanceRecord> records, {
  Map<String, Section> sectionsById = const {},
  Map<String, String> sessionLabels = const {},
}) {
  final groups = <String, List<AttendanceRecord>>{};
  for (final record in records) {
    groups
        .putIfAbsent(record.sectionId, () => <AttendanceRecord>[])
        .add(record);
  }
  final result = <DisputeGroup>[];
  for (final entry in groups.entries) {
    final section = sectionsById[entry.key];
    final sorted = entry.value.toList(growable: false)
      ..sort((a, b) {
        final session = (sessionLabels[b.sessionId] ?? b.sessionId).compareTo(
          sessionLabels[a.sessionId] ?? a.sessionId,
        );
        if (session != 0) return session;
        return b.timestamp.compareTo(a.timestamp);
      });
    result.add(
      DisputeGroup(
        sectionId: entry.key,
        subjectName: section == null
            ? entry.key
            : formatSectionHeading(
                section: section.section,
                course: section.course,
              ),
        records: sorted,
      ),
    );
  }
  result.sort((a, b) => a.subjectName.compareTo(b.subjectName));
  return result;
}

// ── Donut chart segments ──

class DonutSegment {
  const DonutSegment({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final int value;
  final Color color;
}

List<DonutSegment> buildDonutSegments(
  AttendanceReportTotals totals, {
  required BrandTokens tokens,
}) {
  return <DonutSegment>[
    DonutSegment(label: 'Present', value: totals.present, color: tokens.gold),
    DonutSegment(label: 'Late', value: totals.late, color: tokens.maroon),
    DonutSegment(
      label: 'Absent',
      value: totals.absent,
      color: tokens.deepMaroon,
    ),
    DonutSegment(
      label: 'Incomplete',
      value: totals.incomplete,
      color: tokens.isDark ? Colors.white24 : Colors.black26,
    ),
  ];
}

// ── Excuse labels ──

const Map<ExcuseReason, String> excuseReasonLabels = {
  ExcuseReason.medical: 'Medical reason',
  ExcuseReason.familyEmergency: 'Family emergency',
  ExcuseReason.schoolActivity: 'School activity',
  ExcuseReason.transportation: 'Transportation / travel issue',
  ExcuseReason.bereavement: 'Bereavement',
  ExcuseReason.other: 'Other',
};

String excuseReasonLabel(ExcuseReason? reason) {
  if (reason == null) return '—';
  return excuseReasonLabels[reason] ?? reason.wire;
}

const Map<ExcuseStatus, String> excuseStatusLabels = {
  ExcuseStatus.requested: 'Pending',
  ExcuseStatus.approved: 'Approved',
  ExcuseStatus.rejected: 'Rejected',
};

// ── Misc formatters ──

String formatCampusDateTimeLabel(String? iso) {
  final parsed = iso == null ? null : DateTime.tryParse(iso);
  if (parsed == null) return iso ?? '';
  final local = parsed.toLocal();
  final date = formatDate(local);
  final hh = local.hour.toString().padLeft(2, '0');
  final mm = local.minute.toString().padLeft(2, '0');
  return '$date $hh:$mm';
}

String formatDateTimeLabel(String? iso) {
  final parsed = iso == null ? null : DateTime.tryParse(iso);
  if (parsed == null) return iso ?? '';
  final local = parsed.toLocal();
  final hh = local.hour.toString().padLeft(2, '0');
  final mm = local.minute.toString().padLeft(2, '0');
  return '${formatDate(local)} ${formatTime('$hh:$mm')}';
}

/// `MM:SS` (or `H:MM:SS` past an hour) for a positive remaining duration.
String formatCountdown(Duration remaining) {
  final clamped = remaining.isNegative ? Duration.zero : remaining;
  final hours = clamped.inHours;
  final minutes = clamped.inMinutes.remainder(60).toString().padLeft(2, '0');
  final seconds = clamped.inSeconds.remainder(60).toString().padLeft(2, '0');
  return hours > 0 ? '$hours:$minutes:$seconds' : '$minutes:$seconds';
}

/// Seconds elapsed since [sinceIso] using the trusted clock, for the
/// "Updated Xs ago" label. Returns null when the timestamp is unparseable.
int? secondsSince(String? sinceIso, {required DateTime now}) {
  final parsed = sinceIso == null ? null : DateTime.tryParse(sinceIso);
  if (parsed == null) return null;
  final seconds = now.difference(parsed).inSeconds;
  return seconds < 0 ? 0 : seconds;
}
