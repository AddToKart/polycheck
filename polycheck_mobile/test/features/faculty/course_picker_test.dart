import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/section_create_screen.dart';

import '../../helpers/auth_harness.dart';

class FakePickerSubjectsApi extends SubjectsApi {
  FakePickerSubjectsApi() : super(Dio());

  @override
  Future<Subject> getSubject(String id) async => const Subject(
    id: 'subj-1',
    name: 'Integrative Programming',
    code: 'ITP-301',
  );
}

/// Bug 2: the course picker is a searchable, height-capped sheet — not a
/// giant unsearchable full-screen list.
void main() {
  Future<ProviderContainer> pumpCreateScreen(WidgetTester tester) async {
    final container = ProviderContainer(
      overrides: <Override>[
        sessionProvider.overrideWith(() => FakeSessionController(testFaculty)),
        subjectsApiProvider.overrideWithValue(FakePickerSubjectsApi()),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: PupTheme.light,
          home: const SectionCreateScreen(subjectId: 'subj-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return container;
  }

  Future<void> openCoursePicker(WidgetTester tester) async {
    await tester.tap(find.text('Select a course…'));
    await tester.pumpAndSettle();
  }

  testWidgets('full catalog renders inside a height-capped sheet', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await pumpCreateScreen(tester);
    await openCoursePicker(tester);

    expect(find.text('BSIT — BS Information Technology'), findsOneWidget);
    expect(find.text('BSA — BS Accountancy'), findsOneWidget);
    expect(find.text('Other — specify manually'), findsOneWidget);

    // The sheet is capped (Bug 2): never full-screen.
    final sheetRect = tester.getRect(find.byType(CampusBottomSheet));
    expect(sheetRect.height, lessThan(800));
  });

  testWidgets('search filters by code and name and keeps group headers', (
    tester,
  ) async {
    await pumpCreateScreen(tester);
    await openCoursePicker(tester);

    // By code (case-insensitive).
    await tester.enterText(find.byKey(const ValueKey('course-search')), 'bsit');
    await tester.pump();
    expect(find.text('BSIT — BS Information Technology'), findsOneWidget);
    expect(find.text('BSA — BS Accountancy'), findsNothing);
    expect(find.text('CCIS'), findsOneWidget);
    expect(find.text('BUSINESS'), findsNothing);

    // By name fragment across one department.
    await tester.enterText(
      find.byKey(const ValueKey('course-search')),
      'account',
    );
    await tester.pump();
    expect(find.text('BSA — BS Accountancy'), findsOneWidget);
    expect(find.text('BSMA — BS Management Accounting'), findsOneWidget);
    expect(
      find.text('BSAIS — BS Accounting Information Systems'),
      findsOneWidget,
    );
    expect(find.text('BUSINESS'), findsOneWidget);
    expect(find.text('CCIS'), findsNothing);

    // The manual escape hatch stays reachable while filtered.
    expect(find.byKey(const ValueKey('course-option-custom')), findsOneWidget);
  });

  testWidgets('no match explains the manual path', (tester) async {
    await pumpCreateScreen(tester);
    await openCoursePicker(tester);

    await tester.enterText(find.byKey(const ValueKey('course-search')), 'zzz');
    await tester.pump();

    expect(find.textContaining('No catalog course matches'), findsOneWidget);
    expect(find.byKey(const ValueKey('course-option-custom')), findsOneWidget);
  });

  testWidgets('tapping a course pops its code into the field', (tester) async {
    await pumpCreateScreen(tester);
    await openCoursePicker(tester);

    await tester.enterText(find.byKey(const ValueKey('course-search')), 'bscs');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('course-option-BSCS')));
    await tester.pumpAndSettle();

    // Sheet closed; the field shows the resolved selection.
    expect(find.byType(CampusBottomSheet), findsNothing);
    expect(find.text('BSCS — BS Computer Science'), findsOneWidget);
  });

  testWidgets('the manual option opens the custom course field', (
    tester,
  ) async {
    await pumpCreateScreen(tester);
    await openCoursePicker(tester);

    // The full catalog overflows the capped body — scroll the bottom row in.
    await tester.ensureVisible(
      find.byKey(const ValueKey('course-option-custom')),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('course-option-custom')));
    await tester.pumpAndSettle();

    expect(find.text('Other — specify manually'), findsOneWidget);
    expect(find.text('Custom course code'), findsOneWidget);
  });
}
