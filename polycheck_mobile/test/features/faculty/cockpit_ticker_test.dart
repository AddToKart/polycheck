import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/session_cockpit_screen.dart';

import '../../helpers/auth_harness.dart';

/// An ended session: `_ensurePolling` starts nothing, so the only periodic
/// work under test is the cockpit's own 1 Hz freshness ticker.
Session _endedSession() => const Session(
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  date: '2026-11-10',
  startTime: '09:00',
  endTime: '10:00',
  isActive: false,
  endedAt: '2026-11-10T02:00:00.000Z',
  teacherId: 'teacher-1',
);

Section _section() => const Section(
  id: 'sec-1',
  subjectId: 'subj-1',
  section: '4-1',
  course: 'BSIT',
  room: 'CEA 301',
  teacherId: 'teacher-1',
);

class _FakeSessionsApi extends SessionsApi {
  _FakeSessionsApi(this.session) : super(Dio());

  final Session session;

  @override
  Future<Session> getSession(String id) async => session;
}

class _FakeSectionsApi extends SectionsApi {
  _FakeSectionsApi() : super(Dio());

  @override
  Future<Section> getSection(String id) async => _section();

  @override
  Future<List<SectionStudent>> getSectionStudents(String sectionId) async =>
      const <SectionStudent>[];
}

class _FakeAttendanceApi extends AttendanceApi {
  _FakeAttendanceApi() : super(Dio());

  @override
  Future<List<AttendanceRecord>> getAttendanceRecords({
    String? sessionId,
    String? startDate,
    String? endDate,
  }) async => const <AttendanceRecord>[];

  @override
  Future<List<ScanAttemptView>> getScanAttempts({String? sessionId}) async =>
      const <ScanAttemptView>[];
}

void main() {
  testWidgets('the cockpit 1 Hz ticker stops with the screen (DD-F7)', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sessionProvider.overrideWith(
            () => FakeSessionController(testFaculty),
          ),
          // No bearer: the realtime socket is never started in this test.
          tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
          sessionsApiProvider.overrideWithValue(
            _FakeSessionsApi(_endedSession()),
          ),
          sectionsApiProvider.overrideWithValue(_FakeSectionsApi()),
          attendanceApiProvider.overrideWithValue(_FakeAttendanceApi()),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const SessionCockpitScreen(sessionId: 'sess-1'),
        ),
      ),
    );
    await tester.pump();
    await tester.pumpAndSettle();

    // The freshness label is on screen, so the ticker is armed.
    expect(find.textContaining('Updated'), findsOneWidget);
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    await tester.pumpWidget(const SizedBox.shrink());
    expect(find.byType(SessionCockpitScreen), findsNothing);

    // Pumping past several old tick periods must not touch the disposed state.
    await tester.pump(const Duration(seconds: 5));
    expect(tester.takeException(), isNull);

    // `testWidgets` fails the run if any timer is still pending after the tree
    // is disposed — that is the assertion the leaked ticker used to trip.
  });
}
