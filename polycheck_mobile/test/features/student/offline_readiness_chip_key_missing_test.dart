import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/sync/readiness.dart';
import 'package:polycheck_mobile/src/features/student/data/offline_readiness.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/offline_readiness_chip.dart';

import 'student_test_harness.dart';

/// SW-6: schedule coverage without cached teacher keys must not claim READY.
class _StubPreparation extends OfflinePreparation {
  _StubPreparation(OfflinePreparationResult result)
    : _result = result,
      super(
        database: AppDatabase.forTesting(NativeDatabase.memory()),
        subjectsApi: SubjectsApi(Dio()),
        sectionsApi: SectionsApi(Dio()),
        sessionsApi: SessionsApi(Dio()),
        attendanceApi: AttendanceApi(Dio()),
      );

  final OfflinePreparationResult _result;
  int calls = 0;

  @override
  Future<OfflinePreparationResult> prepareForOfflineClass(User user) async {
    calls += 1;
    return _result;
  }
}

final OfflinePreparationResult _keylessResult = OfflinePreparationResult(
  preparedAt: DateTime.utc(2026, 11, 10, 12),
  enrolledSectionIds: const <String>['sec-1'],
  subjectsCached: 1,
  sectionsCached: 1,
  sessionsCached: 1,
  attendanceCached: 1,
  clockOffsetPresent: true,
  drainReport: null,
  failures: const <OfflinePrepFailure>[
    OfflinePrepFailure(
      OfflinePrepStep.teacherKey,
      ApiRequestError(
        message:
            '1 class(es) in the next two days have no offline '
            'verification key. Reconnect and prepare again.',
        status: 0,
      ),
    ),
  ],
);

void main() {
  const keyMissing = OfflineReadiness(
    hasClassScheduleCached: true,
    hasEnrolledSections: true,
    hasTrustedClockOffset: true,
    hasVerifiableKeys: false,
  );

  testWidgets('key coverage gap renders KEY MISSING instead of READY', (
    tester,
  ) async {
    final stub = _StubPreparation(_keylessResult);
    await pumpStudentScreen(
      tester,
      const Scaffold(body: OfflineReadinessChip()),
      overrides: <Override>[
        offlineReadinessProvider.overrideWith(
          (ref) => Future<OfflineReadiness>.value(keyMissing),
        ),
        offlinePreparationProvider.overrideWithValue(stub),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('offline-ready')), findsNothing);
    expect(find.byKey(const ValueKey('offline-key-missing')), findsOneWidget);
    expect(find.text('KEY MISSING — PREPARE ONLINE AGAIN'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('offline-key-missing-prepare')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('offline-readiness-prepare')),
      findsNothing,
      reason:
          'the specific key gap owns the prepare action, not the generic one',
    );

    await tester.tap(find.byKey(const ValueKey('offline-key-missing-prepare')));
    await tester.pumpAndSettle();
    expect(stub.calls, 1);
    expect(
      find.textContaining('no offline verification key'),
      findsOneWidget,
      reason: 'the prepare toast names the teacher_key failure',
    );
  });
}
