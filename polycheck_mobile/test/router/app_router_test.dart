import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/main.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/admin_dashboard_screen.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/boot_screen.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/force_password_change_screen.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/maintenance_screen.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/portal_select_screen.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/faculty_dashboard_screen.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/student_dashboard_screen.dart';

import '../helpers/auth_harness.dart';

class _QuietSubjectsApi extends SubjectsApi {
  _QuietSubjectsApi() : super(Dio());

  @override
  Future<List<Subject>> getSubjects() async => const <Subject>[];
}

class _QuietSectionsApi extends SectionsApi {
  _QuietSectionsApi() : super(Dio());

  @override
  Future<List<Section>> getSections({String? subjectId}) async =>
      const <Section>[];
}

class _QuietDashboardApi extends DashboardApi {
  _QuietDashboardApi() : super(Dio());

  static const _offline = ApiRequestError(message: 'offline', status: 0);

  @override
  Future<DashboardOverview> getDashboardOverview({
    String? startDate,
    String? endDate,
  }) => Future<DashboardOverview>.error(_offline);

  @override
  Future<AdminOverview> getAdminOverview() =>
      Future<AdminOverview>.error(_offline);

  @override
  Future<List<CalendarEvent>> getCalendarEvents(
    String userId,
    String startDate,
    String endDate,
  ) => Future<List<CalendarEvent>>.error(_offline);
}

class _QuietAttendanceApi extends AttendanceApi {
  _QuietAttendanceApi() : super(Dio());

  @override
  Future<List<StudentAtRisk>> getAtRiskStudents({
    String? sectionId,
    int? limit,
  }) async => const <StudentAtRisk>[];
}

/// Restoring controller: holds `SessionStatus.restoring` until [complete] is
/// called, so the FLR-02 cold-start gate can be exercised end to end.
class _RestoringSessionController extends SessionController {
  _RestoringSessionController(this.user);

  final User user;

  @override
  SessionState build() {
    ref.listen(sessionExpiredEventsProvider, (previous, next) {});
    return const SessionState(status: SessionStatus.restoring);
  }

  void complete(User signedIn) {
    state = SessionState(status: SessionStatus.signedIn, user: signedIn);
  }
}

