import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/api/session_api.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/router/routes/app_routes.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/core/widgets/campus_button.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/forgot_password_screen.dart';

import '../../helpers/auth_harness.dart';

void main() {
  Future<void> pumpForgot(WidgetTester tester, FakeSessionApi api) async {
    final router = GoRouter(
      initialLocation: AppRoutes.forgotPassword,
      routes: [
        GoRoute(
          path: AppRoutes.forgotPassword,
          builder: (context, state) => const ForgotPasswordScreen(),
        ),
        GoRoute(
          path: AppRoutes.studentLogin,
          builder: (context, state) =>
              const Scaffold(body: Text('student login page')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [sessionApiProvider.overrideWithValue(api)],
        child: MaterialApp.router(
          theme: BrandTheme.light,
          routerConfig: router,
        ),
      ),
    );
    await tester.pump();
  }

  Future<void> submit(WidgetTester tester, String studentId) async {
    await tester.enterText(find.byType(TextField), studentId);
    await tester.tap(find.widgetWithText(CampusButton, 'Send reset link'));
    await tester.pumpAndSettle();
  }

  testWidgets('a bound email sends the normalized number and says to check '
      'the email', (tester) async {
    String? sent;
    final api = FakeSessionApi(
      onRequestPasswordReset: (studentId) async {
        sent = studentId;
        return PasswordResetDelivery.email;
      },
    );
    await pumpForgot(tester, api);

    await submit(tester, ' 2024-00123-mn-0 ');

    expect(sent, '2024-00123-MN-0');
    expect(find.text('Check your email'), findsOneWidget);
    expect(find.textContaining('email on your profile'), findsOneWidget);
    expect(find.textContaining('choose a new password'), findsWidgets);
  });

  testWidgets('no bound email points the student at the instructor reset', (
    tester,
  ) async {
    final api = FakeSessionApi(
      onRequestPasswordReset: (studentId) async =>
          PasswordResetDelivery.unavailable,
    );
    await pumpForgot(tester, api);

    await submit(tester, '2024-00123-MN-0');

    expect(find.text('No email on file'), findsOneWidget);
    expect(find.textContaining('Ask your instructor'), findsOneWidget);
    expect(find.textContaining('temporary password'), findsOneWidget);
  });

  testWidgets('a malformed number is rejected before any request', (
    tester,
  ) async {
    var called = false;
    final api = FakeSessionApi(
      onRequestPasswordReset: (studentId) async {
        called = true;
        return PasswordResetDelivery.email;
      },
    );
    await pumpForgot(tester, api);

    await submit(tester, 'not-a-number');

    expect(find.textContaining('exactly as shown on your ID'), findsOneWidget);
    expect(called, isFalse);
  });

  testWidgets('rate limiting and network failures show a retryable message', (
    tester,
  ) async {
    var calls = 0;
    final api = FakeSessionApi(
      onRequestPasswordReset: (studentId) async {
        calls += 1;
        if (calls == 1) {
          throw const ApiRequestError(
            message: 'slow down',
            status: 429,
            code: 'password_reset_rate_limited',
          );
        }
        throw const ApiRequestError(message: 'offline', status: 0);
      },
    );
    await pumpForgot(tester, api);

    await submit(tester, '2024-00123-MN-0');
    expect(find.textContaining('wait a few minutes'), findsOneWidget);

    await tester.tap(find.widgetWithText(CampusButton, 'Send reset link'));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Cannot reach the PolyCheck server'),
      findsOneWidget,
    );
  });

  testWidgets('the unavailable result lets the student try another number and '
      'return to sign in', (tester) async {
    final api = FakeSessionApi(
      onRequestPasswordReset: (studentId) async =>
          PasswordResetDelivery.unavailable,
    );
    await pumpForgot(tester, api);
    await submit(tester, '2024-00123-MN-0');

    await tester.tap(find.widgetWithText(CampusButton, 'Try another number'));
    await tester.pumpAndSettle();
    expect(find.text('Forgot your password?'), findsOneWidget);

    await tester.tap(find.text('Back to sign in'));
    await tester.pumpAndSettle();
    expect(find.text('student login page'), findsOneWidget);
  });
}
