import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/attendance_api.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/api/dashboard_api.dart';
import 'package:polycheck_mobile/src/core/api/sections_api.dart';
import 'package:polycheck_mobile/src/core/api/subjects_api.dart';
import 'package:polycheck_mobile/src/core/models/api.dart';
import 'package:polycheck_mobile/src/core/models/at_risk.dart';
import 'package:polycheck_mobile/src/core/models/section_role.dart';
import 'package:polycheck_mobile/src/core/models/standing.dart';
import 'package:polycheck_mobile/src/core/models/subject.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/faculty_dashboard_screen.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/faculty_shell.dart';

const _teacher = User(
  id: 'teacher-1',
  fullName: 'Prof. Cruz',
  role: UserRole.teacher,
);

class _SignedInSession extends SessionController {
  _SignedInSession(this.user);

  final User user;

  @override
  SessionState build() =>
      SessionState(status: SessionStatus.signedIn, user: user);
}

class _FakeSubjectsApi extends SubjectsApi {
  _FakeSubjectsApi() : super(Dio());

  @override
  Future<List<Subject>> getSubjects() async => const [
    Subject(id: 'subj-1', name: 'Capstone Project', code: 'COMP 20043'),
  ];
}

class _FakeSectionsApi extends SectionsApi {
  _FakeSectionsApi() : super(Dio());

  @override
  Future<List<Section>> getSections({String? subjectId}) async => const [
    Section(
      id: 'sec-1',
      subjectId: 'subj-1',
      section: '4-1',
      course: 'BSIT',
      room: 'CCIS Lab 3',
      teacherId: 'teacher-1',
      teacherName: 'Prof. Cruz',
      studentCount: 3,
    ),
    Section(
      id: 'sec-2',
      subjectId: 'subj-1',
      section: '4-2',
      course: 'BSIT',
      room: 'CCIS Lab 2',
      teacherId: 'teacher-2',
      teacherName: 'Prof. Reyes',
      studentCount: 2,
    ),
  ];

  @override
  Future<List<User>> getStudentsForSection(String sectionId) async => const [];

  @override
  Future<List<SectionRole>> getSectionRoles(String sectionId) async => const [];
}

class _FakeDashboardApi extends DashboardApi {
  _FakeDashboardApi() : super(Dio());

  @override
  Future<DashboardOverview> getDashboardOverview({
    String? startDate,
    String? endDate,
  }) async => const DashboardOverview(
    counts: DashboardCounts(
      subjects: 2,
      sections: 3,
      students: 47,
      sessionsToday: 1,
      pendingDisputes: 4,
    ),
    trendRange: AttendanceReportRange(
      startDate: '2026-10-12',
      endDate: '2026-11-10',
    ),
  );

  @override
  Future<List<CalendarEvent>> getCalendarEvents(
    String userId,
    String startDate,
    String endDate,
  ) async => const [
    CalendarEvent(
      id: 'sess-1',
      title: 'Software Engineering',
      date: '2026-11-10',
      startTime: '09:00',
      endTime: '10:30',
      room: 'CCIS Lab 3',
      sectionId: 'sec-1',
      subjectName: 'Software Engineering',
      sectionName: '4-1',
      type: CalendarEventType.session,
      status: CalendarEventStatus.active,
    ),
  ];
}

class _FakeAttendanceApi extends AttendanceApi {
  _FakeAttendanceApi() : super(Dio());

  @override
  Future<List<StudentAtRisk>> getAtRiskStudents({
    String? sectionId,
    int? limit,
  }) async => const [
    StudentAtRisk(
      studentId: 's-1',
      studentName: 'Dela Cruz, Juan',
      sectionId: 'sec-1',
      sectionName: '4-1',
      subjectName: 'Software Engineering',
      professorName: 'Prof. Cruz',
      status: AttendanceStandingStatus.belowThreshold,
      attendanceRate: 62,
    ),
  ];
}