void main() {
  const consentedStudent = User(
    id: 'student-1',
    fullName: 'Maria Santos',
    role: UserRole.student,
    privacyConsentVersion: 'v1',
    privacyConsentedAt: '2026-11-01T00:00:00.000Z',
  );

  FakeSessionApi consentedApi() => FakeSessionApi(
    onPrivacyNotice: () async => const PrivacyNotice(
      version: 'v1',
      url: 'https://pup.edu.ph/privacy',
      summary: 'Attendance evidence notice.',
    ),
  );

  List<Override> baseOverrides({
    required User? user,
    MaintenanceState maintenance = const MaintenanceState(),
    bool withStudentData = false,
  }) {
    return <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(user)),
      studentOfficerProvider.overrideWith(
        (ref) async => StudentOfficerFlags.none,
      ),
      sessionApiProvider.overrideWithValue(consentedApi()),
      maintenanceProvider.overrideWith(
        () => FakeMaintenanceController(maintenance),
      ),
      if (withStudentData) ...<Override>[
        studentSectionsProvider.overrideWith(
          (ref) => Stream<List<Section>>.value(const <Section>[]),
        ),
        studentSubjectsProvider.overrideWith(
          (ref) async => const <String, Subject>{},
        ),
        myAttendanceProvider.overrideWith(
          (ref) =>
              Stream<List<AttendanceRecord>>.value(const <AttendanceRecord>[]),
        ),
        todaySessionsProvider.overrideWith((ref) async => const <Session>[]),
        studentStandingProvider.overrideWith(
          (ref) async => const <AttendanceStanding>[],
        ),
        pendingScanCountProvider.overrideWith((ref) => Stream<int>.value(0)),
      ],
    ];
  }

  Future<(ProviderContainer, GoRouter)> pumpApp(
    WidgetTester tester,
    List<Override> overrides, {
    bool settle = true,
  }) async {
    final container = ProviderContainer(overrides: overrides);
    addTearDown(container.dispose);
    final router = container.read(appRouterProvider);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: PolycheckApp(router: router, bootstrap: false),
      ),
    );
    if (settle) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump();
    }
    return (container, router);
  }

  testWidgets('signed-in students land on the real student dashboard', (
    tester,
  ) async {
    final (_, router) = await pumpApp(
      tester,
      baseOverrides(user: consentedStudent, withStudentData: true),
    );

    expect(find.byType(StudentDashboardScreen), findsOneWidget);
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      AppRoutes.studentHome,
    );
    expect(find.text('Not available in this build'), findsNothing);
  });

  testWidgets('anonymous deep links redirect to the portal with the target', (
    tester,
  ) async {
    final (_, router) = await pumpApp(tester, baseOverrides(user: null));

    router.go('/faculty/sections/12?tab=roster');
    await tester.pumpAndSettle();

    expect(find.byType(PortalSelectScreen), findsOneWidget);
    expect(
      router.routerDelegate.currentConfiguration.uri.toString(),
      '/?redirect=%2Ffaculty%2Fsections%2F12%3Ftab%3Droster',
    );
  });

  testWidgets('mustChangePassword locks navigation to the rotation screen', (
    tester,
  ) async {
    const pendingFaculty = User(
      id: 'teacher-1',
      fullName: 'Prof. Juan Dela Cruz',
      role: UserRole.teacher,
      mustChangePassword: true,
    );
    final (_, router) = await pumpApp(
      tester,
      baseOverrides(user: pendingFaculty),
    );

    expect(find.byType(ForcePasswordChangeScreen), findsOneWidget);
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      AppRoutes.forcePasswordChange,
    );
  });

  testWidgets(
    'FLR-02: a protected deep link parks on the boot splash while restoring '
    'and resolves once the session is authoritative',
    (tester) async {
      final session = _RestoringSessionController(consentedStudent);
      final (_, router) = await pumpApp(tester, <Override>[
        sessionProvider.overrideWith(() => session),
        sessionApiProvider.overrideWithValue(consentedApi()),
        studentOfficerProvider.overrideWith(
          (ref) async => StudentOfficerFlags.none,
        ),
        maintenanceProvider.overrideWith(
          () => FakeMaintenanceController(const MaintenanceState()),
        ),
        studentSectionsProvider.overrideWith(
          (ref) => Stream<List<Section>>.value(const <Section>[]),
        ),
        studentSubjectsProvider.overrideWith(
          (ref) async => const <String, Subject>{},
        ),
        myAttendanceProvider.overrideWith(
          (ref) =>
              Stream<List<AttendanceRecord>>.value(const <AttendanceRecord>[]),
        ),
        todaySessionsProvider.overrideWith((ref) async => const <Session>[]),
        studentStandingProvider.overrideWith(
          (ref) async => const <AttendanceStanding>[],
        ),
        pendingScanCountProvider.overrideWith((ref) => Stream<int>.value(0)),
      ], settle: false);
      await tester.pump();

      router.go('/student/dashboard');
      await tester.pump();
      await tester.pump();

      // No protected screen (and no QR) mounted against an unverified session.
      expect(
        router.routerDelegate.currentConfiguration.uri.path,
        AppRoutes.boot,
      );
      expect(find.byType(BootScreen), findsOneWidget);
      expect(find.text('Restoring your session.'), findsOneWidget);

      // The restore settles; the parked target is resolved. (The boot spinner
      // animates forever, so fixed pumps replace `pumpAndSettle`.)
      // The restore settles; the parked target is resolved. The boot spinner
      // animates forever, so settle only after the splash is scheduled away.
      session.complete(consentedStudent);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(
        router.routerDelegate.currentConfiguration.uri.path,
        AppRoutes.studentHome,
      );
      expect(find.byType(BootScreen), findsNothing);
      expect(find.byType(StudentDashboardScreen), findsOneWidget);
    },
  );

  testWidgets('non-exempt faculty are forced onto the real maintenance '
      'screen', (tester) async {
    final (_, router) = await pumpApp(
      tester,
      baseOverrides(
        user: testFaculty,
        maintenance: const MaintenanceState(
          enabled: true,
          message: 'Scheduled database upgrade.',
        ),
      ),
      settle: false,
    );
    await tester.pump(const Duration(milliseconds: 50));

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      AppRoutes.maintenance,
    );
    expect(find.byType(MaintenanceScreen), findsOneWidget);
    expect(
      find.text('Polycheck is under scheduled maintenance'),
      findsOneWidget,
    );

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('exempt IT coordinators keep navigating and see the banner', (
    tester,
  ) async {
    const itCoordinator = User(
      id: 'teacher-it',
      fullName: 'IT Coordinator',
      role: UserRole.teacher,
      isItCoordinator: true,
    );
    final (_, router) = await pumpApp(tester, <Override>[
      ...baseOverrides(
        user: itCoordinator,
        maintenance: const MaintenanceState(
          enabled: true,
          message: 'Scheduled database upgrade.',
        ),
      ),
      subjectsApiProvider.overrideWithValue(_QuietSubjectsApi()),
      sectionsApiProvider.overrideWithValue(_QuietSectionsApi()),
      dashboardApiProvider.overrideWithValue(_QuietDashboardApi()),
      attendanceApiProvider.overrideWithValue(_QuietAttendanceApi()),
    ]);

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      AppRoutes.facultyHome,
    );
    expect(find.byType(FacultyDashboardScreen), findsOneWidget);
    expect(find.text('Maintenance mode - exemption active'), findsOneWidget);
  });

  testWidgets('super admins land on the real administrator console', (
    tester,
  ) async {
    final (_, router) = await pumpApp(tester, <Override>[
      ...baseOverrides(user: testAdmin),
      dashboardApiProvider.overrideWithValue(_QuietDashboardApi()),
    ]);

    expect(find.byType(AdminDashboardScreen), findsOneWidget);
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      AppRoutes.adminHome,
    );
  });
}
