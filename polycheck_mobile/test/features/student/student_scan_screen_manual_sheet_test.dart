import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_scan_service.dart';
import 'package:polycheck_mobile/src/features/student/presentation/scan/student_scan_screen.dart';

import '../../helpers/auth_harness.dart';
import 'student_test_harness.dart';

/// Scripted service: records the token and returns a fixed outcome. The real
/// pipeline is covered by `student_scan_service_test.dart`; this suite owns the
/// widget teardown of the manual-entry sheet (SW-4 regression).
class _FakeScanService extends StudentScanService {
  _FakeScanService(AppDatabase database, {required this.outcome})
    : super(
        attendanceApi: AttendanceApi(Dio()),
        sessionsApi: SessionsApi(Dio()),
        database: database,
        trustedClock: const TrustedClock(),
        locationReader: const _NeverLocationReader(),
        deviceId: () async => 'mobile-test-device',
        deviceNow: () => DateTime.utc(2026, 11, 10, 8),
      );

  final StudentScanOutcome outcome;
  int calls = 0;
  String? lastToken;

  @override
  Future<StudentScanOutcome> submitToken({
    required String rawToken,
    required User student,
    required ScanInputChannel channel,
    String? pin,
  }) async {
    calls += 1;
    lastToken = rawToken;
    return outcome;
  }
}

class _NeverLocationReader implements ScanLocationReader {
  const _NeverLocationReader();

  @override
  Future<ScanLocation> current() async => throw StateError('not used');
}

const StudentScanOutcome _presentOutcome = StudentScanOutcome(
  kind: ScanOutcomeKind.success,
  title: 'ATTENDANCE VERIFIED',
  message: 'Attendance recorded as present.',
  status: AttendanceStatus.present,
);

void main() {
  testWidgets(
    'manual token entry survives the dialog exit transition and renders the '
    'outcome with zero framework exceptions',
    (tester) async {
      final database = createTestDatabase();
      addTearDown(database.close);
      final service = _FakeScanService(database, outcome: _presentOutcome);

      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        ProviderScope(
          overrides: <Override>[
            sessionProvider.overrideWith(
              () => FakeSessionController(studentUser),
            ),
            studentScanServiceProvider.overrideWithValue(service),
          ],
          child: MaterialApp(
            theme: PupTheme.light,
            home: const StudentScanScreen(),
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.byKey(const ValueKey('scan-manual-open')));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('scan-manual-input')), findsOneWidget);

      await tester.enterText(
        find.byKey(const ValueKey('scan-manual-input')),
        'header.payload',
      );
      await tester.pump();

      // The confirm button is the dialog's only CampusButton - label-agnostic
      // so this test outlives the SW-5 copy change.
      await tester.tap(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.byType(CampusButton),
        ),
      );
      await tester.pumpAndSettle();

      final exception = tester.takeException();
      expect(
        exception,
        isNull,
        reason:
            'the dialog owns its controller; disposing it while the exit '
            'transition is still mounted used to trip the framework assert',
      );
      expect(service.calls, 1);
      expect(service.lastToken, 'header.payload');
      expect(find.byKey(const ValueKey('scan-result')), findsOneWidget);
      expect(find.text('ATTENDANCE VERIFIED'), findsOneWidget);

      // Cancel the result auto-dismiss timer before the tree is torn down.
      await tester.tap(find.byTooltip('Dismiss result'));
      await tester.pumpAndSettle();
    },
  );

  testWidgets('manual entry confirm uses the check-in token copy', (
    tester,
  ) async {
    final database = createTestDatabase();
    addTearDown(database.close);
    final service = _FakeScanService(database, outcome: _presentOutcome);

    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sessionProvider.overrideWith(
            () => FakeSessionController(studentUser),
          ),
          studentScanServiceProvider.overrideWithValue(service),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const StudentScanScreen(),
        ),
      ),
    );
    await tester.pump();

    await tester.tap(find.byKey(const ValueKey('scan-manual-open')));
    await tester.pumpAndSettle();

    expect(find.text('SUBMIT CHECK-IN TOKEN'), findsOneWidget);
    expect(find.text('Verify & check in'), findsNothing);
  });
}
