import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/device_integrity.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/core/providers/device_now.dart';
import 'package:polycheck_mobile/src/core/providers/maintenance_provider.dart';
import 'package:polycheck_mobile/src/core/providers/trusted_clock.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/core/widgets/campus_button.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/student_login_screen.dart';

import '../../helpers/auth_harness.dart';

void main() {
  Future<AppDatabase> pumpLogin(
    WidgetTester tester,
    FakeSessionApi api, {
    required DateTime Function() now,
  }) async {
    final database = createTestDatabase();
    addTearDown(database.close);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionApiProvider.overrideWithValue(api),
          tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
          deviceIdentityProvider.overrideWithValue(TestDeviceIdentity()),
          appDatabaseProvider.overrideWithValue(database),
          maintenanceProvider.overrideWith(
            () => FakeMaintenanceController(const MaintenanceState()),
          ),
          trustedClockProvider.overrideWith(
            () => FakeTrustedClock(const TrustedClock()),
          ),
          deviceNowProvider.overrideWithValue(now),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const StudentLoginScreen(),
        ),
      ),
    );
    await tester.pump();
    return database;
  }

  Future<void> fillCredentials(WidgetTester tester) async {
    await tester.enterText(find.byType(TextField).at(0), '2024-00123-MN-0');
    await tester.enterText(find.byType(TextField).at(1), 'ValidPassw0rd!');
  }

  testWidgets('validates the required fields before calling the API', (
    tester,
  ) async {
    var called = false;
    final api = FakeSessionApi(
      onLoginStudent: (studentId, password, deviceId) async {
        called = true;
        throw UnimplementedError();
      },
    );
    await pumpLogin(tester, api, now: DateTime.now);

    await tester.tap(find.widgetWithText(CampusButton, 'Sign in'));
    await tester.pump();

    expect(find.text('Enter your student number.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);
    expect(called, isFalse);
  });

  testWidgets('active_session_elsewhere renders the device explainer', (
    tester,
  ) async {
    final api = FakeSessionApi(
      onLoginStudent: (studentId, password, deviceId) async {
        throw const ApiRequestError(
          message: 'This account is already signed in on another device.',
          status: 403,
          code: 'active_session_elsewhere',
          activeDeviceKind: ActiveDeviceKind.web,
        );
      },
    );
    await pumpLogin(tester, api, now: DateTime.now);

    await fillCredentials(tester);
    await tester.tap(find.widgetWithText(CampusButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Already signed in elsewhere'), findsOneWidget);
    expect(find.textContaining('the web browser'), findsOneWidget);
    expect(find.textContaining('Emergency Device Release'), findsWidgets);
  });

  testWidgets('device_cooldown_active ticks with the trusted clock and unlocks '
      'retry at zero', (tester) async {
    var now = DateTime.utc(2026, 11, 10, 8);
    final api = FakeSessionApi(
      onLoginStudent: (studentId, password, deviceId) async {
        throw const ApiRequestError(
          message: 'This device is cooling down.',
          status: 403,
          code: 'device_cooldown_active',
          remainingSeconds: 125,
        );
      },
    );
    await pumpLogin(tester, api, now: () => now);

    await fillCredentials(tester);
    await tester.tap(find.widgetWithText(CampusButton, 'Sign in'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(find.text('Device change cooling down'), findsOneWidget);
    expect(find.text('2:05'), findsOneWidget);

    now = now.add(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('2:04'), findsOneWidget);

    now = now.add(const Duration(seconds: 124));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('0:00'), findsOneWidget);
    expect(
      find.text('Cooldown complete. You can try again now.'),
      findsOneWidget,
    );

    final retry = tester.widget<CampusButton>(
      find.widgetWithText(CampusButton, 'Try again'),
    );
    expect(retry.onPressed, isNotNull);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('cooldown falls back to remainingMinutes when seconds are '
      'omitted', (tester) async {
    var now = DateTime.utc(2026, 11, 10, 8);
    final api = FakeSessionApi(
      onLoginStudent: (studentId, password, deviceId) async {
        throw const ApiRequestError(
          message: 'This device is cooling down.',
          status: 403,
          code: 'device_cooldown_active',
          remainingMinutes: 2,
        );
      },
    );
    await pumpLogin(tester, api, now: () => now);

    await fillCredentials(tester);
    await tester.tap(find.widgetWithText(CampusButton, 'Sign in'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));

    expect(find.text('2:00'), findsOneWidget);

    now = now.add(const Duration(minutes: 2));
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('0:00'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('invalid credentials render inline under the form', (
    tester,
  ) async {
    final api = FakeSessionApi(
      onLoginStudent: (studentId, password, deviceId) async {
        throw const ApiRequestError(
          message: 'Invalid student ID or password',
          status: 401,
        );
      },
    );
    await pumpLogin(tester, api, now: DateTime.now);

    await fillCredentials(tester);
    await tester.tap(find.widgetWithText(CampusButton, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Invalid student ID or password.'), findsOneWidget);
    expect(find.text('Student number'), findsOneWidget);
  });
}
