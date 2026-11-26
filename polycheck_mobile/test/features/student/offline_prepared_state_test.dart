import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/sync/readiness.dart';
import 'package:polycheck_mobile/src/features/student/data/offline_readiness.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/offline_readiness_chip.dart';

import 'student_test_harness.dart';

/// A student with no class cached for today/tomorrow can never satisfy the
/// schedule-based readiness rule, so a clean preparation must still read as
/// ready (and leave nothing to press) for the rest of that day.
const _noUpcomingClass = OfflineReadiness(
  hasClassScheduleCached: false,
  hasEnrolledSections: true,
  hasTrustedClockOffset: true,
  hasVerifiableKeys: true,
);

void main() {
  group('isOfflinePreparationCurrent', () {
    final now = DateTime(2026, 11, 26, 15, 30);

    test('is current for the rest of the day it ran', () {
      expect(
        isOfflinePreparationCurrent(DateTime(2026, 11, 26, 0, 5), now),
        isTrue,
      );
    });

    test('goes stale the next day and is never current without a stamp', () {
      expect(
        isOfflinePreparationCurrent(DateTime(2026, 11, 25, 23, 59), now),
        isFalse,
      );
      expect(isOfflinePreparationCurrent(null, now), isFalse);
    });
  });

  Future<void> pumpChip(WidgetTester tester, DateTime? preparedOkAt) async {
    await pumpStudentScreen(
      tester,
      const Scaffold(body: OfflineReadinessChip()),
      overrides: <Override>[
        offlineReadinessProvider.overrideWith(
          (ref) => Future<OfflineReadiness>.value(_noUpcomingClass),
        ),
        offlinePreparedOkAtProvider.overrideWith(
          (ref) => Future<DateTime?>.value(preparedOkAt),
        ),
      ],
    );
    await tester.pumpAndSettle();
  }

  testWidgets('after a clean preparation today it says ready and offers no '
      'button', (tester) async {
    // The harness reads the real device clock, so "today" is relative to now.
    await pumpChip(tester, DateTime.now());

    expect(find.text('READY FOR OFFLINE CLASS'), findsOneWidget);
    expect(find.text('Prepare for offline class'), findsNothing);
    expect(find.byType(OutlinedButton), findsNothing);
  });

  testWidgets('offers to prepare again once the preparation is from an earlier '
      'day', (tester) async {
    await pumpChip(tester, DateTime.now().subtract(const Duration(days: 1)));

    expect(find.text('Prepare for offline class'), findsOneWidget);
    expect(find.text('READY FOR OFFLINE CLASS'), findsNothing);
  });

  testWidgets('offers to prepare when it has never prepared', (tester) async {
    await pumpChip(tester, null);

    expect(find.text('Prepare for offline class'), findsOneWidget);
  });
}
