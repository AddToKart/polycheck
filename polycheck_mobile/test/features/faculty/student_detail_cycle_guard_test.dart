import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/student_detail_screen.dart';

import '../../helpers/auth_harness.dart';

/// FLF-08 (student detail): the per-session tap used to rewrite a
/// `disputed`/`excused` record, silently overriding a decision the student is
/// waiting on. The tap now shows the queue hint and writes nothing.
const AttendanceCoordinates _none = AttendanceCoordinates(
  latitude: null,
  longitude: null,
);

const User _student = User(
  id: 'student-1',
  fullName: 'Maria Santos',
  role: UserRole.student,
  studentId: '2024-00123-MN-0',
  enrolledSectionIds: <String>['sec-1'],
);

Session _session(String id, String date) => Session(
  id: id,
  sectionId: 'sec-1',
  subjectName: 'Integrative Programming',
  date: date,
  startTime: '09:00',
  endTime: '10:00',
  teacherId: 'teacher-1',
  isActive: false,
  endedAt: '${date}T02:00:00.000Z',
);

const Section _section = Section(
  id: 'sec-1',
  subjectId: 'subj-1',
  section: '3-1',
  course: 'BSIT',
  room: 'Room 201',
  semester: '1st Semester',
  teacherId: 'teacher-1',
);

class _FakeUsersApi extends UsersApi {
  _FakeUsersApi() : super(Dio());

  @override
  Future<User> getStudent(String id) async => _student;
}

class _FakeSectionsApi extends SectionsApi {
  _FakeSectionsApi() : super(Dio());

  @override
  Future<Section> getSection(String id) async => _section;

  @override
  Future<List<Section>> getSections({String? subjectId}) async =>
      const <Section>[_section];
}

class _FakeSessionsApi extends SessionsApi {
  _FakeSessionsApi() : super(Dio());

  @override
  Future<List<Session>> getSectionSessions(String sectionId) async => <Session>[
    _session('sess-disputed', '2026-11-12'),
    _session('sess-excused', '2026-11-11'),
  ];
}

/// Records writes so a tap-guard regression is loud.
class _RecordingAttendanceApi extends AttendanceApi {
  _RecordingAttendanceApi(this.records) : super(Dio());

  final List<AttendanceRecord> records;
  int statusWrites = 0;
  int addWrites = 0;

  @override
  Future<List<AttendanceRecord>> getStudentAttendanceForSection(
    String studentId,
    String sectionId,
  ) async => records;

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

Future<_RecordingAttendanceApi> _pumpDetail(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1080, 4200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final attendanceApi = _RecordingAttendanceApi(<AttendanceRecord>[
    AttendanceRecord(
      id: 'rec-disputed',
      sessionId: 'sess-disputed',
      sectionId: 'sec-1',
      studentId: _student.id,
      studentName: _student.fullName,
      timestamp: '2026-11-12T01:00:00.000Z',
      status: AttendanceStatus.disputed,
      coordinates: _none,
      disputeReason: DisputeReason.outsideGeofence,
      isSynced: true,
    ),
    AttendanceRecord(
      id: 'rec-excused',
      sessionId: 'sess-excused',
      sectionId: 'sec-1',
      studentId: _student.id,
      studentName: _student.fullName,
      timestamp: '2026-11-11T01:00:00.000Z',
      status: AttendanceStatus.excused,
      coordinates: _none,
      excuseStatus: ExcuseStatus.approved,
      excuseReason: ExcuseReason.medical,
      isSynced: true,
    ),
  ]);

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sessionProvider.overrideWith(() => FakeSessionController(testFaculty)),
        usersApiProvider.overrideWithValue(_FakeUsersApi()),
        sectionsApiProvider.overrideWithValue(_FakeSectionsApi()),
        sessionsApiProvider.overrideWithValue(_FakeSessionsApi()),
        attendanceApiProvider.overrideWithValue(attendanceApi),
      ],
      child: MaterialApp(
        theme: PupTheme.light,
        home: const FacultyStudentDetailScreen(
          studentId: 'student-1',
          sectionId: 'sec-1',
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pumpAndSettle();
  return attendanceApi;
}

void main() {
  testWidgets('a tap on a disputed session row never writes (FLF-08)', (
    tester,
  ) async {
    final api = await _pumpDetail(tester);

    expect(find.textContaining('2026-11-12'), findsOneWidget);
    await tester.tap(find.textContaining('2026-11-12'));
    await tester.pump();
    await tester.pump();

    expect(api.statusWrites, 0);
    expect(api.addWrites, 0);
  });

  testWidgets('a tap on an excused session row never writes (FLF-08)', (
    tester,
  ) async {
    final api = await _pumpDetail(tester);

    expect(find.textContaining('2026-11-11'), findsOneWidget);
    await tester.tap(find.textContaining('2026-11-11'));
    await tester.pump();
    await tester.pump();

    expect(api.statusWrites, 0);
    expect(api.addWrites, 0);
  });
}
