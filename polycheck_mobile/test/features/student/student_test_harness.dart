import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/sync/readiness.dart';
import 'package:polycheck_mobile/src/features/student/data/offline_readiness.dart';
import 'package:polycheck_mobile/src/features/student/data/student_classes_data.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/offline_sync_panel.dart';

import '../../helpers/auth_harness.dart';

const User studentUser = User(
  id: 'student-1',
  fullName: 'Maria Santos',
  role: UserRole.student,
  studentId: '2024-00123-MN-0',
  program: 'BSIT',
  yearLevel: 3,
);

const Subject testSubject = Subject(
  id: 'subj-1',
  name: 'Integrative Programming',
  code: 'ITP-301',
);

/// Pinned clock seam: tests that assert on a concrete date pass [now] so the
/// fixture never depends on the machine's real weekday (the month-events
/// regression that failed every day except Tuesday).
String todayCampusDate({DateTime? now}) =>
    formatCampusDate(now ?? DateTime.now());

String todayDayWire({DateTime? now}) =>
    getDayName((now ?? DateTime.now()).weekday % 7);

Section testSection({
  String id = 'sec-1',
  String subjectId = 'subj-1',
  String section = '3-1',
  String? course = 'BSIT',
  String room = 'Room 201',
  String teacherName = 'Prof. Juan Dela Cruz',
  List<ScheduleDay>? schedule,
  DateTime? now,
}) {
  return Section(
    id: id,
    subjectId: subjectId,
    section: section,
    course: course,
    room: room,
    schedule:
        schedule ??
        <ScheduleDay>[
          ScheduleDay(
            day: DayOfWeek.fromWire(todayDayWire(now: now)),
            startTime: '09:00',
            endTime: '10:30',
            room: room,
          ),
        ],
    semester: '1st Semester',
    teacherId: 'teacher-1',
    teacherName: teacherName,
    studentCount: 30,
  );
}

Session testSession({
  String id = 'sess-1',
  String sectionId = 'sec-1',
  String? date,
  bool active = true,
  String? endedAt,
  SessionMode mode = SessionMode.inPerson,
  String? room = 'Room 201',
  DateTime? now,
}) {
  return Session(
    id: id,
    sectionId: sectionId,
    subjectName: testSubject.name,
    date: date ?? todayCampusDate(now: now),
    startTime: '09:00',
    endTime: '10:30',
    room: room,
    mode: mode,
    teacherId: 'teacher-1',
    isActive: active,
    endedAt: endedAt,
  );
}

AttendanceRecord testRecord({
  String id = 'rec-1',
  String sectionId = 'sec-1',
  String sessionId = 'sess-1',
  AttendanceStatus status = AttendanceStatus.present,
  String? timestamp,
  bool isSynced = true,
  DisputeReason? disputeReason,
  ExcuseStatus? excuseStatus,
  ExcuseReason? excuseReason,
  DateTime? now,
}) {
  return AttendanceRecord(
    id: id,
    sessionId: sessionId,
    sectionId: sectionId,
    studentId: studentUser.id,
    studentName: studentUser.fullName,
    timestamp:
        timestamp ??
        (now ?? DateTime.now())
            .toUtc()
            .subtract(const Duration(hours: 1))
            .toIso8601String(),
    status: status,
    isSynced: isSynced,
    disputeReason: disputeReason,
    excuseStatus: excuseStatus,
    excuseReason: excuseReason,
  );
}

AttendanceStanding testStanding({
  String sectionId = 'sec-1',
  AttendanceStandingStatus status = AttendanceStandingStatus.belowThreshold,
  double rate = 68.4,
  int threshold = 75,
  String subjectName = 'Integrative Programming',
}) {
  return AttendanceStanding(
    sectionId: sectionId,
    subjectName: subjectName,
    subjectCode: 'ITP-301',
    sectionName: '3-1',
    professorName: 'Prof. Juan Dela Cruz',
    thresholdPercent: threshold,
    attendanceRate: rate,
    status: status,
    caveat: 'Pending and disputed records are excluded.',
  );
}

/// Shell-level overrides every student screen expects (session, maintenance,
/// trusted clock, device clock/chip). Router-based tests reuse this so they
/// stay equivalent to [pumpStudentScreen].
List<Override> studentShellOverrides({User? user}) {
  return <Override>[
    sessionProvider.overrideWith(
      () => FakeSessionController(user ?? studentUser),
    ),
    maintenanceProvider.overrideWith(
      () => FakeMaintenanceController(const MaintenanceState()),
    ),
    trustedClockProvider.overrideWith(
      () => FakeTrustedClock(const TrustedClock()),
    ),
    deviceNowProvider.overrideWithValue(DateTime.now),
    studentDeviceChipProvider.overrideWith(
      (ref) async => 'DEVICE-BOUND •·•·4F2A',
    ),
  ];
}

