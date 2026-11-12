import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/core/providers/maintenance_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/core/widgets/campus_button.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/faculty_login_screen.dart';
import 'package:polycheck_mobile/src/features/auth/presentation/student_login_screen.dart';

import '../../helpers/auth_harness.dart';

/// FX4 (FIX6): the device-integrity gate is a **student-only** UX. Staff keep
/// concurrent devices, never see a cooldown/active-session panel, and the
/// session-replacement monitor only reacts to revocation socket events.
void main() {
  Future<void> pumpFacultyLogin(WidgetTester tester, FakeSessionApi api) async {
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
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const FacultyLoginScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> submitFacultyCredentials(WidgetTester tester) async {
    await tester.enterText(
      find.byType(TextField).at(0),
      'juan.delacruz@pup.edu.ph',
    );
    await tester.enterText(find.byType(TextField).at(1), 'ValidPassw0rd!');
    await tester.tap(find.widgetWithText(CampusButton, 'Sign in'));
    await tester.pumpAndSettle();
  }

  void expectNoDeviceGate() {
    expect(find.text('DEVICE CHECK'), findsNothing);
    expect(find.text('Already signed in elsewhere'), findsNothing);
    expect(find.text('Device change cooling down'), findsNothing);
    expect(find.text('TIME REMAINING'), findsNothing);
    expect(find.widgetWithText(CampusButton, 'Try again'), findsNothing);
    expect(find.textContaining('Lost or wiped that phone'), findsNothing);
  }

  testWidgets('faculty login never renders the active-session gate for a 403', (
    tester,
  ) async {
    final api = FakeSessionApi(
      onLoginFaculty: (email, password, deviceId) async {
        throw const ApiRequestError(
          message: 'This account is already signed in on another device.',
          status: 403,
          code: 'active_session_elsewhere',
        );
      },
    );
    await pumpFacultyLogin(tester, api);
    await submitFacultyCredentials(tester);

    expectNoDeviceGate();
    // Plain inline error only - staff multi-device access is deliberate.
    expect(
      find.text('This account is already signed in on another device.'),
      findsOneWidget,
    );
    expect(find.text('Institutional email'), findsOneWidget);
  });

  testWidgets('faculty login never renders the cooldown countdown for a 403', (
    tester,
  ) async {
    final api = FakeSessionApi(
      onLoginFaculty: (email, password, deviceId) async {
        throw const ApiRequestError(
          message: 'This account is cooling down.',
          status: 403,
          code: 'device_cooldown_active',
          remainingSeconds: 120,
        );
      },
    );
    await pumpFacultyLogin(tester, api);
    await submitFacultyCredentials(tester);

    expectNoDeviceGate();
    expect(find.text('This account is cooling down.'), findsOneWidget);
  });

  testWidgets(
    'student active-session gate appends the lost-device explainer (FIX5)',
    (tester) async {
      final database = createTestDatabase();
      addTearDown(database.close);
      final api = FakeSessionApi(
        onLoginStudent: (studentId, password, deviceId) async {
          throw const ApiRequestError(
            message: 'This account is already signed in on another device.',
            status: 403,
            code: 'active_session_elsewhere',
          );
        },
      );
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
          ],
          child: MaterialApp(
            theme: PupTheme.light,
            home: const StudentLoginScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).at(0), '2024-00123-MN-0');
      await tester.enterText(find.byType(TextField).at(1), 'ValidPassw0rd!');
      await tester.tap(find.widgetWithText(CampusButton, 'Sign in'));
      await tester.pumpAndSettle();

      expect(find.text('Already signed in elsewhere'), findsOneWidget);
      expect(
        find.text(
          'Lost or wiped that phone? Ask any instructor to run an '
          'Emergency Device Release from your class page.',
        ),
        findsOneWidget,
      );
    },
  );

  group('source-level staff-enforcement guarantees', () {
    late final String facultyLogin = File(
      'lib/src/features/auth/presentation/faculty_login_screen.dart',
    ).readAsStringSync();

    test('faculty login has no device-gate wiring at all', () {
      for (final needle in <String>[
        'device_gate_panels',
        'DeviceActiveSessionPanel',
        'DeviceCooldownPanel',
        'isActiveSessionElsewhere',
        'isDeviceCooldown',
        'DEVICE CHECK',
        'active_session_elsewhere',
        'device_cooldown_active',
      ]) {
        expect(
          facultyLogin.contains(needle),
          isFalse,
          reason: 'faculty login must not reference $needle',
        );
      }
    });

    test('gate panels are only mounted by the student login journey', () {
      final offenders = <String>[];
      for (final entity in Directory('lib').listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        final source = entity.readAsStringSync();
        final referencesPanel =
            source.contains('DeviceActiveSessionPanel(') ||
            source.contains('DeviceCooldownPanel(');
        if (!referencesPanel) continue;
        final normalized = entity.path.replaceAll(r'\', '/');
        final isGateDefinition = normalized.endsWith(
          'auth/presentation/widgets/device_gate_panels.dart',
        );
        final isStudentLogin = normalized.endsWith(
          'auth/presentation/student_login_screen.dart',
        );
        if (!isGateDefinition && !isStudentLogin) {
          offenders.add(normalized);
        }
      }
      expect(offenders, isEmpty);
    });

    test('session-replacement handling stays event-driven', () {
      final monitor = File(
        'lib/src/core/network/session_replacement.dart',
      ).readAsStringSync();
      // A socket listener is the only trigger; nothing role-aware and no
      // proactive polling of device-integrity endpoints.
      expect(monitor.contains('auth:session-replaced'), isTrue);
      expect(monitor.contains('socket.on(authSessionReplacedEvent'), isTrue);
      expect(monitor.contains('active_session_elsewhere'), isFalse);
      expect(monitor.contains('device_cooldown_active'), isFalse);
    });
  });
}
