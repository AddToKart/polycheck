import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/data/faculty_logic.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/session_cockpit_screen.dart';

import '../../helpers/auth_harness.dart';

/// FLF-08 + FLR-08: a tap on a `disputed`/`excused` roster row must never
/// cycle the status (those states are owned by the dispute / excuse queues),
/// and the cockpit boot chain must survive an unmount mid-refresh.
const AttendanceCoordinates _none = AttendanceCoordinates(
  latitude: null,
  longitude: null,
);

Session _activeSession() => const Session(
  id: 'sess-1',
  sectionId: 'sec-1',
  subjectName: 'Software Engineering',
  date: '2026-11-10',
  startTime: '09:00',
  endTime: '10:00',
  room: 'CEA 301',
  teacherId: 'teacher-1',
  isActive: true,
);

Section _section() => const Section(
  id: 'sec-1',
  subjectId: 'subj-1',
  section: '4-1',
  course: 'BSIT',
  room: 'CEA 301',
  teacherId: 'teacher-1',
);

User _student(String id, String name) => User(
  id: id,
  fullName: name,
  role: UserRole.student,
  studentId: '2024-0000$id',
);

AttendanceRecord _record({
  required String studentId,
  required AttendanceStatus status,
  DisputeReason? disputeReason,
}) {
  return AttendanceRecord(
    id: 'rec-$studentId',
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: studentId,
    studentName: 'Student $studentId',
    timestamp: '2026-11-10T01:00:00.000Z',
    status: status,
    coordinates: _none,
    disputeReason: disputeReason,
    isSynced: true,
  );
}

class _FakeSessionsApi extends SessionsApi {
  _FakeSessionsApi() : super(Dio());

  @override
  Future<Session> getSession(String id) async => _activeSession();
}

class _FakeSectionsApi extends SectionsApi {
  _FakeSectionsApi() : super(Dio());

  @override
  Future<Section> getSection(String id) async => _section();

  @override
  Future<List<SectionStudent>> getSectionStudents(String sectionId) async =>
      <SectionStudent>[
        SectionStudent(
          student: _student('1', 'Dela Cruz, Juan'),
          attendance: const SectionStudentAttendance(),
        ),
        SectionStudent(
          student: _student('2', 'Aquino, Mia'),
          attendance: const SectionStudentAttendance(),
        ),
        SectionStudent(
          student: _student('3', 'Bautista, Ben'),
          attendance: const SectionStudentAttendance(),
        ),
      ];
}

/// Records every status write so the test can assert nothing was sent.
class _RecordingAttendanceApi extends AttendanceApi {
  _RecordingAttendanceApi(this.records) : super(Dio());

  final List<AttendanceRecord> records;
  int statusWrites = 0;
  int addWrites = 0;

  @override
  Future<List<AttendanceRecord>> getAttendanceRecords({
    String? sessionId,
    String? startDate,
    String? endDate,
  }) async => records;

  @override
  Future<List<ScanAttemptView>> getScanAttempts({String? sessionId}) async =>
      const <ScanAttemptView>[];

  @override
  Future<AttendanceRecord> updateAttendanceStatus(
    String recordId,
    AttendanceStatus status,
  ) async {
    statusWrites += 1;
    return records.firstWhere((record) => record.id == recordId);
  }

  @override
  Future<AttendanceRecord> addAttendanceRecord(AttendanceRecord record) async {
    addWrites += 1;
    return record;
  }
}

Future<_RecordingAttendanceApi> _pumpCockpit(WidgetTester tester) async {
  // Tall phone so the whole roster fits without scrolling (taps must hit).
  tester.view.physicalSize = const Size(1080, 4200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final attendanceApi = _RecordingAttendanceApi(<AttendanceRecord>[
    _record(
      studentId: '1',
      status: AttendanceStatus.disputed,
      disputeReason: DisputeReason.outsideGeofence,
    ),
    _record(studentId: '2', status: AttendanceStatus.excused),
    _record(studentId: '3', status: AttendanceStatus.present),
  ]);

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sessionProvider.overrideWith(() => FakeSessionController(testFaculty)),
        // No bearer: the realtime socket is never started in these tests.
        tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
        sessionsApiProvider.overrideWithValue(_FakeSessionsApi()),
        sectionsApiProvider.overrideWithValue(_FakeSectionsApi()),
        attendanceApiProvider.overrideWithValue(attendanceApi),
        deviceNowProvider.overrideWithValue(DateTime.now),
      ],
      child: MaterialApp(
        theme: BrandTheme.light,
        home: const SessionCockpitScreen(sessionId: 'sess-1'),
      ),
    ),
  );
  await tester.pump();
  await tester.pumpAndSettle();
  return attendanceApi;
}

void main() {
  testWidgets('a tap on a disputed row never writes a status (FLF-08)', (
    tester,
  ) async {
    final api = await _pumpCockpit(tester);

    await tester.tap(find.text('Dela Cruz, Juan'));
    await tester.pump();
    await tester.pump();

    expect(
      api.statusWrites,
      0,
      reason: 'disputed rows are resolved through the dispute queue',
    );
    expect(api.addWrites, 0);
  });

  testWidgets('a tap on an excused row never writes a status (FLF-08)', (
    tester,
  ) async {
    final api = await _pumpCockpit(tester);

    await tester.tap(find.text('Aquino, Mia'));
    await tester.pump();
    await tester.pump();

    expect(
      api.statusWrites,
      0,
      reason: 'excused rows are resolved through the excuse queue',
    );
    expect(api.addWrites, 0);
  });

  testWidgets('a tap on a present row still cycles normally (control)', (
    tester,
  ) async {
    final api = await _pumpCockpit(tester);

    await tester.tap(find.text('Bautista, Ben'));
    await tester.pump();
    await tester.pump();

    expect(api.statusWrites, 1);
    expect(api.addWrites, 0);
  });

  test('isManualCycleStatus excludes only the queue-owned states', () {
    expect(isManualCycleStatus(AttendanceStatus.present), isTrue);
    expect(isManualCycleStatus(AttendanceStatus.late), isTrue);
    expect(isManualCycleStatus(AttendanceStatus.absent), isTrue);
    expect(isManualCycleStatus(AttendanceStatus.incomplete), isTrue);
    expect(isManualCycleStatus(AttendanceStatus.pending), isTrue);
    expect(isManualCycleStatus(AttendanceStatus.disputed), isFalse);
    expect(isManualCycleStatus(AttendanceStatus.excused), isFalse);
  });

  testWidgets('an unmount during the boot refresh throws nothing (FLR-08)', (
    tester,
  ) async {
    // The boot chain awaits `_refresh` then `_connectRealtime`; tearing the
    // widget down while those are in flight used to `ref` after dispose.
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sessionProvider.overrideWith(
            () => FakeSessionController(testFaculty),
          ),
          tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
          sessionsApiProvider.overrideWithValue(_FakeSessionsApi()),
          sectionsApiProvider.overrideWithValue(_FakeSectionsApi()),
          attendanceApiProvider.overrideWithValue(
            _RecordingAttendanceApi(const <AttendanceRecord>[]),
          ),
          deviceNowProvider.overrideWithValue(DateTime.now),
        ],
        child: MaterialApp(
          theme: BrandTheme.light,
          home: const SessionCockpitScreen(sessionId: 'sess-1'),
        ),
      ),
    );

    // Let the post-frame callback start the boot chain, then pop it at once.
    await tester.pump();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