Future<void> pumpStudentScreen(
  WidgetTester tester,
  Widget screen, {
  List<Override> overrides = const <Override>[],
  User? user,
  bool reduceMotion = false,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        ...studentShellOverrides(user: user),
        ...overrides,
      ],
      child: MaterialApp(
        theme: PupTheme.light,
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: reduceMotion),
          child: screen,
        ),
      ),
    ),
  );
  await tester.pump();
}

/// Pumps a full [GoRouter] app with the student shell overrides so navigation
/// (`context.push`) can be exercised exactly like the real app.
Future<GoRouter> pumpStudentRoutedScreen(
  WidgetTester tester, {
  required GoRouter router,
  List<Override> overrides = const <Override>[],
  User? user,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        ...studentShellOverrides(user: user),
        ...overrides,
      ],
      child: MaterialApp.router(theme: PupTheme.light, routerConfig: router),
    ),
  );
  await tester.pump();
  return router;
}

List<Override> dashboardOverrides({
  required List<Section> sections,
  required Map<String, Subject> subjects,
  required List<AttendanceRecord> records,
  required List<Session> sessions,
  List<AttendanceStanding> standings = const <AttendanceStanding>[],
  int pending = 0,
  StudentOfficerFlags officers = StudentOfficerFlags.none,
  List<SectionRole> roles = const <SectionRole>[],
  OfflineReadiness readiness = const OfflineReadiness(
    hasClassScheduleCached: false,
    hasEnrolledSections: false,
    hasTrustedClockOffset: false,
    hasVerifiableKeys: false,
  ),
  List<OfflineAttendanceQueueRow> queueIssues =
      const <OfflineAttendanceQueueRow>[],
  AppDatabase? database,
  List<Override> extra = const <Override>[],
}) {
  return <Override>[
    studentSectionsProvider.overrideWith((ref) => Stream.value(sections)),
    studentSubjectsProvider.overrideWith((ref) async => subjects),
    myAttendanceProvider.overrideWith((ref) => Stream.value(records)),
    todaySessionsProvider.overrideWith((ref) async => sessions),
    studentStandingProvider.overrideWith((ref) async => standings),
    pendingScanCountProvider.overrideWith((ref) => Stream.value(pending)),
    studentOfficerProvider.overrideWith((ref) async => officers),
    // Officer chips read the roles snapshot; tests supply it directly and fall
    // back to the aggregate officer flags so legacy dashboard expectations keep
    // working without touching the database or the network.
    studentClassRolesProvider.overrideWith(
      (ref) async => roles.isNotEmpty
          ? roles
          : <SectionRole>[
              if (sections.isNotEmpty && officers.isPresident)
                SectionRole(
                  id: 'sr-president',
                  sectionId: sections.first.id,
                  studentId: studentUser.id,
                  role: SectionRoleType.president,
                ),
              if (sections.isNotEmpty && officers.isQac)
                SectionRole(
                  id: 'sr-qac',
                  sectionId: sections.first.id,
                  studentId: studentUser.id,
                  role: SectionRoleType.qac,
                ),
            ],
    ),
    // The offline dashboards read the drift cache; tests keep the harness
    // hermetic with a memory database + canned readiness/issue streams.
    appDatabaseProvider.overrideWithValue(
      database ?? AppDatabase.forTesting(NativeDatabase.memory()),
    ),
    offlineReadinessProvider.overrideWith((ref) => Future.value(readiness)),
    offlineQueueIssuesProvider.overrideWith(
      (ref, _) => Stream.value(queueIssues),
    ),
    ...extra,
  ];
}

/// Queue-row builder for sync-panel tests (status/serverError fields).
OfflineAttendanceQueueRow queueIssueRow({
  String receiptId = 'receipt-1',
  String userId = 'student-1',
  String? serverError,
  AttendanceSyncStatus status = AttendanceSyncStatus.failed,
  DateTime? createdAt,
}) {
  return OfflineAttendanceQueueRow(
    clientReceiptId: receiptId,
    userId: userId,
    sessionId: 'sess-1',
    studentId: userId,
    scannedToken: 'token',
    scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
    syncStatus: status,
    serverError: serverError,
    isMocked: false,
    retryCount: 0,
    createdAt: createdAt ?? DateTime.utc(2026, 11, 10, 8),
  );
}
