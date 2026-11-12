import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/my_class_card.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/student_classes_screen.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/student_dashboard_screen.dart';
import 'package:polycheck_mobile/src/features/student/student_paths.dart';

import 'student_test_harness.dart';

GoRouter _dashboardRouter() {
  return GoRouter(
    initialLocation: StudentPaths.dashboard,
    routes: <RouteBase>[
      GoRoute(
        path: StudentPaths.dashboard,
        builder: (context, state) => const StudentDashboardScreen(),
      ),
      GoRoute(
        path: StudentPaths.classList,
        builder: (context, state) => const StudentClassesScreen(),
      ),
      GoRoute(
        path: '${StudentPaths.subjectPrefix}/:id',
        builder: (context, state) => Scaffold(
          body: Center(child: Text('DETAIL ${state.pathParameters['id']}')),
        ),
      ),
    ],
  );
}

const Map<String, Subject> _classSubjects = <String, Subject>{
  'subj-a': Subject(id: 'subj-a', name: 'Algorithms', code: 'CS-301'),
  'subj-b': Subject(id: 'subj-b', name: 'Bravo Systems', code: 'CS-302'),
  'subj-c': Subject(id: 'subj-c', name: 'Charlie Networks', code: 'CS-303'),
  'subj-d': Subject(id: 'subj-d', name: 'Delta Databases', code: 'CS-304'),
  'subj-e': Subject(id: 'subj-e', name: 'Echo Security', code: 'CS-305'),
};

List<Section> _fiveSections() {
  const ids = <String>['a', 'b', 'c', 'd', 'e'];
  return <Section>[
    for (var i = 0; i < ids.length; i++)
      testSection(
        id: 'sec-${i + 1}',
        subjectId: 'subj-${ids[i]}',
        section: '1-${i + 1}',
      ),
  ];
}