void main() {
  testWidgets('dashboard renders counts, today schedule, and at-risk preview', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(() => _SignedInSession(_teacher)),
          subjectsApiProvider.overrideWithValue(_FakeSubjectsApi()),
          sectionsApiProvider.overrideWithValue(_FakeSectionsApi()),
          dashboardApiProvider.overrideWithValue(_FakeDashboardApi()),
          attendanceApiProvider.overrideWithValue(_FakeAttendanceApi()),
        ],
        child: MaterialApp(
          theme: BrandTheme.light,
          home: const FacultyDashboardScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('Faculty dashboard'), findsOneWidget);
    expect(find.text('Welcome back, Prof. Cruz'), findsOneWidget);
    expect(find.text('47'), findsOneWidget);
    expect(find.text('PENDING DISPUTES'), findsOneWidget);
    expect(find.text('Software Engineering'), findsOneWidget);
    expect(find.text('STUDENTS TO CHECK ON'), findsOneWidget);
    expect(find.text('Dela Cruz, Juan'), findsOneWidget);
    expect(find.text('Capstone Project'), findsOneWidget);
  });

  /// A phone as narrow as the one in the report (412 points wide).
  Future<GoRouter> pumpOnPhone(WidgetTester tester) async {
    tester.view.physicalSize = const Size(412, 915);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final router = GoRouter(
      initialLocation: '/faculty/dashboard',
      routes: <RouteBase>[
        GoRoute(
          path: '/faculty/dashboard',
          builder: (context, state) => const FacultyDashboardScreen(),
        ),
        GoRoute(
          path: '/faculty/sections/:id',
          builder: (context, state) =>
              Scaffold(body: Text('SECTION ${state.pathParameters['id']}')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(() => _SignedInSession(_teacher)),
          subjectsApiProvider.overrideWithValue(_FakeSubjectsApi()),
          sectionsApiProvider.overrideWithValue(_FakeSectionsApi()),
          dashboardApiProvider.overrideWithValue(_FakeDashboardApi()),
          attendanceApiProvider.overrideWithValue(_FakeAttendanceApi()),
        ],
        child: MaterialApp.router(
          theme: BrandTheme.light,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();
    return router;
  }

  Finder card(String label) => find.ancestor(
    of: find.text(label),
    matching: find.byType(FacultyStatCard),
  );

  testWidgets('the cards sit two per row on a phone and all open something', (
    tester,
  ) async {
    await pumpOnPhone(tester);

    final subjects = tester.getRect(card('SUBJECTS'));
    final sections = tester.getRect(card('SECTIONS'));
    final students = tester.getRect(card('STUDENTS'));
    final disputes = tester.getRect(card('PENDING DISPUTES'));
    expect(sections.top, subjects.top);
    expect(sections.left, greaterThan(subjects.right));
    expect(sections.height, subjects.height);
    expect(students.top, greaterThan(subjects.bottom));
    // The fifth card fills its row instead of leaving half of it empty.
    expect(disputes.width, greaterThan(subjects.width * 1.9));
    // Three rows, far shorter than five full-width cards.
    expect(disputes.bottom - subjects.top, lessThan(300));
    for (final widget in tester.widgetList<FacultyStatCard>(
      find.byType(FacultyStatCard),
    )) {
      expect(widget.onTap, isNotNull, reason: widget.label);
    }
  });

  testWidgets(
    'Sections and Students open a section list that opens a section',
    (tester) async {
      for (final entry in <String, String>{
        'SECTIONS': 'Your sections',
        'STUDENTS': 'Students by section',
      }.entries) {
        await pumpOnPhone(tester);

        await tester.tap(card(entry.key));
        await tester.pumpAndSettle();

        expect(find.text(entry.value), findsOneWidget);
        expect(find.text('Section 4-1 · BSIT · 3 students'), findsOneWidget);
        // Another teacher's section is not offered.
        expect(find.textContaining('Section 4-2'), findsNothing);

        await tester.tap(
          find.byKey(const ValueKey<String>('dashboard-section-sec-1')),
        );
        await tester.pumpAndSettle();
        expect(find.text('SECTION sec-1'), findsOneWidget);
        await tester.pumpWidget(const SizedBox.shrink());
      }
    },
  );
}
