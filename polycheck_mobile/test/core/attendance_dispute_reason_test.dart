import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/models.dart';

/// DD-C3: the validator stamps `missing_scan_evidence` on every record whose
/// scan carried no core evidence, but the Dart mirror did not know the member —
/// `AttendanceRecord.fromJson` threw and the whole disputes rail blanked.
Map<String, dynamic> _recordJson(Object? disputeReason) => <String, dynamic>{
  'id': 'rec-1',
  'sessionId': 'sess-1',
  'sectionId': 'sec-1',
  'studentId': 'stu-1',
  'studentName': 'Maria Santos',
  'timestamp': '2026-11-10T00:05:00Z',
  'status': 'disputed',
  'coordinates': <String, dynamic>{'latitude': null, 'longitude': null},
  'disputeReason': disputeReason,
  'disputeResolved': false,
  'isSynced': true,
};

void main() {
  group('DisputeReason wire mirror', () {
    test('decodes the server-stamped missing_scan_evidence reason', () {
      final record = AttendanceRecord.fromJson(
        _recordJson('missing_scan_evidence'),
      );

      expect(record.disputeReason, DisputeReason.missingScanEvidence);
      expect(record.disputeReason!.wire, 'missing_scan_evidence');
      expect(record.disputeReason!.isSystemReason, isTrue);
      expect(record.disputeReason!.isStudentReason, isFalse);
      expect(record.toJson()['disputeReason'], 'missing_scan_evidence');
    });

    test('decodes the implausible_client_timestamp reason', () {
      final record = AttendanceRecord.fromJson(
        _recordJson('implausible_client_timestamp'),
      );

      expect(record.disputeReason, DisputeReason.implausibleClientTimestamp);
      expect(record.disputeReason!.wire, 'implausible_client_timestamp');
      expect(record.disputeReason!.isSystemReason, isTrue);
      expect(record.disputeReason!.isStudentReason, isFalse);
      expect(record.toJson()['disputeReason'], 'implausible_client_timestamp');
    });

    test('an unknown reason degrades to Other instead of throwing', () {
      final record = AttendanceRecord.fromJson(_recordJson('future_reason'));

      expect(record.disputeReason, DisputeReason.other);
      expect(DisputeReason.tryParse('future_reason'), isNull);
    });

    test('an absent reason stays null', () {
      final json = _recordJson(null)..remove('disputeReason');

      expect(AttendanceRecord.fromJson(json).disputeReason, isNull);
    });
  });
}
