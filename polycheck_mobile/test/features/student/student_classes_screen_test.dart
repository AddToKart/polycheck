import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/my_class_card.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/student_classes_screen.dart';
import 'package:polycheck_mobile/src/features/student/student_paths.dart';

import 'student_test_harness.dart';

GoRouter _classesRouter() {
  return GoRouter(
    initialLocation: StudentPaths.classList,
    routes: <RouteBase>[
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

void main() {
  testWidgets('lists every enrolled class with subject and section metadata', (
    tester,
  ) async {
    final sections = <Section>[
      testSection(id: 'sec-1', section: '1-1'),
      testSection(id: 'sec-2', subjectId: 'subj-2', section: '2-1'),
    ];

    await pumpStudentRoutedScreen(
      tester,
      router: _classesRouter(),
      overrides: dashboardOverrides(
        sections: sections,
        subjects: const <String, Subject>{
          'subj-1': testSubject,
          'subj-2': Subject(id: 'subj-2', name: 'Web Systems', code: 'ITP-302'),
        },
        records: <AttendanceRecord>[
          testRecord(id: 'r1', sectionId: 'sec-1'),
          testRecord(
            id: 'r2',
            sectionId: 'sec-1',
            status: AttendanceStatus.absent,
          ),
          testRecord(
            id: 'r3',
            sectionId: 'sec-2',
            status: AttendanceStatus.late,
          ),
        ],
        sessions: const <Session>[],
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(StudentClassesScreen), findsOneWidget);
    expect(find.text('2 enrolled'), findsOneWidget);
    expect(find.byType(MyClassCard), findsNWidgets(2));

    // Rate bars are per-section: 1/2 present for sec-1, 0/1 for sec-2.
    expect(find.text('50%'), findsOneWidget);
    expect(find.text('0%'), findsOneWidget);
    expect(find.textContaining('Section 1-1 · BSIT'), findsOneWidget);
    expect(find.textContaining('ITP-302'), findsOneWidget);
  });

  testWidgets('tapping a class opens its section detail page', (tester) async {
    await pumpStudentRoutedScreen(
      tester,
      router: _classesRouter(),
      overrides: dashboardOverrides(
        sections: <Section>[testSection()],
        subjects: const <String, Subject>{'subj-1': testSubject},
        records: const <AttendanceRecord>[],
        sessions: const <Session>[],
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('student-class-card-sec-1')));
    await tester.pumpAndSettle();

    expect(find.text('DETAIL sec-1'), findsOneWidget);
  });

  testWidgets('empty list offers enrollment through the existing dialog', (
    tester,
  ) async {
    await pumpStudentRoutedScreen(
      tester,
      router: _classesRouter(),
      overrides: dashboardOverrides(
        sections: <Section>[],
        subjects: const <String, Subject>{},
        records: const <AttendanceRecord>[],
        sessions: const <Session>[],
      ),
    );
    await tester.pumpAndSettle();

    final emptyCard = find.byKey(const ValueKey('student-classes-list-empty'));
    expect(emptyCard, findsOneWidget);
    expect(
      find.descendant(of: emptyCard, matching: find.text('No classes yet')),
      findsOneWidget,
    );

    await tester.tap(
      find.descendant(of: emptyCard, matching: find.text('Enroll')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Enroll in a class'), findsOneWidget);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
  });
}
