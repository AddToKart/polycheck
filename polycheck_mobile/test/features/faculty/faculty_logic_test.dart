import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/models/at_risk.dart';
import 'package:polycheck_mobile/src/core/models/standing.dart';
import 'package:polycheck_mobile/src/core/theme/brand_tokens.dart';
import 'package:polycheck_mobile/src/features/faculty/data/faculty_logic.dart';

StudentAtRisk _risk({
  required String id,
  required String name,
  required AttendanceStandingStatus status,
  double? rate,
  String section = 'A',
  int? slack,
}) {
  return StudentAtRisk(
    studentId: id,
    studentName: name,
    sectionId: 'sec-$section',
    sectionName: section,
    subjectName: 'Software Engineering',
    status: status,
    attendanceRate: rate,
    absencesBeforeBelowThreshold: slack,
  );
}

void main() {
  group('manual attendance statuses', () {
    // `pending` is a system state the backend rejects with a 400 (FLF-02).
    test('offer only what the backend accepts from a teacher', () {
      expect(manualStatusChoices, <AttendanceStatus>[
        AttendanceStatus.present,
        AttendanceStatus.late,
        AttendanceStatus.incomplete,
        AttendanceStatus.absent,
      ]);
      for (final status in manualStatusChoices) {
        expect(
          editableAttendanceStatuses,
          contains(status),
          reason: '${status.wire} would 400 against the backend allowlist',
        );
      }
    });

    test('disputed and excused rows are left to their queues', () {
      expect(isManualCycleStatus(AttendanceStatus.disputed), isFalse);
      expect(isManualCycleStatus(AttendanceStatus.excused), isFalse);
      expect(isManualCycleStatus(AttendanceStatus.present), isTrue);
      expect(isManualCycleStatus(AttendanceStatus.incomplete), isTrue);
    });
  });

  group('dispute reason rail', () {
    test('labels and icons cover every backend reason', () {
      for (final reason in DisputeReason.values) {
        expect(
          disputeReasonLabels[reason],
          isNotNull,
          reason: 'missing label for ${reason.wire}',
        );
        expect(
          disputeReasonIcons[reason],
          isNotNull,
          reason: 'missing icon for ${reason.wire}',
        );
        expect(disputeReasonLabel(reason), isNotEmpty);
      }
      expect(disputeReasonLabel(null), 'Unknown');
      expect(disputeReasonIcon(null), isNotNull);
    });

    test('gateway-persisted reasons render a display label (ING-07)', () {
      // Reasons the ingest gateway persists outside the shared union. They
      // must never blank the rail or crash a decode.
      const persisted = <String, String>{
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
      for (final entry in persisted.entries) {
        expect(
          disputeReasonLabelForWire(entry.key),
          entry.value,
          reason: 'label for ${entry.key}',
        );
        expect(disputeReasonIconForWire(entry.key), isNotNull);
      }
    });

    test('an unknown persisted reason is humanized, never blank', () {
      expect(disputeReasonLabelForWire('brand_new_reason'), 'Brand New Reason');
      expect(disputeReasonLabelForWire('  '), 'Unknown');
      expect(disputeReasonLabelForWire(null), 'Unknown');
      expect(disputeReasonIconForWire('brand_new_reason'), isNotNull);
      expect(disputeReasonIconForWire(null), Icons.help_outline);
      expect(humanizeDisputeReason(''), 'Unknown Reason');
      // A wire this build knows decodes strictly (no fallback masking).
      expect(DisputeReason.tryParse('future_reason'), isNull);
    });
  });

  group('at-risk ordering', () {
    test('sorts below-threshold first then lowest rate and name', () {
      final rows = <StudentAtRisk>[
        _risk(
          id: '3',
          name: 'Cruz, Ana',
          status: AttendanceStandingStatus.onTrack,
          rate: 95,
        ),
        _risk(
          id: '1',
          name: 'Bautista, Ben',
          status: AttendanceStandingStatus.belowThreshold,
          rate: 62,
        ),
        _risk(
          id: '2',
          name: 'Aquino, Mia',
          status: AttendanceStandingStatus.atRisk,
          rate: 75,
        ),
        _risk(
          id: '4',
          name: 'Dizon, Karl',
          status: AttendanceStandingStatus.belowThreshold,
          rate: 45,
        ),
        _risk(
          id: '5',
          name: 'Enriquez, Lea',
          status: AttendanceStandingStatus.insufficientData,
        ),
      ];
      final sorted = sortAtRiskRows(rows);
      expect(sorted.map((row) => row.studentId).toList(), [
        '4',
        '1',
        '2',
        '3',
        '5',
      ]);
    });

    test('groups by section preserving first-seen order', () {
      final rows = <StudentAtRisk>[
        _risk(
          id: '1',
          name: 'A',
          status: AttendanceStandingStatus.atRisk,
          section: 'B',
        ),
        _risk(
          id: '2',
          name: 'B',
          status: AttendanceStandingStatus.belowThreshold,
          section: 'A',
        ),
        _risk(
          id: '3',
          name: 'C',
          status: AttendanceStandingStatus.atRisk,
          section: 'B',
        ),
      ];
      final groups = groupAtRiskBySection(rows);
      expect(groups.map((group) => group.sectionName).toList(), ['B', 'A']);
      expect(groups.first.rows.map((row) => row.studentId).toList(), [
        '1',
        '3',
      ]);
    });

    test('referral eligibility and state machine', () {
      expect(
        canFileChedReferral(
          _risk(
            id: '1',
            name: 'A',
            status: AttendanceStandingStatus.belowThreshold,
          ),
        ),
        isTrue,
      );
      expect(
        canFileChedReferral(
          _risk(id: '1', name: 'A', status: AttendanceStandingStatus.onTrack),
        ),
        isFalse,
      );
      expect(
        nextReferralStatus(ReferralStatus.generated),
        ReferralStatus.acknowledged,
      );
      expect(
        nextReferralStatus(ReferralStatus.acknowledged),
        ReferralStatus.counselingScheduled,
      );
      expect(
        nextReferralStatus(ReferralStatus.counselingScheduled),
        ReferralStatus.resolved,
      );
      expect(nextReferralStatus(ReferralStatus.resolved), isNull);
    });
  });

  group('standing-consistent rates', () {
    test('incomplete records count in the denominator only', () {
      expect(
        attendanceRatePercent(present: 3, late: 1, absent: 0, incomplete: 1),
        80,
      );
      expect(
        attendanceRatePercent(present: 0, late: 0, absent: 0, incomplete: 0),
        isNull,
      );
      expect(
        countedSessionRecords(present: 3, late: 1, absent: 2, incomplete: 4),
        10,
      );
      expect(formatRatePercent(80), '80%');
      expect(formatRatePercent(85.7), '85.7%');
      expect(formatRatePercent(null), '—');
    });

    test('donut segments use brand tokens and total every bucket', () {
      final tokens = BrandTokens.light;
      final segments = buildDonutSegments(
        const AttendanceReportTotals(
          present: 5,
          late: 2,
          absent: 1,
          incomplete: 2,
        ),
        tokens: tokens,
      );
      expect(segments.map((segment) => segment.value).toList(), [5, 2, 1, 2]);
      expect(segments.first.color, tokens.gold);
      expect(segments[1].color, tokens.maroon);
      expect(segments[2].color, tokens.deepMaroon);
    });
  });

  group('formatting', () {
    test('countdown clamps and formats', () {
      expect(formatCountdown(const Duration(seconds: 95)), '01:35');
      expect(formatCountdown(const Duration(minutes: 2, seconds: 5)), '02:05');
      expect(
        formatCountdown(const Duration(hours: 1, minutes: 2, seconds: 3)),
        '1:02:03',
      );
      expect(formatCountdown(const Duration(seconds: -5)), '00:00');
      expect(formatCountdown(Duration.zero), '00:00');
    });

    test('secondsSince uses the trusted provider timestamp', () {
      final now = DateTime.utc(2026, 11, 10, 8, 0, 10);
      expect(secondsSince('2026-11-10T08:00:00.000Z', now: now), 10);
      expect(secondsSince(null, now: now), isNull);
      expect(secondsSince('not-a-date', now: now), isNull);
    });
  });
}
