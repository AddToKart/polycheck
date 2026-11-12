import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:polycheck_mobile/main.dart';
import 'package:polycheck_mobile/src/core/network/secure_token_store.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/student_login_screen.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/student_dashboard_screen.dart';

import 'support/fixtures.dart';
import 'support/harness.dart';

/// Boots the real app (real router, real auth gate, real Dio, real Drift cache)
/// and signs a fixture student in through the actual login portal.
///
/// This is the only spec that drives widgets: it proves the router/auth gate
/// works end to end — the app lands on the portal, the student portal leads to
/// the student login form, a successful login redirects to the student
/// dashboard, and the dashboard renders the signed-in student's own record.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late AttendanceFixture fixture;

  setUpAll(() async {
    fixture = await AttendanceFixture.create();
  });

  tearDownAll(() async {
    await fixture.dispose();
  });

  setUp(() async {
    // Accept the RA 10173 notice for the fixture student up front. The consent
    // overlay sits above every authenticated route, and *this* spec is about the
    // router/auth gate, not the consent flow. Re-using the app's own session
    // controller also leaves the device binding on this installation, so the
    // UI login that follows is the same device re-authenticating.
    // `AppHarness.boot` also clears the persisted bearer token first.
    final preflight = await AppHarness.boot();
    try {
      await preflight.signInStudent(
        studentId: fixture.studentId,
        password: fixture.studentPassword,
      );
      await preflight.acceptPrivacyNotice();
    } finally {
      await preflight.dispose();
    }
    // The app under test must boot signed out so the portal renders.
    await SecureTokenStore().clear();
  });

  testWidgets('a fixture student signs in from the portal and lands on the '
      'dashboard', (tester) async {
    // `bootstrap: false` is the app's own documented test seam
    // (`main.dart`): it skips `SyncLifecycleBinder` and `_BootLifecycle`, i.e.
    // the realtime replacement socket plus the 5-minute clock/drain timers that
    // would otherwise still be live when `testWidgets` unmounts the tree. The
    // router, auth gate, session controller, Dio client, consent gate and every
    // screen stay exactly as shipped.
    await tester.pumpWidget(
      ProviderScope(child: const PolycheckApp(bootstrap: false)),
    );

    // ── Portal → student login ───────────────────────────────────────────
    await _pumpUntil(tester, find.text('Student'));
    expect(find.text('Student'), findsOneWidget);
    await tester.tap(find.text('Student'));
    await _pumpUntil(tester, find.byType(StudentLoginScreen));

    // ── Sign in through the real form ────────────────────────────────────
    final fields = find.byType(TextField);
    expect(
      fields,
      findsNWidgets(2),
      reason:
          'the student login form renders a student-number and a '
          'password field',
    );
    await tester.enterText(fields.at(0), fixture.studentId);
    await tester.enterText(fields.at(1), fixture.studentPassword);
    await tester.pump();

    await tester.tap(find.text('Sign in'));
    await _pumpUntil(
      tester,
      find.byType(StudentDashboardScreen),
      timeout: const Duration(seconds: 45),
    );

    // ── The dashboard is the authenticated shell, showing this student ───
    expect(find.byType(StudentDashboardScreen), findsOneWidget);
    expect(
      find.byKey(const ValueKey('student-scan-action')),
      findsOneWidget,
      reason: 'the dashboard quick actions only render for a signed-in student',
    );
    expect(
      find.text(fixture.studentId),
      findsWidgets,
      reason: 'the credential card must show the signed-in student number',
    );
    expect(find.byType(StudentLoginScreen), findsNothing);

    // Tear the graph down inside the test so the ProviderScope disposes (and
    // cancels every provider timer / closes the Drift handle) before the
    // framework's end-of-test pending-work check.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });
}

/// Pumps until [finder] matches, with a hard deadline.
///
/// The live integration binding uses real timers, and the screen under test is
/// driven by real network futures, so `pumpAndSettle` is the wrong tool.
Future<void> _pumpUntil(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 100));
    if (finder.evaluate().isNotEmpty) return;
  }
  throw StateError('Timed out after $timeout waiting for: $finder');
}
