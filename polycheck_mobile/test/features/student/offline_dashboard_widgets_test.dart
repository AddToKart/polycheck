import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/sync/readiness.dart';
import 'package:polycheck_mobile/src/features/student/data/offline_readiness.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/offline_readiness_chip.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/offline_sync_panel.dart';

import 'student_test_harness.dart';

class _StubPreparation extends OfflinePreparation {
  _StubPreparation(this._result)
    : super(
        database: AppDatabase.forTesting(NativeDatabase.memory()),
        subjectsApi: SubjectsApi(Dio()),
        sectionsApi: SectionsApi(Dio()),
        sessionsApi: SessionsApi(Dio()),
        attendanceApi: AttendanceApi(Dio()),
      );

  int prepareCalls = 0;
  final OfflinePreparationResult _result;

  @override
  Future<OfflinePreparationResult> prepareForOfflineClass(User user) async {
    prepareCalls += 1;
    return _result;
  }
}

class _RecordingSyncController extends SyncController {
  @override
  SyncActivity build() => const SyncActivity();

  @override
  Future<SyncDrainReport> retryOne(String clientReceiptId) async {
    retried.add(clientReceiptId);
    return const SyncDrainReport(attempted: 1, confirmed: 1, batches: 1);
  }

  @override
  Future<SyncDrainReport> drainNow() async {
    drains += 1;
    return const SyncDrainReport(attempted: 1, confirmed: 1, batches: 1);
  }

  static final List<String> retried = <String>[];
  static int drains = 0;
}

final OfflinePreparationResult _completeResult = OfflinePreparationResult(
  preparedAt: DateTime.utc(2026, 11, 10, 12),
  enrolledSectionIds: <String>['sec-1'],
  subjectsCached: 1,
  sectionsCached: 1,
  sessionsCached: 1,
  attendanceCached: 1,
  clockOffsetPresent: true,
  drainReport: null,
  failures: <OfflinePrepFailure>[],
);

