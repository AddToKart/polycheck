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

/// FLF-03: manual token entry is a fallback channel and must obey
/// `shouldShowScanFallbacks(mode)` exactly like image upload — otherwise a
/// pasted in-person token bypasses the production opt-in pin.
class _RecordingScanService extends StudentScanService {
  _RecordingScanService(AppDatabase database)
    : super(
        attendanceApi: AttendanceApi(Dio()),
        sessionsApi: SessionsApi(Dio()),
        database: database,
        trustedClock: const TrustedClock(),
        locationReader: const _NeverLocationReader(),
        deviceId: () async => 'mobile-test-device',
        deviceNow: () => DateTime.utc(2026, 11, 10, 8),
      );

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
    return const StudentScanOutcome(
      kind: ScanOutcomeKind.success,
      title: 'ATTENDANCE VERIFIED',
      message: 'Attendance recorded as present.',
      status: AttendanceStatus.present,
    );
  }
}

class _NeverLocationReader implements ScanLocationReader {
  const _NeverLocationReader();

  @override
  Future<ScanLocation> current() async => throw StateError('not used');
}

String _tokenFor(SessionMode mode) {
  return createQRTokenData(
    'sess-1',
    'sec-1',
    'teacher-1',
    'Prof. Cruz',
    5,
    15,
    issuedAtMs: DateTime.utc(2026, 11, 10, 8).millisecondsSinceEpoch,
    extras: QRTokenExtras(mode: mode),
  );
}

Future<_RecordingScanService> _pumpScanner(WidgetTester tester) async {
  final database = createTestDatabase();
  addTearDown(database.close);
  final service = _RecordingScanService(database);

  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sessionProvider.overrideWith(() => FakeSessionController(studentUser)),
        studentScanServiceProvider.overrideWithValue(service),
      ],
      child: MaterialApp(
        theme: BrandTheme.light,
        home: const StudentScanScreen(),
      ),
    ),
  );
  await tester.pump();
  return service;
}

Future<void> _submitManual(WidgetTester tester, String token) async {
  await tester.tap(find.byKey(const ValueKey('scan-manual-open')));
  await tester.pumpAndSettle();
  await tester.enterText(
    find.byKey(const ValueKey('scan-manual-input')),
    token,
  );
  await tester.pump();
  await tester.tap(
    find.descendant(
      of: find.byType(AlertDialog),
      matching: find.byType(CampusButton),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _dismissResult(WidgetTester tester) async {
  await tester.tap(find.byTooltip('Dismiss result'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('an in-person token is refused when fallbacks are off (FLF-03)', (
    tester,
  ) async {
    final service = await _pumpScanner(tester);

    await _submitManual(tester, _tokenFor(SessionMode.inPerson));

    expect(find.text('MANUAL ENTRY DISABLED'), findsOneWidget);
    expect(service.calls, 0, reason: 'the scanner never submits it');

    await _dismissResult(tester);
  });

  testWidgets('an online token is always allowed through manual entry', (
    tester,
  ) async {
    final service = await _pumpScanner(tester);

    await _submitManual(tester, _tokenFor(SessionMode.online));

    expect(service.calls, 1);
    expect(find.text('ATTENDANCE VERIFIED'), findsOneWidget);

    await _dismissResult(tester);
  });

  testWidgets('an unparseable paste still reaches the pipeline for a verdict', (
    tester,
  ) async {
    final service = await _pumpScanner(tester);

    await _submitManual(tester, 'not-a-token');

    // The policy gate keys on a decoded payload; a garbage token is left to
    // the service, which owns the "not a PolyCheck token" copy.
    expect(service.calls, 1);
    expect(find.text('MANUAL ENTRY DISABLED'), findsNothing);

    await _dismissResult(tester);
  });
}
