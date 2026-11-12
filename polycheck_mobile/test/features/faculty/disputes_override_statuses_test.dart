import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/faculty_disputes_screen.dart';

import '../../helpers/auth_harness.dart';

const AttendanceCoordinates _none = AttendanceCoordinates(
  latitude: null,
  longitude: null,
);

AttendanceRecord _disputedRecord() => AttendanceRecord(
  id: 'rec-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 'stu-1',
  studentName: 'Maria Santos',
  timestamp: '2026-11-10T00:05:00.000Z',
  status: AttendanceStatus.disputed,
  coordinates: _none,
  // DD-C3: the reason that used to throw on decode and blank this screen.
  disputeReason: DisputeReason.missingScanEvidence,
  disputeDescription: 'Offline replay without channel evidence.',
  isSynced: true,
);

class _FakeDisputesApi extends DisputesApi {
  _FakeDisputesApi(this.records) : super(Dio());

  final List<AttendanceRecord> records;

  @override
  Future<List<AttendanceRecord>> getDisputedRecords({
    String? sessionId,
    String? status,
    String? search,
  }) async => records;
}

class _FakeSectionsApi extends SectionsApi {
  _FakeSectionsApi() : super(Dio());

  @override
  Future<List<Section>> getSections({String? subjectId}) async =>
      const <Section>[];
}

class _FakeSessionsApi extends SessionsApi {
  _FakeSessionsApi() : super(Dio());

  @override
  Future<List<Session>> getSessions({String? sectionId}) async =>
      const <Session>[];
}

class _FakeAttendanceApi extends AttendanceApi {
  _FakeAttendanceApi() : super(Dio());

  @override
  Future<RecordTimeline> getRecordTimeline(String recordId) async =>
      RecordTimeline(
        recordId: recordId,
        recommendation: const DisputeRecommendation(
          verdict: DisputeRecommendationVerdict.accept,
          rationale: 'Stubbed telemetry.',
        ),
      );

  @override
  Future<List<ScanAttemptView>> getScanAttempts({String? sessionId}) async =>
      const <ScanAttemptView>[];
}

void main() {
  test('the override row offers exactly the backend-allowed statuses', () {
    expect(disputeOverrideStatuses, <AttendanceStatus>[
      AttendanceStatus.present,
      AttendanceStatus.late,
      AttendanceStatus.absent,
    ]);
    expect(
      disputeOverrideStatuses.contains(AttendanceStatus.excused),
      isFalse,
      reason: 'ResolveDisputeDto rejects `excused` with a 400',
    );
  });

  testWidgets('the dispute sheet renders present / late / absent only', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sessionProvider.overrideWith(
            () => FakeSessionController(testFaculty),
          ),
          disputesApiProvider.overrideWithValue(
            _FakeDisputesApi(<AttendanceRecord>[_disputedRecord()]),
          ),
          sectionsApiProvider.overrideWithValue(_FakeSectionsApi()),
          sessionsApiProvider.overrideWithValue(_FakeSessionsApi()),
          attendanceApiProvider.overrideWithValue(_FakeAttendanceApi()),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const FacultyDisputesScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Missing Scan Evidence'), findsOneWidget);

    await tester.tap(find.text('Maria Santos'));
    await tester.pumpAndSettle();
    expect(find.text('Review dispute'), findsOneWidget);

    expect(find.text('Present'), findsOneWidget);
    expect(find.text('Late'), findsOneWidget);
    expect(find.text('Absent'), findsOneWidget);
    expect(find.text('Excused'), findsNothing);
  });
}