void main() {
  testWidgets('readiness chip: ready pill uses the offline class copy', (
    tester,
  ) async {
    await pumpStudentScreen(
      tester,
      const Scaffold(body: OfflineReadinessChip()),
      overrides: <Override>[
        ...dashboardOverrides(
          sections: <Section>[testSection()],
          subjects: const <String, Subject>{},
          records: <AttendanceRecord>[],
          sessions: <Session>[],
          readiness: const OfflineReadiness(
            hasClassScheduleCached: true,
            hasEnrolledSections: true,
            hasTrustedClockOffset: true,
            hasVerifiableKeys: true,
          ),
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('offline-ready')), findsOneWidget);
    expect(find.text('READY FOR OFFLINE CLASS'), findsOneWidget);
  });

  testWidgets('readiness chip: prepare button runs the orchestrator and '
      'flips state after completion', (tester) async {
    final stub = _StubPreparation(_completeResult);
    var readinessIndex = 0;
    const readiness = <OfflineReadiness>[
      OfflineReadiness(
        hasClassScheduleCached: false,
        hasEnrolledSections: true,
        hasTrustedClockOffset: false,
        hasVerifiableKeys: false,
      ),
      OfflineReadiness(
        hasClassScheduleCached: true,
        hasEnrolledSections: true,
        hasTrustedClockOffset: true,
        hasVerifiableKeys: true,
      ),
    ];
    await pumpStudentScreen(
      tester,
      const Scaffold(body: OfflineReadinessChip()),
      overrides: <Override>[
        // Minimal wiring (dashboardOverrides would double-override the
        // readiness provider, and this test drives it dynamically).
        appDatabaseProvider.overrideWithValue(
          AppDatabase.forTesting(NativeDatabase.memory()),
        ),
        pendingScanCountProvider.overrideWith((ref) => Stream.value(0)),
        offlineReadinessProvider.overrideWith((ref) {
          final index = readinessIndex.clamp(0, readiness.length - 1);
          return Future<OfflineReadiness>.value(readiness[index]);
        }),
        offlinePreparationProvider.overrideWithValue(stub),
      ],
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('offline-readiness-prepare')),
      findsOneWidget,
    );
    readinessIndex = 1;
    await tester.tap(find.byKey(const ValueKey('offline-readiness-prepare')));
    await tester.pump(); // preparing spinner state
    expect(stub.prepareCalls, 1);
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('offline-ready')), findsOneWidget);
    expect(find.textContaining('Offline data is ready'), findsOneWidget);
  });

  testWidgets('sync panel: clean copy when everything is synced', (
    tester,
  ) async {
    await pumpStudentScreen(
      tester,
      const Scaffold(body: StudentOfflineSyncPanel()),
      overrides: <Override>[
        ...dashboardOverrides(
          sections: <Section>[testSection()],
          subjects: const <String, Subject>{},
          records: <AttendanceRecord>[],
          sessions: <Session>[],
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.text('All attendance evidence is synced.'), findsOneWidget);
    expect(find.text('Not synced yet'), findsOneWidget);
  });

  testWidgets('sync panel: failed rows render kind + error and Retry runs '
      'retryOne', (tester) async {
    await pumpStudentScreen(
      tester,
      const Scaffold(body: StudentOfflineSyncPanel()),
      overrides: <Override>[
        ...dashboardOverrides(
          sections: <Section>[testSection()],
          subjects: const <String, Subject>{},
          records: <AttendanceRecord>[],
          sessions: <Session>[],
          pending: 2,
          queueIssues: <OfflineAttendanceQueueRow>[
            queueIssueRow(
              receiptId: 'receipt-1',
              serverError: 'terminal: Attendance window has expired',
            ),
            queueIssueRow(
              receiptId: 'receipt-2',
              serverError: 'No connection. Saved check-ins will retry.',
            ),
            queueIssueRow(
              receiptId: 'receipt-3',
              status: AttendanceSyncStatus.disputedDuplicate,
              serverError: 'Already submitted for this session',
            ),
          ],
        ),
        syncControllerProvider.overrideWith(_RecordingSyncController.new),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('student-sync-now')), findsOneWidget);
    expect(
      find.textContaining('2 saved items waiting to sync'),
      findsOneWidget,
    );
    expect(find.textContaining('1 need attention'), findsNothing);
    expect(find.textContaining('2 need attention'), findsOneWidget);
    expect(find.textContaining('Check-in'), findsWidgets);
    expect(
      find.textContaining('Attendance window has expired'),
      findsOneWidget,
    );
    // Terminal rows stamp evidence; disputed duplicates show gold borders.
    expect(
      find.byKey(const ValueKey('offline-retry-receipt-1')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('offline-retry-receipt-2')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('offline-retry-receipt-3')), findsNothing);

    await tester.tap(find.byKey(const ValueKey('offline-retry-receipt-2')));
    await tester.pumpAndSettle();
    expect(_RecordingSyncController.retried, <String>['receipt-2']);
  });

  testWidgets('sync panel: Sync now drains through the queue controller', (
    tester,
  ) async {
    final mockDb = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(mockDb.close);
    await mockDb.writeLastSync('student-1', DateTime.utc(2026, 11, 10, 12, 34));
    await pumpStudentScreen(
      tester,
      const Scaffold(body: StudentOfflineSyncPanel()),
      overrides: <Override>[
        ...dashboardOverrides(
          sections: <Section>[testSection()],
          subjects: const <String, Subject>{},
          records: <AttendanceRecord>[],
          sessions: <Session>[],
          database: mockDb,
          extra: <Override>[
            syncControllerProvider.overrideWith(_RecordingSyncController.new),
          ],
        ),
      ],
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('Last sync'), findsOneWidget);
    expect(_RecordingSyncController.drains, 0);

    await tester.tap(find.byKey(const ValueKey('student-sync-now')));
    await tester.pumpAndSettle();

    expect(_RecordingSyncController.drains, 1);
    expect(find.textContaining('1 check-in synced'), findsOneWidget);
  });

  testWidgets('sync panel: synced-but-flagged rows render distinctly with no '
      'Retry', (tester) async {
    await pumpStudentScreen(
      tester,
      const Scaffold(body: StudentOfflineSyncPanel()),
      overrides: <Override>[
        ...dashboardOverrides(
          sections: <Section>[testSection()],
          subjects: const <String, Subject>{},
          records: <AttendanceRecord>[],
          sessions: <Session>[],
          pending: 1,
          queueIssues: <OfflineAttendanceQueueRow>[
            queueIssueRow(
              receiptId: 'receipt-4',
              status: AttendanceSyncStatus.confirmedFlagged,
              serverError: 'flagged: delayed_offline_sync',
            ),
            queueIssueRow(
              receiptId: 'receipt-5',
              serverError: 'terminal: Attendance window has expired',
            ),
          ],
        ),
        syncControllerProvider.overrideWith(_RecordingSyncController.new),
      ],
    );
    await tester.pumpAndSettle();

    // A flagged receipt is synced, so it never counts as needing attention.
    expect(find.textContaining('1 need attention'), findsOneWidget);
    expect(
      find.textContaining(
        'flagged for instructor review (delayed offline '
        'sync)',
      ),
      findsOneWidget,
    );
    // Distinct gold-rail confirmation marker.
    expect(
      find.byKey(const ValueKey('offline-flagged-receipt-4')),
      findsOneWidget,
    );
    // Never a failure affordance.
    expect(find.byKey(const ValueKey('offline-retry-receipt-4')), findsNothing);
    // Actual failures keep their Retry.
    expect(
      find.byKey(const ValueKey('offline-retry-receipt-5')),
      findsOneWidget,
    );
  });

  test('flagged receipts map to confirmations, not retryable issues', () {
    final issues = offlineSyncIssuesFromRows(<OfflineAttendanceQueueRow>[
      queueIssueRow(
        receiptId: 'receipt-4',
        status: AttendanceSyncStatus.confirmedFlagged,
        serverError: 'flagged: delayed_offline_sync',
      ),
      queueIssueRow(
        receiptId: 'receipt-3',
        status: AttendanceSyncStatus.disputedDuplicate,
        serverError: 'Already submitted for this session',
      ),
      queueIssueRow(
        receiptId: 'receipt-1',
        serverError: 'terminal: Attendance window has expired',
      ),
    ]);

    expect(issues[0].flagged, isTrue);
    expect(issues[0].disputed, isFalse);
    expect(issues[0].needsRetry, isFalse);
    expect(
      issues[0].error,
      'Synced · flagged for instructor review (delayed offline sync)',
    );
    expect(issues[1].needsRetry, isFalse);
    expect(issues[2].needsRetry, isTrue);

    // A flagged receipt without a server reason keeps the generic copy.
    final noReason = offlineSyncIssuesFromRows(<OfflineAttendanceQueueRow>[
      queueIssueRow(
        receiptId: 'receipt-6',
        status: AttendanceSyncStatus.confirmedFlagged,
        serverError: 'flagged: disputed',
      ),
    ]).single;
    expect(noReason.error, 'Synced · flagged for instructor review');
  });

  test('the issue stream includes synced-but-flagged receipts', () async {
    final database = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(database.close);
    for (final receiptId in <String>['receipt-4', 'receipt-5']) {
      await database.enqueueAttendanceScan(
        clientReceiptId: receiptId,
        userId: 'student-1',
        sessionId: 'sess-1',
        studentId: 'student-1',
        scannedToken: 'token',
        inputChannel: 'camera',
        scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
      );
    }
    // A receipt-reconciled dispute (synced, never re-queued) is an issue the
    // panel must show; a plain confirmation is not.
    await database.markQueueConfirmed(
      'receipt-4',
      flagged: true,
      serverError: 'flagged: delayed_offline_sync',
    );
    await database.markQueueConfirmed('receipt-5');

    final rows = await watchOfflineQueueIssues(database, 'student-1').first;

    expect(rows.map((row) => row.clientReceiptId), <String>['receipt-4']);
    expect(rows.single.syncStatus, AttendanceSyncStatus.confirmedFlagged);
    expect(
      offlineSyncIssuesFromRows(rows).single.error,
      'Synced · flagged for instructor review (delayed offline sync)',
    );
  });

  test('pending sentence adds the RN instructor-review emphasis (§4.5)', () {
    expect(pendingSentence(0, 0), 'All attendance evidence is synced.');
    expect(pendingSentence(1, 0), contains('1 saved item waiting to sync.'));
    expect(
      pendingSentence(1, 0),
      contains('Confirmation may require instructor review.'),
    );
    expect(
      pendingSentence(2, 1),
      contains(
        '2 saved items waiting to sync. Confirmation may require '
        'instructor review. 1 need attention.',
      ),
    );
  });
}
