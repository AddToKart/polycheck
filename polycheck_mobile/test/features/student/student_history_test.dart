import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/presentation/history/student_history_screen.dart';

import 'student_test_harness.dart';

void main() {
  final sections = <Section>[
    testSection(id: 'sec-1', subjectId: 'subj-1'),
    testSection(id: 'sec-2', subjectId: 'subj-2', section: '3-2'),
    testSection(id: 'sec-3', subjectId: 'subj-3', section: '3-3'),
  ];
  const subjects = <String, Subject>{
    'subj-1': Subject(
      id: 'subj-1',
      name: 'Integrative Programming',
      code: 'ITP-301',
    ),
    'subj-2': Subject(id: 'subj-2', name: 'Data Structures', code: 'DS-302'),
    'subj-3': Subject(id: 'subj-3', name: 'Networks', code: 'NET-303'),
  };
  final oldTimestamp = DateTime.now()
      .toUtc()
      .subtract(const Duration(days: 40))
      .toIso8601String();
  final records = <AttendanceRecord>[
    testRecord(
      id: 'r-present',
      sectionId: 'sec-1',
      sessionId: 'sess-1',
      status: AttendanceStatus.present,
    ),
    testRecord(
      id: 'r-late',
      sectionId: 'sec-2',
      sessionId: 'sess-2',
      status: AttendanceStatus.late,
    ),
    testRecord(
      id: 'r-absent',
      sectionId: 'sec-3',
      sessionId: 'sess-3',
      status: AttendanceStatus.absent,
      timestamp: oldTimestamp,
    ),
  ];

  Future<void> pumpHistory(WidgetTester tester) async {
    await pumpStudentScreen(
      tester,
      const StudentHistoryScreen(),
      overrides: <Override>[
        myAttendanceProvider.overrideWith((ref) => Stream.value(records)),
        studentSectionsProvider.overrideWith((ref) => Stream.value(sections)),
        studentSubjectsProvider.overrideWith((ref) async => subjects),
      ],
    );
    await tester.pumpAndSettle();
  }

  testWidgets('status chips filter the audit list', (tester) async {
    await pumpHistory(tester);

    expect(find.text('Integrative Programming'), findsOneWidget);
    expect(find.text('Data Structures'), findsOneWidget);
    expect(find.text('Networks'), findsOneWidget);
    expect(find.text('INCOMPLETE'), findsOneWidget);
    expect(find.text('EXCUSED'), findsOneWidget);
    expect(find.text('DISPUTED'), findsWidgets);

    await tester.tap(find.text('LATE'));
    await tester.pumpAndSettle();

    expect(find.text('Data Structures'), findsOneWidget);
    expect(find.text('Integrative Programming'), findsNothing);
    expect(find.text('Networks'), findsNothing);
  });

  testWidgets('date presets keep only recent records', (tester) async {
    await pumpHistory(tester);

    await tester.tap(find.text('LAST 7 DAYS'));
    await tester.pumpAndSettle();

    expect(find.text('Integrative Programming'), findsOneWidget);
    expect(find.text('Data Structures'), findsOneWidget);
    expect(find.text('Networks'), findsNothing);
  });

  testWidgets('record actions expose excuse and dispute entry points', (
    tester,
  ) async {
    await pumpHistory(tester);

    await tester.tap(find.text('Networks'));
    await tester.pumpAndSettle();

    expect(find.text('Request excuse'), findsOneWidget);
    expect(find.text('Report issue'), findsOneWidget);
    expect(find.text('Section 3-3 · BSIT'), findsWidgets);
  });
}