void main() {
  testWidgets('renders greeting, stats, standing banner and offline chip', (
    tester,
  ) async {
    final section = testSection();
    final records = <AttendanceRecord>[
      testRecord(id: 'r1', status: AttendanceStatus.present),
      testRecord(id: 'r2', status: AttendanceStatus.present),
      testRecord(id: 'r3', status: AttendanceStatus.present),
      testRecord(id: 'r4', status: AttendanceStatus.late),
      testRecord(id: 'r5', status: AttendanceStatus.absent),
      testRecord(id: 'r6', status: AttendanceStatus.disputed),
    ];
    await pumpStudentScreen(
      tester,
      const StudentDashboardScreen(),
      overrides: dashboardOverrides(
        sections: <Section>[section],
        subjects: const <String, Subject>{'subj-1': testSubject},
        records: records,
        sessions: <Session>[testSession()],
        standings: <AttendanceStanding>[testStanding()],
        pending: 2,
        officers: const StudentOfficerFlags(isPresident: true),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Maria'), findsWidgets);
    expect(find.text('PRESENT'), findsOneWidget);
    expect(find.text('LATE'), findsOneWidget);
    expect(find.text('ABSENT'), findsOneWidget);
    expect(find.text('DISPUTED'), findsOneWidget);
    expect(find.text('3'), findsWidgets);
    expect(find.text('68.4%'), findsOneWidget);
    expect(find.textContaining('minimum 75%'), findsOneWidget);
    expect(find.textContaining('waiting to sync'), findsOneWidget);
    expect(find.text('ACTIVE'), findsOneWidget);
    expect(find.textContaining('Section 3-1 · BSIT'), findsWidgets);
    expect(find.byKey(const ValueKey('student-scan-action')), findsOneWidget);
    expect(find.byKey(const ValueKey('student-enroll-action')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('student-history-action')),
      findsOneWidget,
    );
    expect(find.textContaining('Section president'), findsOneWidget);
  });

  testWidgets('dismissing the standing banner hides it for the session', (
    tester,
  ) async {
    await pumpStudentScreen(
      tester,
      const StudentDashboardScreen(),
      overrides: dashboardOverrides(
        sections: <Section>[testSection()],
        subjects: const <String, Subject>{'subj-1': testSubject},
        records: <AttendanceRecord>[testRecord()],
        sessions: <Session>[testSession(active: false)],
        standings: <AttendanceStanding>[testStanding()],
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('student-standing-banner')),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('standing-dismiss')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('student-standing-banner')), findsNothing);
  });

  testWidgets('renders completed session status and empty day copy', (
    tester,
  ) async {
    await pumpStudentScreen(
      tester,
      const StudentDashboardScreen(),
      overrides: dashboardOverrides(
        sections: <Section>[testSection()],
        subjects: const <String, Subject>{'subj-1': testSubject},
        records: <AttendanceRecord>[],
        sessions: <Session>[
          testSession(active: false, endedAt: '2026-11-10T10:30:00.000Z'),
        ],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('COMPLETED'), findsOneWidget);
  });

  testWidgets('renders the clear-day empty state', (tester) async {
    await pumpStudentScreen(
      tester,
      const StudentDashboardScreen(),
      overrides: dashboardOverrides(
        sections: <Section>[],
        subjects: const <String, Subject>{},
        records: <AttendanceRecord>[],
        sessions: <Session>[],
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Your day is clear'), findsOneWidget);
  });

  testWidgets('my classes previews four cards and links to the full list', (
    tester,
  ) async {
    await pumpStudentRoutedScreen(
      tester,
      router: _dashboardRouter(),
      overrides: dashboardOverrides(
        sections: _fiveSections(),
        subjects: _classSubjects,
        records: const <AttendanceRecord>[],
        sessions: const <Session>[],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('My classes'), findsOneWidget);
    expect(find.byType(MyClassCard), findsNWidgets(4));
    expect(
      find.byKey(const ValueKey('student-class-card-sec-5')),
      findsNothing,
    );
    expect(find.text('View all 5 classes'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('student-classes-view-all')));
    await tester.pumpAndSettle();

    final listScreen = find.byType(StudentClassesScreen);
    expect(listScreen, findsOneWidget);
    expect(find.text('5 enrolled'), findsOneWidget);
    expect(
      find.descendant(of: listScreen, matching: find.byType(MyClassCard)),
      findsNWidgets(5),
    );

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(StudentDashboardScreen), findsOneWidget);
  });

  testWidgets('tapping a class card opens the section detail', (tester) async {
    await pumpStudentRoutedScreen(
      tester,
      router: _dashboardRouter(),
      overrides: dashboardOverrides(
        sections: <Section>[testSection()],
        subjects: const <String, Subject>{'subj-1': testSubject},
        records: <AttendanceRecord>[],
        sessions: <Session>[],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('student-class-card-sec-1')));
    await tester.pumpAndSettle();

    expect(find.text('DETAIL sec-1'), findsOneWidget);
  });

  testWidgets('class cards show officer chips from the roles snapshot', (
    tester,
  ) async {
    await pumpStudentRoutedScreen(
      tester,
      router: _dashboardRouter(),
      overrides: dashboardOverrides(
        sections: <Section>[testSection()],
        subjects: const <String, Subject>{'subj-1': testSubject},
        records: <AttendanceRecord>[],
        sessions: const <Session>[],
        roles: const <SectionRole>[
          SectionRole(
            id: 'sr-1',
            sectionId: 'sec-1',
            studentId: 'student-1',
            role: SectionRoleType.president,
          ),
          SectionRole(
            id: 'sr-2',
            sectionId: 'sec-1',
            studentId: 'student-1',
            role: SectionRoleType.qac,
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();

    final card = find.byType(MyClassCard);
    expect(
      find.descendant(of: card, matching: find.text('President')),
      findsOneWidget,
    );
    expect(
      find.descendant(of: card, matching: find.text('QAC')),
      findsOneWidget,
    );
  });

  testWidgets('my classes empty state opens the enrollment dialog', (
    tester,
  ) async {
    await pumpStudentRoutedScreen(
      tester,
      router: _dashboardRouter(),
      overrides: dashboardOverrides(
        sections: <Section>[],
        subjects: const <String, Subject>{},
        records: const <AttendanceRecord>[],
        sessions: const <Session>[],
      ),
    );
    await tester.pumpAndSettle();

    final emptyCard = find.byKey(const ValueKey('student-classes-empty'));
    expect(emptyCard, findsOneWidget);
    expect(
      find.descendant(of: emptyCard, matching: find.text('No classes yet')),
      findsOneWidget,
    );
    expect(find.text('View all 0 classes'), findsNothing);

    await tester.tap(
      find.descendant(of: emptyCard, matching: find.text('Enroll')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Enroll in a class'), findsOneWidget);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
  });
}
