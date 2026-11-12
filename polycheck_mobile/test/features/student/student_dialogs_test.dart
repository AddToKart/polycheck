import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/presentation/enrollment/enrollment_code_dialog.dart';
import 'package:polycheck_mobile/src/features/student/presentation/history/student_dispute_dialog.dart';
import 'package:polycheck_mobile/src/features/student/presentation/history/student_excuse_dialog.dart';

class FakeSectionsApi extends SectionsApi {
  FakeSectionsApi({this.onEnrollByCode}) : super(Dio());

  final Future<Enrollment> Function(String code)? onEnrollByCode;

  @override
  Future<Enrollment> enrollByCode(String enrollmentCode) {
    final handler = onEnrollByCode;
    if (handler == null) {
      throw UnimplementedError('enrollByCode not configured');
    }
    return handler(enrollmentCode);
  }
}

Future<void> pumpDialog(WidgetTester tester, Widget dialog) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: PupTheme.light,
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () =>
                  showDialog<void>(context: context, builder: (_) => dialog),
              child: const Text('open dialog'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open dialog'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('dispute submit stays blocked until a reason and 10 characters', (
    tester,
  ) async {
    DisputeReason? submittedReason;
    String? submittedDescription;
    var calls = 0;
    await pumpDialog(
      tester,
      StudentDisputeDialog(
        onSubmit: (reason, description) async {
          calls += 1;
          submittedReason = reason;
          submittedDescription = description;
          return null;
        },
      ),
    );

    await tester.enterText(
      find.byKey(const ValueKey('dispute-description')),
      'short',
    );
    await tester.pump();

    CampusButton submit() => tester.widget<CampusButton>(
      find.byKey(const ValueKey('dispute-submit')),
    );
    expect(submit().onPressed, isNull);

    tester
        .widget<DropdownButton<DisputeReason>>(
          find.byKey(const ValueKey('dispute-reason')),
        )
        .onChanged!(DisputeReason.outsideGeofence);
    await tester.pump();
    expect(submit().onPressed, isNull);

    await tester.enterText(
      find.byKey(const ValueKey('dispute-description')),
      'I was inside the room during the whole class.',
    );
    await tester.pump();
    expect(submit().onPressed, isNotNull);

    await tester.tap(find.byKey(const ValueKey('dispute-submit')));
    await tester.pumpAndSettle();

    expect(calls, 1);
    expect(submittedReason, DisputeReason.outsideGeofence);
    expect(submittedDescription, contains('inside the room'));
    expect(find.text('Report sent'), findsOneWidget);
  });

  testWidgets('dispute typed API errors render inline', (tester) async {
    await pumpDialog(
      tester,
      StudentDisputeDialog(
        onSubmit: (reason, description) async {
          return 'The dispute window has closed.';
        },
      ),
    );

    tester
        .widget<DropdownButton<DisputeReason>>(
          find.byKey(const ValueKey('dispute-reason')),
        )
        .onChanged!(DisputeReason.other);
    await tester.pump();
    await tester.enterText(
      find.byKey(const ValueKey('dispute-description')),
      'This record needs to be reviewed by my instructor.',
    );
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('dispute-submit')));
    await tester.pumpAndSettle();

    expect(find.text('The dispute window has closed.'), findsOneWidget);
    expect(find.text('Report sent'), findsNothing);
  });

  testWidgets('excuse form validates the description and submits', (
    tester,
  ) async {
    ExcuseReason? submittedReason;
    String? submittedDescription;
    await pumpDialog(
      tester,
      StudentExcuseDialog(
        onSubmit: (reason, description, evidence) async {
          submittedReason = reason;
          submittedDescription = description;
          return null;
        },
      ),
    );

    await tester.tap(find.byKey(const ValueKey('excuse-reason-medical')));
    await tester.pump();
    await tester.enterText(
      find.byKey(const ValueKey('excuse-description')),
      'short',
    );
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('excuse-submit')));
    await tester.pumpAndSettle();
    expect(
      find.text('Describe the reason in at least 10 characters.'),
      findsOneWidget,
    );

    await tester.enterText(
      find.byKey(const ValueKey('excuse-description')),
      'I was confined at the clinic for the entire class.',
    );
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('excuse-submit')));
    await tester.pumpAndSettle();

    expect(submittedReason, ExcuseReason.medical);
    expect(submittedDescription, contains('clinic'));
    expect(find.text('Excuse requested'), findsOneWidget);
  });

  testWidgets('enrollment code validates and redeems', (tester) async {
    final api = FakeSectionsApi(
      onEnrollByCode: (code) async {
        expect(code, 'ABC123');
        return const Enrollment(
          id: 'enr-1',
          studentId: 'student-1',
          sectionId: 'sec-1',
        );
      },
    );
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sectionsApiProvider.overrideWithValue(api),
          studentSectionsProvider.overrideWith(
            (ref) => Stream.value(const <Section>[]),
          ),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: Scaffold(
            body: Builder(
              builder: (context) => Center(
                child: TextButton(
                  onPressed: () => showDialog<void>(
                    context: context,
                    builder: (_) => const EnrollmentCodeDialog(),
                  ),
                  child: const Text('open dialog'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open dialog'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('enrollment-code-input')),
      'AB',
    );
    await tester.tap(find.text('Redeem code'));
    await tester.pump();
    expect(
      find.text('Enrollment codes are 6–8 letters or numbers.'),
      findsOneWidget,
    );

    await tester.enterText(
      find.byKey(const ValueKey('enrollment-code-input')),
      'abc123',
    );
    await tester.tap(find.text('Redeem code'));
    await tester.pumpAndSettle();
    expect(find.text('Enrollment complete'), findsOneWidget);
    expect(find.textContaining('Enrolled in section'), findsOneWidget);
  });
}
